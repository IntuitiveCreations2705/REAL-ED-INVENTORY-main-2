# Sandbox Strategy: Three-Tier Architecture

**Status:** Production Implementation  
**Last Updated:** 2026-05-23  
**Owner:** Technical Lead

---

## Architecture Overview

Three isolated sandbox environments protect system stability while enabling testing, role validation, and deployment rehearsal:

```
┌──────────────────────────────────────────────────────────────────────┐
│ SB1: SAFE COMMIT (Final Git Checkpoint Point)                       │
├──────────────────────────────────────────────────────────────────────┤
│ Purpose: Pristine master baseline, approved & tested                │
│ Data:    Full clone from SB2 post-validation                        │
│ Users:   admin (validation-only, minimal writes)                    │
│ Port:    5050                                                        │
│ DB:      sql_inventory_master.db (COMMITTED to Git)                 │
│ UIs:     Admin Master (read-only validation)                        │
│ Policy:  Read-mostly; promotions only via SB2 completion            │
│ Backup:  Daily via systemd timer → LANIA cold clone + rotation      │
└──────────────────────────────────────────────────────────────────────┘
                                  ↑ (copy after SB2 validation)
                                  │
┌──────────────────────────────────────────────────────────────────────┐
│ SB2: TEST & VERIFY (Full Clone of SB1 for Safe Mutation)            │
├──────────────────────────────────────────────────────────────────────┤
│ Purpose: Test all UIs individually & integrated; can break/reset    │
│ Data:    Copy of SB1 master DB + controlled test mutations          │
│ Users:   admin (full), leadership_test, operator_test, viewer_test  │
│ Port:    5051                                                        │
│ DB:      sql_inventory_sb2.db (LOCAL, NOT in Git)                   │
│ UIs:     All (Admin Master + Item List + Stock Count + System Map)  │
│ Policy:  Isolated testing; no impact on SB1 or SB3                  │
│ Reset:   Manual; copy from SB1 to restart clean                     │
└──────────────────────────────────────────────────────────────────────┘
                                  │
                                  ↓ (copy after all tests pass)
┌──────────────────────────────────────────────────────────────────────┐
│ SB3: STANDALONE DEPLOYMENT REHEARSAL                                │
├──────────────────────────────────────────────────────────────────────┤
│ Purpose: End-to-end standalone system test; deployment readiness    │
│ Data:    Fresh backup/restore cycle + smoke tests                   │
│ Users:   admin, leadership_test, operator_test (minimal seed)       │
│ Port:    5052                                                        │
│ DB:      sql_inventory_sb3.db (LOCAL, NOT in Git)                   │
│ UIs:     All (full integrated system)                               │
│ Cadence: Nightly at 4:00 AM (systemd timer + script)                │
│ Policy:  Automatic teardown/rebuild; validate backup + restore      │
│ Logs:    /var/log/sb3-rehearsal.log                                 │
└──────────────────────────────────────────────────────────────────────┘
```

---

## SB1: Safe Commit Baseline

### Policy

- **State:** Pristine, production-ready, approved after SB2 validation
- **Reads:** Allowed (validation, inspection, audit trail)
- **Writes:** Minimal, admin-only, with hard gate `IMPLEMENT` token required
- **Promotion:** Only from SB2 after complete test & verification suite passes
- **Rollback:** Restore from prior Git commit via `git checkout [commit] -- sql_inventory_master.db`

### Launch

```bash
./start_sandbox1.sh IMPLEMENT
# Opens Admin Master UI on http://127.0.0.1:5050
# Read-only validation mode; changes to SB1 DB are audited but discouraged
```

### Git Integration

- Master DB `sql_inventory_master.db` is committed to Git at each stable promotion
- Before promotion from SB2: create checkpoint tag (e.g., `stable-20260523-143000`)
- Every promotion requires explicit `IMPLEMENT` gate + signature (admin username in audit log)
- Rollback supported: revert to prior commit, cold clone restored from LANIA snapshot

### Backup & Recovery

- Automated daily backup to LANIA via systemd timer
- Cold clone created at each promotion (tagged release baseline)
- Restore drill exercised quarterly (documented in `DAILY_ALIGNMENT_CHECKLIST.md`)

