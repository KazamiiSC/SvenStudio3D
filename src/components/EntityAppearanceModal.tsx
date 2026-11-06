import {useEffect} from 'react';
import {Palette,RotateCcw,CheckCircle2} from 'lucide-react';
import {useEditor} from '../store';
import {ENTITY_COLOR_KINDS,ENTITY_MARKER_SHAPES} from '../engine/entityAppearance';
import {useT} from '../i18n';

const labels:Record<string,string>={spawn:'Player Spawn',light:'Point Light',npc:'NPCs',trigger:'Triggers',item:'Items',logic:'Logic & effects',other:'Other'};
export function EntityAppearanceModal({onClose}:{onClose:()=>void}){
  const t=useT();
  const appearance=useEditor(s=>s.entityAppearance);
  const set=useEditor(s=>s.setEntityAppearance);
  const setColor=useEditor(s=>s.setEntityColor);
  const reset=useEditor(s=>s.resetEntityAppearance);
  const mapLabels=useEditor(s=>s.mapLabelSettings);
  const updateMapLabels=useEditor(s=>s.setMapLabelSettings);
  const resetMapLabels=useEditor(s=>s.resetMapLabelSettings);
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
      <label className="appearance-slider">{t('Marker size')}<div><input type="range" min="25" max="250" step="5" value={Math.round(appearance.markerSize*100)} onChange={e=>set({markerSize:Number(e.target.value)/100})}/><output>{Math.round(appearance.markerSize*100)}%</output></div></label>
      <label className="appearance-marker-shape">{t('Marker mode')}
        <select value={appearance.markerMode} onChange={e=>set({markerMode:e.target.value as typeof appearance.markerMode})}>
          <option value="automatic">{t('Automatic by entity')}</option>
          <option value="uniform">{t('Same shape for all')}</option>
        </select>
      </label>
      <label className="appearance-marker-shape">{t('Global marker shape')}
        <select value={appearance.markerShape} onChange={e=>set({markerShape:e.target.value as typeof appearance.markerShape})}>
          {ENTITY_MARKER_SHAPES.map(shape=><option key={shape} value={shape}>{t(({box:'Box',bubble:'Bubble / sphere',capsule:'Capsule',diamond:'Diamond',cone:'Cone'} as const)[shape])}</option>)}
        </select>
      </label>
      <label className="appearance-marker-shape">{t('Entities behind brushes')}
        <select value={appearance.markerOcclusion} onChange={e=>set({markerOcclusion:e.target.value as typeof appearance.markerOcclusion})}>
          <option value="xray">{t('Visible and selectable through brushes')}</option>
          <option value="normal">{t('Normal depth (hidden by brushes)')}</option>
        </select>
      </label>
      <p className="appearance-marker-note">{t('X-ray prioritizes entity markers on click, without affecting brushes or the compiled MAP. In normal mode, Alt + click can pick a hidden entity.')}</p>
      <p className="appearance-marker-note">{t('Markers are editor-only; shapes and sizes do not affect your MAP.')}</p>
      <div className="appearance-switches">
        <label><input type="checkbox" checked={appearance.showClassname} onChange={e=>set({showClassname:e.target.checked})}/>{t('Show classname')}</label>
        <label><input type="checkbox" checked={appearance.showTargetname} onChange={e=>set({showTargetname:e.target.checked})}/>{t('Show targetname')}</label>
        <label><input type="checkbox" checked={appearance.alwaysShowSpawn} onChange={e=>set({alwaysShowSpawn:e.target.checked})}/>{t('Always show player spawn')}</label>
      </div>
      <h4>{t('Editor MAP labels')}</h4>
      <p className="modal-subtext">{t('Optimized mode renders only on-screen labels in one layer. Map entities and selection are never removed.')}</p>
      <div className="map-label-mode"><label>{t('Label renderer')}<select value={mapLabels.mode} onChange={e=>updateMapLabels({mode:e.target.value as typeof mapLabels.mode})}>
        <option value="optimized">{t('Optimized (recommended)')}</option><option value="classic">{t('Classic (legacy performance)')}</option>
      </select></label></div>
      {mapLabels.mode==='optimized'&&<>
        <label className="appearance-slider">{t('Maximum labels')}<div><input type="range" min="8" max="240" step="4" value={mapLabels.maxLabels} onChange={e=>updateMapLabels({maxLabels:Number(e.target.value)})}/><output>{mapLabels.maxLabels}</output></div></label>
        <label className="appearance-slider">{t('Label distance')}<div><input type="range" min="200" max="16000" step="200" value={mapLabels.distance} onChange={e=>updateMapLabels({distance:Number(e.target.value)})}/><output>{mapLabels.distance} u</output></div></label>
      <div className="appearance-switches">
          <label><input type="checkbox" checked={mapLabels.avoidOverlap} onChange={e=>updateMapLabels({avoidOverlap:e.target.checked})}/>{t('Avoid overlapping labels')}</label>
          <label><input type="checkbox" checked={mapLabels.lightweight} onChange={e=>updateMapLabels({lightweight:e.target.checked})}/>{t('Lightweight labels (faster)')}</label>
        </div>
        <p className="modal-subtext">{t('Selected labels stay visible beyond limits while in front of the camera. High limits can reduce FPS.')}</p>
      </>}
      <div className="appearance-switches"><label><input type="checkbox" checked={mapLabels.diagnostics} onChange={e=>updateMapLabels({diagnostics:e.target.checked})}/>{t('Show FPS counter')}</label></div>
      <button type="button" className="map-label-reset" onClick={resetMapLabels}><RotateCcw size={14}/>{t('Reset label optimization')}</button>
      <label className="appearance-marker-shape">{t('Marker colors')}
        <select value={appearance.colorMode} onChange={e=>set({colorMode:e.target.value as typeof appearance.colorMode})}>
          <option value="category">{t('Different colors by category')}</option>
          <option value="uniform">{t('One color for all')}</option>
        </select>
      </label>
      {appearance.colorMode==='uniform'&&<label className="appearance-marker-shape">{t('Uniform marker color')} <input type="color" value={appearance.uniformColor} onChange={e=>set({uniformColor:e.target.value})}/></label>}
      {appearance.colorMode==='category'&&<h4>{t('Category colors')}</h4>}
      {appearance.colorMode==='category'&&<div className="appearance-colors">{ENTITY_COLOR_KINDS.map(kind=><label key={kind}><span>{t(labels[kind])}</span><input type="color" value={appearance.colors[kind]} onChange={e=>setColor(kind,e.target.value)} aria-label={`${t(labels[kind])} ${t('color')}`}/><code>{appearance.colors[kind]}</code></label>)}</div>}
      <p className="modal-subtext">{t('Classnames and FGD keys remain in English. These colors are editor-only.')}</p>
    </div>
    <div className="modal-footer"><button onClick={reset}><RotateCcw size={15}/> {t('Reset appearance')}</button><button className="primary-action" onClick={onClose}><CheckCircle2 size={16}/>{t('Done')}</button></div>
  </div></div>;
}
