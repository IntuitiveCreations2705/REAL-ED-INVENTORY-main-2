# Drift Recovery Log — 2026-04-10

Purpose: reconstruct recent changes and provide a stable traceable return path.

## Recent 4-day commit timeline (high impact)
- `0d17af4` — STOCKTAKE UI and THEME SET UP
  - touched: `event_stock_count.js`, `event_stock_count.html`, `admin_theme.css`, plus app and master files.
- `fa63000` — EVENT TAGS LINKED
  - touched: `admin_theme.css`.
- `7378204` — CLEAN UP 07
  - touched: master JS/CSS and backend migration.
- `d8e2e0f` — GLOBAL UI TEXT BEHAVIOUR
  - touched: case rules, master/item JS, CSS, templates, backend.

## Observed drift vectors
- Large combined edits across template + CSS + JS in single steps.
- Interaction model flips in Stock Count (summary vs edit workflow).
- Layout width/card structure changes introduced with broad theme updates.

## Recovery strategy now in place
1. Enforce [CHANGE_GATE_PROTOCOL.md](CHANGE_GATE_PROTOCOL.md) before edits.
2. Enforce [UI_CONTRACT_BASELINE.md](UI_CONTRACT_BASELINE.md) as global contract.
3. Use patch-only changes for targeted restoration.
4. Checkpoint after each significant step per [PUSH_CMD_SYSTEM.md](PUSH_CMD_SYSTEM.md).

## Immediate practical use
- Before any next edit: state in-scope files + expected visible impact + no-change guarantees.
- If requested, recover a screen to a specific commit baseline with selective forward-port fixes.
