; v2.4: the installer shows where it installs and every installed file (details list open).
; electron-builder turns the details list off ("SetDetailsPrint none"); it is turned back on here and in
; scripts/patch-nsis-details.mjs.
!macro customHeader
  ShowInstDetails show
  ShowUninstDetails show
!macroend

!macro customInstall
  SetDetailsPrint both
  DetailPrint "Archivos instalados en $INSTDIR :"
  nsExec::ExecToLog '"$SYSDIR\cmd.exe" /d /c dir /s /b /a-d "$INSTDIR"'
  Pop $0
  DetailPrint "----------------------------------------"
  DetailPrint "SvenStudio 3D instalado en: $INSTDIR"
!macroend