---

## SB2: Test & Verify Sandbox

### Policy

- **State:** Mutable, independent from SB1/SB3, full freedom to break/reset
- **Data:** Complete clone of SB1 master DB; isolated from all other sandboxes
- **Users:** Test user set (admin, leadership_test, operator_test, viewer_test)
- **Testing Scope:** All UIs individually + integrated suite
- **Reset:** Manual; `cp sql_inventory_master.db sql_inventory_sb2.db` to restart clean
- **Isolation:** Complete; SB2 mutations cannot affect SB1 or SB3

### Launch

```bash
./start_sandbox2.sh IMPLEMENT
# Opens Admin Master UI on http://127.0.0.1:5051
# Full edit/delete capability for testing all role tiers
```

### Test Matrix

| UI | Route | Purpose | Test Path |
|---|---|---|---|
| **Admin Master** | `/` | Full inventory management | Load, render grid, create/edit/delete items, check for JS errors |
| **Item ID List** | `/item-id-list` | Item identity registry | Add items, validate item_id uniqueness, FK constraints |
| **Stock Count** | `/event-stock-count` | Event-scoped aggregation | Filter events, aggregate stock, verify read-only enforcement |
| **System Map** | `/system-map` | Diagnostic introspection | Load routes, check database stats, validate health checks |

### Test Workflow

1. **Individual UI Tests** (per-UI verification):
   - Admin Master: CRUD operations on inventory
   - Item List: Verify item_id immutability + validation
   - Stock Count: Confirm event filtering + aggregation logic
   - System Map: Validate diagnostic data accuracy

2. **Integrated Tests** (full Admin flow):
   - Navigate Admin Master → Item List → Stock Count → System Map
   - Verify cross-UI data consistency
   - Test role transitions (admin → operator → viewer)
   - Check audit log for all mutations

3. **Data Integrity Tests**:
   - FK constraint enforcement
   - Orphan detection (items without boxes)
   - Event tag catalog consistency
   - Schema migration idempotence

4. **Error Scenarios**:
   - Invalid inputs (empty strings, duplicate item_ids, out-of-range quantities)
   - Concurrent edits (two tabs, verify lock behavior)
   - Network failure simulation (manual browser refresh)

### Promotion Criteria

SB2 is ready for promotion to SB1 when:
- ✅ All UIs load without JS errors
- ✅ Admin CRUD operations execute successfully
- ✅ Item ID uniqueness enforced
- ✅ Stock count aggregation correct
- ✅ Cross-UI navigation works (no broken links)
- ✅ Audit log captures all mutations
- ✅ Schema health checks pass
- ✅ FK constraints verified
- ✅ No high-severity defects
- ✅ Regression tests pass (documented baseline behaviors)

### Reset SB2

```bash
# Start fresh from SB1 baseline
cp sql_inventory_master.db sql_inventory_sb2.db
python3 inventory_app/ui/migrate.py  # idempotent; ensures schema up-to-date
python3 inventory_app/ui/seed_sandbox2_leadership.py  # re-seed test users
```

---

## SB3: Standalone Deployment Rehearsal

### Policy

- **State:** Fresh, clean environment rebuilt nightly
- **Purpose:** Validate end-to-end deployment process + backup/restore cycle
- **Cadence:** Nightly at 4:00 AM (systemd timer `sb3-rehearsal.timer`)
- **Duration:** ~60 minutes (02:00–05:00 AM reserved)
- **Automation:** Full; no manual intervention required
- **Logs:** `/var/log/sb3-rehearsal.log` (append mode, rotated weekly)

### Nightly Rehearsal Sequence (4am)

