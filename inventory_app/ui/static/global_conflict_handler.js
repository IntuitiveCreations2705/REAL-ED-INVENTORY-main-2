/**
 * global_conflict_handler.js — Satellite sync conflict detection & resolution (Phase 2)
 *
 * Displays and manages conflicts when multiple devices edit overlapping BOX ranges,
 * routes conflicts to Leadership tier for validation and merge decision.
 *
 * Status: PHASE 2 - Reserved foundation module
 * Last Updated: 12-Apr-2026
 */

// ──────────────────────────────────────────────────────────────────────────────
// Conflict State & Constants
// ──────────────────────────────────────────────────────────────────────────────

const CONFLICT_API_BASE = '/api/sync/conflicts';

let conflicts = [];
let conflictResolutions = {};

const CONFLICT_STATUS = {
    DETECTED: 'detected',
    PENDING_REVIEW: 'pending_review',
    RESOLVED: 'resolved',
    DISMISSED: 'dismissed',
};

// ──────────────────────────────────────────────────────────────────────────────
// Conflict Detection & Display
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Initialize conflict warning panel (called during page init in Phase 2).
 *
 * TODO Phase 2: Wire to DOM element with id 'conflict-warning-panel'
 * - Create container for conflict alerts
 * - Wire to Leadership tier for conflict resolution workflow
 * - Only visible if current role is Leadership (Tier 2.2)
 */
export function initConflictWarningPanel() {
    // TODO Phase 2: Implement initialization
    console.log('[Phase 2] Conflict warning panel initialized');
}

/**
 * Detect conflicts when satellite PULL is initiated.
 *
 * Called during sync flow to check if any conflicts exist.
 *
 * TODO Phase 2: Implement conflict detection
 * - GET /api/sync/conflicts?device_id=...
 * - Return array of conflicts
 * - Each conflict: { field, device_a, device_b, value_a, value_b, box_prefix, row_id }
 */
export async function detectConflicts() {
    try {
        // TODO Phase 2: Fetch conflicts from server
        // const res = await fetch(`${CONFLICT_API_BASE}/detect`);
        // const data = await res.json();
        // conflicts = data.conflicts || [];
        return conflicts;
    } catch (err) {
        console.error('[Conflict] Detection failed:', err);
        return [];
    }
}

/**
 * Display conflicts in the warning panel.
 *
 * TODO Phase 2: Implement display logic
 * - For each conflict, show card with:
 *   - Device A edit: value_a
 *   - Device B edit: value_b
 *   - BOX prefix, field name
 * - Show "Review" button → Leadership review workflow
 * - Show "Dismiss" button → Acknowledge and hide
 */
export function displayConflictWarnings(conflictList) {
    // TODO Phase 2: Implement DOM rendering
    conflicts = conflictList || [];

    const panel = document.getElementById('conflict-warning-panel');
    if (!panel) return;

    if (conflicts.length === 0) {
        panel.innerHTML = '';
        panel.style.display = 'none';
        return;
    }

    // TODO Phase 2: Render each conflict card
    // conflictList.forEach(conflict => {
    //   const card = createConflictCard(conflict);
    //   panel.appendChild(card);
    // });

    panel.style.display = 'block';
    console.log('[Conflict] Displayed', conflicts.length, 'conflicts');
}

/**
 * Create a single conflict card component.
 *
 * TODO Phase 2: Implement card UI
 * Shows both values and action buttons (Review / Dismiss)
 */
function createConflictCard(conflict) {
    // TODO Phase 2: Implement card creation
    const card = document.createElement('div');
    card.className = 'conflict-card';
    // TODO Phase 2: Populate with conflict details and action buttons
    return card;
}

// ──────────────────────────────────────────────────────────────────────────────
// Conflict Resolution Workflow
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Route conflict to Leadership review (Tier 2.2).
 *
 * TODO Phase 2: Implement Leadership routing
 * - Open conflict resolution modal
 * - Display both values with device/role context
 * - Provide manual merge options:
 *   1. Accept Device A value
 *   2. Accept Device B value
 *   3. Manual override (Leadership input)
 * - Log decision in audit trail with role_specialization context
 */
export function reviewConflict(conflictId) {
    // TODO Phase 2: Implement review modal
    console.log('[Conflict] Review requested for conflict:', conflictId);
}

