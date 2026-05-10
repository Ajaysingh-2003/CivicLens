from sqlalchemy import Column, Integer, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base

class IssueVote(Base):
    __tablename__ = "issue_votes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    issue_id = Column(Integer, ForeignKey("issues.id", ondelete="CASCADE"), nullable=False)
    vote_type = Column(Integer, nullable=False) # e.g. 1 for upvote, -1 for downvote

    __table_args__ = (
        UniqueConstraint('user_id', 'issue_id', name='_user_issue_vote_uc'),
    )

    user = relationship("User", back_populates="votes_cast")
    issue = relationship("Issue", back_populates="votes")
