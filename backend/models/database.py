"""
Database Configuration
SQLAlchemy + PostgreSQL
"""

import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import Column, String, DateTime, Text, Boolean, Integer, JSON
from datetime import datetime

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://postgres:postgres@localhost:5432/yadro_post"
)

engine = create_async_engine(DATABASE_URL, echo=True)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Channel(Base):
    __tablename__ = "channels"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    type = Column(String, nullable=False)  # telegram, vk
    name = Column(String, nullable=False)
    channel_id = Column(String, nullable=False)  # external ID
    access_token = Column(String)
    avatar_url = Column(String)
    is_connected = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    channel_ids = Column(JSON, default=list)
    status = Column(String, default="draft")  # draft, scheduled, published, failed
    scheduled_at = Column(DateTime)
    published_at = Column(DateTime)
    media_urls = Column(JSON, default=list)
    external_ids = Column(JSON, default=dict)  # {channel_id: external_post_id}
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Draft(Base):
    __tablename__ = "drafts"

    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False)
    content = Column(Text)
    metadata = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


async def init_db():
    """Create tables if not exist."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncSession:
    """Get database session."""
    async with async_session() as session:
        yield session
