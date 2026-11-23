/** v2.6 BSP Editor structure panel (bspguy-style): limits, unused-model cleanup and new box
 * brush entities (triggers / invisible walls) added without recompiling. */
import {useMemo,useState} from 'react';
import * as THREE from 'three';
import {Boxes,MousePointer2,Plus,Trash2,X} from 'lucide-react';
import {useT} from '../i18n';
import {BSP_BOX_CLASSES,bspLumpUsage,type BspBoxModel} from '../engine/bspStructure';
import {gameToThree} from '../engine/geometry';

export type BspBoxDraft={classname:string;size:[number,number,number];props:string};
export const defaultBoxDraft:BspBoxDraft={classname:'trigger_once',size:[128,128,128],props:'target=\n'};
/** Box centred on X/Y with its bottom on the clicked point. */
export function boxFromDraft(draft:BspBoxDraft,at:[number,number,number]):BspBoxModel{
  const props:Record<string,string>={};
  for(const line of draft.props.split(/\r?\n/)){const i=line.indexOf('=');if(i<1)continue;const k=line.slice(0,i).trim(),v=line.slice(i+1).trim();if(k&&v)props[k]=v;}
  const [w,d,h]=draft.size;
  return {classname:draft.classname,mins:[Math.round(at[0]-w/2),Math.round(at[1]-d/2),Math.round(at[2])],maxs:[Math.round(at[0]+w/2),Math.round(at[1]+d/2),Math.round(at[2]+h)],props};
}

export function BspStructurePanel({source,boxes,setBoxes,draft,setDraft,placing,setPlacing,prune,setPrune,onClose}:{
  source:ArrayBuffer;boxes:BspBoxModel[];setBoxes:(b:BspBoxModel[])=>void;draft:BspBoxDraft;setDraft:(d:BspBoxDraft)=>void;
  placing:boolean;setPlacing:(v:boolean)=>void;prune:boolean;setPrune:(v:boolean)=>void;onClose:()=>void}){
  const t=useT();
  const usage=useMemo(()=>{try{return bspLumpUsage(source)}catch{return []}},[source]);
  const [error,setError]=useState('');
  const size=(i:number,v:number)=>{const s=[...draft.size] as [number,number,number];s[i]=Math.max(8,Math.min(8192,Number.isFinite(v)?v:8));setDraft({...draft,size:s});};
  return <aside className="bsp-structure-panel" aria-label={t('BSP structure')}>
    <header><Boxes size={15}/><strong>{t('BSP structure')}</strong><button type="button" aria-label={t('Close')} onClick={onClose}><X size={14}/></button></header>
    <h4>{t('Limits')}</h4>
    <div className="bsp-limits">{usage.map(u=><div key={u.key} className={u.percent>=90?'over':u.percent>=70?'high':''}>
      <span>{t(u.label)}</span><div className="bsp-limit-bar"><i style={{width:`${Math.min(100,u.percent)}%`}}/></div>
      <small>{u.bytes?`${(u.count/1024).toFixed(0)} / ${(u.max/1024).toFixed(0)} KB`:`${u.count.toLocaleString()} / ${u.max.toLocaleString()}`}</small></div>)}</div>
    <p className="bsp-note">{t('Limits of the SDHLT compiler. The game may accept a little more for some of them.')}</p>
    <label className="bsp-check"><input type="checkbox" checked={prune} onChange={e=>setPrune(e.target.checked)}/>{t('Remove unused brush models when exporting')}</label>
    <h4>{t('New box entities')}</h4>
    <p className="bsp-note">{t('Adds invisible triggers or clip walls to the compiled map without recompiling: a new brush model with its own collision hulls.')}</p>
    <label>{t('Entity')}<select value={draft.classname} onChange={e=>setDraft({...draft,classname:e.target.value})}>{BSP_BOX_CLASSES.map(c=><option key={c} value={c}>{c==='func_wall'?'func_wall (invisible wall)':c}</option>)}</select></label>
    <div className="bsp-box-size">{(['X','Y','Z'] as const).map((a,i)=><label key={a}>{a}<input type="number" min={8} max={8192} step={8} value={draft.size[i]} onChange={e=>size(i,e.target.valueAsNumber)}/></label>)}</div>
    <label>{t('Keyvalues (key=value per line)')}<textarea rows={3} value={draft.props} spellCheck={false} onChange={e=>setDraft({...draft,props:e.target.value})}/></label>
    <div className="bsp-visual-edit-actions"><button type="button" className={placing?'bsp-on':''} onClick={()=>{setError('');setPlacing(!placing);}}><MousePointer2 size={13}/>{placing?t('Click a surface…'):t('Place by clicking map')}</button></div>
    {error&&<p className="bsp-error">{error}</p>}
    <div className="bsp-box-list">{boxes.map((b,i)=><div key={i}><code>{b.classname}</code><small>{b.mins.join(' ')} → {b.maxs.join(' ')}</small>
      <button type="button" aria-label={t('Delete')} onClick={()=>setBoxes(boxes.filter((_,k)=>k!==i))}><Trash2 size={12}/></button></div>)}
      {!boxes.length&&<small>{t('No new boxes yet.')}</small>}</div>
    {boxes.length>0&&<p className="bsp-note"><Plus size={12}/>{t('They are written when you export the BSP copy.')}</p>}
  </aside>;
}
/** Translucent preview of pending boxes inside the BSP canvas. */
export function BspBoxPreview({boxes}:{boxes:readonly BspBoxModel[]}){
  return <group>{boxes.map((b,i)=>{
    const c=gameToThree([(b.mins[0]+b.maxs[0])/2,(b.mins[1]+b.maxs[1])/2,(b.mins[2]+b.maxs[2])/2]);
    const size:[number,number,number]=[b.maxs[0]-b.mins[0],b.maxs[2]-b.mins[2],b.maxs[1]-b.mins[1]];
    const color=b.classname==='func_wall'?'#7fa8ff':b.classname==='trigger_hurt'?'#ff6b5a':'#ffb347';
    return <mesh key={i} position={c} raycast={()=>null}><boxGeometry args={size}/><meshBasicMaterial color={color} transparent opacity={.28} depthWrite={false} side={THREE.DoubleSide}/></mesh>;
  })}</group>;
}
