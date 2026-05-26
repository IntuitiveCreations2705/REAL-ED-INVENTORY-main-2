from __future__ import annotations

import argparse
import os
import threading
import webbrowser

from app import create_app
from db import DB_PATH, check_schema, get_conn, stamp_origin

warnings = check_schema()
if warnings:
    print("\n⚠️  SCHEMA WARNINGS — run migrate.py before starting the app:")
    for w in warnings:
        print(f"   • {w}")
    print()

# Stamp origin fingerprint into DB on first-run (internal record — not displayed)
_conn = get_conn()
try:
    stamp_origin(_conn)
finally:
    _conn.close()

app = create_app()


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run the REAL-ED admin UI")
    parser.add_argument("--host", default=os.getenv("INVENTORY_HOST", "127.0.0.1"))
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("INVENTORY_PORT", "5050")),
    )
    parser.add_argument(
        "--open-browser",
        action="store_true",
        help="Open the UI URL in the default browser after startup.",
    )
    parser.add_argument(
        "--label",
        default=os.getenv("INVENTORY_SANDBOX_LABEL", ""),
        help="Optional human-readable sandbox label shown in terminal startup output.",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        default=os.getenv("INVENTORY_DEBUG", "0") in {"1", "true", "TRUE", "yes", "YES"},
        help="Enable Flask debug mode (default: off unless INVENTORY_DEBUG=1).",
    )
    return parser


def _open_browser_later(url: str) -> None:
    timer = threading.Timer(1.5, lambda: webbrowser.open(url))
    timer.daemon = True
    timer.start()

if __name__ == "__main__":
    args = _build_parser().parse_args()
    label = f" [{args.label}]" if args.label else ""
    url = f"http://{args.host}:{args.port}"

    print("\n═════════════════════════════════════════════════════════")
    print(f"REAL-ED ADMIN UI{label}")
    print("═════════════════════════════════════════════════════════")
    print(f"URL: {url}")
    print(f"DB : {DB_PATH}")
    print("Use /api/health or the header badge to verify sandbox.\n")

    if args.open_browser:
        _open_browser_later(url)

    app.run(host=args.host, port=args.port, debug=args.debug, use_reloader=False)
