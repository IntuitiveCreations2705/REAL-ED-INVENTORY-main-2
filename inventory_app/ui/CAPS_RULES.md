# CAPS / Case Rules

Reference note for where capitalization rules are enforced in the admin UI and what each rule is intended to do.

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
  - If any ALL-CAPS word is detected, the UI asks once on save whether caps words should remain uppercase.
  - If user selects `Yes`, detected caps words stay uppercase.
  - If user selects `No`, those words are normalized into the normal capitalization rule.
  - Measurement units are normalized to lowercase with no extra space when matched: `mm`, `cm`, `m`, `km`, `in`, `ft`, `yd`.

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
  - Measurement units are normalized to lowercase with no extra space when matched: `mm`, `cm`, `m`, `km`, `in`, `ft`, `yd`.

## Where applied in code
- `static/admin_master_view.js`
  - `normalizeDescriptionCase()`
  - `normalizeCatalogLabel()`
  - `normalizeLocationLabel()`
  - `normalizeEventTagsValue()`
  - `normalizeMeasurementText()`
  - `stripBrackets()`
  - `askRequireCaps()`

- `static/admin_item_list_view.js`
  - `toTitleCaseWithJoiners()`
  - `normalizeMeasurementText()`
  - `isAllCapsText()`
  - `askRequireCaps()`

## Current save prompt behavior
- In Admin Master Inventory, caps confirmation is asked once per save click when any of `description`, `crew_notes`, or `restock_comments` contains ALL-CAPS words.
- In Item ID List Admin, caps confirmation is asked when `item_name` is entirely ALL CAPS.