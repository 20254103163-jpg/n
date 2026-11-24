@echo off
title Multi-Pipe Studio Launcher (Voice Library + Rainbridge + Kathakunjo)
cd /d "%~dp0"

echo ========================================================
echo   Starting Multi-Pipe Bangla Story & Animation Studio
echo ========================================================
echo.
echo [1/3] Launching Voice Library (Port 3000, Default: Fenrir)...
start "Voice Library (:3000)" cmd /k "cd /d "%~dp0voice-library" && npm run dev"

echo [2/3] Launching Rainbridge 2D Animation Engine (Port 3001)...
start "Rainbridge 2D Animation (:3001)" cmd /k "cd /d "%~dp0lanterns-over-rainbridge" && npm run dev"

echo [3/3] Launching Kathakunjo Story Studio (Port 3002)...
start "Kathakunjo Story Studio (:3002)" cmd /k "cd /d "%~dp0kathakunjo" && npm run dev"

echo.
echo Waiting 5 seconds for servers to initialize...
timeout /t 5 /nobreak > nul

start http://localhost:3002

echo.
echo All 3 Multi-Pipe services are running!
echo   - Kathakunjo Studio : http://localhost:3002
echo   - 2D Animation      : http://localhost:3001
echo   - Voice Library     : http://localhost:3000
echo ========================================================
pause
