/** Read-only discovery for locally installed Sven Co-op and its SDK.
 * Intentionally inspects well-known Steam locations and library manifests;
 * never recursively scans whole drives or executes downloaded programs.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import os from 'node:os';
import {execFile} from 'node:child_process';

const compilerStages=['CSG','BSP','VIS','RAD'];
const compilerNames=stage=>[`SC-${stage}_x64.exe`,`SC-${stage}.exe`,`SC_${stage}_x64.exe`,`SC_${stage}.exe`];
const hasCompilers=folder=>compilerStages.every(stage=>compilerNames(stage).some(name=>existsSync(path.join(folder,name))));
const limit=120;
const unique=paths=>[...new Set(paths.filter(Boolean).map(v=>path.resolve(v)))];
const dir=async p=>{try{return (await fs.stat(p)).isDirectory()}catch{return false}};
const normalizeSteamPath=s=>s.replace(/\\\\/g,'\\').replace(/\//g,path.sep);
export function parseLibraryFolders(text){
 const paths=[];
 for(const match of text.matchAll(/"path"\s*"([^"]+)"/gi))paths.push(normalizeSteamPath(match[1]));
 // Legacy Steam VDF used numbered roots instead of named path keys.
 for(const match of text.matchAll(/^\s*"\d+"\s*"([^"\r\n]+)"/gm))paths.push(normalizeSteamPath(match[1]));
 return paths;
}
async function registrySteamPaths(){
 if(process.platform!=='win32')return [];
 const keyList=[['HKCU\\Software\\Valve\\Steam','SteamPath'],['HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam','InstallPath']];
 const tasks=keyList.map(([key,value])=>new Promise(resolve=>{
  execFile('reg',['query',key,'/v',value],{windowsHide:true,timeout:1400,maxBuffer:16384},(error,stdout)=>{
   if(error)return resolve(null);
   const match=String(stdout).match(/REG_SZ\s+([^\r\n]+)/i);
   resolve(match?match[1].trim():null);
  });
 }));
 return (await Promise.all(tasks)).filter(Boolean);
}
export async function mountedRoots(){
 if(process.platform!=='win32')return [path.parse(process.cwd()).root];
 const found=[];
 for(let code=67;code<=90;code++){
  const drive=String.fromCharCode(code)+':\\';
  if(await dir(drive))found.push(drive);
 }
 return found;
}
export async function discoverInstallations({drives,steamPaths=[]}={}){
 const roots=drives??await mountedRoots();
 const registry=steamPaths.length?steamPaths:await registrySteamPaths();
 const steamCandidates=[...registry];
 for(const drive of roots){for(const suffix of ['Steam','SteamLibrary','Games\\Steam','Program Files (x86)\\Steam','Program Files\\Steam'])steamCandidates.push(path.join(drive,suffix));}
 // Environment variables may point to alternate Steam installation roots.
 if(process.env['ProgramFiles(x86)'])steamCandidates.push(path.join(process.env['ProgramFiles(x86)'],'Steam'));
 if(process.env.ProgramFiles)steamCandidates.push(path.join(process.env.ProgramFiles,'Steam'));
 const libraries=[...steamCandidates];
 for(const candidate of unique(steamCandidates).slice(0,limit)){
  try{const vdf=await fs.readFile(path.join(candidate,'steamapps','libraryfolders.vdf'),'utf8');libraries.push(...parseLibraryFolders(vdf));}catch{}
 }
 const game=[],compiler=[];
 for(const library of unique(libraries).slice(0,limit)){
  for(const common of [path.join(library,'steamapps','common'),path.join(library,'common')]){
   const gameDir=path.join(common,'Sven Co-op','svencoop');
   const sdk=path.join(common,'Sven Co-op SDK','mapping','compilers');
   if(await dir(gameDir))game.push(gameDir);
   if(await dir(sdk)&&hasCompilers(sdk))compiler.push(sdk);
  }
 }
 return {gameDirs:unique(game),compilerDirs:unique(compiler),roots};
}
/** Validated path sent to the compiler and game settings; no files are changed. */
export async function browseLocalFolder(folder){
 if(typeof folder!=='string'||folder.length>1024||folder.includes('\0')||!path.isAbsolute(folder))throw Error('Select an absolute local directory.');
 const resolved=path.resolve(folder);
 if(!await dir(resolved))throw Error('Folder does not exist on this PC.');
 const entries=(await fs.readdir(resolved,{withFileTypes:true})).filter(e=>e.isDirectory()&&!e.name.startsWith('.')).sort((a,b)=>a.name.localeCompare(b.name));
 return {path:resolved,parent:path.dirname(resolved)===resolved?null:path.dirname(resolved),folders:entries.slice(0,250).map(e=>e.name),truncated:entries.length>250};
}
export async function verifyLocalInstall(folder,kind){
 if(typeof folder!=='string'||folder.length>1024||folder.includes('\0')||!path.isAbsolute(folder)||!await dir(folder))return false;
 if(kind==='compiler')return hasCompilers(folder);
 if(kind==='game')return existsSync(path.join(folder,'gameinfo.txt'))||existsSync(path.join(folder,'halflife.wad'))||existsSync(path.join(folder,'maps'));
 return false;
}
