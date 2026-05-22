@echo off
setlocal

if /I not "%~1"=="IMPLEMENT" (
	echo BLOCKED: Hard-rule gate active.
	echo Usage: run_admin_launcher.bat IMPLEMENT
	exit /b 1
)

cd /d "%~dp0"

python run_admin.py IMPLEMENT
