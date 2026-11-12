# Repetir las pruebas visuales reales

Arrancar SvenStudio con `npm run dev` y su API local. Instalar Playwright en un directorio de herramientas independiente (no incluido en esta entrega). Definir `PLAYWRIGHT_MODULE` con la ruta al paquete Playwright y `CHROME_PATH` con la ruta a Chrome; si se omite Chrome, Playwright usa su Chromium instalado.

Desde la raíz del proyecto, en PowerShell:
```powershell
$env:SVEN_AUDIT_URL='http://127.0.0.1:5173'
node scripts/theme-audit/audit-browser.cjs
node scripts/theme-audit/audit-bsp.cjs
node scripts/theme-audit/audit-studios-extra.cjs
$env:EXTRA_MORE='1'
node scripts/theme-audit/audit-studios-extra.cjs
Remove-Item Env:EXTRA_MORE
node scripts/theme-audit/audit-switching.cjs
node scripts/theme-audit/audit-reachability.cjs
```
Las salidas nuevas van a `verification/rerun`, sin sobrescribir la evidencia entregada. `THEME_AUDIT_DIR` permite elegir otro destino. El navegador tiene un perfil de pruebas aislado. Los mapas BSP exportados son copias del fixture; no se sobrescribe el original. La fuente externa de Google se bloquea para probar la tipografía de reserva offline. La prueba usa la interfaz real; Workshop se abre mediante el evento público del editor. El detector de contraste es orientativo y no analiza píxeles de la escena ni acredita conformidad WCAG.
