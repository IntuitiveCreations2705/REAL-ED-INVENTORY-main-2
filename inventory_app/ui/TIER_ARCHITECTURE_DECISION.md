# Tier Architecture Decision (Data Protection Critical)

Status: **Approved baseline direction (11-Apr-2026)**

## Objective
Establish a secure, scalable architecture with strong data protection across all areas.

## Final structure

### Tier 0 — MOM Control Plane (Two-Level MOM)
Two internal levels under MOM:

- **MOM-L1 (Operations Console)**
  - Access: IT Professional + Owner only
  - Purpose: monitoring, sync controls, diagnostics, feature flags, incident response

- **MOM-L2 (Engineering/Admin Console)**
  - Access: Owner + explicitly approved engineering admins
  - Purpose: schema/version management, repair tools, migration controls, rule governance

Both MOM levels are restricted and not available to staff users.

### Tier 1 — Core Data + Sync Service Layer
- Authoritative validation, sync ingestion, conflict handling, and audit.
- API-first service layer consumed by all UI tiers.
- No normal staff-facing UI surface required.

### Tier 2 — Admin Staff UI
- Operational admin interface (former Master Admin role).
- Constrained update permissions via backend RBAC + rule engine.
- Must inherit Global UI template standards.

### Tier 3 — Crew / Operations UIs
- Task-focused interfaces (stock count, print lists, restocking workflows).
- Sync and data operations only through Tier 1 contracts.

## Data protection controls (mandatory)
- Least-privilege RBAC at all tiers.
- Server-side authorization enforcement (UI constraints are not security controls).
- MFA + restricted network access for MOM tiers.
- Immutable audit logs for all write/sync/repair actions.
- Row/version concurrency checks for updates.
- Idempotent sync apply behavior.
- Encrypted transport and secure credential handling.

## Sync path rule
- Tier 2/3 never write directly to DB.
- All write/sync requests pass through Tier 1 validation and auditing.
- MOM can orchestrate/repair but all actions remain auditable.

## Governance rule
- Any deviation from this tier model requires explicit contract approval before implementation.
