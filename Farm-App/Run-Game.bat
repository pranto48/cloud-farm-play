@echo off
title Farm-App: Factorio Industrial Simulation Desktop Runner
echo ========================================================
echo   FARM-APP: FACTORIO DESKTOP GAME EDITION
echo   Direct Hardware-Accelerated Standalone Runner
echo ========================================================
echo.

set "PATH=C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs;%PATH%"
cd /d "%~dp0"

if not exist "node_modules" (
    echo [INFO] First time setup: Installing local dependencies...
    call npm install
)

echo [INFO] Starting Desktop Game Client...
call npm run dev
