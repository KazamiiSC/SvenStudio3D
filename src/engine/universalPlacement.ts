/** Universal Placement v1.9.4. All coordinates here are GoldSrc X/Y/Z (Z up).
 * Pure functions: the inspector, the in-scene ghost and click handlers use
 * exactly the same placement and precision rules.
 */
import type {Vec3} from './types';
export type UniversalPlacementMode='surface'|'grid'|'free'|'relative'|'object';
export type UniversalPlacementSettings={
  mode:UniversalPlacementMode;
  planeZ:number;
  /** Distance along the camera ray, not a world-Z plane. */
  freeDepth:number;
  /** Optional, non-destructive first-click positioning pass. */
  twoStep:boolean;
  staged:boolean;
  offsetZ:number;
  position:Vec3;
  lockPosition:boolean;
  objectSnapRadius:number;
  workplanes:number[];
};
export const DEFAULT_UNIVERSAL_PLACEMENT:UniversalPlacementSettings={
  mode:'surface',planeZ:0,freeDepth:512,twoStep:false,staged:false,offsetZ:0,position:[0,0,0],lockPosition:false,objectSnapRadius:24,workplanes:[0,128,256],
};
const LIMIT=32768;
export const clampPlacement=(value:number):number=>Number.isFinite(value)?Math.max(-LIMIT,Math.min(LIMIT,value)):0;
export function normalizeUniversalPlacement(input:Partial<UniversalPlacementSettings>|null|undefined):UniversalPlacementSettings{
  const source=input||{};
  const modes:UniversalPlacementMode[]=['surface','grid','free','relative','object'];
  const mode=modes.includes(source.mode as UniversalPlacementMode)?source.mode!:DEFAULT_UNIVERSAL_PLACEMENT.mode;
  return {
    mode,planeZ:clampPlacement(Number(source.planeZ??0)),
    freeDepth:Math.max(32,Math.min(8192,Number.isFinite(source.freeDepth)?Number(source.freeDepth):512)),
    twoStep:source.twoStep===true,staged:source.staged===true&&source.twoStep===true,offsetZ:clampPlacement(Number(source.offsetZ??0)),
    position:[0,1,2].map(i=>clampPlacement(Number(source.position?.[i]??0))) as Vec3,
    lockPosition:source.lockPosition===true,
    objectSnapRadius:Math.max(1,Math.min(256,Number.isFinite(source.objectSnapRadius)?Number(source.objectSnapRadius):24)),
    workplanes:Array.isArray(source.workplanes)?[...new Set(source.workplanes.filter(v=>typeof v==='number'&&Number.isFinite(v)).map(clampPlacement))].slice(0,12):[0,128,256],
  };
}
export function computeUniversalPlacement(
  settings:UniversalPlacementSettings,
  hit:Vec3|null,
  floor:Vec3|null,
  objectPoint:Vec3|null,
  snapStep:number,
  elevation=0,
  freePoint:Vec3|null=null,
):Vec3|null{
  const snap=Number.isFinite(snapStep)&&snapStep>0?snapStep:1;
  if(settings.lockPosition)return settings.position.map(clampPlacement) as Vec3;
  const point=settings.mode==='free'?(freePoint||floor):settings.mode==='grid'?floor:
    settings.mode==='object'?objectPoint||hit||floor:hit||floor;
  if(!point)return null;
  const z=settings.mode==='free'?point[2]:settings.mode==='grid'?settings.planeZ:
    point[2]+(settings.mode==='relative'?settings.offsetZ:0)+elevation;
  const exact=settings.mode==='free'||settings.mode==='object'&&!!objectPoint;
  const resolved:[number,number,number]=[point[0],point[1],z];
  return resolved.map((v,i)=>{
    const safe=clampPlacement(v);
    if(exact||(i===2&&settings.mode==='grid'))return safe;
    return Math.round(safe/snap)*snap;
  }) as Vec3;
}

/** Returns a point at an actual *camera distance*, including its own independent Z.
 * Ray direction must be normalized and all inputs must use the same axis system. */
export function freeRayPoint(origin:Vec3,direction:Vec3,distance:number):Vec3{
  const length=Math.hypot(...direction);
  const safe=Math.max(32,Math.min(8192,Number.isFinite(distance)?distance:512));
  if(length<1e-8)return origin.map(clampPlacement) as Vec3;
  return origin.map((v,i)=>clampPlacement(v+direction[i]/length*safe)) as Vec3;
}

export function closestPlacementVertex(hit:Vec3,vertices:Vec3[],radius:number):Vec3|null{
  let best:Vec3|null=null,minimum=radius*radius;
  for(const vertex of vertices){
    if(vertex.some(v=>!Number.isFinite(v)))continue;
    const dist=(vertex[0]-hit[0])**2+(vertex[1]-hit[1])**2+(vertex[2]-hit[2])**2;
    if(dist<=minimum){best=vertex;minimum=dist;}
  }
  return best?[...best] as Vec3:null;
}
/** True polygon-boundary snapping: do not snap to internal triangle fan edges. */
export function closestPlacementEdge(hit:Vec3,polygon:Vec3[],radius:number):Vec3|null{
  if(polygon.length<2)return null;
  let best:Vec3|null=null,bestDist=radius*radius;
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length];
    if([...a,...b].some(v=>!Number.isFinite(v)))continue;
    const delta=[b[0]-a[0],b[1]-a[1],b[2]-a[2]];
    const lenSq=delta[0]*delta[0]+delta[1]*delta[1]+delta[2]*delta[2];
    const t=lenSq>1e-9?Math.max(0,Math.min(1,((hit[0]-a[0])*delta[0]+(hit[1]-a[1])*delta[1]+(hit[2]-a[2])*delta[2])/lenSq)):0;
    const point:[number,number,number]=[a[0]+delta[0]*t,a[1]+delta[1]*t,a[2]+delta[2]*t];
    const dist=(point[0]-hit[0])**2+(point[1]-hit[1])**2+(point[2]-hit[2])**2;
    if(dist<bestDist){best=point;bestDist=dist;}
  }
  return best;
}

export function readUniversalPlacement():UniversalPlacementSettings{
  try{return normalizeUniversalPlacement({...JSON.parse(localStorage.getItem('svenstudio:universal-placement-v194')||'null'),staged:false,lockPosition:false})}
  catch{return {...DEFAULT_UNIVERSAL_PLACEMENT,position:[0,0,0]}}
}
export function saveUniversalPlacement(settings:UniversalPlacementSettings):void{
  try{localStorage.setItem('svenstudio:universal-placement-v194',JSON.stringify(settings))}catch{/* Private browsing */}
}
