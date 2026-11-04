@echo off
chcp 65001 >nul
title Sven Studio 3D
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js is not installed. Install Node.js 22 or later from https://nodejs.org/
  echo No Microsoft Store is needed.
  pause
  exit /b 1
)
if not exist node_modules\vite\bin\vite.js (
  echo Installing first-run dependencies...
  call npm install
  if errorlevel 1 (
    echo Could not install dependencies. Check your internet connection and npm configuration.
    pause
    exit /b 1
  )
)
rem Vite uses --open and --strictPort: do not open an old 5173 server by mistake.
call npm run dev
pause
