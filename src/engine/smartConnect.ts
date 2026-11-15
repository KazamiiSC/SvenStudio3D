/** HF20 Smart Connect: connect arbitrary *convex brush faces* along an editable
 * spatial route. The only output is ordinary closed, validated Valve 220 brushes.
 * Never edit or cut either source brush as a side effect. */
import {Vector3} from 'three';
import {ConvexHull} from 'three-stdlib';
import type {Brush,MapObject,Project,Vec3} from './types';
import {uid} from './types';
import {transformedVertices,orientFaces} from './geometry';
import {workshopFrame} from './brushWorkshop';
import {samplePath,sweepFrames3D} from './pathStructures';
import {exportBrush,validateBrush} from './exportMap';
import {inspectMapImport} from './importMap';
import {intersectConvex,subtractConvex} from './advancedModeling';

export type ConnectionEnd={brushId:string;faceIndex:number};
export type SmartConnectOptions={points:Vec3[];quality:4|8|12;mode:'angular'|'smooth';texture:string;clearance:number;transition?:'linear'|'ease'|'hold-start'|'hold-end';};
export type ConnectionCutRecord={original:Brush;pieces:{id:string;signature:string}[]};
export type ConnectionCutDraft={original:Brush;fragments:Brush[]};
export type SmartConnectionRecord={id:string;from:ConnectionEnd;to:ConnectionEnd;options:SmartConnectOptions;brushIds:string[];signatures:string[];cuts?:ConnectionCutRecord[];};
export type ConnectPreview={brushes:Brush[];collisions:string[];warnings:string[];stations:Vec3[];};
export type ConnectionObstacle={min:Vec3;max:Vec3;id:string;name:string};
type Box3=ConnectionObstacle;
const v=(p:Vec3)=>new Vector3(...p);
const tuple=(p:Vector3):Vec3=>[p.x,p.y,p.z].map(n=>Math.round(n*10000)/10000) as Vec3;
const dist=(a:Vec3,b:Vec3)=>v(a).distanceTo(v(b));
const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
const validTexture=(s:string)=>/^[^\s"()[\]]{1,32}$/.test(s);
export function connectionSignature(b:Brush):string{
 const source=JSON.stringify([b.position,b.rotation,b.scale,b.vertices,b.faces,b.hidden,b.locked]);
 let a=2166136261,b2=5381;
 for(let i=0;i<source.length;i++){
  const char=source.charCodeAt(i);
  a=Math.imul(a^char,16777619)>>>0;
  b2=(Math.imul(b2,33)^char)>>>0;
 }
 return `${source.length.toString(16)}:${a.toString(16)}:${b2.toString(16)}`;
}
export function faceCenter(brush:Brush,index:number):Vec3{
 return workshopFrame(brush,index).origin;
}
export function defaultConnectionFace(brush:Brush,other:Brush):number{
 const target=v(other.position);
 let best=-Infinity,result=0;
 for(let i=0;i<brush.faces.length;i++){
  try{const face=workshopFrame(brush,i);const to=target.clone().sub(v(face.origin));
   const len=to.length();const score=v(face.normal).dot(to.normalize())+0.08*Math.min(1,len/512);
   if(score>best){best=score;result=i;}
  }catch{/* ignore degenerate candidate faces */}
 }
 return result;
}
export function boundsOfBrush(brush:Brush):Box3{
 const points=transformedVertices(brush);
 return {id:brush.id,name:brush.editorAlias||brush.name,
  min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))) as Vec3,
  max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))) as Vec3};
}
function segmentThroughBox(a:Vec3,b:Vec3,box:Box3,margin=0):boolean{
 let tmin=0,tmax=1;
 for(let axis=0;axis<3;axis++){
  const d=b[axis]-a[axis],lo=box.min[axis]-margin,hi=box.max[axis]+margin;
  if(Math.abs(d)<1e-8){if(a[axis]<=lo||a[axis]>=hi)return false;continue;}
  const t1=(lo-a[axis])/d,t2=(hi-a[axis])/d;
  tmin=Math.max(tmin,Math.min(t1,t2));tmax=Math.min(tmax,Math.max(t1,t2));
  if(tmin>=tmax)return false;
 }
 return tmax>0&&tmin<1;
}
export function collidingPath(points:Vec3[],boxes:Box3[],clearance=0):string[]{
 const set=new Set<string>();
 for(let i=1;i<points.length;i++)for(const box of boxes)
  if(segmentThroughBox(points[i-1],points[i],box,clearance))set.add(box.id);
 return [...set];
}
/** Conservative broad-phase bounds. Ignore original endpoints and hidden items;
 * an AABB may warn about a rotated brush even when its real geometry is clear. */
