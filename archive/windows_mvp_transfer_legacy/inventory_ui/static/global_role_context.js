/**
 * global_role_context.js — Role & specialization context management (Phase 2)
 *
 * Provides role-aware access control with flexible data allocation framework.
 * Supports multiple allocation strategies: BOX prefix, event-based, device-based,
 * team-based, location-based, and custom patterns.
 *
 * Status: PHASE 2 - Reserved foundation module
 * Last Updated: 12-Apr-2026
 */

// ──────────────────────────────────────────────────────────────────────────────
// Allocation Strategy Framework
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Allocation strategies for data field → role/team/UI routing.
 *
 * Each strategy defines how data is scoped to a role/device/UI.
 * Stage 1 MVP uses BOX prefix; Phase 2 will expand to multi-strategy support.
 *
 * FOUNDATIONAL IMMUTABLE REFERENCE:
 * - item_id: Immutable identifier (primary key). ALL validation, sync, audit trails reference this.
 *            Deletion blocked by database constraint. Everything uses item_id to confirm item correctness.
 * - item_name: Mutable display name. Used for UI selection/search. Governed by item_id.
 */
const ALLOCATION_STRATEGIES = {
    // TODO Phase 2: ITEM_ID_REFERENCE - Implement only after DB cleanup of duplicate item_ids complete
    // ITEM_ID_REFERENCE: 'item_id_reference',   // Foundational: immutable item identifier (DEFERRED — manual DB consolidation required)
    BOX_PREFIX: 'box_prefix',           // Primary key: first char(s) of box_number (team-based)
    EVENT_SCOPE: 'event_scope',         // Event-based: active_event_id
    DEVICE_ID: 'device_id',             // Device allocation
    TEAM_CONTEXT: 'team_context',       // Team/organizational unit
    LOCATION_SCOPE: 'location_scope',   // Storage location based
    ROLE_SPECIALIZATION: 'role_specialization', // Role-specific access rules
    CUSTOM_PATTERN: 'custom_pattern',   // Extensible for future strategies
};

const DEFAULT_STRATEGIES = [
    // TODO Phase 2: ALLOCATION_STRATEGIES.ITEM_ID_REFERENCE will be first priority after DB cleanup
    ALLOCATION_STRATEGIES.BOX_PREFIX,
    ALLOCATION_STRATEGIES.ROLE_SPECIALIZATION,
    ALLOCATION_STRATEGIES.EVENT_SCOPE,
];

// ──────────────────────────────────────────────────────────────────────────────
// Role Context Definitions
// ──────────────────────────────────────────────────────────────────────────────

const TIER_2_SPECIALIZATIONS = [
    'Workshop Mentor',
    'Crew Leader',
    'Project Coordinator',
    'Training Coordinator',
    'Scheduling Coordinator',
    'Task Team Leader',
];

const TIER_2_SUB_TIERS = {
    admin: 'Tier 2.1 — Admin',
    leadership: 'Tier 2.2 — Leadership',
    management: 'Tier 2.3 — Management',
    facilitator: 'Tier 2.4 — Facilitator',
};

// TODO Phase 2: Define cross-team specializations (broader data source access - multiple BOX ranges + future/provisioned data)
const CROSS_TEAM_SPECIALIZATIONS = [
    'Project Coordinator',      // Pulls project data across teams + future project tracking
    'Scheduling Coordinator',   // Pulls schedule/availability data across teams + future slots
];

// TODO Phase 2: Define team-restricted specializations (single-team BOX scope only)
const TEAM_RESTRICTED_SPECIALIZATIONS = [
    'Workshop Mentor',          // Team-specific: BOX prefix only
    'Crew Leader',              // Team-specific: BOX prefix only
    'Task Team Leader',         // Team-specific: BOX prefix only
];

// ──────────────────────────────────────────────────────────────────────────────
// Role Context Storage & Retrieval
// ──────────────────────────────────────────────────────────────────────────────

const ROLE_CONTEXT_KEY = 'app.role_context';

/**
 * Allocation context: flexible data routing configuration.
 *
 * TODO Phase 2: Extend with additional allocation strategies as needed:
 * - event_window: { active_event_id, start_date, end_date }
 * - location_scope: { allowed_locations: ['ZEN ZONE 1', 'ZEN ZONE 2'] }
 * - team_context: { team_id, team_name, org_unit }
 * - custom_patterns: { strategy_name: custom_rule_fn }
 * - cross_team_sources: { data_type: ['project', 'schedule'], tables: [...] } — for Project/Scheduling Coordinators
 * - future_data_tables: { provisioned_tables: [...] } — placeholders for data TBD
 */
