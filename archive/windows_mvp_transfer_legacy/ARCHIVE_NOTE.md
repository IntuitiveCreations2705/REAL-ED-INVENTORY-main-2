# Archive Note: windows_mvp_transfer

**Status:** ARCHIVED — Reference only, no longer maintained

This folder contains legacy Windows MVP build artifacts and scripts from an earlier phase of the project.

## Use cases:
- **Historical reference** — view how the Windows build was structured
- **Documentation** — understand the MVP transfer workflow if needed
- **NOT FOR PRODUCTION** — moving forward, all development uses the main Linux/macOS codebase

## Key files in this archive:
- `BUILD_EXE_AND_PREP.bat` — Windows executable build script (historical)
- `RUN_ADMIN.bat` — Windows startup script (historical)
- `inventory_ui/` — Duplicate of the inventory_app/ui structure (archived copy)

## Current development:
All ongoing work is in `/inventory_app/ui/` at the project root.

## Migration note:
If you need functionality from this archive, check `/inventory_app/ui/` first. If it exists there, use that version. If it does not exist, this archive may have historical context, but new features should be implemented in the main codebase, not here.

---

**Last reviewed:** 2026-05-24  
**Decision:** Archive as reference-only; mark all duplicates in this folder as historical.
