# Real Auth + Role Enforcement Definition

Status: **Policy document — effective now. Enforcement implementation staged in TODO.**

---

## What auth + role enforcement means for this app

1. Every request to every endpoint must carry a valid authenticated session.
2. No public access. All endpoints require authentication — viewer-inclusive for reads.
3. Every write action is stamped with the authenticated username (not IP fallback).
4. Role weight determines permitted actions: `superadmin(10) > admin(20) > leadership(30) > operator(40) > viewer(50)`.
5. Unauthenticated requests are rejected before any data is touched.

---

## Role delineation

In this app, ROLE is split into four distinct layers:
- **Human Role** — the person and their organisational position
- **Access Role** — the permission level assigned in the system (superadmin / admin / leadership / operator / viewer)
- **UI Function** — the interface purpose of a given screen or action
- **System Function** — internal behaviour enforced at the backend regardless of UI

These layers are linked but independently defined.

---

## Endpoint access policy

| Endpoint class | Minimum role required |
|---|---|
| All reads (`GET`) | viewer |
| Writes (`POST / PATCH / PUT`) | operator |
| Admin actions | admin |
| Schema / migration / seed | superadmin |

No endpoint is accessible without authentication. No public access.

---

## Auth endpoints (Phase A)

- `POST /api/auth/login` — validate credentials, set session
- `POST /api/auth/logout` — clear session
- `GET /api/auth/me` — return current user + role

---

## Identity invariants policy (effective now, enforcement rollout in progress)

### Global immutable identity rule (authoritative)

- `item_id` is the sole immutable existence anchor for inventory entities across the app.
- All audit lineage, write authorization, conflict handling, and sync reconciliation pivot on `item_id`.
- No UI display string (including composite labels) may be treated as an identity key for persistence.
- `item_id` remains immutable once assigned and must never be repurposed.

### Item identity (existing, locked)

- `item_id` is the immutable identity key for items. Must not be repurposed or changed once set.
- `item_name` is governed by `item_id` — it is the display/managed label, not identity.
- No structural changes to this model without explicit policy update.

### Box identity model (confirmed architecture, implementation P2)

The box identity model mirrors the item model exactly:

| Field | Role | Example |
|---|---|---|
| `box_id` | Immutable system identity key | `BX-0015` (format TBD) |
| `box_label` | People-facing name, governed by `box_id` | `Real Office Social Media Box` |
| `box_number` | Human reference code — non-identity grouping field | `AV15` |
| `box_type` | Physical/categorical type — enables summary counts | `55L Storage`, `AV Case`, `Document Box` |

**Invariants:**
- `box_id` is immutable once assigned. Never repurposed.
- `box_label` is governed by `box_id` (same relationship as `item_name` → `item_id`).
- `box_number` is a non-identity reference field. It does not identify a box uniquely.
- `box_type` is a physical attribute of the box itself, independent of contents.
- Any future structural change to this model requires explicit policy update here first.

**`box_type` secondary benefit:**
Encoding physical type enables summary queries independent of box contents:
- *"How many 55L storage boxes exist?"*
- *"How many AV cases are in circulation?"*
This data comes directly from the existing manual naming convention carried into the app.

**Implementation gate:**
Box identity model implementation is blocked until P0 auth and item identity invariant enforcement are complete.

### UI display composition rule (non-identity)

- Views may render UX-oriented composite labels (example: `box_number + box_label`) to improve operator readability.
- Composite labels are presentation artifacts only and are non-binding for data identity.
- Composite labels must never be used as persistence, matching, or audit keys.

### Stock Count deviation clause (approved)

- In Event Stock Count UI only, the `BOX` column is explicitly allowed to render a composite display value.
- This is an instructed deviation for UX clarity and does not modify identity invariants.
- Persistence and governance continue to bind to immutable `item_id` (and applicable backend keys), not the composite BOX text.
- Extension of this deviation to any other UI requires explicit contract declaration before implementation.

---

## IT Pro access model

- Access via VPN / private network entry + app authentication.
- Not via repository access alone.
- Repo access ≠ app access.

---

## Rollout phases

- **Phase A** — Auth skeleton: endpoints, session setup, replace `_changed_by()` IP fallback
- **Phase B** — Write guards: all POST/PATCH/PUT require valid session
- **Phase C** — Role policies: endpoint access by role weight
- **Phase D** — Scope enforcement: role-scoped data visibility
- **Phase E** — Audit enrichment: username + role stamped on all audit records + regression tests

---

## Done criteria

- [ ] No unauthenticated request reaches any data endpoint
- [ ] `_changed_by()` never returns IP address in production
- [ ] All audit records carry authenticated username and role
- [ ] Viewer can read; operator can write; admin can manage; superadmin controls schema
- [ ] Box identity model schema exists and `box_id` / `box_label` / `box_type` populated
