import {useEffect,useState,type ReactNode,type PointerEvent as ReactPointerEvent,type DragEvent} from 'react';
import {GripVertical,ArrowDownToLine,PanelLeft,PanelRight,PanelTop,PanelBottom,RotateCcw,SlidersHorizontal,Layers,Blocks,FolderTree,Terminal,LayoutTemplate,Eye,EyeOff,Move} from 'lucide-react';
import {useStudioLayout,type DockPanelId,type DockSide} from '../layout';
import {useT} from '../i18n';
import {AssetPanel,Explorer,Properties} from './Panels';
import {QuickToolRail} from './QuickToolRail';

type Dragged={type:'panel',id:DockPanelId}|{type:'toolbar'};
const sides:DockSide[]=['left','right','top','bottom'];
const sideIcons={left:PanelLeft,right:PanelRight,top:PanelTop,bottom:PanelBottom};
const panelIcons={assets:Blocks,explorer:FolderTree,properties:SlidersHorizontal,console:Terminal};
const panelNames={assets:'Asset Library',explorer:'Explorer',properties:'Properties',console:'Output'} as const;

function AttachSelect({value,onChange,label}:{value:DockSide,onChange:(side:DockSide)=>void,label:string}){
  const t=useT();
  return <select aria-label={`${t('Dock')} ${t(label)}`} className="pane-side-select" title={t('Move panel to another side')} value={value} onChange={e=>onChange(e.target.value as DockSide)} onPointerDown={e=>e.stopPropagation()}>
    {sides.map(s=><option value={s} key={s}>{t(s[0].toUpperCase()+s.slice(1))}</option>)}
  </select>;
}
function DragHandle({children,onStart,onEnd}:{children:ReactNode,onStart:(event:DragEvent)=>void,onEnd:()=>void}){
  return <span className="drag-grip" draggable onDragStart={onStart} onDragEnd={onEnd} title="Drag to dock"><GripVertical size={15}/>{children}</span>;
}
function DockPane({id,side,onStart,onEnd,children}:{id:DockPanelId,side:DockSide,onStart:(e:DragEvent,id:DockPanelId)=>void,onEnd:()=>void,children:ReactNode}){
  const t=useT();
  const setVisible=useStudioLayout(s=>s.setVisible),move=useStudioLayout(s=>s.movePanel);
  const Icon=panelIcons[id];
  return <section className="dock-pane" data-pane={id}>
    <div className="dock-pane-titlebar"><DragHandle onStart={e=>onStart(e,id)} onEnd={onEnd}><Icon size={15}/><strong>{t(panelNames[id])}</strong></DragHandle>
      <div className="dock-pane-actions"><AttachSelect value={side} onChange={dest=>move(id,dest)} label={panelNames[id]}/><button title={t('Hide panel')} onClick={()=>setVisible(id,false)}><EyeOff size={14}/></button></div>
    </div>
    <div className="dock-pane-body">{children}</div>
  </section>;
}
function useSizeDrag(){
  const setSideSize=useStudioLayout(s=>s.setSideSize);
  return (event:ReactPointerEvent<HTMLDivElement>,side:DockSide)=>{
    event.preventDefault();
    const startCoord=side==='left'||side==='right'?event.clientX:event.clientY;
    const store=useStudioLayout.getState();
    const size0=side==='left'||side==='right'?store.widths[side]:store.heights[side];
    const dir=side==='left'||side==='top'?1:-1;
    const oldCursor=document.body.style.cursor;
    document.body.style.cursor=side==='left'||side==='right'?'col-resize':'row-resize';
    // Pointer coordinates are screen pixels. Dock sizes are unzoomed CSS pixels.
    const onMove=(e:globalThis.PointerEvent)=>{
      const scale=useStudioLayout.getState().uiScale;
      setSideSize(side,size0+dir*((side==='left'||side==='right'?e.clientX:e.clientY)-startCoord)/scale);
    };
    const onUp=()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);window.removeEventListener('pointercancel',onUp);document.body.style.cursor=oldCursor};
    window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);window.addEventListener('pointercancel',onUp);
  };
}
function StackSplitter({a,b,horizontal}:{a:DockPanelId,b:DockPanelId,horizontal:boolean}){
  const setWeights=useStudioLayout(s=>s.setWeights);
  const begin=(event:ReactPointerEvent<HTMLDivElement>)=>{
    event.preventDefault();
    const parent=event.currentTarget.parentElement;
    if(!parent)return;
    const panelA=parent.querySelector(`[data-pane="${a}"]`) as HTMLElement|null;
    const panelB=parent.querySelector(`[data-pane="${b}"]`) as HTMLElement|null;
    if(!panelA||!panelB)return;
    const start=horizontal?event.clientX:event.clientY;
    const sizeA=horizontal?panelA.getBoundingClientRect().width:panelA.getBoundingClientRect().height;
    const sizeB=horizontal?panelB.getBoundingClientRect().width:panelB.getBoundingClientRect().height;
    const initial=useStudioLayout.getState().weights;
    const weightSum=initial[a]+initial[b];
    const move=(e:globalThis.PointerEvent)=>{
      const delta=(horizontal?e.clientX:e.clientY)-start;
      const fraction=Math.max(.18,Math.min(.82,(sizeA+delta)/(sizeA+sizeB)));
      setWeights(a,fraction*weightSum,b,(1-fraction)*weightSum);
    };
    const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up)};
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',up);
  };
  return <div role="separator" aria-label="Resize dock panels" className={`dock-split ${horizontal?'split-horizontal':'split-vertical'}`} onPointerDown={begin}/>;
}
export function DockWorkspace({toolbar,viewport,consolePanel}:{toolbar:ReactNode,viewport:ReactNode,consolePanel:ReactNode}){
  const t=useT();
  const layout=useStudioLayout();
  const [dragging,setDragging]=useState<Dragged|null>(null);
  // Recompute visible docks when the window is resized; never let saved dock
  // dimensions consume the entire viewport at a different resolution/scale.
  const [windowSize,setWindowSize]=useState(()=>({width:window.innerWidth,height:window.innerHeight}));
  useEffect(()=>{
    const onResize=()=>setWindowSize({width:window.innerWidth,height:window.innerHeight});
    window.addEventListener('resize',onResize);
    return()=>window.removeEventListener('resize',onResize);
  },[]);
  const has=(side:DockSide)=>layout.order.some(id=>layout.visible[id]&&layout.sides[id]===side);
  const logicalWidth=windowSize.width/layout.uiScale;
  const logicalHeight=windowSize.height/layout.uiScale;
  const toolbarWidth=layout.compactTools!==false?0:(layout.toolbarDock==='left'||layout.toolbarDock==='right'?124:0);
  const toolbarHeight=layout.compactTools!==false?0:(layout.toolbarDock==='top'||layout.toolbarDock==='bottom'?115:0);
  const widthBudget=Math.max(0,logicalWidth-toolbarWidth-220-32);
  const requestedLeft=has('left')?layout.widths.left:0;
  const requestedRight=has('right')?layout.widths.right:0;
  const dockWidthFactor=Math.min(1,widthBudget/Math.max(1,requestedLeft+requestedRight));
  const responsiveLeft=requestedLeft*dockWidthFactor;
  const responsiveRight=requestedRight*dockWidthFactor;
  const heightBudget=Math.max(0,logicalHeight-toolbarHeight-56-30-140-30);
  const requestedTop=has('top')?layout.heights.top:0;
  const requestedBottom=has('bottom')?layout.heights.bottom:0;
  const dockHeightFactor=Math.min(1,heightBudget/Math.max(1,requestedTop+requestedBottom));
  const responsiveTop=requestedTop*dockHeightFactor;
  const responsiveBottom=requestedBottom*dockHeightFactor;
  const beginPanel=(e:DragEvent,id:DockPanelId)=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-sven-dock',`panel:${id}`);setDragging({type:'panel',id})};
  const beginToolbar=(e:DragEvent)=>{e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-sven-dock','toolbar');setDragging({type:'toolbar'})};
  const complete=(e:DragEvent,side:DockSide,before?:DockPanelId)=>{
    e.preventDefault();e.stopPropagation();
    const raw=e.dataTransfer.getData('application/x-sven-dock');
    if(raw==='toolbar')layout.setToolbarDock(side);
    else if(raw.startsWith('panel:')){
      const id=raw.slice(6) as DockPanelId;
      if(id in layout.sides)layout.movePanel(id,side,before);
    }
    setDragging(null);
  };
  const pane=(id:DockPanelId,side:DockSide)=><DockPane key={id} id={id} side={side} onStart={beginPanel} onEnd={()=>setDragging(null)}>{id==='assets'?<AssetPanel/>:id==='explorer'?<Explorer/>:id==='properties'?<Properties/>:consolePanel}</DockPane>;
  const zone=(side:DockSide)=>{
    const ids=layout.order.filter(id=>layout.visible[id]&&layout.sides[id]===side);
    const horizontal=side==='top'||side==='bottom';
    if(!ids.length&&!dragging)return null;
    return <div className={`dock-zone dock-${side} ${horizontal?'zone-horizontal':'zone-vertical'} ${dragging?'zone-drop-ready':''}`}
      style={side==='left'||side==='right'?{width:ids.length?(side==='left'?responsiveLeft:responsiveRight):78}:{height:ids.length?(side==='top'?responsiveTop:responsiveBottom):42}}
      onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move'}} onDrop={e=>complete(e,side)}>
      {ids.length?ids.map((id,index)=><div className="dock-item-slot" key={id} style={{flexGrow:layout.weights[id]||1}}>
        <div className="dock-pane-wrap" onDragOver={e=>e.preventDefault()} onDrop={e=>complete(e,side,id)}>{pane(id,side)}</div>
      </div>).flatMap((item,index)=>index<ids.length-1?[item,<StackSplitter key={`split-${ids[index]}`} a={ids[index]} b={ids[index+1]} horizontal={horizontal}/>]:[item]):<div className="empty-dock-drop"><ArrowDownToLine size={17}/><span>{t('Dock here')}</span></div>}
    </div>;
  };
  const resize=useSizeDrag();
  const left=layout.order.some(id=>layout.visible[id]&&layout.sides[id]==='left');
  const right=layout.order.some(id=>layout.visible[id]&&layout.sides[id]==='right');
  const top=layout.order.some(id=>layout.visible[id]&&layout.sides[id]==='top');
  const bottom=layout.order.some(id=>layout.visible[id]&&layout.sides[id]==='bottom');
  const dropBadge=(side:DockSide)=>{
    const Icon=sideIcons[side];
    return <div key={side} className={`viewport-dock-target target-${side}`} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move'}} onDrop={e=>complete(e,side)}><Icon size={18}/><span>{t(side[0].toUpperCase()+side.slice(1))}</span></div>;
  };
  const bar=<div className="ribbon-shell">
    <div className="toolbar-dock-heading">
      <DragHandle onStart={beginToolbar} onEnd={()=>setDragging(null)}><Layers size={15}/><span>{t('Tools')}</span></DragHandle>
      <AttachSelect value={layout.toolbarDock} label="Tools" onChange={layout.setToolbarDock}/>
    </div>
    {toolbar}
  </div>;
  return <div className={`studio-body toolbar-${layout.toolbarDock}`}>
    {(layout.compactTools===false)&&(layout.toolbarDock==='top'||layout.toolbarDock==='left')&&bar}
    <div className="dock-workspace">
      {top&&<>{zone('top')}<div className="zone-size-handle resize-top" role="separator" aria-label="Resize top dock" onPointerDown={e=>resize(e,'top')}/></>}
      <div className="dock-main-row">
        {left&&<>{zone('left')}<div className="zone-size-handle resize-left" role="separator" aria-label="Resize left dock" onPointerDown={e=>resize(e,'left')}/></>}
        <div className="studio-viewport-host">{viewport}{layout.compactTools!==false&&<QuickToolRail/>}
          {dragging&&<div className="viewport-dock-targets">{sides.map(dropBadge)}<div className="dock-target-message"><Move size={15}/>{t('Drop on a side to dock')}</div></div>}
        </div>
        {right&&<><div className="zone-size-handle resize-right" role="separator" aria-label="Resize right dock" onPointerDown={e=>resize(e,'right')}/>{zone('right')}</>}
      </div>
      {bottom&&<><div className="zone-size-handle resize-bottom" role="separator" aria-label="Resize bottom dock" onPointerDown={e=>resize(e,'bottom')}/>{zone('bottom')}</>}
    </div>
    {(layout.compactTools===false)&&(layout.toolbarDock==='bottom'||layout.toolbarDock==='right')&&bar}
  </div>;
}
export function LayoutModal({onClose}:{onClose:()=>void}){
  useEffect(()=>{
    const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose()}};
    window.addEventListener('keydown',esc);
    return ()=>window.removeEventListener('keydown',esc);
  },[onClose]);
  const t=useT();
  const layout=useStudioLayout();
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card layout-modal" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-title"><LayoutTemplate size={19}/><span>{t('Workspace layout')}</span><button onClick={onClose}>×</button></div>
    <p className="modal-subtext">{t('Drag panel headers or choose a docking side. Resize the dividers. Changes are saved automatically.')}</p>
    <div className="layout-subtitle">{t('Quick layouts')}</div>
    <div className="layout-presets">{(['creative','classic','focus','wide','minimal'] as const).map(k=><button key={k} onClick={()=>layout.usePreset(k)}><LayoutTemplate size={19}/><span>{t(k[0].toUpperCase()+k.slice(1))}</span></button>)}</div>
    <div className="layout-subtitle">{t('Toolbar style')}</div><div className="layout-side-choices"><button className={layout.compactTools!==false?'chosen':''} onClick={()=>layout.setCompactTools(true)}>{t('Floating tools')}</button><button className={layout.compactTools===false?'chosen':''} onClick={()=>layout.setCompactTools(false)}>{t('Classic ribbon')}</button></div>
    <div className="layout-subtitle">{t('Toolbar location')}</div>
    <div className="layout-side-choices">{sides.map(side=>{const Icon=sideIcons[side];return <button key={side} className={layout.toolbarDock===side?'chosen':''} onClick={()=>layout.setToolbarDock(side)}><Icon size={18}/>{t(side[0].toUpperCase()+side.slice(1))}</button>})}</div>
    <div className="layout-subtitle">{t('Panels')}</div>
    <div className="layout-panel-list">{(['assets','explorer','properties','console'] as const).map(id=>{const Icon=panelIcons[id];return <div key={id}><Icon size={16}/><strong>{t(panelNames[id])}</strong><AttachSelect value={layout.sides[id]} label={panelNames[id]} onChange={side=>layout.movePanel(id,side)}/><button className="visibility-toggle" onClick={()=>layout.setVisible(id,!layout.visible[id])}>{layout.visible[id]?<Eye size={16}/>:<EyeOff size={16}/>}</button></div>})}</div>
    <div className="layout-subtitle">{t('Interface size')} <output>{Math.round(layout.uiScale*100)}%</output></div>
    <input className="layout-scale-slider" aria-label={t('Interface size')} type="range" min="0.8" max="1.2" step="0.05" value={layout.uiScale} onChange={e=>layout.setScale(Number(e.target.value))}/>
    <div className="layout-subtitle">{t('Font size')} <output>{Math.round(layout.fontScale*100)}%</output></div>
    <input className="layout-scale-slider" aria-label={t('Font size')} type="range" min="0.9" max="1.2" step="0.05" value={layout.fontScale} onChange={e=>layout.setFontScale(Number(e.target.value))}/>
    <div className="layout-subtitle">{t('Large map performance')}</div>
    <div className="layout-performance-options">{(['quality','balanced','large'] as const).map(id=><button key={id} className={layout.performancePreset===id?'chosen':''} onClick={()=>layout.setPerformancePreset(id)}>{t(id==='quality'?'Quality':id==='balanced'?'Balanced':'Large maps')}</button>)}</div>
    <p className="modal-subtext">{t('Performance settings affect only viewport previews, never compiled map content.')}</p>
    <div className="layout-subtitle">{t('Accent theme')}</div>
    <div className="layout-theme-choices">{(['nebula','ice','ember','mint','orchid','gold'] as const).map(id=><button key={id} className={`theme-choice theme-${id} ${layout.accent===id?'chosen':''}`} onClick={()=>layout.setAccent(id)}><span/>{t(id[0].toUpperCase()+id.slice(1))}</button>)}</div>
    <div className="layout-bottom-buttons"><button onClick={layout.resetLayout}><RotateCcw size={16}/>{t('Reset layout')}</button><button className="primary-action" onClick={onClose}>{t('Done')}</button></div>
  </div></div>;
}
