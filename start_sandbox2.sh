#!/bin/bash
# Quick launch script for Sandbox 2 (Test & Verify UI Environment)

if [[ "${1:-}" != "IMPLEMENT" ]]; then
	echo "BLOCKED: Hard-rule gate active."
	echo "Use: ./start_sandbox2.sh IMPLEMENT"
	exit 1
fi

cd "$(dirname "$0")"
cd inventory_app/ui

echo "═════════════════════════════════════════════════════════"
echo "SANDBOX 2 - TEST & VERIFY ENVIRONMENT"
echo "═════════════════════════════════════════════════════════"
echo ""
echo "Database: sql_inventory_sb2.db (isolated, local only)"
echo "Users:    admin, leadership_test, operator_test, viewer_test"
echo "Starting local server on http://127.0.0.1:5051"
echo "Browser will open automatically..."
echo ""
echo "NOTE: SB2 is fully mutable; all UIs available for testing"
echo "═════════════════════════════════════════════════════════"
echo ""

export INVENTORY_DB_PATH="../../sql_inventory_sb2.db"
export INVENTORY_PORT="5051"
export INVENTORY_SANDBOX_LABEL="SB2 TEST"
python3 run_admin.py --open-browser --label="SB2 TEST"

