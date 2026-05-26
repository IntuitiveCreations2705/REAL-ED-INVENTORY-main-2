#!/bin/bash
# Quick launch script for Sandbox 3 (Standalone Deployment Rehearsal)

if [[ "${1:-}" != "IMPLEMENT" ]]; then
	echo "BLOCKED: Hard-rule gate active."
	echo "Use: ./start_sandbox3.sh IMPLEMENT"
	exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

cd "$REPO_ROOT/inventory_app/ui"

echo "═════════════════════════════════════════════════════════"
echo "SANDBOX 3 - STANDALONE DEPLOYMENT REHEARSAL"
echo "═════════════════════════════════════════════════════════"
echo ""
echo "Database: sql_inventory_sb3.db (isolated, local only)"
echo "Users:    admin, leadership_test, operator_test"
echo "Starting local server on http://127.0.0.1:5052"
echo "Browser auto-open is disabled to prevent duplicate tabs."
echo ""
echo "NOTE: SB3 is full end-to-end system rehearsal"
echo "      Nightly 4am automation validates backup/restore cycle"
echo "═════════════════════════════════════════════════════════"
echo ""

export INVENTORY_DB_PATH="../../sql_inventory_sb3.db"
export INVENTORY_PORT="5052"
export INVENTORY_SANDBOX_LABEL="SB3 APPLICATION"

VENV_PY="$REPO_ROOT/.venv/bin/python3"

if [[ ! -x "$VENV_PY" ]]; then
  echo "ERROR: venv not found at $VENV_PY — run: python3 -m venv .venv && pip install -r requirements.txt"
  exit 1
fi

if lsof -ti tcp:5052 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "SB3 already running on port 5052."
  echo "Open manually: http://127.0.0.1:5052"
  exit 0
fi

"$VENV_PY" run_admin.py --label="SB3 APPLICATION" &
SERVER_PID=$!

echo "Waiting for server on port 5052..."
for i in $(seq 1 20); do
  if curl -s -o /dev/null -m 1 http://127.0.0.1:5052/api/health; then
    echo "Server ready. Open manually: http://127.0.0.1:5052"
    break
  fi
  sleep 0.5
done

wait $SERVER_PID

