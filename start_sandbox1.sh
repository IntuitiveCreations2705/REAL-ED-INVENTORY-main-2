#!/bin/bash
# Quick launch script for Sandbox 1 (Admin Master UI)

if [[ "${1:-}" != "IMPLEMENT" ]]; then
	echo "BLOCKED: Hard-rule gate active."
	echo "Use: ./start_sandbox1.sh IMPLEMENT"
	exit 1
fi

cd "$(dirname "$0")"
cd inventory_app/ui

echo "═════════════════════════════════════════════════════════"
echo "SANDBOX 1 - REAL-ED INVENTORY ADMIN MASTER UI"
echo "═════════════════════════════════════════════════════════"
echo ""
echo "Starting local server on http://127.0.0.1:5050"
echo "Browser will open automatically..."
echo ""

python3 run_admin.py IMPLEMENT
