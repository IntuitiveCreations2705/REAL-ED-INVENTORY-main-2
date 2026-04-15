"""
box_id_manual_registry.py

Manual workflow utility for box ID assignment.

Usage:
  python inventory_app/ui/box_id_manual_registry.py export
  python inventory_app/ui/box_id_manual_registry.py import --input inventory_app/exports/box_id_manual_template.csv --changed-by admin

Notes:
- Run migrations first so table box_id_list exists.
- This utility does NOT change existing Admin Master UI behavior.
"""
from __future__ import annotations

import argparse
import csv
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "sql_inventory_master.db"
DEFAULT_EXPORT = ROOT / "inventory_app" / "exports" / "box_id_manual_template.csv"
BOX_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")


def canonical_box_key(value: str) -> str:
    return re.sub(r"[^A-Z0-9]", "", str(value or "").strip().upper())


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def ensure_registry_exists(conn: sqlite3.Connection) -> None:
    exists = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='box_id_list'"
    ).fetchone()
    if exists is None:
        raise RuntimeError(
            "Table box_id_list does not exist. Run migrate.py first."
        )


def export_template(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with get_conn() as conn:
        ensure_registry_exists(conn)
        rows = conn.execute(
            """
            SELECT
              box_key,
              box_number,
              COALESCE(box_id, '')    AS box_id,
              COALESCE(box_label, '') AS box_label,
              COALESCE(box_type, '')  AS box_type,
              status
            FROM box_id_list
            ORDER BY box_number ASC
            """
        ).fetchall()

    with output_path.open("w", newline="", encoding="utf-8") as fh:
        writer = csv.DictWriter(
            fh,
            fieldnames=[
                "box_key",
                "box_number",
                "box_id",
                "box_label",
                "box_type",
                "status",
            ],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(dict(row))

    print(f"✓ Exported {len(rows)} rows to {output_path}")
    print("  Fill box_id/box_label/box_type manually, then run import.")


def import_template(input_path: Path, changed_by: str) -> None:
    if not input_path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    with input_path.open("r", newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        required = {"box_key", "box_number", "box_id", "box_label", "box_type", "status"}
        missing = required - set(reader.fieldnames or [])
        if missing:
            raise ValueError(f"Missing required columns: {sorted(missing)}")

        rows = [dict(r) for r in reader]

    seen_box_ids: set[str] = set()
    for idx, row in enumerate(rows, start=2):
        box_number = (row.get("box_number") or "").strip()
        if not box_number:
            raise ValueError(f"Row {idx}: box_number is required.")

        provided_key = (row.get("box_key") or "").strip()
        expected_key = canonical_box_key(box_number)
        if not expected_key:
            raise ValueError(f"Row {idx}: invalid box_number, canonical key empty.")

        if provided_key and provided_key != expected_key:
            raise ValueError(
                f"Row {idx}: box_key mismatch (got '{provided_key}', expected '{expected_key}')."
            )

        row["box_key"] = expected_key
        row["box_number"] = box_number

        status = (row.get("status") or "Active").strip() or "Active"
        if status not in {"Active", "Inactive"}:
            raise ValueError(f"Row {idx}: status must be Active or Inactive.")
        row["status"] = status

        box_id = (row.get("box_id") or "").strip()
        if box_id:
            if not BOX_ID_RE.fullmatch(box_id):
                raise ValueError(
                    f"Row {idx}: box_id '{box_id}' has invalid characters. Use letters/numbers/_/- only."
                )
            if box_id in seen_box_ids:
                raise ValueError(f"Row {idx}: duplicate box_id '{box_id}' in import file.")
            seen_box_ids.add(box_id)

        row["box_id"] = box_id or None
        row["box_label"] = (row.get("box_label") or "").strip() or None
        row["box_type"] = (row.get("box_type") or "").strip() or None

    updated_at = now_iso()

    with get_conn() as conn:
        ensure_registry_exists(conn)

        existing_keys = {
            r["box_key"]
            for r in conn.execute("SELECT box_key FROM box_id_list").fetchall()
        }

        for row in rows:
            if row["box_key"] not in existing_keys:
                conn.execute(
                    """
                    INSERT INTO box_id_list
                      (box_key, box_number, box_id, box_label, box_type, status, created_at, updated_at, updated_by, version)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                    """,
                    (
                        row["box_key"],
                        row["box_number"],
                        row["box_id"],
                        row["box_label"],
                        row["box_type"],
                        row["status"],
                        updated_at,
                        updated_at,
                        changed_by,
                    ),
                )
            else:
                conn.execute(
                    """
                    UPDATE box_id_list
                    SET box_number = ?,
                        box_id = ?,
                        box_label = ?,
                        box_type = ?,
                        status = ?,
                        updated_at = ?,
                        updated_by = ?,
                        version = version + 1
                    WHERE box_key = ?
                    """,
                    (
                        row["box_number"],
                        row["box_id"],
                        row["box_label"],
                        row["box_type"],
                        row["status"],
                        updated_at,
                        changed_by,
                        row["box_key"],
                    ),
                )

        conn.commit()

    print(f"✓ Imported {len(rows)} rows from {input_path}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Manual box ID registry workflow.")
    sub = parser.add_subparsers(dest="command", required=True)

    p_export = sub.add_parser("export", help="Export current box registry template to CSV.")
    p_export.add_argument(
        "--output",
        default=str(DEFAULT_EXPORT),
        help="Output CSV path (default: inventory_app/exports/box_id_manual_template.csv)",
    )

    p_import = sub.add_parser("import", help="Import manually edited box registry CSV.")
    p_import.add_argument(
        "--input",
        required=True,
        help="Input CSV path previously exported and manually edited.",
    )
    p_import.add_argument(
        "--changed-by",
        default="manual_box_registry",
        help="Audit hint for who performed this import.",
    )

    args = parser.parse_args()

    if args.command == "export":
        export_template(Path(args.output))
    elif args.command == "import":
        import_template(Path(args.input), changed_by=str(args.changed_by))


if __name__ == "__main__":
    main()
