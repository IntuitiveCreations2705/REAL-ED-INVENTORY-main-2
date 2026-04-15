# TODO — Real Ed Inventory App

---

## P0 — Identity invariants + auth (blocking)

- [ ] Enact identity invariants policy in code + schema guards
  - Policy effective now; enforcement pending.
  - Ref: `REAL_AUTH_ROLE_ENFORCEMENT_DEFINITION.md`
  - Guards: `item_id` immutable, `item_name` governed by `item_id`, `box_number` non-identity

- [ ] Real auth + role enforcement (Phase A skeleton first)
  - Ref: `REAL_AUTH_ROLE_ENFORCEMENT_DEFINITION.md`
  - Phase A: `POST /api/auth/login`, session setup, replace `_changed_by()` IP fallback

- [ ] Fix `/api/themes` dead route
  - `event_stock_count.js` calls `/api/themes` — no backend route exists
  - Either implement route + theme_name data flow OR remove/hide the Theme filter UI

---

## P1 — Data quality + test gate

- [ ] Data rule consistency audit and bug fixes
- [ ] Regression test gate before further feature work
- [ ] Seed roles/users baseline (idempotent migration)

---

## P2 — Box label (people-facing names)

- [ ] Add `box_label` column to `master_inventory` (nullable, TEXT)
  - `box_label` = people-facing descriptive name (e.g. "Real Office Social Media Box")
  - `box_number` = system code reference (e.g. "AV15") — unchanged, stays as grouping key
  - Canonical key matching already implemented in UI (strips spaces/punctuation)
  - Migration: safe ALTER TABLE, default NULL

- [ ] Populate `box_label` values for all boxes (manual exercise, domain knowledge required)
  - 157 boxes identified in current live DB
  - Most need people-facing labels assigned before UI can display label as primary heading
  - Known example: AV15 → "Real Office Social Media Box"
  - Work through remaining boxes with person/role/location context as guide

- [ ] Update UI accordion heading to show `box_label` (if present) with `box_number` as secondary ref
  - Only after `box_label` column exists and data is populated
  - No change to accordion/filter/canonical-key logic required

---

## P2 — Box identity model (architecture confirmed, implementation blocked on P0)

**Confirmed model** (mirrors item identity exactly):

| Field | Role | Example |
|---|---|---|
| `box_id` | Immutable system identity key | `BX-0015` (prefix TBD) |
| `box_label` | People-facing name, governed by `box_id` | `Real Office Social Media Box` |
| `box_number` | Human reference code — non-identity | `AV15` |
| `box_type` | Physical/categorical type | `55L Storage` / `AV Case` / `Document Box` |

Ref: `REAL_AUTH_ROLE_ENFORCEMENT_DEFINITION.md` — Identity invariants policy.

- [ ] Decide `box_id` prefix convention
  - Must align with `item_id` prefix model (`Hi-`, `Pr-`, `Gs-` etc.)
  - Prefix encodes location or box category — needs explicit approval before any values generated

- [ ] Add `box_label` column to `master_inventory` (nullable TEXT, safe ALTER TABLE)
  - Populate from existing manual naming system
  - Known example: AV15 → `Real Office Social Media Box`
  - 157 boxes to work through — domain knowledge exercise

- [ ] Add `box_type` column to `master_inventory` (nullable TEXT)
  - Physical attribute of box, independent of contents
  - Enables summary: "How many 55L storage boxes exist?"
  - Vocabulary comes from existing manual convention

- [ ] Create `box_id_list` table (mirrors `item_id_list`)
  - Columns: `box_id` (PK, immutable), `box_label`, `box_type`, `box_number`, lifecycle columns
  - FK from `master_inventory.box_id` → `box_id_list.box_id`

- [ ] Update accordion heading to show `box_label` as primary, `box_number` as secondary ref
  - Only after `box_label` column exists and populated
  - No change to canonical key / filter / accordion logic required

**Prerequisite for all above:** P0 auth + identity invariants enforcement complete first.

---

## P2 — Phase 2 placeholder isolation

- [ ] Gate `global_sync_status.js`, `global_conflict_handler.js`, `global_role_context.js` behind feature flag
  - Currently scaffolded but unreferenced — drift risk

---
