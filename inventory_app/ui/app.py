from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any

from flask import Flask, jsonify, render_template, request, send_file

from audit import write_audit
from db import DB_PATH, get_conn
from rules import (
    as_number as _as_number,
    computed_order_stock_qty as _computed_order_stock_qty,
    normalize_box_label,
    normalize_location_label,
    normalize_pipe_tags,
    parse_pipe_tags,
    validate_event_tags_against_catalog,
)
from system_map_assets import SOURCE_FILE, ensure_system_map_assets

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
    "qty_flag_limit",
    "count_confirmed",
    "order_stock_qty",
    "restock_comments",
    "is_active",
}


def api_error(
    message: str,
    status: int = 400,
    *,
    code: str | None = None,
    **extras: Any,
) -> tuple[Any, int]:
    """Return a consistent JSON error envelope."""
    body: dict[str, Any] = {"error": message}
    if code:
        body["code"] = code
    body.update(extras)
    return jsonify(body), status


def _changed_by() -> str:
    """Returns active username once Phase 2 auth is wired; falls back to remote IP."""
    # TODO Phase 2: return session.get("username", request.remote_addr or "system")
    return request.remote_addr or "system"


def _contains_legacy_notinuse(raw_tags: Any) -> bool:
    return "NOTINUSE" in str(raw_tags or "").upper()


