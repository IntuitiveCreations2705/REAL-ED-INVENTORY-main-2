-- Adds per-event theme accent color for UI event identity anchoring.
-- SQLite hex format: #RRGGBB

ALTER TABLE event_name
ADD COLUMN theme_accent_hex TEXT NOT NULL DEFAULT '#4F8CFF'
CHECK (
  LENGTH(theme_accent_hex) = 7
  AND SUBSTR(theme_accent_hex, 1, 1) = '#'
  AND UPPER(SUBSTR(theme_accent_hex, 2)) GLOB '[0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F][0-9A-F]'
);

-- Rough user-supplied MVP colors mapped to current event records.
UPDATE event_name
SET theme_accent_hex = '#FB0404'
WHERE event_name = 'Real Tantra';

UPDATE event_name
SET theme_accent_hex = '#00468C'
WHERE event_name = 'Real Coach Program';

UPDATE event_name
SET theme_accent_hex = '#12C4AD'
WHERE event_name IN ('Real Man 1', 'Real Woman 1');

UPDATE event_name
SET theme_accent_hex = '#B491F6'
WHERE event_name = 'Real Spiritual Quest';

UPDATE event_name
SET theme_accent_hex = '#FB0404'
WHERE event_name = 'Real Relationships';

-- Awaiting final color choices from user:
-- Real Man 2 / Real Woman 2 (REAL2)
-- Real Life Design (RLD)
-- These remain on the safe default accent #4F8CFF for now.
