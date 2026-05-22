#!/usr/bin/env python3
"""
seed_sandbox1_viewer.py — Populate Sandbox 1 with test user (viewer) and sample inventory.

Usage:
    python seed_sandbox1_viewer.py

This script:
1. Ensures the database schema is migrated (runs migrate.py if needed)
2. Creates a 'viewer' test user with role_id=5 (viewer role)
3. Seeds sample inventory items and boxes for testing
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

def seed_viewer_user() -> int:
    """Create a test 'viewer' user if it doesn't exist."""
    print("\n[*] Setting up test viewer user...")
    conn = get_conn()
    try:
        # Check if viewer user already exists
        existing = conn.execute(
            "SELECT user_id FROM users WHERE username = ?",
            ("viewer",),
        ).fetchone()
        
        if existing:
            print(f"[✓] Viewer user already exists (user_id={existing['user_id']})")
            return existing['user_id']
        
        # Insert viewer user (role_id=5 is 'viewer')
        now_iso = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO users (username, display_name, role_id, is_active, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("viewer", "Test Viewer", 5, 1, now_iso),
        )
        conn.commit()
        
        user_id_row = conn.execute(
            "SELECT user_id FROM users WHERE username = ?",
            ("viewer",),
        ).fetchone()
        user_id = int(user_id_row['user_id']) if user_id_row else 0
        
        print(f"[✓] Created viewer user (user_id={user_id}, display_name='Test Viewer')")
        return user_id
    finally:
        conn.close()

def seed_sample_inventory() -> None:
    """Seed sample inventory items for testing."""
    print("\n[*] Seeding sample inventory...")
    conn = get_conn()
    try:
        # Check how many items already exist
        count_row = conn.execute("SELECT COUNT(*) as cnt FROM master_inventory").fetchone()
        count = int(count_row['cnt']) if count_row else 0
        if count > 0:
            print(f"[✓] Inventory already seeded ({count} items exist)")
            return
        
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Sample items to seed
        sample_items: list[dict[str, Any]] = [
            {
                "item_id": "RCP001",
                "item_name": "Real Coach Program Workbook - Level 1",
                "box_number": "BX-RCP-001",
                "storage_location": "Shelf A-1",
                "event_tags": "RCP|WORKBOOK",
                "description": "Primary workbook for RCP Level 1",
                "qty_required": 20,
                "stock_on_hand": 18,
            },
            {
                "item_id": "RCP002",
                "item_name": "Real Coach Program Training Videos",
                "box_number": "BX-RCP-002",
                "storage_location": "Shelf A-2",
                "event_tags": "RCP|MEDIA",
                "description": "Video instruction set",
                "qty_required": 5,
                "stock_on_hand": 5,
            },
            {
                "item_id": "RLD001",
                "item_name": "Real Leadership Development Kit",
                "box_number": "BX-RLD-001",
                "storage_location": "Shelf B-1",
                "event_tags": "RLD|KIT",
                "description": "Leadership development materials",
                "qty_required": 10,
                "stock_on_hand": 10,
            },
            {
                "item_id": "RLD002",
                "item_name": "Real Leadership Facilitator Guide",
                "box_number": "BX-RLD-002",
                "storage_location": "Shelf B-2",
                "event_tags": "RLD|GUIDE",
                "description": "For workshop facilitators",
                "qty_required": 3,
                "stock_on_hand": 3,
            },
            {
                "item_id": "GEN001",
                "item_name": "Generic Training Supplies (Pens, Paper)",
                "box_number": "BX-GEN-001",
                "storage_location": "Shelf C-1",
                "event_tags": "GENERAL|SUPPLIES",
                "description": "Consumable training supplies",
                "qty_required": 100,
                "stock_on_hand": 45,
            },
        ]
        
        for item in sample_items:
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
        print(f"[✓] Seeded {len(sample_items)} sample inventory items")
    finally:
        conn.close()

def main():
    """Main setup routine."""
    print("=" * 70)
    print("SANDBOX 1: VIEWER USER + INVENTORY SETUP")
    print("=" * 70)
    print(f"Database: {DB_PATH}\n")
    
    try:
        # Step 1: Run migrations
        run_migrations()
        
        # Step 2: Seed viewer user
        seed_viewer_user()
        
        # Step 3: Seed sample inventory
        seed_sample_inventory()
        
        print("\n" + "=" * 70)
        print("[✓] SETUP COMPLETE")
        print("=" * 70)
        print("\nNext steps:")
        print("  1. Start the app: python run_admin.py")
        print("  2. Admin UI will open at http://127.0.0.1:5050")
        print("  3. You can now view and add inventory items")
        print("  4. Viewer user is ready for read-only access testing")
        print("\nViewers can:")
        print("  - View all inventory items")
        print("  - See stock counts and item details")
        print("  - CANNOT: edit, delete, or create items")
        return 0
    except Exception as e:
        print(f"\n[✗] ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())
