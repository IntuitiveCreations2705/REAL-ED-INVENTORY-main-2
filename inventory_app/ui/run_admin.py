import os
import sys

from app import create_app
from db import check_schema, get_conn, stamp_origin


def _require_implement_gate() -> None:
    token = (sys.argv[1] if len(sys.argv) > 1 else "").strip().upper()
    env_token = os.getenv("IMPLEMENT", "").strip().upper()
    if token == "IMPLEMENT" or env_token in {"1", "TRUE", "YES", "IMPLEMENT"}:
        return

    print("BLOCKED: Hard-rule gate active.")
    print("Use: python run_admin.py IMPLEMENT")
    raise SystemExit(1)


_require_implement_gate()

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

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5050, debug=True)
