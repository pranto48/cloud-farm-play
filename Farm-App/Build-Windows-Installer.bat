@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\.bin\electron-builder.cmd" (
  call npm.cmd ci
  if errorlevel 1 exit /b 1
)
call npm.cmd run desktop:build
if errorlevel 1 exit /b 1
echo Installer: %CD%\dist-electron\MeadowLife-Setup-1.2.0-x64.exe
