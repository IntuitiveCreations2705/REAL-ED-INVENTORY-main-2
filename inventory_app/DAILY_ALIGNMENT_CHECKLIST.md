# Daily Alignment Checklist

Purpose: keep app behavior, UX intent, and operating model aligned with minimal drift.

Review cadence: Daily
Owner: Admin/Product Ops

## Named Owners (current)

- Product Owner: ME
- Technical Owner: ME
- Data Owner: ME
- On-call Technical Owner: ME

## Checklist

- [ ] Pre-clone gate (mandatory before aligning to 2000 MASTER)
  - Confirm mount and hierarchy exists:
    - `/Volumes/2000 MASTER/MASTER INVENTORY FOLDER/GITHUB REPOSITORY/repo-main`
    - `/Volumes/2000 MASTER/MASTER INVENTORY FOLDER/GITHUB REPOSITORY/repo-main-2`
  - Confirm env contract is aligned:
    - `INVENTORY_GITHUB_ROOT`
    - `INVENTORY_RUNTIME_ROOT`
    - `INVENTORY_MAIN2_DIR`
    - `INVENTORY_BACKUP_SECONDARY`
  - Run backup + verify + trial restore before clone alignment.
  - Run DR validation and require pass before clone alignment.
  - Record checkpoint tag as official pre-clone stage marker.

- [ ] Normalize rendering (later phase)
  - Scope: shared rendering conventions across views (labels, badges, spacing, visibility, sort/group defaults).
  - Constraint: presentation-only; no data-rule or schema changes in this step.
  - Dependency: finalize target UX direction first.

- [ ] Verify foundation principle alignment; check drift over time
  - Compare current app behavior vs agreed operating model/policy.
  - Confirm key rules still match intent (normalization, governance, concurrency, audit).
  - Review recent changes for side effects across views.
  - Record drift findings + corrective action owner/date.

- [ ] Create mandatory repo checkpoint (commit + push + checkpoint tag)
  - Applies to all branches: main, feature, hotfix, and WIP.
  - Explicitly confirm each action before execution: Commit (Y/N), Push (Y/N), Tag (Y/N), Proceed (Y/N).
  - No bypass allowed: if any response is N/unclear, stop work and do not run git actions.
  - Use checkpoint naming from `ui/PUSH_CMD_SYSTEM.md`.
  - Record latest checkpoint tag as official “NOW” stage.

## Completion list (setup)

- [x] Add named owners for Product/Technical/Data roles (current: ME for all roles)
- [ ] Later: perform repeat-use Admin flow validation pass (5–10 cycles of edit/save/link/toggle/filter)
  - Note: "Tunnel Of Turbulence" is data/content terminology only, not a system stability label.
- [ ] Later: build vertical-menu and horizontal-menu view modes as a UX preference chooser (like Theme selector)
- [ ] Later: define NOTES column standards (field size limits + default UX visibility behavior)

---

## Validation cadence (stability-first)

- Daily (quick control check, 10–20 min)
  - Run a fixed critical-rule spot-check set.
  - Goal: early warning, not exhaustive proof.

- Weekly (deep drift validation, 60–120 min)
  - Full cross-view rule parity check.
  - Include regression pass on top workflows.
  - Update rule docs if policy changed.

- Release gate (complete validation, mandatory)
  - Full validation suite before deploy.
  - No unresolved high-severity drift items allowed.
  - Sign-off: product + technical owner.

---

## Deployment authority (who approves, and when)

- Standard change (no schema/rule impact)
  - Authority: Technical Owner
  - When: after daily check pass and no open high-severity issues.

- Rule-impact change (normalization/governance/concurrency/audit)
  - Authority: Product Owner + Technical Owner (joint)
  - When: after weekly deep validation pass and rule docs updated.

- Schema/data migration change
  - Authority: Technical Owner + Data Owner
  - When: after migration validation + rollback plan verified.

- Emergency hotfix
  - Authority: On-call Technical Owner
  - When: immediate deploy allowed; mandatory next-day retrospective and full validation.

---

## Test-stage alignment gate (mandatory before repository finalization)

- Rule: No change is finalized in the app repository until test-stage alignment checks pass.
- Goal: zero unnoticed high-severity errors carried forward.

Required promotion criteria:

- [ ] Alignment check passed in test stage (rules + UX intent + operating model).
- [ ] Drift check completed against baseline docs and current behavior.
- [ ] Regression checks passed for critical workflows.
- [ ] Any defects found are either fixed or formally risk-accepted by named authority.
- [ ] Mandatory repository gate completed: commit + push + checkpoint tag on current branch with explicit per-action confirmations.
- [ ] Final approver sign-off recorded with date and scope.

Stop-ship conditions:

- Any unresolved high-severity defect.
- Rule conflict between documented policy and implemented behavior.
- Missing sign-off for rule-impact or schema-impact changes.

---

## Notes / Additions

- Add new checklist items below this line during daily review.

