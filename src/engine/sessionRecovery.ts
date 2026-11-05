/** Local crash/session recovery for SvenStudio 3D.
 * IndexedDB stores the editable project, not generated .bsp or external WAD files.
 * Layout, keyboard settings and camera state use their existing small localStorage keys.
 */
import type {Project} from './types';
import {validateProjectFile} from './projectValidation';

const DB_NAME='svenstudio-recovery';
const STORE_NAME='snapshots';
const FALLBACK_KEY='svenstudio-recovery-fallback-v1';
const BACKUP_FALLBACK_KEY='svenstudio-recovery-backup-v1';
export type RecoverySelection={
  selected:string|null;
  selectedIds:string[];
  selectedFace:number|null;
  geometryMode:'object'|'vertex'|'edge'|'face';
  resourceView:string;
  snap:number;
  snapping:boolean;
};
export type RecoverySnapshot={
  version:1;
  savedAt:number;
  project:Project;
  view:RecoverySelection;
};

function validSnapshot(input:unknown):input is RecoverySnapshot{
  if(!input||typeof input!=='object')return false;
  const s=input as Partial<RecoverySnapshot>;
  return s.version===1&&Number.isFinite(s.savedAt)&&!!s.project&&s.project.version===1&&s.project.target==='svengine'&&
    typeof s.project.name==='string'&&Array.isArray(s.project.objects)&&s.project.objects.length<=100000&&
    !!s.project.world&&typeof s.project.world==='object'&&!!s.view&&Array.isArray(s.view.selectedIds);
}
function structurallySafe(snapshot:RecoverySnapshot|null):RecoverySnapshot|null{
  if(!snapshot)return null;
  try{validateProjectFile(snapshot.project);return snapshot}catch{return null}
}
function openRecoveryDb():Promise<IDBDatabase>{
  return new Promise((resolve,reject)=>{
    if(typeof indexedDB==='undefined'){reject(new Error('IndexedDB unavailable'));return;}
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains(STORE_NAME))db.createObjectStore(STORE_NAME);
    };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('IndexedDB open failed'));
    request.onblocked=()=>reject(new Error('IndexedDB is blocked by another tab'));
  });
}
async function readStored(slot:'latest'|'backup'):Promise<RecoverySnapshot|null>{
  const db=await openRecoveryDb();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE_NAME,'readonly');
    const request=tx.objectStore(STORE_NAME).get(slot);
    request.onsuccess=()=>resolve(validSnapshot(request.result)?request.result:null);
    request.onerror=()=>reject(request.error||new Error('Recovery read failed'));
  });}finally{db.close();}
}
export async function readRecoveredSession():Promise<RecoverySnapshot|null>{
  try{
    const latest=structurallySafe(await readStored('latest'));if(latest)return latest;
    const backup=structurallySafe(await readStored('backup'));if(backup)return backup;
  }catch{/* Private mode or unavailable database: try the small-project fallback. */}
  try{
    const value=JSON.parse(localStorage.getItem(FALLBACK_KEY)||'null');
    return validSnapshot(value)?structurallySafe(value):null;
  }catch{return null;}
}
export async function readRecoveryBackup():Promise<RecoverySnapshot|null>{
  try{const stored=structurallySafe(await readStored('backup'));if(stored)return stored;}catch{/* browser storage blocked */}
  try{const value=JSON.parse(localStorage.getItem(BACKUP_FALLBACK_KEY)||'null');return validSnapshot(value)?structurallySafe(value):null;}catch{return null;}
}
/** Explicit checkpoint before a destructive file import. Does not depend on save heuristics. */
async function storeRecoveryBackup(snapshot:RecoverySnapshot):Promise<void>{
  if(!validSnapshot(snapshot))throw Error('Invalid recovery checkpoint.');
  try{
    const db=await openRecoveryDb();
    try{await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readwrite');
      tx.objectStore(STORE_NAME).put(snapshot,'backup');
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('Recovery backup failed'));
      tx.onabort=()=>reject(tx.error||new Error('Recovery backup aborted'));
    });}finally{db.close()}
  }catch(error){
    const serialized=JSON.stringify(snapshot);
    if(serialized.length>1_500_000)throw error;
    localStorage.setItem(BACKUP_FALLBACK_KEY,serialized);
  }
}

export async function storeRecoverySnapshot(snapshot:RecoverySnapshot):Promise<void>{
  if(!validSnapshot(snapshot))throw Error('Invalid recovery snapshot');
  try{
    const db=await openRecoveryDb();
    try{await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE_NAME,'readwrite');
      const store=tx.objectStore(STORE_NAME);
      const existing=store.get('latest');
      existing.onsuccess=()=>{
        // Keep a distinct recovery point for undoing an accidental new/import.
        const old=existing.result as unknown;
        if(validSnapshot(old)&&(
          old.project.name!==snapshot.project.name ||
          (old.project.objects.length>8&&snapshot.project.objects.length<=8) ||
          snapshot.savedAt-old.savedAt>120000
        ))store.put(old,'backup');
        store.put(snapshot,'latest');
      };
      existing.onerror=()=>{tx.abort()};
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error||new Error('Recovery write failed'));
      tx.onabort=()=>reject(tx.error||new Error('Recovery transaction aborted'));
    });}finally{db.close();}
    return;
  }catch(error){
    // Fallback for restrictive browser settings. Do not force a huge .map into localStorage.
    const serialized=JSON.stringify(snapshot);
    if(serialized.length>1500000)throw error;
    localStorage.setItem(FALLBACK_KEY,serialized);
  }
}

/** Preserve save order when multiple edits are made during a slow IDB write. */
let pendingWrite:Promise<void>=Promise.resolve();
export function queueRecoveryWrite(snapshot:RecoverySnapshot):Promise<void>{
  pendingWrite=pendingWrite.catch(()=>{}).then(()=>storeRecoverySnapshot(snapshot));
  return pendingWrite;
}
export function queueRecoveryBackup(snapshot:RecoverySnapshot):Promise<void>{
  pendingWrite=pendingWrite.catch(()=>{}).then(()=>storeRecoveryBackup(snapshot));
  return pendingWrite;
}
