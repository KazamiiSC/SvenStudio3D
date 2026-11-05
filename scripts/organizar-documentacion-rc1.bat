@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem Optional migration from old root documentation to the stable documentation archive.
rem Does NOT delete projects, MAP, WAD, JSON, scripts or dependencies.
pushd "%~dp0.."
if errorlevel 1 (
  echo [ERROR] No se pudo acceder a la carpeta de SvenStudio3D.
  exit /b 1
)
if not exist "docs\history" mkdir "docs\history"
for %%G in ("CAMBIOS_*.md" "INSTALACION_*.md" "CONTINUIDAD_*.md" "PRUEBAS_MANUALES_0.9.*.md" "AUDITORIA_UI_CONTROLES_0.9.1.md" "CHECKLIST_RC1_ES.md" "CONTROLES_RC1_ES.md" "ESTADO_LANZAMIENTO_RC1.md" "SOLUCION_ARRANQUE_0.8.8.1_ES.md") do (
  if exist "%%~G" (
    if exist "docs\history\%%~nxG" (
      fc /b "%%~G" "docs\history\%%~nxG" >nul 2>nul
      if not errorlevel 1 del "%%~G"
    ) else (
      move "%%~G" "docs\history\" >nul
    )
  )
)
echo [OK] Historial reorganizado en docs\history. Solo se borran documentos duplicados identicos.
echo      No se modifican proyectos ni mapas.
popd
endlocal
