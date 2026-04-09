-- Migration: Add team_admin_notes column to master_inventory
-- Date: 2026-04-09
-- Purpose: Enable global Team/Admin Notes accessible from any UI for personnel communication

ALTER TABLE master_inventory
ADD COLUMN team_admin_notes TEXT DEFAULT '';
