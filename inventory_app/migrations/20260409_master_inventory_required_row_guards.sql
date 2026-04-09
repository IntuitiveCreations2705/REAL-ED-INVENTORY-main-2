-- Enforce row completeness at DB layer for master_inventory.
-- Mirrors UI/API required-field policy while preserving optional exceptions
-- (crew_notes, restock_comments, qty_flag_limit, count_confirmed).

DROP TRIGGER IF EXISTS trg_master_inventory_required_insert;
CREATE TRIGGER trg_master_inventory_required_insert
BEFORE INSERT ON master_inventory
BEGIN
  SELECT CASE
    WHEN NEW.item_id IS NULL OR TRIM(NEW.item_id) = ''
      THEN RAISE(ABORT, 'item_id is required')
  END;

  SELECT CASE
    WHEN NEW.item_name IS NULL OR TRIM(NEW.item_name) = ''
      THEN RAISE(ABORT, 'item_name is required')
  END;

  SELECT CASE
    WHEN NEW.box_number IS NULL OR TRIM(NEW.box_number) = ''
      THEN RAISE(ABORT, 'box_number is required')
  END;

  SELECT CASE
    WHEN NEW.storage_location IS NULL OR TRIM(NEW.storage_location) = ''
      THEN RAISE(ABORT, 'storage_location is required')
  END;

  SELECT CASE
    WHEN NEW.event_tags IS NULL OR TRIM(NEW.event_tags) = ''
      THEN RAISE(ABORT, 'event_tags is required')
  END;

  SELECT CASE
    WHEN NEW.description IS NULL OR TRIM(NEW.description) = ''
      THEN RAISE(ABORT, 'description is required')
  END;

  SELECT CASE
    WHEN NEW.qty_required IS NULL
      THEN RAISE(ABORT, 'qty_required is required')
  END;

  SELECT CASE
    WHEN NEW.stock_on_hand IS NULL
      THEN RAISE(ABORT, 'stock_on_hand is required')
  END;
END;

DROP TRIGGER IF EXISTS trg_master_inventory_required_update;
CREATE TRIGGER trg_master_inventory_required_update
BEFORE UPDATE ON master_inventory
BEGIN
  SELECT CASE
    WHEN NEW.item_id IS NULL OR TRIM(NEW.item_id) = ''
      THEN RAISE(ABORT, 'item_id is required')
  END;

  SELECT CASE
    WHEN NEW.item_name IS NULL OR TRIM(NEW.item_name) = ''
      THEN RAISE(ABORT, 'item_name is required')
  END;

  SELECT CASE
    WHEN NEW.box_number IS NULL OR TRIM(NEW.box_number) = ''
      THEN RAISE(ABORT, 'box_number is required')
  END;

  SELECT CASE
    WHEN NEW.storage_location IS NULL OR TRIM(NEW.storage_location) = ''
      THEN RAISE(ABORT, 'storage_location is required')
  END;

  SELECT CASE
    WHEN NEW.event_tags IS NULL OR TRIM(NEW.event_tags) = ''
      THEN RAISE(ABORT, 'event_tags is required')
  END;

  SELECT CASE
    WHEN NEW.description IS NULL OR TRIM(NEW.description) = ''
      THEN RAISE(ABORT, 'description is required')
  END;

  SELECT CASE
    WHEN NEW.qty_required IS NULL
      THEN RAISE(ABORT, 'qty_required is required')
  END;

  SELECT CASE
    WHEN NEW.stock_on_hand IS NULL
      THEN RAISE(ABORT, 'stock_on_hand is required')
  END;
END;
