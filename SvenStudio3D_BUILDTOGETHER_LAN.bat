@echo off
rem Use this launcher ONLY on a trusted LAN, Pothole or other private overlay.
rem Exposes ONLY BuildTogether WebSocket on TCP 49178; regular editor API remains localhost.
set "SVEN_BUILDTOGETHER_LISTEN=0.0.0.0"
call "%~dp0SvenStudio3D.bat"
