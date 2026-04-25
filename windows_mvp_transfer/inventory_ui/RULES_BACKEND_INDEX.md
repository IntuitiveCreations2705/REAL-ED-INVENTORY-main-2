# Backend Rules Index (Python)

Purpose: quick map of server-side rules so changes can be made safely and reused in other views.

Primary shared source: `rules.py` (import this module from routes/views instead of re-implementing rule logic).

## Core rule helpers
- `parse_pipe_tags(raw_tags)`
  - Parses event tags into canonical token list (`|TAG|`) for filtering.
  - Source: rules.py

- `normalize_pipe_tags(raw_tags)`
  - Normalizes to canonical uppercase pipe format (`|TAG1||TAG2|`).
  - Source: rules.py

- `normalize_location_label(raw_value)`
  - Normalizes storage/location labels to uppercase.
  - Source: rules.py

- `normalize_box_label(raw_value)`
  - Normalizes `box_number` to uppercase.
  - Source: rules.py

- `as_number(value, default=0.0)`
  - Numeric coercion helper.
  - Source: rules.py

- `computed_order_stock_qty(qty_required, stock_on_hand)`
  - Derived rule: `max(qty_required - stock_on_hand, 0)`.
  - Source: rules.py

- `validate_event_tags_against_catalog(normalized_tags_str, conn)`
  - Validates event_tags against Active tags in event_tag_catalog.
  - Rejects Inactive tags with error message listing unavailable tags.
  - Source: rules.py

- `api_error(message, status=400, code=None, **extras)`
  - Uniform error envelope for all validation/governance failures.
  - Source: app.py

## Master Inventory governance rules
- `item_name` governed by `item_id` in updates
  - If `item_name` is edited without `item_id`, request is rejected (`governed_field`).
  - Source: `PATCH /api/master/<row_id>` in app.py

- `item_id -> item_name` referential sync
  - On save, `item_id` must exist in `item_id_list`; then `item_name` auto-syncs from lookup.
  - Source: `PATCH /api/master/<row_id>` and `POST /api/master` in app.py

- Box normalization rule
  - `box_number` is normalized to uppercase on insert and update.
  - Source: `POST /api/master`, `PATCH /api/master/<row_id>` in app.py via `rules.py`

- Box strategy coherence rule (MVP)
  - Box-group UX uses `box_number` as membership key and `box_label` as heading label.
  - `GET /api/master` enriches rows with registry metadata (`box_label`, `box_id`, and optional `box_type`) when `box_id_list` exists.
  - If registry table is absent, metadata falls back to empty strings so core master rows still load.
  - Source: `GET /api/master` in app.py

- Optimistic concurrency (`version`)
  - Save rejected if client `version` does not match DB (`stale_version`).
  - Source: `PATCH /api/master/<row_id>` in app.py

- Derived quantity rule
  - `order_stock_qty` is computed unless manual override is explicitly requested.
  - Source: `POST /api/master`, `PATCH /api/master/<row_id>` in app.py

- Foreign key integrity safeguard
  - Post-write `PRAGMA foreign_key_check`; write is blocked on violation (`fk_violation`).
  - Source: app.py

- Event tags validation rule
  - `event_tags` field is validated against `event_tag_catalog`; only Active tags allowed.
  - Saves rejected if any tag is Inactive (`tag_validation_error`).
  - Governance: Senior admin only can modify tag catalog; tag lifecycle controlled by status field.
  - Source: `POST /api/master`, `PATCH /api/master/<row_id>` via `validate_event_tags_against_catalog()` in rules.py

- Lifecycle stamping
  - `updated_at`, `updated_by`, `version = version + 1` on writes.
  - Source: app.py

## Item ID List governance rules
- Required validation
  - `item_id` required, `item_name` required, `status` in `{Active, Inactive}`.
  - Source: `POST /api/item-list/upsert` in app.py

- Immutable key rule
  - Existing `item_id` cannot be changed (`immutable_item_id`).
  - Source: `POST /api/item-list/upsert` in app.py

- Optimistic concurrency (`version`)
  - Reject stale edits (`stale_version`).
  - Source: `POST /api/item-list/upsert` in app.py

- Cascaded rename safety path (when used in master rows)
  - Temporary key strategy preserves referential consistency while propagating item name changes.
  - Source: `POST /api/item-list/upsert` in app.py

## System-wide safeguards (Python)
- DB connection policy
  - Enforces foreign keys, WAL mode, busy timeout.
  - Source: db.py (`get_conn`)

- Startup schema checks
  - Warns on missing required migration tables/columns.
  - Source: db.py (`check_schema`)

- Atomic audit logging
  - `write_audit(...)` must run in same transaction as data change.
  - Source: audit.py

- Event Tag Catalog API endpoints
  - `GET /api/event-tags` → list all tags (all roles)
  - `POST /api/event-tags` → create tag (senior admin only)
  - `PATCH /api/event-tags/<tag_name>` → update tag status/description (senior admin only)
  - Source: app.py

## Existing UI rule reference
- Field capitalization/format rules are documented separately in `CAPS_RULES.md` (front-end normalization and prompts).

## Reuse guidance for other views
When adding a new view, call the same backend APIs and do not duplicate business logic in JS:
1. Keep normalization + governance in Python routes/helpers.
2. Include `version` in save payloads for optimistic locking.
3. Treat `item_name` as derived from `item_id` where applicable.
4. Keep audit writes in the same DB transaction.
5. Run health/FK checks after risky migration changes.
6. Validate all user-provided taxonomies (event tags, locations, boxes) against their governance catalogs.
