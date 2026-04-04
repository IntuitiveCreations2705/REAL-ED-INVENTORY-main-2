-- Phase 1: Users, Roles, Audit Log + Lifecycle columns
-- Run via:  python inventory_app/ui/migrate.py
-- ────────────────────────────────────────────────────────────────────────────

PRAGMA foreign_keys=OFF;
BEGIN;

-- ── Roles ──────────────────────────────────────────────────────────────────
-- Hierarchy enforced by weight: lower weight = higher authority.
-- Seats: superadmin(10) > admin(20) > leadership(30) > operator(40) > viewer(50)

CREATE TABLE IF NOT EXISTS roles (
  role_id   INTEGER PRIMARY KEY,
  role_name TEXT    NOT NULL UNIQUE,
  weight    INTEGER NOT NULL UNIQUE,  -- numeric ordering, do not change existing values
  label     TEXT    NOT NULL
);

INSERT OR IGNORE INTO roles (role_id, role_name, weight, label) VALUES
  (1, 'superadmin', 10, 'Super Admin'),
  (2, 'admin',      20, 'Admin'),
  (3, 'leadership', 30, 'Leadership'),
  (4, 'operator',   40, 'Operator'),
  (5, 'viewer',     50, 'Viewer');

-- ── Users ──────────────────────────────────────────────────────────────────
-- password_hash is NULL until Phase 2 auth is wired.
-- Do NOT store plaintext passwords — bcrypt only.

CREATE TABLE IF NOT EXISTS users (
  user_id       INTEGER PRIMARY KEY,
  username      TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  display_name  TEXT    NOT NULL,
  password_hash TEXT,                   -- bcrypt; NULL until Phase 2
  role_id       INTEGER NOT NULL
    REFERENCES roles(role_id) ON UPDATE RESTRICT ON DELETE RESTRICT,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  last_login_at TEXT                     -- NULL until first login
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_role_id  ON users(role_id);

-- ── Audit log ──────────────────────────────────────────────────────────────
-- Append-only. Triggers below block all DELETE and UPDATE.
-- Each changed field in a multi-field save generates one row.
-- session_id groups all rows from a single save action.

CREATE TABLE IF NOT EXISTS audit_log (
  log_id      INTEGER PRIMARY KEY,
  table_name  TEXT    NOT NULL,
  row_ref     TEXT    NOT NULL,           -- e.g. "row_id=42" or "item_id=ABC01"
  action      TEXT    NOT NULL,           -- UPDATE | INSERT | TOGGLE | LINK
  field_name  TEXT,                       -- NULL for whole-row actions
  old_value   TEXT,
  new_value   TEXT,
  changed_by  TEXT    NOT NULL DEFAULT 'system',  -- username or IP until Phase 2
  changed_at  TEXT    NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  session_id  TEXT,                       -- UUID correlating multi-field saves
  device_hint TEXT                        -- remote IP or device label
);

CREATE INDEX IF NOT EXISTS idx_audit_table_row  ON audit_log(table_name, row_ref);
CREATE INDEX IF NOT EXISTS idx_audit_changed_by ON audit_log(changed_by);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON audit_log(changed_at);

CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_delete
BEFORE DELETE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log rows are immutable and cannot be deleted.');
END;

CREATE TRIGGER IF NOT EXISTS trg_audit_log_no_update
BEFORE UPDATE ON audit_log
BEGIN
  SELECT RAISE(ABORT, 'audit_log rows are immutable and cannot be updated.');
END;

-- ── Lifecycle columns: master_inventory ────────────────────────────────────
-- version: incremented on every write — enables optimistic concurrency.
-- existing rows default to version=1, timestamps='1970-...' (sentinel for pre-migration rows).

ALTER TABLE master_inventory ADD COLUMN version    INTEGER NOT NULL DEFAULT 1;
ALTER TABLE master_inventory ADD COLUMN created_at TEXT    NOT NULL DEFAULT '1970-01-01T00:00:00Z';
ALTER TABLE master_inventory ADD COLUMN updated_at TEXT    NOT NULL DEFAULT '1970-01-01T00:00:00Z';
ALTER TABLE master_inventory ADD COLUMN updated_by TEXT    NOT NULL DEFAULT 'system';

-- ── Lifecycle columns: item_id_list ────────────────────────────────────────

ALTER TABLE item_id_list ADD COLUMN version    INTEGER NOT NULL DEFAULT 1;
ALTER TABLE item_id_list ADD COLUMN created_at TEXT    NOT NULL DEFAULT '1970-01-01T00:00:00Z';
ALTER TABLE item_id_list ADD COLUMN updated_at TEXT    NOT NULL DEFAULT '1970-01-01T00:00:00Z';
ALTER TABLE item_id_list ADD COLUMN updated_by TEXT    NOT NULL DEFAULT 'system';

COMMIT;
PRAGMA foreign_keys=ON;
