@echo off
echo.
echo ========================================
echo   OpenAI Codex Auth Token Export
echo ========================================
echo.

if not exist "%USERPROFILE%\.codex\auth.json" (
    echo ERROR: Codex auth file not found.
    echo Please run "codex login" first in your terminal.
    echo.
    pause
    exit /b 1
)

copy "%USERPROFILE%\.codex\auth.json" "%USERPROFILE%\Desktop\codex-auth.json" >nul
echo Done! File saved to your Desktop as: codex-auth.json
echo.
echo Please send this file to Lorenzo.
echo.
pause
