@echo off
setlocal

if /I not "%~1"=="IMPLEMENT" (
  echo BLOCKED: Hard-rule gate active.
  echo Usage: RUN_ADMIN.bat IMPLEMENT
  exit /b 1
)

cd /d "%~dp0"
set "EXE_FILE=%cd%\REAL-ED-Admin.exe"
set "BUILD_BAT=%cd%\BUILD_EXE_AND_PREP.bat"

if not exist "%EXE_FILE%" (
  echo EXE not found. Running build first...
  call "%BUILD_BAT%" IMPLEMENT
  if errorlevel 1 exit /b 1
)

start "REAL-ED Admin" "%EXE_FILE%"
