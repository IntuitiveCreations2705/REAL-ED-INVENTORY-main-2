# UI Contract Baseline (Global Setting Scenario)

This file is the functional + visual contract across admin screens.

## MVP Alignment (11-Apr-2026)
- Contract is approved for iterative refinement during build.
- Priority is stable foundation + role-fit UX over rapid feature sprawl.

## Core rule
- Global CSS/JS/HTML conventions from Admin Master are the basis for ongoing views.
- Any deviation must be pre-declared in the Change Gate.
- Going-forward lock reference: [GLOBAL_SCENARIO_LOCK.md](GLOBAL_SCENARIO_LOCK.md).

## Global identity and display boundary (authoritative)
- `item_id` is the sole immutable existence identity for inventory entities.
- UI labels may be transformed/composed for readability, but display text is non-identity.
- No composed display value may be used as a write key, audit key, or sync identity key.

## MVP system direction
- App must function in offline-capable operating mode for core workflows.
- System consists of:
  - Master office app (authoritative control app)
  - Independent mini app(s) for outside/out-of-office stock count collection
- Master app manages import/pull of data from mini app source datasets.
- Future-proofing target includes intranet operation across multiple independent linked devices.
- Tier model and MOM control-plane structure are defined in [TIER_ARCHITECTURE_DECISION.md](TIER_ARCHITECTURE_DECISION.md).
- Final server + repository editing configuration is explicitly marked as pending design decision and must be approved before implementation.

## Non-negotiable baseline constraints
- Typography and base control sizing must remain consistent with `admin_theme.css` shared tokens.
- Table row rhythm should stay congruent across admin views unless explicitly approved.
- Existing agreed interaction patterns must not be silently replaced.
- Each UI inherits appearance + shared interaction behavior from the Global Master Template by default.
- Any exception must be documented per-screen before implementation.

## Stock Count contract (current agreement)
- Stock Count is an operational summary view that must stay visually congruent with Admin Master baseline styles.
- Event Stock Count `BOX` column may render composite UX text (for example `box_number + box_label`) as an approved display-only deviation.
- This deviation does not relax persistence identity rules; backend identity remains bound to immutable `item_id`.
- Notes columns use card-style preview behavior with expandable detail bubble.
- Notes behavior:
  - preview target: 50 characters max
  - expanded detail target: 200 characters max
- Any move to inline editing or save workflow in Stock Count requires explicit pre-approval.

## Master + Mini app data governance contract
- Master app is authoritative source for controlled data state.
- Mini app captures field operations data and exports sync-ready payloads.
- Master app imports/pulls mini app payloads through validated pipeline (schema + rule checks).
- Provision exists for interactive UI workflows to trigger manual sync calls over intranet.
- Manual sync pulls must validate against master DB rules before commit.
- Sync execution must support safe multi-device usage (idempotent pull/apply behavior).
- Import actions must be auditable (who/when/what changed).
- Conflict resolution policy must be explicit before enabling merge automation.
- Approved sync architecture baseline is defined in [SYNC_ARCHITECTURE_DECISION.md](SYNC_ARCHITECTURE_DECISION.md).

## Deployment/operations contract (MVP)
- Master app is operated from office server environment.
- Repo-managed editing rights follow website-manager style governance (role-based maintainers).
- Exact infra/auth configuration is pending and must be approved before build implementation.

## Device and screen support contract (MVP)
- Master app and Mini App(s) must operate on smaller devices using a minimum supported screen preset.
- Target field-device baseline is tablet class (not phone-first):
  - iPad / large-screen tablet class
  - 1080p Android tablet class
- Phone layout is not a primary target for MVP unless explicitly added later.
- Responsive behavior must preserve usability at the minimum supported tablet viewport without breaking core role workflows.

## Role-driven UX contract
- Every screen must combine information + actions aligned to explicit user role goals.
- UX design principle: “Intelligent app that supports people.”
- Each role view must reduce cognitive load, prevent invalid actions, and provide clear next action cues.
- UX acceptance criterion: users should find the app efficient and pleasant to use.

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
- Data sync/import contract changes between mini app and master app
- Role permission model changes
