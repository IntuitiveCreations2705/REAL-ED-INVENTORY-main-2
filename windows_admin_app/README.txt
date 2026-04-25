REAL-ED Windows Admin app folder

This is the canonical packaged Windows app folder.

Keep these files together here:
- REAL-ED-Admin.exe
- sql_inventory_master.db
- app_icon.ico

Source code still lives in:
- inventory_app/ui/

Build from Windows using:
- build_windows_admin_exe.bat

That build script copies the EXE and the database into this folder automatically.

It also copies the icon assets into this folder so the packaged app resources stay together.
