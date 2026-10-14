@echo off
title CloudFarm Arcade - Factorio Desktop Game Launcher
echo ========================================================
echo   CLOUDFARM ARCADE: FACTORIO DESKTOP EDITION
echo   Direct Standalone Windows Hardware-Accelerated App
echo ========================================================
echo.

cd /d "%~dp0Farm-App"

if exist "dist-electron\win-unpacked\Farm-App.exe" (
    echo [INFO] Starting Standalone Windows Desktop App...
    start "" "dist-electron\win-unpacked\Farm-App.exe"
    exit /b
)

echo [INFO] Running Farm-App Desktop Runner...
call Run-Game.bat
