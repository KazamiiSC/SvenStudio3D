import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Activity,AlertTriangle,ArrowRight,BookOpen,CheckCircle2,ChevronLeft,ChevronRight,DoorOpen,Eye,Focus,GitBranch,Layers,ListFilter,Map as MapIcon,MousePointerClick,Plus,RotateCcw,Search,Unlink2,Users,X,ZoomIn,ZoomOut,Play,Route,Compass,PanelRightClose} from 'lucide-react';
import {useEditor} from '../store';
import type {Brush,MapObject,PointEntity,FgdClass} from '../engine/types';
import {analyzeGameplay} from '../engine/gameplay';
import {gameplayGraphCategory,getGameplayGraphConnections,gameplayReferenceKind,type GraphCategory} from '../engine/gameplayGraph';
import {buildGameplayWorkspaceIndex,traceGameplayReferences} from '../engine/gameplayWorkspace';
import {buildDesignZones,buildDesignInteractions,filterDesignEntities,type ProjectionMode} from '../engine/gameplayDesigner';
import {brushMapOutline,brushIntersectsHeight,gameplayOutlineBounds,getGameplayMapBrushes,groupMapMarkers,inHeightSlice,mapWorldToScreen,mapZoomAt,projectMapPoint,type MapOutline} from '../engine/gameplayMap2d';
import {EntityAssistant} from './EntityAssistant';
import {FgdLoadControl} from './FgdLoadControl';
import {localizedGuideForClass} from '../engine/entityGuide';
import {entityDisplayName} from '../engine/entityNaming';
import './gameplayDesigner.css';

type Page='map'|'events'|'lab';
type ViewState={cx:number;cy:number;scale:number};
const ITEM_PAGE=35;
const categoryOptions:[GraphCategory,string,string][]=[['all','Todas','All'],['logic','Lógica y triggers','Logic & triggers'],['brush','Puertas y brushes','Brush entities'],['ai','NPC y rutas','NPCs & paths'],['camera','Cámaras','Cameras'],['audio','Sonidos','Sound'],['other','Otras','Other']];
const tone=(e:PointEntity)=>({logic:'#c0a1ff',brush:'#63dbed',ai:'#f5ac78',camera:'#73b7ff',audio:'#76ddb4',other:'#91a3cc'})[gameplayGraphCategory(e)];
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
function InlineEdit({label,value,commit}:{label:string;value:string;commit:(value:string)=>void}){
 const [draft,setDraft]=useState(value);useEffect(()=>setDraft(value),[value]);
 return <label className="gds-edit"><span>{label}</span><input value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{e.stopPropagation();if(e.key==='Enter')e.currentTarget.blur()}} onBlur={()=>{if(draft!==value)commit(draft)}}/></label>;
}
/** Uses the original project keyvalues and the shared FGD definitions. Only the
 * currently selected entity is rendered; no per-class guide or control tree is
 * generated for thousands of entities. */
