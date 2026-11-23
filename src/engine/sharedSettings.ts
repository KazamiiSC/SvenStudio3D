/** Preferences shared by the browser version and the desktop app (v2.4).
 * The two keep separate browser storage, so a curated list of preference keys is mirrored to
 * Documents/SvenStudio3D/settings.json through the local server:
 *  - applied BEFORE the editor modules load (stores read localStorage when they are created);
 *  - first contact with an existing file only fills keys this side does not have yet,
 *    so a fresh install adopts your configuration and never wipes the other one;
 *  - afterwards the newest revision wins; changes are saved every few seconds and on hide.
 * Only real values travel: a missing key on one side never deletes it on the other.
 * Project data, recovery backups and caches are never shared.
 */
export const SHARED_PREFERENCE_KEYS=[
  'svenstudio-settings','svenstudio-locale','svenstudio-controls-v2','svenstudio-entity-appearance-v1',
  'svenstudio-map-label-settings-v1','svenstudio-texture-favorites','svenstudio-texture-recent-v1',
  'svenstudio-sound-favorites-v1','svenstudio:viewport-hud-0898','sven-studio-ui-layout-041',
  'svenstudio:grid-edit-step-v1','svenstudio:grid-visible-step-v1','svenstudio:texture-presets:v1',
  'svenstudio:material-surface-presets:v1','svenstudio:bsp-uv-presets-v1','svenstudio:shape-dimensions-v14',
  'svenstudio:buildtogether-name','svstudio-model-favorites','svenstudio-first-run-tour-v1',
  'svenstudio:welcome-guide-v1','svenstudio-surfdecomp-path','svenstudio:gizmo-visible','svenstudio:universal-placement-v194',
] as const;
const REVISION_KEY='svenstudio-shared-settings-revision';

type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type SharedFile={version?:number;revision:number;values:Record<string,string|null>};

/** A fresh install has no game/compiler folders yet; then the shared ones are better. */
function hasBuildPaths(json:string):boolean{
  try{const s=JSON.parse(json) as {gameDir?:string;compilerDir?:string;sdhltDir?:string};return !!(s.gameDir?.trim()||s.compilerDir?.trim()||s.sdhltDir?.trim());}catch{return false;}
}
export function snapshotPreferences(storage:Store):Record<string,string>{
  const out:Record<string,string>={};
  for(const key of SHARED_PREFERENCE_KEYS){const value=storage.getItem(key);if(typeof value==='string')out[key]=value;}
  return out;
}

/** Pure decision: what to write into this storage from the shared file. */
export function planApply(file:SharedFile|null,storage:Store):{writes:Record<string,string>;revision:number|null}{
  if(!file||!file.revision)return {writes:{},revision:null};
  const local=Number(storage.getItem(REVISION_KEY)||0);
  const writes:Record<string,string>={};
  if(!local){
    // First contact: only fill what this side is missing (or build settings that are still empty).
    for(const key of SHARED_PREFERENCE_KEYS){
      const value=file.values[key];if(typeof value!=='string')continue;
      const local=storage.getItem(key);
      if(local===null||(key==='svenstudio-settings'&&!hasBuildPaths(local)&&hasBuildPaths(value)))writes[key]=value;
    }
    return {writes,revision:null}; // the merged result is published by the first save
  }
  if(file.revision<=local)return {writes,revision:null};
  for(const key of SHARED_PREFERENCE_KEYS){
    const value=file.values[key];
    if(typeof value==='string'&&storage.getItem(key)!==value)writes[key]=value;
  }
  return {writes,revision:file.revision};
}

export async function applySharedPreferences(storage:Store=localStorage,fetcher:typeof fetch=fetch):Promise<number>{
  try{
    const response=await fetcher('/api/shared-settings',{cache:'no-store'});
    if(!response.ok)return 0;
    const file=await response.json() as SharedFile;
    const {writes,revision}=planApply(file,storage);
    for(const [key,value] of Object.entries(writes))storage.setItem(key,value);
    if(revision)storage.setItem(REVISION_KEY,String(revision));
    return Object.keys(writes).length;
  }catch{return 0;}
}

/** Mirror local preference changes to Documents (debounced; also on tab hide / close). */
export function startSharedPreferencesSync(storage:Store=localStorage,fetcher:typeof fetch=fetch,interval=4000){
  let last=JSON.stringify(snapshotPreferences(storage));
  const hadRevision=Number(storage.getItem(REVISION_KEY)||0)>0;
  const push=(force=false)=>{
    const values=snapshotPreferences(storage);
    const json=JSON.stringify(values);
    if(!force&&json===last)return;
    last=json;
    const revision=Date.now();
    storage.setItem(REVISION_KEY,String(revision));
    const body=JSON.stringify({version:1,revision,values});
    // keepalive lets the last save finish even if the tab or window is closing.
    void fetcher('/api/shared-settings',{method:'PUT',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
  };
  // First run of this feature here: publish the merged result once.
  if(!hadRevision)push(true);
  const timer=setInterval(()=>push(),interval);
  const hidden=()=>{if(document.visibilityState==='hidden')push();};
  document.addEventListener('visibilitychange',hidden);
  return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',hidden);};
}