export function obstacleBoxes(objects:readonly MapObject[],from:string,to:string,area?:{min:Vec3;max:Vec3}):Box3[]{
 const list:Box3[]=[];
 for(const o of objects){if(o.kind!=='brush'||o.id===from||o.id===to||o.hidden)continue;
  const box=boundsOfBrush(o);
  if(area&&[0,1,2].some(i=>box.max[i]<area.min[i]||box.min[i]>area.max[i]))continue;
  list.push(box);
 }
 return list;
}
const cleanPoints=(points:Vec3[])=>points.filter((p,i)=>!i||dist(p,points[i-1])>1).map(p=>tuple(v(p)));
/** Multi-obstacle, clearance-aware 3D visibility graph. Routes around corners
 * in X/Y/Z (not just the first intersected wall). Every edge is checked against
 * the inflated AABB of all nearby solid brushes; no claim of global optimality
 * or exact mesh/CSG collision. Exposed points remain editable in XY and XZ.
 * Search is capped so a large MAP never freezes the editor. */
export function suggestConnectionRoute(start:Vec3,end:Vec3,sourceNormal:Vec3,targetNormal:Vec3,boxes:Box3[],clearance=24):{points:Vec3[];blocked:boolean;considered:number}{
 const margin=clamp(clearance,0,4096)+18; // room for larger destination profile and elbow hulls
 const offset=Math.max(16,clearance+12);
 // Endpoints can be close to walls. Do not put an approach point *inside*
 // the expanded obstacle just because the profile is wide.
 const safeStandoff=(point:Vec3,normal:Vec3)=>{
  for(const d of [offset,Math.min(offset,32),Math.min(offset,16),0]){
   const candidate=tuple(v(point).addScaledVector(v(normal).normalize(),d));
   if(!boxes.some(box=>candidate.every((n,i)=>n>box.min[i]-margin+0.05&&n<box.max[i]+margin-0.05)))return candidate;
  }
  return point;
 };
 const s=safeStandoff(start,sourceNormal),e=safeStandoff(end,targetNormal);
 const visible=(a:Vec3,b:Vec3,obstacles:Box3[])=>!obstacles.some(box=>segmentThroughBox(a,b,box,margin));
 const segmentDistance=(p:Vec3,a:Vec3,b:Vec3)=>{
  const d=v(b).sub(v(a));const t=clamp(v(p).sub(v(a)).dot(d)/Math.max(d.lengthSq(),1),0,1);
  return v(p).distanceTo(v(a).addScaledVector(d,t));
 };
 const boxDistance=(box:Box3)=>{
  const center=box.min.map((n,i)=>clamp((start[i]+end[i])*0.5,n,box.max[i])) as Vec3;
  return segmentDistance(center,start,end);
 };
 // Cheap direct case; keeps straight routes simple on large maps.
 if(visible(start,end,boxes))return {points:[start,end],blocked:false,considered:boxes.length};
 const blocking=new Set<string>(collidingPath([start,end,s,e],boxes,margin));
 // More obstacles can be encountered while detouring. Add those iteratively,
 // without considering every brush in a thousand-brush map as a graph node.
 const nearby=[...boxes].sort((a,b)=>boxDistance(a)-boxDistance(b)).filter(b=>{
  const radius=Math.max(256,dist(start,end)*0.7+margin*3);
  return boxDistance(b)<radius;
 });
 const active:Box3[]=nearby.filter(b=>blocking.has(b.id)).slice(0,32);
 const tried=new Set(active.map(b=>b.id));
 if(!active.length){for(const b of nearby.slice(0,4)){active.push(b);tried.add(b.id);}}
 let fallback:Vec3[]=[start,end],bestCount=collidingPath(fallback,boxes,margin).length;
 for(let attempt=0;attempt<5;attempt++){
  const corners:Vec3[]=[s,e];const keys=new Set(corners.map(p=>p.map(n=>Math.round(n*100)/100).join(':')));
  for(const box of active){
   for(const x of [box.min[0]-margin,box.max[0]+margin])
   for(const y of [box.min[1]-margin,box.max[1]+margin])
   for(const z of [box.min[2]-margin,box.max[2]+margin]){
    const p:Vec3=[x,y,z];const key=p.map(n=>Math.round(n*100)/100).join(':');
    if(keys.has(key)||active.some(other=>other!==box&&
      p.every((n,i)=>n>other.min[i]-margin+0.05&&n<other.max[i]+margin-0.05)))continue;
    corners.push(p);keys.add(key);
   }
  }
  // Dijkstra over a dense visibility graph of at most 258 nodes. Edge checks
  // are lazy; short edges are preferred without forbidding necessary detours.
  const n=corners.length,known=new Float64Array(n).fill(Infinity);
  const previous=new Int16Array(n).fill(-1),seen=new Uint8Array(n);
  known[0]=0;
  for(let visited=0;visited<n;visited++){
   let at=-1,smallest=Infinity;
   for(let i=0;i<n;i++)if(!seen[i]&&known[i]<smallest){at=i;smallest=known[i];}
   if(at<0||at===1)break;seen[at]=1;
   for(let next=1;next<n;next++){
    if(seen[next]||next===at)continue;
    const length=dist(corners[at],corners[next]);if(length<8)continue;
    const cost=known[at]+length+3;
    if(cost>=known[next]||!visible(corners[at],corners[next],active))continue;
    known[next]=cost;previous[next]=at;
   }
  }
  if(Number.isFinite(known[1])){
   const indices:number[]=[1];let cursor=1;
   while(cursor!==0&&indices.length<=n){cursor=previous[cursor];if(cursor<0)break;indices.unshift(cursor);}
   if(indices[0]===0){
    let route=cleanPoints([start,...indices.map(i=>corners[i]),end]);
    // Remove detours that are unnecessary with *all* the real obstacles.
    for(let i=0;i<route.length-2;i++)for(let j=route.length-1;j>i+1;j--){
     if(visible(route[i],route[j],boxes)){
      route=[...route.slice(0,i+1),...route.slice(j)];break;
     }
    }
    const hits=collidingPath(route,boxes,margin);
    if(hits.length<bestCount){bestCount=hits.length;fallback=route;}
    if(!hits.length&&route.length<=24&&route.every((p,i)=>i===0||dist(route[i-1],p)>=8))
      return {points:route,blocked:false,considered:active.length};
    for(const id of hits){const box=nearby.find(b=>b.id===id);if(box&&!tried.has(id)&&active.length<32){active.push(box);tried.add(id);}}
   }
  }
  // No route yet: expand scope by nearby obstacles so the graph can see
  // alternative corners instead of retrying the same failed detour.
  let added=0;
  for(const box of nearby){if(!tried.has(box.id)&&active.length<32){active.push(box);tried.add(box.id);if(++added>=5)break;}}
  if(!added&&active.length>=32)break;
  if(!added&&active.length===nearby.length)break;
 }
 return {points:fallback.length>24?[...fallback.slice(0,23),end]:fallback,blocked:true,considered:active.length};
}
/** A limited collection of genuinely different alternatives. A route is a
 * suggestion, not proof that its swept geometry is collision-free: callers must
 * run generateSmartConnection and show the resulting warnings before commit. */
