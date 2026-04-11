# Admin Master View Baseline

Integrity-first Admin UI wired directly to `sql_inventory_master.db`.

## Visual architecture map
- Open [SYSTEM_MAP.md](SYSTEM_MAP.md) in Markdown Preview for a live system diagram.
- Open [CAPS_RULES.md](CAPS_RULES.md) for the stored capitalization and field-format rules.
- Open [PUSH_CMD_SYSTEM.md](PUSH_CMD_SYSTEM.md) for the pre-action git push checklist and command recipes.
- Open [CHANGE_GATE_PROTOCOL.md](CHANGE_GATE_PROTOCOL.md) for mandatory pre-change scope/impact disclosure.
- Open [UI_CONTRACT_BASELINE.md](UI_CONTRACT_BASELINE.md) for global UI behavior/appearance contract.
- Open [DRIFT_RECOVERY_2026-04-10.md](DRIFT_RECOVERY_2026-04-10.md) for recent drift reconstruction notes.
- Open [GLOBAL_SCENARIO_LOCK.md](GLOBAL_SCENARIO_LOCK.md) for the permanent going-forward enforcement rules.
- Open [MVP_ACTION_PROCEDURE.md](MVP_ACTION_PROCEDURE.md) for the step-by-step execution playbook for the new build.
- Open [TIER_ARCHITECTURE_DECISION.md](TIER_ARCHITECTURE_DECISION.md) for the approved multi-tier security/data-protection model.

## What this baseline does
- Loads live rows from `master_inventory`
- Allows Admin edits on core columns
- Enforces `item_id` + `item_name` paired updates
- Supports existence-first typeahead via `item_id_list` (`item_name` contains search text)
- Commits link by click to selected suggestion
- Toggles active/inactive (`is_active`) without deletions
- Runs health check including `PRAGMA foreign_key_check`

## Files
- `app.py` — Flask backend + API
- `run_admin.py` — app runner
- `templates/admin_master_view.html` — master view page
- `static/admin_theme.css` — CSS tokens + presets
- `static/admin_master_view.js` — UI behavior
- `requirements.txt` — dependencies

## Run
```bash
cd /Users/intuitivecreations2705gmail.com/Downloads/REAL-ED-INVENTORY-main/inventory_app/ui
/Users/intuitivecreations2705gmail.com/Downloads/REAL-ED-INVENTORY-main/.venv/bin/python -m pip install -r requirements.txt
/Users/intuitivecreations2705gmail.com/Downloads/REAL-ED-INVENTORY-main/.venv/bin/python run_admin.py
```

Open: `http://127.0.0.1:5050`

## API quick check
- `GET /api/health`
- `GET /api/master?view=all`
- `GET /api/suggest?q=Light`
- `PATCH /api/master/<row_id>`
- `POST /api/master/<row_id>/toggle-active`
- `POST /api/master/<row_id>/link-item`
