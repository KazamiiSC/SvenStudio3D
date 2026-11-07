@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title SvenStudio 3D v1.4.0 HF15 Preview 2 HF5

rem A .bat cannot contain an icon. On first start, create an icon-bearing .lnk.
rem The shortcut uses the bundled SvenStudio3D.ico. Any failure is harmless.
if not exist "%~dp0SvenStudio3D.lnk" (
  if exist "%~dp0SvenStudio3D.ico" (
    powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%~dp0scripts\create-shortcut.ps1" >nul 2>nul
  )
)

rem Always use the folder containing this launcher.
pushd "%~dp0"
if errorlevel 1 goto :bad_folder

echo ==================================================
echo SvenStudio 3D v1.4.0 HF15 Preview 2 HF5 - Windows launcher
echo ==================================================
echo Folder: %CD%
echo.

where node.exe >nul 2>nul
if errorlevel 1 goto :no_node
where npm.cmd >nul 2>nul
if errorlevel 1 goto :no_npm
node -e "process.exit(Number(process.versions.node.split('.')[0])>=22?0:1)"
if errorlevel 1 goto :old_node
if not exist "package.json" goto :no_project

echo [INFO] Node version:
node --version
echo.

rem Some Windows archives shipped with incomplete dependency folders.
rem Check executable JS rather than only the package directory.
set "NEED_DEPS=0"
if not exist "node_modules\vite\bin\vite.js" set "NEED_DEPS=1"
if not exist "node_modules\lucide-react\dist\cjs\lucide-react.js" set "NEED_DEPS=1"
if not exist "node_modules\@react-three\fiber\dist\react-three-fiber.cjs.js" set "NEED_DEPS=1"
if not exist "node_modules\.bin\concurrently.cmd" set "NEED_DEPS=1"
if "%NEED_DEPS%"=="1" goto :install_deps
goto :start_editor

:install_deps
echo [INFO] Some dependencies are missing or incomplete.
echo [INFO] Installing them now. Internet connection required.
echo [INFO] This may take a while on the first launch.
echo.
call npm ci
if errorlevel 1 goto :install_failed
if not exist "node_modules\lucide-react\dist\cjs\lucide-react.js" goto :install_incomplete
if not exist "node_modules\@react-three\fiber\dist\react-three-fiber.cjs.js" goto :install_incomplete
if not exist "node_modules\vite\bin\vite.js" goto :install_incomplete
echo.
echo [OK] Dependencies installed successfully.
echo.
goto :start_editor

:start_editor
echo [INFO] Starting web editor and local server...
echo [INFO] Keep this window open while using SvenStudio 3D.
echo [INFO] The browser should open automatically.
echo.
call npm run dev
set "START_EXIT=%ERRORLEVEL%"
echo.
if not "%START_EXIT%"=="0" echo [ERROR] SvenStudio 3D stopped with error code %START_EXIT%.
if "%START_EXIT%"=="0" echo [INFO] SvenStudio 3D has stopped.
goto :finish

:no_node
echo [ERROR] Node.js is missing. Install Node.js 22 or newer.
echo [INFO] https://nodejs.org/
set "START_EXIT=1"
goto :finish

:old_node
echo [ERROR] Node.js 22 or newer is required.
echo [INFO] Your current version:
node --version
set "START_EXIT=1"
goto :finish

:no_npm
echo [ERROR] npm was not found. Repair or reinstall Node.js 22+.
set "START_EXIT=1"
goto :finish

:no_project
echo [ERROR] package.json is missing.
echo [INFO] Extract the FULL SvenStudio 3D ZIP before running this file.
set "START_EXIT=1"
goto :finish

:install_failed
echo.
echo [ERROR] npm ci failed. Read the error above.
echo [INFO] Check Internet access, antivirus and npm configuration.
set "START_EXIT=1"
goto :finish

:install_incomplete
echo.
echo [ERROR] npm ci finished but key dependencies are still incomplete.
echo [INFO] Try deleting node_modules and running this launcher again.
set "START_EXIT=1"
goto :finish

:bad_folder
echo [ERROR] Cannot access the SvenStudio 3D folder.
set "START_EXIT=1"
goto :finish

:finish
echo.
echo ==================================================
echo This window will stay open so you can read messages.
echo Press any key to close it.
echo ==================================================
pause >nul
popd
endlocal
exit /b %START_EXIT%