export type ConnectionRouteAlternative={id:'shortest'|'fewest'|'over'|'under'|'left'|'right';points:Vec3[];length:number;collisions:number;considered:number};
function routeLength(points:readonly Vec3[]):number{return points.slice(1).reduce((sum,p,i)=>sum+dist(points[i],p),0);}
export function suggestConnectionAlternatives(start:Vec3,end:Vec3,sourceNormal:Vec3,targetNormal:Vec3,boxes:Box3[],clearance=24):ConnectionRouteAlternative[]{
 const margin=clamp(clearance,0,4096)+18;
 const candidates:ConnectionRouteAlternative[]=[];
 const visited=new Set<string>();
 const add=(id:ConnectionRouteAlternative['id'],points:Vec3[],considered:number)=>{
  const cleaned=cleanPoints(points);
  if(cleaned.length<2||cleaned.length>24||cleaned.some(p=>p.some(n=>!Number.isFinite(n))))return;
  const key=cleaned.map(p=>p.map(n=>Math.round(n*4)/4).join(',')).join(';');
  if(visited.has(key))return;visited.add(key);
  candidates.push({id,points:cleaned,length:routeLength(cleaned),collisions:collidingPath(cleaned,boxes,margin).length,considered});
 };
 const base=suggestConnectionRoute(start,end,sourceNormal,targetNormal,boxes,clearance);
 add('shortest',base.points,base.considered);
 // When the direct path is free, adding gratuitous bends makes the map worse.
 const blockers=boxes.filter(box=>segmentThroughBox(start,end,box,margin));
 if(!blockers.length)return candidates;
 const vector=v(end).sub(v(start)),span=vector.length();
 if(span<16)return candidates;
 const axis=vector.normalize();
 const side=new Vector3(-axis.y,axis.x,0).normalize();
 if(side.lengthSq()<0.01)side.set(1,0,0);
 const mid=v(start).add(v(end)).multiplyScalar(.5);
 // Use the actual bounds of blockers along the route, not the entire map.
 const projections=blockers.flatMap(box=>{
  const corners:Vector3[]=[];
  for(const x of [box.min[0],box.max[0]])for(const y of [box.min[1],box.max[1]])for(const z of [box.min[2],box.max[2]])corners.push(new Vector3(x,y,z));
  return corners;
 });
 const forward=projections.map(p=>p.clone().sub(v(start)).dot(axis));
 const first=clamp(Math.min(...forward)-margin-12,0,span),last=clamp(Math.max(...forward)+margin+12,0,span);
 const p0=v(start).addScaledVector(axis,first),p1=v(start).addScaledVector(axis,last);
 const strategies:{id:'over'|'under'|'left'|'right';direction:Vector3;min:number;max:number}[]=[
  {id:'over',direction:new Vector3(0,0,1),min:0,max:0},
  {id:'under',direction:new Vector3(0,0,1),min:0,max:0},
  {id:'left',direction:side,min:0,max:0},
  {id:'right',direction:side,min:0,max:0},
 ];
 for(const strategy of strategies){
  const values=projections.map(p=>p.clone().sub(mid).dot(strategy.direction));
  strategy.min=Math.min(...values);strategy.max=Math.max(...values);
  const amount=(strategy.id==='over'||strategy.id==='left'?strategy.max+margin+12:strategy.min-margin-12);
  const guides=[tuple(p0.clone().addScaledVector(strategy.direction,amount)),tuple(p1.clone().addScaledVector(strategy.direction,amount))];
  let points=cleanPoints([start,...guides,end]);
  // If a guide itself has another obstruction, try one bounded visibility search
  // per obstructed leg. Do not repeat expensive global searches indefinitely.
  if(collidingPath(points,boxes,margin).length){
   const routed:Vec3[]=[start];let considered=0;
   for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    if(!collidingPath([a,b],boxes,margin).length){routed.push(b);continue;}
    const sub=suggestConnectionRoute(a,b,i===1?sourceNormal:tuple(v(b).sub(v(a)).normalize()),i===points.length-1?targetNormal:tuple(v(a).sub(v(b)).normalize()),boxes,clearance);
    considered+=sub.considered;
    routed.push(...sub.points.slice(1));
   }
   if(routed.length<=24)points=cleanPoints(routed);
   add(strategy.id,points,considered);
  }else add(strategy.id,points,blockers.length);
 }
 // The low-brush option deliberately prefers simpler routes that do not add
 // unnecessary stations; it never labels a collision route as collision-free.
 const simplest=[...candidates].sort((a,b)=>a.collisions-b.collisions||a.points.length-b.points.length||a.length-b.length)[0];
 if(simplest&&simplest.id!=='shortest') { /* The simplest route is already listed under its real direction; no duplicate. */ }
 return candidates.sort((a,b)=>a.collisions-b.collisions||a.length-b.length).slice(0,6);
}
/** Optional morph easing; identity is backwards compatible with HF20 files. */
export function connectionTransitionWeight(t:number,transition:SmartConnectOptions['transition']='linear'):number{
 const clamped=clamp(t,0,1);
 switch(transition){
  case 'ease':return clamped*clamped*(3-2*clamped);
  case 'hold-start':return clamped*clamped;
  case 'hold-end':return 1-(1-clamped)*(1-clamped);
  default:return clamped;
 }
}
type Profile={frame:ReturnType<typeof workshopFrame>;contour:[number,number][]};
function faceProfile(brush:Brush,index:number,reverse:boolean):Profile{
 const frame=workshopFrame(brush,index);
 const normal=v(frame.normal).multiplyScalar(reverse?-1:1).normalize();
 const up=new Vector3(0,0,1);if(Math.abs(up.dot(normal))>0.96)up.set(0,1,0);
 up.addScaledVector(normal,-up.dot(normal)).normalize();
 const right=new Vector3().crossVectors(up,normal).normalize();
 const center=v(frame.origin),verts=transformedVertices(brush).map(v);
 const polygon=brush.faces[index].indices.map(i=>[verts[i].clone().sub(center).dot(right),verts[i].clone().sub(center).dot(up)] as [number,number]);
 const signs:number[]=[];
 for(let i=0;i<polygon.length;i++){
  const a=polygon[i],b=polygon[(i+1)%polygon.length],c=polygon[(i+2)%polygon.length];
  const cross=(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);if(Math.abs(cross)>1e-6)signs.push(Math.sign(cross));
 }
 if(signs.some(x=>x!==signs[0]))throw Error('Smart Connect requires a convex face profile. Select a convex face or split the profile into brushes.');
 const area=polygon.reduce((acc,p,i)=>{const n=polygon[(i+1)%polygon.length];return acc+p[0]*n[1]-p[1]*n[0]},0);
 const ordered=area<0?[...polygon].reverse():[...polygon];
 const first=ordered.reduce((i,p,j)=>p[0]>ordered[i][0]||p[0]===ordered[i][0]&&p[1]>ordered[i][1]?j:i,0);
 return {frame,contour:[...ordered.slice(first),...ordered.slice(0,first)]};
}
function profilePerimeter(contour:[number,number][]):{breaks:number[];edges:number[];total:number}{
 const edges=contour.map((p,i)=>Math.hypot(p[0]-contour[(i+1)%contour.length][0],p[1]-contour[(i+1)%contour.length][1]));
 const total=edges.reduce((a,b)=>a+b,0);
 if(total<0.1)throw Error('Selected face is too small.');
 let length=0;const breaks=edges.map(edge=>{const t=length/total;length+=edge;return t});
 return {breaks,edges,total};
}
function atFraction(contour:[number,number][],profile:ReturnType<typeof profilePerimeter>,t:number):[number,number]{
 let distance=t*profile.total,i=0;
 while(i<profile.edges.length-1&&distance>profile.edges[i]){distance-=profile.edges[i];i++;}
 const a=contour[i],b=contour[(i+1)%contour.length];const u=profile.edges[i]<1e-9?0:distance/profile.edges[i];
 return [a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u];
}
function sharedProfiles(a:Profile,b:Profile,quality:number){
 const ap=profilePerimeter(a.contour),bp=profilePerimeter(b.contour);
 const fractions=[...ap.breaks,...bp.breaks,...Array.from({length:quality},(_,i)=>i/quality)]
  .sort((x,y)=>x-y).filter((t,i,all)=>i===0||t-all[i-1]>0.00001);
 if(fractions.length>80)throw Error('Selected profiles have too many corners. Simplify the source face.');
 return {a:fractions.map(t=>atFraction(a.contour,ap,t)),b:fractions.map(t=>atFraction(b.contour,bp,t))};
}
function simplifyContour(poly:readonly [number,number][]):[number,number][]{
 let points=[...poly];
 for(let rounds=0;rounds<3;rounds++){
  if(points.length<=3)break;
  const next=points.filter((p,i)=>{
   const a=points[(i-1+points.length)%points.length],b=points[(i+1)%points.length];
   const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
   const dist=length>1e-6?Math.abs(dx*(p[1]-a[1])-dy*(p[0]-a[0]))/length:0;
   return dist>0.02&&Math.hypot(p[0]-a[0],p[1]-a[1])>0.03;
  });
  if(next.length===points.length||next.length<3)break;
  points=next;
 }
 return points;
}
/** ConvexHull planes merged to maximal polygon boundaries. Coplanar samples
 * and duplicate vertices are removed: otherwise GoldSrc sees zero-area faces
 * and non-manifold edges on rectangular profiles at high resolution. */
