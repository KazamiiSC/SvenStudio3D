import {useState} from 'react';
import {Crosshair,ChevronDown,ChevronUp,Move3D,Minus,Plus,RotateCcw,X} from 'lucide-react';
import {useEditor} from '../store';
import {useT} from '../i18n';
import type {Vec3} from '../engine/types';
import type {UniversalPlacementMode} from '../engine/universalPlacement';

/** The dock never captures camera WASD. It only modifies positioning preferences;
 * map geometry is created exclusively by a confirmed viewport click. */
export function UniversalPlacementPanel(){
  const t=useT();
  const active=useEditor(s=>s.hasPendingPlacement());
  const settings=useEditor(s=>s.universalPlacement);
  const drawing=useEditor(s=>s.drawMode);
  const hover=useEditor(s=>s.universalPlacementHover);
  const selected=useEditor(s=>s.project.objects.find(o=>o.id===s.selected));
  const change=useEditor(s=>s.setUniversalPlacement);
  const cancel=useEditor(s=>s.cancelPendingPlacement);
  const reset=useEditor(s=>s.resetUniversalPlacement);
  const snap=useEditor(s=>s.snapping?s.snap:1);
  const [advanced,setAdvanced]=useState(false);
  if(!active)return null;
  const point=settings.lockPosition?settings.position:hover;
  const safeNumber=(raw:string,fallback:number)=>raw.trim()!==''&&Number.isFinite(Number(raw))?Number(raw):fallback;
  const switchMode=(mode:UniversalPlacementMode)=>change({mode,lockPosition:false,staged:false});
  const setAxis=(axis:0|1|2,value:string)=>{
    const xyz=[...(point||settings.position)] as Vec3;
    xyz[axis]=safeNumber(value,xyz[axis]);
    change({position:xyz,lockPosition:true});
  };
  const height=settings.lockPosition?settings.position[2]:settings.mode==='relative'?settings.offsetZ:settings.planeZ;
  const updateHeight=(value:number)=>{
    if(settings.lockPosition)change({position:[settings.position[0],settings.position[1],value]});
    else if(settings.mode==='relative')change({offsetZ:value});
    else change({planeZ:value});
  };
  return <section className={`universal-placement-panel ${advanced?'is-expanded':'is-compact'}`}
    aria-label={t('Universal 3D Placement')} onPointerDown={e=>e.stopPropagation()}
    onDoubleClick={e=>e.stopPropagation()} onContextMenu={e=>{e.preventDefault();e.stopPropagation()}}
    onClickCapture={e=>{const button=(e.target as HTMLElement).closest('button');if(button)button.blur();}}
    onKeyDown={e=>{if(e.key==='Enter'&&(e.target as HTMLElement).matches('input')){e.preventDefault();(e.target as HTMLElement).blur();}}}>
    <header className="universal-placement-header">
      <strong><Move3D size={17}/>{t('Universal 3D Placement')}</strong>
      <div className="universal-placement-header-actions">
        <button type="button" onClick={()=>setAdvanced(v=>!v)} aria-expanded={advanced} aria-label={advanced?t('Collapse placement controls'):t('Expand placement controls')}>
          {advanced?<ChevronUp size={18}/>:<ChevronDown size={18}/>}
        </button>
        <button type="button" className="placement-dismiss" onClick={cancel} title={t('Cancel placement')} aria-label={t('Cancel placement')}><X size={18}/></button>
      </div>
    </header>
    {!drawing&&<div className="universal-placement-three-modes" role="group" aria-label={t('Placement mode')}>
      {(['surface','grid','free'] as const).map(mode=><button key={mode} type="button"
        className={(settings.mode===mode||(mode==='surface'&&['relative','object'].includes(settings.mode)))?'active':''}
        aria-pressed={settings.mode===mode}
        onClick={()=>switchMode(mode)}>{mode==='surface'?t('Placement: Surface'):mode==='grid'?t('Placement: Plane'):t('Placement: Free 3D')}</button>)}
    </div>}
    {settings.mode==='free'&&!drawing?<div className="universal-placement-depth">
      <div className="universal-placement-row"><label htmlFor="universal-free-depth">{t('Distance from camera')}</label><b>{Math.round(settings.freeDepth)} u</b></div>
      <div className="universal-placement-steppers"><button type="button" onClick={()=>change({freeDepth:Math.max(32,settings.freeDepth-32)})}><Minus size={17}/></button>
        <input id="universal-free-depth" aria-label={t('Distance from camera')} type="range" min="32" max="8192" step="16" value={settings.freeDepth} onChange={e=>change({freeDepth:Number(e.target.value)})}/>
        <button type="button" onClick={()=>change({freeDepth:Math.min(8192,settings.freeDepth+32)})}><Plus size={17}/></button></div>
      <small>{t('Alt + wheel adjusts camera depth')}</small>
    </div>:<div className="universal-placement-quick">
      <label htmlFor="placement-height-control">{settings.mode==='relative'?t('Height offset'):t('Workplane Z')}</label>
      <button type="button" onClick={()=>updateHeight(height-snap)} aria-label={t('Lower placement')}><Minus size={16}/></button>
      <input id="placement-height-control" type="number" aria-label={t('Placement height')} step={snap} value={height} onChange={e=>updateHeight(safeNumber(e.target.value,height))}/>
      <button type="button" onClick={()=>updateHeight(height+snap)} aria-label={t('Raise placement')}><Plus size={16}/></button>
      <span>u</span>
    </div>}
    {!drawing&&<label className="universal-placement-twostep"><input type="checkbox" checked={settings.twoStep} onChange={e=>change({twoStep:e.target.checked,staged:false,lockPosition:false})}/>
      {t('Adjust before confirming')}</label>}
    {settings.staged&&<div className="universal-placement-staged" role="status">{t('Position fixed — adjust XYZ, then click again to confirm')}</div>}
    <div className="universal-placement-instructions"><span>{settings.twoStep?t('First click: position · Second click: create'):t('Left click to place')}</span>
      <span>{t('Right click or Esc to cancel')} · {t('RMB drag: look')}</span></div>
    {advanced&&<div className="universal-placement-body">
      {!drawing&&<>
        <div className="universal-placement-row"><strong>{t('Manual coordinate')}</strong><span>GoldSrc XYZ</span></div>
        <label className="universal-placement-checkbox"><input type="checkbox" checked={settings.lockPosition} onChange={e=>change({lockPosition:e.target.checked,position:point||settings.position,staged:false})}/>{t('Lock exact XYZ')}</label>
        <div className="universal-placement-coordinates">
          {(['X','Y','Z'] as const).map((axis,i)=><label key={axis}>{axis}
            <input aria-label={`${t('Manual coordinate')} ${axis}`} type="number" step={snap} value={settings.lockPosition?settings.position[i]:point?.[i]??''} placeholder="—"
              onChange={e=>setAxis(i as 0|1|2,e.target.value)}/></label>)}
        </div>
        <div className="universal-placement-extra-modes">
          <button type="button" className={settings.mode==='relative'?'active':''} onClick={()=>switchMode('relative')}>{t('Placement: Relative height')}</button>
          <button type="button" className={settings.mode==='object'?'active':''} onClick={()=>switchMode('object')}>{t('Placement: Object snap')}</button>
        </div>
        <div className="universal-placement-workplanes"><span>{t('Saved workplanes')}</span>
          <div className="universal-placement-workplane-row">
            {settings.workplanes.map((z,i)=><button type="button" key={`${z}-${i}`} className={settings.planeZ===z&&settings.mode==='grid'?'active':''}
              onClick={()=>change({mode:'grid',planeZ:z,lockPosition:false,staged:false})}>{z}u</button>)}
            <button type="button" disabled={settings.workplanes.length>=12||settings.workplanes.includes(settings.planeZ)}
              onClick={()=>change({workplanes:[...settings.workplanes,settings.planeZ].sort((a,b)=>a-b)})}>+ {t('Save workplane')}</button>
          </div>
        </div>
        {settings.mode==='object'&&<label className="universal-placement-radius">{t('Vertex snap radius (u)')}
          <input type="number" min={1} max={256} value={settings.objectSnapRadius} onChange={e=>change({objectSnapRadius:safeNumber(e.target.value,settings.objectSnapRadius)})}/></label>}
        <div className="universal-placement-actions">
          <button type="button" disabled={!selected} onClick={()=>{if(selected)change({position:[...selected.position],lockPosition:true})}}><Crosshair size={15}/>{t('Copy selected position')}</button>
          <button type="button" onClick={reset}><RotateCcw size={15}/>{t('Reset placement')}</button>
        </div>
      </>}
      {drawing&&<p>{t('Drawing uses its own XY/XZ/YZ plane. Workplane Z affects drawing in XY only.')}</p>}
      <p>{t('Placement preview stays visible while adjusting controls.')}</p>
    </div>}
  </section>;
}
