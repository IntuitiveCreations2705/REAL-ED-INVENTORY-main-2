@echo off
setlocal enabledelayedexpansion

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
set "BUILD_LOG=%cd%\build_debug.log"
set "SCRIPT_NAME=%~nx0"

echo. > "%BUILD_LOG%"
echo === BUILD STARTED: %date% %time% === >> "%BUILD_LOG%"
echo [%date% %time%] Script: %SCRIPT_NAME% >> "%BUILD_LOG%"

echo [STEP 1] Checking Python and pip availability...
python --version >> "%BUILD_LOG%" 2>&1
python -m pip --version >> "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  call :fail_and_exit "Step 1 failed: Python is unavailable on PATH or pip is broken"
  echo ERROR: Python is not available on PATH or pip is broken.
  echo Please ensure Python 3.9+ is installed and added to Windows PATH.
  echo.
  echo How to fix:
  echo   1) Download Python from https://www.python.org/downloads/
  echo   2) During installation, CHECK "Add Python to PATH"
  echo   3) Close and reopen this command window
  echo   4) Run this script again
  echo.
  exit /b 1
)
for /f "delims=" %%V in ('python -c "import sys; print(str(sys.version_info[0])+'.'+str(sys.version_info[1]))" 2^>nul') do set "PY_VER=%%V"
for /f "tokens=1,2 delims=." %%A in ("%PY_VER%") do (
  set "PY_MAJOR=%%A"
  set "PY_MINOR=%%B"
)
if not "%PY_MAJOR%"=="3" (
  call :fail_and_exit "Step 1 failed: Unsupported major Python version %PY_VER%"
  echo ERROR: Unsupported Python version: %PY_VER%
  echo Use Python 3.10 to 3.13 for this build.
  exit /b 1
)
if %PY_MINOR% LSS 10 (
  call :fail_and_exit "Step 1 failed: Python %PY_VER% is below supported minimum"
  echo ERROR: Python %PY_VER% is too old.
  echo Use Python 3.10 to 3.13 for this build.
  exit /b 1
)
if %PY_MINOR% GEQ 14 (
  call :fail_and_exit "Step 1 failed: Python %PY_VER% is above supported range"
  echo ERROR: Python %PY_VER% is too new for reliable PyInstaller support in this project.
  echo Please install Python 3.12 or 3.13, then rerun this script.
  echo.
  echo Tip: py -3.13 -m pip --version
  exit /b 1
)
echo [OK] Python available
echo [OK] Python version supported: %PY_VER%
python -m pip --version

echo.
echo [STEP 2] Checking icon assets...
if not exist "%ICON_FILE%" (
  call :fail_and_exit "Step 2 failed: Missing icon file at %ICON_FILE%"
  echo ERROR: Missing icon file at:
  echo   %ICON_FILE%
  echo.
  echo This file must exist before building. 
  echo Check that inventory_app\ui\static\app_icon.ico exists.
  echo.
  exit /b 1
)
echo [OK] Icon file found: %ICON_FILE%

echo.
echo [STEP 3] Checking desktop_launcher.py...
if not exist "%cd%\desktop_launcher.py" (
  call :fail_and_exit "Step 3 failed: Missing desktop_launcher.py at %cd%\desktop_launcher.py"
  echo ERROR: Missing desktop_launcher.py
  echo Expected at: %cd%\desktop_launcher.py
  echo.
  exit /b 1
)
echo [OK] desktop_launcher.py found

echo.
echo [STEP 4] Creating output folder...
if not exist "%APP_FOLDER%" (
  mkdir "%APP_FOLDER%"
  if errorlevel 1 (
    call :fail_and_exit "Step 4 failed: Could not create output folder %APP_FOLDER%"
    echo ERROR: Failed to create output folder: %APP_FOLDER%
    exit /b 1
  )
)
echo [OK] Output folder ready: %APP_FOLDER%

echo.
echo [STEP 5] Checking dependencies (Flask, etc.)...
python -c "import flask; import PIL; print('Flask version: ' + flask.__version__)" >> "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  echo ERROR: Flask/Pillow modules missing. Installing required packages...
  python -m pip install flask pillow >> "%BUILD_LOG%" 2>&1
  if errorlevel 1 (
    call :fail_and_exit "Step 5 failed: Dependency installation (flask/pillow) failed"
    echo ERROR: Failed to install dependencies.
    echo.
    type "%BUILD_LOG%"
    echo.
    exit /b 1
  )
)
echo [OK] Required dependencies available

