"""Configuration settings for the Magalia backend."""
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from project root
project_root = Path(__file__).resolve().parent.parent.parent.parent
env_path = project_root / ".env"
load_dotenv(env_path)
load_dotenv()  # Fallback: try loading from current working directory

# Secret key for signing session cookies
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-production")

# Base URL for the application (used in magic link emails)
MAGALIA_APP_BASE_URL = os.getenv("MAGALIA_APP_BASE_URL", "http://localhost:5173")

# SMTP settings for sending emails
SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").lower() == "true"
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "noreply@eetvl.com")