/**
 * Accept a conflict resolution decision (Leadership action).
 *
 * TODO Phase 2: Implement conflict resolution
 * - POST to /api/sync/conflicts/{id}/resolve
 * - Include { decision: 'accept_a' | 'accept_b' | 'manual_override', override_value: ... }
 * - Update conflict status to RESOLVED
 * - Log to audit trail with Leadership role_specialization
 */
export async function resolveConflict(conflictId, decision, overrideValue) {
    try {
        // TODO Phase 2: Call backend resolve endpoint
        // const res = await fetch(`${CONFLICT_API_BASE}/${conflictId}/resolve`, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ decision, override_value: overrideValue }),
        // });
        // const data = await res.json();

        conflictResolutions[conflictId] = { decision, overrideValue, resolvedAt: new Date() };
        console.log('[Conflict] Resolved:', conflictId, decision);
    } catch (err) {
        console.error('[Conflict] Resolution failed:', err);
    }
}

/**
 * Dismiss conflict warning (acknowledge but don't resolve).
 *
 * User acknowledges conflict visibility but doesn't take action yet.
 */
export function dismissConflictWarning(conflictId) {
    // TODO Phase 2: Hide conflict card from panel
    console.log('[Conflict] Dismissed:', conflictId);
}

/**
 * Get all unresolved conflicts.
 */
export function getUnresolvedConflicts() {
    return conflicts.filter(c => !conflictResolutions[c.id]);
}

/**
 * Get conflict resolution history.
 */
export function getConflictResolutions() {
    return { ...conflictResolutions };
}

// ──────────────────────────────────────────────────────────────────────────────
// Conflict Prevention (Design-time Enforcement)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Warn user if editing a field that another device is also editing.
 *
 * TODO Phase 2: On field focus/input, check /api/sync/field-locks/{box}/{field}
 * - If another device is currently editing same field → show warning badge
 * - Display device_id and role_specialization of editing device
 */
export function warnFieldConflict(box_prefix, field_name, device_id) {
    // TODO Phase 2: Implement field-level conflict warning
    console.log('[Conflict] Field conflict warning:', {
        box_prefix,
        field_name,
        device_id,
    });
}

/**
 * Release field lock when user leaves the field or saves.
 *
 * TODO Phase 2: POST to /api/sync/field-locks/{box}/{field}/release
 */
export async function releaseFieldLock(box_prefix, field_name) {
    try {
        // TODO Phase 2: Call backend to release lock
        // await fetch(`${CONFLICT_API_BASE}/field-locks/${box_prefix}/${field_name}/release`, {
        //   method: 'POST',
        // });
    } catch (err) {
        console.warn('[Conflict] Field lock release failed:', err);
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Conflict Report (for MOM-L1 diagnostics)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Generate conflict report for MOM console (Tier 0 diagnostics).
 *
 * TODO Phase 2: Call from MOM-L1 Operations Console
 * Returns summary of all conflicts in system, their status, and resolution time
 */
export async function generateConflictReport() {
    try {
        // TODO Phase 2: Fetch comprehensive conflict history
        // const res = await fetch(`${CONFLICT_API_BASE}/report`);
        // return res.json();
        return { total: 0, resolved: 0, pending: 0, conflicts: [] };
    } catch (err) {
        console.error('[Conflict] Report generation failed:', err);
        return null;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Debug / Development Utilities
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Mock conflict for local testing (Phase 2 development).
 */
export function mockConflict(overrides) {
    const mock = {
        id: 'conflict_001',
        status: CONFLICT_STATUS.DETECTED,
        box_prefix: 'R',
        field_name: 'stock_on_hand',
        row_id: 42,
        device_a: 'DEVICE_001',
        device_b: 'DEVICE_002',
        role_a: 'Workshop Mentor',
        role_b: 'Crew Leader',
        value_a: 5,
        value_b: 8,
        detectedAt: new Date().toISOString(),
        ...overrides,
    };

    conflicts = [mock];
    displayConflictWarnings(conflicts);
    console.log('[DEBUG] Mock conflict displayed:', mock);
}

export function debugConflicts() {
    console.log('[DEBUG] Current conflicts:', conflicts);
    console.log('[DEBUG] Resolutions:', conflictResolutions);
}

export function mockResolveAll() {
    conflicts.forEach(c => {
        conflictResolutions[c.id] = { decision: 'auto_resolve', resolvedAt: new Date() };
    });
    displayConflictWarnings([]);
    console.log('[DEBUG] All conflicts auto-resolved');
}
