/** HF14: browser client for immutable local history snapshots in Documents.
 * Existing fast IndexedDB session recovery remains completely independent.
 */
import type {Project} from './types';
import {useSaveState} from './saveState';
import {validateProjectFile} from './projectValidation';
import {useEditor} from '../store';
export type HistoryKind='auto'|'manual'|'safety';
export type HistoryEntry={schema:'svenstudio-history-v1';id:string;createdAt:number;projectName:string;kind:HistoryKind;label:string;objects:number;brushes:number;entities:number;bytes:number;sha256:string};
async function reply<T>(response:Response):Promise<T>{
 const value=await response.json().catch(()=>({error:`HTTP ${response.status}`}));
 if(!response.ok)throw Error(value.error||`HTTP ${response.status}`);
 return value as T;
}
export async function listProjectHistory():Promise<HistoryEntry[]>{
 return (await reply<{entries:HistoryEntry[]}>(await fetch('/api/project-history/list',{cache:'no-store'}))).entries;
}
export async function saveHistoryCheckpoint(project:Project,kind:HistoryKind,label=''){
 validateProjectFile(project);
 const content=JSON.stringify({project,kind,label});
 return reply<{saved:boolean;deduplicated:boolean;entry:HistoryEntry}>(await fetch('/api/project-history/save',{
  method:'POST',headers:{'Content-Type':'application/octet-stream'},body:new Blob([content],{type:'application/octet-stream'})
 }));
}
export async function openHistoryCheckpoint(id:string):Promise<{project:Project;entry:HistoryEntry}>{
 if(!/^[a-z0-9]{8,16}-[a-f0-9]{16}$/.test(id))throw Error('Invalid checkpoint ID.');
 const response=await reply<{project:unknown;entry:HistoryEntry}>(await fetch(`/api/project-history/read?id=${encodeURIComponent(id)}`,{cache:'no-store'}));
 return {entry:response.entry,project:validateProjectFile(response.project)};
}
export type HistoryDiff={added:number;removed:number;modified:number;unchanged:number;worldChanges:number};
/** Compare actual stored object IDs and full object contents, not only counts. */
export function compareHistoryProjects(current:Project,older:Project):HistoryDiff{
 const present=new Map(current.objects.map(o=>[o.id,JSON.stringify(o)]));
 const old=new Map(older.objects.map(o=>[o.id,JSON.stringify(o)]));
 let added=0,removed=0,modified=0,unchanged=0;
 for(const [id,serialized] of present){
  const prior=old.get(id);if(prior===undefined)added++;
  else if(serialized!==prior)modified++;
  else unchanged++;
 }
 for(const id of old.keys())if(!present.has(id))removed++;
 const allWorldKeys=new Set([...Object.keys(current.world),...Object.keys(older.world)]);
 let worldChanges=0;for(const key of allWorldKeys)if(current.world[key]!==older.world[key])worldChanges++;
 return {added,removed,modified,unchanged,worldChanges};
}
/** Automatic disk history is throttled: ~10 minutes between changed-map snapshots.
 * No disk history is written for camera movement or selection changes.
 * On failure, IndexedDB autosave is still active; failed writes are retried later.
 */
export function startProjectHistoryAutosave():()=>void{
 const intervalMs=10*60*1000;
 let dirty=false,running=false,disposed=false,lastAttempt=Date.now();
 let lastProject=useEditor.getState().project;
 const unsubscribe=useEditor.subscribe((next,previous)=>{
  if(next.project!==previous.project){dirty=true;lastProject=next.project;}
 });
 const check=async(minimum=intervalMs)=>{
  if(disposed||running||!dirty||Date.now()-lastAttempt<minimum)return;
  running=true;lastAttempt=Date.now();const snapshot=lastProject;
  try{
   await saveHistoryCheckpoint(snapshot,'auto');
   useSaveState.setState({lastBackupAt:Date.now()});
   if(lastProject===snapshot)dirty=false;
  }catch(error){
   // Never interrupt editing when local Node is unavailable or disk is full.
   useEditor.getState().appendLogs([`Project History: automatic checkpoint unavailable (${String(error)}). Browser autosave remains active.`]);
  }finally{running=false;}
 };
 const timer=window.setInterval(()=>void check(),60000);
 // Also back up when the user switches tab or minimizes (at most every 2 minutes).
 const onHidden=()=>{if(document.visibilityState==='hidden')void check(2*60*1000);};
 document.addEventListener('visibilitychange',onHidden);
 return ()=>{disposed=true;unsubscribe();clearInterval(timer);document.removeEventListener('visibilitychange',onHidden)};
}