function connectionHull(source:Vec3[],texture:string,name:string,group:string):Brush{
 const points:Vector3[]=[];
 for(const p of source){const point=v(p);if(!points.some(q=>q.distanceToSquared(point)<0.000001))points.push(point);}
 if(points.length<4)throw Error('Connection section is degenerate. Increase waypoint spacing.');
 const hull=new ConvexHull().setFromPoints(points);
 const indices=(point:Vector3)=>{
  const index=points.findIndex(p=>p.distanceToSquared(point)<0.000001);
  if(index<0)throw Error('Cannot resolve convex hull vertex.');return index;
 };
 type Surface={normal:Vector3;constant:number;triangles:number[][]};
 const groups:Surface[]=[];
 for(const face of hull.faces){
  const edge=face.edge;
  const tri=[indices(edge.head().point),indices(edge.next.head().point),indices(edge.next.next.head().point)];
  const [a,b,c]=tri.map(i=>points[i]);
  const normal=b.clone().sub(a).cross(c.clone().sub(a));
  if(normal.lengthSq()<1e-12)continue;
  normal.normalize();const constant=normal.dot(a);
  let match=groups.find(p=>p.normal.dot(normal)>0.999999&&Math.abs(p.constant-constant)<0.005);
  if(!match){match={normal,constant,triangles:[]};groups.push(match);}
  match.triangles.push(tri);
 }
 const faces:Brush['faces']=[];
 for(const surface of groups){
  // The boundary of adjacent coplanar triangles is exact. Never infer a new
  // outline from all near-plane points, as that causes dangling MAP edges.
  const edges=new Map<string,{a:number;b:number;count:number}>();
  for(const tri of surface.triangles)for(let j=0;j<3;j++){
   const a=tri[j],b=tri[(j+1)%3],key=`${Math.min(a,b)}:${Math.max(a,b)}`;
   const old=edges.get(key);if(old)old.count++;else edges.set(key,{a,b,count:1});
  }
  const boundary=[...edges.values()].filter(e=>e.count===1);
  if(boundary.length<3)throw Error(`${name}: invalid convex boundary.`);
  const next=new Map<number,number>();
  for(const edge of boundary){if(next.has(edge.a))throw Error(`${name}: ambiguous boundary.`);next.set(edge.a,edge.b);}
  const ring:number[]=[];let current=boundary[0].a;
  do{if(ring.includes(current)||!next.has(current))throw Error(`${name}: open hull boundary.`);ring.push(current);current=next.get(current)!;}while(current!==ring[0]&&ring.length<=boundary.length);
  if(ring.length!==boundary.length||current!==ring[0])throw Error(`${name}: incomplete boundary.`);
  // GoldSrc uses a face's first 3 vertices to define its plane. Rotate to
  // a non-collinear triple while retaining every real hull edge.
  let offset=-1;
  for(let i=0;i<ring.length;i++){
   const a=points[ring[i]],b=points[ring[(i+1)%ring.length]],c=points[ring[(i+2)%ring.length]];
   if(b.clone().sub(a).cross(c.clone().sub(a)).length()>0.02){offset=i;break;}
  }
  if(offset<0)throw Error(`${name}: degenerate hull face.`);
  faces.push({indices:[...ring.slice(offset),...ring.slice(0,offset)],texture});
 }
 const vertices=points.map(tuple);
 const brush:Brush={id:uid(),kind:'brush',primitive:'poly',name,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices,faces:orientFaces(vertices,faces),group,layer:'Smart Connect'};
 const errors=validateBrush(brush);if(errors.length)throw Error(`${name}: ${errors[0]}`);
 return brush;
}
/** Rare fallback for numerically ambiguous polygon-plane merges. Triangulated
 * convex hull surfaces and one interior point form closed convex tetrahedra;
 * this is safer than silently accepting a broken multi-face MAP brush. */
