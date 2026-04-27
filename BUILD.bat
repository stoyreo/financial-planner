@echo off
cd /d "%~dp0"
echo ===================================
echo Running npm run build...
echo ===================================
call npm run build
echo.
echo ===================================
echo Build complete. Check output above.
echo ===================================
pause