let allocationContext = {
    box_prefixes: [],           // Primary: BOX prefix allocation (team-based)
    event_scope: null,          // Event-based allocation (Facilitator, event-scoped edits)
    device_id: null,            // Device identity for sync/conflict tracking
    team_id: null,              // Team organizational context (restricts to single team)
    location_scope: [],         // Location-based data filtering
    role_specialization: null,  // Role specialization (Leadership sub-tier)
    cross_team_sources: {},     // TODO Phase 2: Multi-team data access for Project/Scheduling Coordinators
    future_data_tables: {},     // TODO Phase 2: Placeholder for data provisioned later (project, scheduling, etc.)
    custom_patterns: {},        // Extensible custom allocation rules
};

/**
 * Get current role context from session storage.
 *
 * Returns: { role, role_specialization, allocation_context: {...}, tier, device_id }
 * TODO Phase 2: Wire to auth/session after Phase 2 auth is implemented
 */
export function getRoleContext() {
    // TODO Phase 2: Replace with actual session fetch
    const cached = sessionStorage.getItem(ROLE_CONTEXT_KEY);
    if (!cached) return null;
    try {
        return JSON.parse(cached);
    } catch {
        return null;
    }
}

/**
 * Set role context in session storage (called by auth module in Phase 2).
 */
export function setRoleContext(context) {
    // TODO Phase 2: Validate context schema before storing
    sessionStorage.setItem(ROLE_CONTEXT_KEY, JSON.stringify(context));
}

/**
 * Clear role context on logout (Phase 2).
 */
export function clearRoleContext() {
    sessionStorage.removeItem(ROLE_CONTEXT_KEY);
}

// ──────────────────────────────────────────────────────────────────────────────
// Role-Specific Features
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get valid specializations for current role tier.
 *
 * Tier 2.2 Leadership: returns all specializations
 * Tier 2.3 Management: returns [] (read-only, no specialization)
 * Tier 2.4 Facilitator: returns ['Facilitator']
 */
export function getRoleSpecializations() {
    const context = getRoleContext();
    if (!context) return [];

    switch (context.tier) {
        case 'Tier 2.2 — Leadership':
            return [...TIER_2_SPECIALIZATIONS];
        case 'Tier 2.4 — Facilitator':
            return ['Facilitator'];
        case 'Tier 2.3 — Management':
        default:
            return [];
    }
}

/**
 * Validate if current role has access to data based on flexible allocation strategies.
 *
 * Checks data against multiple allocation strategies in priority order:
 * 1. Role specialization rules (e.g., cross-team vs team-restricted)
 * 2. BOX prefix allocation
 * 3. Event scope (if active)
 * 4. Location scope (if configured)
 * 5. Device-specific allocation
 * 6. Custom patterns (extensible)
 *
 * TODO Phase 2: Implement full multi-strategy validation
 * - Return early on first strategy that denies access
 * - Support partial matches (e.g., cross-team Leadership can read all, edit subset)
 * - Log validation decision for audit trail
 */
export function validateEditScope(data, field_name, role_specialization) {
    // TODO Phase 2: Server-side validation; this is UX-only hint
    const context = getRoleContext();
    if (!context) return { allowed: false, reason: 'No role context' };

    const allocation = context.allocation_context || {};

    // TODO Phase 2: Multi-strategy validation
    // 1. Check role_specialization rules
    const specialization_check = validateSpecializationScope(data, role_specialization);
    if (!specialization_check.allowed) return specialization_check;

    // 2. Check BOX prefix allocation
    if (allocation.box_prefixes && allocation.box_prefixes.length > 0) {
        const box_check = validateBoxPrefixScope(data.box_number, allocation.box_prefixes);
        if (!box_check.allowed) return box_check;
    }

    // 3. Check event scope (if active)
    if (allocation.event_scope) {
        const event_check = validateEventScope(data, allocation.event_scope);
        if (!event_check.allowed) return event_check;
    }

    // 4. Check location scope (if configured)
    if (allocation.location_scope && allocation.location_scope.length > 0) {
        const location_check = validateLocationScope(data.storage_location, allocation.location_scope);
        if (!location_check.allowed) return location_check;
    }

    // 5. Check device allocation (satellite devices)
    if (allocation.device_id) {
        const device_check = validateDeviceAllocation(data, allocation.device_id);
        if (!device_check.allowed) return device_check;
    }

    // 6. Check custom patterns (extensible)
    if (allocation.custom_patterns && Object.keys(allocation.custom_patterns).length > 0) {
        const custom_check = validateCustomPatterns(data, allocation.custom_patterns);
        if (!custom_check.allowed) return custom_check;
    }

    return { allowed: true, reason: '' };
}

