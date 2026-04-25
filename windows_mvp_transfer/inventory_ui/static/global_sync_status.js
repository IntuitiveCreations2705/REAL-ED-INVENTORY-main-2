/**
 * global_sync_status.js — Satellite sync status indicator (Phase 2)
 *
 * Manages satellite device sync UI: last sync time, pending changes, PULL button,
 * sync status polling, and sync error display.
 *
 * Status: PHASE 2 - Reserved foundation module
 * Last Updated: 12-Apr-2026
 */

// ──────────────────────────────────────────────────────────────────────────────
// Sync Status Constants
// ──────────────────────────────────────────────────────────────────────────────

const SYNC_API_BASE = '/api/sync';
const SYNC_STATUS_CHECK_INTERVAL = 30000; // 30 seconds
const SYNC_TIMEOUT = 60000; // 60 seconds per sync

const SYNC_STATE = {
    IDLE: 'idle',
    SYNCING: 'syncing',
    SUCCESS: 'success',
    ERROR: 'error',
    PENDING: 'pending',
};

// ──────────────────────────────────────────────────────────────────────────────
// Sync Status Tracking
// ──────────────────────────────────────────────────────────────────────────────

let syncStatus = {
    state: SYNC_STATE.IDLE,
    lastSyncTime: null,
    pendingChanges: 0,
    nextCheckTime: null,
    error: null,
    device_id: null,
};

let syncStatusCheckInterval = null;

/**
 * Get current sync status object.
 */
export function getSyncStatus() {
    return { ...syncStatus };
}

/**
 * Update sync status state.
 */
function setSyncStatus(updates) {
    syncStatus = { ...syncStatus, ...updates };
}

// ──────────────────────────────────────────────────────────────────────────────
// Sync Status UI Components
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Initialize sync status indicator UI (called during page init in Phase 2).
 *
 * TODO Phase 2: Wire to DOM element with id 'sync-status-indicator'
 * - Create status display: "Last sync: 2 hours ago | Pending: 3 changes"
 * - Create PULL button (disabled during sync)
 * - Create error message container
 * - Wire event listeners to PULL button
 */
export function initSyncStatusIndicator(device_id) {
    // TODO Phase 2: Implement initialization
    setSyncStatus({ device_id });

    // TODO Phase 2: Find DOM elements
    // const statusEl = document.getElementById('sync-status-indicator');
    // const pullBtn = document.getElementById('sync-pull-btn');
    // if (!pullBtn) return; // Not a satellite device UI

    // TODO Phase 2: Wire PULL button click handler
    // pullBtn.addEventListener('click', handleSyncPull);

    // TODO Phase 2: Start periodic status check
    // startSyncStatusPolling();

    console.log('[Phase 2] Sync status indicator initialized for device:', device_id);
}

/**
 * Handle manual PULL button click (satellite → server sync).
 *
 * TODO Phase 2: Implement sync flow
 * - Disable PULL button
 * - Show "Syncing..." spinner
 * - POST to /api/sync/pull with { device_id }
 * - Wait for Leadership validation
 * - Update status on success or error
 */
export async function handleSyncPull() {
    // TODO Phase 2: Implement pull logic
    const deviceId = syncStatus.device_id;
    if (!deviceId) {
        console.error('Device ID not set; cannot sync');
        return;
    }

    setSyncStatus({ state: SYNC_STATE.SYNCING, error: null });
    updateSyncStatusDisplay();

    try {
        // TODO Phase 2: Call backend sync endpoint
        // const res = await fetch(`${SYNC_API_BASE}/pull`, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ device_id: deviceId }),
        // });
        // const data = await res.json();
        // if (!res.ok) throw new Error(data.error || 'Sync failed');

        setSyncStatus({
            state: SYNC_STATE.SUCCESS,
            lastSyncTime: new Date().toISOString(),
            pendingChanges: 0,
        });
    } catch (err) {
        setSyncStatus({
            state: SYNC_STATE.ERROR,
            error: err.message || 'Sync error',
        });
    }

    updateSyncStatusDisplay();
}

/**
 * Start periodic sync status polling (Phase 2).
 *
 * TODO Phase 2: Call /api/sync/status every 30 seconds to check:
 * - Last sync timestamp
 * - Pending changes count
 * - Any pending conflicts
 */
