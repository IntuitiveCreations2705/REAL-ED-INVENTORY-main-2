# Tier Architecture Decision (Data Protection Critical)

Status: **Stage 1 - Dev Inventory System (12-Apr-2026)**

**Project Phase**: Stage 1 - Development and Inventory Foundation  
**Scope**: Establish core tier structure, BOX prefix framework, and preparation placeholders for future team UIs  
**Next Phase**: Phase 2 - Leadership & Team UI provisioning (see Phase 2 Roadmap below)

## Objective
Establish a secure, scalable, extensible architecture with strong data protection across all areas and support for unlimited role-based UI provisioning.

## Core Principles
- **BOX prefix-based access control**: Data ownership determined by `box_number` prefix (e.g., first character)
- **Non-overlapping device edit rights**: No two devices share edit access to the same field
- **Intranet-only satellite sync**: Offline-capable devices sync via button-pull, Leadership-validated
- **Future-proof team provisioning**: New team UIs provisioned by assigning BOX prefix ranges, no code restructuring required

## Final Tier Structure

### Tier 0 — MOM Control Plane (Two-Level MOM)
Two internal levels under MOM:

- **MOM-L1 (Operations Console)**
  - Access: IT Professional + Owner only
  - Purpose: monitoring, sync controls, diagnostics, feature flags, incident response, conflict resolution

- **MOM-L2 (Engineering/Admin Console)**
  - Access: Owner + explicitly approved engineering admins
  - Purpose: schema/version management, repair tools, migration controls, rule governance, BOX prefix allocation, app versioning

Both MOM levels are restricted and not available to staff users.

### Tier 1 — Core Data + Sync Service Layer
- Authoritative validation, sync ingestion, conflict handling, and audit.
- API-first service layer consumed by all UI tiers.
- Satellite sync controller: manages button-pull requests, changed-record delivery, conflict detection & warning.
- Change log enforcement: tracks `who`, `when`, `source_device`, `role`, `box_prefix`, `field_name` for all changes.
- No normal staff-facing UI surface required.

### Tier 2 — Admin Staff UI
Operational admin interface with role-based sub-tiers:

- **Tier 2.1 — Admin Sub-tier**
  - Access: Full inventory data visibility + global edits (all BOX prefixes)
  - Purpose: Master data governance, approval/validation of satellite changes, sync conflict resolution
  - Inherits: Global UI template, Leadership validation controls

- **Tier 2.2 — Leadership Sub-tier** (Multi-role coordinator layer)
  - Access: BOX prefix-restricted edit scope, satellite sync pull approval/validation
  - Purpose: Approve satellite changes, resolve sync conflicts, manage team-specific data, coordinate workflows
  - Edit scope: BOX prefixes assigned to their team(s)
  - Inherits: Global UI template, change validation + audit logging
  
  **Tier 2.2 Role Specializations** (configured per user, same UI contract):
  - **Workshop Mentor**: Workshop Crew / Team Support.
  - **Crew Leader**: Crew coordination.
  - **Project Coordinator**: Project-level inventory and milestone tracking
  - **Training Coordinator**: Event crew training cordination.
  - **Scheduling Coordinator**: Event timing coordinator.
  - **Task Team Leader**: Task-specific team management and handoff coordination

- **Tier 2.3 — Management Sub-tier**
  - Access: Read-only to assigned BOX prefixes, reporting/analytics views
  - Purpose: Monitor operations, generate reports, track inventory health
  - Edit scope: None (read-only)
  - Inherits: Global UI template

- **Tier 2.4 — Facilitator Sub-tier**
  - Access: Limited edit scope for event-specific setup and configuration
  - Purpose: Prepare material for events, configure event parameters, manage event-linked data
  - Edit scope: Event-scoped facilitation data planning and preparation
  - Inherits: Global UI template

All Tier 2 sub-tiers must inherit Global UI template standards.

### Tier 3 — Operations / Task-Focused UIs
Crew-facing interfaces with role-based sub-tiers:

- **Tier 3.1 — Crew Sub-tier**
  - Access: Restricted to specific BOX prefixes via device allocation
  - Purpose: Field-level data collection (stock count, status updates, event-specific logging)
  - Edit scope: Only fields within assigned BOX prefix(es), non-overlapping with other devices
  - Offline-capable: Local logging, intranet-only sync via button-pull to Leadership
  - Inherits: Global UI template, personal UI highlighting (local, not logged)

- **Tier 3.2 — Operations Sub-tier**
  - Access: Broader BOX prefix scope than Crew (multi-team coordination)
  - Purpose: Cross-team coordination, mini-app results aggregation, print-list generation
  - Edit scope: Leadership-approved BOX prefix ranges
  - Offline-capable: Intranet-only sync via button-pull, Leadership validation
  - Inherits: Global UI template

All Tier 3 sub-tiers support offline operation with intranet-only sync.

### Tier 4 — Team/Crew Extensions
- Future provisioning layer for new team-specific UIs
- New teams assigned BOX prefix range(s) → automatic access control scoping
- Inherit Tier 3 or Tier 2 template based on role requirement
- No code restructuring required; provision via MOM-L2 configuration

