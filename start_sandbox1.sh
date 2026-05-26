#!/bin/bash
# Quick launch script for Sandbox 1 (Admin Master UI)

if [[ "${1:-}" != "IMPLEMENT" ]]; then
	echo "BLOCKED: Use ./start_sandbox1.sh IMPLEMENT"
	exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$SCRIPT_DIR"

cd "$REPO_ROOT/inventory_app/ui"

echo "═════════════════════════════════════════════════════════"
echo "SANDBOX 1 - REAL-ED INVENTORY ADMIN MASTER UI"
echo "═════════════════════════════════════════════════════════"
echo ""
echo "Database: sql_inventory_master.db"
echo "Starting local server on http://127.0.0.1:5050"
echo "Browser auto-open is disabled to prevent duplicate tabs."
echo ""
echo "NOTE: SB1 is baseline/master view for reference and validation"
echo "═════════════════════════════════════════════════════════"
echo ""

export INVENTORY_DB_PATH="../../sql_inventory_master.db"
export INVENTORY_PORT="5050"
export INVENTORY_SANDBOX_LABEL="SB1 MASTER"

VENV_PY="$REPO_ROOT/.venv/bin/python3"

if [[ ! -x "$VENV_PY" ]]; then
	echo "ERROR: venv not found at $VENV_PY — run: python3 -m venv .venv && pip install -r requirements.txt"
	exit 1
fi

if lsof -ti tcp:5050 -sTCP:LISTEN >/dev/null 2>&1; then
	echo "SB1 already running on port 5050."
	echo "Open manually: http://127.0.0.1:5050"
	exit 0
fi

"$VENV_PY" run_admin.py --label="SB1 MASTER" &
SERVER_PID=$!

echo "Waiting for server on port 5050..."
for i in $(seq 1 20); do
	if curl -s -o /dev/null -m 1 http://127.0.0.1:5050/api/health; then
		echo "Server ready. Open manually: http://127.0.0.1:5050"
		break
	fi
	sleep 0.5
done

wait $SERVER_PID
