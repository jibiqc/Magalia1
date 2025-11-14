"""Email sending utilities for magic link authentication."""
import logging
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

logger = logging.getLogger(__name__)


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
        # Set timeout for SMTP operations
        if SMTP_USE_TLS:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10)
            server.starttls()
        else:
            server = smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10)
        
        if SMTP_USER and SMTP_PASSWORD:
            server.login(SMTP_USER, SMTP_PASSWORD)
        
        server.send_message(msg)
        server.quit()
    except smtplib.SMTPAuthenticationError as e:
        # Authentication failed - likely wrong credentials or need app password
        logger.error(f"SMTP authentication failed for {SMTP_USER}: {e}")
        raise Exception("SMTP authentication failed. Please check your credentials or use an app password for Office 365.")
    except smtplib.SMTPException as e:
        # Other SMTP errors
        logger.error(f"SMTP error sending email to {to_email}: {e}")
        raise Exception(f"SMTP error: {str(e)}")
    except Exception as e:
        # Network or other errors
        logger.error(f"Failed to send email to {to_email}: {e}")
        raise Exception(f"Failed to send email: {str(e)}")

