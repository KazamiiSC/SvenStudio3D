/** Browser-local WAD persistence. Imported WAD bytes stay in IndexedDB across
 * SvenStudio source updates while the same origin/browser profile is used.
 * Never treat these blobs as files installed in the Sven Co-op game directory. */
const DATABASE='svenstudio:imported-wads';
const STORE='wad-files';
export type SavedWad={name:string;bytes:Blob;savedAt:number};
function openWadDatabase():Promise<IDBDatabase>{
  if(typeof indexedDB==='undefined')return Promise.reject(new Error('IndexedDB is not supported'));
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(DATABASE,1);
    request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'key'});};
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Cannot open WAD cache'));
    request.onblocked=()=>reject(new Error('WAD cache is blocked by another tab'));
  });
}
function runTx<T>(db:IDBDatabase,mode:IDBTransactionMode,operation:(store:IDBObjectStore,resolve:(value:T)=>void,reject:(e:unknown)=>void)=>void):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
    const tx=db.transaction(STORE,mode);let result:T;let hasResult=false;
    tx.oncomplete=()=>{if(hasResult)resolve(result);else reject(new Error('WAD cache operation produced no result'));};
    tx.onerror=()=>reject(tx.error||new Error('WAD cache transaction failed'));
    tx.onabort=()=>reject(tx.error||new Error('WAD cache transaction aborted'));
    operation(tx.objectStore(STORE),value=>{result=value;hasResult=true;},reject);
  });
}
export async function rememberWadFile(file:File):Promise<void>{
  if(file.name.toLowerCase()==='svstudio.wad')return; // built-in WAD loads from /public
  const db=await openWadDatabase();
  try{await runTx<void>(db,'readwrite',(store,done)=>{
    store.put({key:file.name.toLowerCase(),name:file.name,bytes:file.slice(0,file.size),savedAt:Date.now()});done(undefined);
  });}finally{db.close();}
}
export async function loadSavedWadFiles():Promise<File[]>{
  const db=await openWadDatabase();
  try{const saved=await runTx<SavedWad[]>(db,'readonly',(store,done,reject)=>{
    const request=store.getAll();request.onsuccess=()=>done(request.result as SavedWad[]);request.onerror=()=>reject(request.error);
  });return saved.filter(entry=>entry&&entry.name&&entry.bytes instanceof Blob).map(entry=>new File([entry.bytes],entry.name,{type:'application/octet-stream'}));}
  finally{db.close();}
}
export async function forgetSavedWadFiles():Promise<void>{
  const db=await openWadDatabase();
  try{await runTx<void>(db,'readwrite',(store,done)=>{store.clear();done(undefined);});}finally{db.close();}
}
