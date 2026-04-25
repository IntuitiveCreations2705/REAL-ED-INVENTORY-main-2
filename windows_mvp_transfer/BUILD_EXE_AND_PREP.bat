@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

set "APP_DIR=%cd%\inventory_ui"
set "EXE_NAME=REAL-ED-Admin"
set "ICON_FILE=%APP_DIR%\static\app_icon.ico"
set "DIST_EXE=%APP_DIR%\dist\%EXE_NAME%.exe"
set "FINAL_EXE=%cd%\%EXE_NAME%.exe"
set "DB_FILE=%cd%\sql_inventory_master.db"
set "BUILD_LOG=%cd%\build_debug.log"
set "SCRIPT_NAME=%~nx0"

echo. > "%BUILD_LOG%"
echo === MVP BUILD STARTED: %date% %time% === >> "%BUILD_LOG%"
echo [%date% %time%] Script: %SCRIPT_NAME% >> "%BUILD_LOG%"

echo.
echo ============================================
echo REAL-ED-INVENTORY MVP BUILD
echo ============================================
echo.

echo [STEP 1] Verifying transfer package contents...
if not exist "%APP_DIR%\desktop_launcher.py" (
  call :fail_and_exit "Step 1 failed: Missing app files in %APP_DIR%"
  echo ERROR: Missing app files in: %APP_DIR%
  echo.
  echo This should contain: desktop_launcher.py, app.py, templates/, static/, etc.
  echo.
  exit /b 1
)
echo [OK] App files found

if not exist "%ICON_FILE%" (
  call :fail_and_exit "Step 1 failed: Missing icon file %ICON_FILE%"
  echo ERROR: Missing icon file: %ICON_FILE%
  echo.
  exit /b 1
)
echo [OK] Icon found

if not exist "%DB_FILE%" (
  call :fail_and_exit "Step 1 failed: Missing database file %DB_FILE%"
  echo ERROR: Missing database file: %DB_FILE%
  echo.
  exit /b 1
)
echo [OK] Database found

echo.
echo [STEP 2] Checking Python installation...
python --version >> "%BUILD_LOG%" 2>&1
python -m pip --version >> "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  call :fail_and_exit "Step 2 failed: Python not found on PATH or pip check failed"
  echo ERROR: Python not found on PATH, or pip is not working.
  echo.
  echo HOW TO FIX:
  echo   1) Download Python 3.10+ from https://www.python.org/downloads/
  echo   2) During installation, CHECK "Add Python to PATH"
  echo   3) Close and reopen this command window
  echo   4) Try again
  echo.
  exit /b 1
)
for /f "delims=" %%V in ('python -c "import sys; print(str(sys.version_info[0])+'.'+str(sys.version_info[1]))" 2^>nul') do set "PY_VER=%%V"
for /f "tokens=1,2 delims=." %%A in ("%PY_VER%") do (
  set "PY_MAJOR=%%A"
  set "PY_MINOR=%%B"
)
if not "%PY_MAJOR%"=="3" (
  call :fail_and_exit "Step 2 failed: Unsupported major Python version %PY_VER%"
  echo ERROR: Unsupported Python version: %PY_VER%
  echo Use Python 3.10 to 3.13 for this build.
  exit /b 1
)
if %PY_MINOR% LSS 10 (
  call :fail_and_exit "Step 2 failed: Python %PY_VER% is below supported minimum"
  echo ERROR: Python %PY_VER% is too old.
  echo Use Python 3.10 to 3.13 for this build.
  exit /b 1
)
if %PY_MINOR% GEQ 14 (
  call :fail_and_exit "Step 2 failed: Python %PY_VER% is above supported range"
  echo ERROR: Python %PY_VER% is too new for reliable PyInstaller support in this project.
  echo Please install Python 3.12 or 3.13, then rerun this script.
  echo.
  echo Tip: py -3.13 -m pip --version
  exit /b 1
)
echo [OK] Python available
echo [OK] Python version supported: %PY_VER%
python --version

echo.
echo [STEP 3] Checking required Python modules...
python -c "import flask; import PIL" >> "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  echo Installing required packages...
  python -m pip install flask pillow >> "%BUILD_LOG%" 2>&1
  if errorlevel 1 (
    call :fail_and_exit "Step 3 failed: Dependency installation (flask/pillow) failed"
    echo ERROR: Failed to install packages.
    type "%BUILD_LOG%"
    exit /b 1
  )
)
echo [OK] Required modules available

echo.
echo [STEP 4] Installing PyInstaller (may take 30+ seconds)...
python -m pip install --upgrade pyinstaller >> "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  call :fail_and_exit "Step 4 failed: PyInstaller installation failed"
  echo ERROR: Failed to install PyInstaller.
  echo.
  type "%BUILD_LOG%"
  exit /b 1
)
echo [OK] PyInstaller ready

echo.
echo [STEP 5] Cleaning previous build artifacts...
if exist "%APP_DIR%\dist" (
  rmdir /s /q "%APP_DIR%\dist" >> "%BUILD_LOG%" 2>&1
)
if exist "%APP_DIR%\build" (
  rmdir /s /q "%APP_DIR%\build" >> "%BUILD_LOG%" 2>&1
)
echo [OK] Cleaned

echo.
echo [STEP 6] Building EXE with PyInstaller (this may take 1-2 minutes)...
echo Please wait...
pushd "%APP_DIR%"
python -m PyInstaller --noconfirm --clean --onefile --name "%EXE_NAME%" --icon "%ICON_FILE%" --add-data "templates;templates" --add-data "static;static" desktop_launcher.py >> "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  call :fail_and_exit "Step 6 failed: PyInstaller build command returned non-zero exit code"
  echo ERROR: PyInstaller build failed.
  echo.
  echo Showing last 50 lines of build log:
  echo =====================================
  for /f "tokens=*" %%A in ('powershell -NoProfile "Get-Content '%BUILD_LOG%' | Select-Object -Last 50"') do echo %%A
  echo =====================================
  echo.
  popd
  exit /b 1
)
popd
echo [OK] PyInstaller build completed

echo.
echo [STEP 7] Verifying EXE was created...
if not exist "%DIST_EXE%" (
  call :fail_and_exit "Step 7 failed: EXE not created at %DIST_EXE%"
  echo ERROR: EXE not created at: %DIST_EXE%
  echo.
  echo Checking dist folder:
  if exist "%APP_DIR%\dist" (
    dir "%APP_DIR%\dist"
  ) else (
    echo (dist folder is empty or missing)
  )
  echo.
  type "%BUILD_LOG%"
  exit /b 1
)
echo [OK] EXE created

echo.
echo [STEP 8] Copying EXE to transfer folder...
copy /y "%DIST_EXE%" "%FINAL_EXE%" >> "%BUILD_LOG%" 2>&1
if errorlevel 1 (
  call :fail_and_exit "Step 8 failed: Could not copy EXE from %DIST_EXE% to %FINAL_EXE%"
  echo ERROR: Failed to copy EXE to: %FINAL_EXE%
  exit /b 1
)
echo [OK] EXE ready

echo.
echo ============================================
echo BUILD SUCCESSFUL!
echo ============================================
echo.
echo Your REAL-ED-Admin.exe is ready with the golden-ball icon!
echo.
echo Files:
echo   EXE: %FINAL_EXE%
echo   DB:  %DB_FILE%
echo.
echo NEXT STEPS:
echo   1) Right-click REAL-ED-Admin.exe
echo   2) Select "Send to" ^> "Desktop (create shortcut)"
echo   3) Double-click desktop shortcut to launch Admin
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
