# Windows Build Troubleshooting Guide

## Problem: No .exe file is created

### Check 1: Python Installation
**Error:** "Python is not available on PATH"

**Solution:**
1. Download Python 3.10+ from https://www.python.org/downloads/
2. **IMPORTANT:** During installation, **CHECK the box** "Add Python to PATH"
3. Close and reopen the command window
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
**Error:** "Missing icon file: static\app_icon.ico"

**Solution:**
1. Verify the file exists:
   ```cmd
   dir inventory_app\ui\static\app_icon.ico
   ```
2. If missing, copy from source:
   - Check that `inventory_app/ui/static/app_icon.ico` exists
   - If not, re-download the project

### Check 5: Desktop Launcher Issues
**Error:** Build fails with module or syntax error

**Solution:**
1. Test the app manually:
   ```cmd
   cd inventory_app\ui
   python app.py
   ```
2. If that fails, install missing dependencies:
   ```cmd
   python -m pip install flask pillow
   ```

### Check 6: Disk Space
**Error:** Build hangs or fails halfway

**Solution:**
- PyInstaller build can use 500MB+ temporarily
- Ensure you have at least 1GB free disk space
- Check `C:` drive has space:
   ```cmd
   dir C:\
   ```

### Check 7: Long Paths
**Error:** Paths too long or special characters cause issues

**Solution:**
1. Move project folder closer to root:
   - ✅ `C:\REAL-ED-INVENTORY` (good)
   - ❌ `C:\Users\Name\Desktop\Folder\Nested\REAL-ED-INVENTORY` (too deep)

2. Avoid folder names with spaces or special characters

### Check 8: Permission Issues
**Error:** "Access denied" when copying files

**Solution:**
1. Run command window as Administrator:
   - Right-click `cmd.exe` → "Run as administrator"
2. Try building again

---

## Checking the Build Log

The script now creates `build_debug.log` with detailed error info:

```cmd
type build_debug.log
```

**Common log messages:**
- `error: invalid icon file 'path'` → Icon format issue
- `ModuleNotFoundError: No module named 'flask'` → Missing dependency
- `command not found: pyinstaller` → PyInstaller not installed

---

## Step-by-Step Debug Process

1. **Verify Python works:**
   ```cmd
   python -c "print('Python works')"
   ```

2. **Verify pip works:**
   ```cmd
   python -m pip --version
   ```

3. **Verify Flask is available:**
   ```cmd
   python -c "import flask; print(flask.__version__)"
   ```

4. **Verify icon file:**
   ```cmd
   dir inventory_app\ui\static\app_icon.ico
   ```

5. **Try manual PyInstaller build (for debugging):**
   ```cmd
   cd inventory_app\ui
   python -m PyInstaller --noconfirm --clean --onefile ^
     --name REAL-ED-Admin ^
     --icon static\app_icon.ico ^
     --add-data "templates;templates" ^
     --add-data "static;static" ^
     desktop_launcher.py
   ```

6. **Check output:**
   ```cmd
   dir dist\
   ```

---

## If Still Stuck

1. Share the `build_debug.log` file content
2. Include output of:
   ```cmd
   python --version
   python -m pip --version
   dir inventory_app\ui\static\
   ```

3. Include the exact error message from the command window
