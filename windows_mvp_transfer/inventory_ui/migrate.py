"""
migrate.py — idempotent migration runner.

Applies all *.sql files in inventory_app/migrations/ that have not yet been
recorded in the schema_migrations tracking table.

Usage (from the repo root or from inventory_app/ui/):
    python inventory_app/ui/migrate.py
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "sql_inventory_master.db"
MIGRATIONS_DIR = ROOT / "inventory_app" / "migrations"
DEFAULT_EVENT_THEME_ACCENT = "#4F8CFF"
ROUGH_EVENT_THEME_COLORS = {
    "Real Tantra": "#FB0404",
    "Real Coach Program": "#00468C",
    "Real Man 1": "#12C4AD",
    "Real Woman 1": "#12C4AD",
    "Real Spiritual Quest": "#B491F6",
    "Real Relationships": "#FB0404",
}


def _ensure_event_tag_catalog_columns(conn: sqlite3.Connection) -> bool:
    """
    Backfill columns for databases that created event_tag_catalog from an older
    migration variant before governance columns were added.

    Returns True when any ALTER TABLE was applied.
    """
    table_exists = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='event_tag_catalog'"
    ).fetchone()
    if not table_exists:
        return False

    info = conn.execute("PRAGMA table_info(event_tag_catalog)").fetchall()
    cols = {row[1] for row in info}
    changed = False

    if "version" not in cols:
        conn.execute(
            "ALTER TABLE event_tag_catalog ADD COLUMN version INTEGER NOT NULL DEFAULT 1"
        )
        changed = True

    if "created_by" not in cols:
        conn.execute("ALTER TABLE event_tag_catalog ADD COLUMN created_by TEXT")
        changed = True

    if "updated_by" not in cols:
        conn.execute("ALTER TABLE event_tag_catalog ADD COLUMN updated_by TEXT")
        changed = True

    return changed


def _ensure_event_name_theme_column(conn: sqlite3.Connection) -> bool:
    table_exists = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='event_name'"
    ).fetchone()
    if not table_exists:
        return False

    info = conn.execute("PRAGMA table_info(event_name)").fetchall()
    cols = {row[1] for row in info}
    changed = False

    if "theme_accent_hex" not in cols:
        conn.execute(
            f"ALTER TABLE event_name ADD COLUMN theme_accent_hex TEXT NOT NULL DEFAULT '{DEFAULT_EVENT_THEME_ACCENT}'"
        )
        for event_name, accent_hex in ROUGH_EVENT_THEME_COLORS.items():
            conn.execute(
                "UPDATE event_name SET theme_accent_hex = ? WHERE event_name = ?",
                (accent_hex, event_name),
            )
        changed = True

    return changed


def main() -> None:
    if not DB_PATH.exists():
        print(f"✗  Database not found: {DB_PATH}")
        return

    migration_files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    if not migration_files:
        print(f"No .sql files found in {MIGRATIONS_DIR}")
        return

    conn = sqlite3.connect(str(DB_PATH))
    try:
        # Ensure tracking table exists (safe to run every time)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                migration_id TEXT PRIMARY KEY,
                applied_at   TEXT NOT NULL
                             DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
            )
        """)
        conn.commit()

        applied_any = False
        for mf in migration_files:
            migration_id = mf.stem
            already = conn.execute(
                "SELECT 1 FROM schema_migrations WHERE migration_id = ?",
                (migration_id,),
            ).fetchone()
            if already:
                print(f"  skip  {mf.name}  (already applied)")
                continue

            print(f"  apply {mf.name} …")
            # executescript() issues an implicit COMMIT first, then runs the script
            conn.executescript(mf.read_text())
            conn.execute(
                "INSERT INTO schema_migrations (migration_id) VALUES (?)",
                (migration_id,),
            )
            conn.commit()
            print(f"  ✓     {mf.name}")
            applied_any = True

        repaired = _ensure_event_tag_catalog_columns(conn)
        repaired_event_theme = _ensure_event_name_theme_column(conn)
        if repaired or repaired_event_theme:
            conn.commit()
            if repaired:
                print("  fix   event_tag_catalog missing columns backfilled")
            if repaired_event_theme:
                print("  fix   event_name theme color column backfilled")

        if applied_any or repaired or repaired_event_theme:
            print(f"\n✓  Migration complete.  DB: {DB_PATH}")
        else:
            print(f"\n✓  All migrations already applied.  DB: {DB_PATH}")

    except Exception as exc:
        conn.rollback()
        print(f"\n✗  Migration failed: {exc}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