echo.
echo [STEP 6] Cleaning previous build artifacts...
if exist "%cd%\dist" (
  rmdir /s /q "%cd%\dist" >> "%BUILD_LOG%" 2>&1
)
if exist "%cd%\build" (
  rmdir /s /q "%cd%\build" >> "%BUILD_LOG%" 2>&1
)
echo [OK] Cleaned

echo.
echo [STEP 7] Installing PyInstaller (may take 30+ seconds)...
python -m pip install --upgrade pyinstaller >> "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  call :fail_and_exit "Step 7 failed: PyInstaller installation failed"
  echo ERROR: Failed to install PyInstaller.
  echo.
  type "%BUILD_LOG%"
  echo.
  exit /b 1
)
echo [OK] PyInstaller installed

echo.
echo [STEP 8] Building EXE with PyInstaller (this may take 1-2 minutes)...
echo Please wait...
python -m PyInstaller --noconfirm --clean --onefile --name "%OUTPUT_NAME%" --icon "%ICON_FILE%" --add-data "templates;templates" --add-data "static;static" desktop_launcher.py >> "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  call :fail_and_exit "Step 8 failed: PyInstaller build command returned non-zero exit code"
  echo ERROR: PyInstaller build failed. Check build_debug.log for details.
  echo.
  echo Showing last 50 lines of build log:
  echo =====================================
  for /f "tokens=*" %%A in ('powershell -NoProfile "Get-Content '%BUILD_LOG%' | Select-Object -Last 50"') do echo %%A
  echo =====================================
  echo.
  exit /b 1
)
echo [OK] PyInstaller completed

echo.
echo [STEP 9] Verifying EXE was created...
if not exist "%DIST_EXE%" (
  call :fail_and_exit "Step 9 failed: Expected EXE not found at %DIST_EXE%"
  echo ERROR: Build reported success, but EXE not found at:
  echo   %DIST_EXE%
  echo.
  echo Checking dist folder contents:
  dir "%cd%\dist\" 2>nul || echo   (dist folder is empty or missing)
  echo.
  type "%BUILD_LOG%"
  echo.
  exit /b 1
)
echo [OK] EXE created: %DIST_EXE%

echo.
echo [STEP 10] Copying EXE to app folder...
copy /y "%DIST_EXE%" "%APP_EXE%" >> "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  call :fail_and_exit "Step 10 failed: Could not copy EXE from %DIST_EXE% to %APP_EXE%"
  echo ERROR: Failed to copy EXE to app folder.
  echo   From: %DIST_EXE%
  echo   To:   %APP_EXE%
  echo.
  exit /b 1
)
echo [OK] EXE copied to: %APP_EXE%

echo.
echo [STEP 11] Copying icon assets...
copy /y "%ICON_FILE%" "%APP_ICON_ICO%" >> "%BUILD_LOG%" 2>&1
if exist "%ICON_PNG%" copy /y "%ICON_PNG%" "%APP_ICON_PNG%" >> "%BUILD_LOG%" 2>&1
echo [OK] Icons copied

echo.
echo [STEP 12] Copying database...
if exist "%PRIMARY_DB%" (
  copy /y "%PRIMARY_DB%" "%APP_DB%" >> "%BUILD_LOG%" 2>&1
  echo [OK] Database copied from: %PRIMARY_DB%
) else (
  if exist "%FALLBACK_DB%" (
    copy /y "%FALLBACK_DB%" "%APP_DB%" >> "%BUILD_LOG%" 2>&1
    echo [OK] Database copied from fallback: %FALLBACK_DB%
  ) else (
    echo [WARNING] Database not found. App will create a new one on first run.
  )
)

echo.
echo ============================================
echo BUILD SUCCESSFUL!
echo ============================================
echo.
echo Location: %APP_FOLDER%
echo.
echo Files created:
echo   - %APP_EXE%
echo   - %APP_DB%
echo   - %APP_ICON_ICO%
echo.
echo Next steps:
echo   1) Open folder: %APP_FOLDER%
echo   2) Right-click REAL-ED-Admin.exe
echo   3) Select "Send to" ^> "Desktop (create shortcut)"
echo   4) Double-click the shortcut to launch Admin
echo.
echo Debug log: %BUILD_LOG%
echo.
echo [%date% %time%] EXIT: SUCCESS - Build completed >> "%BUILD_LOG%"
pause

goto :eof

:fail_and_exit
set "FAIL_REASON=%~1"
echo [%date% %time%] EXIT: FAILURE - !FAIL_REASON! >> "%BUILD_LOG%"
exit /b 0
