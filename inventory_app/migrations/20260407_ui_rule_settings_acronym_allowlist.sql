-- 20260407_ui_rule_settings_acronym_allowlist.sql
-- Global UI rule settings table + initial acronym allow-list seed.

CREATE TABLE IF NOT EXISTS ui_rule_settings (
  rule_key   TEXT PRIMARY KEY,
  value_text TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_by TEXT,
  version    INTEGER NOT NULL DEFAULT 1
);

INSERT INTO ui_rule_settings (rule_key, value_text, updated_by, version)
SELECT 'acronym_allowlist', '["usb","xlr","iec","rca","aa","aaa"]', 'system', 1
WHERE NOT EXISTS (
  SELECT 1 FROM ui_rule_settings WHERE rule_key = 'acronym_allowlist'
);
