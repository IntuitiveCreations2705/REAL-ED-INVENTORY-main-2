# Admin Master View Baseline

Integrity-first Admin UI wired directly to `sql_inventory_master.db`.

## Visual architecture map
- Open [SYSTEM_MAP.md](SYSTEM_MAP.md) in Markdown Preview for a live system diagram.
- Open [CAPS_RULES.md](CAPS_RULES.md) for the stored capitalization and field-format rules.
- Open [PUSH_CMD_SYSTEM.md](PUSH_CMD_SYSTEM.md) for the pre-action git push checklist and command recipes.
- Open [CHANGE_GATE_PROTOCOL.md](CHANGE_GATE_PROTOCOL.md) for mandatory pre-change scope/impact disclosure.
- Open [UI_CONTRACT_BASELINE.md](UI_CONTRACT_BASELINE.md) for global UI behavior/appearance contract.
- Open [GLOBAL_UI_TEMPLATE.md](GLOBAL_UI_TEMPLATE.md) for required shared screen layout/regions across tiers.
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
- **ItemID Format**: All items use format `{PREFIX}-{4DIGITS}` (example: `Hi-0001`). ItemID is immutable and unique per database.

## ItemID Format Reference
- **Format**: `Hi-0001`, `Pr-0042`, `Gs-9999` (two-character prefix + four-digit numeric suffix)
- **Prefix Examples**: `Hi` (High School), `Pr` (Primary), `Gs` (General Store)
- **Immutable**: Once created, ItemID cannot be changed. It is the foundational reference for all validation, sync, and audit trails.
- **Unique**: Each item must have a unique ItemID. Database enforces uniqueness constraint.
- **Migration Context**: Previous format was `Hi-000001` (6 digits). All new items use the 4-digit format (Hi-0001) moving forward.

## Files
- `app.py` — Flask backend + API
- `run_admin.py` — app runner
- `desktop_launcher.py` — one-click launcher entrypoint (starts server + opens browser)
- `build_windows_exe.bat` — builds standalone Windows EXE launcher via PyInstaller
- `run_admin_launcher.bat` — quick Windows source launcher (requires Python installed)
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

## Windows MVP (Option 2: packaged EXE, no separate Python install on test PC)

Goal UX: desktop icon/shortcut → double-click → Admin opens.

### Build the EXE once (on a Windows build machine)
1. Open Command Prompt in `inventory_app/ui`
2. Run `build_windows_exe.bat`
3. Resulting file: `inventory_app/ui/dist/REAL-ED-Admin.exe`

### Place EXE for runtime
- Copy `REAL-ED-Admin.exe` to the **project root** (same folder as `sql_inventory_master.db`), or keep it in a folder that also contains `sql_inventory_master.db`.

### Create desktop icon
- Right-click `REAL-ED-Admin.exe` → **Send to → Desktop (create shortcut)**
- Double-click shortcut to launch Admin.

### Notes
- Launcher auto-opens `http://127.0.0.1:5050`.
- If server is already running, launcher only opens the Admin screen.
- In launcher mode, backup-on-change is disabled by default for cross-platform MVP consistency.

## API quick check
- `GET /api/health`
- `GET /api/master?view=all`
- `GET /api/suggest?q=Light`
- `PATCH /api/master/<row_id>`
- `POST /api/master/<row_id>/toggle-active`
- `POST /api/master/<row_id>/link-item`
