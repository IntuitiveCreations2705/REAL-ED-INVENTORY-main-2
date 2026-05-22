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

## P2 — Box ↔ Item referential integrity (orphan detection + FK enforcement)

**Context:** `master_inventory.box_number` joins to `box_id_list.box_number` as a soft text match only.
The cycle `item_id → item → box_number → box_id_list` is not closed at DB or API level.

- [ ] Implement orphan detection queries
  - `box_id_list` rows with zero `master_inventory` references (orphan boxes — registered but empty)
  - `master_inventory` rows whose `box_number` has no matching `box_id_list` entry (dangling references)
  - Query both directions; expose results via a `/api/integrity/orphans` endpoint

- [ ] Wire orphan counts into UI as health indicator
  - Show orphan box count + dangling item count in Admin Master header or a dedicated integrity panel
  - Only show indicator when count > 0

- [ ] Add FK at DB level: `master_inventory.box_number` → `box_id_list.box_number`
  - Requires migration (SQLite FK enforcement via `PRAGMA foreign_keys = ON`)
  - Prerequisite: all existing dangling `box_number` values resolved first (run orphan query above)
  - Migration script: `migrations/` — new dated file

- [ ] Prerequisite: P0 auth + identity invariants must be complete before FK is enforced
  - FK lock-in is a breaking schema change — needs controlled rollout

---

## P2 — Backup encryption at rest

- [ ] GPG-encrypt backup `.sql.gz` files before storage
  - Current state: backups are compressed but unencrypted — readable by any entity with file access
  - Current `.sha256` verification also stores absolute temp path, breaking portable `shasum -c` on foreign devices
  - Implementation: pipe `auto_backup.sh` output through `gpg --symmetric` or `gpg --encrypt` with a stored key
  - Paired change: update `verify_backup.sh` and `restore_db.sh` to decrypt before verify/restore
  - Fix `.sha256` to store filename only (no absolute path) for portable cross-device verification
  - Key management strategy TBD — passphrase-protected symmetric key minimum; asymmetric key preferred for offsite restore scenarios

- [ ] Implement two-person split-custody disaster recovery model
  - Custodian A holds encrypted SSD package (app + DB + restore assets) with no credential secrets
  - Custodian B holds decryption/key access path only (no routine access to SSD payload)
  - Keep decryption key in two secure places: phone secure vault (primary) + emergency encrypted USB stick (backup)
  - Add a short disaster runbook (steps only, no raw passwords) and schedule periodic restore drill checks

---

## P2 — Phase 2 placeholder isolation

- [ ] Gate `global_sync_status.js`, `global_conflict_handler.js`, `global_role_context.js` behind feature flag
  - Currently scaffolded but unreferenced — drift risk

---
