import httpx
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.issue import Issue, IssueStatus

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

def send_push(push_token: str, title: str, body: str, data: dict = None):
    """Core function to send an Expo push notification."""
    if not push_token:
        return
        
    message = {
        "to": push_token,
        "title": title,
        "body": body,
        "data": data or {},
        "sound": "default",
    }
    
    # Fire and forget (we could use AsyncClient, but BackgroundTasks runs in a separate thread so httpx.post is fine)
    try:
        response = httpx.post(EXPO_PUSH_URL, json=message, timeout=5.0)
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to send push notification to {push_token}: {e}")


from app.db.session import SessionLocal

def notify_status_change(issue_id: int, new_status: IssueStatus):
    """Notify the reporter when their issue status changes."""
    db = SessionLocal()
    try:
        issue = db.query(Issue).get(issue_id)
        if not issue or not issue.reporter:
            return
            
        user = issue.reporter
        if not user.notifications_enabled or not user.push_token:
            return
            
        status_msg = {
            IssueStatus.PENDING: "is now visible to the public.",
            IssueStatus.ASSIGNED: "has been assigned to a department.",
            IssueStatus.IN_PROGRESS: "is currently in progress!",
            IssueStatus.RESOLVED: "has been resolved. Thank you for making the city better!",
            IssueStatus.REJECTED: "was rejected by moderators."
        }
        
        body = f"Your report '{issue.title}' {status_msg.get(new_status, 'status has been updated.')}"
        
        send_push(
            push_token=user.push_token,
            title="Status Update 📢",
            body=body,
            data={"issue_id": issue.id, "type": "STATUS_UPDATE"}
        )
    finally:
        db.close()


def notify_new_comment(issue_id: int, commenter_id: int):
    """Notify the reporter when someone comments on their issue."""
    db = SessionLocal()
    try:
        issue = db.query(Issue).get(issue_id)
        if not issue or not issue.reporter:
            return
            
        # Don't notify if the reporter is commenting on their own issue
        if issue.reporter_id == commenter_id:
            return
            
        reporter = issue.reporter
        if not reporter.notifications_enabled or not reporter.push_token:
            return
            
        commenter = db.query(User).get(commenter_id)
        commenter_name = commenter.username if commenter else "Someone"
        
        send_push(
            push_token=reporter.push_token,
            title="New Comment 💬",
            body=f"{commenter_name} commented on your report: '{issue.title}'",
            data={"issue_id": issue.id, "type": "NEW_COMMENT"}
        )
    finally:
        db.close()


def notify_rejection(issue_id: int):
    """Notify the reporter when their issue is rejected by AI moderation."""
    db = SessionLocal()
    try:
        issue = db.query(Issue).get(issue_id)
        if not issue or not issue.reporter:
            return
            
        user = issue.reporter
        if not user.notifications_enabled or not user.push_token:
            return
            
        send_push(
            push_token=user.push_token,
            title="Report Not Approved ⚠️",
            body=f"Your report '{issue.title}' was flagged by moderation and could not be published.",
            data={"issue_id": issue.id, "type": "REJECTED"}
        )
    finally:
        db.close()


import threading

def _run_in_background(func, *args):
    """Helper to run a deep-service trigger asynchronously."""
    threading.Thread(target=func, args=args).start()

def notify_welcome(user_id: int):
    """Notify a new user when they register their push token."""
    db = SessionLocal()
    try:
        user = db.query(User).get(user_id)
        if not user or not user.push_token or not user.notifications_enabled:
            return
        
        send_push(
            push_token=user.push_token,
            title="Welcome to CivicLens! 🎉",
            body="Start making a difference in your city by reporting issues.",
            data={"type": "WELCOME"}
        )
    finally:
        db.close()

def notify_level_up(user_id: int):
    """Notify user when they level up."""
    def _task(u_id):
        db = SessionLocal()
        try:
            user = db.query(User).get(u_id)
            if not user or not user.push_token or not user.notifications_enabled or not user.level:
                return
            
            send_push(
                push_token=user.push_token,
                title="Level Up! 🏆",
                body=f"Congratulations! You just leveled up to {user.level.title}. Keep it up!",
                data={"type": "LEVEL_UP"}
            )
        finally:
            db.close()
            
    _run_in_background(_task, user_id)


def notify_upvote_milestone(issue_id: int, upvotes: int):
    """Notify the reporter when their issue hits an upvote milestone."""
    def _task(i_id, ups):
        db = SessionLocal()
        try:
            issue = db.query(Issue).get(i_id)
            if not issue or not issue.reporter:
                return
            
            user = issue.reporter
            if not user.notifications_enabled or not user.push_token:
                return
                
            send_push(
                push_token=user.push_token,
                title="Community Support 📈",
                body=f"Your report '{issue.title}' just hit {ups} upvotes!",
                data={"issue_id": issue.id, "type": "MILESTONE"}
            )
        finally:
            db.close()
            
    _run_in_background(_task, issue_id, upvotes)


def notify_nearby_issue(issue_id: int):
    """Notify active users in the same city about a new issue."""
    def _task(i_id):
        db = SessionLocal()
        try:
            issue = db.query(Issue).get(i_id)
            if not issue or not issue.city_id:
                return
                
            nearby_users = db.query(User).filter(
                User.city_id == issue.city_id,
                User.id != issue.reporter_id,
                User.notifications_enabled == True,
                User.push_token.isnot(None)
            ).limit(50).all()
            
            for u in nearby_users:
                send_push(
                    push_token=u.push_token,
                    title="New Nearby Report 📍",
                    body=f"A new issue '{issue.title}' was just reported in your city. Can you verify it?",
                    data={"issue_id": issue.id, "type": "NEARBY_ISSUE"}
                )
        finally:
            db.close()
            
    _run_in_background(_task, issue_id)
