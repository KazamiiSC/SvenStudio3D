import {useEffect,useRef,useState,type ReactNode,type CSSProperties,type PointerEvent as ReactPointerEvent,type DragEvent} from 'react';
import {VIEWPORT_THEMES} from '../engine/viewportThemes';
import {GripVertical,ArrowLeft,ArrowRight,ArrowDownToLine,PanelLeft,PanelRight,PanelTop,PanelBottom,RotateCcw,SlidersHorizontal,Layers,Blocks,FolderTree,Terminal,LayoutTemplate,Eye,EyeOff,Move,Sun,Check} from 'lucide-react';
import {useHudLayout} from '../hudLayout';
import {useStudioLayout,TOOLBAR_GROUPS,normalizeToolbarGroups,type DockPanelId,type DockSide,type ToolbarGroup} from '../layout';
import {INTERFACE_THEMES,INTERFACE_THEME_NAMES,INTERFACE_THEME_SWATCHES,interfaceThemeCopy} from '../engine/interfaceThemes';
import {useT} from '../i18n';
import {useEditor} from '../store';
import {measureAdaptiveDocks} from '../engine/adaptiveWorkspace';
import {normalizedDockFlexGrows} from '../engine/dockFlex';
import {AssetPanel,Explorer,Properties} from './Panels';

type Dragged={type:'panel',id:DockPanelId}|{type:'toolbar'};
const sides:DockSide[]=['left','right','top','bottom'];
const sideIcons={left:PanelLeft,right:PanelRight,top:PanelTop,bottom:PanelBottom};
const panelIcons={assets:Blocks,explorer:FolderTree,properties:SlidersHorizontal,console:Terminal};

/** Appearance labels stay in one place, with no fallback to another UI language. */
const appearanceLabels={
  es:{title:'Apariencia y tema de acento',mode:'Apariencia',dark:'Modo oscuro',hint:'El aspecto de los paneles cambia; los colores y la iluminación del mapa no cambian.',accent:'Tema de acento'},
  en:{title:'Appearance & accent theme',mode:'Appearance',dark:'Dark mode',hint:'Only editor panels change; map materials and lighting are unaffected.',accent:'Accent theme'},
  ru:{title:'Оформление и цветовой акцент',mode:'Оформление',dark:'Тёмная тема',hint:'Изменяется только интерфейс редактора, не материалы и освещение карты.',accent:'Цветовой акцент'},
  ko:{title:'화면 모드 및 강조 색상',mode:'화면 모드',dark:'다크 모드',hint:'편집기 패널만 바뀌며 맵 재질과 조명은 그대로 유지됩니다.',accent:'강조 색상'},
  zh:{title:'外观与强调色主题',mode:'外观',dark:'深色模式',hint:'仅更改编辑器面板，不改变地图材质和光照。',accent:'强调色主题'},
  pt:{title:'Aparência e tema de destaque',mode:'Aparência',dark:'Modo escuro',hint:'Apenas a interface muda; os materiais e a iluminação do mapa permanecem iguais.',accent:'Tema de destaque'}
} as const;
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
  return <section className="dock-pane" data-pane={id} data-dock-side={side}>
    <div className="dock-pane-titlebar"><DragHandle onStart={e=>onStart(e,id)} onEnd={onEnd}><Icon size={15}/><strong>{t(panelNames[id])}</strong></DragHandle>
      <div className="dock-pane-actions"><AttachSelect value={side} onChange={dest=>move(id,dest)} label={panelNames[id]}/><button title={t('Hide panel')} onClick={()=>setVisible(id,false)}><EyeOff size={14}/></button></div>
    </div>
    <div className="dock-pane-body">{children}</div>
  </section>;
}
/** Pointer drags are window-scoped so a resize still works outside its small handle.
 * Always release the cursor and selection lock on blur/cancel/Escape. */
