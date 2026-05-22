# CAPS / Case Rules

Reference note for where capitalization rules are enforced in the admin UI and what each rule is intended to do.

See also: [MASTER_RULE_TEMPLATE.md](MASTER_RULE_TEMPLATE.md) for the plain-English design template used before adding new global rules or exceptions.

## Intent
- Keep user-facing naming fields readable and consistent.
- Preserve deliberate all-caps acronyms or special words only when the user confirms they should stay in caps.
- Standardize storage labels and event tags so filters, lookups, and matching stay reliable.
- Normalize measurement units so values like `25 M` and `25m` are stored consistently.

## Rules by screen and column

### Admin Master Inventory
- `description`
  - Brackets are stripped before save: `[]`, `()`, `{}` are removed.
  - Saved in Title Case by default.
  - Small joiner words remain lowercase after the first word: `on`, `in`, `and`, `or`, `of`, `the`, `a`, `an`, `to`, `for`, `at`, `by`.
  - Explicit casing exceptions are preserved:
    - Acronym terms like `USB`, `XLR`, `IEC`, `RCA`, `AA`, and `AAA` remain uppercase.
    - Canonical brand words like `iPhone`, `iPad`, `iOS`, and `MacBook` are forced to their standard mixed case.
  - Single-letter connector/type suffix after an acronym remains uppercase (examples: `USB A`, `IEC 13`).
  - If any ALL-CAPS word is detected, the UI asks once on save whether caps words should remain uppercase.
  - If user selects `Yes`, detected caps words stay uppercase.
  - If user selects `No`, those words are normalized into the normal capitalization rule.
  - Admin allow list is editable in the Master screen (comma-separated list) and persists in DB-backed global settings.
  - Master Inventory is the only screen that can edit that allow list through the UI.
  - Allow-list terms are always forced to uppercase (for example: `USB`, `XLR`, `IEC`, `RCA`, `AA`, `AAA`).
  - Measurement abbreviations are normalized to lowercase: `mm`, `cm`, `m`, `km`, `in`, `ft`, `yd`, `mtr`, `ltr`.
  - Number + unit is stored with no extra space: `15 Mtr` → `15mtr`, `1 Ltr` → `1ltr`, `25 Cm` → `25cm`.
  - Standalone abbreviations are also normalized: `Mtr` → `mtr`, `Ltr` → `ltr`, `CM` → `cm`.

- `crew_notes`
  - Uses the same rule set as `description`.
  - Shares the same one-time caps confirmation during save.

- `restock_comments`
  - Uses the same rule set as `description`.
  - Shares the same one-time caps confirmation during save.

- `box_number`
  - Normalized to Title Case.
  - Numbers are preserved as typed.
  - Only letters, numbers, spaces, and hyphens are accepted.
  - Invalid values are rejected on save.
  - Example target format: `Zen Zone 2`.

- `storage_location`
  - Normalized to full UPPER CASE.
  - Multiple spaces are collapsed.
  - Example target format: `ZEN ZONE 2`.

- `event_tags`
  - Normalized to uppercase tokens.
  - Commas are converted to pipe separators.
  - Tokens are stored in canonical pipe format: `|TAG1||TAG2|`.
  - Duplicate tags are removed while preserving first-seen order.
  - Only `A-Z`, `0-9`, underscore, and hyphen are allowed inside each tag token.
  - Invalid tag text is rejected on save.

### Item ID List Admin
- `item_name`
  - Saved in Title Case by default.
  - Small joiner words remain lowercase after the first word: `on`, `in`, `and`, `or`, `of`, `the`, `a`, `an`, `to`, `for`, `at`, `by`.
  - If the whole item name is entered in ALL CAPS, the UI asks whether to keep ALL CAPS.
  - If user selects `Yes`, the ALL-CAPS name is preserved.
  - If user selects `No`, the value is converted to the standard Title Case rule.
  - Measurement abbreviations are normalized to lowercase: `mm`, `cm`, `m`, `km`, `in`, `ft`, `yd`, `mtr`, `ltr`.
  - Number + unit is stored with no extra space: `15 Mtr` → `15mtr`, `1 Ltr` → `1ltr`, `25 Cm` → `25cm`.
  - Standalone abbreviations are also normalized: `Mtr` → `mtr`, `Ltr` → `ltr`, `CM` → `cm`.
  - The global acronym allow list is read-only in this view and is applied automatically.
  - This view cannot edit the list.

## Where applied in code
- Shared rule source
  - `static/global_case_rules.js`

- `static/admin_master_view.js`
  - `normalizeDescriptionCase()`
  - `normalizeEventTagsValue()`
  - `stripBrackets()`
  - `askRequireCaps()`

- `static/admin_item_list_view.js`
  - `askRequireCaps()`

## Current save prompt behavior
- In Admin Master Inventory, caps confirmation is asked once per save click when any of `description`, `crew_notes`, or `restock_comments` contains ALL-CAPS words.
- If `Yes` is selected, typed ALL-CAPS words are preserved in those three fields.
- If `No` is selected, typed ALL-CAPS words are normalized by the standard case rules.
- In Item ID List Admin, caps confirmation is asked when `item_name` is entirely ALL CAPS.

## ItemID Format Constraint

### Item ID Format Rule
- **Format**: `{PREFIX}-{4DIGITS}` (example: `Hi-0001`)
- **Prefix**: Two uppercase letters representing facility/location (e.g., `Hi`, `Pr`, `Gs`)
- **Separator**: Single hyphen `-` between prefix and digits
- **Digits**: Exactly 4 digits, zero-padded (range `0001` to `9999`)
- **Enforcement**: Database-level constraint (unique on item_id column)
- **Examples Valid**: `Hi-0001`, `Pr-0042`, `Gs-9999`
- **Examples Invalid**: `Hi-1`, `hi-0001` (lowercase), `Hi-00001` (5 digits), `Hi_0001` (underscore)

### ItemID Immutability Rule
- **Immutable**: Item_id cannot be modified after creation
- **Unique**: No two items can share the same item_id
- **Reference**: All sync operations, audit trails, and validation logic reference item_id as the authoritative item identifier
- **Constraint Enforcement**: Server rejects any attempt to change item_id; duplicate values rejected on insert
- **History**: Previous 6-digit format (`Hi-000001`) is being phased out. All new items use 4-digit format (`Hi-0001`).

### Where Applied in Code
- `app.py` — API validation on `item_id` format and immutability
- `db.py` — Database schema enforces unique constraint and prevents updates
- `static/admin_item_list_view.js` — UI displays item_id as read-only (no edit field)
- `static/admin_master_view.js` — Item linking uses item_id as the stable reference key