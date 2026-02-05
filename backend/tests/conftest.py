"""
Shared pytest fixtures for Yadro test suite.

Module-level defaults — individual test classes may override
with their own class-level fixtures (pytest priority: class > conftest).
"""
import pytest

from app.storage import Database


@pytest.fixture
def db(tmp_path):
    """Fresh database for each test."""
    return Database(tmp_path / "test.sqlite3")


@pytest.fixture
def user_id(db):
    """Create a test user, return user_id."""
    return db.execute(
        "INSERT INTO users (tg_id, username) VALUES (?, ?)",
        (123456789, "testuser"),
    )
