@echo off
setlocal

cd /d "%~dp0"

echo [1/3] Ensuring pip is available...
python -m pip --version >nul 2>&1
if errorlevel 1 (
  echo Python is not available on PATH.
  exit /b 1
)

echo [2/3] Installing build dependency (PyInstaller)...
python -m pip install --upgrade pyinstaller
if errorlevel 1 exit /b 1

echo [3/3] Building standalone launcher EXE...
python -m PyInstaller --noconfirm --clean --onefile --name REAL-ED-Admin --add-data "templates;templates" --add-data "static;static" desktop_launcher.py
if errorlevel 1 exit /b 1

echo.
echo Build complete.
echo EXE path: %cd%\dist\REAL-ED-Admin.exe
echo.
echo Next:
echo   1) Copy dist\REAL-ED-Admin.exe to your project root

echo      (same folder as sql_inventory_master.db)
echo   2) Right-click EXE ^> Send to ^> Desktop (create shortcut)
echo   3) Double-click shortcut to open Admin.