```bash
# 02:00 UTC (earlier than 04:00, for setup buffer)
systemd timer triggers: sb3-rehearsal.service
  
  [Step 1: Prepare] — Backup prior logs
  - Rename /var/log/sb3-rehearsal.log → sb3-rehearsal-[TIMESTAMP].log
  - Start fresh log file
  
  [Step 2: Clean] — Destroy old SB3
  - Stop Flask process on port 5052 (if running)
  - Remove sql_inventory_sb3.db
  
  [Step 3: Initialize] — Clone SB1 baseline
  - cp sql_inventory_master.db sql_inventory_sb3.db
  - Verify copy integrity (SHA256 match)
  
  [Step 4: Schema] — Migrate
  - python3 inventory_app/ui/migrate.py (idempotent)
  - Verify schema health (tables, FK constraints)
  
  [Step 5: Seed] — Populate users & minimal data
  - python3 inventory_app/ui/seed_sandbox3_team.py
  - Create admin, leadership_test, operator_test users
  - Seed minimal inventory (5-10 items for smoke tests)
  
  [Step 6: Launch] — Start Flask
  - export INVENTORY_DB_PATH=sql_inventory_sb3.db
  - python3 inventory_app/ui/run_admin.py IMPLEMENT (port 5052)
  - Wait for Flask to be ready (port listening)
  
  [Step 7: Smoke Tests] — Validate UI routes & health
  - GET / → 200 OK (Admin Master loads)
  - GET /item-id-list → 200 OK
  - GET /event-stock-count → 200 OK
  - GET /system-map → 200 OK
  - GET /api/health → 200 OK + FK checks pass
  - GET /api/foundation-policy → 200 OK + audit log accessible
  - Check for JS errors in rendered HTML
  
  [Step 8: Backup Test] — Validate backup cycle
  - Enable INVENTORY_PRECHANGE_BACKUP_ENABLED=1
  - Trigger a mutation (e.g., edit item stock count)
  - Verify backup file created: sql_inventory_*.sql.gz
  - Verify SHA256 checksum file created
  - Confirm backup size > 0 bytes
  
  [Step 9: Optional Restore Test] — Full cycle validation (weekly)
  - Restore backup to test database (sql_inventory_restore_test.db)
  - Run schema health check on restored DB
  - Verify row counts match pre-backup
  - Clean up test DB
  
  [Step 10: Reporting] — Log results
  - Log SUCCESS if all smoke tests pass
  - Log FAILURE + error details if any step fails
  - Append summary to /var/log/sb3-rehearsal.log
  
  [Step 11: Cleanup] — Conditional teardown
  - If SUCCESS: Keep DB for next cycle (optional: soft-reset)
  - If FAILURE: Preserve DB, logs for manual investigation
  - Stop Flask gracefully
  
  [Step 12: Complete] — Record completion
  - Log final timestamp + exit code
  - Email alert if FAILURE (optional, on-demand)
```

### Smoke Test Acceptance Criteria

All of the following must succeed for SB3 rehearsal to PASS:

| Test | Condition | Expected |
|---|---|---|
| Admin Master Load | GET / | 200 OK, HTML renders, no JS errors |
| Item List Load | GET /item-id-list | 200 OK, table visible |
| Stock Count Load | GET /event-stock-count | 200 OK, event filters present |
| System Map Load | GET /system-map | 200 OK, database stats displayed |
| Health Check | GET /api/health | 200 OK, FK checks pass |
| Foundation Policy | GET /api/foundation-policy | 200 OK, audit log accessible |
| Backup Creation | Trigger mutation | Backup file *.sql.gz created |
| Backup Integrity | SHA256 checksum | Checksum file matches created backup |

### Failure Handling

If SB3 nightly rehearsal fails:
1. Log detailed error message and stack trace to `/var/log/sb3-rehearsal.log`
2. Preserve `sql_inventory_sb3.db` for manual investigation
3. Send email alert (configured in systemd service)
4. Next nightly run will attempt fresh initialization (auto-retry)
5. Do NOT retry immediately; wait for next scheduled 4:00 AM run

### Manual Debugging SB3

```bash
# After failure, inspect logs and database
tail -100 /var/log/sb3-rehearsal.log

# Manually test SB3 components
export INVENTORY_DB_PATH=sql_inventory_sb3.db
python3 inventory_app/ui/migrate.py
python3 inventory_app/ui/seed_sandbox3_team.py
python3 inventory_app/ui/run_admin.py IMPLEMENT

# Test specific routes
curl http://127.0.0.1:5052/api/health
curl http://127.0.0.1:5052/
```

---

## Promotion Workflow: SB2 → SB1

### Prerequisites

- [ ] SB2 testing complete (all UI tests pass)
- [ ] All regression tests pass (documented baseline behaviors)
- [ ] No high-severity defects open
- [ ] SB1 in clean state (no uncommitted changes)