function startSyncStatusPolling() {
    // TODO Phase 2: Implement polling
    if (syncStatusCheckInterval) clearInterval(syncStatusCheckInterval);

    syncStatusCheckInterval = setInterval(async () => {
        try {
            // TODO Phase 2: Fetch status from server
            // const res = await fetch(`${SYNC_API_BASE}/status?device_id=${syncStatus.device_id}`);
            // const data = await res.json();
            // setSyncStatus({ ...data });
            updateSyncStatusDisplay();
        } catch (err) {
            console.warn('[Sync] Status check failed:', err.message);
        }
    }, SYNC_STATUS_CHECK_INTERVAL);
}

/**
 * Stop sync status polling (on page unload, logout, etc.).
 */
export function stopSyncStatusPolling() {
    if (syncStatusCheckInterval) {
        clearInterval(syncStatusCheckInterval);
        syncStatusCheckInterval = null;
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Sync Status Display
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Update sync status display on DOM.
 *
 * TODO Phase 2: Implement DOM updates
 * - Set status text: "Last sync: X minutes ago"
 * - Set pending count: "Pending changes: N"
 * - Show/hide PULL button based on pending count
 * - Update PULL button disabled state during sync
 * - Display error message if sync failed
 */
function updateSyncStatusDisplay() {
    // TODO Phase 2: Implement display update logic
    const statusEl = document.getElementById('sync-status-indicator');
    if (!statusEl) return;

    const { state, lastSyncTime, pendingChanges, error } = syncStatus;

    // TODO Phase 2: Format last sync time (e.g., "2 hours ago")
    const timeDisplay = lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Never';

    // TODO Phase 2: Set classes for state (idle, syncing, success, error)
    statusEl.className = `sync-status-indicator sync-state-${state}`;

    // TODO Phase 2: Update innerHTML with formatted status
    // statusEl.innerHTML = `
    //   <span class="sync-time">Last sync: ${timeDisplay}</span>
    //   <span class="sync-pending">${pendingChanges} pending</span>
    //   ${error ? `<span class="sync-error">${error}</span>` : ''}
    // `;

    console.log('[Sync] Status display updated:', { state, lastSyncTime, pendingChanges });
}

/**
 * Format sync timestamp to human-readable text.
 *
 * TODO Phase 2: Implement time formatting
 * - Returns "Just now", "5 minutes ago", "2 hours ago", etc.
 */
export function formatSyncTime(isoTimestamp) {
    if (!isoTimestamp) return 'Never synced';
    // TODO Phase 2: Implement relative time formatting
    return new Date(isoTimestamp).toLocaleString();
}

// ──────────────────────────────────────────────────────────────────────────────
// Pending Changes Tracking
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Increment pending changes count (called when row is marked dirty).
 *
 * TODO Phase 2: Called from admin_master_view.js when markRowDirty() is invoked
 */
export function incrementPendingChanges() {
    setSyncStatus({ pendingChanges: syncStatus.pendingChanges + 1 });
    updateSyncStatusDisplay();
}

/**
 * Decrement pending changes count (called on save or undo).
 */
export function decrementPendingChanges() {
    setSyncStatus({
        pendingChanges: Math.max(0, syncStatus.pendingChanges - 1),
    });
    updateSyncStatusDisplay();
}

/**
 * Reset pending changes to zero (after successful sync).
 */
export function resetPendingChanges() {
    setSyncStatus({ pendingChanges: 0 });
    updateSyncStatusDisplay();
}

// ──────────────────────────────────────────────────────────────────────────────
// Sync Conflict Queries
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Fetch pending conflicts from server (Phase 2).
 *
 * TODO Phase 2: GET /api/sync/conflicts?device_id=...
 * Returns array of conflicts for display in conflict warning panel
 */
export async function fetchPendingConflicts() {
    try {
        // TODO Phase 2: Implement conflict fetch
        // const res = await fetch(`${SYNC_API_BASE}/conflicts?device_id=${syncStatus.device_id}`);
        // return res.ok ? res.json() : [];
        return [];
    } catch (err) {
        console.error('[Sync] Conflict fetch failed:', err);
        return [];
    }
}

// ──────────────────────────────────────────────────────────────────────────────
// Debug / Development Utilities
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Mock sync status for local testing (Phase 2 development).
 */
export function mockSyncStatus(overrides) {
    const mock = {
        state: SYNC_STATE.IDLE,
        lastSyncTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        pendingChanges: 3,
        error: null,
        device_id: 'MOCK_DEVICE_001',
        ...overrides,
    };
    setSyncStatus(mock);
    updateSyncStatusDisplay();
    console.log('[DEBUG] Mock sync status set:', mock);
}

export function debugSyncStatus() {
    console.log('[DEBUG] Sync status:', getSyncStatus());
}
