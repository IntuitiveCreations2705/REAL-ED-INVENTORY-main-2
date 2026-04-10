# UI Contract Baseline (Global Setting Scenario)

This file is the functional + visual contract across admin screens.

## Core rule
- Global CSS/JS/HTML conventions from Admin Master are the basis for ongoing views.
- Any deviation must be pre-declared in the Change Gate.
- Going-forward lock reference: [GLOBAL_SCENARIO_LOCK.md](GLOBAL_SCENARIO_LOCK.md).

## Non-negotiable baseline constraints
- Typography and base control sizing must remain consistent with `admin_theme.css` shared tokens.
- Table row rhythm should stay congruent across admin views unless explicitly approved.
- Existing agreed interaction patterns must not be silently replaced.

## Stock Count contract (current agreement)
- Stock Count is an operational summary view that must stay visually congruent with Admin Master baseline styles.
- Notes columns use card-style preview behavior with expandable detail bubble.
- Notes behavior:
  - preview target: 50 characters max
  - expanded detail target: 200 characters max
- Any move to inline editing or save workflow in Stock Count requires explicit pre-approval.

## Master Admin contract (reference behavior)
- Full edit workflow with row-level save and data validation.
- Quantity columns include edit-aware behaviors, computed quantity support, and save path to backend.

## Allowed change classes without re-contracting
- Bug fix with no UX/interaction change
- Validation message wording
- Non-visual backend reliability fix

## Change classes that require explicit contract approval
- Column width/row height modifications
- Interaction model changes (view-only ↔ editable)
- Save flow changes
- Removing existing controls/cards/badges/dialogs
