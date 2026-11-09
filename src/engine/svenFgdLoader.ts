import {parseFgd} from './fgd';
import type {FgdClass} from './types';
import {useEditor} from '../store';

/** Single read-only FGD loading path, shared by initial startup and the two inspectors.
 * Loading FGD definitions never alters map entities or their native keyvalues.
 */
type DiscoveredFolders={gameDirs?:string[]};
const inflight=new Map<string,Promise<FgdClass[]>>();
let discovery:Promise<string|null>|null=null;

async function discoverSingleGameDirectory():Promise<string|null>{
  if(!discovery)discovery=(async()=>{
    const response=await fetch('/api/setup/detect',{method:'POST'});
    if(!response.ok)return null;
    const data=await response.json() as DiscoveredFolders;
    const paths=Array.from(new Set((data.gameDirs||[]).filter(x=>typeof x==='string'&&!!x.trim())));
    return paths.length===1?paths[0]:null;
  })().catch(()=>null).finally(()=>{discovery=null});
  return discovery;
}

export async function loadSvenCoopFgd(gameDir:string):Promise<FgdClass[]>{
  const location=gameDir.trim();
  if(!location)throw Error('Configurá la carpeta de Sven Co-op en Configuración de compilación.');
  if(!inflight.has(location)){
    const job=(async()=>{
      const response=await fetch('/api/svengine/fgd',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameDir:location})});
      if(!response.ok){const message=await response.json().catch(()=>({error:`HTTP ${response.status}`}));throw Error(message.error||`HTTP ${response.status}`);}
      const classes=parseFgd(await response.text());
      if(!classes.length)throw Error('El archivo FGD no contiene clases reconocibles.');
      return classes;
    })();
    inflight.set(location,job);
    void job.finally(()=>inflight.delete(location)).catch(()=>{});
  }
  return inflight.get(location)!;
}

export async function ensureSvenCoopFgd({discover=false,force=false}:{discover?:boolean;force?:boolean}={}):Promise<number>{
  const original=useEditor.getState();
  if(original.fgdLoaded&&!force)return original.fgdClasses.length;
  let gameDir=original.settings.gameDir;
  if(!gameDir&&discover){
    const detected=await discoverSingleGameDirectory();
    // Never select an arbitrary installation if multiple Sven Co-op folders exist.
    if(detected){
      const current=useEditor.getState();
      if(!current.settings.gameDir)current.setSettings({gameDir:detected});
      gameDir=useEditor.getState().settings.gameDir;
    }
  }
  if(!gameDir)throw Error('No se encontró una instalación única. Configurá la carpeta del juego o importá un .FGD.');
  const classes=await loadSvenCoopFgd(gameDir);
  // Respect a manual FGD imported while an automatic request was in flight.
  if(useEditor.getState().settings.gameDir===gameDir&&(!useEditor.getState().fgdLoaded||force)){
    useEditor.getState().setFgd(classes);
    useEditor.getState().appendLogs([`FGD: ${classes.length} clases cargadas desde Sven Co-op.`]);
  }
  return useEditor.getState().fgdClasses.length;
}