## Data protection controls (mandatory)
- Least-privilege RBAC at all tiers.
- **BOX prefix allocation**: Tier 2.1/2.2 and device identity determine editable BOX ranges.
- **Non-overlapping edit enforcement**: Server validates that no two devices hold edit access to same field in same BOX.
- Server-side authorization enforcement (UI constraints are not security controls).
- MFA + restricted network access for MOM tiers.
- Immutable audit logs for all write/sync/repair actions, including `device_id`, `role`, `box_prefix`.
- Row/version concurrency checks for updates.
- Idempotent sync apply behavior.
- Encrypted transport and secure credential handling.

## Sync & Satellite Model
- **Sync initiation**: Button-pull only (satellite initiates, never auto-syncs).
- **Data scope**: Changed records only since last sync checkpoint.
- **Conflict detection**: Server warns if multiple devices edited overlapping BOX ranges (prevented by design, flagged in dev/audit).
- **Conflict resolution**: Leadership-validated merge or rejection; all versions retained in audit log.
- **Satellite connectivity**: Intranet-only (no internet required or allowed).
- **Sync validation**: All incoming changes validated against Tier 1 rules + Leadership approval gate.
- **Device isolation**: Each satellite device assigned exclusive BOX prefix range(s); edit scope hard-wired server-side.

## BOX Prefix Allocation System (Foundational Framework)
- **Allocation unit**: BOX prefix (first character or multi-char pattern of `box_number`)
- **Assignment granularity**: Team/role → BOX prefix range(s)
- **Future provisioning**: New team UI = assign BOX prefix range in MOM-L2 + configure Tier 2.2/3.1 menu routing
- **Device mapping**: MOM-L2 assigns device_id → BOX prefix range(s) for satellite devices
- **Edit scope validation**: Tier 1 rejects any change to BOX outside device's allocated range
- **Pattern**: To add new team: (1) define prefix, (2) configure menu in MOM-L2, (3) provision devices, (4) assign Leadership validators — no application code restructure required

## Versioning & Deployment Strategy
- **App versioning**: Semantic (Major.Minor.Patch) tagged at commit
- **Deployment model**: MOM-L2 orchestrates push to devices (no satellite pull for updates)
- **Rollout strategy**: Global (all devices) or staged by BOX prefix / device_id
- **Update scope probability**:
  - Most likely: Button/minor UI changes (Tier 0/1 flag controls, no app redeploy)
  - Moderate: Feature additions to specific Tier 2/3 sub-tiers (config update)
  - Least likely: Major app restructure (requires contract approval + full redeploy)
- **Version control**: Separate app repo per new Tier 4 team UI; main repo hosts global template + Tier 2/3 core
- **Legacy reference**: Old app retained as reference; new app builds independently against same DB/Tier 1

## Same Database, Linked but Independent UIs
- **Single source of truth**: One DB across all UIs (primary + mirrored SSD for safe container)
- **App independence**: Each new UI is provisioned as a separate deployable with own version tag
- **Tier 1 contract binding**: All UIs must route through same Tier 1 sync/validation layer
- **Unified audit trail**: All changes logged centrally regardless of UI origin
- **Configuration-driven provisioning**: New UI adds no structural code; configured via MOM-L2 with new BOX prefix assignment

## Governance rule
- Any deviation from this tier model requires explicit contract approval before implementation.
- BOX prefix assignments managed exclusively by MOM-L2.
- Device-to-prefix mappings immutable until explicitly revoked by MOM-L2.

## Phase 2 Roadmap (Implementation Gaps Deferred)

The following items are identified as necessary for full production deployment but are deferred to Phase 2 (Leadership & Team UI provisioning):

### Role & Access Control
- [ ] Role-aware request routing (distinguish Tier 2.1 vs 2.2.* vs 2.3 vs 2.4 access)
- [ ] Leadership sub-tier role selector in UI (Workshop Mentor, Crew Leader, etc.)
- [ ] Role context injection in all API requests
- [ ] Tier 2.4 Facilitator event-scoped window logic (active event detection)

### Audit & Logging Enhancement
- [ ] Capture `device_id` in all change logs
- [ ] Capture `role` and `role_specialization` (for Tier 2.2 variants)
- [ ] Capture `box_prefix` range accessed
- [ ] Audit trail search/filter by role/device/prefix

### Satellite Sync & Conflict Model
- [ ] Satellite "PULL" button implementation in Leadership tier
- [ ] Changed-records-only query optimization (since-last-sync checkpoint)
- [ ] Conflict detection logic (overlapping BOX ranges flagged)
- [ ] Leadership approval/merge workflow for incoming satellite changes
- [ ] Conflict warning dashboard

### Device Isolation & BOX Enforcement
- [ ] Device registration in MOM-L2 with BOX prefix assignment
- [ ] Server-side validation: reject edits outside device's allocated BOX range
- [ ] Non-overlapping edit enforcement per BOX (prevent dual-device conflicts)

### Versioning & Deployment
- [ ] MOM-L2 app version tracking and push orchestration
- [ ] Staged rollout by device_id / BOX prefix / role
- [ ] Version context in API requests for compatibility checks

### Global Template Enhancements
- [ ] [ **RESERVED** ] Sub-tier role selector section (placeholder in Tier 2 UIs)
- [ ] [ **RESERVED** ] Satellite sync status indicator (placeholder in Tier 3 UIs)
- [ ] [ **RESERVED** ] Conflict warning panel (placeholder in status bar)
- [ ] [ **RESERVED** ] Device/BOX scope indicator badge (placeholder in header)
