import {useEditor} from '../store';
import {queueRecoveryWrite,queueRecoveryBackup,readRecoveredSession,type RecoverySnapshot} from './sessionRecovery';

let recoveredAt:number|null=null;
let lastSaveError=false;
export function lastRecoveredAt(){return recoveredAt;}
export async function restoreOnLaunch():Promise<void>{
  const saved=await readRecoveredSession();
  if(!saved)return;
  const ids=new Set(saved.project.objects.map(o=>o.id));
  useEditor.getState().loadProject(saved.project);
  useEditor.setState({
    selectedIds:saved.view.selectedIds.filter(id=>ids.has(id)).slice(0,300),
    selected:saved.view.selected&&ids.has(saved.view.selected)?saved.view.selected:null,
    selectedFace:typeof saved.view.selectedFace==='number'?saved.view.selectedFace:null,
    geometryMode:['object','vertex','edge','face'].includes(saved.view.geometryMode)?saved.view.geometryMode:'object',
    faceMode:saved.view.geometryMode==='face',
    resourceView:(['objects','entities','textures','models','npcs','sounds','layers'].includes(saved.view.resourceView)?saved.view.resourceView:'objects') as ReturnType<typeof useEditor.getState>['resourceView'],
    snap:Number.isFinite(saved.view.snap)&&saved.view.snap>0?saved.view.snap:16,
    snapping:saved.view.snapping!==false
  });
  recoveredAt=saved.savedAt;
  useEditor.getState().appendLogs([`Recovered local editing session (${new Date(saved.savedAt).toLocaleString()}) with ${saved.project.objects.length} objects.`]);
}
function capture():RecoverySnapshot{
  const s=useEditor.getState();
  return {version:1,savedAt:Date.now(),project:s.project,view:{
    selected:s.selected,selectedIds:s.selectedIds,selectedFace:s.selectedFace,
    geometryMode:s.geometryMode,resourceView:s.resourceView,snap:s.snap,snapping:s.snapping
  }};
}
function notify(status:'saved'|'error',time?:number){
  window.dispatchEvent(new CustomEvent('svenstudio-recovery-status',{detail:{status,time}}));
}
export function startRecoveryAutosave():()=>void{
  let timer:ReturnType<typeof setTimeout>|undefined;
  let isDisposed=false;
  const write=()=>{
    if(isDisposed)return;
    if(timer!==undefined){clearTimeout(timer);timer=undefined;}
    queueRecoveryWrite(capture()).then(()=>{
      lastSaveError=false;notify('saved',Date.now());
    }).catch(error=>{
      if(!lastSaveError)useEditor.getState().appendLogs([`Autosave warning: ${String(error)}. Export your .svenstudio.json manually.`]);
      lastSaveError=true;notify('error');
    });
  };
  const schedule=()=>{
    if(timer!==undefined)clearTimeout(timer);
    timer=setTimeout(write,1200);
  };
  const unsubscribe=useEditor.subscribe((s,previous)=>{
    if(s.project!==previous.project||s.selectedIds!==previous.selectedIds||s.selectedFace!==previous.selectedFace||s.geometryMode!==previous.geometryMode||s.resourceView!==previous.resourceView||s.snap!==previous.snap||s.snapping!==previous.snapping)schedule();
  });
  const periodic=window.setInterval(write,30000);
  const flush=()=>write();
  document.addEventListener('visibilitychange',onVisibility);
  function onVisibility(){if(document.visibilityState==='hidden')flush();}
  window.addEventListener('pagehide',flush);
  // Create initial recovery on first use, without overwriting a saved session on startup.
  schedule();
  return ()=>{
    isDisposed=true;unsubscribe();clearInterval(periodic);
    if(timer!==undefined)clearTimeout(timer);
    document.removeEventListener('visibilitychange',onVisibility);
    window.removeEventListener('pagehide',flush);
  };
}

/** Persist the live map before replacing it through File > Open. */
export function checkpointBeforeImport():Promise<void>{
  return queueRecoveryBackup(capture());
}
