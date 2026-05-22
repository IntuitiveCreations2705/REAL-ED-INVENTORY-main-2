REAL-ED MVP Transfer Folder (USB -> Windows)

This folder is designed to be copied as-is onto a Windows PC Desktop.
Keep everything in this same folder.

Contains:
- BUILD_EXE_AND_PREP.bat   (builds icon-branded EXE)
- RUN_ADMIN.bat            (runs EXE, auto-builds if needed)
- sql_inventory_master.db  (database)
- app_icon.ico / app_icon.png
- inventory_ui\            (source UI app used for EXE build)

Windows steps:
1) Copy this whole folder to Desktop on Windows.
2) Open folder.
3) Double-click BUILD_EXE_AND_PREP.bat
4) After build, REAL-ED-Admin.exe appears in this same folder.
5) Right-click REAL-ED-Admin.exe -> Send to -> Desktop (create shortcut)
6) Launch from shortcut.

Note:
- EXE and DB must stay in the same folder.
- Requires Python + pip on Windows for first build.
