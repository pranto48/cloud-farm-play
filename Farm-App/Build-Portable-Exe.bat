@echo off
title Farm-App Portable Exe Builder
echo ========================================================
echo   FARM-APP: COMPILING STANDALONE PORTABLE WINDOWS EXE
echo ========================================================
echo.

set "PATH=C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;%PATH%"
cd /d "%~dp0"

if not exist "node_modules" (
    echo [INFO] Installing build dependencies...
    call npm install
)

echo [1/2] Compiling Production Web Engine...
call npm run build

echo [2/2] Packaging Portable Windows Executable...
call npx electron-builder --win portable

echo.
echo ========================================================
echo   BUILD COMPLETE!
echo   Portable Game EXE Location: Farm-App\dist-electron\Farm-App.exe
echo ========================================================
pause
