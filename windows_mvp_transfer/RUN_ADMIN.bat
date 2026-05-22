@echo off
setlocal

cd /d "%~dp0"
set "EXE_FILE=%cd%\REAL-ED-Admin.exe"
set "BUILD_BAT=%cd%\BUILD_EXE_AND_PREP.bat"

if not exist "%EXE_FILE%" (
  echo EXE not found. Running build first...
  call "%BUILD_BAT%"
  if errorlevel 1 exit /b 1
)

start "REAL-ED Admin" "%EXE_FILE%"
