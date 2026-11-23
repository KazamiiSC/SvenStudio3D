/** v2.6 batch extraction dialog: lists every door group and brush-entity object of the BSP and
 * saves the chosen ones as prefabs (doors with leaves + frame, objects as Hull 0 solids). */
import {useMemo,useState} from 'react';
import {Boxes,DoorOpen,Package,X} from 'lucide-react';
import {useT} from '../i18n';
import type {BspBatchCandidate} from '../engine/bspDoorCapture';

export function BspBatchExtract({candidates,busy,progress,onCancel,onRun}:{candidates:BspBatchCandidate[];busy:boolean;progress:string;onCancel:()=>void;onRun:(list:BspBatchCandidate[],prefix:string)=>void}){
  const t=useT();
  const [chosen,setChosen]=useState<Set<string>>(()=>new Set(candidates.filter(c=>c.kind==='door').map(c=>c.key)));
  const [prefix,setPrefix]=useState('');const [filter,setFilter]=useState<'all'|'door'|'object'>('all');
  const shown=useMemo(()=>candidates.filter(c=>filter==='all'||c.kind===filter),[candidates,filter]);
  const toggle=(k:string)=>setChosen(s=>{const n=new Set(s);if(n.has(k))n.delete(k);else n.add(k);return n;});
  return <div className="modal-backdrop bsp-prefab-dialog-backdrop" onMouseDown={busy?undefined:onCancel}>
    <section className="bsp-prefab-dialog bsp-batch-dialog" role="dialog" aria-modal="true" aria-label={t('Batch extraction')} onMouseDown={e=>e.stopPropagation()}>
      <header><Boxes size={17}/><strong>{t('Batch extraction')}</strong><small>{candidates.length} {t('objects found')}</small><button type="button" aria-label={t('Close')} disabled={busy} onClick={onCancel}><X size={15}/></button></header>
      <div className="pfstudio-cats">{(['all','door','object'] as const).map(f=><button key={f} type="button" className={filter===f?'active':''} onClick={()=>setFilter(f)}>{t(f==='all'?'All':f==='door'?'Doors':'Objects')}</button>)}
        <button type="button" onClick={()=>setChosen(new Set(shown.map(c=>c.key)))}>{t('Select all')}</button><button type="button" onClick={()=>setChosen(new Set())}>{t('None')}</button></div>
      <div className="bsp-batch-list">{shown.map(c=><label key={c.key} className="bsp-check"><input type="checkbox" checked={chosen.has(c.key)} disabled={busy} onChange={()=>toggle(c.key)}/>
        {c.kind==='door'?<DoorOpen size={13}/>:<Package size={13}/>}<span>{c.title}<small>{c.classname}{c.kind==='door'?` · ${c.leaves} ${t('door leaves')}`:` · ${c.faceIds.length} ${t('faces')}`}</small></span></label>)}
        {!shown.length&&<small>{t('No doors or brush-entity objects in this BSP.')}</small>}</div>
      <label>{t('Name prefix (optional)')}<input value={prefix} maxLength={24} onChange={e=>setPrefix(e.target.value.replace(/[^\w-]/g,''))}/></label>
      <p className="bsp-note">{t('Doors are saved complete (leaves, buttons and a piece of the wall as frame); other objects as solids that keep their entity. Each one becomes a .svprefab with its textures and thumbnail.')}</p>
      {progress&&<p className="bsp-edit-notice" role="status">{progress}</p>}
      <footer><button type="button" disabled={busy} onClick={onCancel}>{t('Cancel')}</button><button type="button" className="bsp-prefab-save" disabled={busy||!chosen.size} onClick={()=>onRun(candidates.filter(c=>chosen.has(c.key)),prefix)}><Package size={14}/>{t('Save')} {chosen.size}</button></footer>
    </section>
  </div>;
}
