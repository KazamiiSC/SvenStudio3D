/** HF13 — Co-op Playtest Validator (editor-side advisory geometry checks only).
 * Does not read or change BSP hulls, spawn activation scripts, runtime collision,
 * the map project, or the official compilation workflow.
 * Sven Co-op default standing hull: 32x32x72, crouched hull: 32x32x36.
 * Custom info_hullshape and game movement can change actual clearance.
 */
import type {Brush,PointEntity,Project,Vec3} from './types';
import {transformedVertices} from './geometry';
import {isSvenPlayerSpawn} from './svenEntitySemantics';

export const COOP_HULL={width:32,standingHeight:72,crouchHeight:36,stepHeight:18} as const;
export type CoopSeverity='warning'|'info';
export type CoopFinding={code:string;severity:CoopSeverity;objectId?:string;message:string};
export type CoopProbe={position:Vec3;blocked:boolean;support:boolean;blockingIds:string[]};
export type CoopPlaytestReport={spawnCount:number;activeCandidates:number;findings:CoopFinding[];spawns:PointEntity[];ghosts:CoopProbe[];anchorId:string|null};
type Volume={id:string;vertices:Vec3[];min:Vec3;max:Vec3;axes:Vec3[];edges:Vec3[]};
const EPS=1e-5;
const subtract=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=(p:Vec3):Vec3|null=>{const n=Math.hypot(...p);return n>EPS?[p[0]/n,p[1]/n,p[2]/n]:null};
const X:Vec3=[1,0,0],Y:Vec3=[0,1,0],Z:Vec3=[0,0,1];
const addAxis=(list:Vec3[],axis:Vec3)=>{const normalized=unit(axis);if(normalized&&!list.some(old=>Math.abs(dot(normalized,old))>.9999))list.push(normalized)};
export function solidBrush(brush:Brush,entities:Map<string,PointEntity>):boolean{
 // Hidden editor brushes still compile, so do not skip them.
 const cls=brush.entityId?entities.get(brush.entityId)?.classname.toLowerCase():'';
 // Non-solid, volumes, and origin helpers cannot be treated as closed walls.
 if(cls&&(/^(trigger_|func_illusionary|func_ladder|func_friction|func_conveyor)/.test(cls)))return false;
 if(brush.faces.length<4)return false;
 // All-special tool brushes that do not form playable blocking geometry.
 if(brush.faces.every(face=>['ORIGIN','HINT','SKIP','AAATRIGGER','TRIGGER'].includes(face.texture.toUpperCase())))return false;
 return true;
}
function volume(brush:Brush):Volume|null{
 const vertices=transformedVertices(brush);
 if(vertices.length<4||vertices.some(v=>v.some(n=>!Number.isFinite(n))))return null;
 const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
 for(const p of vertices)for(let a=0;a<3;a++){min[a]=Math.min(min[a],p[a]);max[a]=Math.max(max[a],p[a])}
 if(min.some((v,a)=>max[a]-v<EPS))return null;
 const axes:Vec3[]=[],edges:Vec3[]=[];
 for(const face of brush.faces){
  if(face.indices.length<3)continue;
  const points=face.indices.map(i=>vertices[i]).filter((p):p is Vec3=>!!p);
  if(points.length<3)continue;
  const anchor=points[0];
  for(let k=1;k+1<points.length;k++)addAxis(axes,cross(subtract(points[k],anchor),subtract(points[k+1],anchor)));
  for(let k=0;k<points.length;k++)addAxis(edges,subtract(points[(k+1)%points.length],points[k]));
 }
 if(axes.length<3)return null; // Invalid brush, leave geometry integrity to Map Doctor.
 return {id:brush.id,vertices,min,max,axes,edges};
}
export function createCoopVolumes(project:Project):Volume[]{
 const entities=new Map(project.objects.filter((o):o is PointEntity=>o.kind==='entity').map(o=>[o.id,o]));
 return project.objects.filter((o):o is Brush=>o.kind==='brush'&&solidBrush(o,entities)).map(volume).filter((o):o is Volume=>!!o);
}
function overlap(a0:number,a1:number,b0:number,b1:number,tolerance=0):boolean{return a0<b1-tolerance&&a1>b0+tolerance}
function overlapsHull(p:Vec3,height:number,v:Volume):boolean{
 const half=COOP_HULL.width/2,hh=height/2;
 const min:Vec3=[p[0]-half,p[1]-half,p[2]-hh],max:Vec3=[p[0]+half,p[1]+half,p[2]+hh];
 if(!min.every((n,i)=>overlap(n,max[i],v.min[i],v.max[i],.05)))return false;
 // An origin placed 28-36u above a floor may overlap its top slightly;
 // keep a limited 8u floor allowance rather than flagging every normal start.
 if(v.max[2]<=min[2]+8&&v.max[2]>=min[2]-12)return false;
 // Convex polyhedron versus axis-aligned player box: separating-axis test.
 const axes:Vec3[]=[X,Y,Z,...v.axes];
 for(const edge of v.edges){addAxis(axes,cross(edge,X));addAxis(axes,cross(edge,Y));addAxis(axes,cross(edge,Z))}
 for(const axis of axes){
  let low=Infinity,high=-Infinity;
  for(const vertex of v.vertices){const projected=dot(vertex,axis);low=Math.min(low,projected);high=Math.max(high,projected)}
  const mid=dot(p,axis);
  const r=half*(Math.abs(axis[0])+Math.abs(axis[1]))+hh*Math.abs(axis[2]);
  if(high<mid-r+.05||low>mid+r-.05)return false;
 }
 return true;
}
function isSupported(p:Vec3,volumes:Volume[]):boolean{
 const foot=p[2]-COOP_HULL.standingHeight/2;
 // Advisory only: top-surface approximation. Sloped and custom hull surfaces
 // need the compiled BSP collision hulls for certainty.
 return volumes.some(v=>v.max[0]>=p[0]-12&&v.min[0]<=p[0]+12&&v.max[1]>=p[1]-12&&v.min[1]<=p[1]+12&&v.max[2]<=foot+12&&v.max[2]>=foot-64);
}
export function probeCoopPlayer(p:Vec3,volumes:Volume[],height:number=COOP_HULL.standingHeight):CoopProbe{
 const blockingIds:string[]=[];
 for(const v of volumes)if(overlapsHull(p,height,v)){blockingIds.push(v.id);if(blockingIds.length>=8)break}
 return {position:[...p],blocked:blockingIds.length>0,blockingIds,support:isSupported(p,volumes)};
}
/** Ghosts intentionally form a hypothetical group around one selected spawn;
 * they are NOT a prediction of Sven Co-op's runtime spawn allocation. */
