import {useMemo,useState} from 'react';
import {MousePointer2,Crosshair,BookOpen} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {buildKit,kitPreviewBrushes,kitsForStudio,type KitDefinition,type KitOptions,type KitStudio} from '../engine/svenKits';
import {defaultTerrain} from '../engine/terrain';
import {BrushPreview} from './BrushPreview';
import type {Vec3} from '../engine/types';

/** Collapsible host: the gallery (and its 3D preview) is only mounted while the section is open. */
export function KitSection({studio,summary,onStart,className='studio-kits'}:{studio:KitStudio;summary:string;onStart?:()=>void;className?:string}){
  const [open,setOpen]=useState(false);
  return <details className={className} onToggle={e=>setOpen((e.currentTarget as HTMLDetailsElement).open)}><summary>{summary}</summary>{open&&<KitGallery studio={studio} onStart={onStart}/>}</details>;
}

/** v2.6: TWHL-based Svengine kits shown inside the studio they belong to. Same flow as every
 * studio tool: options → live 3D preview → "Place by clicking map" (ghost follows the mouse). */
export function KitGallery({studio,onStart,title,wide=false}:{studio:KitStudio;onStart?:()=>void;title?:string;wide?:boolean}){
  const t=useT();
  const kits=useMemo(()=>kitsForStudio(studio),[studio]);
  const [id,setId]=useState(kits[0]?.id);
  const [values,setValues]=useState<Record<string,KitOptions>>({});
  const [message,setMessage]=useState('');
  const texture=useEditor(s=>s.currentTexture)||'SV_BRICK01';
  const def:KitDefinition|undefined=kits.find(k=>k.id===id)??kits[0];
  const options=useMemo<KitOptions>(()=>def?{...def.defaults,...values[def.id]}:{},[def,values]);
  const preview=useMemo(()=>{
    if(!def)return {brushes:[],error:'',summary:null};
    try{const built=buildKit(def.id,options,[0,0,0],[],texture);return {brushes:kitPreviewBrushes(built.objects),error:'',summary:built.summary};}
    catch(e){return {brushes:[],error:e instanceof Error?e.message:String(e),summary:null};}
  },[def,options,texture]);
  if(!def)return null;
  const set=(key:string,value:number|string|boolean)=>setValues(prev=>({...prev,[def.id]:{...prev[def.id],[key]:value}}));
  const place=()=>{
    if(preview.error){setMessage('Error: '+t(preview.error));return;}
    useEditor.getState().startTerrainPlacement({kind:'kit',draft:{...defaultTerrain(),texture},kit:{id:def.id,options:{...options}}});
    setMessage('');onStart?.();
  };
  const createHere=()=>{
    try{
      const s=useEditor.getState();const sel=s.project.objects.find(o=>o.id===s.selected);
      const at:Vec3=sel?[...sel.position]:[0,0,0];
      const built=buildKit(def.id,options,at,s.project.objects,texture);
      s.addGeneratedObjects(built.objects);
      setMessage(`${t(def.title)}: ${built.summary.brushes} ${t('brushes')} · ${built.summary.entities} ${t('entities')}`);
    }catch(e){setMessage('Error: '+t(e instanceof Error?e.message:String(e)));}
  };
  const cards=<div className="architecture-kinds kit-cards" role="tablist">{kits.map(k=><button type="button" role="tab" key={k.id} aria-selected={k.id===def.id}
      className={k.id===def.id?'active':''} onClick={()=>{setId(k.id);setMessage('');}}>{t(k.title)}</button>)}</div>;
  const intro=<><p className="panel-text">{t(def.description)}</p>
    <p className="kit-source"><BookOpen size={12}/>{t('Based on TWHL')}: {def.tutorial}</p></>;
  const fields=<><div className="architecture-options">{def.fields.filter(f=>f.type!=='bool'&&(!f.when||f.when(options))).map(f=><label key={f.key}>{t(f.label)}
      {f.type==='select'?<select value={String(options[f.key])} onChange={e=>set(f.key,e.target.value)}>{f.options!.map(([v,l])=><option key={v} value={v}>{t(l)}</option>)}</select>
      :f.type==='text'?<input type="text" value={String(options[f.key]??'')} maxLength={64} onChange={e=>set(f.key,e.target.value)}/>
      :<input type="number" min={f.min} max={f.max} step={f.step??1} value={Number(options[f.key])} onChange={e=>set(f.key,e.target.valueAsNumber)}/>}</label>)}</div>
    <div className="kit-checks">{def.fields.filter(f=>f.type==='bool'&&(!f.when||f.when(options))).map(f=><label key={f.key} className="shape-inline-check">
      <input type="checkbox" checked={options[f.key]===true} onChange={e=>set(f.key,e.target.checked)}/>{t(f.label)}</label>)}</div></>;
  const previewLabel=preview.error?t(preview.error):`${preview.summary?.brushes??0} ${t('brushes')} · ${preview.summary?.entities??0} ${t('entities')} · ${t('Drag to orbit; wheel to zoom.')}`;
  const classes=preview.summary&&<div className="kit-classes">{preview.summary.classnames.map(c=><code key={c}>{c}</code>)}</div>;
  const actions=<><div className="smart-arch-actions">
      <button type="button" className="soft-button" disabled={!!preview.error} onClick={place}><MousePointer2 size={14}/>{t('Place by clicking map')}</button>
      <button type="button" disabled={!!preview.error} title={t('Create it on the selected object, or at the world origin without a selection.')} onClick={createHere}><Crosshair size={14}/>{t('Create on selection')}</button>
    </div>
    {message&&<p className={message.startsWith('Error:')?'architecture-error':'smart-arch-status'} role="status">{message}</p>}</>;
  if(wide)return <div className="kit-gallery kit-gallery-wide" data-kit-studio={studio}>
    <div className="kit-wide-side">
      {title&&<div className="category-label">{t(title)}</div>}
      {cards}
      <div className="kit-wide-options"><strong className="kit-wide-title">{t(def.title)}</strong>{intro}{fields}</div>
      {actions}
    </div>
    <div className="kit-wide-stage">
      <BrushPreview className="kit-wide-preview" height="100%" brushes={preview.brushes} label={previewLabel}/>
      {classes}
    </div>
  </div>;
  return <div className="kit-gallery" data-kit-studio={studio}>
    {title&&<div className="category-label">{t(title)}</div>}
    {cards}{intro}{fields}
    <BrushPreview brushes={preview.brushes} height={260} label={previewLabel}/>
    {classes}{actions}
  </div>;
}