function fallbackTetrahedra(source:Vec3[],texture:string,name:string,group:string):Brush[]{
 const points:Vector3[]=[];
 for(const p of source){const point=v(p);if(!points.some(q=>q.distanceToSquared(point)<0.000001))points.push(point);}
 if(points.length<4)throw Error('Degenerate sweep segment.');
 const hull=new ConvexHull().setFromPoints(points);
 const hullPoints:Vector3[]=[];
 const faces=hull.faces.map(face=>{
  const edge=face.edge,tri=[edge.head().point,edge.next.head().point,edge.next.next.head().point];
  tri.forEach(p=>{if(!hullPoints.some(q=>q.distanceToSquared(p)<0.000001))hullPoints.push(p)});
  return tri;
 });
 const middle=hullPoints.reduce((sum,p)=>sum.add(p),new Vector3()).divideScalar(hullPoints.length);
 const out:Brush[]=[];
 for(const [index,face] of faces.entries()){
  const [a,b,c]=face;const volume=Math.abs(b.clone().sub(a).cross(c.clone().sub(a)).dot(middle.clone().sub(a)))/6;
  if(volume<0.001)throw Error('Connection produces a sub-unit sliver. Move the waypoint or reduce quality.');
  const vertices=[...face.map(tuple),tuple(middle)];
  const brush:Brush={id:uid(),kind:'brush',primitive:'poly',name:`${name} · ${index+1}`,position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices,
    faces:orientFaces(vertices,[[0,1,2],[0,3,1],[1,3,2],[2,3,0]].map(indices=>({indices,texture}))),group,layer:'Smart Connect'};
  const errors=validateBrush(brush);if(errors.length)throw Error(`Fallback geometry is invalid: ${errors[0]}`);
  out.push(brush);
 }
 return out;
}
/** Computes actual MAP geometry. No store writes until the caller confirms. */
export function generateSmartConnection(fromBrush:Brush,toBrush:Brush,fromFace:number,toFace:number,options:SmartConnectOptions,objects:readonly MapObject[],connectionId='preview',cachedObstacles?:ConnectionObstacle[]):ConnectPreview{
 if(fromBrush.id===toBrush.id)throw Error('Choose two different brushes.');
 if(fromBrush.hidden||toBrush.hidden||fromBrush.locked||toBrush.locked)throw Error('Source and destination must be visible, unlocked brushes.');
 if(!validTexture(options.texture))throw Error('Invalid GoldSrc texture name.');
 if(![4,8,12].includes(options.quality))throw Error('Unsupported quality setting.');
 if(!Number.isFinite(options.clearance)||options.clearance<0||options.clearance>512)throw Error('Clearance must be 0–512 units.');
 if(options.points.length<2||options.points.length>24||options.points.some(p=>p.length!==3||p.some(n=>!Number.isFinite(n)||Math.abs(n)>131000)))throw Error('Route requires 2–24 valid control points.');
 const start=faceCenter(fromBrush,fromFace),end=faceCenter(toBrush,toFace);
 const controls=[start,...options.points.slice(1,-1),end];
 if(controls.some((p,i)=>i>0&&dist(p,controls[i-1])<8))throw Error('Adjacent route points must be at least 8 units apart.');
 const a=faceProfile(fromBrush,fromFace,false),b=faceProfile(toBrush,toFace,true);
 const profiles=sharedProfiles(a,b,options.quality);
 // Smooth curves can put many almost coincident GoldSrc planes together.
 // Retain quality in the face profile but avoid short sweep stations that
 // import as collapsed brushes or get lost during MAP reconstruction.
 const rawPlan=options.mode==='smooth'&&controls.length>2
  ?samplePath({points:controls,kind:'pipe',width:16,height:16,wallThickness:2,texture:options.texture,smooth:true,subdivisions:options.quality}):controls;
 const profileRadius=Math.max(...[fromBrush,toBrush].map((brush,i)=>{
  const indices=brush.faces[i===0?fromFace:toFace].indices,center=v(i===0?start:end),world=transformedVertices(brush);
  return Math.max(...indices.map(index=>v(world[index]).distanceTo(center)));
 }));
 const isSmooth=options.mode==='smooth'&&controls.length>2;
 const group=`Smart Connect · ${connectionId}`;
 // Reattempt at progressively coarser station spacing if Valve 220 planes
 // cannot round-trip. Never commit a brush that the MAP parser would omit.
 const spacings=isSmooth?[Math.max(24,profileRadius*0.8),Math.max(40,profileRadius*1.15),Math.max(64,profileRadius*1.5),Math.max(92,profileRadius*2)]:[0];
 let result:{brushes:Brush[];plan:Vec3[]}|null=null;
 let reason='';
 for(const spacing of spacings){
  const plan:Vec3[]=spacing?[]:[...rawPlan];
  // Keep only stations separated from the last accepted station. Never
  // discard the exact start/end face centers, even on short connections.
  if(spacing){
   plan.length=0;plan.push(rawPlan[0]);
   for(let i=1;i<rawPlan.length-1;i++){
    if(dist(rawPlan[i],plan[plan.length-1])>=spacing)plan.push(rawPlan[i]);
   }
   while(plan.length>1&&dist(plan.at(-1)!,rawPlan.at(-1)!)<spacing*0.7)plan.pop();
   plan.push(rawPlan.at(-1)!);
  }
  if(plan.length>96){reason='Too many curve stations. Reduce points or detail.';continue;}
  try{
   const frames=sweepFrames3D(plan);
   const rings:Vec3[][]=frames.map((frame,index)=>{
    const t=index/(frames.length-1);
    const blend=connectionTransitionWeight(t,options.transition);
    const ring=index===0?a.contour:index===frames.length-1?b.contour:
      simplifyContour(profiles.a.map((p,i)=>[p[0]*(1-blend)+profiles.b[i][0]*blend,p[1]*(1-blend)+profiles.b[i][1]*blend] as [number,number]));
    if(index===0||index===frames.length-1){
     const profile=index===0?a:b;
     const n=v(profile.frame.normal).multiplyScalar(index===0?1:-1);
     const up=new Vector3(0,0,1);if(Math.abs(up.dot(n))>0.96)up.set(0,1,0);
     up.addScaledVector(n,-up.dot(n)).normalize();const right=new Vector3().crossVectors(up,n).normalize();
     const origin=v(profile.frame.origin);
     return ring.map(p=>tuple(origin.clone().addScaledVector(right,p[0]).addScaledVector(up,p[1])));
    }
    return ring.map(p=>tuple(frame.center.clone().addScaledVector(frame.right,-p[0]).addScaledVector(frame.up,p[1])));
   });
   const brushes:Brush[]=[];
   for(let i=0;i<rings.length-1;i++){
    if(dist(plan[i],plan[i+1])<5)throw Error('A route segment is too short to produce a valid brush.');
    const points=[...rings[i],...rings[i+1]];
    const name=`Connect ${i+1}/${rings.length-1}`;
    try{brushes.push(connectionHull(points,options.texture,name,group));}
    catch{brushes.push(...fallbackTetrahedra(points,options.texture,name,group));}
   }
   if(brushes.length>96)throw Error('Smart Connect is limited to 96 brushes per operation.');
   // Verify the exported brushes can be imported independently, rather than
   // trusting a Three.js convex hull which might exceed GoldSrc precision.
   const content=`{\n"classname" "worldspawn"\n${brushes.map(exportBrush).join('\n')}\n}\n`;
   let report=inspectMapImport(content).report;
   if(report.skippedBrushes){
    // Repair only the specific sections whose large coplanar faces fail
    // GoldSrc's plane-based round-trip, leaving all other solids untouched.
    const skipped=new Set((report.skippedDetails??[]).map(item=>item.brush-1));
    const repaired=brushes.flatMap((brush,index)=>skipped.has(index)
      ?fallbackTetrahedra(brush.vertices,options.texture,brush.name,group):[brush]);
    if(repaired.length<=96){
     const test=`{\n"classname" "worldspawn"\n${repaired.map(exportBrush).join('\n')}\n}\n`;
     const fixed=inspectMapImport(test).report;
     if(!fixed.skippedBrushes){brushes.length=0;brushes.push(...repaired);report=fixed;}
    }
   }
   if(report.skippedBrushes)throw Error(`MAP reconstruction skipped ${report.skippedBrushes} of ${brushes.length} brushes. ${report.skippedLocations[0]||''}`);
   result={brushes,plan};break;
  }catch(error){reason=String(error instanceof Error?error.message:error);}
 }
 if(!result)throw Error(`The connection could not be exported as valid GoldSrc brushes. Try wider waypoint spacing, a simpler profile, or lower detail. ${reason}`);
 const {brushes,plan}=result;
 const clearance=options.clearance;
 const extent=Math.max(64,dist(start,end)*0.5+clearance+32);
 const area={min:[0,1,2].map(i=>Math.min(start[i],end[i])-extent) as Vec3,max:[0,1,2].map(i=>Math.max(start[i],end[i])+extent) as Vec3};
 const boxes=cachedObstacles??obstacleBoxes(objects,fromBrush.id,toBrush.id,area);
 const collisionIds=collidingPath(plan,boxes,clearance+profileRadius);
 const warnings:string[]=[];
 if(collisionIds.length)warnings.push(`Path possibly intersects ${collisionIds.length} other brush(es). Verify the 3D preview and adjust waypoints; AABB checks are conservative.`);
 if(brushes.length>48)warnings.push(`${brushes.length} brushes generated. Consider reducing quality for large maps.`);
 return {brushes,collisions:collisionIds,warnings,stations:plan};
}
/** Object IDs managed by another parametric tool must never be replaced
 * by an opening: their persistent provenance would otherwise be corrupted. */
