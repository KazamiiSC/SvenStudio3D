/** SvenStudio-owned user documents. No writes outside Documents/SvenStudio3D.
 * On Windows use the actual Known Folder (also works with OneDrive redirects).
 */
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execFileAsync=promisify(execFile);
const SUBDIRS=Object.freeze({projects:'Projects',prefabs:'Prefabs',maps:'Maps',builds:'Builds',exports:'Exports'});
const FILE_EXTENSIONS={
 projects:/\.svenstudio\.json$/i,
 prefabs:/\.svprefab(?:\.json)?$/i,
 maps:/\.map$/i,
 exports:/\.(?:bsp|wad|zip|json|txt|png|wav|svenblueprint\.json|rmf)$/i
};
let knownDocumentsPromise;
async function windowsDocuments(){
 if(process.platform!=='win32')return '';
 try{
  const {stdout}=await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-Command',"[Environment]::GetFolderPath('MyDocuments')"],{timeout:5000,windowsHide:true,maxBuffer:8192});
  const result=stdout.trim();
  if(result&&path.isAbsolute(result))return result;
 }catch{}
 return '';
}
export function documentsRoot({home=os.homedir(),documents}={}){
 return path.join(documents||path.join(home,'Documents'),'SvenStudio3D');
}
export async function studioRoot(){
 if(!knownDocumentsPromise)knownDocumentsPromise=windowsDocuments();
 return documentsRoot({documents:await knownDocumentsPromise});
}
export async function studioDirectory(category,create=false,root=null){
 if(!Object.hasOwn(SUBDIRS,category))throw new Error('Unknown SvenStudio folder.');
 const actualRoot=root||await studioRoot();
 const dest=path.join(actualRoot,SUBDIRS[category]);
 if(create)await fs.mkdir(dest,{recursive:true});
 // Never follow user-created junctions or symlinks inside the SvenStudio tree.
 for(const item of [actualRoot,dest]){
   try{const stat=await fs.lstat(item);if(stat.isSymbolicLink()||!stat.isDirectory())throw Error('Unsafe SvenStudio document folder.');}
   catch(error){if(error.code!=='ENOENT')throw error;}
 }
 return dest;
}
export async function studioFolders(create=false){
 const root=await studioRoot();
 if(create)await Promise.all(Object.keys(SUBDIRS).map(k=>studioDirectory(k,true)));
 return {root,folders:Object.fromEntries(await Promise.all(Object.keys(SUBDIRS).map(async k=>[k,await studioDirectory(k)])))};
}
export function validStudioFilename(category,name){
 return Object.hasOwn(FILE_EXTENSIONS,category)&&typeof name==='string'&&name.length>0&&name.length<=150&&
 /^[a-z0-9_+(). -]+$/i.test(name)&&!name.startsWith('.')&&!name.includes('..')&&FILE_EXTENSIONS[category].test(name);
}
export async function saveStudioFile({category,filename,bytes},{root=null}={}){
 if(!validStudioFilename(category,filename))throw Error('Invalid output filename or file type.');
 if(!Buffer.isBuffer(bytes)||bytes.length===0||bytes.length>128*1024*1024)throw Error('File empty or exceeds 128 MB.');
 const folder=await studioDirectory(category,true,root);
 const ext=filename.toLowerCase().endsWith('.svenstudio.json')?'.svenstudio.json':filename.toLowerCase().endsWith('.svprefab.json')?'.svprefab.json':path.extname(filename);
 const stem=filename.slice(0,-ext.length);
 for(let i=0;i<10000;i++){
  const candidate=i?`${stem}_${i+1}${ext}`:filename;
  const target=path.join(folder,candidate);
  try{await fs.writeFile(target,bytes,{flag:'wx'});return {path:target,filename:candidate,category,bytes:bytes.length}}
  catch(error){if(error?.code!=='EEXIST')throw error;}
 }
 throw Error('Too many versions with the same filename.');
}
/** No arbitrary path reads: only saved SvenStudio files under a known category. */
export async function listStudioFiles(category,{root=null}={}){
 if(!Object.hasOwn(FILE_EXTENSIONS,category)||category==='builds')throw Error('Invalid list category.');
 const folder=await studioDirectory(category,false,root);
 const entries=await fs.readdir(folder,{withFileTypes:true}).catch(e=>e?.code==='ENOENT'?[]:Promise.reject(e));
 const output=[];
 for(const item of entries.slice(0,1000)){
  if(!item.isFile()||!validStudioFilename(category,item.name))continue;
  const stat=await fs.lstat(path.join(folder,item.name));
  if(stat.isFile()&&stat.size<=40*1024*1024)output.push({name:item.name,bytes:stat.size,modified:stat.mtimeMs});
 }
 return output.sort((a,b)=>b.modified-a.modified).slice(0,512);
}
export async function readStudioFile(category,filename,{root=null}={}){
 if(!validStudioFilename(category,filename)||category==='builds')throw Error('Invalid file name.');
 const file=path.join(await studioDirectory(category,false,root),filename);
 const stat=await fs.lstat(file);
 if(!stat.isFile()||stat.size>40*1024*1024)throw Error('File exceeds 40 MB.');
 return fs.readFile(file);
}