/**
 * Validate edit scope based on role specialization rules.
 *
 * TODO Phase 2: Implement specialization-specific logic
 * 
 * Team-Restricted (BOX prefix only):
 * - Workshop Mentor: team-specific resources only, single BOX prefix
 * - Crew Leader: team coordination, single BOX prefix
 * - Task Team Leader: team-specific tasks, single BOX prefix
 *
 * Cross-Team (Multiple BOX + Future Data):
 * - Project Coordinator: aggregate data across multiple team BOX ranges + future project DB (TBD)
 * - Scheduling Coordinator: availability across teams + future scheduling slots (TBD)
 *
 * TODO Phase 2: Define cross-team data source endpoints:
 * - Project data: new table or external source TBD
 * - Scheduling slots: new table or calendar integration TBD
 */
function validateSpecializationScope(data, specialization) {
    // TODO Phase 2: Implement specialization validation
    if (!specialization) return { allowed: true, reason: '' };

    // Team-restricted: single BOX only
    if (TEAM_RESTRICTED_SPECIALIZATIONS.includes(specialization)) {
        // TODO Phase 2: Check data.box_number against single allowed prefix
        return { allowed: true, reason: '' };
    }

    // Cross-team: multiple BOX + future data sources
    if (CROSS_TEAM_SPECIALIZATIONS.includes(specialization)) {
        // TODO Phase 2: Check data source type + validate access to multiple team BOX ranges
        // TODO Phase 2: Validate cross-team data tables (project, scheduling, etc.) when available
        return { allowed: true, reason: '' };
    }

    return { allowed: true, reason: '' };
}

/**
 * Validate BOX prefix allocation (Stage 1 primary strategy).
 */
function validateBoxPrefixScope(box_number, allowed_prefixes) {
    if (!box_number || allowed_prefixes.length === 0) return { allowed: true, reason: '' };

    const box_prefix = String(box_number).charAt(0).toUpperCase();
    const allowed = allowed_prefixes.some(p =>
        String(p).toUpperCase().startsWith(box_prefix)
    );

    return {
        allowed,
        reason: allowed ? '' : `BOX prefix '${box_prefix}' not in allowed: ${allowed_prefixes.join(', ')}`,
    };
}

/**
 * Validate event-scoped allocation (Facilitator sub-tier).
 *
 * TODO Phase 2: Implement event scope validation
 * - Check if data is linked to active event
 * - Restrict edits outside event window
 * - Allow cross-event viewing (read-only) for Leadership
 */
function validateEventScope(data, event_scope) {
    // TODO Phase 2: Event validation logic
    return { allowed: true, reason: '' };
}

/**
 * Validate location-based allocation.
 *
 * TODO Phase 2: Implement location scope validation
 * - Some roles may be restricted to specific locations
 * - Some data may be location-tagged
 */
function validateLocationScope(location, allowed_locations) {
    if (!location || allowed_locations.length === 0) return { allowed: true, reason: '' };

    const allowed = allowed_locations.some(l =>
        String(location).toUpperCase() === String(l).toUpperCase()
    );

    return {
        allowed,
        reason: allowed ? '' : `Location '${location}' not in allowed: ${allowed_locations.join(', ')}`,
    };
}

/**
 * Validate device-specific allocation (satellite sync).
 *
 * TODO Phase 2: Implement device allocation validation
 * - Non-overlapping edit enforcement
 * - Device can only edit its assigned scope
 */
function validateDeviceAllocation(data, device_id) {
    // TODO Phase 2: Device validation logic
    return { allowed: true, reason: '' };
}

/**
 * Validate custom allocation patterns (extensible).
 *
 * TODO Phase 2: Support custom validation functions
 * - Allow teams to define custom allocation rules
 * - Called before standard validation
 */
function validateCustomPatterns(data, custom_patterns) {
    // TODO Phase 2: Custom pattern validation
    return { allowed: true, reason: '' };
}

/**
 * Get items scoped to current role's allocation context.
 *
 * TODO Phase 2: Filter items list by multiple strategies:
 * - BOX prefix allocation: return items in allocated prefixes
 * - Event scope: return items linked to active event
 * - Location scope: return items in allowed locations
 * - Team context: return team-specific items
 * - Cross-team roles: return all items with team labels
 * - If Management: return all items (read-only)
 *
 * Combines filters using AND logic (all must pass).
 */
export function getRoleScopedItems(allItems) {
    // TODO Phase 2: Implement multi-filter logic
    const context = getRoleContext();
    if (!context) return allItems;

    const allocation = context.allocation_context || {};

    let filtered = [...allItems];

    // Apply BOX prefix filter
    if (allocation.box_prefixes && allocation.box_prefixes.length > 0) {
        filtered = filtered.filter(item =>
            allocation.box_prefixes.some(p =>
                String(item.box_number || '').toUpperCase().startsWith(String(p).toUpperCase())
            )
        );
    }

    // Apply location filter
    if (allocation.location_scope && allocation.location_scope.length > 0) {
        filtered = filtered.filter(item =>
            allocation.location_scope.some(l =>
                String(item.storage_location || '').toUpperCase() === String(l).toUpperCase()
            )
        );
    }

    // TODO Phase 2: Apply event scope filter
    // if (allocation.event_scope) { ... }

    // TODO Phase 2: Apply team context filter
    // if (allocation.team_id) { ... }

    // TODO Phase 2: Apply custom pattern filters
    // for (const [pattern_name, pattern_fn] of Object.entries(allocation.custom_patterns || {})) { ... }

    return filtered;
}

