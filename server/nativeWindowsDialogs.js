/** Native Explorer-style Windows folder picker, executed only on the local Node server. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const pickerScript=fileURLToPath(new URL('./windowsModernFolderPicker.ps1',import.meta.url));

export async function pickWindowsFolder(initial){
 if(process.platform!=='win32')return {supported:false};
 let folder=typeof initial==='string'&&initial.length<=1024&&path.isAbsolute(initial)?initial:os.homedir();
 try{if(!(await fs.stat(folder)).isDirectory())folder=os.homedir()}catch{folder=os.homedir()}
 // PowerShell runs STA for the Windows IFileOpenDialog COM object. The helper
 // uses FOS_PICKFOLDERS, which displays the modern Explorer-style dialog.
 // execFile passes paths as arguments without involving a shell; no UI is
 // rendered in the browser while this native window is open.
 const {stdout}=await run('powershell.exe',[
  '-NoLogo','-NoProfile','-NonInteractive','-STA','-ExecutionPolicy','Bypass',
  '-File',pickerScript,'-InitialFolder',folder
 ],{windowsHide:true,timeout:600000,maxBuffer:16384});
 const result=stdout.trim();
 if(!result)return {supported:true,cancelled:true};
 if(!path.isAbsolute(result)||(await fs.stat(result)).isDirectory()===false)
  throw Error('Selected folder does not exist.');
 return {supported:true,cancelled:false,path:result};
}
