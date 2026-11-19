@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules\.bin\electron-builder.cmd" (
  call npm.cmd ci
  if errorlevel 1 exit /b 1
)
call npm.cmd run desktop:portable
if errorlevel 1 exit /b 1
echo Portable executable: %CD%\dist-electron\MeadowLife-Portable.exe