function beginResizeCursor(cursor:'col-resize'|'row-resize'){
  const previousCursor=document.body.style.cursor;
  const previousSelection=document.body.style.userSelect;
  document.body.style.cursor=cursor;
  document.body.style.userSelect='none';
  return ()=>{document.body.style.cursor=previousCursor;document.body.style.userSelect=previousSelection};
}
function useSizeDrag(){
  const setSideSize=useStudioLayout(s=>s.setSideSize);
  return (event:ReactPointerEvent<HTMLDivElement>,side:DockSide)=>{
    if(event.button!==0)return;
    event.preventDefault();
    const pointerId=event.pointerId;
    const vertical=side==='left'||side==='right';
    const startCoord=vertical?event.clientX:event.clientY;
    const store=useStudioLayout.getState();
    const size0=vertical?store.widths[side]:store.heights[side];
    const dir=side==='left'||side==='top'?1:-1;
    const restore=beginResizeCursor(vertical?'col-resize':'row-resize');
    const onMove=(e:globalThis.PointerEvent)=>{
      if(e.pointerId!==pointerId)return;
      const scale=useStudioLayout.getState().uiScale;
      setSideSize(side,size0+dir*((vertical?e.clientX:e.clientY)-startCoord)/scale);
    };
    const onUp=(e:globalThis.PointerEvent)=>{if(e.pointerId===pointerId)stop()};
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')stop()};
    const stop=()=>{
      window.removeEventListener('pointermove',onMove);
      window.removeEventListener('pointerup',onUp);
      window.removeEventListener('pointercancel',onUp);
      window.removeEventListener('blur',stop);
      window.removeEventListener('keydown',onKey);
      restore();
    };
    window.addEventListener('pointermove',onMove);
    window.addEventListener('pointerup',onUp);
    window.addEventListener('pointercancel',onUp);
    window.addEventListener('blur',stop);
    window.addEventListener('keydown',onKey);
  };
}
function StackSplitter({a,b,horizontal}:{a:DockPanelId,b:DockPanelId,horizontal:boolean}){
  const setWeights=useStudioLayout(s=>s.setWeights);
  const begin=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.button!==0)return;
    event.preventDefault();
    const parent=event.currentTarget.parentElement;
    if(!parent)return;
    const panelA=parent.querySelector(`[data-pane="${a}"]`) as HTMLElement|null;
    const panelB=parent.querySelector(`[data-pane="${b}"]`) as HTMLElement|null;
    if(!panelA||!panelB)return;
    const pointerId=event.pointerId;
    const start=horizontal?event.clientX:event.clientY;
    const sizeA=horizontal?panelA.getBoundingClientRect().width:panelA.getBoundingClientRect().height;
    const sizeB=horizontal?panelB.getBoundingClientRect().width:panelB.getBoundingClientRect().height;
    if(sizeA+sizeB<=0)return;
    const initial=useStudioLayout.getState().weights;
    const weightSum=initial[a]+initial[b];
    const restore=beginResizeCursor(horizontal?'col-resize':'row-resize');
    const move=(e:globalThis.PointerEvent)=>{
      if(e.pointerId!==pointerId)return;
      const delta=(horizontal?e.clientX:e.clientY)-start;
      const fraction=Math.max(.18,Math.min(.82,(sizeA+delta)/(sizeA+sizeB)));
      setWeights(a,fraction*weightSum,b,(1-fraction)*weightSum);
    };
    const up=(e:globalThis.PointerEvent)=>{if(e.pointerId===pointerId)stop()};
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')stop()};
    const stop=()=>{
      window.removeEventListener('pointermove',move);
      window.removeEventListener('pointerup',up);
      window.removeEventListener('pointercancel',up);
      window.removeEventListener('blur',stop);
      window.removeEventListener('keydown',onKey);
      restore();
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('pointerup',up);
    window.addEventListener('pointercancel',up);
    window.addEventListener('blur',stop);
    window.addEventListener('keydown',onKey);
  };
  return <div role="separator" aria-label="Resize dock panels" className={`dock-split ${horizontal?'split-horizontal':'split-vertical'}`} onPointerDown={begin}/>;
}
export function DockWorkspace({toolbar,viewport,consolePanel}:{toolbar:ReactNode,viewport:ReactNode,consolePanel:ReactNode}){
  const t=useT();
  const layout=useStudioLayout();
  const [dragging,setDragging]=useState<Dragged|null>(null);
  // Measure the actual dock region, not window.innerWidth. Windows display
  // scaling, Chrome zoom, classic ribbon and saved zoom all affect its size.
  const dockRef=useRef<HTMLDivElement|null>(null);
  const [dockSize,setDockSize]=useState({width:0,height:0});
  useEffect(()=>{
    const element=dockRef.current;if(!element)return;
    const measure=()=>{
      const {width,height}=element.getBoundingClientRect();
      // getBoundingClientRect includes CSS zoom; clientWidth/clientHeight are
      // the logical dimensions used by dock CSS and resize handles.
      const w=element.clientWidth||width,h=element.clientHeight||height;
      setDockSize(old=>Math.abs(old.width-w)<1&&Math.abs(old.height-h)<1?old:{width:w,height:h});
    };
    measure();
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(measure):null;
    observer?.observe(element);
    window.addEventListener('resize',measure);
    return()=>{observer?.disconnect();window.removeEventListener('resize',measure)};
  },[]);
  const has=(side:DockSide)=>layout.order.some(id=>id!=='console'&&layout.visible[id]&&layout.sides[id]===side);
  const sizes=measureAdaptiveDocks({
    width:dockSize.width||window.innerWidth/layout.uiScale,
    height:dockSize.height||window.innerHeight/layout.uiScale,
    left:has('left')?layout.widths.left:0,
    right:has('right')?layout.widths.right:0,
    top:has('top')?layout.heights.top:0,
    bottom:has('bottom')?layout.heights.bottom:0,
    enabled:layout.autoLayout
  });
  const responsiveLeft=sizes.left,responsiveRight=sizes.right;
  const responsiveTop=sizes.top,responsiveBottom=sizes.bottom;
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
    const ids=layout.order.filter(id=>id!=='console'&&layout.visible[id]&&layout.sides[id]===side);
    const horizontal=side==='top'||side==='bottom';
    // Saved weights may sum to less than 1 after other panels move/hide.
    // Flexbox then leaves the rest of the dock empty; normalize visible ratios.
    const grow=normalizedDockFlexGrows(ids,layout.weights);
    if(!ids.length&&!dragging)return null;
    return <div className={`dock-zone dock-${side} ${horizontal?'zone-horizontal':'zone-vertical'} ${dragging?'zone-drop-ready':''}`}
      style={side==='left'||side==='right'?{width:ids.length?(side==='left'?responsiveLeft:responsiveRight):78}:{height:ids.length?(side==='top'?responsiveTop:responsiveBottom):42}}
      onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move'}} onDrop={e=>complete(e,side)}>
      {ids.length?ids.map((id,index)=><div className="dock-item-slot" key={id} style={{flexGrow:grow[id]}}>
        <div className="dock-pane-wrap" onDragOver={e=>e.preventDefault()} onDrop={e=>complete(e,side,id)}>{pane(id,side)}</div>
      </div>).flatMap((item,index)=>index<ids.length-1?[item,<StackSplitter key={`split-${ids[index]}`} a={ids[index]} b={ids[index+1]} horizontal={horizontal}/>]:[item]):<div className="empty-dock-drop"><ArrowDownToLine size={17}/><span>{t('Dock here')}</span></div>}
    </div>;
  };
  const resize=useSizeDrag();
  const left=layout.order.some(id=>id!=='console'&&layout.visible[id]&&layout.sides[id]==='left');
  const right=layout.order.some(id=>id!=='console'&&layout.visible[id]&&layout.sides[id]==='right');
  const top=layout.order.some(id=>id!=='console'&&layout.visible[id]&&layout.sides[id]==='top');
  const bottom=layout.order.some(id=>id!=='console'&&layout.visible[id]&&layout.sides[id]==='bottom');
  const dropBadge=(side:DockSide)=>{
    const Icon=sideIcons[side];
    return <div key={side} className={`viewport-dock-target target-${side}`} onDragOver={e=>{e.preventDefault();e.dataTransfer.dropEffect='move'}} onDrop={e=>complete(e,side)}><Icon size={18}/><span>{t(side[0].toUpperCase()+side.slice(1))}</span></div>;
  };
  const scrollRibbon=(delta:number)=>{
    const element=dockRef.current?.parentElement?.querySelector('.ribbon-shell .ribbon');
    element?.scrollBy({left:delta,top:0,behavior:'smooth'});
  };
  const bar=<div className="ribbon-shell">
    <div className="toolbar-dock-heading">
      <DragHandle onStart={beginToolbar} onEnd={()=>setDragging(null)}><Layers size={15}/><span>{t('Tools')}</span></DragHandle>
      <div className="ui3-ribbon-navigation"><button type="button" onClick={()=>scrollRibbon(-350)} aria-label={t('Previous toolbar groups')} title={t('Previous toolbar groups')}>‹</button>
      <button type="button" onClick={()=>scrollRibbon(350)} aria-label={t('Next toolbar groups')} title={t('Next toolbar groups')}>›</button></div>
      <AttachSelect value={layout.toolbarDock} label="Tools" onChange={layout.setToolbarDock}/>
    </div>
    {toolbar}
  </div>;
  return <div className={`studio-body toolbar-${layout.toolbarDock} ${sizes.compact?'adaptive-compact':''} ${sizes.tight?'adaptive-tight':''} ${sizes.short?'adaptive-short':''}`}>
    {(layout.compactTools===false)&&(layout.toolbarDock==='top'||layout.toolbarDock==='left')&&bar}
    <div className="dock-workspace" ref={dockRef}>
      {top&&<>{zone('top')}<div className="zone-size-handle resize-top" role="separator" aria-label="Resize top dock" onPointerDown={e=>resize(e,'top')}/></>}
      <div className="dock-main-row">
        {left&&<>{zone('left')}<div className="zone-size-handle resize-left" role="separator" aria-label="Resize left dock" onPointerDown={e=>resize(e,'left')}/></>}
        <div className="studio-viewport-host">{viewport}
          {dragging&&<div className="viewport-dock-targets">{sides.map(dropBadge)}<div className="dock-target-message"><Move size={15}/>{t('Drop on a side to dock')}</div></div>}
        </div>
        {right&&<><div className="zone-size-handle resize-right" role="separator" aria-label="Resize right dock" onPointerDown={e=>resize(e,'right')}/>{zone('right')}</>}
      </div>
      {bottom&&<><div className="zone-size-handle resize-bottom" role="separator" aria-label="Resize bottom dock" onPointerDown={e=>resize(e,'bottom')}/>{zone('bottom')}</>}
    </div>
    {(layout.compactTools===false)&&(layout.toolbarDock==='bottom'||layout.toolbarDock==='right')&&bar}
  </div>;
}
/* v2.4: the former "Appearance & accent theme" dialog is split into clear sections of the Editor
 * Preferences window (PreferencesStudio). Duplicated titles, duplicated hints and the two separate
 * preset lists are merged; internal jargon ("HF17 HF1") is gone. */