export function protectedOpeningIds(project:Project):Set<string>{
 return new Set([
  ...(project.linkedPrefabs??[]).flatMap(r=>[...r.sourceIds,...r.instances.flatMap(i=>Object.values(i.memberIds))]),
  ...(project.architectureAssemblies??[]).flatMap(r=>r.memberIds),
  ...(project.architectureLayouts??[]).flatMap(r=>r.memberIds),
  ...(project.architectureOpenings??[]).flatMap(r=>[r.wall.id,...r.memberIds]),
  ...(project.blueprintPlans??[]).flatMap(r=>r.memberIds),
  ...(project.pathGroups??[]).flatMap(r=>r.brushIds),
  ...(project.terrainGroups??[]).flatMap(r=>r.brushIds),
  ...(project.curveAssemblies??[]).flatMap(r=>r.memberIds),
  ...(project.brushComposites??[]).flatMap(r=>r.memberIds),
 ]);
}
/** Opt-in opening in world geometry. Cut only the *selected* blockers and
 * never touch other brushes, linked sources, locked objects or brush entities.
 * Entire calculation is pure: store mutation/Undo is handled atomically later.
 * An opening follows the actual convex connection, not its broadphase AABB. */
export function planConnectionOpenings(preview:ConnectPreview,originals:readonly Brush[],maxCuts=4):ConnectionCutDraft[]{
 if(originals.length>maxCuts)throw Error(`Choose at most ${maxCuts} obstacle brushes for openings.`);
 if(new Set(originals.map(b=>b.id)).size!==originals.length)throw Error('Duplicate opening target.');
 const cuts:ConnectionCutDraft[]=[];
 for(const original of originals){
  if(original.hidden||original.locked||original.entityId)throw Error('Openings require visible, unlocked world brushes.');
  let fragments:Brush[]=[original];let impacted=0;
  // Real intersections only; broadphase AABB warnings may be false positives.
  for(const cutter of preview.brushes){
     const sourceBox=boundsOfBrush(original),cutBox=boundsOfBrush(cutter);
   if([0,1,2].some(i=>cutBox.max[i]<=sourceBox.min[i]+0.001||cutBox.min[i]>=sourceBox.max[i]-0.001))continue;
   let changed=false;
   const next:Brush[]=[];
   for(const fragment of fragments){
    const b1=boundsOfBrush(fragment);
    if([0,1,2].some(i=>cutBox.max[i]<=b1.min[i]+0.001||cutBox.min[i]>=b1.max[i]-0.001)){
     next.push(fragment);continue;
    }
    const overlap=intersectConvex(fragment,cutter);
    if(!overlap){next.push(fragment);continue;}
    // Do not treat nearly tangent faces as an intentional hole.
    const overlapBox=boundsOfBrush(overlap);
    if([0,1,2].some(i=>overlapBox.max[i]-overlapBox.min[i]<1)){
     next.push(fragment);continue;
    }
    changed=true;
    const pieces=subtractConvex(fragment,cutter);
    if(!pieces.length)throw Error(`Opening would completely erase '${original.name}'. Cancelled.`);
    next.push(...pieces.map((part,i)=>({...part,name:`${original.name} · opening ${impacted+1}.${i+1}`,group:original.group,layer:original.layer})));
   }
   if(changed)impacted++;
   fragments=next;
   if(fragments.length>40||impacted>10)throw Error(`Opening in '${original.name}' is too complex. Use fewer route segments or lower quality.`);
  }
  if(!impacted)throw Error(`No real geometric intersection in '${original.name}'. This may be an AABB-only warning.`);
  if(fragments.length>40||!fragments.length)throw Error('Opening has an unsafe fragment count.');
  const map=`{\n"classname" "worldspawn"\n${fragments.map(exportBrush).join('\n')}\n}\n`;
  const report=inspectMapImport(map).report;
  if(report.skippedBrushes)throw Error(`Opening in '${original.name}' did not survive MAP re-import (${report.skippedBrushes} skipped).`);
  cuts.push({original,fragments});
 }
 if(cuts.reduce((sum,c)=>sum+c.fragments.length,0)>80)throw Error('Too many opening fragments.');
 return cuts;
}
/** Never silently overwrite manual work on a linked connection. */
export function connectionCanRegenerate(record:SmartConnectionRecord,objects:readonly MapObject[]):boolean{
 return record.brushIds.every((id,i)=>{
  const obj=objects.find(o=>o.id===id);
  return obj?.kind==='brush'&&connectionSignature(obj)===record.signatures[i];
 })&&(record.cuts??[]).every(cut=>cut.pieces.every(piece=>{
  const obj=objects.find(o=>o.id===piece.id);
  return obj?.kind==='brush'&&connectionSignature(obj)===piece.signature;
 }));
}
export function makeConnectionRecord(id:string,from:ConnectionEnd,to:ConnectionEnd,options:SmartConnectOptions,brushes:Brush[],cuts:ConnectionCutDraft[]=[]):SmartConnectionRecord{
 return {id,from,to,options:{...options,points:options.points.map(p=>[...p] as Vec3)},brushIds:brushes.map(b=>b.id),signatures:brushes.map(connectionSignature),
  ...(cuts.length?{cuts:cuts.map(c=>({original:structuredClone(c.original),pieces:c.fragments.map(b=>({id:b.id,signature:connectionSignature(b)}))}))}:{})};
}
export function newConnectionId(){return uid();}
