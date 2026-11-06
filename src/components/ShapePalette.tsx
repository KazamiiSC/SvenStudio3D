import {useEffect,useRef,useState} from 'react';
import {Shapes,Box,Square,ChevronDown,X,MousePointer2,PencilRuler,DoorOpen,AppWindow,Layers3,BookmarkPlus,Package,MousePointerClick} from 'lucide-react';
import {useEditor} from '../store';
import type {PlaceableShape,Vec3} from '../engine/types';
import {defaultArchitecture} from '../engine/architecture';
import {useT} from '../i18n';
import {useHudLayout} from '../hudLayout';

const BASIC:PlaceableShape[]=['box','wedge','cylinder','arch','vault','cone','pyramid','icosphere','stairs','pipe'];
const STRUCTURES:PlaceableShape[]=['wall','slab','beam','column','ramp','frame','room','roof','corner','platform','bridge','barrier','steps','doorframe','windowframe'];
const ICONS:Record<PlaceableShape,string>={box:'▣',wedge:'◭',cylinder:'⬡',arch:'⌒',vault:'◠',cone:'▲',pyramid:'◆',icosphere:'◉',stairs:'▥',pipe:'◎',wall:'▥',slab:'▬',beam:'━',column:'▮',ramp:'◢',frame:'▢',room:'▣',roof:'⌃',corner:'⌞',platform:'▤',bridge:'▰',barrier:'▥',steps:'▤',doorframe:'▢',windowframe:'▦'};

/** Unified viewport palette. Doors and windows REUSE the existing wall-cutting
 * tool; standalone presets are arrays of planar convex brushes. */
