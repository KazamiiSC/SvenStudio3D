import {useState} from 'react';
import {BookOpen,RefreshCw} from 'lucide-react';
import {useEditor} from '../store';
import {ensureSvenCoopFgd} from '../engine/svenFgdLoader';
/** Renders only for the current entity inspector; no per-entity network request. */
export function FgdLoadControl({compact=false}:{compact?:boolean}){
  const locale=useEditor(s=>s.locale),loaded=useEditor(s=>s.fgdLoaded),count=useEditor(s=>s.fgdClasses.length);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const es=locale==='es';
  const load=async()=>{
    setBusy(true);setError('');
    try{await ensureSvenCoopFgd({discover:true,force:true})}
    catch(e){setError(String(e instanceof Error?e.message:e))}
    finally{setBusy(false)}
  };
  return <div className={`fgd-load-control${compact?' compact':''}`}>
    <span><BookOpen size={14}/>{loaded?(es?`FGD cargado · ${count} clases`:`FGD loaded · ${count} classes`):(es?'FGD de Sven Co-op no cargado':'Sven Co-op FGD not loaded')}</span>
    <button type="button" disabled={busy} onClick={()=>void load()}><RefreshCw size={13}/>{busy?'…':loaded?(es?'Recargar':'Reload'):(es?'Cargar automáticamente':'Load automatically')}</button>
    {error&&<small role="alert">{error}</small>}
  </div>;
}
