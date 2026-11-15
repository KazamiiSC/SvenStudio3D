/** HF18 — read-only GoldSrc mechanism preview. Never writes project/brush data.
 * This is a limited spatial estimate, NOT GoldSrc movement/physics simulation.
 */
import type {Brush,MapObject,PointEntity,Vec3} from './types';
import {transformedVertices} from './geometry';
import {doorMotionOffsetYaw} from './doorDirection';

export const MOVING_CLASSES=['func_door','func_door_rotating','func_plat','func_train'] as const;
export const ACTIVATOR_CLASSES=['func_button','func_rot_button','trigger_once','trigger_multiple','trigger_relay'] as const;
export function isMotionPreviewSource(classname:string){return (MOVING_CLASSES as readonly string[]).includes(classname)||(ACTIVATOR_CLASSES as readonly string[]).includes(classname)}
export type MotionTrack={entityId:string;classname:string;brushIds:string[];kind:'translate'|'rotate';path:Vec3[];axis:Vec3;pivot:Vec3;degrees:number;duration:number;notes:string[]};
export type MotionPlan={sourceId:string;tracks:MotionTrack[];activatedIds:string[];warnings:string[];duration:number};
export type MotionPose={offset:Vec3;axis:Vec3;degrees:number;pivot:Vec3};
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const length=(v:Vec3)=>Math.hypot(...v);
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const multiply=(a:Vec3,n:number):Vec3=>[a[0]*n,a[1]*n,a[2]*n];
const finiteNumber=(v:string|undefined,fallback:number)=>{if(v===undefined||v.trim()==='')return fallback;const n=Number(v);return Number.isFinite(n)?n:fallback};
const pointName=(e:PointEntity)=>(e.props.targetname||'').trim().toLowerCase();
function bounds(brushes:Brush[]){
 const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
 for(const brush of brushes){for(const point of transformedVertices(brush))for(let axis=0;axis<3;axis++){
  if(Number.isFinite(point[axis])){min[axis]=Math.min(min[axis],point[axis]);max[axis]=Math.max(max[axis],point[axis])}
 }}
 return {min,max};
}
function direction(yaw:number):Vec3{
 if(yaw===-1)return[0,0,1];if(yaw===-2)return[0,0,-1];
 return [Math.cos(yaw*Math.PI/180),Math.sin(yaw*Math.PI/180),0];
}
function propertyOrigin(e:PointEntity):Vec3|null{
 const raw=(e.props.origin||'').trim().split(/\s+/).map(Number);
 return raw.length===3&&raw.every(Number.isFinite)?raw as Vec3:null;
}
function targetMatches(name:string,entities:PointEntity[]):PointEntity[]{
 const target=name.trim().toLowerCase();if(!target||target.startsWith('!'))return[];
 if(target.endsWith('*'))return entities.filter(e=>pointName(e).startsWith(target.slice(0,-1))&&!!pointName(e));
 return entities.filter(e=>pointName(e)===target);
}
function makeTrack(entity:PointEntity,attached:Brush[],entities:PointEntity[]):MotionTrack|null{
 if(!attached.length)return null;
 const b=bounds(attached);if(!b.min.every(Number.isFinite)||!b.max.every(Number.isFinite))return null;
 const size:Vec3=sub(b.max,b.min),notes:string[]=[],flags=finiteNumber(entity.props.spawnflags,0),speed=Math.max(1,Math.abs(finiteNumber(entity.props.speed,entity.classname==='func_plat'?50:100)));
 const base={entityId:entity.id,classname:entity.classname,brushIds:attached.slice(0,48).map(x=>x.id),axis:[0,0,1] as Vec3,pivot:entity.position,degrees:0,notes};
 if(attached.length>48)notes.push('Only the first 48 brushes are visualized; the MAP remains unchanged.');
 if(entity.classname==='func_door'){
  const dir=direction(doorMotionOffsetYaw(entity.props));
  const extent=dir.reduce((sum,n,i)=>sum+Math.abs(n)*size[i],0);
  if(flags&1)notes.push('Starts Open flag: this preview shows movement relative to the authored brush pose.');
  const travel=Math.max(0,extent-finiteNumber(entity.props.lip,8));
  return {...base,kind:'translate',path:[[0,0,0],multiply(dir,travel)],duration:clamp(travel/speed,.1,30)};
 }
 if(entity.classname==='func_door_rotating'){
  const axis:Vec3=(flags&64)?[1,0,0]:(flags&128)?[0,1,0]:[0,0,1];
  const pivot=propertyOrigin(entity)||entity.position;
  if(!entity.props.origin)notes.push('Rotation pivot is approximate; an origin brush may define a different pivot in Sven Co-op.');
  if(flags&1)notes.push('Starts Open flag: the initial open state is not simulated.');
  const degrees=finiteNumber(entity.props.distance,90)*((flags&2)?-1:1);
  return {...base,kind:'rotate',path:[[0,0,0],[0,0,0]],pivot,axis,degrees,duration:clamp(Math.abs(degrees)/speed,.1,30)};
 }
 if(entity.classname==='func_plat'){
  const h=finiteNumber(entity.props.height,0)||Math.max(0,size[2]-8);
  notes.push('Platform height/start state is approximated; verify with the compiled BSP.');
  return {...base,kind:'translate',path:[[0,0,0],[0,0,-h]],duration:clamp(Math.abs(h)/speed,.1,30)};
 }
 if(entity.classname==='func_train'){
  const start=targetMatches(entity.props.target||'',entities).find(e=>e.classname==='path_corner');
  if(!start)return null;
  const positions:Vec3[]=[start.position],visited=new Set<string>([start.id]);let current=start;
  for(let i=0;i<24;i++){
   const next=targetMatches(current.props.target||'',entities).find(e=>e.classname==='path_corner');
   if(!next)break;
   if(visited.has(next.id)){notes.push('Cyclic train path truncated for the preview.');break}
   positions.push(next.position);visited.add(next.id);current=next;
  }
  if(positions.length<2)return null;
  notes.push('Train follows path_corner positions approximately; startup teleport, waits and per-node speed are not simulated.');
  const path=positions.map(p=>sub(p,positions[0]));
  const dist=path.slice(1).reduce((sum,p,i)=>sum+length(sub(p,path[i])),0);
  return {...base,kind:'translate',path,duration:clamp(dist/speed,.1,60)};
 }
 return null;
}
/** Bounded target dispatch; never executes scripts or changes entity state. */
export function createEntityMotionPlan(objects:readonly MapObject[],sourceId:string):MotionPlan{
 const entities=objects.filter((o):o is PointEntity=>o.kind==='entity'&&!o.hidden),entityById=new Map(entities.map(e=>[e.id,e]));
 const source=entityById.get(sourceId),warnings:string[]=[],activatedIds:string[]=[],tracks:MotionTrack[]=[];
 if(!source||!isMotionPreviewSource(source.classname))return {sourceId,tracks,activatedIds,warnings:['Select a supported moving entity, button, relay or trigger.'],duration:1};
 const brushes=objects.filter((o):o is Brush=>o.kind==='brush'&&!o.hidden);
 const linked=new Map<string,Brush[]>();for(const brush of brushes)if(brush.entityId){const list=linked.get(brush.entityId)||[];list.push(brush);linked.set(brush.entityId,list)}
 const visited=new Set<string>(),pending:Array<[PointEntity,number]>=[[source,0]];
 while(pending.length&&visited.size<64&&tracks.length<8){
  const [e,depth]=pending.shift()!;
  if(visited.has(e.id))continue;visited.add(e.id);activatedIds.push(e.id);
  if((MOVING_CLASSES as readonly string[]).includes(e.classname)){
   const track=makeTrack(e,linked.get(e.id)||[],entities);
   if(track)tracks.push(track);
   else warnings.push(`${e.classname}: no linked brushes or valid movement path for ${e.props.targetname||e.id}.`);
   continue;
  }
  if(depth>=8){warnings.push('Target chain reached its preview depth limit.');continue}
  const target=(e.props.target||'').trim(),next=targetMatches(target,entities);
  if(!next.length)warnings.push(`${e.classname}: no target found${target?` for ${target}`:''}.`);
  for(const dest of next)if(isMotionPreviewSource(dest.classname)&&!visited.has(dest.id))pending.push([dest,depth+1]);
 }
 if(!tracks.length)warnings.push('No supported moving brush is reachable from this entity.');
 if(visited.size>=64||tracks.length>=8)warnings.push('Large activation graph was limited to keep the editor responsive.');
 return {sourceId,tracks,activatedIds,warnings,duration:Math.max(0.1,...tracks.map(t=>t.duration))};
}
export function motionPoseAt(track:MotionTrack,progress:number):MotionPose{
 const t=clamp(Number.isFinite(progress)?progress:0,0,1);
 if(track.kind==='rotate')return {offset:[0,0,0],axis:track.axis,degrees:track.degrees*t,pivot:track.pivot};
 const path=track.path;if(path.length<=1)return {offset:[0,0,0],axis:track.axis,degrees:0,pivot:track.pivot};
 const segments=path.slice(1).map((p,i)=>length(sub(p,path[i]))),total=segments.reduce((a,b)=>a+b,0);
 if(total<1e-6)return {offset:path[0],axis:track.axis,degrees:0,pivot:track.pivot};
 let remaining=t*total;
 for(let i=0;i<segments.length;i++){
  if(remaining<=segments[i]||i===segments.length-1){const f=segments[i]>0?clamp(remaining/segments[i],0,1):0;return {offset:add(path[i],multiply(sub(path[i+1],path[i]),f)),axis:track.axis,degrees:0,pivot:track.pivot}}
  remaining-=segments[i];
 }
 return {offset:path[path.length-1],axis:track.axis,degrees:0,pivot:track.pivot};
}
/** Conservative axis-aligned swept bounds warning for translation only. */
export function motionCollisionHints(plan:MotionPlan,objects:readonly MapObject[]):string[]{
 const brushes=objects.filter((o):o is Brush=>o.kind==='brush'&&!o.hidden);const movingIds=new Set(plan.tracks.flatMap(t=>t.brushIds));
 const obstacles=brushes.filter(b=>!movingIds.has(b.id)&&!b.entityId).slice(0,10000);
 const warnings:string[]=[];
 for(const track of plan.tracks){if(track.kind!=='translate'||track.path.length<2)continue;
  const parts=brushes.filter(b=>track.brushIds.includes(b.id));if(!parts.length)continue;
  const b=bounds(parts),motionMin:[number,number,number]=[...b.min],motionMax:[number,number,number]=[...b.max];
  for(const p of track.path)for(let i=0;i<3;i++){motionMin[i]=Math.min(motionMin[i],b.min[i]+p[i]);motionMax[i]=Math.max(motionMax[i],b.max[i]+p[i]);}
  let found=0;
  for(const other of obstacles){const q=bounds([other]);if([0,1,2].every(i=>motionMax[i]>q.min[i]+.1&&motionMin[i]<q.max[i]-.1)){found++;if(found>=5)break}}
  if(found)warnings.push(`${track.classname}: swept AABB may overlap ${found}${found>=5?'+':''} structural brushes (approximate, not a collision test).`);
 }
 return warnings;
}
