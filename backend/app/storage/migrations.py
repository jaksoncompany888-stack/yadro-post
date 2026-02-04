"""
Yadro v0 - Versioned Migration Runner

Each migration is a function(conn: sqlite3.Connection).
Migrations run in order; only those with version > current DB version execute.

Adding a new migration:
    1. Write a function _mNNN_description(conn) below.
    2. Append (NNN, _mNNN_description) to the MIGRATIONS list.
    3. Done. The runner handles the rest.
"""
import logging
import sqlite3

_logger = logging.getLogger("yadro.migrations")


# ---------------------------------------------------------------------------
# Version table helpers
# ---------------------------------------------------------------------------


def _ensure_version_table(conn: sqlite3.Connection) -> None:
    """Create schema_version table if it does not exist and seed the row."""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_version (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            version INTEGER NOT NULL DEFAULT 0
        )
    """)
    conn.execute("INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, 0)")
    conn.commit()


def _get_version(conn: sqlite3.Connection) -> int:
    _ensure_version_table(conn)
    row = conn.execute("SELECT version FROM schema_version WHERE id = 1").fetchone()
    return row[0] if row else 0


def _set_version(conn: sqlite3.Connection, version: int) -> None:
    conn.execute("UPDATE schema_version SET version = ? WHERE id = 1", (version,))
    conn.commit()


# ---------------------------------------------------------------------------
# Auto-detect version for pre-existing databases (no schema_version table yet)
# ---------------------------------------------------------------------------


def _detect_current_version(conn: sqlite3.Connection) -> int:
    """Inspect column presence to determine which migrations already applied."""
    version = 0

    # Migration 1: drafts.metadata
    drafts_cols = {row[1] for row in conn.execute("PRAGMA table_info(drafts)").fetchall()}
    if "metadata" in drafts_cols:
        version = max(version, 1)

    # Migration 2: users.role
    users_cols = {row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "role" in users_cols:
        version = max(version, 2)

    # Migration 3: users auth columns (all four must be present)
    if all(c in users_cols for c in ("email", "password_hash", "first_name", "last_name")):
        version = max(version, 3)

    return version


# ---------------------------------------------------------------------------
# Migration functions
# ---------------------------------------------------------------------------


def _m001_drafts_metadata(conn: sqlite3.Connection) -> None:
    """Add metadata column to drafts if missing."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(drafts)").fetchall()}
    if "metadata" not in cols:
        conn.execute("ALTER TABLE drafts ADD COLUMN metadata TEXT DEFAULT '{}'")
        conn.commit()
        _logger.info("Migration 1: added metadata column to drafts")


def _m002_users_role(conn: sqlite3.Connection) -> None:
    """Add role column to users if missing."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "role" not in cols:
        conn.execute("ALTER TABLE users ADD COLUMN role TEXT DEFAULT 'user'")
        conn.commit()
        _logger.info("Migration 2: added role column to users")


def _m003_users_auth(conn: sqlite3.Connection) -> None:
    """Add email, password_hash, first_name, last_name to users if missing."""
    cols = {row[1] for row in conn.execute("PRAGMA table_info(users)").fetchall()}
    additions = {
        "email": "ALTER TABLE users ADD COLUMN email TEXT UNIQUE",
        "password_hash": "ALTER TABLE users ADD COLUMN password_hash TEXT",
        "first_name": "ALTER TABLE users ADD COLUMN first_name TEXT",
        "last_name": "ALTER TABLE users ADD COLUMN last_name TEXT",
    }
    changed = False
    for col, sql in additions.items():
        if col not in cols:
            conn.execute(sql)
            _logger.info("Migration 3: added %s column to users", col)
            changed = True
    if changed:
        conn.commit()


# ---------------------------------------------------------------------------
# Registry — ordered list. Append new migrations here.
# ---------------------------------------------------------------------------

MIGRATIONS = [
    (1, _m001_drafts_metadata),
    (2, _m002_users_role),
    (3, _m003_users_auth),
]


# ---------------------------------------------------------------------------
# Runner
# ---------------------------------------------------------------------------


def run_migrations(conn: sqlite3.Connection) -> None:
    """
    Run all pending migrations against *conn*.

    On first encounter of an existing DB without schema_version,
    auto-detects the current version from column presence so that
    already-applied migrations are not re-run.
    """
    _ensure_version_table(conn)
    current = _get_version(conn)

    # Auto-detect for pre-existing databases
    if current == 0:
        detected = _detect_current_version(conn)
        if detected > 0:
            _set_version(conn, detected)
            _logger.info("Auto-detected schema version: %d (existing database)", detected)
            current = detected

    _logger.info("Current schema version: %d", current)

    for version, fn in MIGRATIONS:
        if version <= current:
            continue
        _logger.info("Running migration %d: %s", version, fn.__name__)
        try:
            fn(conn)
            _set_version(conn, version)
            _logger.info("Migration %d completed", version)
        except Exception:
            _logger.error("Migration %d failed", version, exc_info=True)
            raise  # Stop — do not skip past a failed migration
