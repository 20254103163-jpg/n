@echo off
title Voice Library - AI Studio
echo ========================================================
echo   Starting Voice Library with Gemini API...
echo ========================================================
cd /d "%~dp0"
call npm run dev
pause