export function ShapePalette(){
  const t=useT();
  const [open,setOpen]=useState(false);
  const root=useRef<HTMLDivElement>(null);
  const [popup,setPopup]=useState({above:false,height:520});
  const hudEditing=useHudLayout(s=>s.editing);
  useEffect(()=>{
    const toggle=()=>{if(!useHudLayout.getState().editing)setOpen(v=>!v)};
    document.addEventListener('svenstudio:toggle-shapes',toggle);
    return()=>document.removeEventListener('svenstudio:toggle-shapes',toggle);
  },[]);
  useEffect(()=>{
    if(!open)return;
    const refresh=()=>{
      const anchor=root.current?.querySelector('.shape-palette-toggle')?.getBoundingClientRect();
      const viewport=root.current?.closest('.viewport-frame')?.getBoundingClientRect();
      if(!anchor||!viewport)return;
      const below=viewport.bottom-anchor.bottom-12;
      const above=anchor.top-viewport.top-12;
      const placeAbove=below<260&&above>below;
      setPopup(prev=>{const next={above:placeAbove,height:Math.max(100,Math.floor(placeAbove?above:below))};return prev.above===next.above&&prev.height===next.height?prev:next});
    };
    refresh();window.addEventListener('resize',refresh);
    const observer=new ResizeObserver(refresh);
    const frame=root.current?.closest('.viewport-frame');if(frame)observer.observe(frame);
    return()=>{window.removeEventListener('resize',refresh);observer.disconnect()};
  },[open]);
  const [category,setCategory]=useState<'basic'|'structures'|'prefabs'>('basic');
  const [dimensionsEdited,setDimensionsEdited]=useState(false);
  const [frameThickness,setFrameThickness]=useState(8);
  const [cutOnly,setCutOnly]=useState(false);
  const [doorLeaf,setDoorLeaf]=useState(false);
  const selected=useEditor(s=>s.placementShape),setShape=useEditor(s=>s.setPlacementShape);
  const size=useEditor(s=>s.shapeSize),setSize=useEditor(s=>s.setShapeSize);
  const prefabs=useEditor(s=>s.prefabs),selectedIds=useEditor(s=>s.selectedIds);
  const pendingPrefab=useEditor(s=>s.placementPrefabId),setPlacementPrefab=useEditor(s=>s.setPlacementPrefab);
  const saveSelection=useEditor(s=>s.saveSelectedPrefab);
  const drawing=useEditor(s=>s.drawMode),setDraw=useEditor(s=>s.setDrawMode);
  const drawHeight=useEditor(s=>s.drawHeight),setDrawHeight=useEditor(s=>s.setDrawHeight);
  const wallOpening=useEditor(s=>s.architecturePlacement);
  const startOpening=useEditor(s=>s.startArchitecturePlacement);
  const setDimension=(axis:number,raw:number)=>{
    if(!Number.isFinite(raw))return;
    const updated=[...size] as Vec3;
    updated[axis]=Math.max(1,Math.min(16384,raw));setSize(updated);setDimensionsEdited(true);
  };
  const placeShape=(kind:PlaceableShape)=>{
    if(selected===kind){setShape(null);setOpen(false);return;}
    // Dimensions may have been edited BEFORE choosing a primitive. The store
    // restores the per-shape preset; explicit current edits take precedence.
    const staged=[...size] as Vec3;
    setShape(kind);
    if(dimensionsEdited)setSize(staged);
    setDimensionsEdited(false);
    setOpen(false);
  };
  const saveReusable=()=>{
    if(!selectedIds.length)return;
    const name=window.prompt(t('Prefab name'),'Door / Button / Structure');
    if(!name?.trim())return;
    try{saveSelection(name.trim())}catch(error){window.alert(String(error))}
  };
  const placeReusable=(id:string)=>{
    try{setPlacementPrefab(pendingPrefab===id?null:id);setOpen(false)}catch(error){window.alert(String(error))}
  };

  const opening=(kind:'door'|'window')=>{
    if(wallOpening?.kind===kind){startOpening(null);return;}
    startOpening(kind,{...defaultArchitecture,width:size[0],height:size[2],depth:Math.min(size[1],8192),frame:frameThickness,cutOnly,doorLeaf});
    setOpen(false);
  };
  const draw=()=>{setDraw(!drawing);setOpen(false);};
  return <div ref={root} className={`shape-palette ${popup.above?'shape-palette-above':''} ${hudEditing?'shape-palette-hud-editing':''}`} style={{'--shape-popup-height':`${popup.height}px`} as React.CSSProperties} onPointerDown={e=>e.stopPropagation()} onContextMenu={e=>e.stopPropagation()}>
    <button type="button" className={`shape-palette-toggle ${open?'active':''}`} onClick={()=>setOpen(v=>!v)} aria-expanded={open} aria-label={t('Shape Studio')} title={t('Shape Studio')}><Shapes size={17}/>{t('Shapes')}<ChevronDown size={13}/></button>
    {open&&<section className="shape-palette-panel" aria-label={t('Shape Studio')}>
      <header><strong><Box size={16}/>{t('Shape Studio')}</strong><button type="button" onClick={()=>setOpen(false)} aria-label={t('Close')}><X size={15}/></button></header>
      <p>{t('Choose a shape and size it before placing it with the mouse.')}</p>
      <button type="button" className={`shape-draw-action ${drawing?'active':''}`} onClick={draw}><PencilRuler size={17}/>{t(drawing?'Stop drawing':'Draw a box')} <span>{t('Drag in the 3D viewport')}</span></button>
      <div className="shape-palette-measures">
        {(['Shape width','Shape depth','Shape height'] as const).map((label,i)=><label key={label}>{t(label)} <input aria-label={t(label)} type="number" min="1" max="16384" step="8" value={size[i]} onChange={e=>setDimension(i,e.target.valueAsNumber)}/></label>)}
      </div>
      <div className="shape-palette-tabs">
        <button type="button" className={category==='basic'?'active':''} onClick={()=>setCategory('basic')}>{t('Basic shapes')}</button>
        <button type="button" className={category==='structures'?'active':''} onClick={()=>setCategory('structures')}>{t('Architecture shapes')}</button>
        <button type="button" className={category==='prefabs'?'active':''} onClick={()=>setCategory('prefabs')}>{t('Prefabs')}</button>
      </div>
      {category!=='prefabs'&&<div className="shape-palette-grid" role="group" aria-label={t(category==='basic'?'Basic shapes':'Architecture shapes')}>
        {(category==='basic'?BASIC:STRUCTURES).map(kind=><button type="button" key={kind} aria-pressed={selected===kind} className={selected===kind?'active':''} onClick={()=>placeShape(kind)}><span>{ICONS[kind]}</span>{t(kind[0].toUpperCase()+kind.slice(1))}</button>)}
      </div>}
      {category==='prefabs'&&<div className="shape-prefab-section" data-prefab-quick-library>
        <div className="shape-prefab-heading"><strong><Package size={15}/>{t('Reusable constructions')}</strong><span>{prefabs.length}/64</span></div>
        <p>{t('Select a brush group, save it and place copies with one click.')}</p>
        <button type="button" className="shape-prefab-save" disabled={!selectedIds.length||prefabs.length>=64} onClick={saveReusable}><BookmarkPlus size={15}/>{t('Save selected construction')} ({selectedIds.length})</button>
        {prefabs.length>0&&<div className="shape-prefab-list" role="list" aria-label={t('Reusable constructions')}>
          {prefabs.map(prefab=><button key={prefab.id} type="button" role="listitem"
            className={pendingPrefab===prefab.id?'active':''} onClick={()=>placeReusable(prefab.id)}
            title={`${t('Place prefab with mouse')} · ${prefab.objects.length} ${t('objects')}`}>
            <MousePointerClick size={15}/><span>{prefab.name}<small>{prefab.objects.length} {t('objects')}</small></span>
          </button>)}
        </div>}
        {!prefabs.length&&<small className="shape-prefab-empty">{t('No prefabs saved yet.')}</small>}
      </div>}
      {category==='structures'&&<div className="shape-architecture-cut">
        <strong><Layers3 size={15}/>{t('Wall openings')}</strong>
        <p>{t('Door and window openings cut a selected worldspawn box wall. They do not add a second wall.')}</p>
        <div className="shape-opening-actions"><button type="button" className={wallOpening?.kind==='door'?'active':''} onClick={()=>opening('door')}><DoorOpen size={16}/>{t('Door opening')}</button><button type="button" className={wallOpening?.kind==='window'?'active':''} onClick={()=>opening('window')}><AppWindow size={16}/>{t('Window opening')}</button></div>
        <label className="shape-frame-size">{t('Frame thickness')} <input type="number" min="1" max="128" value={frameThickness} onChange={e=>setFrameThickness(Math.min(128,Math.max(1,e.target.valueAsNumber||8)))}/></label>
        <label className="shape-inline-check"><input type="checkbox" checked={cutOnly} onChange={e=>setCutOnly(e.target.checked)}/>{t('Opening only (no frame)')}</label>
        <label className="shape-inline-check"><input type="checkbox" checked={doorLeaf} onChange={e=>setDoorLeaf(e.target.checked)}/>{t('Add separate door leaf brush')}</label>
      </div>}
      {drawing&&<label className="shape-frame-size">{t('Drawing height')} <input type="number" min="1" max="16384" step="8" value={drawHeight} onChange={e=>setDrawHeight(e.target.valueAsNumber||128)}/></label>}
      <div className="shape-palette-footer"><MousePointer2 size={14}/>{drawing?t('Left drag to draw; right click or Esc to cancel.'):wallOpening?t('Select a wall and click where the opening should go.'):selected?t('Click a surface to place')+' · '+t('Right click or Esc to cancel drawing.'):pendingPrefab?t('Place prefab with mouse')+' · Esc':t('Choose a shape and size it before placing it with the mouse.')}</div>
      {(selected||drawing||wallOpening||pendingPrefab)&&<button className="shape-palette-stop" onClick={()=>{if(selected)setShape(null);if(drawing)setDraw(false);if(wallOpening)startOpening(null);if(pendingPrefab)setPlacementPrefab(null)}} type="button"><Square size={13}/>{t('Cancel')}</button>}
    </section>}
  </div>;
}
