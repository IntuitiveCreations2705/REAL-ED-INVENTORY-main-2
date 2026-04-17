Backups for `sql_inventory_master.db`

This folder contains timestamped SQL dumps and optional DB binary copies produced before bulk operations.

Restore examples:

# Restore from SQL dump (preferred)
sqlite3 sql_inventory_master.db < inventory_app/backups/sql_inventory_master_20260417T072718Z.sql

# Restore by copying DB binary
cp inventory_app/backups/sql_inventory_master_20260417T072718Z.db sql_inventory_master.db

# Or use the provided restore script
./inventory_app/scripts/restore_db.sh inventory_app/backups/sql_inventory_master_20260417T072718Z.sql
./inventory_app/scripts/restore_db.sh --copy inventory_app/backups/sql_inventory_master_20260417T072718Z.db
