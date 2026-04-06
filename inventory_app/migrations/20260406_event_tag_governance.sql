-- Migration: Event Tag Governance Catalog
-- Date: 2026-04-06
-- Purpose: Create event_tag_catalog table to govern tag lifecycle, status, and ownership.

CREATE TABLE IF NOT EXISTS event_tag_catalog (
  tag_name TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'Active',
  description TEXT,
  sort_order INTEGER,
  owner TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  created_by TEXT,
  updated_by TEXT,
  CHECK (status IN ('Active', 'Inactive'))
);

-- Create index for fast lookups.
CREATE INDEX IF NOT EXISTS idx_event_tag_catalog_status
  ON event_tag_catalog(status);