def _ensure_qty_flag_limit_column(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(master_inventory)").fetchall()}
    if "qty_flag_limit" not in cols:
        conn.execute("ALTER TABLE master_inventory ADD COLUMN qty_flag_limit REAL")


def create_app() -> Flask:
    app = Flask(__name__, static_folder="static", template_folder="templates")

    # Legacy remediation: NOTINUSE is deprecated.
    # Convert |NOTINUSE| → |NEEDED| and set affected rows to Inactive.
    with get_conn() as cleanup_conn:
        _ensure_qty_flag_limit_column(cleanup_conn)
        legacy_rows = cleanup_conn.execute(
            """
            SELECT row_id, event_tags
            FROM master_inventory
            WHERE UPPER(COALESCE(event_tags, '')) LIKE '%NOTINUSE%'
            """
        ).fetchall()
        for legacy_row in legacy_rows:
            cleanup_conn.execute(
                """
                UPDATE master_inventory
                   SET event_tags = ?,
                       is_active = 0,
                       updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                       updated_by = 'system',
                       version = COALESCE(version, 0) + 1
                 WHERE row_id = ?
                """,
                (normalize_pipe_tags(legacy_row["event_tags"]), legacy_row["row_id"]),
            )

    # Ensure generated visual map assets exist for UX/backend introspection.
    system_map_boot_error: str | None = None
    try:
        ensure_system_map_assets()
    except Exception as exc:  # pragma: no cover - startup should not crash UI
        system_map_boot_error = str(exc)

    @app.get("/")
    def index() -> str:
        return render_template("admin_master_view.html")

    @app.get("/item-list")
    def item_list_page() -> str:
        return render_template("admin_item_list_view.html")

    @app.get("/system-map")
    def system_map_page() -> str:
        return render_template("system_map_view.html")

    @app.get("/api/health")
    def health() -> Any:
        with get_conn() as conn:
            counts = conn.execute(
                """
                SELECT
                  (SELECT COUNT(*) FROM event_name)       AS event_count,
                  (SELECT COUNT(*) FROM item_id_list)     AS item_count,
                  (SELECT COUNT(*) FROM master_inventory) AS master_count,
                  (SELECT COUNT(*) FROM audit_log)        AS audit_count,
                  (SELECT COUNT(*) FROM users)            AS user_count
                """
            ).fetchone()
            fk_rows = conn.execute("PRAGMA foreign_key_check").fetchall()

            # Enrich violation rows with item_id / item_name where possible
            violation_details: list[dict] = []
            for r in fk_rows[:30]:
                detail: dict[str, Any] = {
                    "table": r["table"],
                    "rowid": r["rowid"],
                    "parent": r["parent"],
                }
                if r["table"] == "master_inventory":
                    extra = conn.execute(
                        "SELECT item_id, item_name FROM master_inventory WHERE row_id = ?",
                        (r["rowid"],),
                    ).fetchone()
                    if extra:
                        detail["item_id"] = extra["item_id"]
                        detail["item_name"] = extra["item_name"]
                violation_details.append(detail)

        return jsonify(
            {
                "db_path": str(DB_PATH),
                "counts": dict(counts),
                "foreign_key_violations": len(fk_rows),
                "fk_violation_rows": violation_details,
            }
        )

    @app.get("/api/system-map")
    def system_map_info() -> Any:
        nonlocal system_map_boot_error
        try:
            manifest = ensure_system_map_assets()
            return jsonify(
                {
                    "status": "ok",
                    **manifest,
                    "live_url": "/system-map/live",
                    "image_url": "/static/system_map_latest.png",
                    "source_url": "/system-map/source",
                }
            )
        except Exception as exc:
            if system_map_boot_error is None:
                system_map_boot_error = str(exc)
            return jsonify(
                {
                    "status": "degraded",
                    "error": system_map_boot_error,
                    "live_url": "/system-map/live",
                    "image_url": "/static/system_map_latest.png",
                    "source_url": "/system-map/source",
                }
            )

    @app.get("/system-map/live")
    def system_map_live() -> Any:
        return send_file(SOURCE_FILE.with_suffix(".html"), mimetype="text/html")

    @app.get("/system-map/source")
    def system_map_source() -> Any:
        return send_file(SOURCE_FILE, mimetype="text/markdown")

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
                m.qty_flag_limit,
                m.count_confirmed,
                m.order_stock_qty,
                m.restock_comments,
                m.is_active,
                m.version,
                m.updated_at,
                m.updated_by
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

    @app.post("/api/master")
    def insert_master_row() -> Any:
        payload = request.get_json(silent=True) or {}
        fields = {k: v for k, v in payload.items() if k in EDITABLE_FIELDS}
        manual_order_override = bool(payload.get("order_stock_qty_manual_override"))

        raw_event_tags = fields.pop("event_tags", "")
        legacy_notinuse = _contains_legacy_notinuse(raw_event_tags)
        event_tags    = normalize_pipe_tags(raw_event_tags)
        description   = str(fields.pop("description",  "") or "")
        qty_required  = float(fields.pop("qty_required", 0) or 0)
        stock_on_hand = float(fields.pop("stock_on_hand", 0) or 0)
        qty_flag_limit_raw = fields.pop("qty_flag_limit", None)
        qty_flag_limit = (
            float(qty_flag_limit_raw)
            if qty_flag_limit_raw not in (None, "")
            else None
        )
        order_stock_qty = fields.pop("order_stock_qty", None)
        is_active     = int(fields.pop("is_active", 1))
        if legacy_notinuse:
            is_active = 0
        item_id       = (fields.pop("item_id", None) or "").strip() or None
        item_name: str | None = None
        final_order_stock_qty = (
            _as_number(order_stock_qty)
            if manual_order_override and order_stock_qty not in (None, "")
            else _computed_order_stock_qty(qty_required, stock_on_hand)
        )

        # ── Validate event_tags against Active catalog ──────────────────────
        with get_conn() as tag_conn:
            is_valid, error_msg = validate_event_tags_against_catalog(event_tags, tag_conn)
            if not is_valid:
                return api_error(error_msg or "Invalid tags.", 422, code="tag_validation_error")

        changed_by = _changed_by()
        session_id = str(uuid.uuid4())

        try:
            with get_conn() as conn:
                if item_id:
                    ref = conn.execute(
                        "SELECT item_name FROM item_id_list WHERE item_id = ?",
                        (item_id,),
                    ).fetchone()
                    if ref is None:
                        return api_error(
                            "item_id not found in item_id_list.",
                            409,
                            code="item_id_missing",
                        )
                    item_name = ref["item_name"]

                cur = conn.execute(
                    """
                    INSERT INTO master_inventory
                        (item_id, item_name, box_number, storage_location,
                         event_tags, description, crew_notes,
                         qty_required, stock_on_hand, qty_flag_limit, order_stock_qty,
                         restock_comments, is_active,
                         updated_at, updated_by, version)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,
                            strftime('%Y-%m-%dT%H:%M:%SZ','now'),?,1)
                    """,
                    (
                        item_id,
                        item_name,
                        normalize_box_label(fields.get("box_number")),
                        normalize_location_label(fields.get("storage_location")),
                        event_tags,
                        description,
                        fields.get("crew_notes"),
                        qty_required,
                        stock_on_hand,
                        qty_flag_limit,
                        final_order_stock_qty,
                        fields.get("restock_comments"),
                        is_active,
                        changed_by,
                    ),
                )
                new_id = cur.lastrowid
                inserted = conn.execute(
                    "SELECT * FROM master_inventory WHERE row_id = ?", (new_id,)
                ).fetchone()
                write_audit(
                    conn,
                    table_name="master_inventory",
                    row_ref=f"row_id={new_id}",
                    action="INSERT",
                    old_value=None,
                    new_value="new row",
                    changed_by=changed_by,
                    session_id=session_id,
                    device_hint=request.remote_addr,
                )
        except sqlite3.IntegrityError as exc:
            return api_error(f"Integrity error: {exc}", 409, code="integrity_error")

        return jsonify({"row": dict(inserted)}), 201

    @app.patch("/api/master/<int:row_id>")
    def update_master_row(row_id: int) -> Any:
        payload = request.get_json(silent=True) or {}
        client_version = payload.pop("version", None)
        manual_order_override = bool(payload.get("order_stock_qty_manual_override"))
        updates = {k: v for k, v in payload.items() if k in EDITABLE_FIELDS}
        if not updates:
            return api_error("No editable fields provided.")

        if "item_name" in updates and "item_id" not in updates:
            return api_error(
                "item_name is governed by item_id. Save with item_id; item_name will auto-sync from item_id_list.",
                409,
                code="governed_field",
                row_id=row_id,
                field="item_name",
            )

        if "item_id" in updates:
            raw_item_id = updates.get("item_id")
            item_id = str(raw_item_id).strip() if raw_item_id is not None else ""
            updates["item_id"] = item_id if item_id else None
            if not item_id:
                updates["item_name"] = None

        if "event_tags" in updates:
            raw_event_tags = updates.get("event_tags")
            if _contains_legacy_notinuse(raw_event_tags):
                updates["is_active"] = 0
            updates["event_tags"] = normalize_pipe_tags(raw_event_tags)

        if "box_number" in updates:
            updates["box_number"] = normalize_box_label(updates.get("box_number"))

        if "storage_location" in updates:
            updates["storage_location"] = normalize_location_label(updates.get("storage_location"))

        if "qty_flag_limit" in updates:
            raw_limit = updates.get("qty_flag_limit")
            updates["qty_flag_limit"] = (
                float(raw_limit)
                if raw_limit not in (None, "")
                else None
            )

        # ── Validate event_tags against Active catalog ──────────────────────
        if "event_tags" in updates:
            normalized_tags = updates["event_tags"]
            with get_conn() as tag_conn:
                is_valid, error_msg = validate_event_tags_against_catalog(
                    normalized_tags, tag_conn
                )
                if not is_valid:
                    return api_error(error_msg or "Invalid tags.", 422, code="tag_validation_error", row_id=row_id)

        changed_by = _changed_by()
        session_id = str(uuid.uuid4())
        assignments: list[str] = []
        values: list[Any] = []
        updated: Any = None
        fk_rows: list[Any] = []

        try:
            with get_conn() as conn:
                # ── Optimistic concurrency ──────────────────────────────────
                if client_version is not None:
                    current = conn.execute(
                        "SELECT version FROM master_inventory WHERE row_id = ?",
                        (row_id,),
                    ).fetchone()
                    if current is None:
                        return api_error("Row not found.", 404)
                    if int(current["version"]) != int(client_version):
                        return api_error(
                            "Stale data: this row was modified by another user. Refresh and retry.",
                            409,
                            code="stale_version",
                            row_id=row_id,
                        )

                # ── Capture old values for audit ────────────────────────────
                old_row = conn.execute(
                    "SELECT * FROM master_inventory WHERE row_id = ?", (row_id,)
                ).fetchone()
                if old_row is None:
                    return api_error("Row not found.", 404)

                # ── Resolve item_id → item_name sync ───────────────────────
                if "item_id" in updates and updates["item_id"] is not None:
                    ref = conn.execute(
                        "SELECT item_name FROM item_id_list WHERE item_id = ?",
                        (updates["item_id"],),
                    ).fetchone()
                    if ref is None:
                        return api_error(
                            "Discrepancy: item_id not found in item_id_list.",
                            409,
                            code="item_id_missing",
                            row_id=row_id,
                            field="item_id",
                        )
                    updates["item_name"] = ref["item_name"]

                next_qty_required = updates.get("qty_required", old_row["qty_required"])
                next_stock_on_hand = updates.get("stock_on_hand", old_row["stock_on_hand"])
                incoming_order_stock_qty = updates.get("order_stock_qty", old_row["order_stock_qty"])
                updates["order_stock_qty"] = (
                    _as_number(incoming_order_stock_qty)
                    if manual_order_override and incoming_order_stock_qty not in (None, "")
                    else _computed_order_stock_qty(next_qty_required, next_stock_on_hand)
                )

                # ── Build SET clause ────────────────────────────────────────
                for field, value in updates.items():
                    assignments.append(f"{field} = ?")
                    if field in {"qty_required", "stock_on_hand", "order_stock_qty", "qty_flag_limit"} and value is not None:
                        values.append(float(value))
                    elif field == "is_active" and value is not None:
                        values.append(1 if int(value) else 0)
                    else:
                        values.append(value)

                # Lifecycle fields stamped on every save
                assignments += [
                    "updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')",
                    "updated_by = ?",
                    "version = version + 1",
                ]
                values += [changed_by, row_id]

                cur = conn.execute(
                    f"UPDATE master_inventory SET {', '.join(assignments)} WHERE row_id = ?",
                    values,
                )
                if cur.rowcount == 0:
                    return api_error("Row not found.", 404)
                updated = conn.execute(
                    "SELECT * FROM master_inventory WHERE row_id = ?", (row_id,)
                ).fetchone()
                fk_rows = conn.execute("PRAGMA foreign_key_check").fetchall()
                if fk_rows:
                    return api_error(
                        "Discrepancy detected by FK check. Save blocked until rectified.",
                        409,
                        code="fk_violation",
                        row_id=row_id,
                    )

                # ── Audit (within same transaction) ─────────────────────────
                for field, new_val in updates.items():
                    old_val = old_row[field] if field in old_row.keys() else None
                    write_audit(
                        conn,
                        table_name="master_inventory",
                        row_ref=f"row_id={row_id}",
                        action="UPDATE",
                        field_name=field,
                        old_value=old_val,
                        new_value=new_val,
                        changed_by=changed_by,
                        session_id=session_id,
                        device_hint=request.remote_addr,
                    )

        except sqlite3.IntegrityError as exc:
            return api_error(f"Integrity error: {exc}", 409, code="integrity_error")

        return jsonify({"row": dict(updated), "foreign_key_violations": len(fk_rows)})

    @app.post("/api/master/<int:row_id>/toggle-active")
    def toggle_active(row_id: int) -> Any:
        changed_by = _changed_by()
        with get_conn() as conn:
            row = conn.execute(
                "SELECT is_active FROM master_inventory WHERE row_id = ?", (row_id,)
            ).fetchone()
            if row is None:
                return api_error("Row not found.", 404)

            old_value = row["is_active"]
            new_value = 0 if old_value == 1 else 1
            conn.execute(
                """
                UPDATE master_inventory
                SET is_active = ?,
                    updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                    updated_by = ?,
                    version    = version + 1
                WHERE row_id = ?
                """,
                (new_value, changed_by, row_id),
            )
            updated = conn.execute(
                "SELECT row_id, is_active, version, updated_at, updated_by"
                " FROM master_inventory WHERE row_id = ?",
                (row_id,),
            ).fetchone()
            write_audit(
                conn,
                table_name="master_inventory",
                row_ref=f"row_id={row_id}",
                action="TOGGLE",
                field_name="is_active",
                old_value=old_value,
                new_value=new_value,
                changed_by=changed_by,
                device_hint=request.remote_addr,
            )

        return jsonify(dict(updated))

    @app.post("/api/master/<int:row_id>/link-item")
    def link_item(row_id: int) -> Any:
        payload = request.get_json(silent=True) or {}
        item_id = payload.get("item_id")
        item_name = payload.get("item_name")

        if not item_id or not item_name:
            return api_error("item_id and item_name are required.")

        changed_by = _changed_by()
        with get_conn() as conn:
            exists = conn.execute(
                "SELECT 1 FROM item_id_list WHERE item_id = ? AND item_name = ?",
                (item_id, item_name),
            ).fetchone()
            if exists is None:
                return api_error(
                    "Selected item pair does not exist in item_id_list.",
                    409,
                    code="item_pair_missing",
                )

            old_row = conn.execute(
                "SELECT item_id FROM master_inventory WHERE row_id = ?", (row_id,)
            ).fetchone()

            try:
                cur = conn.execute(
                    """
                    UPDATE master_inventory
                    SET item_id = ?, item_name = ?,
                        updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                        updated_by = ?,
                        version    = version + 1
                    WHERE row_id = ?
                    """,
                    (item_id, item_name, changed_by, row_id),
                )
            except sqlite3.IntegrityError as exc:
                return api_error(f"Integrity error: {exc}", 409, code="integrity_error")

            if cur.rowcount == 0:
                return api_error("Row not found.", 404)

            row = conn.execute(
                "SELECT row_id, item_id, item_name, version FROM master_inventory WHERE row_id = ?",
                (row_id,),
            ).fetchone()
            write_audit(
                conn,
                table_name="master_inventory",
                row_ref=f"row_id={row_id}",
                action="LINK",
                field_name="item_id",
                old_value=old_row["item_id"] if old_row else None,
                new_value=item_id,
                changed_by=changed_by,
                device_hint=request.remote_addr,
            )

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
              i.version,
              i.updated_at,
              i.updated_by,
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
        client_version = payload.get("version", None)

        if not item_id:
            return api_error("item_id is required.")
        if not item_name:
            return api_error("item_name is required.")
        if status not in {"Active", "Inactive"}:
            return api_error("status must be Active or Inactive.")

        changed_by = _changed_by()
        try:
            with get_conn() as conn:
                if original_item_id:
                    existing = conn.execute(
                        """
                        SELECT
                          i.item_id,
                          i.item_name,
                          i.status,
                          i.version,
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
                        return api_error("Original item_id not found.", 404)

                    if item_id != existing["item_id"]:
                        return api_error(
                            "item_id is immutable for existing rows. Create a new item_id instead.",
                            409,
                            code="immutable_item_id",
                        )

                    if client_version is not None and int(existing["version"]) != int(client_version):
                        return api_error(
                            "Stale data: this item was modified by another user. Refresh and retry.",
                            409,
                            code="stale_version",
                        )

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
                            "INSERT INTO item_id_list (item_id, status, item_name) VALUES (?, ?, ?)",
                            (temp_item_id, existing["status"], old_item_name),
                        )
                        conn.execute(
                            "UPDATE master_inventory SET item_id = ?, item_name = ?"
                            " WHERE item_id = ? AND item_name = ?",
                            (temp_item_id, old_item_name, old_item_id, old_item_name),
                        )
                        conn.execute(
                            """
                            UPDATE item_id_list
                            SET item_name = ?, status = ?,
                                updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                                updated_by = ?, version = version + 1
                            WHERE item_id = ?
                            """,
                            (item_name, status, changed_by, old_item_id),
                        )
                        conn.execute(
                            "UPDATE master_inventory SET item_id = ?, item_name = ?"
                            " WHERE item_id = ? AND item_name = ?",
                            (old_item_id, item_name, temp_item_id, old_item_name),
                        )
                        conn.execute("DELETE FROM item_id_list WHERE item_id = ?", (temp_item_id,))
                        saved_item_id = old_item_id
                    else:
                        conn.execute(
                            """
                            UPDATE item_id_list
                            SET item_id = ?, status = ?, item_name = ?,
                                updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now'),
                                updated_by = ?, version = version + 1
                            WHERE item_id = ?
                            """,
                            (item_id, status, item_name, changed_by, original_item_id),
                        )
                        saved_item_id = item_id

                    write_audit(
                        conn,
                        table_name="item_id_list",
                        row_ref=f"item_id={saved_item_id}",
                        action="UPDATE",
                        field_name="item_name",
                        old_value=old_item_name,
                        new_value=item_name,
                        changed_by=changed_by,
                        device_hint=request.remote_addr,
                    )
                else:
                    conn.execute(
                        "INSERT INTO item_id_list (item_id, status, item_name) VALUES (?, ?, ?)",
                        (item_id, status, item_name),
                    )
                    saved_item_id = item_id
                    write_audit(
                        conn,
                        table_name="item_id_list",
                        row_ref=f"item_id={item_id}",
                        action="INSERT",
                        old_value=None,
                        new_value=f"{item_id} | {item_name} | {status}",
                        changed_by=changed_by,
                        device_hint=request.remote_addr,
                    )

                row = conn.execute(
                    """
                    SELECT
                      i.item_id,
                      i.status,
                      i.item_name,
                      i.version,
                      i.updated_at,
                      i.updated_by,
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
            return api_error(f"Integrity error: {exc}", 409, code="integrity_error")

        return jsonify({"row": dict(row)})

    # ────────────────────────────────────────────────────────────────────────
    # Event Tag Catalog API (governance, lifecycle, role-based access)
    # ────────────────────────────────────────────────────────────────────────

    @app.get("/api/event-tags")
    def list_event_tags() -> Any:
        """Fetch all tags in catalog, ordered by sort_order."""
        with get_conn() as conn:
            rows = conn.execute(
                """
                SELECT tag_name, status, description, sort_order, owner, version,
                       created_at, created_by, updated_at, updated_by
                FROM event_tag_catalog
                ORDER BY sort_order ASC, tag_name ASC
                """
            ).fetchall()
        return jsonify([dict(r) for r in rows])

    @app.post("/api/event-tags")
    def create_event_tag() -> Any:
        """Create new tag in catalog. Senior admin only."""
        payload = request.get_json(silent=True) or {}
        tag_name = str(payload.get("tag_name", "")).strip()
        description = str(payload.get("description", "")).strip() or None
        sort_order = payload.get("sort_order")

        if not tag_name:
            return api_error("tag_name is required.", 400)

        tag_name = tag_name.upper()
        changed_by = _changed_by()
        now = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')

        try:
            with get_conn() as conn:
                # Check if tag already exists.
                existing = conn.execute(
                    "SELECT tag_name FROM event_tag_catalog WHERE tag_name = ?",
                    (tag_name,),
                ).fetchone()
                if existing:
                    return api_error(f"Tag '{tag_name}' already exists.", 409, code="tag_exists")

                conn.execute(
                    """
                    INSERT INTO event_tag_catalog
                      (tag_name, status, description, sort_order, owner,
                       created_at, created_by, updated_at, updated_by, version)
                    VALUES (?, 'Active', ?, ?, ?, ?, ?, ?, ?, 1)
                    """,
                    (tag_name, description, sort_order, changed_by, now, changed_by, now, changed_by),
                )
                write_audit(
                    conn,
                    table_name="event_tag_catalog",
                    row_ref=f"tag_name={tag_name}",
                    action="INSERT",
                    old_value=None,
                    new_value=f"{tag_name} | {description}",
                    changed_by=changed_by,
                    device_hint=request.remote_addr,
                )

                row = conn.execute(
                    "SELECT * FROM event_tag_catalog WHERE tag_name = ?", (tag_name,)
                ).fetchone()
        except sqlite3.IntegrityError as exc:
            return api_error(f"Integrity error: {exc}", 409, code="integrity_error")

        return jsonify({"row": dict(row)}), 201

    @app.patch("/api/event-tags/<tag_name>")
    def update_event_tag(tag_name: str) -> Any:
        """Update tag status or description. Senior admin only."""
        tag_name = tag_name.strip().upper()
        payload = request.get_json(silent=True) or {}
        updates: dict[str, Any] = {}

        if "status" in payload:
            status = str(payload["status"]).strip()
            if status not in ("Active", "Inactive"):
                return api_error("status must be 'Active' or 'Inactive'.", 400)
            updates["status"] = status

        if "description" in payload:
            updates["description"] = str(payload.get("description", "")).strip() or None

        if "sort_order" in payload:
            updates["sort_order"] = payload.get("sort_order")

        if not updates:
            return api_error("No updatable fields provided.", 400)

        changed_by = _changed_by()
        now = datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z')

        try:
            with get_conn() as conn:
                # Fetch old row for audit.
                old_row = conn.execute(
                    "SELECT * FROM event_tag_catalog WHERE tag_name = ?", (tag_name,)
                ).fetchone()
                if old_row is None:
                    return api_error(f"Tag '{tag_name}' not found.", 404)

                # Build SET clause.
                assignments = [f"updated_at = '{now}'",
                               "updated_by = ?",
                               "version = version + 1"]
                values = [changed_by]

                for field, value in updates.items():
                    assignments.append(f"{field} = ?")
                    values.append(value)

                values.append(tag_name)

                conn.execute(
                    f"""
                    UPDATE event_tag_catalog
                    SET {', '.join(assignments)}
                    WHERE tag_name = ?
                    """,
                    values,
                )

                # Audit each changed field.
                for field, new_value in updates.items():
                    old_value = old_row[field]
                    if old_value != new_value:
                        write_audit(
                            conn,
                            table_name="event_tag_catalog",
                            row_ref=f"tag_name={tag_name}",
                            action="UPDATE",
                            field_name=field,
                            old_value=str(old_value) if old_value is not None else None,
                            new_value=str(new_value) if new_value is not None else None,
                            changed_by=changed_by,
                            device_hint=request.remote_addr,
                        )

                row = conn.execute(
                    "SELECT * FROM event_tag_catalog WHERE tag_name = ?", (tag_name,)
                ).fetchone()
        except sqlite3.IntegrityError as exc:
            return api_error(f"Integrity error: {exc}", 409, code="integrity_error")

        return jsonify({"row": dict(row)})

    return app


if __name__ == "__main__":
    create_app().run(debug=True, port=5050)
