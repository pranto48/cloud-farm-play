@echo off
title Farm-App Desktop Builder
echo ========================================================
echo   FARM-APP: COMPILING STANDALONE WINDOWS APP
echo ========================================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [INFO] Installing build dependencies...
    call cmd /c npm install
)

echo [1/2] Compiling Production Web Engine...
call cmd /c npm run build

echo [2/2] Packaging Standalone Windows Executable (win-unpacked)...
call cmd /c npx electron-builder --win dir

echo.
echo ========================================================
echo   BUILD COMPLETE!
echo   Standalone Game EXE Location:
echo   Farm-App\dist-electron\win-unpacked\Farm-App.exe
echo ========================================================
pause
