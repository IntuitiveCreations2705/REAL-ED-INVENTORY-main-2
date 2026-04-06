-- Migration: Event Tag Governance Catalog
-- Date: 2026-04-06
-- Purpose: Establish minimal viable tag governance foundation for event_tags field.
-- Enables: active/inactive control, descriptions, sort order, ownership, audit.

CREATE TABLE IF NOT EXISTS event_tag_catalog (
    tag_name TEXT PRIMARY KEY,
    -- Canonical uppercase token, e.g., REAL1, REALWOMAN, NEEDED, etc.
    
    status TEXT NOT NULL DEFAULT 'Active'
        CHECK (status IN ('Active', 'Inactive')),
    -- Active: selectable in UI. Inactive: readable in old records, blocked for new selection.
    
    description TEXT,
    -- Human definition: why this tag exists, when to use it.
    
    sort_order INTEGER,
    -- Explicit display order in UI (NULL = alphabetic fallback).
    
    owner TEXT,
    -- Steward name or role accountable for tag definition.
    
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
    updated_by TEXT
    -- Lifecycle and audit trail linkage.
);

-- Index for active tag queries (UI selection list).
CREATE INDEX IF NOT EXISTS idx_event_tag_catalog_status 
    ON event_tag_catalog(status, sort_order);

-- Populate initial tags from existing event_name.tags data.
-- Extract unique tags and insert with default owner/description.
INSERT OR IGNORE INTO event_tag_catalog (tag_name, status, description, owner)
SELECT DISTINCT 
    upper(trim(tag)) AS tag_name,
    'Active' AS status,
    '' AS description,
    'system' AS owner
FROM (
    SELECT DISTINCT
        trim(substr(tags, instr(tags, '|') + 1, instr(substr(tags, instr(tags, '|') + 1), '|') - 1)) AS tag
    FROM event_name
    WHERE tags IS NOT NULL AND tags != ''
)
WHERE tag != '';
