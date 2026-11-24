@echo off
title Multi-Pipe First-Time Installer
cd /d "%~dp0"

echo ========================================================
echo   Installing dependencies for all 3 Multi-Pipe services
echo ========================================================
echo.
echo [1/3] Installing voice-library...
cd /d "%~dp0voice-library"
call npm install --legacy-peer-deps

echo.
echo [2/3] Installing lanterns-over-rainbridge...
cd /d "%~dp0lanterns-over-rainbridge"
call npm install --legacy-peer-deps

echo.
echo [3/3] Installing kathakunjo...
cd /d "%~dp0kathakunjo"
call npm install --legacy-peer-deps

echo.
echo ========================================================
echo   Installation complete!
echo   1. Add your GEMINI_API_KEY to .env in each folder
echo   2. Double-click start_multi_pipe.bat to launch!
echo ========================================================
pause
