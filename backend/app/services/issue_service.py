from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func
from geoalchemy2.shape import to_shape
from app.models.issue import Issue, IssueStatus, IssuePriority
from app.models.issue_history import IssueHistory
from app.models.issue_vote import IssueVote
from app.models.category import Category
from app.models.user import User
from app.models.issue_image import IssueImage
from app.models.city import City
from app.schemas.issue import IssueCreate, IssueUpdateStatus
from app.services.user_service import record_points, revoke_issue_points
from app.models.point_transaction import PointReason

def format_issue(issue: Issue) -> Dict[str, Any]:
    """Safely converts the WKBElement PostGIS geometry into React-friendly lat/lng floats and adds metadata."""
    issue_dict = {c.name: getattr(issue, c.name) for c in issue.__table__.columns if c.name != 'geom'}
    
    # Extract coordinates
    if getattr(issue, 'geom', None) is not None:
        point = to_shape(issue.geom)
        issue_dict["lat"] = point.y
        issue_dict["lng"] = point.x
    else:
        issue_dict["lat"] = 0.0
        issue_dict["lng"] = 0.0

    # Add Categorization & Branding
    if issue.category:
        issue_dict["category_name"] = issue.category.name
        issue_dict["category_color"] = issue.category.marker_color
    else:
        issue_dict["category_name"] = "Uncategorized"
        issue_dict["category_color"] = "#64748b" # Default grey

    # Add Actor Info
    if getattr(issue, 'reporter', None):
        issue_dict["reporter_name"] = issue.reporter.username
        issue_dict["reporter_avatar_url"] = issue.reporter.avatar_url
    else:
        issue_dict["reporter_name"] = "Deleted User"
        issue_dict["reporter_avatar_url"] = None
        
    # Image URL
    if getattr(issue, 'images', None) and len(issue.images) > 0:
        issue_dict["image_url"] = issue.images[0].image_url
    else:
        issue_dict["image_url"] = None
    
    # Calculate comments count
    issue_dict["comments_count"] = len(issue.comments) if getattr(issue, 'comments', None) is not None else 0
    
    return issue_dict

def create_issue(db: Session, issue_in: IssueCreate, reporter_id: int) -> dict:
    # Convert lat/lng into a PostGIS EWKT SRID 4326 string
    wkt_geom = f"SRID=4326;POINT({issue_in.lng} {issue_in.lat})"
    
    # Reverse Geocode: Find intersecting city using PostGIS ORM
    city = db.query(City).filter(
        func.ST_Contains(City.geom, func.ST_GeomFromText(wkt_geom, 4326))
    ).first()
    city_id = city.id if city else None
    
    db_obj = Issue(
        title=issue_in.title,
        description=issue_in.description,
        status=IssueStatus.PENDING,
        priority=IssuePriority.LOW, # Default to LOW until upvoted
        category_id=issue_in.category_id,
        reporter_id=reporter_id,
        city_id=city_id,
        geom=wkt_geom,
        upvotes=1,
        downvotes=0
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)

    # Automatically add upvote from the reporter
    new_vote = IssueVote(issue_id=db_obj.id, user_id=reporter_id, vote_type=1)
    db.add(new_vote)

    # Award 1 point for creating the issue (ledger + cache)
    reporter = db.query(User).filter(User.id == reporter_id).first()
    if reporter:
        record_points(db, reporter, 1, PointReason.ISSUE_CREATED,
                      reference_issue_id=db_obj.id)

    # Automatically create the first audit log entry
    history_obj = IssueHistory(
        issue_id=db_obj.id,
        actor_id=reporter_id,
        old_status=None,
        new_status=IssueStatus.PENDING.name,
        remarks="Issue newly reported via mobile app."
    )
    db.add(history_obj)
    # Create the image record if an image was uploaded
    if issue_in.image_url:
        image_obj = IssueImage(
            issue_id=db_obj.id,
            image_url=issue_in.image_url
        )
        db.add(image_obj)
        
    db.commit()

    # Reload with eager-loaded relationships for proper response formatting
    return get_issue(db, db_obj.id)

