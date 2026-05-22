@echo off
setlocal

cd /d "%~dp0"

set "OUTPUT_NAME=REAL-ED-Admin"
for %%I in ("%cd%\..\..") do set "PROJECT_ROOT=%%~fI"
set "APP_FOLDER=%PROJECT_ROOT%\windows_admin_app"
set "ICON_FILE=%cd%\static\app_icon.ico"
set "ICON_PNG=%cd%\static\app_icon.png"
set "DIST_EXE=%cd%\dist\%OUTPUT_NAME%.exe"
set "APP_EXE=%APP_FOLDER%\%OUTPUT_NAME%.exe"
set "PRIMARY_DB=%PROJECT_ROOT%\sql_inventory_master.db"
set "FALLBACK_DB=%cd%\sql_inventory_master.db"
set "APP_DB=%APP_FOLDER%\sql_inventory_master.db"
set "APP_ICON_ICO=%APP_FOLDER%\app_icon.ico"
set "APP_ICON_PNG=%APP_FOLDER%\app_icon.png"

echo [1/4] Ensuring pip is available...
python -m pip --version >nul 2>&1
if errorlevel 1 (
  echo Python is not available on PATH.
  exit /b 1
)

echo [2/4] Checking icon assets...
if not exist "%ICON_FILE%" (
  echo Missing icon file: %ICON_FILE%
  echo Place app_icon.ico in inventory_app\ui\static before building.
  exit /b 1
)

if not exist "%APP_FOLDER%" mkdir "%APP_FOLDER%"

echo [3/4] Installing build dependency (PyInstaller)...
python -m pip install --upgrade pyinstaller
if errorlevel 1 exit /b 1

echo [4/4] Building standalone launcher EXE...
python -m PyInstaller --noconfirm --clean --onefile --name "%OUTPUT_NAME%" --icon "%ICON_FILE%" --add-data "templates;templates" --add-data "static;static" desktop_launcher.py
if errorlevel 1 exit /b 1

if not exist "%DIST_EXE%" (
  echo Build reported success, but EXE was not found at:
  echo   %DIST_EXE%
  exit /b 1
)

copy /y "%DIST_EXE%" "%APP_EXE%" >nul
if errorlevel 1 (
  echo EXE built, but copy to app folder failed.
  echo Built EXE: %DIST_EXE%
  exit /b 1
)

copy /y "%ICON_FILE%" "%APP_ICON_ICO%" >nul
if exist "%ICON_PNG%" copy /y "%ICON_PNG%" "%APP_ICON_PNG%" >nul

if exist "%PRIMARY_DB%" (
  copy /y "%PRIMARY_DB%" "%APP_DB%" >nul
) else (
  if exist "%FALLBACK_DB%" (
    copy /y "%FALLBACK_DB%" "%APP_DB%" >nul
  ) else (
    echo Warning: sql_inventory_master.db was not found to copy into the app folder.
  )
)

echo.
echo Build complete.
echo UI dist EXE: %DIST_EXE%
echo Canonical app folder: %APP_FOLDER%
echo Packaged EXE: %APP_EXE%
echo Packaged DB: %APP_DB%
echo Packaged icon: %APP_ICON_ICO%
echo.
echo Next:
echo   1) Open %APP_FOLDER%
echo   2) Use %APP_EXE%
echo      (DB is kept beside the EXE in the same folder)
echo   3) Right-click EXE ^> Send to ^> Desktop (create shortcut)
echo   4) Double-click shortcut to open Admin.
