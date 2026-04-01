PRAGMA foreign_keys=OFF;
BEGIN;

ALTER TABLE event_name RENAME COLUMN "EVENT NAME" TO event_name;
ALTER TABLE event_name RENAME COLUMN "TAGS" TO tags;

CREATE TABLE item_id_list_new (
  item_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('Active','Inactive')),
  item_name TEXT NOT NULL,
  UNIQUE(item_id, item_name)
);

INSERT INTO item_id_list_new (item_id, status, item_name)
SELECT "ItemID",
       CASE WHEN "Status" = 'Inactive' THEN 'Inactive' ELSE 'Active' END,
       "ItemName"
FROM item_id_list;

DROP TABLE item_id_list;
ALTER TABLE item_id_list_new RENAME TO item_id_list;

CREATE TABLE master_inventory_new (
  row_id INTEGER PRIMARY KEY,
  item_id TEXT,
  item_name TEXT,
  box_number TEXT,
  storage_location TEXT,
  event_tags TEXT NOT NULL,
  description TEXT NOT NULL,
  crew_notes TEXT,
  qty_required NUMERIC NOT NULL,
  stock_on_hand NUMERIC NOT NULL,
  count_confirmed TEXT,
  order_stock_qty NUMERIC,
  restock_comments TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  CHECK ((item_id IS NULL AND item_name IS NULL) OR (item_id IS NOT NULL AND item_name IS NOT NULL)),
  FOREIGN KEY (item_id, item_name)
    REFERENCES item_id_list (item_id, item_name)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
);

INSERT INTO master_inventory_new (
  row_id,
  item_id,
  item_name,
  box_number,
  storage_location,
  event_tags,
  description,
  crew_notes,
  qty_required,
  stock_on_hand,
  count_confirmed,
  order_stock_qty,
  restock_comments,
  is_active
)
SELECT
  rowid,
  NULLIF(TRIM(item_id), ''),
  NULLIF(TRIM(item_name), ''),
  box_number,
  storage_location,
  event_tags,
  description,
  crew_notes,
  qty_required,
  stock_on_hand,
  count_confirmed,
  order_stock_qty,
  restock_comments,
  1
FROM master_inventory;

DROP TABLE master_inventory;
ALTER TABLE master_inventory_new RENAME TO master_inventory;

CREATE TRIGGER trg_master_inventory_no_delete
BEFORE DELETE ON master_inventory
BEGIN
  SELECT RAISE(ABORT, 'Delete blocked: master_inventory rows are retained. Use is_active toggle.');
END;

CREATE TRIGGER trg_item_id_list_no_delete_if_used
BEFORE DELETE ON item_id_list
WHEN EXISTS (SELECT 1 FROM master_inventory m WHERE m.item_id = OLD.item_id)
BEGIN
  SELECT RAISE(ABORT, 'Delete blocked: item_id is already used in master_inventory.');
END;

CREATE TRIGGER trg_item_id_list_no_key_update_if_used
BEFORE UPDATE OF item_id, item_name ON item_id_list
WHEN EXISTS (SELECT 1 FROM master_inventory m WHERE m.item_id = OLD.item_id)
BEGIN
  SELECT RAISE(ABORT, 'Update blocked: item_id/item_name locked once used in master_inventory.');
END;

CREATE INDEX idx_item_id_list_item_name ON item_id_list(item_name);
CREATE INDEX idx_item_id_list_status ON item_id_list(status);
CREATE INDEX idx_master_inventory_item_name ON master_inventory(item_name);
CREATE INDEX idx_master_inventory_item_id ON master_inventory(item_id);
CREATE INDEX idx_master_inventory_active_box ON master_inventory(is_active, box_number);

COMMIT;
PRAGMA foreign_keys=ON;
