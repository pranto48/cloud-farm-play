@echo off
title Farm-App Portable Exe Builder
echo ========================================================
echo   FARM-APP: COMPILING STANDALONE PORTABLE WINDOWS EXE
echo ========================================================
echo.

cd /d "%~dp0"

echo [1/2] Compiling Production Web Engine...
call "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs\npm.cmd" run build

echo [2/2] Packaging Portable Windows Executable...
call "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs\npx.cmd" electron-builder --win portable

echo.
echo ========================================================
echo   BUILD COMPLETE!
echo   Portable Game EXE Location: Farm-App\dist-electron\Farm-App.exe
echo ========================================================
pause
