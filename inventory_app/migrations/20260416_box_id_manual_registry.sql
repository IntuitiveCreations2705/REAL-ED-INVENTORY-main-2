BEGIN;

-- Box ID registry for manual assignment workflow.
-- box_key = canonicalized box reference key (uppercase, strips common separators)
-- box_number = preferred human/system reference code as currently used in UI
-- box_id = manually assigned immutable box identifier (optional until assigned)

CREATE TABLE IF NOT EXISTS box_id_list (
  box_key    TEXT PRIMARY KEY,
  box_number TEXT NOT NULL UNIQUE,
  box_id     TEXT UNIQUE,
  box_label  TEXT,
  box_type   TEXT,
  status     TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_by TEXT NOT NULL DEFAULT 'system',
  version    INTEGER NOT NULL DEFAULT 1
);

-- Seed registry from existing master_inventory box references.
-- NOTE: canonical key logic mirrors current UI intent and collapses common variants
-- (space/hyphen/underscore/period differences).
WITH raw_boxes AS (
  SELECT DISTINCT
    TRIM(COALESCE(box_number, '')) AS box_number,
    UPPER(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(TRIM(COALESCE(box_number, '')), ' ', ''),
          '-', ''),
        '_', ''),
      '.', '')
    ) AS box_key
  FROM master_inventory
  WHERE TRIM(COALESCE(box_number, '')) <> ''
), grouped AS (
  SELECT box_key, MIN(box_number) AS box_number
  FROM raw_boxes
  WHERE box_key <> ''
  GROUP BY box_key
)
INSERT OR IGNORE INTO box_id_list (box_key, box_number, updated_by)
SELECT box_key, box_number, 'migration_20260416'
FROM grouped;

COMMIT;
