from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from .db import Base


def utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    """User model for @eetvl.com email authentication."""
    
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    display_name = Column(String, nullable=True)
    role = Column(String, default="user", nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationship to login tokens
    login_tokens = relationship("LoginToken", back_populates="user", cascade="all, delete-orphan")


class LoginToken(Base):
    """Magic link token for email authentication."""
    
    __tablename__ = "login_tokens"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String, nullable=False, unique=True, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    
    # Relationship to user
    user = relationship("User", back_populates="login_tokens")
    
    # Index for rate limiting queries
    __table_args__ = (
        Index('ix_login_tokens_user_created', 'user_id', 'created_at'),
    )


