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

        if applied_any:
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
