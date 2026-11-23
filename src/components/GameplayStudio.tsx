import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {LogicSimulatorPanel} from './LogicSimulatorPanel';
import {KitGallery} from './KitGallery';
import {createPortal} from 'react-dom';
import {Puzzle,Activity,AlertTriangle,ArrowRight,BookOpen,CheckCircle2,ChevronLeft,ChevronRight,DoorOpen,Eye,Focus,GitBranch,Layers,ListFilter,Map as MapIcon,MousePointerClick,Plus,RotateCcw,Search,Unlink2,Users,X,ZoomIn,ZoomOut,Play,Route,Compass,PanelRightClose,Workflow} from 'lucide-react';
import * as THREE from 'three';
import {outlineSegments,detectFloors,gameplayChain,layoutLogicGraph,PointGrid,type GLink} from '../engine/gameplayMapGL';
import {useEditor} from '../store';
import {useMotionPreview} from '../entityMotionPreviewState';
import {isMotionPreviewSource} from '../engine/entityMotionPreview';
import {motionLabels} from '../engine/entityMotionPreviewLabels';
import type {Brush,MapObject,PointEntity,FgdClass} from '../engine/types';
import {analyzeGameplay} from '../engine/gameplay';
import {gameplayGraphCategory,getGameplayGraphConnections,gameplayReferenceKind,type GraphCategory} from '../engine/gameplayGraph';
import {buildGameplayWorkspaceIndex,traceGameplayReferences} from '../engine/gameplayWorkspace';
import {buildDesignZones,buildDesignInteractions,filterDesignEntities,type ProjectionMode} from '../engine/gameplayDesigner';
import {brushMapOutline,brushIntersectsHeight,getGameplayMapBrushes,groupMapMarkers,inHeightSlice,mapZoomAt,projectMapPoint,type MapOutline} from '../engine/gameplayMap2d';
import {EntityAssistant} from './EntityAssistant';
import {FgdLoadControl} from './FgdLoadControl';
import {localizedGuideForClass} from '../engine/entityGuide';
import {entityDisplayName} from '../engine/entityNaming';
import './gameplayDesigner.css';

type Page='map'|'logic'|'events'|'lab'|'kits'|'sim';
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
/* v2.5: GPU map. All brush outlines live in ONE line buffer and every entity is a GPU point, so panning and
 * zooming only move the camera (no React re-render, no CPU redraw of thousands of polygons). Frames are
 * drawn on demand; only the activation-chain flow animates. Picking uses a spatial grid. */
export type MapPoint={id:string;x:number;y:number;color:string};
type OverviewProps={points:MapPoint[];segments:Float32Array|null;links:GLink[];chain:{nodes:Set<string>;links:Set<number>};showAllLinks:boolean;problems:Set<string>;
 selectedId:string|null;onSelect:(id:string)=>void;onClear:()=>void;labelFor:(id:string)=>{name:string;cls:string;z:number;color:string}|null;
 fitKey:string;focusNonce:number;mode:'map'|'logic';onDropRelay?:(x:number,y:number)=>void;total:number};
