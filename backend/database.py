import os
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

logger = logging.getLogger(__name__)

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./vitalwatch.db")

if DATABASE_URL.startswith("postgresql"):
    if "sslmode" not in DATABASE_URL:
        DATABASE_URL = DATABASE_URL + "?sslmode=require"
    engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=300)
else:
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def test_connection():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("✅ Database connection successful")
        return True
    except Exception as e:
        logger.warning(f"⚠️  Database unavailable: {e}. Running without DB logging.")
        return False
