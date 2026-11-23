/** v2.6 Save-as-prefab dialog for the BSP Object Extractor (replaces window.prompt). */
import {useState} from 'react';
import {Package,X} from 'lucide-react';
import {useT} from '../i18n';
import {BSP_PREFAB_CATEGORIES,type BspObjectExtractionMode} from '../engine/bspObjectExtractor';

export type BspPrefabSaveSettings={title:string;category:string;mode:BspObjectExtractionMode;includeEntity:boolean;includePoints:boolean;margin:number;frame:'cut'|'separate'|'none';frameMargin:number};
const CATEGORY_LABEL:Record<string,string>={doors:'Doors',furniture:'Furniture',computers:'Computers & screens',lighting:'Lighting',decoration:'Decoration',industrial:'Industrial',vehicles:'Vehicles',nature:'Nature',other:'Other'};
const MODE_LABEL:Record<string,string>={auto:'Automatic (recommended): picks the best method',exact:'Exact closed solids','surface-shell':'Visible panels (approximate)','world-solid':'World solids in the selection box','hull0-solid':'Brush model solids (Hull 0)',door:'Complete door (leaves, buttons and frame)'};

export function BspPrefabSaveDialog({initialName,mode,entityClass,pointCount,hull0Allowed,worldAllowed,faceCount,doorInfo,onCancel,onSave}:{
  initialName:string;mode:BspObjectExtractionMode;entityClass:string|null;pointCount:number;hull0Allowed:boolean;worldAllowed:boolean;faceCount:number;doorInfo?:{leaves:number;buttons:number}|null;
  onCancel:()=>void;onSave:(s:BspPrefabSaveSettings)=>void}){
  const t=useT();
  const guess=/door|puerta/i.test(entityClass??'')?'doors':/light/i.test(entityClass??'')?'lighting':'other';
  const [s,setS]=useState<BspPrefabSaveSettings>({title:initialName,category:entityClass?.startsWith('func_door')||mode==='door'?'doors':guess,mode,includeEntity:!!entityClass,includePoints:pointCount>0,margin:8,frame:'cut',frameMargin:32});
  const modes:BspObjectExtractionMode[]=[...(doorInfo?['door' as const]:[]),'auto','exact','surface-shell',...(worldAllowed?['world-solid' as const]:[]),...(hull0Allowed?['hull0-solid' as const]:[])];
  const valid=s.title.trim().length>0&&s.title.trim().length<=64;
  return <div className="modal-backdrop bsp-prefab-dialog-backdrop" onMouseDown={onCancel}>
    <form className="bsp-prefab-dialog" role="dialog" aria-modal="true" aria-label={t('Save as prefab')} onMouseDown={e=>e.stopPropagation()} onSubmit={e=>{e.preventDefault();if(valid)onSave({...s,title:s.title.trim()});}}>
      <header><Package size={17}/><strong>{t('Save as prefab')}</strong><small>{faceCount} {t('faces selected')}</small><button type="button" aria-label={t('Close')} onClick={onCancel}><X size={15}/></button></header>
      <label>{t('Name')}<input autoFocus value={s.title} maxLength={64} onChange={e=>setS({...s,title:e.target.value})}/></label>
      <label>{t('Category')}<select value={s.category} onChange={e=>setS({...s,category:e.target.value})}>{BSP_PREFAB_CATEGORIES.map(c=><option key={c} value={c}>{t(CATEGORY_LABEL[c])}</option>)}</select></label>
      <label>{t('Geometry')}<select value={s.mode} onChange={e=>setS({...s,mode:e.target.value as BspObjectExtractionMode})}>{modes.map(m=><option key={m} value={m}>{t(MODE_LABEL[m])}</option>)}</select></label>
      {s.mode==='world-solid'&&<label>{t('Box margin (units)')}<input type="number" min={1} max={64} value={s.margin} onChange={e=>setS({...s,margin:Math.max(1,Math.min(64,e.target.valueAsNumber||8))})}/></label>}
      {s.mode==='door'&&doorInfo&&<><p className="bsp-note">{doorInfo.leaves} {t('door leaves')} · {doorInfo.buttons} {t('buttons')}</p>
        <label>{t('Frame')}<select value={s.frame} onChange={e=>setS({...s,frame:e.target.value as BspPrefabSaveSettings['frame']})}><option value="cut">{t('Piece of the wall around the door')}</option><option value="separate">{t('Only a separate frame')}</option><option value="none">{t('No frame (door only)')}</option></select></label>
        {s.frame!=='none'&&<label>{t('Frame width (units)')}<input type="number" min={8} max={256} step={8} value={s.frameMargin} onChange={e=>setS({...s,frameMargin:Math.max(8,Math.min(256,e.target.valueAsNumber||32))})}/></label>}</>}
      {s.mode!=='door'&&<><label className="bsp-check"><input type="checkbox" disabled={!entityClass} checked={s.includeEntity} onChange={e=>setS({...s,includeEntity:e.target.checked})}/>{entityClass?`${t('Keep the entity')} (${entityClass})`:t('No brush entity in this selection')}</label>
      <label className="bsp-check"><input type="checkbox" disabled={!pointCount} checked={s.includePoints} onChange={e=>setS({...s,includePoints:e.target.checked})}/>{t('Include entities inside the object')} ({pointCount})</label></>}
      <p className="bsp-note">{t('Original WAD3 textures are copied into the prefab. A thumbnail is generated for the Prefab Studio.')}</p>
      <footer><button type="button" onClick={onCancel}>{t('Cancel')}</button><button type="submit" className="bsp-prefab-save" disabled={!valid}><Package size={14}/>{t('Save prefab')}</button></footer>
    </form>
  </div>;
}
