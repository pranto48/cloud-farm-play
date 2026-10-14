@echo off
title Farm-App Portable Exe Builder
echo ========================================================
echo   FARM-APP: COMPILING STANDALONE PORTABLE WINDOWS EXE
echo ========================================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [INFO] Installing build dependencies...
    call cmd /c npm install
)

echo [1/2] Compiling Production Web Engine...
call cmd /c npm run build

echo [2/2] Packaging Standalone Portable Windows Executable...
call cmd /c npx electron-builder --win portable

echo.
echo ========================================================
echo   BUILD COMPLETE!
echo   Portable Game EXE Location: Farm-App\dist-electron\Farm-App.exe
echo ========================================================
pause
