from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from project root
# __file__ is backend/src/models/db.py, so we go up 4 levels to get to project root
# backend/src/models/db.py -> backend/src/models -> backend/src -> backend -> project_root
project_root = Path(__file__).resolve().parent.parent.parent.parent
env_path = project_root / ".env"
# Also try loading from current directory as fallback
load_dotenv(env_path)
load_dotenv()  # Fallback: try loading from current working directory

# Get database URL from environment variable or use default
# Default to SQLite for development (app.db in project root)
default_db_path = project_root / "app.db"
# Always use the app.db in project root (where migrations were run)
DATABASE_URL = f"sqlite:///{default_db_path}"

# Debug: print DATABASE_URL to verify it's loaded correctly
if "sqlite" not in DATABASE_URL.lower():
    print(f"WARNING: DATABASE_URL is not SQLite: {DATABASE_URL}")
    print(f"Looking for .env at: {env_path}")
    print(f".env exists: {env_path.exists()}")
    if env_path.exists():
        with open(env_path, 'r') as f:
            print(f".env contents: {f.read()}")

# Create engine
# SQLite needs check_same_thread=False for FastAPI
if "sqlite" in DATABASE_URL.lower():
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    engine = create_engine(DATABASE_URL)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for models
Base = declarative_base()