export function coopGhostPositions(anchor:Vec3,count:2|4|8):Vec3[]{
 const positions:Vec3[]=[];const step=40,columns=count===2?2:count===4?2:4;
 for(let i=0;i<count;i++){
  const x=i%columns,row=Math.floor(i/columns);
  positions.push([anchor[0]+x*step,anchor[1]+row*step,anchor[2]]);
 }
 return positions;
}
export function analyzeCoopPlaytest(project:Project,count:2|4|8=4,anchorId:string|null=null,manualAnchor:Vec3|null=null):CoopPlaytestReport{
 const volumes=createCoopVolumes(project);
 const spawns=project.objects.filter((o):o is PointEntity=>o.kind==='entity'&&isSvenPlayerSpawn(o.classname));
 const findings:CoopFinding[]=[];const add=(severity:CoopSeverity,code:string,message:string,objectId?:string)=>{if(findings.length<200)findings.push({severity,code,message,objectId})};
 if(!spawns.length)add('warning','COOP_NO_SPAWNS','No hay puntos de aparición de Sven Co-op.');
 const startsOff=(s:PointEntity)=>['info_player_deathmatch','info_player_dm2'].includes(s.classname.toLowerCase())&&!!(Number(s.props.spawnflags||0)&2);
 const activeCandidates=spawns.filter(s=>!startsOff(s)).length;
 if(spawns.length&&!activeCandidates)add('info','COOP_DISABLED_SPAWNS','Todos los puntos de aparición tienen Start Off; la activación real depende de eventos del juego.');
 if(spawns.length===1)add('info','COOP_SINGLE_SPAWN','Un único punto puede reutilizarse para varios jugadores; podría producir esperas si está ocupado.');
 for(const spawn of spawns.slice(0,200)){
  if(spawn.hidden)continue;
  const probe=probeCoopPlayer(spawn.position,volumes);
  if(probe.blocked)add('warning','COOP_SPAWN_BLOCKED',`${spawn.classname}: volumen de jugador posiblemente dentro de geometría sólida.`,spawn.id);
  if(!probe.support&&!(Number(spawn.props.spawnflags||0)&4&&['info_player_deathmatch','info_player_dm2'].includes(spawn.classname.toLowerCase())))add('info','COOP_NO_FLOOR',`${spawn.classname}: no se detecta suelo cercano bajo el punto (comprobación aproximada).`,spawn.id);
 }
 let overlapCount=0;
 for(let i=0;i<spawns.length;i++)for(let j=i+1;j<spawns.length;j++){
  const a=spawns[i].position,b=spawns[j].position;
  if(Math.abs(a[0]-b[0])<32&&Math.abs(a[1]-b[1])<32&&Math.abs(a[2]-b[2])<72){
   if(overlapCount++<30)add('warning','COOP_SPAWN_OVERLAP',`Puntos de aparición superpuestos: ${spawns[i].classname} y ${spawns[j].classname}.`,spawns[j].id);
  }
 }
 const anchor=spawns.find(s=>s.id===anchorId)||spawns[0];
 const ghostOrigin=manualAnchor&&manualAnchor.every(Number.isFinite)?manualAnchor:anchor?.position;
 const ghosts=ghostOrigin?coopGhostPositions(ghostOrigin,count).map(p=>probeCoopPlayer(p,volumes)):[];
 if(ghosts.some(g=>g.blocked))add('warning','COOP_GROUP_BLOCKED','At least one ghost player overlaps solid geometry.',anchor?.id);
 if(ghosts.some(g=>!g.support))add('info','COOP_GROUP_NO_FLOOR','Some ghost positions have no nearby floor (approximation).',anchor?.id);
 return {spawnCount:spawns.length,activeCandidates,findings,spawns,ghosts,anchorId:anchor?.id||null};
}
