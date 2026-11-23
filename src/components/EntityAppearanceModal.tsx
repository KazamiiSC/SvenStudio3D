/** Entity visuals, as a section of the Editor Preferences window (v2.4).
 * Same settings as before, regrouped: markers, colours, labels, distance and limits.
 * The FPS counter moved to "3D viewport & performance" (it is not an entity setting). */
import {RotateCcw} from 'lucide-react';
import {useEditor} from '../store';
import {ENTITY_COLOR_KINDS,ENTITY_MARKER_SHAPES} from '../engine/entityAppearance';
import {useT} from '../i18n';

const labels:Record<string,string>={spawn:'Player Spawn',light:'Point Light',npc:'NPCs',trigger:'Triggers',item:'Items',logic:'Logic & effects',other:'Other'};
export function EntityAppearanceSettings(){
  const t=useT();
  const appearance=useEditor(s=>s.entityAppearance);
  const set=useEditor(s=>s.setEntityAppearance);
  const setColor=useEditor(s=>s.setEntityColor);
  const reset=useEditor(s=>s.resetEntityAppearance);
  const mapLabels=useEditor(s=>s.mapLabelSettings);
  const updateMapLabels=useEditor(s=>s.setMapLabelSettings);
  const resetMapLabels=useEditor(s=>s.resetMapLabelSettings);
  return <>
    <section className="pref-card">
      <header><strong>{t('Markers')}</strong><small>{t('Markers are editor-only; shapes and sizes do not affect your MAP.')}</small></header>
      <label className="pref-slider"><span>{t('Marker size')}</span><input type="range" min="25" max="250" step="5" value={Math.round(appearance.markerSize*100)} onChange={e=>set({markerSize:Number(e.target.value)/100})}/><output>{Math.round(appearance.markerSize*100)}%</output></label>
      <label className="pref-row"><span><b>{t('Marker mode')}</b></span>
        <select value={appearance.markerMode} onChange={e=>set({markerMode:e.target.value as typeof appearance.markerMode})}>
          <option value="automatic">{t('Automatic by entity')}</option>
          <option value="uniform">{t('Same shape for all')}</option>
        </select>
      </label>
      {appearance.markerMode==='uniform'&&<label className="pref-row"><span><b>{t('Global marker shape')}</b></span>
        <select value={appearance.markerShape} onChange={e=>set({markerShape:e.target.value as typeof appearance.markerShape})}>
          {ENTITY_MARKER_SHAPES.map(shape=><option key={shape} value={shape}>{t(({box:'Box',bubble:'Bubble / sphere',capsule:'Capsule',diamond:'Diamond',cone:'Cone'} as const)[shape])}</option>)}
        </select>
      </label>}
      <label className="pref-row"><span><b>{t('Entities behind brushes')}</b><small>{t('X-ray prioritizes entity markers on click, without affecting brushes or the compiled MAP. In normal mode, Alt + click can pick a hidden entity.')}</small></span>
        <select value={appearance.markerOcclusion} onChange={e=>set({markerOcclusion:e.target.value as typeof appearance.markerOcclusion})}>
          <option value="xray">{t('Visible and selectable through brushes')}</option>
          <option value="normal">{t('Normal depth (hidden by brushes)')}</option>
        </select>
      </label>
    </section>
    <section className="pref-card">
      <header><strong>{t('Marker colors')}</strong><small>{t('Classnames and FGD keys remain in English. These colors are editor-only.')}</small></header>
      <div className="pref-segmented"><button className={appearance.colorMode==='category'?'chosen':''} onClick={()=>set({colorMode:'category'})}>{t('Different colors by category')}</button><button className={appearance.colorMode==='uniform'?'chosen':''} onClick={()=>set({colorMode:'uniform'})}>{t('One color for all')}</button></div>
      {appearance.colorMode==='uniform'&&<label className="pref-row"><span><b>{t('Uniform marker color')}</b></span><input type="color" value={appearance.uniformColor} onChange={e=>set({uniformColor:e.target.value})}/></label>}
      {appearance.colorMode==='category'&&<div className="appearance-colors pref-color-grid">{ENTITY_COLOR_KINDS.map(kind=><label key={kind}><input type="color" value={appearance.colors[kind]} onChange={e=>setColor(kind,e.target.value)} aria-label={`${t(labels[kind])} ${t('color')}`}/><span>{t(labels[kind])}</span><code>{appearance.colors[kind]}</code></label>)}</div>}
    </section>
    <section className="pref-card">
      <header><strong>{t('Editor MAP labels')}</strong><small>{t('Change entity markers and labels without affecting the compiled map.')}</small></header>
      <div className="pref-chips">
        <label><input type="checkbox" checked={appearance.showClassname} onChange={e=>set({showClassname:e.target.checked})}/>{t('Show classname')}</label>
        <label><input type="checkbox" checked={appearance.showTargetname} onChange={e=>set({showTargetname:e.target.checked})}/>{t('Show targetname')}</label>
        <label><input type="checkbox" checked={appearance.alwaysShowSpawn} onChange={e=>set({alwaysShowSpawn:e.target.checked})}/>{t('Always show player spawn')}</label>
      </div>
      <label className="pref-slider"><span>{t('Label size')}</span><input type="range" min="11" max="30" step="1" value={appearance.labelSize} onChange={e=>set({labelSize:Number(e.target.value)})}/><output>{appearance.labelSize}px</output></label>
      <label className="pref-slider"><span>{t('Label opacity')}</span><input type="range" min="35" max="100" step="5" value={Math.round(appearance.opacity*100)} onChange={e=>set({opacity:Number(e.target.value)/100})}/><output>{Math.round(appearance.opacity*100)}%</output></label>
      <label className="pref-row"><span><b>{t('Label renderer')}</b><small>{t('Optimized mode renders only on-screen labels in one layer. Map entities and selection are never removed.')}</small></span><select value={mapLabels.mode} onChange={e=>updateMapLabels({mode:e.target.value as typeof mapLabels.mode})}>
        <option value="optimized">{t('Optimized (recommended)')}</option><option value="classic">{t('Classic (legacy performance)')}</option>
      </select></label>
      {mapLabels.mode==='optimized'&&<>
        <label className="pref-slider"><span>{t('Maximum labels')}</span><input type="range" min="8" max="240" step="4" value={mapLabels.maxLabels} onChange={e=>updateMapLabels({maxLabels:Number(e.target.value)})}/><output>{mapLabels.maxLabels}</output></label>
        <label className="pref-slider"><span>{t('Label distance')}</span><input type="range" min="200" max="16000" step="200" value={mapLabels.distance} onChange={e=>updateMapLabels({distance:Number(e.target.value)})}/><output>{mapLabels.distance} u</output></label>
        <div className="pref-chips">
          <label><input type="checkbox" checked={mapLabels.avoidOverlap} onChange={e=>updateMapLabels({avoidOverlap:e.target.checked})}/>{t('Avoid overlapping labels')}</label>
          <label><input type="checkbox" checked={mapLabels.lightweight} onChange={e=>updateMapLabels({lightweight:e.target.checked})}/>{t('Lightweight labels (faster)')}</label>
        </div>
      </>}
    </section>
    <section className="pref-card">
      <header><strong>{t('Entity markers in the MAP editor')}</strong><small>{t('Far entities stop drawing their marker to keep FPS high. Selected entities always stay visible; nothing is removed from the map.')}</small></header>
      <label className="pref-slider"><span>{t('Marker distance')}</span><input type="range" min="0" max="16000" step="400" value={mapLabels.markerDistance} onChange={e=>updateMapLabels({markerDistance:Number(e.target.value)})}/><output>{mapLabels.markerDistance?`${mapLabels.markerDistance} u`:t('No limit')}</output></label>
      <label className="pref-slider"><span>{t('Maximum markers')}</span><input type="range" min="50" max="5000" step="50" value={mapLabels.maxMarkers} onChange={e=>updateMapLabels({maxMarkers:Number(e.target.value)})}/><output>{mapLabels.maxMarkers>=5000?t('No limit'):mapLabels.maxMarkers}</output></label>
    </section>
    <div className="pref-actions"><button type="button" className="map-label-reset" onClick={resetMapLabels}><RotateCcw size={14}/>{t('Reset label optimization')}</button><button onClick={reset}><RotateCcw size={15}/> {t('Reset appearance')}</button></div>
  </>;
}
