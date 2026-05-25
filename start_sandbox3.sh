#!/bin/bash
# Quick launch script for Sandbox 3 (Standalone Deployment Rehearsal)

if [[ "${1:-}" != "IMPLEMENT" ]]; then
	echo "BLOCKED: Hard-rule gate active."
	echo "Use: ./start_sandbox3.sh IMPLEMENT"
	exit 1
fi

cd "$(dirname "$0")"
cd inventory_app/ui

echo "═════════════════════════════════════════════════════════"
echo "SANDBOX 3 - STANDALONE DEPLOYMENT REHEARSAL"
echo "═════════════════════════════════════════════════════════"
echo ""
echo "Database: sql_inventory_sb3.db (isolated, local only)"
echo "Users:    admin, leadership_test, operator_test"
echo "Starting local server on http://127.0.0.1:5052"
echo "Browser will open automatically..."
echo ""
echo "NOTE: SB3 is full end-to-end system rehearsal"
echo "      Nightly 4am automation validates backup/restore cycle"
echo "═════════════════════════════════════════════════════════"
echo ""

export INVENTORY_DB_PATH="../../sql_inventory_sb3.db"
export INVENTORY_PORT="5052"
export INVENTORY_SANDBOX_LABEL="SB3 APPLICATION"
python3 run_admin.py --open-browser --label="SB3 APPLICATION"

