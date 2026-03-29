@echo off
setlocal enabledelayedexpansion
:: ============================================================
:: Watch in VLC - Setup Script
:: Run this ONCE after installing the Chrome extension.
:: It registers a small helper so Chrome can launch VLC directly.
:: ============================================================

echo ============================================
echo  Watch in VLC - Setup
echo ============================================
echo.

:: --- Find Python ---
set PYTHON=
for %%p in (python python3) do (
    if not defined PYTHON (
        %%p --version >nul 2>&1 && set PYTHON=%%p
    )
)
if not defined PYTHON (
    echo ERROR: Python is not installed or not on PATH.
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during install.
    pause
    exit /b 1
)
echo [OK] Python found: %PYTHON%

:: --- Find VLC ---
set "VLC_PATH="
if exist "C:\Program Files\VideoLAN\VLC\vlc.exe" (
    set "VLC_PATH=C:\Program Files\VideoLAN\VLC\vlc.exe"
) else if exist "C:\Program Files (x86)\VideoLAN\VLC\vlc.exe" (
    set "VLC_PATH=C:\Program Files (x86)\VideoLAN\VLC\vlc.exe"
)
if not defined VLC_PATH (
    echo VLC not found in default locations.
    echo Enter the full path to vlc.exe:
    set /p "VLC_PATH=Path: "
)
if not exist "%VLC_PATH%" (
    echo ERROR: VLC not found at "%VLC_PATH%"
    pause
    exit /b 1
)
echo [OK] VLC found: %VLC_PATH%

:: --- Get extension directory ---
set "EXT_DIR=%~dp0"
if "%EXT_DIR:~-1%"=="\" set "EXT_DIR=%EXT_DIR:~0,-1%"

:: --- Get extension ID from Chrome ---
echo.
echo ----------------------------------------
echo IMPORTANT: You need your Chrome extension ID.
echo.
echo 1. Open Chrome and go to: chrome://extensions
echo 2. Find "Watch in VLC" and copy the ID
echo    (looks like: abcdefghijklmnopqrstuvwxyz123456)
echo ----------------------------------------
echo.
set /p "EXT_ID=Paste your extension ID here: "

:: --- Write the wrapper batch file ---
set "WRAPPER=%EXT_DIR%\vlc_host_wrapper.bat"
(
echo @echo off
echo %PYTHON% "%EXT_DIR%\vlc_host.py"
) > "%WRAPPER%"

:: --- Write the native messaging manifest ---
set "MANIFEST=%EXT_DIR%\com.vlc.opener.json"
set "WRAPPER_ESC=%WRAPPER:\=\\%"
(
echo {
echo   "name": "com.vlc.opener",
echo   "description": "Watch in VLC native messaging host",
echo   "path": "%WRAPPER_ESC%",
echo   "type": "stdio",
echo   "allowed_origins": [
echo     "chrome-extension://%EXT_ID%/"
echo   ]
echo }
) > "%MANIFEST%"

echo [OK] Manifest written.

:: --- Register in Windows registry ---
reg add "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.vlc.opener" /ve /d "%MANIFEST%" /f >nul

if %errorlevel% == 0 (
    echo [OK] Registered with Chrome.
) else (
    echo ERROR: Failed to write to registry.
    pause
    exit /b 1
)

echo.
echo ============================================
echo  Setup complete!
echo  Now reload the extension in chrome://extensions
echo  (click the refresh icon on the Watch in VLC card^)
echo ============================================
echo.
pause