### Promotion Steps

**Step 1: Prepare SB1 Checkpoint** (safety before copy)

```bash
cd /Volumes/2000\ MASTER/REAL-ED-INVENTORY-main/REAL-ED-INVENTORY-main

# Ensure SB1 DB is clean
git add sql_inventory_master.db
git commit -m "checkpoint: pre-SB2-promotion baseline [$(date +%Y%m%d-%H%M%S)]"
git tag "pre-promotion-$(date +%Y%m%d-%H%M%S)"
git push --follow-tags
```

**Step 2: Validate SB2 is Stable** (final pre-promotion check)

```bash
# Quick smoke test on SB2
./start_sandbox2.sh IMPLEMENT  # port 5051
# Verify: Admin Master loads, no errors
# Ctrl+C to exit
```

**Step 3: Copy SB2 → SB1**

```bash
# Atomic copy
cp sql_inventory_sb2.db sql_inventory_master.db

# Verify integrity
sha256sum sql_inventory_master.db
# (record SHA for audit trail)
```

**Step 4: Validate SB1** (quick smoke test)

```bash
./start_sandbox1.sh IMPLEMENT  # port 5050
# Verify: Admin Master loads, data matches SB2, no errors
# Check audit log for SB2 mutations now visible in SB1
# Ctrl+C to exit
```

**Step 5: Commit to Git**

```bash
git add sql_inventory_master.db
git commit -m "promoted: SB2 validated testing → SB1 safe commit"
git tag "stable-$(date +%Y%m%d-%H%M%S)"
git push --follow-tags
```

**Step 6: Create Cold Clone on LANIA** (DR backup)

```bash
# Trigger existing cold clone routine (documented in DR snapshot process)
# Updates /Volumes/LANIA/REAL-ED-DR/ROTATION_INDEX.csv
```

**Step 7: Verify Promotion**

```bash
# Confirm latest commit is promoted stable tag
git log --oneline -5
git describe --tags --abbrev=0

# Verify SB1 reflects SB2 data
./start_sandbox1.sh IMPLEMENT
# Spot-check: a few items created in SB2 should be visible
```

### Rollback (if Promotion Fails)

```bash
# Revert SB1 to prior snapshot
git checkout pre-promotion-[TIMESTAMP] -- sql_inventory_master.db
git add sql_inventory_master.db
git commit -m "rollback: SB1 promotion failed, restored prior checkpoint"
git push

# Restore cold clone from LANIA if SB1 corruption detected
# (documented in DR recovery procedure)
```

---

## Git Policy for Sandboxes

### Committed Files

- ✅ `sql_inventory_master.db` (SB1 only; committed at each promotion)
- ✅ `start_sandbox1.sh`, `start_sandbox2.sh`, `start_sandbox3.sh` (launchers)
- ✅ `inventory_app/ui/seed_sandbox*.py` (seeders)
- ✅ `inventory_app/scripts/sb3_nightly_rehearsal.sh` (automation)
- ✅ `SANDBOX_STRATEGY.md` (this file; governance docs)

### Excluded Files (`.gitignore`)

- ❌ `sql_inventory_sb2.db` (local test DB)
- ❌ `sql_inventory_sb3.db` (local test DB)
- ❌ `sql_inventory_*.db-wal` (SQLite journal files)
- ❌ `sql_inventory_*.db-shm` (SQLite shared memory)
- ❌ `/var/log/sb3-rehearsal*.log` (rehearsal logs)

### Branch Policy

- **main:** Only SB1 safe-commit baselines + tags
  - Fast-forward only; no direct commits to main
  - All changes must flow: feature → SB2 → SB1 → main
  
- **feature branches:** (optional) Development branches can use SB2/SB3 freely
  - Example: `feature/item-label-popup` tests in SB2, promotes to SB1

---

## Operational Checklists

### Daily (SB1 Validation)

- [ ] Review SB1 audit log for unexpected mutations
- [ ] Confirm schema health check passes (`GET /api/health`)
- [ ] Verify backup completed overnight
- [ ] Check LANIA DR snapshot created successfully

### Weekly (SB2 Full Test Suite)

