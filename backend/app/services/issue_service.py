from typing import List, Optional
from sqlalchemy.orm import Session
from geoalchemy2.shape import to_shape
from app.models.issue import Issue, IssueStatus
from app.models.issue_history import IssueHistory
from app.schemas.issue import IssueCreate, IssueUpdateStatus

def format_issue(issue: Issue) -> dict:
    """Safely converts the WKBElement PostGIS geometry into React-friendly lat/lng floats."""
    issue_dict = {c.name: getattr(issue, c.name) for c in issue.__table__.columns if c.name != 'geom'}
    if getattr(issue, 'geom', None) is not None:
        point = to_shape(issue.geom)
        issue_dict["lat"] = point.y
        issue_dict["lng"] = point.x
    else:
        issue_dict["lat"] = 0.0
        issue_dict["lng"] = 0.0
    return issue_dict

def create_issue(db: Session, issue_in: IssueCreate, reporter_id: int) -> dict:
    # Convert lat/lng into a PostGIS EWKT SRID 4326 string
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

def get_issues(db: Session, skip: int = 0, limit: int = 100) -> List[dict]:
    issues = db.query(Issue).offset(skip).limit(limit).all()
    return [format_issue(issue) for issue in issues]

def get_issue(db: Session, issue_id: int) -> Optional[dict]:
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
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
