# Phase 2 Global Template Placeholders

**Project Stage**: Stage 1 - Dev Inventory System  
**Purpose**: Document reserved UI sections for Phase 2 Leadership & Team UI provisioning  
**Allocation Framework**: Multi-strategy data routing (BOX prefix, event-scope, device, team, location, custom)  
**Last Updated**: 12-Apr-2026

## Overview

Global UI templates and foundation files contain marked reserved sections for Phase 2 implementation. These placeholders are intentionally left blank to:
- Maintain clean Stage 1 UI without premature complexity
- Ensure rapid Phase 2 rollout with pre-allocated DOM/CSS structure
- Prevent merge conflicts when multiple sub-tier UIs are provisioned
- Enable configuration-driven Phase 2 features without restructuring

---

## Placeholder Locations & Phase 2 Usage

### 1. Admin Master View Header
**File**: `templates/admin_master_view.html` (lines ~16–19)  
**Current State**: Comment block reserved  
**Phase 2 Usage**: Role selector / scope indicator badge

```html
<!-- [ PHASE 2 RESERVED ] Role selector / scope indicator badge will be inserted here -->
<!-- Use this space for: Tier 2.2 role specialization selector, device/BOX scope display -->
```

**Implementation Goals**:
- Display active Tier 2.2 Leadership role specialization: Workshop Mentor | Crew Leader | Project Coordinator | Training Coordinator | Scheduling Coordinator | Task Team Leader
- Display Tier 2.3 Management (read-only) or Tier 2.4 Facilitator (event-scoped) if applicable
- Show current BOX prefix scope for the logged-in user's role specialization
- Enable role switching if user holds multiple specializations within Tier 2.2
- Facilitate event-scoped window detection for Facilitator sub-tier (active event dates)

**Acceptance Criteria**:
- [ ] Role selector populated from session/auth context with valid specialization list
- [ ] BOX prefix scope badge updated on role change (immutable during session)
- [ ] Facilitator role triggers event-date window validation (hide UI outside active event)
- [ ] Leadership validation gate triggered for role-scoped changes
- [ ] Role context injected into all subsequent API requests

---

### 2. Admin Master Conflict Warning Panel
**File**: `templates/admin_master_view.html` (lines ~73–77)  
**Current State**: Comment block reserved  
**Phase 2 Usage**: Satellite sync conflict indicators

```html
<!-- [ PHASE 2 RESERVED ] Conflict warning panel will be inserted here -->
<!-- Use this space for: Satellite sync conflict indicators, device edit overlap warnings -->
```

**Implementation Goals**:
- Display warnings when satellite devices edit overlapping BOX ranges
- Show pending conflict resolutions awaiting Leadership approval
- Link to conflict resolution workflow in Leadership tier

**Acceptance Criteria**:
- [ ] Conflict warnings displayed only for relevant Leadership sub-tier
- [ ] Warnings suppressed once conflict resolved
- [ ] Audit trail includes conflict warning events

---

### 3. Event Stock Count Sync Status
**File**: `templates/event_stock_count.html` (lines ~15–18)  
**Current State**: Comment block reserved  
**Phase 2 Usage**: Satellite sync status indicator

```html
<!-- [ PHASE 2 RESERVED ] Satellite sync status indicator will be inserted here -->
<!-- Use this space for: Last sync time, pending changes count, pull/push button -->
```

**Implementation Goals**:
- Display last sync timestamp (for Tier 3 devices)
- Show count of pending changes awaiting Leadership approval
- Provide manual "PULL" button for satellite sync initiation

**Acceptance Criteria**:
- [ ] Sync status only visible for Tier 3.1 (Crew) sub-tier
- [ ] Timestamp updates after successful sync
- [ ] PULL button disabled during sync operation
- [ ] Pending count accurate after each change

---

### 4. Event Stock Count Device Scope Badge
**File**: `templates/event_stock_count.html` (lines ~65–68)  
**Current State**: Comment block reserved  
**Phase 2 Usage**: Satellite device scope indicator

```html
<!-- [ PHASE 2 RESERVED ] Satellite device scope indicator will be inserted here -->
<!-- Use this space for: Device BOX prefix assignment badge, last sync timestamp -->
```

**Implementation Goals**:
- Display device_id and assigned BOX prefix range
- Show device isolation status (confirmation of safe edit scope)
- Display sync checkpoint timestamp for changed-records tracking

**Acceptance Criteria**:
- [ ] BOX prefix scope immutable during active session
- [ ] Device_id visible in audit logs for all changes
- [ ] Scope badge refreshes after successful sync

---

### 5. Item List Catalog Scope Filter
**File**: `templates/admin_item_list_view.html` (lines ~11–14)  
**Current State**: Comment block reserved  
**Phase 2 Usage**: Team/role-specific item visibility

```html
<!-- [ PHASE 2 RESERVED ] Item catalog scope filter will be inserted here -->
<!-- Use this space for: Team/role-specific item visibility controls, catalog filtering -->
```

**Implementation Goals**:
- Filter item catalog by assigned BOX prefix(es) per role specialization
- Project Coordinator + Scheduling Coordinator may view cross-team items (broader scope)
- Workshop Mentor, Crew Leader, Task Team Leader restricted to team-specific prefixes
- Restrict item creation to assigned team scope

