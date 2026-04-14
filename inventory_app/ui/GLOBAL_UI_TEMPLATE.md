# Global UI Template (Definition)

Status: **Active baseline (14-Apr-2026)**

This file defines the shared UI shell all Tier 2/Tier 3 screens inherit by default.
It turns "Global UI template" from a concept into a concrete build contract.

## Purpose
- Keep all operational screens visually and behaviorally consistent.
- Reduce user relearning between Admin, Leadership, Management, Facilitator, Crew, and Operations views.
- Preserve integrity-first patterns (status visibility, controlled save flow, audit-friendly actions).

## Source-of-truth relationship
- Visual + behavior baseline: [UI_CONTRACT_BASELINE.md](UI_CONTRACT_BASELINE.md)
- Tier inheritance and role model: [TIER_ARCHITECTURE_DECISION.md](TIER_ARCHITECTURE_DECISION.md)
- Change process guardrail: [CHANGE_GATE_PROTOCOL.md](CHANGE_GATE_PROTOCOL.md)

This file defines **template shape and required regions**.

## Required layout regions
All inheriting screens must include these regions in this order:

1. **App shell**
   - Root container using `.app-shell`
2. **Header card**
   - Screen title + purpose subtitle
   - Cross-screen navigation actions
   - Primary action(s) and refresh control
3. **Controls card**
   - Search/filter inputs relevant to the view
4. **Rules/help card** (collapsible allowed)
   - Read-only or editable rule controls as approved
5. **Main data surface**
   - Table/card list/grid depending on role task
6. **Status footer**
   - Persistent status line for load/save/warning/error feedback

## Mandatory shared behavior
- **Load state clarity**: screen must report row/item load count or explicit failure reason.
- **Error visibility**: API failures must surface in status UI (no silent blank views).
- **Save discipline**: row-level or unit-level save actions must be explicit.
- **Validation-first UX**: required-field and rule violations must block save with clear message.
- **Theme consistency**: use shared tokens/classes from `static/admin_theme.css`.

## Mandatory shared style contract
- Typography, button sizing, spacing rhythm, and control styles follow `admin_theme.css`.
- Header/action structure remains consistent with `admin_master_view.html` pattern.
- Status bar style and placement must be consistent across screens.

## Reserved placeholder regions (Phase 2+)
Keep these placeholder zones available in inheriting templates:
- Role selector / specialization badge
- Device + BOX scope indicator
- Satellite sync status indicator
- Conflict warning panel

## Inheritance targets
- Tier 2.1 Admin
- Tier 2.2 Leadership specializations
- Tier 2.3 Management
- Tier 2.4 Facilitator
- Tier 3.1 Crew
- Tier 3.2 Operations

## Allowed deviations
Deviation is allowed only when pre-declared and approved in Change Gate for:
- Different data surface type required by task (table vs cards)
- Role-critical action placement adjustments
- Accessibility improvements that keep baseline semantics intact

## Forbidden deviations (without contract approval)
- Removing persistent status feedback
- Silent save model changes
- Replacing baseline interaction patterns without disclosure
- Breaking visual token consistency with shared theme

## Implementation anchor examples
- `templates/admin_master_view.html`
- `templates/admin_item_list_view.html`
- `static/admin_theme.css`
- `static/admin_master_view.js`
- `static/admin_item_list_view.js`
