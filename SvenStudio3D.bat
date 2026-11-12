@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title SvenStudio 3D v2.0
pushd "%~dp0"
if errorlevel 1 goto :bad_folder
set "START_EXIT=1"
rem Detect Windows UI language (en/es/ru/ko/zh/pt; fallback en).
set "I18N_FILE=%TEMP%\svenstudio-launch-%RANDOM%-%RANDOM%.cmd"
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%CD%\scripts\launcher-i18n.ps1" "%I18N_FILE%" >nul 2>nul
if exist "%I18N_FILE%" (
  call "%I18N_FILE%"
  del /q "%I18N_FILE%" >nul 2>nul
) else (
  set "MSG_FIRST=First launch: downloading the official Node.js runtime."
  set "MSG_INTERNET=Internet is only needed for this download."
  set "MSG_LOCAL=Local Node.js:"
  set "MSG_NOGLOBAL=No globally installed Node.js or npm is used."
  set "MSG_SERVER=API server: 127.0.0.1:49177; editor: 127.0.0.1:5173."
  set "MSG_KEEP=Keep this window open while using the editor."
  set "MSG_CLOSED=SvenStudio exited with code"
  set "MSG_ENDED=SvenStudio stopped normally."
  set "MSG_MISSING=Incomplete project: missing package.json or server\index.js."
  set "MSG_MODULES=Required Windows dependencies are missing from node_modules."
  set "MSG_EXTRACT=Extract the complete ZIP; do not run npm install."
  set "MSG_DOWNLOAD=The local Node.js runtime could not be prepared."
  set "MSG_RETRY=Connect to the Internet and run the launcher again."
  set "MSG_ALTERNATIVE=Alternative: put the official Windows x64 Node.js 22.16.0 node.exe in runtime\."
  set "MSG_INVALID=runtime\node.exe is invalid or older than Node.js 22."
  set "MSG_FOLDER=Cannot access the application folder."
  set "MSG_PRESS=Press any key to close this window."
)
echo ==================================================
echo SvenStudio 3D v2.0
echo ==================================================
echo.
if not exist "package.json" goto :missing_project
if not exist "server\index.js" goto :missing_project
if not exist "node_modules\concurrently\dist\bin\concurrently.js" goto :missing_modules
if not exist "node_modules\vite\bin\vite.js" goto :missing_modules
if not exist "node_modules\lucide-react\dist\cjs\lucide-react.js" goto :missing_modules
if not exist "node_modules\@react-three\fiber\dist\react-three-fiber.cjs.js" goto :missing_modules
if not exist "node_modules\@esbuild\win32-x64\esbuild.exe" goto :missing_modules
if not exist "node_modules\@rollup\rollup-win32-x64-msvc\rollup.win32-x64-msvc.node" goto :missing_modules

rem Runtime is local; no global Node.js or npm is needed.
if not exist "runtime\node.exe" (
  echo [INFO] %MSG_FIRST%
  echo [INFO] %MSG_INTERNET%
  powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%CD%\scripts\prepare-portable-node.ps1"
  if errorlevel 1 goto :download_failed
)
if not exist "runtime\node.exe" goto :download_failed
"%CD%\runtime\node.exe" -e "process.exit(Number(process.versions.node.split('.')[0]) >= 22 ? 0 : 1)"
if errorlevel 1 goto :invalid_node
set "PATH=%CD%\runtime;%CD%\node_modules\.bin;%PATH%"
if not exist "SvenStudio3D.lnk" if exist "SvenStudio3D.ico" if exist "scripts\create-shortcut.ps1" (
  powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%CD%\scripts\create-shortcut.ps1" >nul 2>nul
)
echo.
echo [INFO] %MSG_LOCAL%
"%CD%\runtime\node.exe" --version
echo [INFO] %MSG_NOGLOBAL%
echo [INFO] %MSG_SERVER%
echo [INFO] %MSG_KEEP%
echo.
"%CD%\runtime\node.exe" "node_modules\concurrently\dist\bin\concurrently.js" -k -n API,WEB -c blue,green "node server/index.js" "vite --host 127.0.0.1 --strictPort --open"
set "START_EXIT=%ERRORLEVEL%"
if not "%START_EXIT%"=="0" echo [ERROR] %MSG_CLOSED% %START_EXIT%.
if "%START_EXIT%"=="0" echo [INFO] %MSG_ENDED%
goto :finish
:missing_project
echo [ERROR] %MSG_MISSING%
goto :finish
:missing_modules
echo [ERROR] %MSG_MODULES%
echo [INFO] %MSG_EXTRACT%
goto :finish
:download_failed
echo [ERROR] %MSG_DOWNLOAD%
echo [INFO] %MSG_RETRY%
echo [INFO] %MSG_ALTERNATIVE%
goto :finish
:invalid_node
echo [ERROR] %MSG_INVALID%
goto :finish
:bad_folder
echo [ERROR] Cannot access the application folder.
exit /b 1
:finish
echo.
echo %MSG_PRESS%
pause >nul
popd
endlocal & exit /b %START_EXIT%
