import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pickWindowsFolder} from '../server/nativeWindowsDialogs.js';
const source=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');

test('Windows folder picker uses modern Explorer-style IFileDialog / FOS_PICKFOLDERS',async()=>{
 const script=await source('server/windowsModernFolderPicker.ps1');
 assert.match(script,/42f85136-db7e-439c-85f1-e4075d135fc8/i); // IFileDialog
 assert.match(script,/DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7/i); // FileOpenDialog CLSID
 assert.match(script,/FOS_PICKFOLDERS\s*=\s*0x20/);
 assert.match(script,/FOS_FORCEFILESYSTEM/);
 assert.match(script,/FOS_PATHMUSTEXIST/);
 assert.match(script,/SIGDN_FILESYSPATH/);
 assert.match(script,/GetForegroundWindow/);
 assert.match(script,/result == CANCELLED/);
 assert.doesNotMatch(script,/FolderBrowserDialog|BrowseForFolder/);
});

test('Native helper is launched as a standalone STA Windows dialog with safe arguments',async()=>{
 const js=await source('server/nativeWindowsDialogs.js');
 assert.match(js,/windowsModernFolderPicker\.ps1/);
 assert.match(js,/'powershell\.exe'/);
 assert.match(js,/'-STA'/);
 assert.match(js,/windowsHide:true/);
 assert.match(js,/execFile/);
 assert.doesNotMatch(js,/FolderBrowserDialog|encodedCommand|psValue/);
 if(process.platform!=='win32')assert.deepEqual(await pickWindowsFolder('C:\\users\\demo'),{supported:false});
});

test('Native dialog does not appear alongside the SvenStudio folder browser',async()=>{
 const ui=await source('src/components/LocalFolderPicker.tsx');
 assert.match(ui,/const \[showFallback,setShowFallback\]=useState\(false\)/);
 assert.match(ui,/if\(!showFallback\)return null;/);
 assert.match(ui,/rootsResponse\.platform!=='win32'/);
 assert.match(ui,/setShowFallback\(true\)/);
 assert.match(ui,/selection\.cancelled/);
 assert.match(ui,/onPick\(selection\.path\);onClose\(\)/);
 assert.match(ui,/\/api\/setup\/verify/);
 assert.match(ui,/\/api\/setup\/folders/);
 const snippet=ui.slice(ui.indexOf('   try{\n    const selection='),ui.indexOf('  }).catch(error=>nativeError'));
 assert.doesNotMatch(snippet,/setShowFallback/); // Windows flow never opens custom picker
});
