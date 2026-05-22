from __future__ import annotations

import os
import socket
import sys
import threading
import time
import webbrowser
from pathlib import Path

HOST = "127.0.0.1"
PORT = 5050
URL = f"http://{HOST}:{PORT}"


def _is_port_open(host: str, port: int, timeout_s: float = 0.3) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(timeout_s)
        return sock.connect_ex((host, port)) == 0


def _wait_until_port_open(host: str, port: int, timeout_s: float = 15.0) -> bool:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if _is_port_open(host, port):
            return True
        time.sleep(0.2)
    return False


def _candidate_db_paths() -> list[Path]:
    candidates: list[Path] = []
    exe_dir = Path(sys.executable).resolve().parent
    cwd = Path.cwd().resolve()

    if getattr(sys, "frozen", False):
        # Packaged EXE launch context
        candidates.extend(
            [
                exe_dir / "sql_inventory_master.db",
                exe_dir.parent / "sql_inventory_master.db",
                exe_dir.parent.parent / "sql_inventory_master.db",
                cwd / "sql_inventory_master.db",
            ]
        )
    else:
        # Source launch context from inventory_app/ui
        source_ui_dir = Path(__file__).resolve().parent
        project_root = source_ui_dir.parents[1]
        candidates.extend(
            [
                project_root / "sql_inventory_master.db",
                source_ui_dir / "sql_inventory_master.db",
                cwd / "sql_inventory_master.db",
            ]
        )

    # Preserve order, remove duplicates.
    deduped: list[Path] = []
    seen: set[str] = set()
    for p in candidates:
        key = str(p)
        if key in seen:
            continue
        deduped.append(p)
        seen.add(key)
    return deduped


def _resolve_db_path() -> Path:
    env_path = os.getenv("INVENTORY_DB_PATH", "").strip()
    if env_path:
        return Path(env_path).expanduser().resolve()

    for path in _candidate_db_paths():
        if path.exists():
            return path

    # Fallback location if DB is not found yet.
    return _candidate_db_paths()[0]


def _set_runtime_env() -> None:
    db_path = _resolve_db_path()
    os.environ.setdefault("INVENTORY_DB_PATH", str(db_path))

    # Cross-platform MVP defaults for desktop launch on Windows.
    # Existing explicit env vars still win (setdefault).
    os.environ.setdefault("INVENTORY_PRECHANGE_BACKUP_ENABLED", "false")
    os.environ.setdefault("INVENTORY_PRECHANGE_BACKUP_REQUIRED", "false")
    os.environ.setdefault("INVENTORY_STARTUP_DAILY_BACKUP_ENABLED", "false")


def _run_server() -> None:
    from app import create_app

    app = create_app()
    app.run(host=HOST, port=PORT, debug=False, use_reloader=False)


def main() -> int:
    _set_runtime_env()

    # If already running, just open UI.
    if _is_port_open(HOST, PORT):
        webbrowser.open(URL)
        return 0

    server_thread = threading.Thread(target=_run_server, daemon=False)
    server_thread.start()

    if _wait_until_port_open(HOST, PORT):
        webbrowser.open(URL)
    else:
        print(f"Could not start Admin UI at {URL}.")
        return 1

    # Keep process alive while server runs.
    try:
        while server_thread.is_alive():
            server_thread.join(timeout=0.5)
    except KeyboardInterrupt:
        pass

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
