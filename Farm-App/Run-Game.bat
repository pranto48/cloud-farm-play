@echo off
setlocal
cd /d "%~dp0"
if exist "dist-electron\win-unpacked\MeadowLife.exe" (
  start "" "dist-electron\win-unpacked\MeadowLife.exe"
  exit /b
)
if not exist "node_modules\.bin\electron.cmd" (
  call npm.cmd ci
  if errorlevel 1 exit /b 1
)
call npm.cmd start