export function ThemeSettings(){
  const t=useT();
  const layout=useStudioLayout();
  const locale=useEditor(s=>s.locale);
  const appearanceText=appearanceLabels[locale];
  const themeText=interfaceThemeCopy(locale);
  return <>
    <section className="pref-card">
      <header><strong>{themeText.heading}</strong><small>{themeText.subtitle}</small></header>
      <div className="studio-theme-grid" role="group" aria-label={themeText.heading}>
        {INTERFACE_THEMES.map(id=>{
          const swatch=INTERFACE_THEME_SWATCHES[id];
          return <button type="button" key={id} className={`studio-theme-card studio-theme-card-${id} ${layout.interfaceTheme===id?'chosen':''}`}
            aria-pressed={layout.interfaceTheme===id} onClick={()=>layout.setInterfaceTheme(id)}
            title={`${INTERFACE_THEME_NAMES[id]} — ${themeText[id]}`}>
            <span className="studio-theme-miniature" aria-hidden="true" style={{'--preview-bg':swatch.bg,'--preview-panel':swatch.panel,'--preview-highlight':swatch.accent,'--preview-text':swatch.text} as CSSProperties}>
              <span className="studio-theme-miniature-title"/><span className="studio-theme-miniature-body"><i/><i/><i/></span>
            </span>
            <span className="studio-theme-card-copy"><strong>{INTERFACE_THEME_NAMES[id]}</strong><small>{themeText[id]}</small></span>
            {layout.interfaceTheme===id&&<Check size={16} className="studio-theme-selected"/>}
          </button>;
        })}
      </div>
    </section>
    <section className="pref-card">
      <header><strong>{appearanceText.accent}</strong><small>{appearanceText.hint}</small></header>
      <div className="layout-theme-choices">{(['nebula','ice','ember','mint','orchid','gold'] as const).map(id=><button type="button" key={id} aria-pressed={layout.accent===id} className={`theme-choice theme-${id} ${layout.accent===id?'chosen':''}`} onClick={()=>layout.setAccent(id)}><span/>{t(id[0].toUpperCase()+id.slice(1))}</button>)}</div>
    </section>
    <section className="pref-card">
      <header><strong>{t('Size and text')}</strong><small>{t('Scale the whole interface or only the text, for example on 125% / 150% Windows displays.')}</small></header>
      <label className="pref-slider"><span>{t('Interface size')}</span><input aria-label={t('Interface size')} type="range" min="0.8" max="1.2" step="0.05" value={layout.uiScale} onChange={e=>layout.setScale(Number(e.target.value))}/><output>{Math.round(layout.uiScale*100)}%</output></label>
      <label className="pref-slider"><span>{t('Font size')}</span><input aria-label={t('Font size')} type="range" min="0.9" max="1.2" step="0.05" value={layout.fontScale} onChange={e=>layout.setFontScale(Number(e.target.value))}/><output>{Math.round(layout.fontScale*100)}%</output></label>
    </section>
  </>;
}
export function WorkspaceSettings(){
  const t=useT();
  const layout=useStudioLayout();
  const [workspaceName,setWorkspaceName]=useState('');
  const orderedToolbar=normalizeToolbarGroups(layout.toolbarGroups??TOOLBAR_GROUPS);
  const toolbarLabels:Record<ToolbarGroup,string>={transform:'Transform',view:'View',geometry:'Geometry editing',modeling:'Modeling',textures:'Textures',tools:'Tools',grid:'Grid',edit:'Edit',studios:'Studios'};
  const presets=[
    ...(['construction','entities','bsp'] as const).map(id=>({id,label:id==='construction'?'Construction workspace':id==='entities'?'Entities workspace':'BSP workspace',apply:()=>{layout.usePreset(id);if(id==='construction')useEditor.getState().setResourceView('textures');if(id==='entities')useEditor.getState().setResourceView('entities');}})),
    ...(['organized','creative','classic','focus','wide','minimal'] as const).map(id=>({id,label:id[0].toUpperCase()+id.slice(1),apply:()=>layout.usePreset(id)}))
  ];
  return <>
    <section className="pref-card">
      <header><strong>{t('Layouts')}</strong><small>{t('Drag panel headers or choose a docking side. Resize the dividers. Changes are saved automatically.')}</small></header>
      <div className="pref-preset-grid">{presets.map(p=><button type="button" key={p.id} onClick={p.apply}><LayoutTemplate size={16}/><span>{t(p.label)}</span></button>)}</div>
      <form className="ui3-save-workspace" onSubmit={e=>{e.preventDefault();layout.saveCurrentWorkspace(workspaceName);setWorkspaceName('')}}>
        <input aria-label={t('Workspace name')} placeholder={t('Workspace name')} value={workspaceName} maxLength={48} onChange={e=>setWorkspaceName(e.target.value)}/>
        <button disabled={!workspaceName.trim()} type="submit">{t('Save workspace')}</button>
      </form>
      <div className="ui3-saved-workspaces">
        {Object.keys(layout.savedWorkspaces).length===0&&<small>{t('No saved workspaces')}</small>}
        {Object.keys(layout.savedWorkspaces).map(name=><div key={name}><span title={name}>{name}</span>
          <button type="button" onClick={()=>layout.restoreSavedWorkspace(name)}>{t('Apply')}</button>
          <button type="button" onClick={()=>layout.deleteSavedWorkspace(name)} aria-label={`${t('Delete')} ${name}`}>×</button>
        </div>)}
      </div>
    </section>
    <section className="pref-card">
      <header><strong>{t('Panels')}</strong></header>
      <div className="layout-panel-list">{(['assets','explorer','properties'] as const).map(id=>{const Icon=panelIcons[id];return <div key={id}><Icon size={16}/><strong>{t(panelNames[id])}</strong><AttachSelect value={layout.sides[id]} label={panelNames[id]} onChange={side=>layout.movePanel(id,side)}/><button className="visibility-toggle" onClick={()=>layout.setVisible(id,!layout.visible[id])}>{layout.visible[id]?<Eye size={16}/>:<EyeOff size={16}/>}</button></div>})}</div>
      <label className="pref-toggle adaptive-layout-setting"><input type="checkbox" checked={layout.autoLayout} onChange={e=>layout.setAutoLayout(e.target.checked)}/><span><b>{t('Automatically adjust docks and toolbars to available space')}</b><small>{t('Recommended for Windows 125% / 150% display scaling. Keeps manual panel sizes and restores them when there is more space. Does not alter MAP geometry or browser zoom.')}</small></span></label>
    </section>
    <section className="pref-card">
      <header><strong>{t('Toolbar')}</strong><small>{t('Pin the most-used toolbar groups to the front. The others stay available.')}</small></header>
      <div className="pref-segmented"><button className={layout.compactTools!==false?'chosen':''} onClick={()=>layout.setCompactTools(true)}>{t('Floating tools')}</button><button className={layout.compactTools===false?'chosen':''} onClick={()=>layout.setCompactTools(false)}>{t('Classic ribbon')}</button></div>
      {layout.compactTools===false?<div className="pref-segmented">{sides.map(side=>{const Icon=sideIcons[side];return <button key={side} className={layout.toolbarDock===side?'chosen':''} onClick={()=>layout.setToolbarDock(side)}><Icon size={16}/>{t(side[0].toUpperCase()+side.slice(1))}</button>})}</div>
        :<p className="modal-subtext">{t('Move floating tools with Edit HUD. Toolbar docking applies to Classic ribbon only.')}</p>}
      <div className="layout-toolbar-sections">{orderedToolbar.map((id,index)=><div key={id} className={layout.hiddenToolbarGroups.includes(id)?'is-hidden':''}>
        <button type="button" className={layout.pinnedToolbarGroups.includes(id)?'ui3-pinned':'ui3-unpinned'} onClick={()=>layout.togglePinnedToolbarGroup(id)} title={t('Pin or unpin toolbar group')} aria-pressed={layout.pinnedToolbarGroups.includes(id)}>★</button><GripVertical size={14}/><strong>{t(toolbarLabels[id])}</strong>
        <button type="button" title={t('Show/hide toolbar group')} aria-pressed={!layout.hiddenToolbarGroups.includes(id)} onClick={()=>layout.toggleToolbarGroupHidden(id)}>{layout.hiddenToolbarGroups.includes(id)?<EyeOff size={14}/>:<Eye size={14}/>}</button>
        <button type="button" title={t('Move left')} aria-label={`${t(toolbarLabels[id])} · ${t('Move left')}`} disabled={index===0} onClick={()=>layout.stepToolbarGroup(id,-1)}><ArrowLeft size={14}/></button>
        <button type="button" title={t('Move right')} aria-label={`${t(toolbarLabels[id])} · ${t('Move right')}`} disabled={index===orderedToolbar.length-1} onClick={()=>layout.stepToolbarGroup(id,1)}><ArrowRight size={14}/></button>
      </div>)}</div>
    </section>
    <div className="pref-actions"><button onClick={layout.resetLayout}><RotateCcw size={15}/>{t('Reset layout')}</button></div>
  </>;
}
export function ViewportSettings(){
  const t=useT();
  const layout=useStudioLayout();
  const fps=useHudLayout(s=>s.items.fps.visible),updateHud=useHudLayout(s=>s.update);
  const ratios:[number,string][]=[[0,'Automatic (from the quality preset)'],[2,'Sharp'],[1.5,'High'],[1.25,'Balanced'],[1,'Fast'],[.75,'Fastest']];
  return <>
    <section className="pref-card">
      <header><strong>{t('3D viewport style')}</strong><small>{t('Background and grid colours of the 3D view. Editor look only: the compiled map does not change.')}</small></header>
      <div className="pref-viewport-themes">{VIEWPORT_THEMES.map(th=><button type="button" key={th.id} className={layout.viewportTheme===th.id?'chosen':''} aria-pressed={layout.viewportTheme===th.id} onClick={()=>layout.setViewportTheme(th.id)}>
        <span className="pref-theme-swatch" style={{background:`linear-gradient(180deg,${th.top},${th.bottom})`}}><i style={{borderColor:th.grid}}/></span><b>{t(th.label)}</b></button>)}</div>
    </section>
    <section className="pref-card">
      <header><strong>{t('Large map performance')}</strong><small>{t('Performance settings affect only viewport previews, never compiled map content.')}</small></header>
      <div className="pref-segmented">{(['quality','balanced','large'] as const).map(id=><button key={id} className={layout.performancePreset===id?'chosen':''} onClick={()=>layout.setPerformancePreset(id)}>{t(id==='quality'?'Quality':id==='balanced'?'Balanced':'Large maps')}</button>)}</div>
      <label className="pref-row"><span><b>{t('3D viewport resolution')}</b><small>{t('Lower values render fewer pixels: much higher FPS on 4K or 150% displays, slightly softer image.')}</small></span>
        <select value={layout.viewportPixelRatio} onChange={e=>layout.setViewportPixelRatio(Number(e.target.value))}>{ratios.map(([v,l])=><option key={v} value={v}>{t(l)}{v?` · ${v}×`:''}</option>)}</select></label>
      <label className="pref-toggle"><input type="checkbox" checked={layout.opaqueBrushBatching} onChange={e=>layout.setOpaqueBrushBatching(e.target.checked)}/><span><b>{t('Group brushes for more FPS')}</b><small>{t('Batching merges compatible opaque surfaces for fewer GPU draw calls. Disable it here to compare FPS or if a visual problem appears. It never changes MAP geometry.')}</small></span></label>
      <label className="pref-row"><span><b>{t('3D entity models')}</b><small>{t('By default every model placed in the map is shown. On very heavy maps you can show only the models near the camera.')}</small></span>
        <select value={layout.modelDisplay} onChange={e=>layout.setModelDisplay(e.target.value as 'all'|'near')}><option value="all">{t('Show all models')}</option><option value="near">{t('Only near the camera')}</option></select></label>
      {layout.modelDisplay==='near'&&<label className="pref-slider"><span>{t('Model distance')}</span><input type="range" min="500" max="32000" step="500" value={layout.modelDistance} onChange={e=>layout.setModelDistance(Number(e.target.value))}/><output>{layout.modelDistance} u</output></label>}      <label className="pref-toggle"><input type="checkbox" checked={fps} onChange={e=>updateHud('fps',{visible:e.target.checked})}/><span><b>{t('Show FPS counter')}</b></span></label>
    </section>
  </>;
}