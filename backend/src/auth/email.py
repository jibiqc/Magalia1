"""Email sending utilities for magic link authentication."""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from ..config import (
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASSWORD,
    SMTP_USE_TLS,
    SMTP_FROM_EMAIL,
    MAGALIA_APP_BASE_URL,
)


def send_magic_link_email(to_email: str, token: str) -> None:
    """Send a magic link email to the user."""
    magic_link = f"{MAGALIA_APP_BASE_URL}/auth/magic?token={token}"
    
    subject = "Your Magalia Login Link"
    body = f"""Hello,

Click the link below to log in to Magalia:

{magic_link}

This link will expire in 10 minutes.

If you didn't request this link, please ignore this email.

Best regards,
Magalia Team
"""
    
    msg = MIMEMultipart()
    msg["From"] = SMTP_FROM_EMAIL
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))
    
    try:
        if SMTP_USE_TLS:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
            server.starttls()
        else:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        
        if SMTP_USER and SMTP_PASSWORD:
            server.login(SMTP_USER, SMTP_PASSWORD)
        
        server.send_message(msg)
        server.quit()
    except Exception as e:
        # Log error but don't fail the request
        # In production, use proper logging
        print(f"Failed to send email to {to_email}: {e}")
        raise

