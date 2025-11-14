"""Session management using signed HttpOnly cookies."""
import json
import hmac
import hashlib
import base64
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict
from fastapi import Request, Response
from ..config import SECRET_KEY

SESSION_COOKIE_NAME = "magalia_session"
SESSION_TTL_DAYS = 7


def _sign_data(data: str) -> str:
    """Sign data using HMAC-SHA256."""
    signature = hmac.new(
        SECRET_KEY.encode(),
        data.encode(),
        hashlib.sha256
    ).hexdigest()
    return f"{data}.{signature}"


def _verify_signed_data(signed_data: str) -> Optional[str]:
    """Verify and extract data from signed string."""
    try:
        if "." not in signed_data:
            return None
        data, signature = signed_data.rsplit(".", 1)
        expected_signature = hmac.new(
            SECRET_KEY.encode(),
            data.encode(),
            hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected_signature):
            return None
        return data
    except Exception:
        return None


def create_session(response: Response, user_id: int, email: str, display_name: str, role: str) -> None:
    """Create a signed session cookie."""
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_TTL_DAYS)
    session_data = {
        "user_id": user_id,
        "email": email,
        "display_name": display_name,
        "role": role,
        "expires_at": expires.isoformat(),
    }
    json_data = json.dumps(session_data)
    signed = _sign_data(json_data)
    encoded = base64.b64encode(signed.encode()).decode()
    
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=encoded,
        max_age=SESSION_TTL_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="lax",
        path="/",
    )


def get_session(request: Request) -> Optional[Dict]:
    """Get and verify session from cookie."""
    cookie_value = request.cookies.get(SESSION_COOKIE_NAME)
    if not cookie_value:
        return None
    
    try:
        decoded = base64.b64decode(cookie_value.encode()).decode()
        data = _verify_signed_data(decoded)
        if not data:
            return None
        
        session_data = json.loads(data)
        expires_at = datetime.fromisoformat(session_data["expires_at"])
        if expires_at < datetime.now(timezone.utc):
            return None
        
        return session_data
    except Exception:
        return None


def clear_session(response: Response) -> None:
    """Clear the session cookie."""
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=False,
        samesite="lax",
        path="/",
    )

