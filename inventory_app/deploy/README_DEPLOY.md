Pre-deploy checklist for office VM

Goal
- Deploy the Inventory Admin UI to an on-prem VM and configure mirrored backups to two 2TB SSDs (backup-only mounts).

Assumptions
- Office VM running Ubuntu 20.04+ (or similar Linux). Adjust commands for other distros.
- Two external SSDs are attached and will be mounted at `/mnt/backup1` and `/mnt/backup2` (or configured as RAID1 by sysadmin).
- App code lives in `/opt/real-ed-inventory` and repository is kept up-to-date via git pulls or CI deploys.

Steps
1) Prepare VM
   - Create service account and directories:
     sudo useradd -r -s /usr/sbin/nologin inventory || true
     sudo mkdir -p /opt/real-ed-inventory
     sudo chown -R inventory:inventory /opt/real-ed-inventory

2) Attach and mount SSDs
   - Option A (RAID1, recommended for true mirroring): have sysadmin configure RAID1 at block level so OS presents one device (/dev/md0). Then mount the RAID device at `/mnt/backup`.
   - Option B (simple mirrored copies): mount SSDs at `/mnt/backup1` and `/mnt/backup2` and rely on the backup script to copy to both.

3) Install runtime & create venv
   - sudo apt update && sudo apt install -y python3 python3-venv sqlite3 git
   - sudo -u inventory python3 -m venv /opt/real-ed-inventory/.venv
   - sudo -u inventory /opt/real-ed-inventory/.venv/bin/pip install -r /opt/real-ed-inventory/inventory_app/ui/requirements.txt

4) Place backup script and service
   - Copy `inventory_app/scripts/auto_backup.sh` to `/usr/local/bin/inventory_auto_backup.sh` and make executable.
     sudo cp inventory_app/scripts/auto_backup.sh /usr/local/bin/inventory_auto_backup.sh
     sudo chmod +x /usr/local/bin/inventory_auto_backup.sh
   - Adapt wrapper to point to DB and backup mounts, e.g.
     /usr/local/bin/inventory_auto_backup.sh /opt/real-ed-inventory/sql_inventory_master.db /mnt/backup1 /mnt/backup2 30

5) Install systemd unit and timer
   - Copy `inventory_app/service/inventory-backup.service` and `.timer` to `/etc/systemd/system/` and enable:
     sudo cp inventory_app/service/inventory-backup.service /etc/systemd/system/
     sudo cp inventory_app/service/inventory-backup.timer /etc/systemd/system/
     sudo systemctl daemon-reload
     sudo systemctl enable --now inventory-backup.timer

6) Configure app service (example systemd for web UI)
   - Create `inventory-app.service` to run the app via the venv python. Ensure it runs under `inventory` user and points to `/opt/real-ed-inventory`.

7) Backups & retention
   - Backups created by script are text SQL dumps compressed with gzip.
   - Retention is configured in the script (default 30 days). Adjust as needed.

8) Restore test (critical)
   - Test restore on a staging VM: `gunzip -c /mnt/backup1/sql_inventory_master_YYYYMMDDT....sql.gz | sqlite3 sql_inventory_master.db` or use the restore script.

9) Monitoring
   - Add a simple cron or health-check to ensure timer ran and latest backup exists. Record sizes and timestamps.

Notes / choices
- RAID1 gives automatic redundancy at block level; mirrored copies using the script are simpler to implement without admin privileges.
- For a small team (2–4 concurrent users, infrequent writes) the above is low-cost and reliable.

If you want, I will:
- Wire the repo `auto_backup.sh` into `box_id_manual_registry.py` pre-import, and
- Add a small health-check script to assert recent backup presence and size.
