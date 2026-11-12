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
export function LocalFolderPicker({kind,initial,onPick,onClose,es}:{kind:FolderKind;initial:string;onPick:(path:string)=>void;onClose:()=>void;es:boolean}){
 const [roots,setRoots]=useState<string[]>([]);const [current,setCurrent]=useState<FolderData|null>(null);
 const [target,setTarget]=useState(initial);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 useEffect(()=>{let alive=true;void request<Roots>('/api/setup/roots').then(result=>{if(alive)setRoots(result.roots);}).catch(e=>{if(alive)setMessage(String(e));});return()=>{alive=false}},[]);
 const open=async(folder:string)=>{setBusy(true);setMessage('');try{const data=await request<FolderData>('/api/setup/folders',{path:folder});setCurrent(data);setTarget(data.path)}catch(e){setMessage(String(e))}finally{setBusy(false)}};
 const select=async()=>{
  setBusy(true);setMessage('');try{
   const verified=(kind==='destination'||kind==='resource')?{valid:Boolean((await request<FolderData>('/api/setup/folders',{path:target})).path)}:await request<{valid:boolean}>('/api/setup/verify',{kind,path:target});
   if(!verified.valid){setMessage(es?'La carpeta existe, pero no parece contener la instalación correcta. Podés cambiarla o escribir la ruta manualmente.':'This folder exists but does not look like the right installation. Select another or enter a path manually.');return;}
   onPick(target);onClose();
  }catch(e){setMessage(String(e))}finally{setBusy(false)}
 };
 return <div className="modal-backdrop folder-picker-backdrop" onMouseDown={e=>{e.stopPropagation();onClose()}}>
  <section className="modal-card folder-picker" role="dialog" aria-modal="true" aria-label={es?'Buscar carpeta local':'Browse local folder'} onMouseDown={e=>e.stopPropagation()}>
   <div className="modal-title"><HardDrive size={19}/><span>{es?'Buscar carpeta':'Browse folders'} · {kind==='compiler'?'Sven Co-op SDK':kind==='destination'?'Smart Build export':kind==='resource'?'External resources':'Sven Co-op'}</span><button type="button" onClick={onClose} aria-label="Close"><X size={18}/></button></div>
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
export type DiscoveredFolders={gameDirs:string[];compilerDirs:string[];roots:string[]};
export async function autoDetectInstallations(){return request<DiscoveredFolders>('/api/setup/detect',{});}
