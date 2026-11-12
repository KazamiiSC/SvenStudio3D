/** Prefab Studio folder integration. A folder handle is stored only when the user
 * selects it; the browser may revoke access. No file is deleted automatically.
 */
import {validatePrefab,type Prefab} from './prefabs';
import {validateBspObjectPrefab,type BspObjectPrefab} from './bspObjectExtractor';

export type StudioPrefab=Prefab&{format?:string;wad?:{filename:string;base64:string};recovery?:BspObjectPrefab['recovery']};
export type PrefabFolderEntry={name:string;prefab:StudioPrefab;bytes:number;modified:number};
export type FolderHandle=FileSystemDirectoryHandle&{
  values:()=>AsyncIterableIterator<FileSystemHandle>;
  queryPermission?:(options?:{mode:'read'|'readwrite'})=>Promise<PermissionState>;
  requestPermission?:(options?:{mode:'read'|'readwrite'})=>Promise<PermissionState>;
};
const DATABASE='svenstudio-prefab-studio-v1',STORE='preferences',KEY='directory',LIMIT=40*1024*1024,MAX_FILES=512;
export const isPrefabFile=(name:string)=>/\.svprefab(?:\.json)?$/i.test(name)&&!name.includes('/')&&!name.includes('\\');
export const prefabFileName=(name:string)=>`${name.trim().replace(/[^a-z0-9_-]/gi,'_').slice(0,50)||'prefab'}.svprefab`;
export function parseStudioPrefab(text:string):StudioPrefab{
  const value:unknown=JSON.parse(text);
  const candidate=value as {format?:string};
  return candidate?.format==='svenstudio-bsp-object'?validateBspObjectPrefab(value):validatePrefab(value);
}
async function openDatabase():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE)};
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  });
}
async function transaction<T>(mode:IDBTransactionMode,operation:(store:IDBObjectStore)=>IDBRequest<T>):Promise<T>{
  const db=await openDatabase();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);
    const request=operation(tx.objectStore(STORE));
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
    tx.onerror=()=>reject(tx.error);
    tx.oncomplete=()=>db.close();
    tx.onabort=()=>db.close();
  });
}
export async function rememberPrefabFolder(handle:FolderHandle):Promise<void>{await transaction('readwrite',store=>store.put(handle,KEY))}
export async function readPrefabFolder():Promise<FolderHandle|null>{return ((await transaction('readonly',store=>store.get(KEY))) as FolderHandle|undefined)??null}
export async function forgetPrefabFolder():Promise<void>{await transaction('readwrite',store=>store.delete(KEY))}
export async function ensurePrefabFolderPermission(handle:FolderHandle,write=false,interactive=false):Promise<boolean>{
  const mode=write?'readwrite':'read';
  if(!handle.queryPermission)return true;
  const existing=await handle.queryPermission({mode});
  if(existing==='granted')return true;
  if(!interactive||!handle.requestPermission)return false;
  return await handle.requestPermission({mode})==='granted';
}
export async function scanPrefabFolder(handle:FolderHandle):Promise<{entries:PrefabFolderEntry[];skipped:string[]}>{
  const entries:PrefabFolderEntry[]=[],skipped:string[]=[];
  // Only top-level files are read: never traverse unrelated private folders.
  let count=0;
  for await(const item of handle.values()){
    if(item.kind!=='file'||!isPrefabFile(item.name))continue;
    if(++count>MAX_FILES){skipped.push(`More than ${MAX_FILES} prefabs; remaining files were not read.`);break}
    try{
      const file=await (item as FileSystemFileHandle).getFile();
      if(file.size>LIMIT){skipped.push(`${item.name}: file exceeds 40 MB.`);continue}
      const prefab=parseStudioPrefab(await file.text());
      entries.push({name:item.name,prefab,bytes:file.size,modified:file.lastModified});
    }catch(err){skipped.push(`${item.name}: ${err instanceof Error?err.message:String(err)}`)}
  }
  entries.sort((a,b)=>a.name.localeCompare(b.name));
  return {entries,skipped};
}
export async function writePrefabToFolder(handle:FolderHandle,prefab:StudioPrefab,filename=prefabFileName(prefab.name)):Promise<string>{
  if(!isPrefabFile(filename))throw Error('Invalid prefab filename.');
  // Validate BEFORE touching the destination file.
  const checked= parseStudioPrefab(JSON.stringify(prefab));
  const payload=JSON.stringify(checked,null,2);
  if(new Blob([payload]).size>LIMIT)throw Error('Prefab exceeds the 40 MB file limit.');
  // Do not silently overwrite existing prefabs. Choose an unused name.
  const stem=filename.replace(/\.svprefab(?:\.json)?$/i,'');
  const existing=new Set<string>();
  for await(const item of handle.values())existing.add(item.name.toLowerCase());
  let target=filename;
  for(let n=2;existing.has(target.toLowerCase());n++){
    if(n>10000)throw Error('No available filename in the selected folder.');
    target=`${stem}_${n}.svprefab`;
  }
  const fileHandle=await handle.getFileHandle(target,{create:true});
  const writable=await fileHandle.createWritable();
  try{await writable.write(payload);await writable.close()}catch(error){await writable.abort().catch(()=>{});throw error}
  return target;
}