def get_issues(
    db: Session, skip: int = 0, limit: int = 100, lat: Optional[float] = None, lng: Optional[float] = None, radius_km: float = 5.0
) -> List[dict]:
    # Use selectinload for collections like comments to avoid N+1 queries
    query = db.query(Issue).options(
        joinedload(Issue.category), 
        joinedload(Issue.reporter),
        selectinload(Issue.images),
        selectinload(Issue.comments)
    )

    if lat is not None and lng is not None:
        user_point = f"SRID=4326;POINT({lng} {lat})"
        # PostGIS ST_DistanceSphere returns distance in meters 
        query = query.filter(
            func.ST_DistanceSphere(Issue.geom, func.ST_GeomFromText(user_point, 4326)) <= (radius_km * 1000)
        )
        # Order by closest
        query = query.order_by(
            func.ST_DistanceSphere(Issue.geom, func.ST_GeomFromText(user_point, 4326))
        )
    else:
        # Default sort by newest
        query = query.order_by(Issue.created_at.desc())

    issues = query.offset(skip).limit(limit).all()
    return [format_issue(issue) for issue in issues]

def get_user_issues(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[dict]:
    query = db.query(Issue).options(
        joinedload(Issue.category), 
        joinedload(Issue.reporter),
        selectinload(Issue.images),
        selectinload(Issue.comments)
    ).filter(Issue.reporter_id == user_id).order_by(Issue.created_at.desc())
    
    issues = query.offset(skip).limit(limit).all()
    return [format_issue(issue) for issue in issues]

def get_issue(db: Session, issue_id: int) -> Optional[dict]:
    # Load everything needed for the detailed pop-up
    issue = (
        db.query(Issue)
        .options(
            joinedload(Issue.category), 
            joinedload(Issue.reporter),
            selectinload(Issue.images),
            selectinload(Issue.comments)
        )
        .filter(Issue.id == issue_id)
        .first()
    )
    if issue:
        return format_issue(issue)
    return None

def update_issue_status(
    db: Session, issue_id: int, status_update: IssueUpdateStatus, actor_id: int
) -> Optional[dict]:
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        return None
        
    old_status = issue.status
    if old_status == status_update.status:
        return format_issue(issue) # No change needed

    issue.status = status_update.status
    
    # Securely write the immutable audit log
    history_obj = IssueHistory(
        issue_id=issue.id,
        actor_id=actor_id,
        old_status=old_status.name,
        new_status=status_update.status.name,
        remarks=status_update.remarks or "Status updated by admin."
    )
    db.add(history_obj)
    db.commit()
    db.refresh(issue)
    
    return format_issue(issue)

def delete_issue(db: Session, issue_id: int) -> bool:
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        return False
    # Reverse ALL points this user earned from this issue
    # (creation point + any upvote points from others)
    reporter = db.query(User).filter(User.id == issue.reporter_id).first()
    if reporter:
        revoke_issue_points(db, reporter, issue_id)
        db.flush()  # Persist points change before delete cascade expires the user object
    db.delete(issue)
    db.commit()
    return True

def vote_issue(db: Session, issue_id: int, user_id: int, vote_type: int) -> Optional[dict]:
    """Handles upvoting/downvoting and dynamic priority escalation."""
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        return None

    reporter = db.query(User).filter(User.id == issue.reporter_id).first()
    point_change = 0

    # Check for existing vote
    existing_vote = db.query(IssueVote).filter(
        IssueVote.issue_id == issue_id, 
        IssueVote.user_id == user_id
    ).first()

    if existing_vote:
        if existing_vote.vote_type == vote_type:
            # Same vote, do nothing or maybe remove vote (toggle logic). 
            # For simplicity, we just return current state if it's the exact same vote.
            return format_issue(issue)
        
        # Changing vote (e.g., from downvote to upvote)
        if existing_vote.vote_type == 1:
            issue.upvotes -= 1
            point_change -= 1
        elif existing_vote.vote_type == -1:
            issue.downvotes -= 1
            point_change += 1

        existing_vote.vote_type = vote_type
        if vote_type == 1:
            issue.upvotes += 1
            point_change += 1
        elif vote_type == -1:
            issue.downvotes += 1
            point_change -= 1
    else:
        # New vote
        new_vote = IssueVote(issue_id=issue_id, user_id=user_id, vote_type=vote_type)
        db.add(new_vote)
        if vote_type == 1:
            issue.upvotes += 1
            point_change += 1
        elif vote_type == -1:
            issue.downvotes += 1
            point_change -= 1

    # Apply reputation changes to the reporter if someone else voted
    if reporter and point_change != 0 and user_id != issue.reporter_id:
        reason = PointReason.VOTE_CHANGED if existing_vote else PointReason.VOTE_RECEIVED
        record_points(db, reporter, point_change, reason,
                      reference_issue_id=issue_id, caused_by_user_id=user_id)

    # Dynamic Priority Logic based on net votes
    net_votes = issue.upvotes - issue.downvotes
    if net_votes >= 100:
        issue.priority = IssuePriority.CRITICAL
    elif net_votes >= 50:
        issue.priority = IssuePriority.HIGH
    elif net_votes >= 10:
        issue.priority = IssuePriority.MEDIUM
    else:
        issue.priority = IssuePriority.LOW

    db.commit()
    
    # Reload with relations for proper formatting
    return get_issue(db, issue_id)


def find_nearby_duplicates(
    db: Session, lat: float, lng: float, category_id: int, radius_m: int = 50
) -> List[dict]:
    """
    Finds potential duplicate issues using a PostGIS spatial query.
    Searches within `radius_m` meters for issues with the same category
    that are still active (not resolved/rejected) and created within the last 6 months.
    Uses the GIST index on geom for O(log n) performance.
    """
    from datetime import datetime, timedelta

    user_point = f"SRID=4326;POINT({lng} {lat})"
    six_months_ago = datetime.utcnow() - timedelta(days=180)

    query = db.query(Issue).options(
        joinedload(Issue.category),
        joinedload(Issue.reporter),
        selectinload(Issue.images),
    ).filter(
        # Same category
        Issue.category_id == category_id,
        # Within radius (ST_DistanceSphere returns meters)
        func.ST_DistanceSphere(
            Issue.geom, func.ST_GeomFromText(user_point, 4326)
        ) <= radius_m,
        # Only active issues
        Issue.status.notin_([IssueStatus.RESOLVED, IssueStatus.REJECTED]),
        # Created within last 6 months
        Issue.created_at >= six_months_ago,
    ).order_by(
        # Closest first
        func.ST_DistanceSphere(Issue.geom, func.ST_GeomFromText(user_point, 4326))
    ).limit(5)

    issues = query.all()
    
    results = []
    for issue in issues:
        item = {
            "id": issue.id,
            "title": issue.title,
            "status": issue.status,
            "upvotes": issue.upvotes,
            "image_url": issue.images[0].image_url if issue.images else None,
            "created_at": issue.created_at,
            "reporter_name": issue.reporter.username if issue.reporter else "Unknown",
            "category_name": issue.category.name if issue.category else "Uncategorized",
        }
        results.append(item)
    
    return results

from app.models.issue_report import IssueReport, ReportReason
from fastapi import HTTPException

def get_report_weight(level: int) -> int:
    if level == 1: return 1
    if level == 2: return 2
    if level == 3: return 4
    if level == 4: return 7
    if level >= 5: return 10
    return 1

def report_issue(db: Session, issue_id: int, reporter_id: int, reason: str, description: Optional[str] = None) -> None:
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
        
    if issue.reporter_id == reporter_id:
        raise HTTPException(status_code=400, detail="You cannot report your own issue")
        
    # Check if already reported
    existing_report = db.query(IssueReport).filter(
        IssueReport.issue_id == issue_id,
        IssueReport.reporter_id == reporter_id
    ).first()
    if existing_report:
        raise HTTPException(status_code=400, detail="You have already reported this issue")

    # Calculate weight
    user = db.query(User).filter(User.id == reporter_id).first()
    weight = get_report_weight(user.level.level_number if user and user.level else 1)

    # Create report
    new_report = IssueReport(
        issue_id=issue_id,
        reporter_id=reporter_id,
        reason=ReportReason(reason),
        description=description,
        weight_applied=weight
    )
    db.add(new_report)
    
    # Calculate total weight (flush first so the new report gets an ID but without committing)
    db.flush()
    
    total_weight = db.query(func.sum(IssueReport.weight_applied)).filter(
        IssueReport.issue_id == issue_id
    ).scalar() or 0
    
    # Auto-reject threshold = 15
    if total_weight >= 15 and issue.status != IssueStatus.REJECTED:
        old_status = issue.status
        issue.status = IssueStatus.REJECTED
        
        # Log history
        history = IssueHistory(
            issue_id=issue.id,
            changed_by_id=reporter_id,  # The straw that broke the camel's back
            old_status=old_status,
            new_status=IssueStatus.REJECTED,
            notes=f"Auto-rejected due to community reports (Total Weight: {total_weight})"
        )
        db.add(history)
        
    db.commit()
