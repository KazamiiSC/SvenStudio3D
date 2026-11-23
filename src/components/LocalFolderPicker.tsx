import {useEffect,useState} from 'react';
import {Folder,FolderOpen,ArrowUp,HardDrive,X,Check} from 'lucide-react';

type FolderData={path:string;parent:string|null;folders:string[];truncated:boolean};
type Roots={roots:string[];platform:string};
const request=async<T,>(url:string,body?:object,signal?:AbortSignal):Promise<T>=>{
 const response=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined,signal});
 const data=await response.json();if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);return data as T;
};
export type FolderKind='game'|'compiler'|'destination'|'resource';
/** Selects a *real* absolute path on the local Node server, unlike the browser's
 * showDirectoryPicker(), which deliberately hides the absolute disk path. */
export function LocalFolderPicker({kind,initial,onPick,onClose,es,gameProfile='svengine',compilerEngine='sc'}:{kind:FolderKind;initial:string;onPick:(path:string)=>void;onClose:()=>void;es:boolean;gameProfile?:'svengine'|'cs16';compilerEngine?:'sc'|'zhlt'|'sdhlt'}){
 const [roots,setRoots]=useState<string[]>([]);const [current,setCurrent]=useState<FolderData|null>(null);
 const [target,setTarget]=useState(initial);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 // Never render the SvenStudio explorer behind the native Windows picker.
 // The custom directory browser is used only on platforms without this API.
 const [showFallback,setShowFallback]=useState(false);
 useEffect(()=>{let alive=true;
  const nativeError=(detail:string)=>{
   if(!alive)return;
   window.alert((es?'No se pudo seleccionar la carpeta en Windows. Podés escribir la ruta manualmente.':'Could not select a Windows folder. You can enter the path manually.')+'\n'+detail);
   onClose();
  };
  void request<Roots>('/api/setup/roots').then(async rootsResponse=>{
   if(!alive)return;
   setRoots(rootsResponse.roots);
   if(rootsResponse.platform!=='win32'){setShowFallback(true);return;}
   try{
    const selection=await request<{supported:boolean;cancelled?:boolean;path?:string}>('/api/setup/native-folder',{initial});
    if(!alive)return;
    if(selection.cancelled){onClose();return}
    if(!selection.supported||!selection.path){nativeError('Native folder dialog unavailable.');return}
    // Verify the selected absolute path on the local server, not in Chrome.
    const verified=(kind==='game'||kind==='compiler')
     ?await request<{valid:boolean}>('/api/setup/verify',{kind,path:selection.path})
     :{valid:Boolean((await request<FolderData>('/api/setup/folders',{path:selection.path})).path)};
    if(!alive)return;
    if(!verified.valid){nativeError(es?'La carpeta elegida no corresponde a la instalación seleccionada.':'The selected folder does not match the installation.');return}
    onPick(selection.path);onClose();
   }catch(error){nativeError(String(error instanceof Error?error.message:error))}
  }).catch(error=>nativeError(String(error instanceof Error?error.message:error)));
  return()=>{alive=false};
  // Selecting a folder is a one-shot native action for this component mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const open=async(folder:string)=>{setBusy(true);setMessage('');try{const data=await request<FolderData>('/api/setup/folders',{path:folder});setCurrent(data);setTarget(data.path)}catch(e){setMessage(String(e))}finally{setBusy(false)}};
 const select=async()=>{
  setBusy(true);setMessage('');try{
   const verified=(kind==='destination'||kind==='resource')?{valid:Boolean((await request<FolderData>('/api/setup/folders',{path:target})).path)}:await request<{valid:boolean}>('/api/setup/verify',{kind,path:target});
   if(!verified.valid){setMessage(es?'La carpeta existe, pero no parece contener la instalación correcta. Podés cambiarla o escribir la ruta manualmente.':'This folder exists but does not look like the right installation. Select another or enter a path manually.');return;}
   onPick(target);onClose();
  }catch(e){setMessage(String(e))}finally{setBusy(false)}
 };
 if(!showFallback)return null;
 return <div className="modal-backdrop folder-picker-backdrop" onMouseDown={e=>{e.stopPropagation();onClose()}}>
  <section className="modal-card folder-picker" role="dialog" aria-modal="true" aria-label={es?'Buscar carpeta local':'Browse local folder'} onMouseDown={e=>e.stopPropagation()}>
   <div className="modal-title"><HardDrive size={19}/><span>{es?'Buscar carpeta':'Browse folders'} · {kind==='compiler'?(compilerEngine==='zhlt'?'ZHLT · CS 1.6': 'Sven Co-op SDK'):kind==='destination'?'Smart Build export':kind==='resource'?'External resources':gameProfile==='cs16'?'Counter-Strike 1.6':'Sven Co-op'}</span><button type="button" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
   <p className="modal-subtext">{es?'Elegí una carpeta del PC donde está ejecutándose SvenStudio. No se modificará ningún archivo.':'Select a folder on the PC running SvenStudio. No files will be modified.'}</p>
   <div className="folder-drive-list">{roots.map(root=><button type="button" key={root} onClick={()=>void open(root)}><HardDrive size={15}/>{root}</button>)}</div>
   <div className="folder-location"><button type="button" disabled={!current?.parent||busy} onClick={()=>current?.parent&&void open(current.parent)} title={es?'Subir un nivel':'Go up'}><ArrowUp size={17}/></button><input aria-label={es?'Ruta actual':'Current path'} value={target} onChange={e=>setTarget(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void open(target)}}/><button type="button" disabled={busy} onClick={()=>void open(target)}><FolderOpen size={16}/>{es?'Abrir':'Open'}</button></div>
   <div className="folder-list" role="listbox" aria-label={es?'Carpetas':'Folders'}>{!current?<p>{es?'Seleccioná una unidad o ingresá una ruta.':'Select a drive or enter a path.'}</p>:current.folders.length===0?<p>{es?'Esta carpeta no contiene subcarpetas visibles.':'No visible subfolders.'}</p>:current.folders.map(folder=><button role="option" aria-selected={false} key={folder} type="button" onClick={()=>void open(`${current.path.replace(/[\\/]+$/,'')}${current.path.includes('\\')?'\\':'/'}${folder}`)}><Folder size={15}/>{folder}</button>)}</div>
   {current?.truncated&&<p className="modal-subtext">{es?'Se muestran las primeras 250 carpetas. Podés ingresar la ruta directamente.':'Showing the first 250 folders. You can enter a path directly.'}</p>}
   {message&&<p role="alert" className="bt-error">{message}</p>}
   <div className="modal-footer"><button type="button" onClick={onClose}>{es?'Cancelar':'Cancel'}</button><button className="primary-action" disabled={!target.trim()||busy} onClick={()=>void select()}><Check size={16}/>{es?'Usar esta carpeta':'Use this folder'}</button></div>
  </section>
 </div>;
}
export type DiscoveredFolders={gameDirs:string[];compilerDirs:string[];cs16GameDirs?:string[];cs16CompilerDirs?:string[];cs16CompilerStatus?:{state:'ready'|'incomplete'|'not-found';folder:string;missing:string[]};roots:string[]};
export async function autoDetectInstallations(){return request<DiscoveredFolders>('/api/setup/detect',{});}
