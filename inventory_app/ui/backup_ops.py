"""
Centralized pre-change backup helpers.

Used by admin mutation paths and bulk import scripts.
- Runs backup script when enabled.
- Applies cooldown to avoid backup on every small write.
- Returns structured metadata for audit/logging.
"""
from __future__ import annotations

import os
import subprocess
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = ROOT / ".env"
DEFAULT_DB_PATH = ROOT / "sql_inventory_master.db"
DEFAULT_PRIMARY = ROOT / "inventory_app" / "backups"
DEFAULT_SCRIPT = ROOT / "inventory_app" / "scripts" / "auto_backup.sh"
STAMP_FILE = DEFAULT_PRIMARY / ".last_prechange_snapshot_ts"
STARTUP_DAILY_STAMP_FILE = DEFAULT_PRIMARY / ".last_startup_daily_snapshot_date"


def _load_env_file() -> None:
    """Load simple KEY=VALUE pairs from optional project .env.

    Keeps existing process env values authoritative by using setdefault.
    """
    if not ENV_FILE.exists():
        return

    try:
        lines = ENV_FILE.read_text(encoding="utf-8").splitlines()
    except Exception:
        return

    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        if not key:
            continue
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


_load_env_file()


def _as_bool(value: str | None, default: bool = True) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def run_prechange_snapshot(
    reason: str,
    changed_by: str = "system",
    *,
    force: bool = False,
) -> dict[str, Any]:
    """Run pre-change backup snapshot with cooldown.

    Environment controls:
      INVENTORY_PRECHANGE_BACKUP_ENABLED   (default: true)
      INVENTORY_PRECHANGE_BACKUP_INTERVAL_S (default: 3600)
      INVENTORY_DB_PATH
      INVENTORY_BACKUP_PRIMARY
      INVENTORY_BACKUP_SECONDARY
      INVENTORY_BACKUP_RETENTION_DAYS      (default: 30)
      INVENTORY_BACKUP_OFFSITE_DIR         (optional)
      INVENTORY_BACKUP_SCRIPT              (optional)
    """
    enabled = _as_bool(os.getenv("INVENTORY_PRECHANGE_BACKUP_ENABLED"), True)
    if not enabled:
        return {"status": "disabled", "reason": reason}

    interval_s = int(os.getenv("INVENTORY_PRECHANGE_BACKUP_INTERVAL_S", "3600"))
    db_path = Path(os.getenv("INVENTORY_DB_PATH", str(DEFAULT_DB_PATH)))
    primary = Path(os.getenv("INVENTORY_BACKUP_PRIMARY", str(DEFAULT_PRIMARY)))
    secondary = os.getenv("INVENTORY_BACKUP_SECONDARY", "").strip()
    retention_days = os.getenv("INVENTORY_BACKUP_RETENTION_DAYS", "30").strip() or "30"
    offsite = os.getenv("INVENTORY_BACKUP_OFFSITE_DIR", "").strip()
    script_path = Path(os.getenv("INVENTORY_BACKUP_SCRIPT", str(DEFAULT_SCRIPT)))

    primary.mkdir(parents=True, exist_ok=True)

    now = int(time.time())
    try:
        last = int(STAMP_FILE.read_text(encoding="utf-8").strip())
    except Exception:
        last = 0

    if not force and now - last < interval_s:
        return {
            "status": "skipped_cooldown",
            "reason": reason,
            "cooldown_seconds": interval_s,
            "seconds_since_last": now - last,
        }

    if not script_path.exists():
        return {
            "status": "error",
            "reason": reason,
            "error": f"Backup script not found: {script_path}",
        }

    cmd = [
        "/bin/bash",
        str(script_path),
        str(db_path),
        str(primary),
        secondary,
        str(retention_days),
        offsite,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        return {
            "status": "error",
            "reason": reason,
            "error": proc.stderr.strip() or proc.stdout.strip() or "backup failed",
            "returncode": proc.returncode,
        }

    STAMP_FILE.write_text(str(now), encoding="utf-8")
    return {
        "status": "ok",
        "reason": reason,
        "changed_by": changed_by,
        "stdout": proc.stdout.strip(),
    }


def run_startup_daily_snapshot(changed_by: str = "system") -> dict[str, Any]:
    """Run one forced snapshot on first app startup each day.

    Environment controls:
      INVENTORY_STARTUP_DAILY_BACKUP_ENABLED (default: true)
    """
    enabled = _as_bool(os.getenv("INVENTORY_STARTUP_DAILY_BACKUP_ENABLED"), True)
    if not enabled:
        return {"status": "disabled"}

    primary = Path(os.getenv("INVENTORY_BACKUP_PRIMARY", str(DEFAULT_PRIMARY)))
    primary.mkdir(parents=True, exist_ok=True)

    today = time.strftime("%Y-%m-%d", time.localtime())
    try:
        last_date = STARTUP_DAILY_STAMP_FILE.read_text(encoding="utf-8").strip()
    except Exception:
        last_date = ""

    if last_date == today:
        return {"status": "skipped_already_ran", "date": today}

    result = run_prechange_snapshot(
        reason="startup.daily_boot",
        changed_by=changed_by,
        force=True,
    )
    if result.get("status") == "ok":
        STARTUP_DAILY_STAMP_FILE.write_text(today, encoding="utf-8")
    return result
