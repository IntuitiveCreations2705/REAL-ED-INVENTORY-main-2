"""
audit.py — append-only audit log writer.

Call write_audit() INSIDE an existing open transaction so that the audit
record and the data change commit (or roll back) atomically together.
Never open a separate connection in here.
"""
from __future__ import annotations

import sqlite3
import uuid
from typing import Any


def write_audit(
    conn: sqlite3.Connection,
    *,
    table_name: str,
    row_ref: str,
    action: str,
    field_name: str | None = None,
    old_value: Any = None,
    new_value: Any = None,
    changed_by: str = "system",
    session_id: str | None = None,
    device_hint: str | None = None,
) -> None:
    """
    Append one audit record within the caller's connection/transaction.

    Parameters
    ----------
    conn        : open sqlite3.Connection — must be the same connection used
                  for the parent write so audit + data are one atomic commit.
    table_name  : table being mutated  (e.g. "master_inventory")
    row_ref     : human key for the row (e.g. "row_id=42")
    action      : verb — UPDATE | INSERT | TOGGLE | LINK
    field_name  : specific column changed (None for whole-row actions)
    old_value   : value before change
    new_value   : value after change
    changed_by  : username once Phase 2 auth is wired; IP address until then
    session_id  : UUID grouping all audit rows from a single save action
    device_hint : remote IP or device label
    """
    conn.execute(
        """
        INSERT INTO audit_log
            (table_name, row_ref, action, field_name,
             old_value, new_value, changed_by, changed_at, session_id, device_hint)
        VALUES
            (?, ?, ?, ?,
             ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'), ?, ?)
        """,
        (
            table_name,
            row_ref,
            action,
            field_name,
            str(old_value) if old_value is not None else None,
            str(new_value) if new_value is not None else None,
            changed_by,
            session_id or str(uuid.uuid4()),
            device_hint,
        ),
    )
