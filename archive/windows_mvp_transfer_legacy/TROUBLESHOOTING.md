# Windows Build Troubleshooting Guide

## Problem: No .exe file is created

### Check 1: Python Installation
**Error:** "Python is not available on PATH"

**Solution:**
1. Download Python 3.10+ from https://www.python.org/downloads/
2. **IMPORTANT:** During installation, **CHECK the box** "Add Python to PATH"
3. Close and reopen the command window completely (don't just close the build window)
4. Run this to verify:
   ```cmd
   python --version
   ```

### Check 2: Python Version
**Error:** Old Python version doesn't have required features

**Solution:**
1. Check your Python version:
   ```cmd
   python --version
   ```
2. If it's Python 3.8 or older, uninstall and install Python 3.10+

### Check 3: PyInstaller Issues
**Error:** PyInstaller fails to install or run

**Solution:**
1. Clear pip cache:
   ```cmd
   python -m pip cache purge
   ```
2. Force reinstall PyInstaller:
   ```cmd
   python -m pip install --force-reinstall pyinstaller
   ```

### Check 4: Icon File Missing
**Error:** "Missing icon file"

**Solution:**
1. Verify the file exists in the transfer folder:
   ```cmd
   dir app_icon.ico
   ```
2. If missing, the transfer folder may be corrupted - re-copy from source

### Check 5: Flask Not Installed
**Error:** Python module errors

**Solution:**
```cmd
python -m pip install flask pillow
```

### Check 6: Disk Space
**Error:** Build hangs or fails halfway

**Solution:**
- PyInstaller needs 500MB+ temporarily
- Ensure at least 1GB free space
- Check drive:
   ```cmd
   dir C:\
   ```

### Check 7: Long Paths Issue
**Error:** Paths too long causing build to fail

**Solution:**
Move transfer folder closer to root:
- ✅ `C:\REAL-ED-Transfer` (good)
- ❌ `C:\Users\Name\Desktop\Nested\Folders\Transfer` (bad)

### Check 8: Permission Issues
**Error:** "Access denied" errors

**Solution:**
1. Run command window as Administrator:
   - Right-click `cmd.exe` → "Run as administrator"
2. Try building again

---

## Checking the Build Log

The build script creates `build_debug.log` with error details:

```cmd
type build_debug.log
```

---

## Manual Testing (Debug Mode)

1. **Test Python:**
   ```cmd
   python -c "print('Python works')"
   ```

2. **Test Flask:**
   ```cmd
   python -c "import flask; print(flask.__version__)"
   ```

3. **Test icon file:**
   ```cmd
   dir app_icon.ico
   dir inventory_ui\static\app_icon.ico
   ```

4. **Manual PyInstaller test:**
   ```cmd
   cd inventory_ui
   python -m PyInstaller --noconfirm --clean --onefile ^
     --name REAL-ED-Admin ^
     --icon ..\app_icon.ico ^
     --add-data "templates;templates" ^
     --add-data "static;static" ^
     desktop_launcher.py
   ```

5. **Check result:**
   ```cmd
   dir dist\
   ```

---

## If Build Still Fails

1. Share the output of `build_debug.log`
2. Run and share output of:
   ```cmd
   python --version
   python -m pip list
   dir app_icon.ico
   dir inventory_ui\static\
   ```

3. Include the exact error message from the build window