**Acceptance Criteria**:
- [ ] Item list reflects user's role specialization BOX prefix scope
- [ ] Cross-team viewers (Project/Scheduling Coordinator) see full scope with team labels
- [ ] Unscoped items display read-only badge with team affiliation
- [ ] Item creation gated to assigned prefixes only (Tier 2.2+)
- [ ] Tier 2.3 (Management) sees full catalog in read-only mode

---

## CSS Placeholder Sections (Reserved in Global Theme)

### File: `static/admin_theme.css`

The following CSS class names are reserved for Phase 2 features and should NOT be used for Stage 1 unrelated components:

- `.role-selector` — Role specialization dropdown styling
- `.scope-badge` — BOX prefix scope display styling
- `.sync-status-indicator` — Last sync time + pending count styling
- `.conflict-warning-panel` — Conflict alert styling
- `.device-scope-badge` — Device isolation confirmation styling
- `.box-prefix-filter` — Item catalog filter styling

**Guidelines**:
- Define these classes in Phase 2 only
- Do not inline styles; use global theme file
- Ensure responsive behavior for tablet viewports (minimum Tier 3 device support)

---

## JavaScript Placeholder Functions (Reserved in Foundation)

### File: `static/global_role_context.js` — Multi-Strategy Allocation Framework

Reserved function signatures and constants for flexible data routing:

```javascript
/* Phase 2: Role & Device Context Module with Flexible Allocation Strategies */

// Allocation strategy constants
const ALLOCATION_STRATEGIES = {
  BOX_PREFIX: 'box_prefix',              // Primary: BOX number prefix (Stage 1)
  EVENT_SCOPE: 'event_scope',            // Event-based allocation (Facilitator)
  DEVICE_ID: 'device_id',                // Device-specific scope (satellite sync)
  TEAM_CONTEXT: 'team_context',          // Organizational team allocation
  LOCATION_SCOPE: 'location_scope',      // Storage location-based
  ROLE_SPECIALIZATION: 'role_specialization', // Role-specific rules
  CUSTOM_PATTERN: 'custom_pattern',      // Extensible custom rules
};

// Core functions
function getRoleContext() // Return { role, role_specialization, allocation_context: {...}, device_id, tier }
function getAllocationContext() // Return { box_prefixes, event_scope, device_id, team_id, location_scope, custom_patterns }
function updateAllocationContext(updates) // Update allocation config dynamically
function validateEditScope(data, field_name, role_specialization) // Multi-strategy validation
function getRoleScopedItems(allItems) // Filter by all active allocation strategies
function registerCustomPattern(pattern_name, validation_fn) // Extensible custom rules

// Facilitator-specific
function validateFacilitatorEventWindow() // Return { in_window: bool, event_dates: {...} }

// Debug utilities
function mockRoleContext(tier, specialization, allocationConfig) // Test with custom config
function debugRoleContext() // Log current context + allocation
```

**Implementation Notes**:
- Multiple allocation strategies work together (AND logic — all must pass)
- BOX prefix is primary for Stage 1; others enabled in Phase 2
- `registerCustomPattern()` allows teams to extend validation logic
- `allocation_context` is extensible: add new fields as strategies emerge
- All validation is server-side enforced; UI constraints are UX guidance only

---

## Phase 2 Implementation Checklist

### Multi-Strategy Allocation Framework
- [ ] Activate BOX prefix validation (primary Stage 1 strategy)
- [ ] Implement event-scope validation (Facilitator event-window)
- [ ] Implement team_context allocation (organizational units)
- [ ] Implement location_scope filtering (storage location-based)
- [ ] Implement device_id allocation (non-overlapping satellite sync)
- [ ] Wire custom_patterns registration (extensibility for future teams)

### For Leadership Sub-tier UIs:
- [ ] Populate role selector from Tier 2.2 specialization list
- [ ] Add role context to all API requests
- [ ] Implement conflict warning panel with manual merge workflow
- [ ] Wire Leadership approval gate for satellite sync pulls

### For Crew / Operations UIs (Tier 3):
- [ ] Display device scope badge on page load
- [ ] Implement manual PULL button for satellite sync
- [ ] Show last sync time + pending change count
- [ ] Restrict edits to device's allocated BOX prefix range

### For Item List UI:
- [ ] Filter catalog by user's BOX prefix scope
- [ ] Add read-only badge for out-of-scope items
- [ ] Gate item creation to Leadership-approved prefixes

---

## Maintenance Notes

- **Do not delete** reserved sections; they are part of the architecture foundation
- **Add comments** above each placeholder if requirements change
- **Update this file** when Phase 2 implementation begins
- **Link Phase 2 PRs** to this document for traceability

---

## Contact & Escalation

If conflicts arise during Phase 2 provisioning:
1. Refer to [TIER_ARCHITECTURE_DECISION.md](TIER_ARCHITECTURE_DECISION.md) for tier definitions
2. Check [MVP_ACTION_PROCEDURE.md](MVP_ACTION_PROCEDURE.md) for build order
3. Escalate to MOM-L2 for BOX prefix assignment conflicts
