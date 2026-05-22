@echo off
setlocal

if /I not "%~1"=="IMPLEMENT" (
	echo BLOCKED: Hard-rule gate active.
	echo Usage: build_windows_admin_exe.bat IMPLEMENT
	exit /b 1
)

cd /d "%~dp0"
if not exist "%cd%\windows_admin_app" mkdir "%cd%\windows_admin_app"
call "inventory_app\ui\build_windows_exe.bat" IMPLEMENT
exit /b %errorlevel%