function GameplayEntityFields({entity,definition,setProp,es}:{entity:PointEntity;definition?:FgdClass;setProp:(id:string,key:string,value:string)=>void;es:boolean}){
 const [advanced,setAdvanced]=useState(false),[search,setSearch]=useState('');
 useEffect(()=>{setAdvanced(false);setSearch('')},[entity.id]);
 const fields=useMemo(()=>{
  const definitions=definition?.props||{};
  return Array.from(new Set([...Object.keys(entity.props),...Object.keys(definitions)]))
   .filter(key=>!['targetname','target','speed','wait','delay','lip','angle','triggerstate'].includes(key))
   .filter(key=>advanced||key in entity.props&&(['spawnflags','health','dmg','damage','message','model','sounds','renderamt','rendermode','rendercolor','master','netname','spawnobject','monster_type','monstercount'].includes(key)))
   .filter(key=>!search||`${key} ${definitions[key]?.label||''}`.toLowerCase().includes(search.toLowerCase()));
 },[definition,entity.props,advanced,search]);
 return <section className="gds-inspector-section gds-native-fields">
  <h4>{es?'PROPIEDADES FGD':'FGD PROPERTIES'} <span>{fields.length}</span></h4>
  <FgdLoadControl compact/>
  <div className="gds-field-actions">
   <button className={!advanced?'active':''} onClick={()=>setAdvanced(false)}>{es?'Básico':'Basic'}</button>
   <button className={advanced?'active':''} onClick={()=>setAdvanced(true)}>{es?'Avanzado':'Advanced'}</button>
  </div>
  {advanced&&<input className="gds-key-search" type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={es?'Buscar keyvalue…':'Search keyvalue…'} aria-label="Search FGD keyvalues"/>}
  {fields.map(key=>{const field=definition?.props[key];const value=entity.props[key]??field?.defaultValue??'';
   if(field?.type==='flags'&&field.options?.length)return <div key={`${entity.id}:${key}`} className="gds-flags"><strong>{field.label||key} ({key})</strong>{field.options.map(option=>{const bit=Number(option.value)||0;return <label key={option.value}><input type="checkbox" checked={(Number(value)&bit)!==0} onChange={e=>{const before=Number(value)||0;setProp(entity.id,key,String(e.target.checked?before|bit:before&~bit))}}/>{option.label}</label>})}</div>;
   if(field?.type==='choices'&&field.options?.length)return <label key={`${entity.id}:${key}`} className="gds-edit"><span title={key}>{field.label||key}</span><select value={value} onChange={e=>setProp(entity.id,key,e.target.value)}>{!field.options.some(o=>o.value===value)&&<option value={value}>{value||'—'}</option>}{field.options.map(o=><option key={o.value} value={o.value}>{o.label} ({o.value})</option>)}</select></label>;
   return <InlineEdit key={`${entity.id}:${key}`} label={field?.label||key} value={value} commit={v=>setProp(entity.id,key,v)}/>;
  })}
  {!fields.length&&<p className="gds-empty">{es?'No hay más propiedades en este modo. Elegí Avanzado para ver el FGD completo.':'No more properties in this mode. Choose Advanced for the full FGD.'}</p>}
 </section>;
}
function OverviewCanvas({objects,entities,visible,links,selectedId,onSelect,onClear,projection,zoneIds,zoneKey,focusNonce}:{objects:MapObject[];entities:PointEntity[];visible:PointEntity[];links:ReturnType<typeof getGameplayGraphConnections>;selectedId:string|null;onSelect:(id:string)=>void;onClear:()=>void;projection:ProjectionMode;zoneIds:Set<string>|null;zoneKey:string|null;focusNonce:number}){
 const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null);
 const [size,setSize]=useState({width:940,height:570});
 const [view,setView]=useState<ViewState>({cx:0,cy:0,scale:1});
 const [heightMode,setHeightMode]=useState<'all'|'selected'|'custom'>('all');
 const [heightCenter,setHeightCenter]=useState(0),[heightRange,setHeightRange]=useState(128);
 const [showGeometry,setShowGeometry]=useState(true),[relatedOnly,setRelatedOnly]=useState(false);
 const [stack,setStack]=useState<{x:number;y:number;members:string[]}|null>(null);
 const [stackQuery,setStackQuery]=useState(''),[stackPage,setStackPage]=useState(0);
 const drag=useRef<{x:number;y:number;cx:number;cy:number;scale:number;moved:boolean}|null>(null);
 const ignoreFocus=useRef(false);
 const entityById=useMemo(()=>new Map(entities.map(e=>[e.id,e])),[entities]);
 const selectedEntity=selectedId?entityById.get(selectedId):undefined;
 const sliceZ=heightMode==='selected'?selectedEntity?.position[2]??heightCenter:heightCenter;
 const subset=useMemo(()=>zoneIds?visible.filter(e=>zoneIds.has(e.id)):visible,[visible,zoneIds]);
 const relevantIds=useMemo(()=>{
  if(!relatedOnly||!selectedId)return null;
  const ids=new Set([selectedId]);for(const l of links)if(l.from===selectedId||l.to===selectedId){ids.add(l.from);ids.add(l.to)}return ids;
 },[links,relatedOnly,selectedId]);
 const shownEntities=useMemo(()=>subset.filter(e=>(heightMode==='all'||inHeightSlice(e.position[2],sliceZ,heightRange))&&(!relevantIds||relevantIds.has(e.id))),[subset,heightMode,sliceZ,heightRange,relevantIds]);
 const geometry=useMemo(()=>getGameplayMapBrushes(objects),[objects]);
 const outlines=useMemo(()=>geometry.map(b=>brushMapOutline(b,projection)).filter((o):o is MapOutline=>o!==null),[geometry,projection]);
 const visibleOutlines=useMemo(()=>heightMode==='all'?outlines:outlines.filter(o=>brushIntersectsHeight(o,sliceZ,heightRange)),[outlines,heightMode,sliceZ,heightRange]);
 const bounds=useMemo(()=>gameplayOutlineBounds(visibleOutlines,shownEntities,projection),[visibleOutlines,shownEntities,projection]);
 const fit=useCallback(()=>{
  const spanX=Math.max(100,bounds.maxX-bounds.minX),spanY=Math.max(100,bounds.maxY-bounds.minY);
  setView({cx:(bounds.minX+bounds.maxX)/2,cy:(bounds.minY+bounds.maxY)/2,scale:clamp(Math.min((size.width-75)/spanX,(size.height-75)/spanY),.025,8)});
 },[bounds,size]);
 const fitRef=useRef(fit);fitRef.current=fit;
 useEffect(()=>{const el=container.current;if(!el)return;
  const read=()=>setSize(prev=>{const width=Math.max(120,el.clientWidth),height=Math.max(120,el.clientHeight);return prev.width===width&&prev.height===height?prev:{width,height}});
  read();const obs=new ResizeObserver(read);obs.observe(el);return()=>obs.disconnect();
 },[]);
 // Fit when switching projections, selecting a sector, or resizing the viewport—not every time a remote map brush changes.
 useEffect(()=>{fitRef.current();setStack(null)},[projection,zoneKey,size.width,size.height]);
 useEffect(()=>{if(!selectedEntity)return;if(ignoreFocus.current){ignoreFocus.current=false;return}
  const p=projectMapPoint(selectedEntity.position,projection);setView(v=>(Math.abs(v.cx-p[0])+Math.abs(v.cy-p[1])<.001?v:{...v,cx:p[0],cy:p[1]}));
 },[selectedId,projection,focusNonce]);
 const screen=useCallback((p:readonly [number,number])=>mapWorldToScreen(p,view,size.width,size.height),[view,size]);
 const projected=useMemo(()=>shownEntities.map(entity=>({entity,point:projectMapPoint(entity.position,projection)})),[shownEntities,projection]);
 const screenGroups=useMemo(()=>groupMapMarkers(projected.map(({entity,point})=>{const [x,y]=screen(point);return{id:entity.id,x,y,z:entity.position[2]}}),17),[projected,screen]);
 const shownCount=shownEntities.length;
 const stackCandidates=useMemo(()=>{
  if(!stack)return [];
  const q=stackQuery.trim().toLocaleLowerCase();
  return [...stack.members].sort((a,b)=>(entityById.get(b)?.position[2]||0)-(entityById.get(a)?.position[2]||0)||a.localeCompare(b))
   .filter(id=>{const e=entityById.get(id);return e&&(!q||[e.name,e.classname,e.props.targetname,e.props.target,String(Math.round(e.position[2]))].some(t=>(t||'').toLocaleLowerCase().includes(q)))});
 },[stack,stackQuery,entityById]);
 const stackPages=Math.max(1,Math.ceil(stackCandidates.length/35));
 useEffect(()=>{
  const el=canvas.current;if(!el)return;const ctx=el.getContext('2d');if(!ctx)return;
  const dpr=Math.min(2,window.devicePixelRatio||1);
  el.width=Math.round(size.width*dpr);el.height=Math.round(size.height*dpr);
  el.style.width=`${size.width}px`;el.style.height=`${size.height}px`;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const {width:w,height:h}=size;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#081827';ctx.fillRect(0,0,w,h);
  // World-space grid: fixed pixel stroke width; pan/zoom always recomputes from original world coordinates.
  let grid=64;while(grid*view.scale<38)grid*=2;while(grid*view.scale>135)grid/=2;
  const left=view.cx-w/(2*view.scale),right=view.cx+w/(2*view.scale),top=view.cy-h/(2*view.scale),bottom=view.cy+h/(2*view.scale);
  ctx.beginPath();ctx.strokeStyle='#254358';ctx.lineWidth=.7;
  for(let x=Math.ceil(left/grid)*grid;x<=right;x+=grid){const sx=screen([x,0])[0];ctx.moveTo(sx,0);ctx.lineTo(sx,h)}
  for(let y=Math.ceil(top/grid)*grid;y<=bottom;y+=grid){const sy=screen([0,y])[1];ctx.moveTo(0,sy);ctx.lineTo(w,sy)}ctx.stroke();
  if(showGeometry){
   // Real rotated/scaled footprints and silhouettes; never fake diamonds or clamp brush dimensions.
   // Distant outlines smaller than two pixels do not contribute legible information.
   ctx.strokeStyle=projection==='top'?'#355b6d':'#345568';ctx.lineWidth=.9;ctx.beginPath();
   const stride=Math.max(1,Math.ceil(visibleOutlines.length/9000));
   for(let i=0;i<visibleOutlines.length;i+=stride){const outline=visibleOutlines[i],b=outline.bounds;
    if(b.maxX<left||b.minX>right||b.maxY<top||b.minY>bottom)continue;
    if((b.maxX-b.minX)*view.scale<2&&(b.maxY-b.minY)*view.scale<2)continue;
    const coords=outline.polygon.map(screen);
    if(coords.length<2)continue;ctx.moveTo(coords[0][0],coords[0][1]);for(let j=1;j<coords.length;j++)ctx.lineTo(coords[j][0],coords[j][1]);ctx.closePath();
   }
   ctx.stroke();
  }
  if(selectedEntity){
   ctx.lineWidth=1.7;
   for(const l of links){if(l.from!==selectedId&&l.to!==selectedId)continue;
    const a=entityById.get(l.from),b=entityById.get(l.to);if(!a||!b)continue;
    const [x1,y1]=screen(projectMapPoint(a.position,projection)),[x2,y2]=screen(projectMapPoint(b.position,projection));
    ctx.strokeStyle=l.via==='target'?'#6ee1c3':'#eabb7c';ctx.setLineDash(l.via==='target'?[]:[5,4]);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
   }ctx.setLineDash([]);
  }
  const displayLabels=screenGroups.length<25&&view.scale>=.12;
  for(const g of screenGroups){const {x,y}=g;if(x<-22||y<-22||x>w+22||y>h+22)continue;
   const count=g.members.length,chosen=selectedId!==null&&g.members.includes(selectedId),first=entityById.get(g.members[0]);
   ctx.beginPath();ctx.arc(x,y,count>1?12:chosen?8:5,0,Math.PI*2);ctx.fillStyle=count>1?'#19495f':first?tone(first):'#83c3db';ctx.fill();
   ctx.lineWidth=chosen?3:1.5;ctx.strokeStyle=chosen?'#fff':count>1?'#7be3e5':'#102538';ctx.stroke();
   if(count>1){ctx.font='bold 11px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='#fff';ctx.fillText(count>99?'99+':String(count),x,y+.5);ctx.textAlign='left';ctx.textBaseline='alphabetic';}
   if(chosen||displayLabels&&count===1){const e=chosen?entityById.get(selectedId!):first;if(!e)continue;
    const txt=(e.props.targetname||e.name||e.classname).slice(0,30);ctx.font=chosen?'bold 12px system-ui':'10px system-ui';const tw=Math.min(200,ctx.measureText(txt).width+12),ly=y-28;
    ctx.fillStyle='#102d42ec';ctx.fillRect(x+12,ly,tw,20);ctx.strokeStyle=chosen?'#83f1d7':'#31556b';ctx.lineWidth=1;ctx.strokeRect(x+12,ly,tw,20);ctx.fillStyle='#e0f6ff';ctx.fillText(txt,x+18,ly+14);
   }
  }
  if(!shownEntities.length){ctx.font='14px system-ui';ctx.fillStyle='#87a9bd';ctx.textAlign='center';ctx.fillText('No hay entidades en este filtro',w/2,h/2);ctx.textAlign='left';}
 },[size,view,screen,visibleOutlines,projection,selectedEntity,selectedId,entityById,links,shownEntities.length,screenGroups,showGeometry]);
 const zoomAt=(factor:number,x:number,y:number)=>{setStack(null);setView(v=>mapZoomAt(v,factor,[x,y],size.width,size.height))};
 const selectAt=(x:number,y:number)=>{
  let nearest:typeof screenGroups[number]|undefined,dist=21*21;
  for(const group of screenGroups){const d=(x-group.x)**2+(y-group.y)**2;if(d<=dist){dist=d;nearest=group}}
  if(!nearest){setStack(null);onClear();return}
  if(nearest.members.length===1){setStack(null);ignoreFocus.current=selectedId!==nearest.members[0];onSelect(nearest.members[0]);return}
  setStackQuery('');setStackPage(0);setStack({x:clamp(nearest.x,12,Math.max(12,size.width-270)),y:clamp(nearest.y+16,12,Math.max(12,size.height-300)),members:nearest.members});
 };
 return <div className="gds-map-area" ref={container}>
  <canvas ref={canvas} role="img" aria-label="Spatial schematic gameplay map" onWheel={e=>{e.preventDefault();const r=e.currentTarget.getBoundingClientRect();zoomAt(e.deltaY<0?1.12:.89,e.clientX-r.left,e.clientY-r.top)}}
   onContextMenu={e=>{e.preventDefault();e.stopPropagation();setStack(null);drag.current=null;onClear()}}
   onPointerDown={e=>{if(e.button!==0){drag.current=null;return;}setStack(null);e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,cx:view.cx,cy:view.cy,scale:view.scale,moved:false}}}
   onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>5)d.moved=true;if(d.moved)setView(v=>({...v,cx:d.cx-dx/d.scale,cy:d.cy-dy/d.scale}));}}
   onPointerUp={e=>{if(e.button!==0){drag.current=null;return;}const d=drag.current;drag.current=null;if(d&&!d.moved){const r=e.currentTarget.getBoundingClientRect();selectAt(e.clientX-r.left,e.clientY-r.top)}}}
   onPointerCancel={()=>{drag.current=null}}/>
  <div className="gds-map-filters">
   <label>{'Altura Z'}<select aria-label="Filtrar entidades por altura" value={heightMode} onChange={e=>{setHeightMode(e.target.value as typeof heightMode);setStack(null)}}><option value="all">Todas</option><option value="selected">Nivel seleccionado</option><option value="custom">Rango Z</option></select></label>
   {heightMode!=='all'&&<><label>Z <input type="number" aria-label="Altura central" disabled={heightMode==='selected'&&!!selectedEntity} value={Math.round(sliceZ)} onChange={e=>setHeightCenter(Number(e.target.value)||0)}/></label><label>± <select aria-label="Margen de altura" value={heightRange} onChange={e=>setHeightRange(Number(e.target.value))}><option value={32}>32u</option><option value={64}>64u</option><option value={128}>128u</option><option value={256}>256u</option><option value={512}>512u</option></select></label></>}
   <button title="Mostrar u ocultar el esquema de los brushes" className={showGeometry?'active':''} onClick={()=>setShowGeometry(s=>!s)}>{showGeometry?'Mapa ✓':'Mapa'}</button>
   <button title="Mostrar únicamente la entidad seleccionada y sus referencias" className={relatedOnly?'active':''} onClick={()=>setRelatedOnly(s=>!s)}>Relacionadas{relatedOnly?' ✓':''}</button>
  </div>
  {stack&&<div className="gds-stack-menu" style={{left:stack.x,top:stack.y}} role="dialog" aria-label="Entidades superpuestas">
   <div className="gds-stack-head"><strong>{stack.members.length} entidades en esta posición</strong><button onClick={()=>setStack(null)} aria-label="Cerrar"><X size={14}/></button></div>
   <input className="gds-stack-search" type="search" aria-label="Buscar entidad superpuesta" placeholder="Nombre, classname, Z…" value={stackQuery} onChange={e=>{setStackQuery(e.target.value);setStackPage(0)}}/>
   <div className="gds-stack-list">{stackCandidates.slice(stackPage*35,(stackPage+1)*35).map(id=>{const e=entityById.get(id);return e?<button key={id} onClick={()=>{ignoreFocus.current=selectedId!==id;onSelect(id);setStack(null)}}><span className="gds-mini-dot" style={{background:tone(e)}}/><span><strong>{e.props.targetname||e.name||e.classname}</strong><small>{e.classname} · Z {Math.round(e.position[2])}</small></span></button>:null})}{!stackCandidates.length&&<p>Sin resultados.</p>}</div>
   {stackPages>1&&<div className="gds-stack-pages"><button disabled={stackPage===0} onClick={()=>setStackPage(n=>Math.max(0,n-1))}><ChevronLeft size={14}/></button><span>{stackPage+1} / {stackPages}</span><button disabled={stackPage+1>=stackPages} onClick={()=>setStackPage(n=>n+1)}><ChevronRight size={14}/></button></div>}
  </div>}
  <div className="gds-map-help">Rueda: zoom · arrastrar: mover · clic: seleccionar · grupos: elegir entidad</div>
  <div className="gds-map-zoom"><button onClick={()=>zoomAt(1.25,size.width/2,size.height/2)} title="Zoom in"><ZoomIn size={16}/></button><button onClick={()=>zoomAt(.8,size.width/2,size.height/2)} title="Zoom out"><ZoomOut size={16}/></button><button onClick={fit} title="Fit map"><Focus size={16}/></button></div>
  <span className="gds-map-count">{shownCount.toLocaleString()} / {entities.length.toLocaleString()} entidades · {screenGroups.length} indicadores</span>
 </div>;
}
export function GameplayStudio({onClose}:{onClose:()=>void}){
 const locale=useEditor(s=>s.locale),es=locale==='es';
 const project=useEditor(s=>s.project),selected=useEditor(s=>s.selected),select=useEditor(s=>s.setSelected);
 const setProp=useEditor(s=>s.setObjectProp),tie=useEditor(s=>s.tieGameplayBrush),relay=useEditor(s=>s.createGameplayRelay);
 const addDemo=useEditor(s=>s.addGameplayDemo),connect=useEditor(s=>s.connectGameplay),disconnect=useEditor(s=>s.disconnectGameplay),undo=useEditor(s=>s.undo);
 const fgdClasses=useEditor(s=>s.fgdClasses);
 const objects=project.objects;
 const entities=useMemo(()=>objects.filter((o):o is PointEntity=>o.kind==='entity'),[objects]);
 const byId=useMemo(()=>new Map(entities.map(e=>[e.id,e])),[entities]);
 const edges=useMemo(()=>getGameplayGraphConnections(objects),[objects]);
 const interactions=useMemo(()=>buildDesignInteractions(edges),[edges]);
 const warnings=useMemo(()=>analyzeGameplay(objects),[objects]);
 const workspace=useMemo(()=>buildGameplayWorkspaceIndex(objects,edges),[objects,edges]);
 const zones=useMemo(()=>buildDesignZones(entities,edges),[entities,edges]);
 const [page,setPage]=useState<Page>('map'),[query,setQuery]=useState(''),[category,setCategory]=useState<GraphCategory>('all'),[layer,setLayer]=useState('all'),[zoneId,setZoneId]=useState<string|null>(null);
 const [listPage,setListPage]=useState(0),[zonePage,setZonePage]=useState(0),[projection,setProjection]=useState<ProjectionMode>('top');
 const [active,setActive]=useState<string|null>(null),[linkStart,setLinkStart]=useState<string|null>(null),[notice,setNotice]=useState(''),[guideOpen,setGuideOpen]=useState(false);
 const [showSettings,setShowSettings]=useState(true),[showIssues,setShowIssues]=useState(false),[miniGuide,setMiniGuide]=useState(false);
 const [focusNonce,setFocusNonce]=useState(0);
 const current=byId.get(active||selected||'')||null,selectedBrush=objects.find((o):o is Brush=>o.kind==='brush'&&o.id===selected);
 const visible=useMemo(()=>filterDesignEntities(entities,zones,{query,category,layer,zoneId}),[entities,zones,query,category,layer,zoneId]);
 const zone=zones.find(z=>z.id===zoneId);
 useEffect(()=>setZonePage(p=>Math.min(p,Math.max(0,Math.ceil(zones.length/18)-1))),[zones.length]);
 const zoneIds=useMemo(()=>zone?new Set(zone.entityIds):null,[zone]);
 const pages=Math.max(1,Math.ceil(visible.length/ITEM_PAGE)),pageItems=visible.slice(listPage*ITEM_PAGE,(listPage+1)*ITEM_PAGE);
 useEffect(()=>setListPage(0),[query,category,layer,zoneId]);
 useEffect(()=>setListPage(p=>Math.min(p,pages-1)),[pages]);
 const trail=useMemo(()=>traceGameplayReferences(current?.id||'',workspace,100,14),[current?.id,workspace]);
 const activeLinks=useMemo(()=>interactions.filter(l=>l.from===current?.id||l.to===current?.id),[interactions,current?.id]);
 const outgoing=useMemo(()=>current?interactions.filter(l=>l.from===current.id):[],[interactions,current?.id]);
 const issueCount=warnings.length+workspace.duplicates.filter(d=>d.referenced).length;
 const definition=current?fgdClasses.find(c=>c.name===current.classname):undefined;
 const guide=current?localizedGuideForClass(current.classname,definition,locale):null;
 useEffect(()=>{setMiniGuide(false)},[current?.id]);
 const clearSelection=()=>{setActive(null);select(null);setGuideOpen(false);setLinkStart(null)};
 const choose=(id:string)=>{setActive(id);select(id);setGuideOpen(false);if(linkStart&&linkStart!==id)makeLink(linkStart,id)};
 const safe=(fn:()=>void)=>{try{fn();setNotice('')}catch(error){setNotice(String(error instanceof Error?error.message:error))}};
 const makeLink=(fromId:string,toId:string)=>{
  const source=byId.get(fromId),dest=byId.get(toId);setLinkStart(null);
  if(!source||!dest||fromId===toId)return;
  if(gameplayReferenceKind(source)!=='reference'&&!window.confirm(es?'Este target podría ser una ruta o referencia de cámara, no una activación. ¿Continuar?':'This target may be a path or camera reference, not an activation. Continue?'))return;
  if(dest.props.targetname&&entities.filter(e=>e.props.targetname===dest.props.targetname).length>1&&!window.confirm(es?'Varias entidades comparten el mismo targetname. ¿Conectar a todas?':'Several entities share this targetname. Connect to all?'))return;
  try{connect(fromId,toId)}catch(error){const msg=String(error instanceof Error?error.message:error);if(msg.includes('already targets')&&window.confirm(es?'El origen ya tiene otro target. ¿Reemplazarlo?':'The source already has a target. Replace it?'))safe(()=>connect(fromId,toId,true));else setNotice(msg)};
 };
 const convert=(type:'func_door'|'func_button')=>{if(!selectedBrush){setNotice(es?'Seleccioná primero un brush libre en el visor 3D.':'Select an unassigned brush in the 3D viewport.');return;}safe(()=>tie(selectedBrush.id,type));};
 const createRelay=()=>safe(()=>relay(current?[current.position[0],current.position[1],current.position[2]+48]:[0,0,96]));
 useEffect(()=>{const handle=(e:KeyboardEvent)=>{if(e.key!=='Escape')return;if(guideOpen){setGuideOpen(false);e.stopPropagation();return;}if(linkStart){setLinkStart(null);e.stopPropagation();return;}if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement)return;e.stopPropagation();onClose();};window.addEventListener('keydown',handle,true);return()=>window.removeEventListener('keydown',handle,true)},[guideOpen,linkStart,onClose]);
 const lookup=(id:string)=>{setQuery('');setCategory('all');setLayer('all');setZoneId(null);setActive(id);select(id);setPage('map')};
 const visibleIds=useMemo(()=>new Set(visible.map(e=>e.id)),[visible]);
 const eventRows=useMemo(()=>interactions.filter(l=>{const a=byId.get(l.from),b=byId.get(l.to);return !!a&&!!b&&(!zoneId||(visibleIds.has(l.from)||visibleIds.has(l.to)))&&(!query||[a.classname,a.props.targetname,b.classname,b.props.targetname].some(x=>(x||'').toLowerCase().includes(query.toLowerCase())))}),[interactions,byId,query,zoneId,visibleIds]);
 const [eventsPage,setEventsPage]=useState(0);useEffect(()=>setEventsPage(0),[query]);
 const shownEvents=eventRows.slice(eventsPage*40,(eventsPage+1)*40);
 return <div className="modal-backdrop gds-backdrop" onMouseDown={onClose}>
  <section className="gds-root" role="dialog" aria-modal="true" aria-label="Gameplay Studio 3.0" onMouseDown={e=>e.stopPropagation()}>
   <header className="gds-header"><div className="gds-brand"><span className="gds-brand-icon"><GitBranch size={21}/></span><div><strong>Gameplay Studio <em>3.0</em></strong><small>{es?'Diseñador visual de interacciones · Svengine':'Visual interaction designer · Svengine'}</small></div></div>
    <nav className="gds-tabs" aria-label="Gameplay workspace"><button className={page==='map'?'active':''} onClick={()=>setPage('map')}><MapIcon size={16}/>{es?'Mapa interactivo':'Interactive map'}</button><button className={page==='events'?'active':''} onClick={()=>setPage('events')}><Route size={16}/>{es?'Eventos':'Events'}</button><button className={page==='lab'?'active':''} onClick={()=>setPage('lab')}><Play size={16}/>{es?'Pruebas':'Checks'}</button></nav>
    <div className="gds-header-actions"><span>{entities.length.toLocaleString()} {es?'entidades':'entities'}</span><button title={es?'Mostrar u ocultar inspector':'Toggle inspector'} onClick={()=>setShowSettings(v=>!v)}><PanelRightClose size={16}/></button><button title="Undo" onClick={undo}><RotateCcw size={16}/></button><button title="Close" onClick={onClose}><X size={19}/></button></div>
   </header>
   <div className="gds-summary"><span><Users size={15}/><b>{entities.length}</b> {es?'entidades':'entities'}</span><span><GitBranch size={15}/><b>{edges.length}</b> {es?'referencias':'references'}</span><span><Layers size={15}/><b>{zones.length}</b> {es?'sectores':'sectors'}</span><button className={issueCount?'gds-attention':''} onClick={()=>{setPage('lab');setShowIssues(true)}}><AlertTriangle size={15}/><b>{issueCount}</b> {es?'revisiones':'checks'}</button></div>
   <div className={`gds-columns ${showSettings?'':'gds-no-inspector'}`}>
    <aside className="gds-nav"><h3><Compass size={15}/>{es?'EXPLORAR EL MAPA':'EXPLORE MAP'}</h3>
     <label className="gds-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={es?'Entidad, target, clase…':'Entity, target, class…'}/>{query&&<button onClick={()=>setQuery('')}><X size={12}/></button>}</label>
     <div className="gds-filters"><select aria-label="Category" value={category} onChange={e=>setCategory(e.target.value as GraphCategory)}>{categoryOptions.map(([c,esp,eng])=><option key={c} value={c}>{es?esp:eng}</option>)}</select><select aria-label="Layer" value={layer} onChange={e=>setLayer(e.target.value)}><option value="all">{es?'Todas las capas':'All layers'}</option>{[...workspace.layerCounts.keys()].sort().map(l=><option key={l} value={l}>{l}</option>)}</select></div>
     <div className="gds-nav-title"><span>{es?'ZONAS DEL MAPA':'MAP SECTORS'}</span><button onClick={()=>setZoneId(null)} className={!zoneId?'on':''}>{es?'Todo':'All'}</button></div>
     <div className="gds-zone-list">{zones.slice(zonePage*18,(zonePage+1)*18).map(z=><button className={zoneId===z.id?'active':''} key={z.id} onClick={()=>{setZoneId(zoneId===z.id?null:z.id);setPage('map')}}><MapIcon size={14}/><span><strong>{z.title}</strong><small>{z.count} {es?'entidades':'entities'} · {z.linked} {es?'vinculadas':'linked'}</small></span></button>)}{zones.length>18&&<div className="gds-pagination"><button disabled={zonePage===0} onClick={()=>setZonePage(p=>p-1)}><ChevronLeft size={13}/></button><span>{zonePage+1} / {Math.ceil(zones.length/18)}</span><button disabled={(zonePage+1)*18>=zones.length} onClick={()=>setZonePage(p=>p+1)}><ChevronRight size={13}/></button></div>}</div>
     <div className="gds-nav-title"><span>{es?'ENTIDADES':'ENTITIES'}</span><span>{visible.length}</span></div>
     <div className="gds-entity-list">{pageItems.map(e=><button key={e.id} onClick={()=>choose(e.id)} className={current?.id===e.id?'active':''}><i style={{background:tone(e)}}/><span><strong>{e.props.targetname||entityDisplayName(e,objects)}</strong><small>{e.classname}</small></span></button>)}</div>
     <div className="gds-pagination"><button disabled={listPage===0} onClick={()=>setListPage(p=>p-1)}><ChevronLeft size={15}/></button><span>{listPage+1} / {pages}</span><button disabled={listPage>=pages-1} onClick={()=>setListPage(p=>p+1)}><ChevronRight size={15}/></button></div>
     <div className="gds-quick"><h3><Plus size={14}/>{es?'CREACIÓN RÁPIDA':'QUICK CREATE'}</h3><div><button onClick={()=>convert('func_door')}><DoorOpen size={14}/>{es?'Puerta':'Door'}</button><button onClick={()=>convert('func_button')}><MousePointerClick size={14}/>{es?'Botón':'Button'}</button><button onClick={createRelay}><GitBranch size={14}/>Relay</button></div><button className="gds-demo" onClick={()=>safe(addDemo)}>{es?'Agregar ejemplo: botón → relay → puerta':'Add example: button → relay → door'}</button></div>
    </aside>
    <main className="gds-main">
     {page==='map'&&<><div className="gds-mainbar"><div><strong><MapIcon size={16}/>{zone?.title||(es?'Mapa interactivo':'Interactive map')}</strong><small>{es?'Ubicación de entidades y relaciones seleccionadas':'Entity positions and selected relationships'}</small></div><div className="gds-view-switch"><button className={projection==='top'?'on':''} onClick={()=>setProjection('top')}>{es?'Superior':'Top'}</button><button className={projection==='iso'?'on':''} onClick={()=>setProjection('iso')}>Iso</button><button title={es?'Mostrar propiedades':'Show inspector'} onClick={()=>setShowSettings(p=>!p)}><PanelRightClose size={16}/></button></div></div>
      <OverviewCanvas objects={objects} entities={entities} visible={visible} links={edges} selectedId={current?.id||null} onSelect={choose} onClear={clearSelection} projection={projection} zoneIds={zoneIds} zoneKey={zoneId} focusNonce={focusNonce}/>
      <div className="gds-main-foot"><Eye size={14}/>{es?'Vista esquemática: los brushes son referencias de ubicación, no un BSP renderizado. Las líneas representan referencias nativas, no siempre activaciones.':'Schematic view: brush outlines are approximate. Links are native references, not necessarily activations.'}</div></>}
     {page==='events'&&<><div className="gds-mainbar"><div><strong><Route size={16}/>{es?'Interacciones y referencias':'Interactions & references'}</strong><small>{es?'Sin gráficos de nodos; cada fila es una referencia nativa.':'No node graph; each row is a native reference.'}</small></div><span className="gds-mini-count">{eventRows.length} {es?'relaciones':'relationships'}</span></div>
      <div className="gds-events"><div className="gds-events-head"><span>{es?'ORIGEN':'SOURCE'}</span><span>{es?'REFERENCIA':'REFERENCE'}</span><span>{es?'DESTINO':'DESTINATION'}</span></div>{shownEvents.map(l=>{const a=byId.get(l.from),b=byId.get(l.to);return <div className="gds-event-row" key={l.id}><button onClick={()=>lookup(l.from)}><span className="gds-mini-dot" style={{background:a? tone(a):'#fff'}}/><strong>{a?.props.targetname||a?.classname}</strong><small>{a?.classname}</small></button><span className="gds-event-arrow"><ArrowRight size={15}/><small>{l.via}</small></span><button onClick={()=>lookup(l.to)}><span className="gds-mini-dot" style={{background:b?tone(b):'#fff'}}/><strong>{b?.props.targetname||b?.classname}</strong><small>{b?.classname}</small></button></div>})}{!shownEvents.length&&<p className="gds-empty">{es?'No hay relaciones que coincidan con la búsqueda.':'No matching relationships.'}</p>}</div>
      <div className="gds-events-footer"><button disabled={eventsPage===0} onClick={()=>setEventsPage(p=>p-1)}><ChevronLeft size={14}/></button><span>{eventsPage+1} / {Math.max(1,Math.ceil(eventRows.length/40))}</span><button disabled={(eventsPage+1)*40>=eventRows.length} onClick={()=>setEventsPage(p=>p+1)}><ChevronRight size={14}/></button></div></>}
     {page==='lab'&&<><div className="gds-mainbar"><div><strong><Play size={16}/>{es?'Laboratorio de referencias':'Reference lab'}</strong><small>{es?'Análisis estático, sin simular el motor de Sven Co-op.':'Static analysis, not a Sven Co-op runtime simulation.'}</small></div><button className="gds-action" onClick={()=>setShowIssues(s=>!s)}>{showIssues?(es?'Ver recorrido':'Show trace'):(es?'Ver diagnósticos':'Diagnostics')}</button></div>
      <div className="gds-lab">{showIssues?<><h2><AlertTriangle size={20}/>{es?'Diagnóstico de conexiones':'Reference diagnostics'} <span>{issueCount}</span></h2><p>{es?'Advertencias informativas; ninguna entidad será modificada automáticamente.':'Informational warnings; no entities are changed automatically.'}</p>{!issueCount&&<p className="gds-good"><CheckCircle2 size={16}/>{es?'Sin problemas detectados':'No issues found'}</p>}{warnings.slice(0,100).map((w,i)=><button key={i} className="gds-warning" onClick={()=>{if(w.entityId)lookup(w.entityId)}}><AlertTriangle size={14}/>{w.message}</button>)}{workspace.duplicates.filter(d=>d.referenced).slice(0,40).map(d=><button className="gds-warning" key={d.name} onClick={()=>lookup(d.entityIds[0])}>{es?'Nombre de destino compartido':'Shared targetname'}: {d.name} ({d.entityIds.length})</button>)}</>:<><h2><GitBranch size={19}/>{es?'Recorrido desde la entidad seleccionada':'Trace from selected entity'}</h2><p>{es?'Seleccioná una entidad en el mapa o explorador. El recorrido sigue target, moveto, killtarget y master; no predice tiempos ni acciones en el juego.':'Select an entity. The trace follows target, moveto, killtarget and master; it does not predict game timing or behavior.'}</p>{trail.steps.map((step,i)=>{const e=byId.get(step.entityId);return <button className="gds-trace" key={step.entityId} style={{marginLeft:`${Math.min(step.depth,8)*13}px`}} onClick={()=>lookup(step.entityId)}><span>{i+1}</span><div><strong>{e?.props.targetname||e?.name||e?.classname||step.entityId}</strong><small>{e?.classname} · {step.via}</small></div><ArrowRight size={14}/></button>})}{!trail.steps.length&&<p className="gds-empty">{es?'No hay entidad seleccionada.':'No entity selected.'}</p>}{trail.cycles>0&&<p className="gds-caution">{trail.cycles} {es?'referencias circulares o repetidas':'cyclic or repeated references'}</p>}{trail.truncated&&<p className="gds-caution">{es?'Recorrido limitado para mantener el rendimiento.':'Trace limited for performance.'}</p>}</>}</div></>}
    </main>
    {showSettings&&<aside className="gds-inspector"><div className="gds-inspector-head"><h3><ListFilter size={15}/>{es?'INSPECTOR':'INSPECTOR'}</h3><button onClick={()=>setShowSettings(false)} title="Hide inspector"><X size={15}/></button></div>
     {current?<><div className="gds-selected"><span className="gds-big-dot" style={{background:tone(current)}}/><div><strong>{current.props.targetname||entityDisplayName(current,objects)}</strong><small>{current.classname} · {current.layer||'Unassigned'}</small></div></div>
      <button className="gds-action" onClick={()=>{setPage('map');setZoneId(null);setQuery('');setCategory('all');setLayer('all');setFocusNonce(n=>n+1)}}><Focus size={15}/>{es?'Localizar en mapa':'Locate on map'}</button>
      <section className="gds-inspector-section"><h4>{es?'COMPORTAMIENTO NATIVO':'NATIVE BEHAVIOR'}</h4><p>{guide?.summary||current.classname}</p><button className="gds-mini-guide-toggle" aria-expanded={miniGuide} onClick={()=>setMiniGuide(v=>!v)}><BookOpen size={13}/>{es?'Mini guía · Uso y ejemplo':'Mini guide · Usage and example'}</button>{miniGuide&&guide&&<div className="gds-mini-guide"><ol>{guide.steps.slice(0,5).map((step,i)=><li key={i}>{step}</li>)}</ol><p><strong>{es?'Ejemplo':'Example'}:</strong> {guide.example}</p>{guide.caution&&<p>{guide.caution}</p>}</div>}<button className="gds-guide-btn" onClick={()=>setGuideOpen(true)}><BookOpen size={15}/>{es?'Abrir guía de entidad':'Open entity guide'}</button>
       <InlineEdit key={`${current.id}:name`} label="targetname" value={current.props.targetname||''} commit={v=>safe(()=>setProp(current.id,'targetname',v))}/>
       <InlineEdit key={`${current.id}:target`} label="target" value={current.props.target||''} commit={v=>safe(()=>setProp(current.id,'target',v))}/>
       {(['speed','wait','delay','lip','angle','triggerstate'] as const).filter(key=>key in current.props).map(key=><InlineEdit key={`${current.id}:${key}`} label={key} value={current.props[key]||''} commit={v=>safe(()=>setProp(current.id,key,v))}/>)}
      </section>
      <GameplayEntityFields entity={current} definition={definition} setProp={setProp} es={es}/>
      <section className="gds-inspector-section"><h4>{es?'CONEXIONES':'CONNECTIONS'} <span>{activeLinks.length}</span></h4>{activeLinks.slice(0,24).map(l=><button className="gds-related" key={l.id} onClick={()=>lookup(l.from===current.id?l.to:l.from)}><GitBranch size={13}/><span>{l.from===current.id?'→':'←'} {byId.get(l.from===current.id?l.to:l.from)?.props.targetname||byId.get(l.from===current.id?l.to:l.from)?.classname}</span><small>{l.via}</small></button>)}
       <button className="gds-primary" onClick={()=>{setLinkStart(current.id);setPage('map')}}><Plus size={14}/>{es?'Conectar con otra entidad':'Connect to another entity'}</button>
       {linkStart&&<p className="gds-note">{es?'Elegí la entidad destino en el mapa o en la lista de la izquierda.':'Choose a destination in the map or entity list.'} <button onClick={()=>setLinkStart(null)}>{es?'Cancelar':'Cancel'}</button></p>}
       <button className="gds-secondary" disabled={!current.props.target} onClick={()=>safe(()=>disconnect(current.id))}><Unlink2 size={14}/>{es?'Borrar referencia target':'Clear target reference'}</button>
      </section>
      <section className="gds-inspector-section"><h4>{es?'RESUMEN':'SUMMARY'}</h4><p>{outgoing.length} {es?'referencias salientes':'outgoing references'} · {workspace.incoming.get(current.id)?.length||0} {es?'entrantes':'incoming'}</p><button className="gds-secondary" onClick={()=>{setPage('lab');setShowIssues(false)}}><Activity size={14}/>{es?'Ver recorrido de referencias':'View reference trace'}</button></section>
     </>:<div className="gds-no-selection"><MousePointerClick size={25}/><p>{es?'Seleccioná una entidad en el mapa o en la lista para ver sus propiedades, referencias y herramientas.':'Select an entity on the map or list to inspect its properties and references.'}</p></div>}
     {notice&&<p className="gds-error" role="alert">{notice}</p>}
    </aside>}
   </div><footer className="gds-footer"><span><CheckCircle2 size={14}/>{es?'Las zonas y vistas no modifican el proyecto ni la exportación Valve 220.':'Zones and views do not alter the project or Valve 220 export.'}</span><span>SC-CSG / BSP / VIS / RAD</span></footer>
  </section>
  {guideOpen&&current&&createPortal(<div className="gs-guide-overlay" onMouseDown={e=>{if(e.currentTarget===e.target)setGuideOpen(false)}}><section className="gs-guide-dialog" role="dialog" aria-modal="true"><header className="gs-guide-header"><BookOpen size={19}/><h2>{current.classname}</h2><button onClick={()=>setGuideOpen(false)}><X size={20}/></button></header><div className="gs-guide-body"><EntityAssistant key={current.id} entity={current} definition={definition} initiallyOpen/></div><footer className="gs-guide-footer"><button onClick={()=>setGuideOpen(false)}>{es?'Cerrar':'Close'}</button></footer></section></div>,document.body)}
 </div>;
}