/**
 * Check if current role can switch to a different specialization.
 *
 * TODO Phase 2: Call auth API to check if user is assigned multiple specializations
 */
export function canSwitchSpecialization(targetSpecialization) {
    // TODO Phase 2: Validate against user's assigned specializations
    return false;
}

// ──────────────────────────────────────────────────────────────────────────────
// Facilitator-Specific Features (Tier 2.4)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Validate if Facilitator role is within active event window.
 *
 * Returns: { in_window: bool, event_dates: { start, end }, message: str }
 *
 * TODO Phase 2: Implement event-window detection
 * - Fetch active event from master DB
 * - Compare current timestamp to event.start_date and event.end_date
 * - Return in_window = true only during active event
 * - If outside window, disable all edits, show warning
 */
export function validateFacilitatorEventWindow() {
    // TODO Phase 2: Wire to event API
    return {
        in_window: false,
        event_dates: { start: null, end: null },
        message: 'No active event found. Facilitator edits disabled outside event windows.',
    };
}

/**
 * Hide/show Facilitator UI sections based on event window.
 *
 * TODO Phase 2: Query DOM for sections with class 'facilitator-only'
 * and apply 'disabled' / 'hidden' states based on event window
 */
export function applyFacilitatorWindowRestrictions() {
    // TODO Phase 2: Implement DOM manipulation
}

// ──────────────────────────────────────────────────────────────────────────────
// Initialization Hook
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Initialize role context on page load (called by each UI module in Phase 2).
 *
 * TODO Phase 2: Call from admin_master_view.js, event_stock_count.js, etc.
 * - Fetch role context from session/auth
 * - Validate allocation context against multiple strategies
 * - Apply role-specific UI restrictions
 * - Wire allocation context to all API requests (via headers or body)
 * - Enable custom pattern registration (extensibility)
 */
export function initRoleContext() {
    // TODO Phase 2: Implement initialization
    console.log('[Phase 2] Role context initialization placeholder');
    console.log('[Phase 2] Supported allocation strategies:', DEFAULT_STRATEGIES);
}

/**
 * Register a custom allocation pattern (extensible for Phase 2).
 *
 * Allows UIs to define custom validation/filtering logic beyond standard strategies.
 *
 * Example:
 *   registerCustomPattern('workshop_resource_tag', (data) => {
 *     return data.tags && data.tags.includes('workshop');
 *   });
 *
 * TODO Phase 2: Integrate with multi-strategy validation
 */
export function registerCustomPattern(pattern_name, validation_fn) {
    allocationContext.custom_patterns[pattern_name] = validation_fn;
    console.log(`[Phase 2] Registered custom allocation pattern: ${pattern_name}`);
}

/**
 * Update allocation context for current session (Phase 2).
 *
 * Called after role change or allocation refresh.
 */
export function updateAllocationContext(updates) {
    allocationContext = { ...allocationContext, ...updates };
    console.log('[Phase 2] Allocation context updated:', allocationContext);
}

/**
 * Get current allocation context.
 */
export function getAllocationContext() {
    return { ...allocationContext };
}

// ──────────────────────────────────────────────────────────────────────────────
// Debug / Development Utilities
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Mock role context for local testing (Phase 2 development).
 *
 * Supports flexible allocation strategy configuration.
 */
export function mockRoleContext(tier, specialization, allocationConfig = {}) {
    const context = {
        role: tier.includes('2.1') ? 'Admin' : tier.includes('2.2') ? 'Leadership' : 'Other',
        role_specialization: specialization || 'Mock Specialist',
        allocation_context: {
            box_prefixes: allocationConfig.box_prefixes || ['A', 'B', 'C'],
            event_scope: allocationConfig.event_scope || null,
            device_id: allocationConfig.device_id || 'MOCK_DEVICE_001',
            team_id: allocationConfig.team_id || 'MOCK_TEAM_001',
            location_scope: allocationConfig.location_scope || [],
            role_specialization: specialization,
            custom_patterns: allocationConfig.custom_patterns || {},
        },
        device_id: allocationConfig.device_id || 'MOCK_DEVICE_001',
        tier,
    };
    setRoleContext(context);
    console.log('[DEBUG] Mock role context set:', context);
}

export function debugRoleContext() {
    const ctx = getRoleContext();
    console.log('[DEBUG] Current role context:', ctx);
    console.log('[DEBUG] Allocation context:', getAllocationContext());
    return ctx;
}
