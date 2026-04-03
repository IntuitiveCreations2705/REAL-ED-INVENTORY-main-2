from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, render_template, request

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "sql_inventory_master.db"

EDITABLE_FIELDS = {
    "item_id",
    "item_name",
    "box_number",
    "storage_location",
    "event_tags",
    "description",
    "crew_notes",
    "qty_required",
    "stock_on_hand",
    "count_confirmed",
    "order_stock_qty",
    "restock_comments",
    "is_active",
}

def parse_pipe_tags(raw_tags: str | None) -> list[str]:
    if not raw_tags:
        return []

    tokens: list[str] = []
    for chunk in str(raw_tags).split("|"):
        tag = chunk.strip()
        if not tag:
            continue
        tokens.append(f"|{tag}|")

    # Preserve order, remove duplicates.
    return list(dict.fromkeys(tokens))


def create_app() -> Flask:
    app = Flask(__name__, static_folder="static", template_folder="templates")

    def get_conn() -> sqlite3.Connection:
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    @app.get("/")
    def index() -> str:
        return render_template("admin_master_view.html")

    @app.get("/item-list")
    def item_list_page() -> str:
        return render_template("admin_item_list_view.html")

    @app.get("/api/health")
    def health() -> Any:
        with get_conn() as conn:
            counts = conn.execute(
                """
                SELECT
                  (SELECT COUNT(*) FROM event_name) AS event_count,
                  (SELECT COUNT(*) FROM item_id_list) AS item_count,
                  (SELECT COUNT(*) FROM master_inventory) AS master_count
                """
            ).fetchone()
            fk_rows = conn.execute("PRAGMA foreign_key_check").fetchall()
        return jsonify(
            {
                "db_path": str(DB_PATH),
                "counts": dict(counts),
                "foreign_key_violations": len(fk_rows),
            }
        )

    @app.get("/api/suggest")
    def suggest() -> Any:
        term = request.args.get("q", "").strip()
        if not term:
            return jsonify([])

        with get_conn() as conn:
            rows = conn.execute(
                """
                SELECT item_id, item_name, status
                FROM item_id_list
                WHERE item_name LIKE '%' || ? || '%'
                ORDER BY item_name ASC
                LIMIT 20
                """,
                (term,),
            ).fetchall()
        return jsonify([dict(r) for r in rows])

    @app.get("/api/master")
    def list_master() -> Any:
        view = request.args.get("view", "all").strip().lower()
        box = request.args.get("box", "").strip().lower()
        event_name = request.args.get("event", "").strip()

        where = []
        params: list[Any] = []

        if view == "active":
            where.append("m.is_active = 1")
        elif view == "inactive":
            where.append("m.is_active = 0")

        if box:
            where.append("LOWER(COALESCE(m.box_number, '')) LIKE '%' || ? || '%'")
            params.append(box)

        if event_name and event_name.lower() != "all":
            with get_conn() as conn:
                event_row = conn.execute(
                    "SELECT tags FROM event_name WHERE event_name = ?",
                    (event_name,),
                ).fetchone()

            if event_row is None:
                return jsonify([])

            event_tags = parse_pipe_tags(event_row["tags"])
            if event_tags:
                tag_where = []
                for tag in event_tags:
                    tag_where.append("COALESCE(m.event_tags, '') LIKE ?")
                    params.append(f"%{tag}%")
                where.append(f"({' OR '.join(tag_where)})")

        where_clause = f"WHERE {' AND '.join(where)}" if where else ""

        sql = f"""
            SELECT
                m.row_id,
                m.item_id,
                m.item_name,
                m.box_number,
                m.storage_location,
                m.event_tags,
                m.description,
                m.crew_notes,
                m.qty_required,
                m.stock_on_hand,
                m.count_confirmed,
                m.order_stock_qty,
                m.restock_comments,
                m.is_active
            FROM master_inventory m
            {where_clause}
            ORDER BY m.row_id ASC
        """

        with get_conn() as conn:
            rows = conn.execute(sql, params).fetchall()

        return jsonify([dict(r) for r in rows])

    @app.get("/api/events")
    def list_events() -> Any:
        with get_conn() as conn:
            rows = conn.execute(
                """
                SELECT event_name, tags
                FROM event_name
                ORDER BY event_name ASC
                """
            ).fetchall()

        return jsonify([dict(r) for r in rows])

    @app.patch("/api/master/<int:row_id>")
    def update_master_row(row_id: int) -> Any:
        payload = request.get_json(silent=True) or {}
        updates = {k: v for k, v in payload.items() if k in EDITABLE_FIELDS}
        if not updates:
            return jsonify({"error": "No editable fields provided."}), 400

        if "item_name" in updates and "item_id" not in updates:
            return jsonify(
                {
                    "error": "item_name is governed by item_id. Save with item_id; item_name will auto-sync from item_id_list.",
                    "row_id": row_id,
                    "field": "item_name",
                }
            ), 409

        if "item_id" in updates:
            raw_item_id = updates.get("item_id")
            item_id = str(raw_item_id).strip() if raw_item_id is not None else ""
            if not item_id:
                updates["item_id"] = None
                updates["item_name"] = None
            else:
                updates["item_id"] = item_id

        assignments: list[str] = []
        values: list[Any] = []

        try:
            with get_conn() as conn:
                if "item_id" in updates and updates["item_id"] is not None:
                    ref = conn.execute(
                        "SELECT item_name FROM item_id_list WHERE item_id = ?",
                        (updates["item_id"],),
                    ).fetchone()
                    if ref is None:
                        return jsonify(
                            {
                                "error": "Discrepancy: item_id not found in item_id_list.",
                                "row_id": row_id,
                                "field": "item_id",
                            }
                        ), 409
                    updates["item_name"] = ref["item_name"]

                for field, value in updates.items():
                    assignments.append(f"{field} = ?")
                    if field in {"qty_required", "stock_on_hand", "order_stock_qty"} and value is not None:
                        values.append(float(value))
                    elif field == "is_active" and value is not None:
                        values.append(1 if int(value) else 0)
                    else:
                        values.append(value)

                values.append(row_id)

                cur = conn.execute(
                    f"UPDATE master_inventory SET {', '.join(assignments)} WHERE row_id = ?",
                    values,
                )
                if cur.rowcount == 0:
                    return jsonify({"error": "Row not found."}), 404
                updated = conn.execute(
                    "SELECT * FROM master_inventory WHERE row_id = ?", (row_id,)
                ).fetchone()
                fk_rows = conn.execute("PRAGMA foreign_key_check").fetchall()

                if fk_rows:
                    return jsonify(
                        {
                            "error": "Discrepancy detected by FK check. Save blocked until rectified.",
                            "row_id": row_id,
                        }
                    ), 409
        except sqlite3.IntegrityError as exc:
            return jsonify({"error": f"Integrity error: {exc}"}), 409

        return jsonify({"row": dict(updated), "foreign_key_violations": len(fk_rows)})

    @app.post("/api/master/<int:row_id>/toggle-active")
    def toggle_active(row_id: int) -> Any:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT is_active FROM master_inventory WHERE row_id = ?", (row_id,)
            ).fetchone()
            if row is None:
                return jsonify({"error": "Row not found."}), 404

            new_value = 0 if row["is_active"] == 1 else 1
            conn.execute(
                "UPDATE master_inventory SET is_active = ? WHERE row_id = ?",
                (new_value, row_id),
            )
            updated = conn.execute(
                "SELECT row_id, is_active FROM master_inventory WHERE row_id = ?", (row_id,)
            ).fetchone()

        return jsonify(dict(updated))

    @app.post("/api/master/<int:row_id>/link-item")
    def link_item(row_id: int) -> Any:
        payload = request.get_json(silent=True) or {}
        item_id = payload.get("item_id")
        item_name = payload.get("item_name")

        if not item_id or not item_name:
            return jsonify({"error": "item_id and item_name are required."}), 400

        with get_conn() as conn:
            exists = conn.execute(
                """
                SELECT 1
                FROM item_id_list
                WHERE item_id = ? AND item_name = ?
                """,
                (item_id, item_name),
            ).fetchone()
            if exists is None:
                return jsonify({"error": "Selected item pair does not exist in item_id_list."}), 409

            try:
                cur = conn.execute(
                    "UPDATE master_inventory SET item_id = ?, item_name = ? WHERE row_id = ?",
                    (item_id, item_name, row_id),
                )
            except sqlite3.IntegrityError as exc:
                return jsonify({"error": f"Integrity error: {exc}"}), 409

            if cur.rowcount == 0:
                return jsonify({"error": "Row not found."}), 404

            row = conn.execute(
                "SELECT row_id, item_id, item_name FROM master_inventory WHERE row_id = ?",
                (row_id,),
            ).fetchone()

        return jsonify(dict(row))

    @app.get("/api/item-list")
    def list_item_id_list() -> Any:
        status = request.args.get("status", "all").strip().lower()
        q = request.args.get("q", "").strip().lower()

        where = []
        params: list[Any] = []

        if status == "active":
            where.append("i.status = 'Active'")
        elif status == "inactive":
            where.append("i.status = 'Inactive'")

        if q:
            where.append("(LOWER(i.item_id) LIKE '%' || ? || '%' OR LOWER(i.item_name) LIKE '%' || ? || '%')")
            params.extend([q, q])

        where_clause = f"WHERE {' AND '.join(where)}" if where else ""

        sql = f"""
            SELECT
              i.item_id,
              i.status,
              i.item_name,
              (
                SELECT COUNT(*)
                FROM master_inventory m
                WHERE m.item_id = i.item_id
              ) AS used_count
            FROM item_id_list i
            {where_clause}
            ORDER BY i.item_id ASC
        """

        with get_conn() as conn:
            rows = conn.execute(sql, params).fetchall()

        return jsonify([dict(r) for r in rows])

    @app.post("/api/item-list/upsert")
    def upsert_item_id_list() -> Any:
        payload = request.get_json(silent=True) or {}
        original_item_id = (payload.get("original_item_id") or "").strip() or None
        item_id = (payload.get("item_id") or "").strip()
        item_name = (payload.get("item_name") or "").strip()
        status = (payload.get("status") or "").strip()

        if not item_id:
            return jsonify({"error": "item_id is required."}), 400
        if not item_name:
            return jsonify({"error": "item_name is required."}), 400
        if status not in {"Active", "Inactive"}:
            return jsonify({"error": "status must be Active or Inactive."}), 400

        try:
            with get_conn() as conn:
                if original_item_id:
                    existing = conn.execute(
                        """
                        SELECT
                          i.item_id,
                          i.item_name,
                          i.status,
                          (
                            SELECT COUNT(*)
                            FROM master_inventory m
                            WHERE m.item_id = i.item_id
                          ) AS used_count
                        FROM item_id_list i
                        WHERE i.item_id = ?
                        """,
                        (original_item_id,),
                    ).fetchone()
                    if existing is None:
                        return jsonify({"error": "Original item_id not found."}), 404

                    if item_id != existing["item_id"]:
                        return jsonify(
                            {"error": "item_id is immutable for existing rows. Create a new item_id instead."}
                        ), 409

                    old_item_id = existing["item_id"]
                    old_item_name = existing["item_name"]
                    used_count = int(existing["used_count"])
                    changing_key_pair = (item_id != old_item_id) or (item_name != old_item_name)

                    if used_count > 0 and changing_key_pair:
                        temp_item_id = f"{old_item_id}__TMP__"
                        n = 1
                        while (
                            conn.execute(
                                "SELECT 1 FROM item_id_list WHERE item_id = ?",
                                (temp_item_id,),
                            ).fetchone()
                            is not None
                        ):
                            n += 1
                            temp_item_id = f"{old_item_id}__TMP__{n}"

                        conn.execute(
                            """
                            INSERT INTO item_id_list (item_id, status, item_name)
                            VALUES (?, ?, ?)
                            """,
                            (temp_item_id, existing["status"], old_item_name),
                        )

                        conn.execute(
                            """
                            UPDATE master_inventory
                            SET item_id = ?, item_name = ?
                            WHERE item_id = ? AND item_name = ?
                            """,
                            (temp_item_id, old_item_name, old_item_id, old_item_name),
                        )

                        conn.execute(
                            """
                            UPDATE item_id_list
                            SET item_name = ?, status = ?
                            WHERE item_id = ?
                            """,
                            (item_name, status, old_item_id),
                        )

                        conn.execute(
                            """
                            UPDATE master_inventory
                            SET item_id = ?, item_name = ?
                            WHERE item_id = ? AND item_name = ?
                            """,
                            (old_item_id, item_name, temp_item_id, old_item_name),
                        )

                        conn.execute("DELETE FROM item_id_list WHERE item_id = ?", (temp_item_id,))
                        saved_item_id = old_item_id
                    else:
                        conn.execute(
                            """
                            UPDATE item_id_list
                            SET item_id = ?, status = ?, item_name = ?
                            WHERE item_id = ?
                            """,
                            (item_id, status, item_name, original_item_id),
                        )
                        saved_item_id = item_id
                else:
                    conn.execute(
                        """
                        INSERT INTO item_id_list (item_id, status, item_name)
                        VALUES (?, ?, ?)
                        """,
                        (item_id, status, item_name),
                    )
                    saved_item_id = item_id

                row = conn.execute(
                    """
                    SELECT
                      i.item_id,
                      i.status,
                      i.item_name,
                      (
                        SELECT COUNT(*)
                        FROM master_inventory m
                        WHERE m.item_id = i.item_id
                      ) AS used_count
                    FROM item_id_list i
                    WHERE i.item_id = ?
                    """,
                    (saved_item_id,),
                ).fetchone()
        except sqlite3.IntegrityError as exc:
            return jsonify({"error": f"Integrity error: {exc}"}), 409

        return jsonify({"row": dict(row)})

    return app


if __name__ == "__main__":
    create_app().run(debug=True, port=5050)
