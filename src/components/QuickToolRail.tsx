import {useState,type ReactNode,type CSSProperties} from 'react';
import {Box,MousePointer2,Move3D,Rotate3D,Scaling,Paintbrush,Layers,FolderTree,Settings2,Grid3x3,Eye,Headphones,Skull,GitBranch,Shapes,ChevronLeft,ChevronRight,Route,PanelLeft,SlidersHorizontal,Terminal,Wrench,Ruler} from 'lucide-react';
import {useEditor} from '../store';
import {useStudioLayout} from '../layout';
import {useT} from '../i18n';
import type {PlaceableShape} from '../engine/types';

/** The floating toolbar must expose *all* geometry editing modes.
 * In 0.7.0 these controls were only present in the hidden classic ribbon. */
export function QuickToolRail(){
  const t=useT();const layout=useStudioLayout();const editor=useEditor();
  const [menu,setMenu]=useState<'shapes'|'assets'|'scene'|'modeling'|'size'|null>(null);
  const [railScale,setRailScale]=useState(()=>{
    try {const saved=Number(localStorage.getItem('svenstudio:float-rail-scale'));return Number.isFinite(saved)&&saved>=65&&saved<=125?saved:100;}catch{return 100;}
  });
  const setRailSize=(value:number)=>{
    const safe=Math.max(65,Math.min(125,Math.round(value/5)*5));
    setRailScale(safe);
    try{localStorage.setItem('svenstudio:float-rail-scale',String(safe));}catch{/* private browser */}
  };
  const [distance,setDistance]=useState(16),[width,setWidth]=useState(8),[operationMessage,setOperationMessage]=useState('');
  const selectedBrush=editor.project.objects.find(o=>o.id===editor.selected&&o.kind==='brush');
  const twoBrushes=editor.selectedIds.length===2&&editor.selectedIds.every(id=>{
    const obj=editor.project.objects.find(o=>o.id===id);
    return obj?.kind==='brush'&&!obj.locked;
  });
  const faceReady=!!selectedBrush&&!selectedBrush.locked&&editor.geometryMode==='face'&&editor.selectedFace!==null;
  const edgeReady=!!selectedBrush&&!selectedBrush.locked&&editor.geometryMode==='edge'&&editor.editIndices.length===2;
  const activate=(resource:'objects'|'textures'|'models'|'sounds'|'entities'|'npcs'|'layers')=>{
    editor.setResourceView(resource);if(!layout.visible.assets)layout.setVisible('assets',true);setMenu(null);
  };
  const launch=(type:'sound'|'npc'|'gameplay'|'doctor')=>{document.dispatchEvent(new CustomEvent('svenstudio:open-studio',{detail:type}));setMenu(null)};
  const apply=(operation:string,callback:()=>void)=>{
    try{callback();setOperationMessage(`${t(operation[0].toUpperCase()+operation.slice(1))}: ${t('Operation completed')}`);editor.appendLogs([`Advanced Building Studio: ${operation} completed.`]);}
    catch(error){const message=String(error);setOperationMessage(message);editor.appendLogs([`Advanced Building Studio: ${message}`]);}
  };
  const tool=(name:string,icon:ReactNode,callback:()=>void,active=false)=>
    <button type="button" title={t(name)} aria-label={t(name)} className={active?'quick-tool active':'quick-tool'} onClick={callback}>{icon}<span>{t(name)}</span></button>;
  return <div className={`quick-rail-shell quick-rail-${layout.floatRailSide||'left'}`} style={{'--rail-scale':railScale/100} as CSSProperties} onPointerDown={e=>e.stopPropagation()}>
    <div className="quick-rail">
      <button type="button" className="quick-size-trigger" title={t('Adjust floating toolbar size')} aria-label={t('Adjust floating toolbar size')} aria-expanded={menu==='size'} onClick={()=>setMenu(menu==='size'?null:'size')}><SlidersHorizontal size={14}/></button>
      {tool('Select',<MousePointer2 size={19}/>,()=>editor.setMode('select'),editor.mode==='select')}
      {tool('Move',<Move3D size={19}/>,()=>editor.toggleModalTransform('translate'),!!editor.modalTransform&&editor.modalTransform.mode==='translate')}
      {tool('Rotate',<Rotate3D size={19}/>,()=>editor.toggleModalTransform('rotate'),!!editor.modalTransform&&editor.modalTransform.mode==='rotate')}
      {tool('Scale',<Scaling size={19}/>,()=>editor.toggleModalTransform('scale'),!!editor.modalTransform&&editor.modalTransform.mode==='scale')}
      <div className="quick-divider"/>
      {tool('Model / CSG',<Wrench size={19}/>,()=>{setOperationMessage('');setMenu(menu==='modeling'?null:'modeling')},menu==='modeling'||editor.geometryMode!=='object')}
      {tool('Shapes',<Shapes size={19}/>,()=>setMenu(menu==='shapes'?null:'shapes'),menu==='shapes')}
      {tool('Assets',<Layers size={19}/>,()=>setMenu(menu==='assets'?null:'assets'),menu==='assets')}
      {tool('Measure',<Ruler size={19}/>,()=>editor.toggleMeasure(),editor.measureMode)}
      {tool('Map Doctor',<Wrench size={19}/>,()=>{launch('doctor')})}
      {tool('AI Routes',<Route size={19}/>,()=>{layout.setVisible('explorer',true);setMenu(null)},false)}
      <div className="quick-divider"/>
      {tool('Grid',<Grid3x3 size={19}/>,()=>editor.setFlag('showGrid',!editor.showGrid),editor.showGrid)}
      {tool('Labels',<Eye size={19}/>,()=>editor.setFlag('showEntityNames',!editor.showEntityNames),editor.showEntityNames)}
      {tool('Panels',<FolderTree size={19}/>,()=>setMenu(menu==='scene'?null:'scene'),menu==='scene')}
      {tool('Switch side',layout.floatRailSide==='right'?<ChevronLeft size={18}/>:<ChevronRight size={18}/>,()=>layout.setFloatRailSide(layout.floatRailSide==='right'?'left':'right'))}
    </div>
    {menu&&<div className="quick-flyout" role="group" aria-label={t(menu==='size'?'Floating toolbar size':menu==='modeling'?'Advanced Building Studio':menu==='shapes'?'Shapes':menu==='assets'?'Asset Library':'Panels')}>
      <div className="quick-flyout-title"><strong>{t(menu==='size'?'Floating toolbar size':(menu==='modeling'?'Advanced Building Studio':(menu==='shapes'?'Shapes':menu==='assets'?'Asset Library':'Panels')))}</strong><button type="button" aria-label={t('Close panel')} onClick={()=>setMenu(null)}>×</button></div>
      {menu==='size'&&<div className="quick-rail-size-panel">
        <label htmlFor="floating-toolbar-size">{t('Toolbar scale')} <strong>{railScale}%</strong></label>
        <input id="floating-toolbar-size" type="range" min="65" max="125" step="5" value={railScale} onChange={e=>setRailSize(Number(e.target.value))}/>
        <div className="quick-rail-size-actions"><button type="button" onClick={()=>setRailSize(65)}>65%</button><button type="button" onClick={()=>setRailSize(100)}>{t('Reset size')}</button><button type="button" onClick={()=>setRailSize(125)}>125%</button></div>
        <p>{t('The size is saved automatically in this browser.')}</p>
      </div>}
      {menu==='modeling'&&<div className="quick-modeling-panel">
        <div className="quick-modeling-caption">{t('SVENGINE · Brush editing modes')}</div>
        <div className="quick-flyout-grid quick-modeling-modes">{(['object','vertex','edge','face'] as const).map(mode=><button type="button" key={mode} className={editor.geometryMode===mode?'active':''} aria-pressed={editor.geometryMode===mode} onClick={()=>{editor.setGeometryMode(mode);setOperationMessage('')}}>{mode==='face'?'▱':mode==='edge'?'╱':mode==='vertex'?'•':'▣'} {t(mode[0].toUpperCase()+mode.slice(1))}</button>)}</div>
        <div className="quick-modeling-caption">{t('CSG · select 2 overlapping brushes (first = target)')}</div>
        <div className="quick-flyout-grid">{(['union','subtract','intersect'] as const).map(operation=><button type="button" key={operation} disabled={!twoBrushes} title={t('Select two unlocked brushes with Ctrl/Shift + click')} onClick={()=>apply(operation,()=>editor.booleanSelected(operation))}>{t(operation[0].toUpperCase()+operation.slice(1))}</button>)}</div>
        <div className="quick-modeling-caption">{t('Face / Edge tools · select an unlocked brush and a face or edge')}</div>
        <label className="quick-modeling-input">{t('Extrude distance')} <input aria-label={t('Extrude distance')} type="number" min="0.01" value={distance} onChange={e=>setDistance(Number(e.target.value))}/></label>
        <button type="button" disabled={!faceReady||!(distance>0)} title={t('Face mode: select a face first')} onClick={()=>apply('Extrude',()=>editor.extrudeSelected(distance))}>{t('Extrude face')}</button>
        <label className="quick-modeling-input">{t('Bevel / Inset width')} <input aria-label={t('Bevel width')} type="number" min="0.01" value={width} onChange={e=>setWidth(Number(e.target.value))}/></label>
        <div className="quick-flyout-grid"><button type="button" disabled={!edgeReady||!(width>0)} title={t('Edge mode: select an edge first')} onClick={()=>apply('Bevel',()=>editor.bevelSelected(width))}>{t('Bevel edge')}</button><button type="button" disabled={!faceReady||!(width>0)} title={t('Face mode: select a face first')} onClick={()=>apply('Inset',()=>editor.insetSelected(width))}>{t('Inset (taper)')}</button></div>
        <div className="quick-modeling-caption">{t('UV mouse: Alt+drag moves · Alt+Shift rotates · Alt+Ctrl scales. Undo is supported.')}</div>
        <button type="button" disabled={!editor.selectedIds.length} onClick={()=>apply('Snap selection to grid',editor.snapSelectionToGrid)}>{t('Snap selection to grid')}</button>
        <button type="button" onClick={()=>{layout.setVisible('properties',true);setMenu(null)}}>{t('Open Properties panel')}</button>
        {operationMessage&&<div role="status" className="quick-modeling-status">{operationMessage}</div>}
      </div>}
      {menu==='shapes'&&<div className="quick-flyout-grid">{(['box','wedge','cylinder','arch','vault','cone','pyramid','icosphere','stairs','pipe'] as PlaceableShape[]).map(shape=>
        <button key={shape} className={editor.placementShape===shape?'active':''} onClick={()=>{editor.setPlacementShape(editor.placementShape===shape?null:shape);setMenu(null)}}><Box size={17}/>{t(shape[0].toUpperCase()+shape.slice(1))}</button>)}</div>}
      {menu==='assets'&&<div className="quick-flyout-list">{([['objects','Shapes',Box],['entities','Entities',Settings2],['textures','Texture Browser',Paintbrush],['models','Model Browser',Layers],['npcs','NPC Browser',Skull],['sounds','Sound Browser',Headphones],['layers','Layers',Layers]] as const).map(([id,title,Icon])=><button key={id} onClick={()=>activate(id)}><Icon size={16}/>{t(title)}</button>)}
        <div className="quick-divider"/><button onClick={()=>launch('npc')}><Skull size={16}/>{t('NPC & AI Studio')}</button><button onClick={()=>launch('gameplay')}><GitBranch size={16}/>{t('Gameplay Studio')}</button><button onClick={()=>launch('sound')}><Headphones size={16}/>{t('Sound & Atmosphere Studio')}</button></div>}
      {menu==='scene'&&<div className="quick-flyout-list">{([['explorer','Explorer',FolderTree],['properties','Properties',SlidersHorizontal],['assets','Asset Library',PanelLeft],['console','Output',Terminal]] as const).map(([id,title,Icon])=><button key={id} onClick={()=>{layout.setVisible(id,!layout.visible[id]);setMenu(null)}}><Icon size={16}/>{t(title)} <span>{layout.visible[id]?'✓':'+'}</span></button>)}</div>}
    </div>}
  </div>;
}