const POINT_VERT=`attribute vec3 color;attribute float size;attribute float flag;varying vec3 vColor;varying float vFlag;
void main(){vColor=color;vFlag=flag;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size;}`;
// flag: 0 normal · 1 selected · 2 problem · 3 dimmed (outside the highlighted chain) · 4 chain member
const POINT_FRAG=`varying vec3 vColor;varying float vFlag;void main(){vec2 p=gl_PointCoord*2.-1.;float d=length(p);if(d>1.)discard;
vec3 c=vColor;float a=1.;if(vFlag>2.5&&vFlag<3.5){a=.28;}
if(d>.72){c=vFlag>.5&&vFlag<1.5?vec3(1.):vFlag>1.5&&vFlag<2.5?vec3(1.,.32,.36):vFlag>3.5?vec3(.55,1.,.9):vec3(.06,.14,.2);}
gl_FragColor=vec4(c,a);}`;
const FLOW_VERT=`attribute float dist;attribute vec3 color;varying float vDist;varying vec3 vColor;void main(){vDist=dist;vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const FLOW_FRAG=`uniform float uTime;uniform float uScale;varying float vDist;varying vec3 vColor;void main(){float t=fract((vDist*uScale-uTime*70.)/22.);gl_FragColor=vec4(vColor*(t<.55?1.:.45),t<.55?1.:.55);}`;
function hexToRgb(hex:string):[number,number,number]{const n=parseInt(hex.replace('#','').slice(0,6),16)||0;return [(n>>16&255)/255,(n>>8&255)/255,(n&255)/255];}
function OverviewCanvas({points,segments,links,chain,showAllLinks,problems,selectedId,onSelect,onClear,labelFor,fitKey,focusNonce,mode,onDropRelay,total}:OverviewProps){
 const canvas=useRef<HTMLCanvasElement>(null),container=useRef<HTMLDivElement>(null),labels=useRef<HTMLDivElement>(null),mini=useRef<HTMLCanvasElement>(null);
 const view=useRef({cx:0,cy:0,scale:1});const size=useRef({width:940,height:570});
 const gl=useRef<{renderer:THREE.WebGLRenderer;scene:THREE.Scene;camera:THREE.OrthographicCamera;grid:THREE.LineSegments;outline:THREE.LineSegments;faint:THREE.LineSegments;flow:THREE.LineSegments;dots:THREE.Points;flowMat:THREE.ShaderMaterial}|null>(null);
 const dirty=useRef(true);const requestRender=useCallback(()=>{dirty.current=true},[]);
 const [stack,setStack]=useState<{x:number;y:number;members:string[]}|null>(null);
 const [stackQuery,setStackQuery]=useState(''),[stackPage,setStackPage]=useState(0);
 const [zoomLabel,setZoomLabel]=useState(100);
 const drag=useRef<{x:number;y:number;cx:number;cy:number;moved:boolean}|null>(null);
 const ignoreFocus=useRef(false);
 const pointIndex=useMemo(()=>new Map(points.map((p,i)=>[p.id,i])),[points]);
 const grid=useMemo(()=>new PointGrid(Float32Array.from(points,p=>p.x),Float32Array.from(points,p=>p.y),96),[points]);
 const miniImage=useRef<HTMLCanvasElement|null>(null);const bounds=useRef({minX:-512,maxX:512,minY:-512,maxY:512});
 // --- WebGL setup (once) ---
 useEffect(()=>{
  const el=canvas.current;if(!el)return;
  const renderer=new THREE.WebGLRenderer({canvas:el,antialias:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));renderer.setClearColor('#081827');
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-1,1,1,-1,-100,100);camera.position.z=10;
  const line=(color:string,opacity=1)=>{const o=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity,depthTest:false}));o.frustumCulled=false;scene.add(o);return o;};
  const gridLines=line('#1f3a4e'),outline=line('#3a6276'),faint=line('#5f8fb0',.35);
  gridLines.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6*600),3));
  const flowMat=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uScale:{value:1}},vertexShader:FLOW_VERT,fragmentShader:FLOW_FRAG,transparent:true,depthTest:false});
  const flow=new THREE.LineSegments(new THREE.BufferGeometry(),flowMat);flow.frustumCulled=false;scene.add(flow);
  const dots=new THREE.Points(new THREE.BufferGeometry(),new THREE.ShaderMaterial({vertexShader:POINT_VERT,fragmentShader:POINT_FRAG,transparent:true,depthTest:false}));dots.frustumCulled=false;scene.add(dots);
  gl.current={renderer,scene,camera,grid:gridLines,outline,faint,flow,dots,flowMat};
  let raf=0;const start=performance.now();
  const loop=()=>{raf=requestAnimationFrame(loop);const g=gl.current;if(!g)return;const animate=g.flow.geometry.getAttribute('position')?.count>0;
   if(!dirty.current&&!animate)return;dirty.current=false;draw(animate?(performance.now()-start)/1000:0);};
  raf=requestAnimationFrame(loop);
  return()=>{cancelAnimationFrame(raf);scene.traverse(o=>{const m=o as THREE.Mesh;m.geometry?.dispose();(m.material as THREE.Material|undefined)?.dispose?.();});renderer.dispose();gl.current=null;};
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 // --- draw one frame from the current view (imperative, no React) ---
 const drawRef=useRef<(t:number)=>void>(()=>{});
 const draw=(t:number)=>drawRef.current(t);
 drawRef.current=(t:number)=>{
  const g=gl.current;if(!g)return;const {width:w,height:h}=size.current,v=view.current;
  g.renderer.setSize(w,h,false);
  const hw=w/(2*v.scale),hh=h/(2*v.scale);g.camera.left=v.cx-hw;g.camera.right=v.cx+hw;g.camera.top=-v.cy+hh;g.camera.bottom=-v.cy-hh;g.camera.updateProjectionMatrix();
  // grid every 64·2^n world units, 38–135 px apart
  let step=64;while(step*v.scale<38)step*=2;while(step*v.scale>135)step/=2;
  // grid reuses one preallocated buffer (no new GPU buffer per frame)
  const gattr=g.grid.geometry.getAttribute('position') as THREE.BufferAttribute,ga=gattr.array as Float32Array;let gk=0;
  for(let x=Math.ceil((v.cx-hw)/step)*step;x<=v.cx+hw&&gk+6<=ga.length;x+=step){ga.set([x,-v.cy-hh,0,x,-v.cy+hh,0],gk);gk+=6;}
  for(let y=Math.ceil((-v.cy-hh)/step)*step;y<=-v.cy+hh&&gk+6<=ga.length;y+=step){ga.set([v.cx-hw,y,0,v.cx+hw,y,0],gk);gk+=6;}
  gattr.needsUpdate=true;g.grid.geometry.setDrawRange(0,gk/3);
  g.flowMat.uniforms.uTime.value=t;g.flowMat.uniforms.uScale.value=v.scale;
  g.renderer.render(g.scene,g.camera);
  // labels: selected + chain + (zoomed in) what fits on screen; DOM nodes are reused
  const box=labels.current;
  if(box){
   const wanted:{id:string;x:number;y:number;strong:boolean}[]=[];
   const toScreen=(p:MapPoint)=>[(p.x-v.cx)*v.scale+w/2,(p.y-v.cy)*v.scale+h/2] as const;
   const push=(p:MapPoint,strong:boolean)=>{const [x,y]=toScreen(p);if(x>-60&&y>-30&&x<w+60&&y<h+30)wanted.push({id:p.id,x,y,strong});};
   if(selectedId){const i=pointIndex.get(selectedId);if(i!==undefined)push(points[i],true);}
   let n=0;for(const id of chain.nodes){if(id===selectedId)continue;const i=pointIndex.get(id);if(i!==undefined&&n++<40)push(points[i],false);}
   const budget=mode==='logic'?140:36;
   if(wanted.length<budget&&v.scale>=(mode==='logic'?.3:.5)){let seen=0;const extra:{id:string;x:number;y:number;strong:boolean}[]=[];
    for(const p of points){const [x,y]=toScreen(p);if(x<0||y<0||x>w||y>h)continue;if(++seen>budget*3)break;if(!chain.nodes.has(p.id)&&p.id!==selectedId)extra.push({id:p.id,x,y,strong:false});}
    if(seen<=budget*3)wanted.push(...extra.slice(0,budget-wanted.length));}
   while(box.children.length<wanted.length){const d=document.createElement('div');d.className='gds-gl-label';box.appendChild(d);}
   for(let i=0;i<box.children.length;i++){const d=box.children[i] as HTMLDivElement;const item=wanted[i];
    if(!item){d.style.display='none';continue;}const info=labelFor(item.id);if(!info){d.style.display='none';continue;}
    d.style.display='';d.className=`gds-gl-label${item.strong?' is-selected':''}`;d.style.transform=`translate(${Math.round(item.x+10)}px,${Math.round(item.y-24)}px)`;
    if(d.dataset.id!==item.id){d.dataset.id=item.id;d.textContent=info.name.slice(0,34);d.style.setProperty('--dot',info.color);}}
  }
  // minimap: cached outline image + viewport rectangle
  const m=mini.current;if(m&&miniImage.current){const ctx=m.getContext('2d');if(ctx){const b=bounds.current,mw=m.width,mh=m.height,s=Math.min(mw/(b.maxX-b.minX||1),mh/(b.maxY-b.minY||1));
   ctx.clearRect(0,0,mw,mh);ctx.drawImage(miniImage.current,0,0);
   const rx=(v.cx-hw-b.minX)*s,ry=(v.cy-hh-b.minY)*s;ctx.strokeStyle='#8fe9ff';ctx.lineWidth=1.5;ctx.strokeRect(rx,ry,hw*2*s,hh*2*s);
   if(selectedId){const i=pointIndex.get(selectedId);if(i!==undefined){ctx.fillStyle='#fff';ctx.beginPath();ctx.arc((points[i].x-b.minX)*s,(points[i].y-b.minY)*s,3,0,Math.PI*2);ctx.fill();}}}}
  setZoomLabelThrottled(Math.round(v.scale*100));
 };
 const zoomTimer=useRef(0);const setZoomLabelThrottled=(z:number)=>{window.clearTimeout(zoomTimer.current);zoomTimer.current=window.setTimeout(()=>setZoomLabel(z),120);};
 // --- geometry buffers ---
 useEffect(()=>{const g=gl.current;if(!g)return;
  g.outline.geometry.dispose();
  if(segments&&segments.length){const p=new Float32Array(segments.length/2*3);for(let i=0,k=0;i<segments.length;i+=2){p[k++]=segments[i];p[k++]=segments[i+1];p[k++]=0;}g.outline.geometry.setAttribute('position',new THREE.BufferAttribute(p,3));g.outline.visible=true;}
  else g.outline.visible=false;
  // bounds + minimap image
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const p of points){if(p.x<minX)minX=p.x;if(p.x>maxX)maxX=p.x;if(p.y<minY)minY=p.y;if(p.y>maxY)maxY=p.y;}
  if(segments)for(let i=0;i<segments.length;i+=2){const x=segments[i],y=-segments[i+1];if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  if(!Number.isFinite(minX)){minX=-512;maxX=512;minY=-512;maxY=512;}
  bounds.current={minX,maxX,minY,maxY};
  const m=mini.current;if(m){const img=document.createElement('canvas');img.width=m.width;img.height=m.height;const ctx=img.getContext('2d');
   if(ctx){const s=Math.min(m.width/(maxX-minX||1),m.height/(maxY-minY||1));ctx.fillStyle='#0a1d2c';ctx.fillRect(0,0,m.width,m.height);ctx.strokeStyle='#3a6276';ctx.lineWidth=.6;ctx.beginPath();
    if(segments){const stride=Math.max(1,Math.floor(segments.length/4/20000))*4;for(let i=0;i+3<segments.length;i+=stride){ctx.moveTo((segments[i]-minX)*s,(-segments[i+1]-minY)*s);ctx.lineTo((segments[i+2]-minX)*s,(-segments[i+3]-minY)*s);}}
    ctx.stroke();ctx.fillStyle='#6fd6e8';for(const p of points)ctx.fillRect((p.x-minX)*s,(p.y-minY)*s,1.5,1.5);}
   miniImage.current=img;}
  requestRender();
 },[segments,points,requestRender]);
 useEffect(()=>{const g=gl.current;if(!g)return;
  const n=points.length,pos=new Float32Array(n*3),col=new Float32Array(n*3),sz=new Float32Array(n),flag=new Float32Array(n);
  const hasChain=chain.nodes.size>1;
  points.forEach((p,i)=>{pos[i*3]=p.x;pos[i*3+1]=-p.y;pos[i*3+2]=0;const [r,gg,b]=hexToRgb(p.color);col[i*3]=r;col[i*3+1]=gg;col[i*3+2]=b;
   const sel=p.id===selectedId,inChain=chain.nodes.has(p.id),bad=problems.has(p.id);
   flag[i]=sel?1:bad?2:hasChain&&!inChain?3:hasChain&&inChain?4:0;sz[i]=(sel?17:inChain&&hasChain?13:bad?12:mode==='logic'?12:9)*Math.min(2,window.devicePixelRatio||1);});
  const geo=g.dots.geometry;geo.dispose();g.flow.geometry.dispose();g.faint.geometry.dispose();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));geo.setAttribute('size',new THREE.BufferAttribute(sz,1));geo.setAttribute('flag',new THREE.BufferAttribute(flag,1));
  // chain flow + optional faint links
  const fp:number[]=[],fd:number[]=[],fc:number[]=[],ap:number[]=[];
  links.forEach((l,i)=>{const a=pointIndex.get(l.from),b=pointIndex.get(l.to);if(a===undefined||b===undefined)return;const A=points[a],B=points[b];
   if(chain.links.has(i)){const len=Math.hypot(B.x-A.x,B.y-A.y);const [r,gg,bb]=l.via==='target'?[.43,.88,.76]:[.92,.73,.49];fp.push(A.x,-A.y,0,B.x,-B.y,0);fd.push(0,len);fc.push(r,gg,bb,r,gg,bb);}
   else if(showAllLinks)ap.push(A.x,-A.y,0,B.x,-B.y,0);});
  g.flow.geometry.setAttribute('position',new THREE.Float32BufferAttribute(fp,3));g.flow.geometry.setAttribute('dist',new THREE.Float32BufferAttribute(fd,1));g.flow.geometry.setAttribute('color',new THREE.Float32BufferAttribute(fc,3));
  g.faint.geometry.setAttribute('position',new THREE.Float32BufferAttribute(ap,3));
  requestRender();
 },[points,links,chain,showAllLinks,problems,selectedId,mode,pointIndex,requestRender]);
 // --- size, fit, focus ---
 const fit=useCallback(()=>{const b=bounds.current,{width,height}=size.current;
  view.current={cx:(b.minX+b.maxX)/2,cy:(b.minY+b.maxY)/2,scale:clamp(Math.min((width-60)/Math.max(100,b.maxX-b.minX),(height-60)/Math.max(100,b.maxY-b.minY)),.01,8)};requestRender();},[requestRender]);
 useEffect(()=>{const el=container.current;if(!el)return;
  const read=()=>{size.current={width:Math.max(120,el.clientWidth),height:Math.max(120,el.clientHeight)};requestRender();};
  read();const obs=new ResizeObserver(read);obs.observe(el);return()=>obs.disconnect();},[requestRender]);
 useEffect(()=>{fit();setStack(null);},[fitKey,mode,fit]);
 useEffect(()=>{if(!selectedId)return;if(ignoreFocus.current){ignoreFocus.current=false;return;}const i=pointIndex.get(selectedId);if(i===undefined)return;
  view.current={...view.current,cx:points[i].x,cy:points[i].y};requestRender();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[selectedId,focusNonce]);
 // keyboard F = frame (selection or map)
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement||e.target instanceof HTMLSelectElement)return;
  if(e.key==='f'||e.key==='F'){e.preventDefault();if(selectedId&&pointIndex.has(selectedId)){const p=points[pointIndex.get(selectedId)!];view.current={cx:p.x,cy:p.y,scale:Math.max(view.current.scale,1.2)};requestRender();}else fit();}};
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[selectedId,pointIndex,points,fit,requestRender]);
 const zoomAt=(factor:number,x:number,y:number)=>{setStack(null);const {width,height}=size.current;view.current=mapZoomAt(view.current,factor,[x,y],width,height);requestRender();};
 const toWorld=(x:number,y:number)=>{const v=view.current,{width,height}=size.current;return [v.cx+(x-width/2)/v.scale,v.cy+(y-height/2)/v.scale] as const;};
 const selectAt=(x:number,y:number)=>{
  const v=view.current,[wx,wy]=toWorld(x,y);
  const hits=grid.query(wx,wy,13/v.scale).map(i=>points[i]);
  const groups=groupMapMarkers(hits.map(p=>({id:p.id,x:(p.x-v.cx)*v.scale+size.current.width/2,y:(p.y-v.cy)*v.scale+size.current.height/2,z:labelFor(p.id)?.z??0})),17);
  let nearest:typeof groups[number]|undefined,dist=21*21;
  for(const group of groups){const d=(x-group.x)**2+(y-group.y)**2;if(d<=dist){dist=d;nearest=group}}
  if(!nearest){setStack(null);onClear();return}
  if(nearest.members.length===1){setStack(null);ignoreFocus.current=selectedId!==nearest.members[0];onSelect(nearest.members[0]);return}
  setStackQuery('');setStackPage(0);setStack({x:clamp(nearest.x,12,Math.max(12,size.current.width-270)),y:clamp(nearest.y+16,12,Math.max(12,size.current.height-300)),members:nearest.members});
 };
 const stackCandidates=useMemo(()=>{
  if(!stack)return [];const q=stackQuery.trim().toLocaleLowerCase();
  return [...stack.members].sort((a,b)=>(labelFor(b)?.z||0)-(labelFor(a)?.z||0)||a.localeCompare(b))
   .filter(id=>{const e=labelFor(id);return e&&(!q||[e.name,e.cls,String(Math.round(e.z))].some(t=>t.toLocaleLowerCase().includes(q)))});
 },[stack,stackQuery,labelFor]);
 const stackPages=Math.max(1,Math.ceil(stackCandidates.length/35));
 const onMini=(e:React.PointerEvent<HTMLCanvasElement>)=>{const m=e.currentTarget,r=m.getBoundingClientRect(),b=bounds.current;const s=Math.min(m.width/(b.maxX-b.minX||1),m.height/(b.maxY-b.minY||1));
  view.current={...view.current,cx:b.minX+(e.clientX-r.left)*(m.width/r.width)/s,cy:b.minY+(e.clientY-r.top)*(m.height/r.height)/s};requestRender();};
 return <div className="gds-map-area gds-gl-map" ref={container} onDragOver={e=>{if(onDropRelay&&e.dataTransfer.types.includes('application/x-sven-relay'))e.preventDefault();}}
   onDrop={e=>{if(!onDropRelay||!e.dataTransfer.types.includes('application/x-sven-relay'))return;e.preventDefault();const r=e.currentTarget.getBoundingClientRect();const [x,y]=toWorld(e.clientX-r.left,e.clientY-r.top);onDropRelay(x,y);}}>
  <canvas ref={canvas} role="img" aria-label="Spatial schematic gameplay map" onWheel={e=>{const r=e.currentTarget.getBoundingClientRect();zoomAt(e.deltaY<0?1.15:.87,e.clientX-r.left,e.clientY-r.top)}}
   onContextMenu={e=>{e.preventDefault();e.stopPropagation();setStack(null);drag.current=null;onClear()}}
   onPointerDown={e=>{if(e.button!==0&&e.button!==1){drag.current=null;return;}setStack(null);e.currentTarget.setPointerCapture(e.pointerId);drag.current={x:e.clientX,y:e.clientY,cx:view.current.cx,cy:view.current.cy,moved:e.button===1}}}
   onPointerMove={e=>{const d=drag.current;if(!d)return;const dx=e.clientX-d.x,dy=e.clientY-d.y;if(Math.abs(dx)+Math.abs(dy)>5)d.moved=true;if(d.moved){view.current={...view.current,cx:d.cx-dx/view.current.scale,cy:d.cy-dy/view.current.scale};requestRender();}}}
   onPointerUp={e=>{const d=drag.current;drag.current=null;if(e.button!==0)return;if(d&&!d.moved){const r=e.currentTarget.getBoundingClientRect();selectAt(e.clientX-r.left,e.clientY-r.top)}}}
   onPointerCancel={()=>{drag.current=null}}/>
  <div className="gds-gl-labels" ref={labels} aria-hidden="true"/>
  <canvas className="gds-minimap" ref={mini} width={190} height={130} title="Minimapa · clic para ir" onPointerDown={onMini} style={mode==='logic'?{display:'none'}:undefined}/>
  {stack&&<div className="gds-stack-menu" style={{left:stack.x,top:stack.y}} role="dialog" aria-label="Entidades superpuestas">
   <div className="gds-stack-head"><strong>{stack.members.length} entidades en esta posición</strong><button onClick={()=>setStack(null)} aria-label="Cerrar"><X size={14}/></button></div>
   <input className="gds-stack-search" type="search" aria-label="Buscar entidad superpuesta" placeholder="Nombre, classname, Z…" value={stackQuery} onChange={e=>{setStackQuery(e.target.value);setStackPage(0)}}/>
   <div className="gds-stack-list">{stackCandidates.slice(stackPage*35,(stackPage+1)*35).map(id=>{const e=labelFor(id);return e?<button key={id} onClick={()=>{ignoreFocus.current=selectedId!==id;onSelect(id);setStack(null)}}><span className="gds-mini-dot" style={{background:e.color}}/><span><strong>{e.name}</strong><small>{e.cls} · Z {Math.round(e.z)}</small></span></button>:null})}{!stackCandidates.length&&<p>Sin resultados.</p>}</div>
   {stackPages>1&&<div className="gds-stack-pages"><button disabled={stackPage===0} onClick={()=>setStackPage(n=>Math.max(0,n-1))}><ChevronLeft size={14}/></button><span>{stackPage+1} / {stackPages}</span><button disabled={stackPage+1>=stackPages} onClick={()=>setStackPage(n=>n+1)}><ChevronRight size={14}/></button></div>}
  </div>}
  <div className="gds-map-help">{mode==='logic'?'Rueda: zoom · arrastrar: mover · clic: seleccionar · F: encuadrar':'Rueda: zoom · arrastrar: mover · clic: seleccionar · F: encuadrar · grupos: elegir entidad'}</div>
  <div className="gds-map-zoom"><button onClick={()=>zoomAt(1.25,size.current.width/2,size.current.height/2)} title="Zoom in"><ZoomIn size={16}/></button><span className="gds-zoom-value">{zoomLabel}%</span><button onClick={()=>zoomAt(.8,size.current.width/2,size.current.height/2)} title="Zoom out"><ZoomOut size={16}/></button><button onClick={fit} title="Fit map (F)"><Focus size={16}/></button></div>
  <span className="gds-map-count">{points.length.toLocaleString()} / {total.toLocaleString()} {mode==='logic'?'nodos':'entidades'}{chain.nodes.size>1?` · cadena ${chain.nodes.size}`:''}</span>
 </div>;
}

const CHIP_COLOR:Record<GraphCategory,string>={all:'var(--theme-accent)',logic:'#c0a1ff',brush:'#63dbed',ai:'#f5ac78',camera:'#73b7ff',audio:'#76ddb4',other:'#91a3cc'};
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
 const floors=useMemo(()=>detectFloors(entities),[entities]);
 const [page,setPage]=useState<Page>('map'),[query,setQuery]=useState(''),[category,setCategory]=useState<GraphCategory>('all'),[layer,setLayer]=useState('all'),[zoneId,setZoneId]=useState<string|null>(null);
 const [listPage,setListPage]=useState(0),[zonePage,setZonePage]=useState(0),[projection,setProjection]=useState<ProjectionMode>('top');
 const [active,setActive]=useState<string|null>(null),[linkStart,setLinkStart]=useState<string|null>(null),[notice,setNotice]=useState(''),[guideOpen,setGuideOpen]=useState(false);
 const [showSettings,setShowSettings]=useState(true),[showIssues,setShowIssues]=useState(false),[miniGuide,setMiniGuide]=useState(false);
 const [inspectorTab,setInspectorTab]=useState<'props'|'links'|'issues'>('props');
 const [focusNonce,setFocusNonce]=useState(0);
 // Map filters (v2.5): floors detected from entity heights replace the old Z-range select.
 const [heightMode,setHeightMode]=useState<'all'|'floor'|'selected'>('all'),[floorId,setFloorId]=useState<string|null>(null);
 const [showGeometry,setShowGeometry]=useState(true),[relatedOnly,setRelatedOnly]=useState(false),[showProblems,setShowProblems]=useState(true);
 const searchRef=useRef<HTMLInputElement>(null);
 const current=byId.get(active||selected||'')||null,selectedBrush=objects.find((o):o is Brush=>o.kind==='brush'&&o.id===selected);
 const visible=useMemo(()=>filterDesignEntities(entities,zones,{query,category,layer,zoneId}),[entities,zones,query,category,layer,zoneId]);
 const zone=zones.find(z=>z.id===zoneId);
 useEffect(()=>setZonePage(p=>Math.min(p,Math.max(0,Math.ceil(zones.length/18)-1))),[zones.length]);
 const pages=Math.max(1,Math.ceil(visible.length/ITEM_PAGE)),pageItems=visible.slice(listPage*ITEM_PAGE,(listPage+1)*ITEM_PAGE);
 useEffect(()=>setListPage(0),[query,category,layer,zoneId]);
 useEffect(()=>setListPage(p=>Math.min(p,pages-1)),[pages]);
 const trail=useMemo(()=>traceGameplayReferences(current?.id||'',workspace,100,14),[current?.id,workspace]);
 const activeLinks=useMemo(()=>interactions.filter(l=>l.from===current?.id||l.to===current?.id),[interactions,current?.id]);
 const outgoing=useMemo(()=>current?interactions.filter(l=>l.from===current.id):[],[interactions,current?.id]);
 const issueCount=warnings.length+workspace.duplicates.filter(d=>d.referenced).length;
 const problemIds=useMemo(()=>{const s=new Set<string>();for(const w of warnings)if(w.entityId)s.add(w.entityId);for(const d of workspace.duplicates)if(d.referenced)d.entityIds.forEach(id=>s.add(id));return s;},[warnings,workspace]);
 const currentWarnings=useMemo(()=>current?warnings.filter(w=>w.entityId===current.id):[],[warnings,current?.id]);
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
 const floorZ=()=>floors.find(f=>f.id===floorId)?.min??current?.position[2]??0;
 const createRelay=()=>safe(()=>relay(current?[current.position[0],current.position[1],current.position[2]+48]:[0,0,96]));
 const dropRelay=(x:number,y:number)=>{if(projection!=='top'||page!=='map'){setNotice(es?'Soltá el relay en la vista Superior del Mapa.':'Drop the relay on the Top map view.');return;}safe(()=>relay([Math.round(x),Math.round(-y),Math.round(floorZ())+16]));};
 useEffect(()=>{const handle=(e:KeyboardEvent)=>{
   const typing=e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement;
   if(e.key==='/'&&!typing){e.preventDefault();searchRef.current?.focus();return;}
   if(e.key!=='Escape')return;if(guideOpen){setGuideOpen(false);e.stopPropagation();return;}if(linkStart){setLinkStart(null);e.stopPropagation();return;}if(typing)return;
   e.stopPropagation();if(current){clearSelection();return;}onClose();};
  window.addEventListener('keydown',handle,true);return()=>window.removeEventListener('keydown',handle,true)},[guideOpen,linkStart,onClose,current]);
 const lookup=(id:string)=>{setQuery('');setCategory('all');setLayer('all');setZoneId(null);setActive(id);select(id);if(page!=='logic')setPage('map')};
 const visibleIds=useMemo(()=>new Set(visible.map(e=>e.id)),[visible]);
 const eventRows=useMemo(()=>interactions.filter(l=>{const a=byId.get(l.from),b=byId.get(l.to);return !!a&&!!b&&(!zoneId||(visibleIds.has(l.from)||visibleIds.has(l.to)))&&(!query||[a.classname,a.props.targetname,b.classname,b.props.targetname].some(x=>(x||'').toLowerCase().includes(query.toLowerCase())))}),[interactions,byId,query,zoneId,visibleIds]);
 const [eventsPage,setEventsPage]=useState(0);useEffect(()=>setEventsPage(0),[query]);
 const shownEvents=eventRows.slice(eventsPage*40,(eventsPage+1)*40);
 // ---- data for the GPU map / logic view ----
 const glLinks=useMemo<GLink[]>(()=>edges.map(l=>({from:l.from,to:l.to,via:l.via})),[edges]);
 const chain=useMemo(()=>gameplayChain(glLinks,current?.id||null),[glLinks,current?.id]);
 const floor=floors.find(f=>f.id===floorId);
 const sliceOk=(z:number)=>heightMode==='all'?true:heightMode==='floor'&&floor?z>=floor.min-24&&z<=floor.max+24:heightMode==='selected'&&current?inHeightSlice(z,current.position[2],128):true;
 const mapEntities=useMemo(()=>visible.filter(e=>sliceOk(e.position[2])&&(!relatedOnly||!current||chain.nodes.has(e.id))),
 // eslint-disable-next-line react-hooks/exhaustive-deps
  [visible,heightMode,floorId,floors,relatedOnly,chain,current?.id]);
 const outlines=useMemo(()=>page==='map'&&showGeometry?getGameplayMapBrushes(objects).map(b=>brushMapOutline(b,projection)).filter((o):o is MapOutline=>o!==null):[],[objects,projection,showGeometry,page]);
 const segments=useMemo(()=>{
  if(!outlines.length)return null;
  const range=heightMode==='floor'&&floor?{c:(floor.min+floor.max)/2,r:(floor.max-floor.min)/2+96}:heightMode==='selected'&&current?{c:current.position[2],r:160}:null;
  return outlineSegments(range?outlines.filter(o=>brushIntersectsHeight(o,range.c,range.r)):outlines);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[outlines,heightMode,floorId,floors,current?.id]);
 const logicLayout=useMemo(()=>{
  if(page!=='logic')return null;
  const ids=new Set<string>();for(const l of glLinks)if(visibleIds.has(l.from)||visibleIds.has(l.to)){if(byId.has(l.from))ids.add(l.from);if(byId.has(l.to))ids.add(l.to);}
  return layoutLogicGraph([...ids].slice(0,6000),glLinks);
 },[page,glLinks,visibleIds,byId]);
 const points=useMemo<MapPoint[]>(()=>page==='logic'&&logicLayout
  ?[...logicLayout].map(([id,[x,y]])=>({id,x,y,color:byId.get(id)?tone(byId.get(id)!):'#91a3cc'}))
  :mapEntities.map(e=>{const [x,y]=projectMapPoint(e.position,projection);return {id:e.id,x,y,color:tone(e)};}),[page,logicLayout,mapEntities,projection,byId]);
 const labelFor=useCallback((id:string)=>{const e=byId.get(id);return e?{name:e.props.targetname||entityDisplayName(e,objects),cls:e.classname,z:e.position[2],color:tone(e)}:null;},[byId,objects]);
 const fitKey=`${page}:${projection}:${zoneId}:${heightMode}:${floorId}`;
 const chipLabel=(c:GraphCategory)=>{const o=categoryOptions.find(x=>x[0]===c)!;return es?o[1]:o[2];};
 const categoryCounts=useMemo(()=>{const m=new Map<GraphCategory,number>();for(const e of entities){const c=gameplayGraphCategory(e);m.set(c,(m.get(c)||0)+1);}return m;},[entities]);
 return <div className="modal-backdrop gds-backdrop" onMouseDown={onClose}>
  <section className="gds-root gds-v25" role="dialog" aria-modal="true" aria-label="Gameplay Studio" onMouseDown={e=>e.stopPropagation()}>
   <header className="gds-header"><div className="gds-brand"><span className="gds-brand-icon"><GitBranch size={21}/></span><div><strong>Gameplay Studio</strong><small>{es?'Diseñador visual de interacciones · Svengine':'Visual interaction designer · Svengine'}</small></div></div>
    <nav className="gds-tabs" aria-label="Gameplay workspace">
     <button className={page==='map'?'active':''} onClick={()=>setPage('map')}><MapIcon size={16}/>{es?'Mapa':'Map'}</button>
     <button className={page==='logic'?'active':''} onClick={()=>setPage('logic')}><Workflow size={16}/>{es?'Lógica':'Logic'}</button>
     <button className={page==='events'?'active':''} onClick={()=>setPage('events')}><Route size={16}/>{es?'Eventos':'Events'}</button>
     <button className={page==='sim'?'active':''} onClick={()=>setPage('sim')}><Play size={16}/>{es?'Simulador':'Simulator'}</button><button className={page==='kits'?'active':''} onClick={()=>setPage('kits')}><Puzzle size={16}/>Kits</button><button className={page==='lab'?'active':''} onClick={()=>setPage('lab')}><Play size={16}/>{es?'Pruebas':'Checks'}{issueCount>0&&<b className="gds-tab-badge">{issueCount}</b>}</button></nav>
    <div className="gds-header-actions"><span>{entities.length.toLocaleString()} {es?'entidades':'entities'} · {edges.length.toLocaleString()} {es?'refs':'refs'}</span><button title={es?'Mostrar u ocultar inspector':'Toggle inspector'} onClick={()=>setShowSettings(v=>!v)}><PanelRightClose size={16}/></button><button title="Undo" onClick={undo}><RotateCcw size={16}/></button><button title={es?'Cerrar':'Close'} aria-label={es?'Cerrar':'Close'} onClick={onClose}><X size={19}/></button></div>
   </header>
   <div className={`gds-columns ${showSettings?'':'gds-no-inspector'}`}>
    <aside className="gds-nav">
     <label className="gds-search"><Search size={15}/><input ref={searchRef} value={query} onChange={e=>setQuery(e.target.value)} placeholder={es?'Buscar entidad, target, clase…  ( / )':'Search entity, target, class…  ( / )'}/>{query&&<button onClick={()=>setQuery('')}><X size={12}/></button>}</label>
     <div className="gds-chips" role="group" aria-label="Category">{categoryOptions.map(([c])=><button key={c} className={category===c?'on':''} onClick={()=>setCategory(c)}><i className="gds-chip-dot" style={{background:CHIP_COLOR[c]}}/>{chipLabel(c)}<small>{c==='all'?entities.length:categoryCounts.get(c)||0}</small></button>)}</div>
     <select className="gds-layer-select" aria-label="Layer" value={layer} onChange={e=>setLayer(e.target.value)}><option value="all">{es?'Todas las capas':'All layers'}</option>{[...workspace.layerCounts.keys()].sort().map(l=><option key={l} value={l}>{l}</option>)}</select>
     {floors.length>1&&<><div className="gds-nav-title"><span>{es?'PISOS':'FLOORS'}</span></div>
      <div className="gds-floors"><button className={heightMode==='all'?'on':''} onClick={()=>{setHeightMode('all');setFloorId(null)}}>{es?'Todos':'All'}</button>{floors.map(f=><button key={f.id} className={heightMode==='floor'&&floorId===f.id?'on':''} title={`Z ${Math.round(f.min)} … ${Math.round(f.max)} · ${f.count}`} onClick={()=>{setHeightMode('floor');setFloorId(f.id)}}>{es?'Piso':'Floor'} {f.index+1}</button>)}<button className={heightMode==='selected'?'on':''} disabled={!current} title={es?'Altura de la entidad seleccionada':'Selected entity height'} onClick={()=>setHeightMode('selected')}>{es?'Nivel sel.':'Sel. level'}</button></div></>}
     <div className="gds-nav-title"><span>{es?'SECTORES':'SECTORS'}</span><button onClick={()=>setZoneId(null)} className={!zoneId?'on':''}>{es?'Todo':'All'}</button></div>
     <div className="gds-zone-list">{zones.slice(zonePage*18,(zonePage+1)*18).map(z=><button className={zoneId===z.id?'active':''} key={z.id} onClick={()=>{setZoneId(zoneId===z.id?null:z.id);if(page!=='logic')setPage('map')}}><MapIcon size={14}/><span><strong>{z.title}</strong><small>{z.count} {es?'entidades':'entities'} · {z.linked} {es?'vinculadas':'linked'}</small></span></button>)}{zones.length>18&&<div className="gds-pagination"><button disabled={zonePage===0} onClick={()=>setZonePage(p=>p-1)}><ChevronLeft size={13}/></button><span>{zonePage+1} / {Math.ceil(zones.length/18)}</span><button disabled={(zonePage+1)*18>=zones.length} onClick={()=>setZonePage(p=>p+1)}><ChevronRight size={13}/></button></div>}</div>
     <div className="gds-nav-title"><span>{es?'ENTIDADES':'ENTITIES'}</span><span>{visible.length}</span></div>
     <div className="gds-entity-list">{pageItems.map(e=><button key={e.id} onClick={()=>choose(e.id)} className={current?.id===e.id?'active':''}><i style={{background:tone(e)}}/><span><strong>{e.props.targetname||entityDisplayName(e,objects)}</strong><small>{e.classname}</small></span>{problemIds.has(e.id)&&<AlertTriangle size={12} className="gds-row-warn"/>}</button>)}</div>
     <div className="gds-pagination"><button disabled={listPage===0} onClick={()=>setListPage(p=>p-1)}><ChevronLeft size={15}/></button><span>{listPage+1} / {pages}</span><button disabled={listPage>=pages-1} onClick={()=>setListPage(p=>p+1)}><ChevronRight size={15}/></button></div>
     <div className="gds-quick"><h3><Plus size={14}/>{es?'CREACIÓN RÁPIDA':'QUICK CREATE'}</h3><div>
      <button onClick={()=>convert('func_door')} title={es?'Convierte el brush seleccionado en func_door':'Turns the selected brush into func_door'}><DoorOpen size={14}/>{es?'Puerta':'Door'}</button>
      <button onClick={()=>convert('func_button')} title={es?'Convierte el brush seleccionado en func_button':'Turns the selected brush into func_button'}><MousePointerClick size={14}/>{es?'Botón':'Button'}</button>
      <button draggable onDragStart={e=>{e.dataTransfer.setData('application/x-sven-relay','1');e.dataTransfer.effectAllowed='copy';}} onClick={createRelay} title={es?'Clic: junto a la selección · Arrastrá al mapa (vista Superior) para colocarlo ahí':'Click: next to the selection · Drag onto the Top map to place it there'}><GitBranch size={14}/>Relay</button></div>
      <button className="gds-demo" onClick={()=>safe(addDemo)}>{es?'Agregar ejemplo: botón → relay → puerta':'Add example: button → relay → door'}</button></div>
    </aside>
    <main className="gds-main">
     {(page==='map'||page==='logic')&&<><div className="gds-mainbar"><div><strong>{page==='logic'?<Workflow size={16}/>:<MapIcon size={16}/>}{page==='logic'?(es?'Lógica del mapa':'Map logic'):zone?.title||(es?'Mapa interactivo':'Interactive map')}</strong><small>{page==='logic'?(es?'Cada columna es un paso de activación: lo que dispara a la izquierda, lo que se activa a la derecha.':'Each column is one activation step: triggers on the left, what they fire on the right.'):(es?'Ubicación de entidades y su cadena de activación':'Entity positions and their activation chain')}</small></div>
       <div className="gds-view-switch">
        {page==='map'&&<><button className={projection==='top'?'on':''} onClick={()=>setProjection('top')}>{es?'Superior':'Top'}</button><button className={projection==='iso'?'on':''} onClick={()=>setProjection('iso')}>Iso</button><button className={showGeometry?'on':''} title={es?'Mostrar el esquema de los brushes':'Show brush outlines'} onClick={()=>setShowGeometry(s=>!s)}>{es?'Brushes':'Brushes'}</button></>}
        <button className={relatedOnly?'on':''} title={es?'Solo la cadena de la entidad seleccionada':'Only the selected entity chain'} onClick={()=>setRelatedOnly(s=>!s)}>{es?'Solo cadena':'Chain only'}</button>
        <button className={showProblems?'on':''} title={es?'Marcar problemas en el mapa':'Mark problems on the map'} onClick={()=>setShowProblems(s=>!s)}><AlertTriangle size={13}/>{problemIds.size}</button>
       </div></div>
      <OverviewCanvas points={points} segments={page==='map'?segments:null} links={glLinks} chain={chain} showAllLinks={page==='logic'} problems={showProblems?problemIds:EMPTY_SET}
       selectedId={current?.id||null} onSelect={choose} onClear={clearSelection} labelFor={labelFor} fitKey={fitKey} focusNonce={focusNonce} mode={page==='logic'?'logic':'map'} onDropRelay={dropRelay} total={page==='logic'?glLinks.length:entities.length}/>
      <div className="gds-main-foot"><Eye size={14}/>{page==='logic'?(es?'Grafo calculado de las referencias nativas (target, killtarget, master…). No cambia el mapa.':'Graph built from native references (target, killtarget, master…). It does not change the map.'):(es?'Vista esquemática: los brushes son referencias de ubicación, no un BSP renderizado. Las líneas animadas son la cadena de la entidad seleccionada.':'Schematic view: brush outlines are approximate. Animated lines are the selected entity chain.')}</div></>}
     {page==='events'&&<><div className="gds-mainbar"><div><strong><Route size={16}/>{es?'Interacciones y referencias':'Interactions & references'}</strong><small>{es?'Cada fila es una referencia nativa.':'Each row is a native reference.'}</small></div><span className="gds-mini-count">{eventRows.length} {es?'relaciones':'relationships'}</span></div>
      <div className="gds-events"><div className="gds-events-head"><span>{es?'ORIGEN':'SOURCE'}</span><span>{es?'REFERENCIA':'REFERENCE'}</span><span>{es?'DESTINO':'DESTINATION'}</span></div>{shownEvents.map(l=>{const a=byId.get(l.from),b=byId.get(l.to);return <div className="gds-event-row" key={l.id}><button onClick={()=>lookup(l.from)}><span className="gds-mini-dot" style={{background:a? tone(a):'#fff'}}/><strong>{a?.props.targetname||a?.classname}</strong><small>{a?.classname}</small></button><span className="gds-event-arrow"><ArrowRight size={15}/><small>{l.via}</small></span><button onClick={()=>lookup(l.to)}><span className="gds-mini-dot" style={{background:b?tone(b):'#fff'}}/><strong>{b?.props.targetname||b?.classname}</strong><small>{b?.classname}</small></button></div>})}{!shownEvents.length&&<p className="gds-empty">{es?'No hay relaciones que coincidan con la búsqueda.':'No matching relationships.'}</p>}</div>
      <div className="gds-events-footer"><button disabled={eventsPage===0} onClick={()=>setEventsPage(p=>p-1)}><ChevronLeft size={14}/></button><span>{eventsPage+1} / {Math.max(1,Math.ceil(eventRows.length/40))}</span><button disabled={(eventsPage+1)*40>=eventRows.length} onClick={()=>setEventsPage(p=>p+1)}><ChevronRight size={14}/></button></div></>}
     {page==='lab'&&<><div className="gds-mainbar"><div><strong><Play size={16}/>{es?'Laboratorio de referencias':'Reference lab'}</strong><small>{es?'Análisis estático, sin simular el motor de Sven Co-op.':'Static analysis, not a Sven Co-op runtime simulation.'}</small></div><button className="gds-action" onClick={()=>setShowIssues(s=>!s)}>{showIssues?(es?'Ver recorrido':'Show trace'):(es?'Ver diagnósticos':'Diagnostics')}</button></div>
      <div className="gds-lab">{showIssues?<><h2><AlertTriangle size={20}/>{es?'Diagnóstico de conexiones':'Reference diagnostics'} <span>{issueCount}</span></h2><p>{es?'Advertencias informativas; ninguna entidad será modificada automáticamente.':'Informational warnings; no entities are changed automatically.'}</p>{!issueCount&&<p className="gds-good"><CheckCircle2 size={16}/>{es?'Sin problemas detectados':'No issues found'}</p>}{warnings.slice(0,100).map((w,i)=><button key={i} className="gds-warning" onClick={()=>{if(w.entityId)lookup(w.entityId)}}><AlertTriangle size={14}/>{w.message}</button>)}{workspace.duplicates.filter(d=>d.referenced).slice(0,40).map(d=><button className="gds-warning" key={d.name} onClick={()=>lookup(d.entityIds[0])}>{es?'Nombre de destino compartido':'Shared targetname'}: {d.name} ({d.entityIds.length})</button>)}</>:<><h2><GitBranch size={19}/>{es?'Recorrido desde la entidad seleccionada':'Trace from selected entity'}</h2><p>{es?'Seleccioná una entidad en el mapa o explorador. El recorrido sigue target, moveto, killtarget y master; no predice tiempos ni acciones en el juego.':'Select an entity. The trace follows target, moveto, killtarget and master; it does not predict game timing or behavior.'}</p>{trail.steps.map((step,i)=>{const e=byId.get(step.entityId);return <button className="gds-trace" key={step.entityId} style={{marginLeft:`${Math.min(step.depth,8)*13}px`}} onClick={()=>lookup(step.entityId)}><span>{i+1}</span><div><strong>{e?.props.targetname||e?.name||e?.classname||step.entityId}</strong><small>{e?.classname} · {step.via}</small></div><ArrowRight size={14}/></button>})}{!trail.steps.length&&<p className="gds-empty">{es?'No hay entidad seleccionada.':'No entity selected.'}</p>}{trail.cycles>0&&<p className="gds-caution">{trail.cycles} {es?'referencias circulares o repetidas':'cyclic or repeated references'}</p>}{trail.truncated&&<p className="gds-caution">{es?'Recorrido limitado para mantener el rendimiento.':'Trace limited for performance.'}</p>}</>}</div></>}
     {page==='sim'&&<><div className="gds-mainbar"><div><strong><Play size={16}/>{es?'Simulador de lógica':'Logic simulator'}</strong><small>{es?'Cómo se dispara la cadena de entidades, paso a paso y con sus tiempos.':'How the entity chain fires, step by step with its timing.'}</small></div></div>
      <div className="gds-kits"><LogicSimulatorPanel objects={objects} selectedId={current?.id??null} onSelect={id=>{setActive(id);select(id);}}/></div></>}
     {page==='kits'&&<><div className="gds-mainbar"><div><strong><Puzzle size={16}/>{es?'Kits de gameplay':'Gameplay kits'}</strong><small>{es?'Configuraciones completas de Svengine basadas en tutoriales de TWHL.':'Complete Svengine setups based on TWHL tutorials.'}</small></div></div>
      <div className="gds-kits gds-kits-wide"><KitGallery wide studio="gameplay" onStart={onClose}/></div></>}
    </main>
    {showSettings&&<aside className="gds-inspector"><div className="gds-inspector-head"><h3><ListFilter size={15}/>{es?'INSPECTOR':'INSPECTOR'}</h3><button onClick={()=>setShowSettings(false)} title="Hide inspector"><X size={15}/></button></div>
     {current?<><div className="gds-selected"><span className="gds-big-dot" style={{background:tone(current)}}/><div><strong>{current.props.targetname||entityDisplayName(current,objects)}</strong><small>{current.classname} · {current.layer||'Unassigned'}</small></div></div>
      <div className="gds-inspector-actions"><button className="gds-action" onClick={()=>{if(page!=='logic')setPage('map');setZoneId(null);setQuery('');setCategory('all');setLayer('all');setFocusNonce(n=>n+1)}}><Focus size={15}/>{es?'Localizar':'Locate'}</button>
       {isMotionPreviewSource(current.classname)&&<button className="gds-action" onClick={()=>{useMotionPreview.getState().open(current.id);onClose()}}><Play size={14}/>{motionLabels(locale).open}</button>}</div>
      <nav className="gds-inspector-tabs" role="tablist"><button role="tab" aria-selected={inspectorTab==='props'} className={inspectorTab==='props'?'on':''} onClick={()=>setInspectorTab('props')}>{es?'Propiedades':'Properties'}</button><button role="tab" aria-selected={inspectorTab==='links'} className={inspectorTab==='links'?'on':''} onClick={()=>setInspectorTab('links')}>{es?'Conexiones':'Connections'} <small>{activeLinks.length}</small></button><button role="tab" aria-selected={inspectorTab==='issues'} className={inspectorTab==='issues'?'on':''} onClick={()=>setInspectorTab('issues')}>{es?'Problemas':'Problems'} {currentWarnings.length>0&&<b className="gds-tab-badge">{currentWarnings.length}</b>}</button></nav>
      {inspectorTab==='props'&&<><section className="gds-inspector-section"><h4>{es?'COMPORTAMIENTO NATIVO':'NATIVE BEHAVIOR'}</h4><p>{guide?.summary||current.classname}</p><button className="gds-mini-guide-toggle" aria-expanded={miniGuide} onClick={()=>setMiniGuide(v=>!v)}><BookOpen size={13}/>{es?'Mini guía · Uso y ejemplo':'Mini guide · Usage and example'}</button>{miniGuide&&guide&&<div className="gds-mini-guide"><ol>{guide.steps.slice(0,5).map((step,i)=><li key={i}>{step}</li>)}</ol><p><strong>{es?'Ejemplo':'Example'}:</strong> {guide.example}</p>{guide.caution&&<p>{guide.caution}</p>}</div>}<button className="gds-guide-btn" onClick={()=>setGuideOpen(true)}><BookOpen size={15}/>{es?'Abrir guía de entidad':'Open entity guide'}</button>
       <InlineEdit key={`${current.id}:name`} label="targetname" value={current.props.targetname||''} commit={v=>safe(()=>setProp(current.id,'targetname',v))}/>
       <InlineEdit key={`${current.id}:target`} label="target" value={current.props.target||''} commit={v=>safe(()=>setProp(current.id,'target',v))}/>
       {(['speed','wait','delay','lip','angle','triggerstate'] as const).filter(key=>key in current.props).map(key=><InlineEdit key={`${current.id}:${key}`} label={key} value={current.props[key]||''} commit={v=>safe(()=>setProp(current.id,key,v))}/>)}
      </section>
      <GameplayEntityFields entity={current} definition={definition} setProp={setProp} es={es}/></>}
      {inspectorTab==='links'&&<section className="gds-inspector-section"><h4>{es?'CONEXIONES':'CONNECTIONS'} <span>{activeLinks.length}</span></h4>{activeLinks.slice(0,40).map(l=><button className="gds-related" key={l.id} onClick={()=>lookup(l.from===current.id?l.to:l.from)}><GitBranch size={13}/><span>{l.from===current.id?'→':'←'} {byId.get(l.from===current.id?l.to:l.from)?.props.targetname||byId.get(l.from===current.id?l.to:l.from)?.classname}</span><small>{l.via}</small></button>)}
       <button className="gds-primary" onClick={()=>{setLinkStart(current.id);if(page!=='logic')setPage('map')}}><Plus size={14}/>{es?'Conectar con otra entidad':'Connect to another entity'}</button>
       {linkStart&&<p className="gds-note">{es?'Elegí la entidad destino en el mapa o en la lista de la izquierda.':'Choose a destination in the map or entity list.'} <button onClick={()=>setLinkStart(null)}>{es?'Cancelar':'Cancel'}</button></p>}
       <button className="gds-secondary" disabled={!current.props.target} onClick={()=>safe(()=>disconnect(current.id))}><Unlink2 size={14}/>{es?'Borrar referencia target':'Clear target reference'}</button>
       <p className="gds-chain-summary">{es?'Cadena':'Chain'}: <b>{chain.nodes.size}</b> {es?'entidades':'entities'} · {outgoing.length} {es?'salientes':'outgoing'} · {workspace.incoming.get(current.id)?.length||0} {es?'entrantes':'incoming'}</p>
       <button className="gds-secondary" onClick={()=>{setPage('lab');setShowIssues(false)}}><Activity size={14}/>{es?'Ver recorrido de referencias':'View reference trace'}</button></section>}
      {inspectorTab==='issues'&&<section className="gds-inspector-section"><h4>{es?'PROBLEMAS':'PROBLEMS'} <span>{currentWarnings.length}</span></h4>{currentWarnings.length?currentWarnings.map((w,i)=><p key={i} className="gds-warning"><AlertTriangle size={14}/>{w.message}</p>):<p className="gds-good"><CheckCircle2 size={16}/>{es?'Sin problemas para esta entidad':'No problems for this entity'}</p>}</section>}
     </>:<div className="gds-no-selection"><MousePointerClick size={25}/><p>{es?'Seleccioná una entidad en el mapa o en la lista para ver sus propiedades, su cadena de activación y sus problemas.':'Select an entity on the map or list to inspect its properties, activation chain and problems.'}</p><small>/ {es?'buscar':'search'} · F {es?'encuadrar':'frame'} · Esc {es?'limpiar':'clear'}</small></div>}
     {notice&&<p className="gds-error" role="alert">{notice}</p>}
    </aside>}
   </div><footer className="gds-footer"><span><CheckCircle2 size={14}/>{es?'Las vistas no modifican el proyecto ni la exportación Valve 220.':'Views do not alter the project or Valve 220 export.'}</span><span>{problemIds.size} {es?'con problemas':'with problems'} · {zones.length} {es?'sectores':'sectors'}</span></footer>
  </section>
  {guideOpen&&current&&createPortal(<div className="gs-guide-overlay" onMouseDown={e=>{if(e.currentTarget===e.target)setGuideOpen(false)}}><section className="gs-guide-dialog" role="dialog" aria-modal="true"><header className="gs-guide-header"><BookOpen size={19}/><h2>{current.classname}</h2><button onClick={()=>setGuideOpen(false)}><X size={20}/></button></header><div className="gs-guide-body"><EntityAssistant key={current.id} entity={current} definition={definition} initiallyOpen/></div><footer className="gs-guide-footer"><button onClick={()=>setGuideOpen(false)}>{es?'Cerrar':'Close'}</button></footer></section></div>,document.body)}
 </div>;
}
const EMPTY_SET=new Set<string>();
