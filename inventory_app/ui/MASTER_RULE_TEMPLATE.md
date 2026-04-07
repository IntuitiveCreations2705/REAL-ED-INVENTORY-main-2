# Master Rule Template

Use this template before adding or changing any future text rule.

## Purpose
This template turns a business idea into a rule that can be applied consistently across the app.

## Current global rule source
- Shared UI rule module: [static/global_case_rules.js](static/global_case_rules.js)
- Master Inventory screen: [static/admin_master_view.js](static/admin_master_view.js)
- Item ID List screen: [static/admin_item_list_view.js](static/admin_item_list_view.js)
- Reference notes: [CAPS_RULES.md](CAPS_RULES.md)

## Rule design template

### 1. Rule name
- Short name:
- Business reason:

### 2. Scope
- Screen(s):
- Field(s):
- Applies on:
  - save
  - display
  - search
  - import
  - export

### 3. Input → Output examples
- Example 1:
  - input:
  - saved result:
- Example 2:
  - input:
  - saved result:
- Example 3:
  - input:
  - saved result:

### 4. Base behavior
- What should happen most of the time?
- What should never happen?

### 5. Exceptions
- Known exception values:
- Temporary exceptions:
- Future exceptions allowed later: Yes / No

### 6. Conflict / overlap check
- Does this overlap with an existing acronym rule?
- Does this overlap with measurement formatting?
- Does this overlap with brand/canonical casing?
- If overlap exists, which rule wins?

### 7. Priority
Choose one:
- Hard field-specific exception
- Admin allow-list uppercase exception
- Canonical brand casing
- Measurement normalization
- Acronym single-letter suffix rule
- Generic title case / joiner rule

### 8. Admin editability
- Can Admin change this without code? Yes / No
- If Yes, where?
- If No, why not?

### 9. Validation check
- How do we test success?
- Which sample rows should be checked?
- What would count as a bad result?

### 10. Rollback safety
- If this rule causes damage, how do we reverse it?
- Is a database backup needed before applying bulk fixes?

## Current precedence order
1. Field-specific exception
2. Admin allow list uppercase terms
3. Canonical brand words
4. Measurement normalization
5. Acronym with single-letter suffix
6. Generic title case with joiners

## Admin allow list in the global system
- The Admin Acronym Allow List remains available in Master Inventory.
- It now feeds the shared UI rule module, so both admin screens use the same allow-list logic.
- Only Master Inventory can edit the list through the UI.
- Other views are read-only and apply the same list automatically.
- The list is stored in DB-backed global settings and is shared across users/devices.
- Backend API endpoints now provide list read/update/reset operations for this rule.

## Example completed rule
### Rule name
- Short name: JBL uppercase
- Business reason: speaker brand acronym should remain readable and standard

### Scope
- Screen(s): Master Inventory, Item ID List
- Field(s): description, crew_notes, restock_comments, item_name
- Applies on: save

### Input → Output examples
- `jbl speaker` → `JBL Speaker`
- `JBL cable` → `JBL Cable`
- `jBl` → `JBL`

### Base behavior
- `JBL` always stays uppercase.

### Exceptions
- None initially.

### Conflict / overlap check
- Does not conflict with measurement rules.
- Does not conflict with canonical Apple casing.

### Priority
- Admin allow-list uppercase exception

### Admin editability
- Yes
- Add `JBL` in the Admin Acronym Allow List

### Validation check
- Save rows containing `jbl`, `JBL`, and `Jbl`
- Confirm saved output is always `JBL`
