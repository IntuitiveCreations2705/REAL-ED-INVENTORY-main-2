# Sync API Plan (Phase 1)

## Overview

Resilience-first sync strategy with fixed short delay (5–10s configurable), manual override always allowed, explicit trust states for UX, and comprehensive audit logging.

**Goal**: "Slightly slower system that is resilient, stable, and reliably serves live db status to users allowing for strategic push/pull delays for avoiding those horror cross over potentials."

---

## API Endpoints

### GET /api/sync/status

**Purpose**: Retrieve current sync state snapshot for UI status badge and conflict/delay indicators.

**Request**:
```
GET /api/sync/status
Content-Type: application/json
```

**Response (200 OK)**:
```json
{
  "last_pull_at": 1719432000.123,
  "last_push_at": 1719432010.456,
  "last_success_at": 1719432010.456,
  "pull_queue_count": 0,
  "push_queue_count": 0,
  "delay_ms_remaining": 4200,
  "trust_state": "success",
  "conflict_detected": false,
  "last_error": null,
  "pending_pulls": [],
  "pending_pushes": []
}
```

**Trust States**:
- `waiting` — No sync attempted yet
- `syncing` — Pull/push in progress (lock held)
- `success` — Last pull/push completed without conflicts
- `delayed` — Next sync delayed; user can retry with `force_now_bypass=true`
- `failed` — Last operation failed (see `last_error`)
- `conflict` — Merge conflict detected during pull (manual resolution required)

**UI Rendering**:
- **Green badge** if `trust_state === "success"`
- **Orange badge** if `trust_state === "delayed"` (show countdown from `delay_ms_remaining`)
- **Red badge** if `trust_state === "conflict"` (show "Merge conflict - manual resolution required")
- **Gray badge** if `trust_state === "failed"` (show `last_error` tooltip)
- **Blue badge** if `trust_state === "syncing"` (show spinner)

---

### POST /api/sync/pull

**Purpose**: Manual git pull with fixed delay respect and conflict detection.

**Request**:
```json
{
  "force_now_bypass": false,
  "respect_conflict_check": true,
  "user_id": "alice@company.com"
}
```

**Parameters**:
- `force_now_bypass` (bool, optional): If `true`, ignore delay (manual override always allowed). Audit logs as "override". Default: `false`.
- `respect_conflict_check` (bool, optional): If `true`, return 409 on merge conflict. Default: `true`.
- `user_id` (str, optional): User making request (for audit trail). Default: "system".

**Response (200 OK – Success)**:
```json
{
  "status": "success",
  "message": "Pull completed successfully.",
  "git_returncode": 0,
  "git_output": "Already up to date.\n",
  "conflict_detected": false,
  "delay_respected": true,
  "queue_position": 0
}
```

**Response (202 Queued)**:
```json
{
  "status": "delayed",
  "message": "Pull delayed. Waiting 5000ms before next sync.",
  "delay_ms": 5000,
  "queue_position": 1
}
```

**Response (409 Conflict)**:
```json
{
  "status": "conflict",
  "message": "Merge conflict detected. Manual resolution required.",
  "git_returncode": 1,
  "git_output": "CONFLICT (content): Merge conflict in inventory_app/db.py\n...",
  "conflict_detected": true,
  "delay_respected": true,
  "queue_position": 0
}
```

**Response (400 Queue Full)**:
```json
{
  "status": "queued",
  "message": "Pull queue full (3). Rejecting.",
  "queue_position": 4
}
```

**Response (500 Error)**:
```json
{
  "status": "error",
  "message": "Pull failed: fatal: repository not found\n",
  "git_returncode": 128,
  "git_output": "fatal: repository not found\n",
  "conflict_detected": false,
  "delay_respected": true,
  "queue_position": 0
}
```

---

### POST /api/sync/push

**Purpose**: Explicit git push with delay respect and audit logging.

**Request**:
```json
{
  "force_now_bypass": false,
  "user_id": "alice@company.com"
}
```

**Parameters**:
- `force_now_bypass` (bool, optional): If `true`, ignore delay. Default: `false`.
- `user_id` (str, optional): User making request (for audit trail). Default: "system".

**Response (200 OK – Success)**:
```json
{
  "status": "success",
  "message": "Push completed successfully.",
  "git_returncode": 0,
  "git_output": "To https://github.com/IntuitiveCreations2705/REAL-ED-INVENTORY-main.git\n   048d3b0..9e4f0c1  main -> main\n",
  "delay_respected": true,
  "queue_position": 0
}
```

**Response (202 Delayed)**:
```json
{
  "status": "delayed",
  "message": "Push delayed. Waiting 5000ms before next sync.",
  "delay_ms": 5000,
  "queue_position": 1
}
```

**Response (400 Queue Full)**:
```json
{
  "status": "queued",
  "message": "Push queue full (3). Rejecting.",
  "queue_position": 4
}
```

