import {useEffect} from 'react';
import {Palette,RotateCcw,CheckCircle2} from 'lucide-react';
import {useEditor} from '../store';
import {ENTITY_COLOR_KINDS} from '../engine/entityAppearance';
import {useT} from '../i18n';

const labels:Record<string,string>={spawn:'Player Spawn',light:'Point Light',npc:'NPCs',trigger:'Triggers',item:'Items',logic:'Logic & effects',other:'Other'};
export function EntityAppearanceModal({onClose}:{onClose:()=>void}){
  const t=useT();
  const appearance=useEditor(s=>s.entityAppearance);
  const set=useEditor(s=>s.setEntityAppearance);
  const setColor=useEditor(s=>s.setEntityColor);
  const reset=useEditor(s=>s.resetEntityAppearance);
  useEffect(()=>{
    const esc=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.stopImmediatePropagation();onClose()}};
    window.addEventListener('keydown',esc,true);
    return()=>window.removeEventListener('keydown',esc,true);
  },[onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card entity-appearance-card" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-title"><Palette size={20}/><span>{t('Entity visuals')}</span><button onClick={onClose} aria-label={t('Done')}>×</button></div>
    <div className="entity-appearance-content">
      <p className="modal-subtext">{t('Change entity markers and labels without affecting the compiled map.')}</p>
      <label className="appearance-slider">{t('Label size')}<div><input type="range" min="11" max="30" step="1" value={appearance.labelSize} onChange={e=>set({labelSize:Number(e.target.value)})}/><output>{appearance.labelSize}px</output></div></label>
      <label className="appearance-slider">{t('Label opacity')}<div><input type="range" min="35" max="100" step="5" value={Math.round(appearance.opacity*100)} onChange={e=>set({opacity:Number(e.target.value)/100})}/><output>{Math.round(appearance.opacity*100)}%</output></div></label>
      <label className="appearance-slider">{t('Marker size')}<div><input type="range" min="50" max="250" step="5" value={Math.round(appearance.markerSize*100)} onChange={e=>set({markerSize:Number(e.target.value)/100})}/><output>{Math.round(appearance.markerSize*100)}%</output></div></label>
      <div className="appearance-switches">
        <label><input type="checkbox" checked={appearance.showClassname} onChange={e=>set({showClassname:e.target.checked})}/>{t('Show classname')}</label>
        <label><input type="checkbox" checked={appearance.showTargetname} onChange={e=>set({showTargetname:e.target.checked})}/>{t('Show targetname')}</label>
        <label><input type="checkbox" checked={appearance.alwaysShowSpawn} onChange={e=>set({alwaysShowSpawn:e.target.checked})}/>{t('Always show player spawn')}</label>
      </div>
      <h4>{t('Category colors')}</h4>
      <div className="appearance-colors">{ENTITY_COLOR_KINDS.map(kind=><label key={kind}><span>{t(labels[kind])}</span><input type="color" value={appearance.colors[kind]} onChange={e=>setColor(kind,e.target.value)} aria-label={`${t(labels[kind])} ${t('color')}`}/><code>{appearance.colors[kind]}</code></label>)}</div>
      <p className="modal-subtext">{t('Classnames and FGD keys remain in English. These colors are editor-only.')}</p>
    </div>
    <div className="modal-footer"><button onClick={reset}><RotateCcw size={15}/> {t('Reset appearance')}</button><button className="primary-action" onClick={onClose}><CheckCircle2 size={16}/>{t('Done')}</button></div>
  </div></div>;
}
