#!/usr/bin/env python3
"""
seed_sandbox2_leadership.py — Populate Sandbox 2 with test users for role-level testing.

Usage:
    python seed_sandbox2_leadership.py

This script:
1. Ensures the database schema is migrated (runs migrate.py if needed)
2. Creates test users for each role tier (admin, leadership_test, operator_test, viewer_test)
3. Does NOT seed inventory items (inherits from SB1 clone)
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


def seed_test_users() -> None:
    """Create test users for role-level testing."""
    print("\n[*] Setting up test users for SB2 role-level testing...")
    conn = get_conn()
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Test users to create (role_id values from roles table)
        test_users = [
            {
                "username": "admin_test",
                "display_name": "Admin Test User",
                "role_id": 2,  # admin
                "description": "Full access for admin-level feature testing",
            },
            {
                "username": "leadership_test",
                "display_name": "Leadership Test User",
                "role_id": 3,  # leadership (Tier 2.2)
                "description": "Leadership-scoped BOX edits + satellite sync approval",
            },
            {
                "username": "operator_test",
                "display_name": "Operator Test User",
                "role_id": 4,  # operator
                "description": "Event-scoped stock management + team edits",
            },
            {
                "username": "viewer_test",
                "display_name": "Viewer Test User",
                "role_id": 5,  # viewer
                "description": "Read-only access for inventory inspection",
            },
        ]
        
        for user in test_users:
            # Check if user already exists
            existing = conn.execute(
                "SELECT user_id FROM users WHERE username = ?",
                (user["username"],),
            ).fetchone()
            
            if existing:
                print(f"  [✓] {user['username']} already exists (role: {user['role_id']})")
                continue
            
            # Insert test user
            conn.execute(
                """
                INSERT INTO users (username, display_name, role_id, is_active, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (user["username"], user["display_name"], user["role_id"], 1, now_iso),
            )
            print(f"  [✓] Created {user['username']} (role: {user['role_id']}, {user['display_name']})")
        
        conn.commit()
        print(f"\n[✓] Test user setup complete")
        
    finally:
        conn.close()


def verify_inventory_inherited() -> None:
    """Verify SB2 inherited inventory from SB1 baseline."""
    print("\n[*] Verifying SB2 inherited inventory from SB1...")
    conn = get_conn()
    try:
        # Count items
        count_row = conn.execute("SELECT COUNT(*) as cnt FROM master_inventory").fetchone()
        count = int(count_row['cnt']) if count_row else 0
        
        if count > 0:
            print(f"[✓] Inventory inherited from SB1 ({count} items present)")
            
            # Show sample items
            samples = conn.execute(
                "SELECT item_id, item_name, stock_on_hand FROM master_inventory LIMIT 3"
            ).fetchall()
            for sample in samples:
                print(f"    - {sample['item_id']}: {sample['item_name']} (qty: {sample['stock_on_hand']})")
        else:
            print("[!] WARNING: No inventory found in SB2")
            print("    SB2 may have been initialized from empty DB")
            print("    Use: cp sql_inventory_master.db sql_inventory_sb2.db")
    finally:
        conn.close()


def main():
    """Main setup routine."""
    print("=" * 70)
    print("SANDBOX 2: TEST USER SETUP (Role-Level Testing)")
    print("=" * 70)
    print(f"Database: {DB_PATH}\n")
    
    try:
        # Step 1: Run migrations
        run_migrations()
        
        # Step 2: Seed test users
        seed_test_users()
        
        # Step 3: Verify inherited inventory
        verify_inventory_inherited()
        
        print("\n" + "=" * 70)
        print("[✓] SETUP COMPLETE")
        print("=" * 70)
        print("\nNext steps:")
        print("  1. Start SB2: ./start_sandbox2.sh IMPLEMENT")
        print("  2. Test as each user:")
        print("     - admin_test: Full CRUD access to Admin Master")
        print("     - leadership_test: Future Tier 2.2 features (TBD)")
        print("     - operator_test: Event-scoped stock management")
        print("     - viewer_test: Read-only inventory inspection")
        print("  3. Verify cross-UI navigation works")
        print("  4. Check audit log for all mutations")
        print("\nTest matrix:")
        print("  - Load all UIs (Admin Master, Item List, Stock Count, System Map)")
        print("  - Test CRUD operations per role")
        print("  - Verify read-only enforcement for viewer_test")
        print("  - Check cross-UI data consistency")
        print("\nWhen tests pass:")
        print("  1. Document results in SB2 test log")
        print("  2. Promote to SB1: cp sql_inventory_sb2.db sql_inventory_master.db")
        print("  3. Commit and tag: git commit -m 'promoted: SB2→SB1' && git tag stable-...\n")
        return 0
    except Exception as e:
        print(f"\n[✗] ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    sys.exit(main())

