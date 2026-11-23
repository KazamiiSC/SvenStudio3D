@echo off
setlocal
cd /d "%~dp0.."
if exist "START_WINDOWS.bat" (
  echo Eliminando el antiguo START_WINDOWS.bat...
  del /f /q "START_WINDOWS.bat"
)
echo Ejecuta SvenStudio3D.bat para iniciar el editor.
echo El primer inicio creara SvenStudio3D.lnk con icono propio.
pause
