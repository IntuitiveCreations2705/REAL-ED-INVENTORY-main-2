# MVP Action Procedure (Execution Playbook)

Use this procedure to action the new build plan in `/Real_Ed_Inventory_App`.

## 0) Scope of this procedure
- Build a new app from ground up with global template-first architecture.
- Keep legacy app as reference only during migration.
- Enforce contract + gate at every step.

## 1) Pre-build gate (must pass)
Before any code in new app:
1. Confirm [UI_CONTRACT_BASELINE.md](UI_CONTRACT_BASELINE.md) is current.
2. Confirm [GLOBAL_SCENARIO_LOCK.md](GLOBAL_SCENARIO_LOCK.md) acceptance checklist is answered.
3. Create checkpoint commit/tag in current repo state.

## 2) Foundation-first build order
Build in this order only:
1. Global design tokens (colors, spacing, typography, states)
2. Shared UI shell/layout
3. Shared primitives (buttons, inputs, badges, table cells, status bar)
4. Shared behavior layer (dirty-row lock, save flow, validation message model)
5. Role scaffolding and permission boundaries

No feature screens until steps 1–5 are complete.

## 3) Screen implementation sequence
1. Master Admin (reference implementation)
2. Stock Count (inherits global template, role-specific exceptions only)
3. Mini App(s) for out-of-office stock collection

Each screen must include:
- explicit inherited behavior list
- explicit exception list
- save/validation rules
- rollback note

## 4) Data and sync procedure
1. Define sync payload schema (versioned)
2. Define validation pipeline against master DB rules
3. Define audit fields (`who`, `when`, `source_device`, `change_set`)
4. Implement manual sync call flow (intranet-capable)
5. Implement idempotent apply logic for multi-device safety

## 5) Device support verification
Minimum required viewport validation for:
- iPad / large tablet class
- 1080p Android tablet class

Verify role workflows at minimum supported viewport before merge.

## 6) Change execution standard (per task)
For each requested change:
1. Pre-change declaration (scope/effects/non-effects)
2. Single patch set
3. Single validation pass
4. Post-change delta report

## 7) Definition of done (MVP checkpoint)
MVP checkpoint is complete only when:
- global template is reused by all MVP screens
- role workflows pass on minimum tablet viewport
- mini app → master manual sync works with validation + audit trail
- no unresolved contract deviations

## 8) Out-of-scope until explicitly approved
- Phone-first UI optimization
- Automated merge conflict resolver for sync
- Non-essential UI redesign passes
