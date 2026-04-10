# CHANGE GATE PROTOCOL (No Hidden Changes)

This protocol is mandatory before any code or UI change is applied.

## Objective
- Prevent AI/system drift.
- Ensure requested specifics are adhered to.
- Make impact visible before implementation.
- Eliminate behind-the-scenes scope creep.
- Enforce the permanent global scenario in [GLOBAL_SCENARIO_LOCK.md](GLOBAL_SCENARIO_LOCK.md).

## 1) Pre-change declaration (must be shown first)
Before editing, provide this exact structure:

- Request intent (1-3 lines)
- In-scope files (explicit list)
- Out-of-scope files (explicit list)
- Expected user-visible effects (UI/functional)
- Zero-change guarantees (what will not change)
- Rollback path (how to restore immediately)

No edits are made until this declaration is shown and acknowledged.

## 2) Patch-only default
- Default mode: targeted patch edits only.
- Full rewrites are prohibited unless explicitly requested.
- Opportunistic refactors are prohibited.

## 3) Baseline contract lock
- Shared baseline for UI/CSS/JS behavior is defined in [UI_CONTRACT_BASELINE.md](UI_CONTRACT_BASELINE.md).
- If a requested change conflicts with baseline, the conflict must be disclosed before edits.

## 4) Impact preview before apply
- Show a concise impact preview:
  - affected screens
  - affected columns/controls
  - event handlers added/removed
  - API endpoints touched

## 5) Post-change transparency report
After edits, always report:
- exact files changed
- what changed in each file (delta only)
- what was intentionally left untouched
- validation result (errors/lint/tests if run)

## 6) Drift tripwires (stop conditions)
Stop and re-confirm before proceeding if any of these occur:
- More than 3 files changed for a single-screen request
- Any template + CSS + JS all changed when only one was requested
- Any column widths/row height changed outside stated scope
- Any existing behavior removed while implementing new behavior

## 7) Recovery discipline
- Create milestone checkpoints per significant step (see [PUSH_CMD_SYSTEM.md](PUSH_CMD_SYSTEM.md)).
- Keep restoration notes in dated logs (see [DRIFT_RECOVERY_2026-04-10.md](DRIFT_RECOVERY_2026-04-10.md)).

## 8) Standard pre-change prompt block (copy/paste)
- Scope lock approved? (Y/N)
- File lock approved? (Y/N)
- UI contract deviations approved? (Y/N)
- Apply patch now? (Y/N)

## 9) Mandatory references (do not skip)
- [GLOBAL_SCENARIO_LOCK.md](GLOBAL_SCENARIO_LOCK.md)
- [UI_CONTRACT_BASELINE.md](UI_CONTRACT_BASELINE.md)
- [DRIFT_RECOVERY_2026-04-10.md](DRIFT_RECOVERY_2026-04-10.md)
