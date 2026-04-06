"""
db.py — centralised database connection for the inventory admin app.

All modules import get_conn() and DB_PATH from here.
Never open sqlite3.connect() directly in route handlers.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "sql_inventory_master.db"

# Columns added in Phase 1 migration — used by check_schema()
_REQUIRED_COLUMNS: dict[str, set[str]] = {
    "master_inventory": {"version", "updated_at", "updated_by", "created_at"},
    "item_id_list":     {"version", "updated_at", "updated_by", "created_at"},
    "event_tag_catalog": {"tag_name", "status", "created_at", "updated_at", "version"},
}
_REQUIRED_TABLES = {"roles", "users", "audit_log", "event_tag_catalog"}


def get_conn() -> sqlite3.Connection:
    """
    Open a SQLite connection with:
      - Row factory (access columns by name)
      - Foreign key enforcement
      - WAL journal mode (concurrent readers + one writer)
      - 5-second busy timeout (prevents instant lock errors under light concurrency)
    """
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def check_schema() -> list[str]:
    """
    Return a list of human-readable warnings if the Phase 1 migration has not
    been applied.  Call on startup and log/print any returned warnings.
    Returns an empty list when the schema is up to date.
    """
    warnings: list[str] = []
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    try:
        # Check required tables
        for table in _REQUIRED_TABLES:
            row = conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
                (table,),
            ).fetchone()
            if row is None:
                warnings.append(f"Missing table: '{table}'  ← run migrate.py")

        # Check required columns
        for table, required_cols in _REQUIRED_COLUMNS.items():
            try:
                info = conn.execute(f"PRAGMA table_info({table})").fetchall()
                existing = {r["name"] for r in info}
                for col in sorted(required_cols - existing):
                    warnings.append(
                        f"Missing column: {table}.{col}  ← run migrate.py"
                    )
            except Exception:
                pass
    finally:
        conn.close()
    return warnings
