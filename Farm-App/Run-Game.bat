@echo off
title Farm-App: Factorio Industrial Simulation Desktop Runner
echo ========================================================
echo   FARM-APP: FACTORIO DESKTOP GAME RUNNER
echo   Direct Hardware-Accelerated Standalone Windows App
echo ========================================================
echo.

cd /d "%~dp0"

if not exist "node_modules" (
    echo [INFO] First time setup: Installing local dependencies...
    call cmd /c npm install
)

if not exist "dist\index.html" (
    echo [INFO] Compiling game engine for Desktop...
    call cmd /c npm run build
)

echo.
echo [INFO] Launching Farm-App Factorio Desktop Client...
call cmd /c npx electron .
