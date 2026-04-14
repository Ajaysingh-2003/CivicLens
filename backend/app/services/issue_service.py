from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, joinedload, selectinload
from sqlalchemy import func
from geoalchemy2.shape import to_shape
from app.models.issue import Issue, IssueStatus
from app.models.issue_history import IssueHistory
from app.models.category import Category
from app.models.user import User
import random
from app.schemas.issue import IssueCreate, IssueUpdateStatus

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
    if issue.reporter:
        issue_dict["reporter_name"] = issue.reporter.name
        
    # Mock Image URL
    mock_images = [
        "https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?q=80&w=800&auto=format&fit=crop", # Pothole
        "https://images.unsplash.com/photo-1532996122724-e3c354a0b15f?q=80&w=800&auto=format&fit=crop", # Garbage
        "https://images.unsplash.com/photo-1584464491033-06628f3a6b7b?q=80&w=800&auto=format&fit=crop", # Ruined road
        "https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?q=80&w=800&auto=format&fit=crop"  # Flood
    ]
    issue_dict["image_url"] = random.choice(mock_images)
    
    # Calculate comments count
    issue_dict["comments_count"] = len(issue.comments) if getattr(issue, 'comments', None) is not None else 0
    
    return issue_dict

def create_issue(db: Session, issue_in: IssueCreate, reporter_id: int) -> dict:
    # Convert lat/lng into a PostGIS EWKT SRID 4326 string
    # PostGIS usually expects (Longitude Latitude)
    wkt_geom = f"SRID=4326;POINT({issue_in.lng} {issue_in.lat})"
    
    db_obj = Issue(
        title=issue_in.title,
        description=issue_in.description,
        status=IssueStatus.PENDING,
        priority=issue_in.priority,
        category_id=issue_in.category_id,
        reporter_id=reporter_id,
        geom=wkt_geom,
        upvotes=0,
        downvotes=0
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)

    # Automatically create the first audit log entry
    history_obj = IssueHistory(
        issue_id=db_obj.id,
        actor_id=reporter_id,
        old_status=None,
        new_status=IssueStatus.PENDING.name,
        remarks="Issue newly reported via mobile app."
    )
    db.add(history_obj)
    db.commit()

    return format_issue(db_obj)

def get_issues(
    db: Session, skip: int = 0, limit: int = 100, lat: Optional[float] = None, lng: Optional[float] = None, radius_km: float = 5.0
) -> List[dict]:
    # Use selectinload for collections like comments to avoid N+1 queries
    query = db.query(Issue).options(
        joinedload(Issue.category), 
        joinedload(Issue.reporter),
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
        selectinload(Issue.comments)
    ).filter(Issue.reporter_id == user_id).order_by(Issue.created_at.desc())
    
    issues = query.offset(skip).limit(limit).all()
    return [format_issue(issue) for issue in issues]

def get_issue(db: Session, issue_id: int) -> Optional[dict]:
    # Load everything needed for the detailed pop-up
    issue = (
        db.query(Issue)
        .options(joinedload(Issue.category), joinedload(Issue.reporter))
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

