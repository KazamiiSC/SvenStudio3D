// v2.4: electron-builder's install section runs with "SetDetailsPrint none", so the installer's details
// list stays empty. Turn it back on right before the app is extracted and show the destination folder.
// The per-file list is printed by build/installer.nsh (customInstall). Idempotent; run before electron-builder.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const file=fileURLToPath(new URL('../node_modules/app-builder-lib/templates/nsis/include/extractAppPackage.nsh',import.meta.url));
let text=readFileSync(file,'utf8');
const marker='; svenstudio-details-v2';
if(text.includes(marker)){console.log('NSIS details patch already applied');process.exit(0);}
const eol=text.includes('\r\n')?'\r\n':'\n';
const original=['  SetOutPath "$PLUGINSDIR\\7z-out"','  Nsis7z::Extract "${FILE}"'].join(eol);
// Earlier v2.4 build of this patch (kept so an already patched node_modules upgrades cleanly).
const previous=['  SetOutPath "$PLUGINSDIR\\7z-out" ; svenstudio-details','  DetailPrint "Destino: $INSTDIR"','  Nsis7z::ExtractWithDetails "${FILE}" "Instalando %s..."'].join(eol);
const anchor=text.includes(previous)?previous:original;
if(!text.includes(anchor))throw new Error('electron-builder NSIS template changed: patch-nsis-details.mjs needs an update');
const to=[`  SetOutPath "$PLUGINSDIR\\7z-out" ${marker}`,'  SetDetailsPrint both','  DetailPrint "Destino: $INSTDIR"','  DetailPrint "Descomprimiendo archivos..."','  Nsis7z::ExtractWithDetails "${FILE}" "Instalando %s..."'].join(eol);
text=text.replace(anchor,to);
writeFileSync(file,text);
console.log('NSIS details patch applied');
