  0987879# GLOBAL SCENARIO LOCK (Going Forward)

This is the authoritative operating contract for all future UI/app changes.

## Permanent rule
- Global CSS/JS/HTML conventions are anchored to Admin Master behavior and shared theme tokens.
- No silent divergence is allowed across screens.
- All future updates/modifications must be explicitly validated against MVP alignment.

## Required execution order for every request
1. Read [CHANGE_GATE_PROTOCOL.md](CHANGE_GATE_PROTOCOL.md).
2. Apply scope lock (in-scope + out-of-scope files).
3. Confirm against [UI_CONTRACT_BASELINE.md](UI_CONTRACT_BASELINE.md).
4. Provide impact preview before any edit.
5. Apply patch-only changes.
6. Provide post-change delta report.

## Non-negotiable controls
- No behind-the-scenes refactor.
- No rewrite unless explicitly requested.
- No visual rhythm changes (row height, column width, spacing) unless explicitly approved.
- No behavior removal while adding a new behavior unless explicitly approved.

## Global parity policy
- Shared baseline behavior must remain congruent across screens unless contract exception is approved.
- If a screen intentionally differs (e.g., summary vs edit), that difference must be documented before change.

## Acceptance checklist (must be answered before apply)
- Scope lock approved? (Y/N)
- File lock approved? (Y/N)
- Baseline parity verified? (Y/N)
- Visible impact approved? (Y/N)
- Zero-change guarantees approved? (Y/N)
- MVP coherence/cohesion/congruence confirmed? (Y/N)
- Apply patch now? (Y/N)

## Restoration rule
- If outcome deviates from approved impact, stop and revert to last checkpoint.
- Record incident in dated drift log and restate scope before retry.

## Enforcement note
- This file, [CHANGE_GATE_PROTOCOL.md](CHANGE_GATE_PROTOCOL.md), and [UI_CONTRACT_BASELINE.md](UI_CONTRACT_BASELINE.md) form the mandatory triad.
