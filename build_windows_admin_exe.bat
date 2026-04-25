@echo off
setlocal

cd /d "%~dp0"
if not exist "%cd%\windows_admin_app" mkdir "%cd%\windows_admin_app"
call "inventory_app\ui\build_windows_exe.bat"
exit /b %errorlevel%