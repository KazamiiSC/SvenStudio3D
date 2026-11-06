import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import type React from 'react';
import {createPortal} from 'react-dom';
import {Activity,ArrowRight,BookOpen,Box,CheckCircle2,CircleHelp,DoorClosed,GitBranch,Layers,MousePointer2,Plus,RotateCcw,Unlink2,Variable,AlertTriangle,X,ZoomIn,ZoomOut,Focus,LayoutGrid,Map as MapIcon,Search,CornerDownRight,Maximize2} from 'lucide-react';
import {useEditor} from '../store';
import {analyzeGameplay} from '../engine/gameplay';
import {filterGameplayNodes,gameplayGraphCategory,gameplayReferenceKind,getGameplayGraphConnections,layoutGameplayGraph,graphBounds,GRAPH_NODE_WIDTH as NW,GRAPH_NODE_HEIGHT as NH,type GraphPosition,type GraphCategory} from '../engine/gameplayGraph';
import type {PointEntity} from '../engine/types';
import {useT,type Locale} from '../i18n';
import {EntityAssistant} from './EntityAssistant';
import {localizedGuideForClass} from '../engine/entityGuide';
import {entityDisplayName,connectionSearchText} from '../engine/entityNaming';

const GAMEPLAY_GUIDE_TEXT:Record<Locale,{open:string,title:string,close:string,subtitle:string,tip:string}>={
 es:{open:'Abrir guía ampliada',title:'Guía de entidad',close:'Cerrar guía',subtitle:'Opciones, ejemplos, sonidos y conexiones',tip:'Consultá la guía completa y configurá la entidad en una ventana más amplia.'},
 en:{open:'Open full guide',title:'Entity guide',close:'Close guide',subtitle:'Options, examples, sounds and connections',tip:'Read and edit this entity in a larger, more readable window.'},
 ru:{open:'Открыть большую справку',title:'Справка сущности',close:'Закрыть справку',subtitle:'Параметры, примеры, звуки и связи',tip:'Откройте справку и настройте сущность в большом окне.'},
 ko:{open:'큰 가이드 열기',title:'엔티티 가이드',close:'가이드 닫기',subtitle:'설정, 예시, 소리 및 연결',tip:'큰 창에서 엔티티 설명을 읽고 설정할 수 있습니다.'},
 zh:{open:'打开完整指南',title:'实体指南',close:'关闭指南',subtitle:'设置、示例、声音和连接',tip:'在更大的窗口中查看并编辑实体设置。'},
 pt:{open:'Abrir guia ampliado',title:'Guia da entidade',close:'Fechar guia',subtitle:'Opções, exemplos, sons e conexões',tip:'Leia e edite a entidade em uma janela maior.'},
};
const MIN_ZOOM=.16,MAX_ZOOM=1.65;
const colorOf=(e:PointEntity)=>e.classname.startsWith('func_')?'#66d8fd':e.classname.startsWith('trigger_')?'#a78dff':e.classname.startsWith('monster_')?'#fb708f':'#72dfba';
const limit=(x:number,min:number,max:number)=>Math.max(min,Math.min(max,x));
function Editable({label,value,onCommit,type='text'}:{label:string;value:string;onCommit:(value:string)=>void;type?:string}){
 const [draft,setDraft]=useState(value);
 useEffect(()=>setDraft(value),[value]);
 return <label className="gs-input"><span>{label}</span><input type={type} value={draft} onChange={e=>setDraft(e.target.value)} onBlur={()=>{if(value!==draft)onCommit(draft)}} onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();e.stopPropagation()}}/></label>;
}
export function GameplayStudio({onClose}:{onClose:()=>void}){
 const t=useT();
 const locale=useEditor(s=>s.locale) as Locale;
 const guideText=GAMEPLAY_GUIDE_TEXT[locale]||GAMEPLAY_GUIDE_TEXT.en;
 const fgdClasses=useEditor(s=>s.fgdClasses);
 const [guideOpen,setGuideOpen]=useState(false);
 const project=useEditor(s=>s.project),selected=useEditor(s=>s.selected);
 const setSelected=useEditor(s=>s.setSelected),setProp=useEditor(s=>s.setObjectProp);
 const tie=useEditor(s=>s.tieGameplayBrush),relay=useEditor(s=>s.createGameplayRelay);
 const addDemo=useEditor(s=>s.addGameplayDemo),connect=useEditor(s=>s.connectGameplay),disconnect=useEditor(s=>s.disconnectGameplay);
 const setGraphPosition=useEditor(s=>s.setGraphPosition),setGraphPositions=useEditor(s=>s.setGraphPositions);
 const undo=useEditor(s=>s.undo);
 const objects=project.objects;
 const entities=useMemo(()=>objects.filter((o):o is PointEntity=>o.kind==='entity'),[objects]);
 const edges=useMemo(()=>getGameplayGraphConnections(objects),[objects]);
 const warnings=useMemo(()=>analyzeGameplay(objects),[objects]);
 const defaultPositions=useMemo(()=>layoutGameplayGraph(entities,edges),[entities,edges]);
 const [draggingPos,setDraggingPos]=useState<Record<string,GraphPosition>>({});
 const [active,setActive]=useState<string|null>(null),[source,setSource]=useState<string|null>(null);
 const [showAll,setShowAll]=useState(true),[focused,setFocused]=useState(false);
 const [search,setSearch]=useState(''),[category,setCategory]=useState<GraphCategory>('all');
 const [zoom,setZoom]=useState(1),[notice,setNotice]=useState('');
 const [showMinimap,setShowMinimap]=useState(true),[panning,setPanning]=useState(false);
 const [view,setView]=useState({left:0,top:0,width:850,height:500});
 const [previousLayout,setPreviousLayout]=useState<Record<string,[number,number]>|null>(null);
 const stageRef=useRef<HTMLDivElement>(null);
 const dragRef=useRef<{id:string;startX:number;startY:number;origin:GraphPosition;zoom:number}|null>(null);
 const panRef=useRef<{startX:number;startY:number;left:number;top:number}|null>(null);
 const positions=useMemo(()=>Object.fromEntries(entities.map(e=>{
  const p=draggingPos[e.id]||project.graphPositions?.[e.id]||[defaultPositions[e.id]?.x??50,defaultPositions[e.id]?.y??50];
  return [e.id,Array.isArray(p)?{x:p[0],y:p[1]}:p];
 })) as Record<string,GraphPosition>,[entities,draggingPos,project.graphPositions,defaultPositions]);
 const canvasWidth=useMemo(()=>Math.max(1500,...Object.values(positions).map(p=>p.x+NW+175)),[positions]);
 const canvasHeight=useMemo(()=>Math.max(950,...Object.values(positions).map(p=>p.y+NH+175)),[positions]);
 const selectedEntity=entities.find(e=>e.id===(active||selected));
 const selectedBrush=objects.find(o=>o.id===selected&&o.kind==='brush');
 const selectedDefinition=selectedEntity?fgdClasses.find(c=>c.name===selectedEntity.classname):undefined;
 const selectedGuide=selectedEntity?localizedGuideForClass(selectedEntity.classname,selectedDefinition,locale):null;
 useEffect(()=>{setGuideOpen(false)},[selectedEntity?.id]);
 const visible=useMemo(()=>filterGameplayNodes(entities,edges,{query:'',category,onlyReferenced:!showAll,neighborhood:focused?(active||selected):null}).filter(e=>!search.trim()||connectionSearchText(e,objects).includes(search.trim().toLocaleLowerCase())),[entities,edges,objects,search,category,showAll,focused,active,selected]);
 const visibleSet=useMemo(()=>new Set(visible.map(e=>e.id)),[visible]);
 const graphEdges=useMemo(()=>edges.filter(e=>visibleSet.has(e.from)&&visibleSet.has(e.to)),[edges,visibleSet]);
 const edgeCounts=useMemo(()=>{const m=new Map<string,number>();for(const edge of edges)m.set(edge.from,(m.get(edge.from)||0)+1);return m},[edges]);
 const choose=(id:string)=>{setActive(id);setSelected(id)};
 const getScrollable=useCallback(()=>stageRef.current,[]);
 const updateViewport=useCallback(()=>{
  const el=getScrollable();if(!el)return;
  setView({left:el.scrollLeft,top:el.scrollTop,width:el.clientWidth,height:el.clientHeight});
 },[getScrollable]);
 useEffect(()=>{
  const el=getScrollable();if(!el)return;
  const observer=new ResizeObserver(updateViewport);observer.observe(el);updateViewport();
  return()=>observer.disconnect();
 },[getScrollable,updateViewport]);
 const centerOn=useCallback((id:string)=>{
  const el=getScrollable(),p=positions[id];if(!el||!p)return;
  el.scrollTo({left:(p.x+NW/2)*zoom-el.clientWidth/2,top:(p.y+NH/2)*zoom-el.clientHeight/2});
 },[positions,zoom,getScrollable]);
 const fitNodes=useCallback((nodes:PointEntity[]=visible)=>{
  const el=getScrollable();if(!el)return;
  const bounds=graphBounds(nodes.map(e=>e.id),positions);
  const next=limit(Math.min((el.clientWidth-58)/(bounds.width+70),(el.clientHeight-52)/(bounds.height+70)),MIN_ZOOM,1.3);
  setZoom(next);
  requestAnimationFrame(()=>el.scrollTo({left:(bounds.minX+bounds.width/2)*next-el.clientWidth/2,top:(bounds.minY+bounds.height/2)*next-el.clientHeight/2}));
 },[getScrollable,positions,visible]);
 const fitRef=useRef(fitNodes);fitRef.current=fitNodes;
 useEffect(()=>{const id=requestAnimationFrame(()=>fitRef.current());return()=>cancelAnimationFrame(id)},[]);
 const adjustZoom=useCallback((nextValue:number,clientX?:number,clientY?:number)=>{
  const el=getScrollable();if(!el)return;
  const next=limit(nextValue,MIN_ZOOM,MAX_ZOOM),rect=el.getBoundingClientRect();
  const localX=clientX===undefined?el.clientWidth/2:clientX-rect.left;
  const localY=clientY===undefined?el.clientHeight/2:clientY-rect.top;
  const x=(el.scrollLeft+localX)/zoom,y=(el.scrollTop+localY)/zoom;
  setZoom(next);
  requestAnimationFrame(()=>el.scrollTo({left:x*next-localX,top:y*next-localY}));
 },[zoom,getScrollable]);
 useEffect(()=>{
  const el=getScrollable();if(!el)return;
  const handler=(e:WheelEvent)=>{e.preventDefault();adjustZoom(zoom*(e.deltaY>0?.89:1.12),e.clientX,e.clientY)};
  el.addEventListener('wheel',handler,{passive:false});return()=>el.removeEventListener('wheel',handler);
 },[zoom,getScrollable,adjustZoom]);
 useEffect(()=>{
  const onMove=(event:PointerEvent)=>{
   const drag=dragRef.current;
   if(drag){
    setDraggingPos(p=>({...p,[drag.id]:{x:limit(drag.origin.x+(event.clientX-drag.startX)/drag.zoom,12,99000),y:limit(drag.origin.y+(event.clientY-drag.startY)/drag.zoom,12,99000)}}));
    return;
   }
   const pan=panRef.current,el=stageRef.current;
   if(pan&&el)el.scrollTo({left:pan.left-(event.clientX-pan.startX),top:pan.top-(event.clientY-pan.startY)});
  };
  const onUp=(event:PointerEvent)=>{
   const drag=dragRef.current;
   if(drag){
    const pos:[number,number]=[Math.round(limit(drag.origin.x+(event.clientX-drag.startX)/drag.zoom,12,99000)),Math.round(limit(drag.origin.y+(event.clientY-drag.startY)/drag.zoom,12,99000))];
    setGraphPosition(drag.id,pos);
    setDraggingPos(p=>{const next={...p};delete next[drag.id];return next});dragRef.current=null;
   }
   panRef.current=null;setPanning(false);
  };
  window.addEventListener('pointermove',onMove);window.addEventListener('pointerup',onUp);window.addEventListener('pointercancel',onUp);
  return()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',onUp);window.removeEventListener('pointercancel',onUp)};
 },[setGraphPosition]);
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{
   const editing=e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement||(e.target instanceof HTMLElement&&e.target.isContentEditable);
   if(e.key==='Escape'){
    if(guideOpen){e.preventDefault();e.stopPropagation();setGuideOpen(false);return;}
    if(editing)return;
    e.preventDefault();e.stopPropagation();if(source)setSource(null);else onClose();return;
   }
   if(editing||e.ctrlKey||e.altKey||e.metaKey)return;
   if(e.key.toLowerCase()==='f'&&selectedEntity){e.preventDefault();centerOn(selectedEntity.id)}
   if(e.key.toLowerCase()==='a'){e.preventDefault();fitNodes()}
  };
  window.addEventListener('keydown',onKey,true);return()=>window.removeEventListener('keydown',onKey,true);
 },[source,onClose,selectedEntity,centerOn,fitNodes,guideOpen]);
 const act=(action:()=>void)=>{try{action();setNotice('')}catch(error){setNotice(String(error instanceof Error?error.message:error))}};
 const beginSource=(id:string)=>{setSource(id);choose(id);setNotice('')};
 const endTarget=(id:string)=>{
  if(!source){choose(id);return;}
  if(source===id){setSource(null);return;}
  const from=entities.find(e=>e.id===source),dest=entities.find(e=>e.id===id);
  if(from&&dest){
   const kind=gameplayReferenceKind(from);
   if(kind!=='reference'&&!window.confirm(t('This target has a special meaning for this entity. Change it anyway?'))){setSource(null);return;}
   const matching=entities.filter(e=>e.props.targetname?.trim()&&e.props.targetname.trim()===dest.props.targetname?.trim());
   if(matching.length>1&&!window.confirm(t('Several entities share this targetname. The link may affect all of them. Continue?'))){setSource(null);return;}
  }
  try{connect(source,id)}catch(error){
   const msg=String(error instanceof Error?error.message:error);
   if(msg.includes('already targets')&&window.confirm(`${msg}\n\n${t('Replace existing connection?')}`))act(()=>connect(source,id,true));
   else setNotice(msg);
  }
  setSource(null);choose(id);
 };
 const convert=(type:'func_door'|'func_button')=>{
  if(!selectedBrush){setNotice(t('Select an unassigned brush in the 3D viewport first.'));return;}
  act(()=>{tie(selectedBrush.id,type);setActive(null)});
 };
 const addRelay=()=>{const o=objects.find(o=>o.id===selected);act(()=>{relay(o?[o.position[0],o.position[1],o.position[2]+48]:[0,0,96]);setActive(null)})};
 const autoArrange=()=>{
  const before=Object.fromEntries(entities.map(e=>{const p=positions[e.id];return [e.id,[Math.round(p.x),Math.round(p.y)]]})) as Record<string,[number,number]>;
  const arranged=layoutGameplayGraph(entities,edges);
  setPreviousLayout(before);
  setGraphPositions(Object.fromEntries(entities.map(e=>[e.id,[arranged[e.id].x,arranged[e.id].y]])) as Record<string,[number,number]>);
  setNotice('');requestAnimationFrame(()=>fitRef.current(entities));
 };
 const restoreLayout=()=>{if(!previousLayout)return;setGraphPositions(previousLayout);setPreviousLayout(null);requestAnimationFrame(()=>fitRef.current())};
 const beginPan=(event:React.PointerEvent<HTMLDivElement>)=>{
  if(event.button!==1&&event.button!==0)return;
  if((event.target as HTMLElement).closest('.gs-node'))return;
  const el=stageRef.current;if(!el)return;
  panRef.current={startX:event.clientX,startY:event.clientY,left:el.scrollLeft,top:el.scrollTop};
  setPanning(true);event.preventDefault();
 };
 const jumpMini=(event:React.MouseEvent<SVGSVGElement>)=>{
  const el=getScrollable();if(!el)return;
  const rect=event.currentTarget.getBoundingClientRect();
  const x=(event.clientX-rect.left)/rect.width*canvasWidth,y=(event.clientY-rect.top)/rect.height*canvasHeight;
  el.scrollTo({left:x*zoom-el.clientWidth/2,top:y*zoom-el.clientHeight/2});
 };
 const categoryOptions:[GraphCategory,string][]=[['all','All entities'],['logic','Triggers and logic'],['brush','Brush entities'],['ai','NPCs and paths'],['camera','Camera entities'],['audio','Audio entities'],['other','Other entities']];
 return <div className="modal-backdrop gs-backdrop" onMouseDown={onClose}>
  <div className="gs-shell" role="dialog" aria-modal="true" aria-label="Gameplay Studio" onMouseDown={e=>e.stopPropagation()}>
   <header className="gs-topbar">
    <span className="gs-logo"><GitBranch size={20}/></span><div><strong>{t('Gameplay Studio')}</strong><small>Svengine · target → targetname · Valve 220</small></div>
    <span className="gs-top-count"><Activity size={14}/>{entities.length} {t('entities')} · {edges.length} {t('connections')}</span>
    <button title={t('Undo')} onClick={undo}><RotateCcw size={17}/></button><button title={t('Close')} onClick={onClose}><X size={20}/></button>
   </header>
   <div className="gs-layout">
    <aside className="gs-sidebar">
     <h3><Box size={15}/>{t('Quick gameplay tools')}</h3>
     <p>{t('Select a free brush in the 3D viewport, then convert it into a Svengine brush entity.')}</p>
     <button onClick={()=>convert('func_door')}><DoorClosed size={18}/><span>{t('Create sliding door')}<small>func_door</small></span><Plus size={14}/></button>
     <button onClick={()=>convert('func_button')}><MousePointer2 size={18}/><span>{t('Create button')}<small>func_button · spawnflags 1</small></span><Plus size={14}/></button>
     <button onClick={addRelay}><GitBranch size={18}/><span>{t('Create relay')}<small>trigger_relay</small></span><Plus size={14}/></button>
     <div className="gs-section-line"/>
     <button className="gs-demo" onClick={()=>act(addDemo)}><CheckCircle2 size={18}/><span>{t('Add playable example')}<small>func_button → trigger_relay → func_door</small></span></button>
     <p>{t('The example adds new brushes inside the room. It does not cut a doorway into an existing wall.')}</p>
     <div className="gs-section-line"/>
     <h3><CircleHelp size={15}/>{t('Connecting nodes')}</h3>
     <p>{t('Click the output circle on a source node, then the input circle on its target. The link is saved as real target / targetname keyvalues.')}</p>
     <p className="gs-special-note">{t('Not every target is an activation: cameras, routes, and other entities use target differently.')}</p>
     {source&&<button className="gs-cancel" onClick={()=>setSource(null)}>{t('Cancel connection')} <X size={14}/></button>}
     <label className="gs-checkbox"><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/> {t('Show all entities')}</label>
     <label className="gs-checkbox"><input type="checkbox" checked={focused} disabled={!active&&!selected} onChange={e=>setFocused(e.target.checked)}/> {t('Selected entity and neighbors')}</label>
     <p className="gs-navigation-help">{t('Wheel: zoom · drag empty space or middle mouse: pan · F: selected · A: fit graph')}</p>
    </aside>
    <main className="gs-center">
     <div className="gs-canvas-tools">
      <span><GitBranch size={14}/>{t('Visual Trigger Editor')}</span>
      <div className="gs-search-field"><Search size={13}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder={t('Search classname, name, target or layer')} aria-label={t('Search entities')}/>{search&&<button onClick={()=>setSearch('')} title={t('Clear search')}><X size={12}/></button>}</div>
      <select className="gs-filter" value={category} aria-label={t('Entity category')} onChange={e=>setCategory(e.target.value as GraphCategory)}>{categoryOptions.map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select>
      <div className="gs-zoom">
       <button onClick={autoArrange} title={t('Auto arrange all nodes')}><LayoutGrid size={16}/></button>
       {previousLayout&&<button onClick={restoreLayout} title={t('Restore previous layout')}><RotateCcw size={15}/></button>}
       <button onClick={()=>fitNodes()} title={t('Fit visible nodes')}><Focus size={16}/></button>
       <button onClick={()=>selectedEntity&&centerOn(selectedEntity.id)} disabled={!selectedEntity} title={t('Center selected node')}><CornerDownRight size={16}/></button>
       <button onClick={()=>setShowMinimap(v=>!v)} title={t('Toggle minimap')} className={showMinimap?'gs-tool-active':''}><MapIcon size={16}/></button>
       <button onClick={()=>adjustZoom(zoom/1.14)} title={t('Zoom out')}><ZoomOut size={16}/></button><b>{Math.round(zoom*100)}%</b><button onClick={()=>adjustZoom(zoom*1.14)} title={t('Zoom in')}><ZoomIn size={16}/></button>
      </div>
     </div>
     <div className="gs-graph-summary">{visible.length} / {entities.length} {t('visible entities')} · {graphEdges.length} {t('visible connections')} · {source?t('Choose a destination node…'):t('Drag nodes by their headers')}</div>
     <div className={`gs-viewport ${panning?'is-panning':''}`} ref={stageRef} onScroll={updateViewport} onPointerDown={beginPan}>
      <div className="gs-stage" style={{width:canvasWidth*zoom,height:canvasHeight*zoom}}>
       <div className="gs-world" style={{width:canvasWidth,height:canvasHeight,transform:`scale(${zoom})`,transformOrigin:'top left'}}>
        <svg className="gs-wires" width={canvasWidth} height={canvasHeight} aria-hidden="true">
         <defs><marker id="gs-wire-arrow" markerWidth="5" markerHeight="5" refX="4" refY="2.5" orient="auto"><path d="M 0 0 L 5 2.5 L 0 5 z" fill="#80c0c7"/></marker></defs>
         {graphEdges.map((edge,i)=>{
          const from=positions[edge.from],to=positions[edge.to],src=entities.find(e=>e.id===edge.from);
          if(!from||!to||!src)return null;
          const kind=gameplayReferenceKind(src),shade=edge.via==='moveto'?'#cf9efa':edge.via==='killtarget'?'#f49f99':edge.via==='master'?'#eecb83':kind==='path'?'#94b4f7':kind==='look'?'#ffd28f':'#66cbbf';
          const dx=Math.max(65,Math.abs(to.x-from.x-NW)*.48);
          const highlighted=!!active&&(active===edge.from||active===edge.to);
          return <path key={`${edge.from}:${edge.to}:${edge.via}:${i}`} d={`M ${from.x+NW} ${from.y+62} C ${from.x+NW+dx} ${from.y+62}, ${to.x-dx} ${to.y+62}, ${to.x} ${to.y+62}`} stroke={highlighted?'#f6fcff':shade} strokeWidth={highlighted?3.2:2.1} strokeOpacity={active&&!highlighted?.13:.77} strokeDasharray={edge.via==='target'?undefined:'6 5'} fill="none" markerEnd="url(#gs-wire-arrow)"/>;
         })}
        </svg>
        {visible.map(e=>{
         const pos=positions[e.id],color=colorOf(e),linked=edgeCounts.get(e.id)||0;
         return <div className={`gs-node ${active===e.id?'is-active':''} ${source===e.id?'is-source':''}`} key={e.id} style={{left:pos?.x||0,top:pos?.y||0,'--node-color':color} as React.CSSProperties}>
          <button className="gs-port gs-in" title={t('Connect to this input')} onClick={()=>endTarget(e.id)}><span/></button>
          <div className="gs-node-head" onPointerDown={event=>{
           if(event.button!==0||!pos)return;
           dragRef.current={id:e.id,startX:event.clientX,startY:event.clientY,origin:pos,zoom};event.preventDefault();choose(e.id);
          }} onClick={()=>choose(e.id)}>
           <span className="gs-node-icon"><Variable size={16}/></span><strong title={e.classname}>{e.classname}</strong><small>{linked>0?linked:''}</small>
          </div>
          <div className="gs-node-body" onClick={()=>choose(e.id)}><span>{entityDisplayName(e,objects)}</span><small title={e.props.target||''}>{e.props.target?`→ ${e.props.target}`:t('No outgoing target')}</small></div>
          <button className="gs-port gs-out" title={t('Connect this output')} onClick={()=>beginSource(e.id)}><span/></button>
         </div>;
        })}
        {!visible.length&&<div className="gs-no-results">{t('No entities match the current filters.')} <button onClick={()=>{setSearch('');setCategory('all');setFocused(false);setShowAll(true)}}>{t('Clear filters')}</button></div>}
       </div>
      </div>
     </div>
     {showMinimap&&<div className="gs-minimap" title={t('Click minimap to navigate')}>
      <div className="gs-minimap-title"><MapIcon size={12}/>{t('Minimap')}</div>
      <svg viewBox="0 0 190 124" onClick={jumpMini} aria-label={t('Click minimap to navigate')} role="img">
       <rect width="190" height="124" fill="#0b1b2d"/>
       {visible.map(e=>{
        const p=positions[e.id];if(!p)return null;
        return <rect key={e.id} x={p.x/canvasWidth*190} y={p.y/canvasHeight*124} width={Math.max(2,NW/canvasWidth*190)} height={Math.max(1.6,NH/canvasHeight*124)} rx="1" fill={active===e.id?'#fff6a6':colorOf(e)} opacity=".9"/>;
       })}
       <rect x={view.left/zoom/canvasWidth*190} y={view.top/zoom/canvasHeight*124} width={Math.min(190,view.width/zoom/canvasWidth*190)} height={Math.min(124,view.height/zoom/canvasHeight*124)} fill="#91d1ff1a" stroke="#c6e5ff" strokeWidth="1.2" pointerEvents="none"/>
      </svg>
     </div>}
    </main>
    <aside className="gs-inspector">
     <h3><Layers size={16}/>{t('Gameplay Inspector')}</h3>
     {selectedEntity?<>
      <div className="gs-entity-title"><span className="gs-entity-dot" style={{background:colorOf(selectedEntity)}}/><strong>{selectedEntity.classname}</strong><small>{entityDisplayName(selectedEntity,objects)}</small></div>
      <div className="gs-entity-tools"><button onClick={()=>centerOn(selectedEntity.id)}><Focus size={14}/>{t('Locate node')}</button><span>{t(gameplayGraphCategory(selectedEntity)==='ai'?'NPCs and paths':gameplayGraphCategory(selectedEntity)==='brush'?'Brush entities':gameplayGraphCategory(selectedEntity)==='logic'?'Triggers and logic':gameplayGraphCategory(selectedEntity)==='camera'?'Camera entities':gameplayGraphCategory(selectedEntity)==='audio'?'Audio entities':'Other entities')}</span></div>
      <section className="gs-guide-preview" aria-label={guideText.title}>
       <div className="gs-guide-preview-title"><BookOpen size={15}/><strong>{guideText.title}</strong><small>{selectedEntity.classname}</small></div>
       <p title={selectedGuide?.summary}>{selectedGuide?.summary||guideText.tip}</p>
       <button type="button" className="gs-guide-expand" onClick={()=>setGuideOpen(true)} aria-haspopup="dialog" aria-label={`${guideText.open}: ${selectedEntity.classname}`}><Maximize2 size={15}/>{guideText.open}</button>
      </section>
      <Editable label="targetname" value={selectedEntity.props.targetname||''} onCommit={v=>setProp(selectedEntity.id,'targetname',v)}/>
      <Editable label="target" value={selectedEntity.props.target||''} onCommit={v=>setProp(selectedEntity.id,'target',v)}/>
      {selectedEntity.props.target&&<p className="gs-special-note">{gameplayReferenceKind(selectedEntity)==='path'?t('This target is the next path point.'):gameplayReferenceKind(selectedEntity)==='look'?t('This target is the camera look-at reference.'):t('A target may represent different behavior depending on classname.')}</p>}
      {(['speed','wait','lip','angle','delay','triggerstate'] as const).filter(key=>key in selectedEntity.props).map(key=><Editable key={key} label={key} value={selectedEntity.props[key]||''} onCommit={v=>setProp(selectedEntity.id,key,v)}/>)}
      <button className="gs-unlink" disabled={!selectedEntity.props.target} onClick={()=>act(()=>disconnect(selectedEntity.id))}><Unlink2 size={15}/>{t('Clear outgoing connection')}</button>
      <p>{t('All edits are saved in the map project and exported as Svengine keyvalues.')}</p>
     </>:<div className="gs-inspector-empty"><MousePointer2 size={26}/><p>{t('Select a node to inspect its keyvalues.')}</p></div>}
     <div className="gs-section-line"/>
     <h3><AlertTriangle size={15}/>{t('Gameplay validation')} <b>{warnings.length}</b></h3>
     <div className="gs-issues">{warnings.length===0?<p className="gs-good"><CheckCircle2 size={16}/>{t('No gameplay reference issues detected.')}</p>:warnings.map((issue,i)=><button key={`${issue.entityId||''}:${i}`} className={`gs-issue ${issue.severity}`} onClick={()=>{if(issue.entityId){choose(issue.entityId);centerOn(issue.entityId)}}}><AlertTriangle size={14}/>{issue.message}</button>)}</div>
     {notice&&<div className="gs-error" role="alert">{notice}</div>}
    </aside>
   </div>
   <footer className="gs-footer"><span><CheckCircle2 size={14}/>{t('Graph layout and filters do not change GoldSrc entities or MAP export.')}</span><span>{t('Export and compile normally with SC-CSG / BSP / VIS / RAD')} <ArrowRight size={14}/></span></footer>
  </div>
  {guideOpen&&selectedEntity&&createPortal(
   <div className="gs-guide-overlay" onMouseDown={event=>{event.stopPropagation();if(event.target===event.currentTarget)setGuideOpen(false)}}>
    <section className="gs-guide-dialog" role="dialog" aria-modal="true" aria-labelledby="gs-guide-heading" onMouseDown={event=>event.stopPropagation()}>
     <header className="gs-guide-header">
      <span className="gs-guide-header-icon"><BookOpen size={21}/></span>
      <div><h2 id="gs-guide-heading">{guideText.title} · {selectedEntity.classname}</h2><p>{guideText.subtitle}</p></div>
      <button type="button" onClick={()=>setGuideOpen(false)} aria-label={guideText.close} title={guideText.close}><X size={20}/></button>
     </header>
     <div className="gs-guide-body">
      <EntityAssistant key={`gameplay-guide-${selectedEntity.id}`} entity={selectedEntity} definition={selectedDefinition} initiallyOpen/>
     </div>
     <footer className="gs-guide-footer"><span>{guideText.tip}</span><button type="button" onClick={()=>setGuideOpen(false)}>{guideText.close}</button></footer>
    </section>
   </div>,document.body)}
 </div>;
}
