#!/usr/bin/env python3
"""
seed_sandbox3_team.py — Populate Sandbox 3 with minimal users for standalone deployment rehearsal.

Usage:
    python seed_sandbox3_team.py

This script:
1. Ensures the database schema is migrated (runs migrate.py if needed)
2. Creates minimal test users (admin, leadership_test, operator_test)
3. Seeds minimal inventory for smoke tests (5-10 items)
4. Logs all actions to stdout
"""

import sys
from pathlib import Path
from datetime import datetime, timezone
from typing import Any

# Add parent directories to path for imports
ui_dir = Path(__file__).resolve().parent
sys.path.insert(0, str(ui_dir))
sys.path.insert(0, str(ui_dir.parent))

from db import get_conn, DB_PATH, check_schema


def run_migrations() -> None:
    """Ensure database schema is up to date."""
    print("[*] Checking schema migrations...")
    warnings = check_schema()
    if warnings:
        print("[!] Schema warnings detected:")
        for w in warnings:
            print(f"    {w}")
        print("[*] Running migrate.py...")
        import subprocess
        result = subprocess.run(
            [sys.executable, str(ui_dir / "migrate.py")],
            cwd=str(ui_dir.parent.parent),
        )
        if result.returncode != 0:
            raise RuntimeError("Migration failed")
    else:
        print("[✓] Schema is up to date")


def seed_minimal_users() -> None:
    """Create minimal test users for SB3 rehearsal."""
    print("\n[*] Setting up minimal test users for SB3 standalone rehearsal...")
    conn = get_conn()
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Minimal users (admin, leadership, operator; skip viewer for rehearsal)
        test_users: list[dict[str, Any]] = [
            {
                "username": "admin_sb3",
                "display_name": "Admin - SB3 Rehearsal",
                "role_id": 2,  # admin
                "description": "Admin for smoke tests",
            },
            {
                "username": "leadership_sb3",
                "display_name": "Leadership - SB3 Rehearsal",
                "role_id": 3,  # leadership
                "description": "Leadership role validation",
            },
            {
                "username": "operator_sb3",
                "display_name": "Operator - SB3 Rehearsal",
                "role_id": 4,  # operator
                "description": "Operator role validation",
            },
        ]
        
        for user in test_users:
            # Check if user already exists
            existing = conn.execute(
                "SELECT user_id FROM users WHERE username = ?",
                (user["username"],),
            ).fetchone()
            
            if existing:
                print(f"  [✓] {user['username']} already exists")
                continue
            
            # Insert test user
            conn.execute(
                """
                INSERT INTO users (username, display_name, role_id, is_active, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user["username"], user["display_name"], user["role_id"], 1, now_iso),
            )
            print(f"  [✓] Created {user['username']}")
        
        conn.commit()
    finally:
        conn.close()


def seed_minimal_inventory() -> None:
    """Seed minimal inventory for SB3 smoke tests."""
    print("\n[*] Seeding minimal inventory for smoke tests...")
    conn = get_conn()
    try:
        # Check how many items already exist
        count_row = conn.execute("SELECT COUNT(*) as cnt FROM master_inventory").fetchone()
        count = int(count_row['cnt']) if count_row else 0
        if count > 0:
            print(f"[✓] Inventory already seeded ({count} items exist)")
            return
        
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Minimal items for smoke tests
        minimal_items: list[dict[str, Any]] = [
            {
                "item_id": "SMOKE01",
                "item_name": "Smoke Test Item 1",
                "box_number": "BX-SMOKE-001",
                "storage_location": "Test Shelf",
                "event_tags": "SMOKE|TEST",
                "description": "Minimal inventory for SB3 smoke tests",
                "qty_required": 10,
                "stock_on_hand": 10,
            },
            {
                "item_id": "SMOKE02",
                "item_name": "Smoke Test Item 2",
                "box_number": "BX-SMOKE-002",
                "storage_location": "Test Shelf",
                "event_tags": "SMOKE|TEST",
                "description": "Validation item for aggregation logic",
                "qty_required": 5,
                "stock_on_hand": 3,
            },
        ]
        
        for item in minimal_items:
            conn.execute(
                """
                INSERT INTO master_inventory
                (item_id, item_name, box_number, storage_location, event_tags,
                 description, qty_required, stock_on_hand, is_active,
                 version, created_at, updated_at, updated_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["item_id"],
                    item["item_name"],
                    item["box_number"],
                    item["storage_location"],
                    item["event_tags"],
                    item["description"],
                    item["qty_required"],
                    item["stock_on_hand"],
                    1,  # is_active
                    1,  # version
                    now_iso,  # created_at
                    now_iso,  # updated_at
                    "system",  # updated_by
                ),
            )
        
        conn.commit()
        print(f"[✓] Seeded {len(minimal_items)} minimal inventory items for smoke tests")
    finally:
        conn.close()


def main():
    """Main setup routine."""
    print("=" * 70)
    print("SANDBOX 3: MINIMAL SETUP (Standalone Deployment Rehearsal)")
    print("=" * 70)
    print(f"Database: {DB_PATH}\n")
    
    try:
        # Step 1: Run migrations
        run_migrations()
        
        # Step 2: Seed minimal users
        seed_minimal_users()
        
        # Step 3: Seed minimal inventory
        seed_minimal_inventory()
        
        print("\n" + "=" * 70)
        print("[✓] SETUP COMPLETE")
        print("=" * 70)
        print("\nNext steps:")
        print("  1. SB3 is ready for nightly automation")
        print("  2. Manual test: ./start_sandbox3.sh IMPLEMENT")
        print("  3. Verify all UI routes load (/)(/item-id-list)(/event-stock-count)(/system-map)")
        print("  4. Verify health check passes (/api/health)")
        print("  5. Verify backup cycle works (trigger a mutation)")
        print("\nNightly rehearsal (4:00 AM) will:")
        print("  1. Destroy this DB")
        print("  2. Create fresh SB3 from SB1 baseline")
        print("  3. Run full smoke test suite")
        print("  4. Validate backup/restore cycle")
        print("  5. Log results to /var/log/sb3-rehearsal.log\n")
        return 0
    except Exception as e:
        print(f"\n[✗] ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

