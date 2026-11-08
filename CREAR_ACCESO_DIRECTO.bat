@echo off
setlocal EnableExtensions DisableDelayedExpansion
pushd "%~dp0" || exit /b 1
if not exist "scripts\create-shortcut.ps1" (
  echo [ERROR] Falta scripts\create-shortcut.ps1
  pause
  exit /b 1
)
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%CD%\scripts\create-shortcut.ps1"
if errorlevel 1 (
  echo [ERROR] No se pudo crear el acceso directo.
  pause
  exit /b 1
)
echo [OK] Acceso directo SvenStudio3D.lnk actualizado en esta carpeta.
pause