**Response (500 Error)**:
```json
{
  "status": "error",
  "message": "Push failed: Updates were rejected because the remote contains work...\n",
  "git_returncode": 1,
  "git_output": "To https://github.com/...\n ! [rejected]        main -> main (fetch first)\n",
  "delay_respected": true,
  "queue_position": 0
}
```

---

## Audit Logging

**Phase 1 Implementation**:
All sync operations logged to `stderr` in JSON format as `SYNC_AUDIT:` records. Example:
```
SYNC_AUDIT: {'action': 'sync_pull', 'status': 'success', 'trigger_mode': 'override', 'conflict_detected': False, 'git_returncode': 0, 'user_id': 'alice@company.com', 'timestamp': '2026-05-27T14:32:00.123456+00:00'}
```

**Phase 2 Integration**:
Migrate to persistent `audit_log` table with connection context via `audit.write_audit()`.

**Audit Events**:
- `sync_pull_rejected` — Queue full
- `sync_pull_delayed` — Waiting for delay
- `sync_pull` — Pull attempted (success|conflict|error)
- `sync_push_rejected` — Queue full
- `sync_push_delayed` — Waiting for delay
- `sync_push` — Push attempted (success|error)

---

## Configuration

**Environment Variables** (read from `.env` or `.env.example`):

```bash
# Minimum milliseconds between automatic syncs (manual always allowed)
# Default: 5000 (5 seconds)
INVENTORY_SYNC_DELAY_MS=5000

# Maximum pending pull/push operations before rejection
# Default: 3
INVENTORY_SYNC_MAX_QUEUED=3

# Path to repo-main (used by scheduler for git commands)
# Default: /Volumes/2000 MASTER/MASTER INVENTORY FOLDER/GITHUB REPOSITORY/repo-main
INVENTORY_RUNTIME_ROOT=/path/to/repo-main
```

---

## Delay Behavior

**Fixed Delay Model**:
- After successful pull or push, a delay of `INVENTORY_SYNC_DELAY_MS` (default 5s) is enforced before the next automatic sync.
- Manual calls with `force_now_bypass=true` bypass this delay (always allowed for user agency).
- Calls that hit the delay are rejected with status code `202` and a countdown in `delay_ms_remaining`.

**Queuing**:
- If more than `INVENTORY_SYNC_MAX_QUEUED` (default 3) operations are pending, new requests are rejected.
- Queue position returned in response for observability.

---

## Conflict Detection

**Git Patterns Detected**:
- `CONFLICT` (case-insensitive)
- `merge conflict`
- `both added`
- `both modified`
- `deleted by us`
- `deleted by them`

**User Action on Conflict**:
1. UI renders red badge with "Merge conflict - manual resolution required"
2. User must manually resolve conflict in repo-main, commit, and push
3. After resolution, retry `POST /api/sync/pull` or `POST /api/sync/push`
4. If `respect_conflict_check=false`, pull proceeds even with conflict (not recommended)

---

## Response Codes

| Code | Scenario |
|------|----------|
| 200 | Success (pull/push completed or status retrieved) |
| 202 | Delayed (operation queued due to delay interval) |
| 400 | Queue full or invalid request |
| 409 | Merge conflict detected (pull only) |
| 500 | Git command error |

---

## UI Integration

**Status Badge Polling** (every 5 seconds from client):
```javascript
async function pollSyncStatus() {
  const res = await fetch('/api/sync/status');
  const state = await res.json();
  renderStatusBadge(state);
}
```

**Manual Pull Button**:
```javascript
async function manualPull(forceNow = false) {
  const res = await fetch('/api/sync/pull', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ force_now_bypass: forceNow })
  });
  const result = await res.json();
  if (res.status === 409) {
    showConflictModal(result.message);
  } else if (res.status === 202) {
    showDelayedNotification(result.delay_ms);
  }
}
```

---

## Testing Checklist

- [ ] GET /api/sync/status returns expected fields
- [ ] POST /api/sync/pull respects delay (returns 202 on second call within 5s)
- [ ] POST /api/sync/pull with `force_now_bypass=true` bypasses delay
- [ ] POST /api/sync/push respects delay
- [ ] Queue limit enforced (> max_queued rejected)
- [ ] Conflict detection works (if merge conflict scenario available)
- [ ] Audit logs recorded to stderr (Phase 1) or audit_log table (Phase 2)
- [ ] UI badge renders all trust states correctly
- [ ] Countdown updates in real-time (delay_ms_remaining)

---

## Future Enhancements (Phase 2+)

- **Adaptive delay**: Increase delay if conflicts detected, decrease if consistently successful
- **Conflict recovery tooling**: Suggest common resolution patterns
- **Background scheduler**: Automatic pull every N minutes (respect delay)
- **WAL checkpoint before push**: Ensure safe checkpoint before push
- **Backup snapshot integration**: Backup before push in production sandboxes
- **Advanced trust states**: "Needs-authentication", "Waiting-for-maintenance-window"