- [ ] Reset SB2: `cp sql_inventory_master.db sql_inventory_sb2.db`
- [ ] Run seed_sandbox2_leadership.py
- [ ] Execute full UI test matrix (Admin Master, Item List, Stock Count, System Map)
- [ ] Test cross-UI navigation and data consistency
- [ ] Verify FK constraints and orphan detection
- [ ] Record any defects found (fix or risk-accept)

### Monthly (SB3 Rehearsal Validation)

- [ ] Review 30-day `/var/log/sb3-rehearsal*.log` for patterns
- [ ] Manual SB3 nightly run: test both backup and restore cycles
- [ ] Verify LANIA cold clone integrity
- [ ] Exercise rollback procedure (restore from SB1 checkpoint)
- [ ] Update operational runbooks based on findings

### Quarterly (Disaster Recovery Drill)

- [ ] Full cold clone restore to isolated test VM
- [ ] Verify data integrity matches expectations
- [ ] Document time-to-recovery (RTO)
- [ ] Update runbook with lessons learned

---

## Environment Variables

### SB1 (Safe Commit)

```bash
INVENTORY_DB_PATH=sql_inventory_master.db  # Default, usually unset
IMPLEMENT=1                                # Required for ./start_sandbox1.sh
INVENTORY_PRECHANGE_BACKUP_ENABLED=true   # Daily backup enabled
```

### SB2 (Test & Verify)

```bash
INVENTORY_DB_PATH=sql_inventory_sb2.db    # Override for SB2
IMPLEMENT=1                                # Required for ./start_sandbox2.sh
INVENTORY_PRECHANGE_BACKUP_ENABLED=false  # Backups optional/disabled in test
```

### SB3 (Rehearsal)

```bash
INVENTORY_DB_PATH=sql_inventory_sb3.db    # Override for SB3
IMPLEMENT=1                                # Required for ./start_sandbox3.sh
INVENTORY_PRECHANGE_BACKUP_ENABLED=true   # Backup cycle validation required
INVENTORY_STARTUP_DAILY_BACKUP_ENABLED=false # Nightly runs; backup via separate trigger
```

---

## Support & Troubleshooting

### SB1 Won't Start

```bash
# Check hard gate
./start_sandbox1.sh IMPLEMENT

# If BLOCKED, ensure:
# 1. Run from repo root: /Volumes/2000\ MASTER/REAL-ED-INVENTORY-main/REAL-ED-INVENTORY-main
# 2. Pass exact token: IMPLEMENT (all caps)
# 3. Check schema: python3 inventory_app/ui/migrate.py
```

### SB2 Reset Needed

```bash
# Full reset (loses all test changes)
cp sql_inventory_master.db sql_inventory_sb2.db
python3 inventory_app/ui/migrate.py
python3 inventory_app/ui/seed_sandbox2_leadership.py
./start_sandbox2.sh IMPLEMENT
```

### SB3 Nightly Failed

```bash
# Check logs
tail -200 /var/log/sb3-rehearsal.log

# Manual recovery
export INVENTORY_DB_PATH=sql_inventory_sb3.db
python3 inventory_app/ui/migrate.py
python3 inventory_app/ui/seed_sandbox3_team.py
./start_sandbox3.sh IMPLEMENT

# If still broken, restore from SB1
cp sql_inventory_master.db sql_inventory_sb3.db
```

### Promotion SB2→SB1 Failed

```bash
# Rollback SB1 to prior checkpoint
git log --oneline | head -5
git checkout [prior-commit] -- sql_inventory_master.db
git add sql_inventory_master.db
git commit -m "rollback: promotion failed"
git push
```

---

## References

- [DAILY_ALIGNMENT_CHECKLIST.md](inventory_app/DAILY_ALIGNMENT_CHECKLIST.md) — Operational validation gates
- [TODO.md](TODO.md) — Defect tracking and feature backlog
- [README_DEPLOY.md](inventory_app/deploy/README_DEPLOY.md) — Office VM deployment
- [REAL_AUTH_ROLE_ENFORCEMENT_DEFINITION.md](REAL_AUTH_ROLE_ENFORCEMENT_DEFINITION.md) — Phase A auth architecture (blocking)

