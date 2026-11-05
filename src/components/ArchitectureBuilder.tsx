import {useEffect,useState} from 'react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {defaultArchitecture,type ArchitectureKind,type ArchitectureOptions} from '../engine/architecture';

const kinds:ArchitectureKind[]=['door','window','frame','arch','stairs','ramp','column','room'];
export function ArchitectureBuilder(){
 const t=useT();const [kind,setKind]=useState<ArchitectureKind>('door');
 const [options,setOptions]=useState<ArchitectureOptions>(defaultArchitecture);
 const [error,setError]=useState('');
 useEffect(()=>{
   const onError=(event:Event)=>setError((event as CustomEvent<string>).detail);
   window.addEventListener('svenstudio:architecture-error',onError);
   return()=>window.removeEventListener('svenstudio:architecture-error',onError);
 },[]);
 const selected=useEditor(s=>s.project.objects.find(o=>o.id===s.selected));
 const build=useEditor(s=>s.buildArchitecture);
 const placement=useEditor(s=>s.architecturePlacement);
 const startPlacement=useEditor(s=>s.startArchitecturePlacement);
 const smartMerge=useEditor(s=>s.smartMergeSelected);
 const mergeOne=useEditor(s=>s.mergeIntoOneSelected);
 const unmerge=useEditor(s=>s.unmergeSmartSelected);
 const selectedCount=useEditor(s=>s.selectedIds.length);
 const canUnmerge=selected?.group?.startsWith('Smart Merge ')===true;
 const existingOpening=useEditor(s=>s.project.architectureOpenings?.find(r=>r.memberIds.includes(s.selected||'')));
 const updateOpening=useEditor(s=>s.updateSelectedOpening);
 const createBrushEntity=useEditor(s=>s.createSelectedBrushEntity);
 const set=(key:keyof ArchitectureOptions,value:number|boolean)=>setOptions(prev=>({...prev,[key]:value}));
 const needsWall=kind==='door'||kind==='window';
 const fields: {key:keyof ArchitectureOptions;label:string;min:number;max:number}[]=[
  {key:'width',label:'Width',min:8,max:8192},
  {key:'height',label:'Height',min:8,max:8192},
  {key:'depth',label:'Depth',min:1,max:8192},
  {key:'frame',label:'Frame thickness',min:1,max:128},
  {key:'steps',label:'Segments / steps',min:1,max:64}];
 return <div className="architecture-builder">
  <div className="category-label">{t('Quick Architecture')}</div>
  <p className="panel-text">{t('Build doors, windows and architectural details from GoldSrc-safe convex brushes.')}</p>
  <div className="architecture-kinds">{kinds.map(k=><button type="button" key={k} className={k===kind?'active':''} onClick={()=>{setKind(k);setError('')}}>{t('Architecture '+k)}</button>)}</div>
  <div className="architecture-options">{fields.filter(f=>f.key!=='steps'||kind==='stairs'||kind==='arch').filter(f=>f.key!=='frame'||!['ramp','column','stairs'].includes(kind)).map(f=><label key={f.key}>{t(f.label)}<input type="number" min={f.min} max={f.max} step={1} value={options[f.key] as number} onChange={e=>set(f.key,Number(e.target.value))}/></label>)}</div>
  {needsWall&&<div className="architecture-flags">
   <label><input type="checkbox" checked={options.cutOnly} onChange={e=>set('cutOnly',e.target.checked)}/>{t('Opening only (no frame)')}</label>
   {kind==='door'&&!options.cutOnly&&<label><input type="checkbox" checked={options.doorLeaf} onChange={e=>set('doorLeaf',e.target.checked)}/>{t('Add separate door leaf brush')}</label>}
  </div>}
  <p className="panel-text">{t(needsWall?'Select an upright Box wall, then create a real through-hole.':'Creates an editable group of convex brushes near the selected object, or at the origin.')}</p>
  {needsWall&&<p className="panel-text">{t('Selected wall')}: {selected?.kind==='brush'?selected.name:t('None')}</p>}
  {needsWall&&<div className="architecture-actions">
    <button type="button" className={placement?'soft-button active':'soft-button'} onClick={()=>{startPlacement(placement?null:kind,options);setError('')}}>{t(placement?'Cancel wall placement':'Point and place in 3D')}</button>
    <p className="panel-text">{t('Hover over an axis-aligned Box wall, click to position the opening. Change Width/Height before activating. Esc cancels.')}</p>
  </div>}
  <div className="architecture-merge">
    <div className="category-label">{t('Smart Brush Merge')}</div>
    <p className="panel-text">{t('Select multiple brushes using Shift+click. Smart Merge keeps the convex pieces; Merge into One works only if the union is convex.')}</p>
    <div className="architecture-merge-buttons">
      <button type="button" disabled={selectedCount<2} onClick={()=>{try{smartMerge();setError('')}catch(e){setError(String(e))}}}>{t('Smart Merge')}</button>
      <button type="button" disabled={selectedCount<2} onClick={()=>{try{mergeOne();setError('')}catch(e){setError(String(e))}}}>{t('Merge into One')}</button>
      <button type="button" disabled={!canUnmerge} onClick={()=>{try{unmerge();setError('')}catch(e){setError(String(e))}}}>{t('Unmerge')}</button>
    </div>
  </div>
  {existingOpening&&<div className="architecture-actions">
    <p className="panel-text">{t('Selected parametric opening')}: {t('Architecture '+existingOpening.kind)}</p>
    <button className="soft-button" type="button" onClick={()=>{try{updateOpening(options);setError('')}catch(err){setError(String(err))}}}>{t('Update selected opening')}</button>
    <button type="button" onClick={()=>{setKind(existingOpening.kind);setOptions(existingOpening.options);setError('')}}>{t('Load opening dimensions')}</button>
  </div>}
  {error&&<p className="architecture-error" role="alert">{error}</p>}
  <button className="soft-button" type="button" onClick={()=>{try{build(kind,options);setError('')}catch(err){setError(err instanceof Error?err.message:String(err))}}}>{t('Create architecture')}</button>
  <p className="panel-text">{t('Undo: Ctrl+Z. Door leaves can be converted to func_door using the brush context menu.')}</p>
 </div>
}
