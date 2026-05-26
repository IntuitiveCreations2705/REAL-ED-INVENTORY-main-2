#!/bin/bash
# Quick launch script for Sandbox 2 (Test & Verify UI Environment)

if [[ "${1:-}" != "IMPLEMENT" ]]; then
	echo "BLOCKED: Hard-rule gate active."
	echo "Use: ./start_sandbox2.sh IMPLEMENT"
	exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

cd "$REPO_ROOT/inventory_app/ui"

echo "═════════════════════════════════════════════════════════"
echo "SANDBOX 2 - TEST & VERIFY ENVIRONMENT"
echo "═════════════════════════════════════════════════════════"
echo ""
echo "Database: sql_inventory_sb2.db (isolated, local only)"
echo "Users:    admin, leadership_test, operator_test, viewer_test"
echo "Label:    SB2 TEST (canonical format; no underscores)"
echo "Starting local server on http://127.0.0.1:5051"
echo "Browser auto-open is disabled to prevent duplicate tabs."
echo "UI std:   Shared baseline body background rgb(15, 23, 42)"
echo ""
echo "NOTE: SB2 is fully mutable; all UIs available for testing"
echo "═════════════════════════════════════════════════════════"
echo ""

export INVENTORY_DB_PATH="../../sql_inventory_sb2.db"
export INVENTORY_PORT="5051"
export INVENTORY_SANDBOX_LABEL="SB2 TEST"

VENV_PY="$REPO_ROOT/.venv/bin/python3"

if [[ ! -x "$VENV_PY" ]]; then
  echo "ERROR: venv not found at $VENV_PY — run: python3 -m venv .venv && pip install -r requirements.txt"
  exit 1
fi

# Start server in background, then wait until port is ready before opening browser
if lsof -ti tcp:5051 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "SB2 already running on port 5051."
  echo "Open manually: http://127.0.0.1:5051"
  exit 0
fi

"$VENV_PY" run_admin.py --label="SB2 TEST" &
SERVER_PID=$!

echo "Waiting for server on port 5051..."
for i in $(seq 1 20); do
  if curl -s -o /dev/null -m 1 http://127.0.0.1:5051/api/health; then
    echo "Server ready. Open manually: http://127.0.0.1:5051"
    break
  fi
  sleep 0.5
done

wait $SERVER_PID

