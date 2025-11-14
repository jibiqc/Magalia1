"""Authentication endpoints for magic link email login."""
import secrets
import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Query
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel, EmailStr

from ..db import get_db
from ..models.auth_models import User, LoginToken
from ..auth.session import create_session, get_session, clear_session
from ..auth.email import send_magic_link_email

router = APIRouter(prefix="/auth", tags=["auth"])


class RequestLinkRequest(BaseModel):
    email: EmailStr


class UserResponse(BaseModel):
    email: str
    display_name: Optional[str]
    role: str


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> Optional[User]:
    """Get current user from session, or None if not authenticated."""
    session_data = get_session(request)
    if not session_data:
        return None
    
    user_id = session_data.get("user_id")
    if not user_id:
        return None
    
    return db.query(User).filter(User.id == user_id).first()


@router.post("/request-link")
async def request_link(
    payload: RequestLinkRequest,
    db: Session = Depends(get_db)
):
    """Request a magic link for email authentication."""
    email = payload.email.lower().strip()
    
    # Validate @eetvl.com domain
    if not email.endswith("@eetvl.com"):
        raise HTTPException(
            status_code=400,
            detail="Only @eetvl.com email addresses are allowed."
        )
    
    # Rate limiting: max 5 requests per hour per email
    # First check if user exists to get user_id
    existing_user = db.query(User).filter(User.email == email).first()
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    
    if existing_user:
        recent_requests = db.query(LoginToken).filter(
            and_(
                LoginToken.user_id == existing_user.id,
                LoginToken.created_at >= one_hour_ago
            )
        ).count()
    else:
        recent_requests = 0
    
    if recent_requests >= 5:
        raise HTTPException(
            status_code=429,
            detail="Too many requests. Please try again later."
        )
    
    # Find or create user
    user = db.query(User).filter(User.email == email).first()
    if not user:
        # Extract display name from email (e.g., "john.doe@eetvl.com" -> "John Doe")
        display_name = email.split("@")[0].replace(".", " ").title()
        user = User(
            email=email,
            display_name=display_name,
            role="user"
        )
        db.add(user)
        db.flush()  # Get user.id without committing
    
    # Create magic link token
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    login_token = LoginToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at
    )
    db.add(login_token)
    db.commit()
    
    # Send email
    # Domain validation already passed, so if SMTP fails, return a 5xx error
    try:
        send_magic_link_email(user.email, raw_token)
    except Exception as e:
        # Log the actual error for debugging
        print(f"Failed to send magic link email to {user.email}: {e}")
        # Return 500 with generic message (don't expose SMTP details)
        raise HTTPException(
            status_code=500,
            detail="Failed to send magic link email. Please contact the administrator."
        )
    
    return {"message": "Check your inbox."}


@router.get("/magic")
async def magic_link(
    token: str = Query(..., description="Magic link token"),
    db: Session = Depends(get_db)
):
    """Validate magic link token and create session."""
    # Hash the token to look it up
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    # Find token
    login_token = db.query(LoginToken).filter(
        LoginToken.token_hash == token_hash
    ).first()
    
    if not login_token:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired token."
        )
    
    # Check if already used
    if login_token.used_at is not None:
        raise HTTPException(
            status_code=400,
            detail="This link has already been used."
        )
    
    # Check if expired
    if login_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=400,
            detail="This link has expired."
        )
    
    # Get user
    user = db.query(User).filter(User.id == login_token.user_id).first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found."
        )
    
    # Mark token as used
    login_token.used_at = datetime.now(timezone.utc)
    
    # Update user's last login
    user.last_login_at = datetime.now(timezone.utc)
    
    db.commit()
    
    # Create redirect response
    from ..config import MAGALIA_APP_BASE_URL
    redirect_response = RedirectResponse(url=MAGALIA_APP_BASE_URL, status_code=302)
    
    # Create session
    create_session(
        redirect_response,
        user_id=user.id,
        email=user.email,
        display_name=user.display_name or "",
        role=user.role
    )
    
    return redirect_response


@router.get("/me")
async def get_me(
    request: Request,
    db: Session = Depends(get_db)
):
    """Get current authenticated user."""
    session_data = get_session(request)
    if not session_data:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user_id = session_data.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return UserResponse(
        email=user.email,
        display_name=user.display_name,
        role=user.role
    )


@router.post("/logout")
async def logout(response: Response):
    """Log out the current user."""
    clear_session(response)
    return {"message": "Logged out successfully"}

