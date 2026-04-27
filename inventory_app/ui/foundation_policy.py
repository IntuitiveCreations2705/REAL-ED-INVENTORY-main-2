"""foundation_policy.py — hard validation gate for the global foundation statement.

This module enforces the repo-level foundation statement before any write/mutation
operation is allowed to proceed.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
FOUNDATION_STATEMENT_PATH = Path(
    os.getenv("INVENTORY_FOUNDATION_STATEMENT_PATH", str(ROOT / "global system statement.txt"))
).resolve()

FOUNDATION_STATEMENT_EXPECTED = (
    "The database structure remains the single source of truth, maintained in present "
    "time, through the team’s role-based activity structure embedded in the system’s core."
)


def _normalize_statement(text: str) -> str:
    # Collapse any repeated whitespace/newlines to keep strict meaning while
    # permitting harmless formatting differences.
    return " ".join(str(text or "").split()).strip()


def evaluate_foundation_policy(action_name: str) -> dict[str, Any]:
    """Return policy gate result for the given action.

    Env toggles:
      INVENTORY_REQUIRE_FOUNDATION_VALIDATION=true|false
      INVENTORY_FOUNDATION_STATEMENT_EXPECTED=<override text>
      INVENTORY_FOUNDATION_STATEMENT_PATH=<override path>
    """
    required = str(os.getenv("INVENTORY_REQUIRE_FOUNDATION_VALIDATION", "true")).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }
    if not required:
        return {
            "ok": True,
            "code": "foundation_validation_disabled",
            "message": "Foundation validation disabled by environment configuration.",
            "action": action_name,
            "path": str(FOUNDATION_STATEMENT_PATH),
        }

    expected_raw = os.getenv("INVENTORY_FOUNDATION_STATEMENT_EXPECTED", FOUNDATION_STATEMENT_EXPECTED)
    expected = _normalize_statement(expected_raw)

    if not FOUNDATION_STATEMENT_PATH.exists():
        return {
            "ok": False,
            "code": "foundation_statement_missing",
            "message": "Foundation statement file is missing; mutation blocked.",
            "action": action_name,
            "path": str(FOUNDATION_STATEMENT_PATH),
        }

    current_raw = FOUNDATION_STATEMENT_PATH.read_text(encoding="utf-8").strip()
    current = _normalize_statement(current_raw)

    if not current:
        return {
            "ok": False,
            "code": "foundation_statement_empty",
            "message": "Foundation statement file is empty; mutation blocked.",
            "action": action_name,
            "path": str(FOUNDATION_STATEMENT_PATH),
        }

    if current != expected:
        return {
            "ok": False,
            "code": "foundation_statement_mismatch",
            "message": "Foundation statement mismatch; mutation blocked.",
            "action": action_name,
            "path": str(FOUNDATION_STATEMENT_PATH),
            "expected": expected,
            "current": current,
        }

    return {
        "ok": True,
        "code": "foundation_statement_valid",
        "message": "Foundation validation passed.",
        "action": action_name,
        "path": str(FOUNDATION_STATEMENT_PATH),
    }
