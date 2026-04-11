# Sync Architecture Decision (Master ↔ Mini Apps)

Status: **Approved baseline for MVP implementation**

## 1) Sync mode
- **Pull + Push** is the standard mode.
- Mode is preset/configured in app settings (not ad-hoc per request).

## 2) Payload schema + versioning
- Every sync payload must include:
  - `schema_version`
  - `source_app` (`master` or `mini`)
  - `source_device_id`
  - `sync_session_id`
  - `generated_at_utc`
  - `records[]`
- Schema version is required and validated before processing.
- Backward compatibility policy for MVP: reject unsupported versions with explicit error.

## 3) Conflict resolution rule
- Master DB is authoritative for protected/governed fields.
- Row-level optimistic version check required (`version` match).
- On conflict:
  - do not auto-overwrite silently
  - mark conflict status
  - require explicit operator resolution path

## 4) Manual sync UX trigger points
- Trigger points in UI:
  - `Sync Now` (manual run)
  - `Preview Changes` (dry-run validation summary)
  - `Apply Valid Changes`
  - `View Conflicts`
  - `Retry Failed`
- Each sync action must display outcome summary: applied / skipped / conflicted / failed counts.

## 5) Audit fields per sync event
- Required event-level fields:
  - `sync_event_id`
  - `sync_session_id`
  - `actor_user`
  - `source_app`
  - `source_device_id`
  - `started_at_utc`
  - `completed_at_utc`
  - `result_status`
- Required record-level fields:
  - `table_name`
  - `row_ref`
  - `action_type` (insert/update/delete/conflict/skip)
  - `old_value` (where applicable)
  - `new_value` (where applicable)
  - `validation_result`
  - `error_message` (if failed)

## 6) Safety requirements
- Idempotent apply behavior required for repeated payload submission.
- Validation must run before commit.
- No silent data mutation outside audit trail.
