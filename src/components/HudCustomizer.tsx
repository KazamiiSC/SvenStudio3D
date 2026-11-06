import {LayoutTemplate,Check,RotateCcw,Eye,EyeOff,SlidersHorizontal} from 'lucide-react';
import {useHudLayout,HUD_IDS,type HudId} from '../hudLayout';
import {HUD_NAMES} from './HudWidget';
import {useT} from '../i18n';
import {useEditor} from '../store';

/** Always accessible even if the user hides or moves every other HUD group. */
export function HudCustomizer(){
  const t=useT();
  const editing=useHudLayout(s=>s.editing),setEditing=useHudLayout(s=>s.setEditing);
  const selected=useHudLayout(s=>s.selected),select=useHudLayout(s=>s.select);
  const item=useHudLayout(s=>s.items[selected]),items=useHudLayout(s=>s.items);
  const update=useHudLayout(s=>s.update),resetItem=useHudLayout(s=>s.resetItem);
  const globalOpacity=useHudLayout(s=>s.globalOpacity),setGlobalOpacity=useHudLayout(s=>s.setGlobalOpacity);
  const preset=useHudLayout(s=>s.preset),applyPreset=useHudLayout(s=>s.applyPreset);
  const modalTransform=useEditor(s=>s.modalTransform);
  const flyMode=useEditor(s=>s.flyMode);
  return <div className={`hud-editor-controls ${editing&&selected==='fps'?'hud-editor-avoid-fps':''}`} onPointerDown={e=>e.stopPropagation()}>
    <button type="button" className={`hud-editor-toggle ${editing?'active':''}`} disabled={!editing&&(!!modalTransform||flyMode)} onClick={()=>setEditing(!editing)}
      aria-label={t('Customize viewport HUD')} aria-pressed={editing} title={t('Customize viewport HUD')}>
      {editing?<Check size={17}/>:<LayoutTemplate size={17}/>} <span>{t(editing?'Done':'Edit HUD')}</span>
    </button>
    {editing&&<div className="hud-editor-panel" role="dialog" aria-label={t('Customize viewport HUD')}>
      <strong><SlidersHorizontal size={16}/>{t('Customize viewport HUD')}</strong>
      <p>{t('Drag the handles to move HUD groups. Drag the corner to resize. Changes are saved automatically.')}</p>
      <label>{t('HUD layout')}
        <select aria-label={t('HUD layout')} value={preset} onChange={e=>{if(e.target.value!=='custom')applyPreset(e.target.value as 'default'|'compact'|'minimal')}}>
          <option value="default">{t('Default HUD')}</option><option value="compact">{t('Compact HUD')}</option>
          <option value="minimal">{t('Minimal HUD')}</option><option value="custom">{t('Custom HUD')}</option>
        </select>
      </label>
      <label>{t('HUD element')}
        <select aria-label={t('HUD element')} value={selected} onChange={e=>select(e.target.value as HudId)}>
          {HUD_IDS.map(id=><option key={id} value={id}>{t(HUD_NAMES[id])}{items[id].visible?'':` · ${t('Hidden')}`}</option>)}
        </select>
      </label>
      {/* Coordinates work even when another HUD layer or a panel hides the drag handle. */}
      <label>X <output>{Math.round(item.x)}%</output>
        <input type="range" aria-label="HUD X" min="0" max="99" step="1" value={Math.round(item.x)} onChange={e=>update(selected,{x:Number(e.target.value)})}/>
      </label>
      <label>Y <output>{Math.round(item.y)}%</output>
        <input type="range" aria-label="HUD Y" min="0" max="99" step="1" value={Math.round(item.y)} onChange={e=>update(selected,{y:Number(e.target.value)})}/>
      </label>
      <button type="button" className="hud-panel-check" onClick={()=>update(selected,{visible:!item.visible})}>
        {item.visible?<Eye size={15}/>:<EyeOff size={15}/>}{t(item.visible?'Visible':'Hidden')}
      </button>
      <label>{t('Element size')} <output>{Math.round(item.scale*100)}%</output>
        <input type="range" min="45" max="180" step="5" value={Math.round(item.scale*100)} onChange={e=>update(selected,{scale:Number(e.target.value)/100})}/>
      </label>
      <label>{t('Element opacity')} <output>{Math.round(item.opacity*100)}%</output>
        <input type="range" min="15" max="100" step="5" value={Math.round(item.opacity*100)} onChange={e=>update(selected,{opacity:Number(e.target.value)/100})}/>
      </label>
      <label>{t('Overall HUD opacity')} <output>{Math.round(globalOpacity*100)}%</output>
        <input type="range" min="25" max="100" step="5" value={Math.round(globalOpacity*100)} onChange={e=>setGlobalOpacity(Number(e.target.value)/100)}/>
      </label>
      <div className="hud-editor-actions">
        <button type="button" onClick={()=>resetItem(selected)}><RotateCcw size={14}/>{t('Reset element')}</button>
        <button type="button" onClick={()=>{applyPreset('default');setGlobalOpacity(1)}}><RotateCcw size={14}/>{t('Reset HUD')}</button>
      </div>
      <button type="button" className="hud-editor-done" onClick={()=>setEditing(false)}><Check size={14}/>{t('Done')}</button>
    </div>}
  </div>;
}
