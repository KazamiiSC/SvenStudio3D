/** Utilities shared by BSP viewer navigation and labels (never modify BSP data). */
import type {BspEntity,BspMap} from './bsp';

export const BSP_FLY_SPEED_MIN=40;
export const BSP_FLY_SPEED_MAX=2000;
export const BSP_FLY_SENSITIVITY_MIN=.0005;
export const BSP_FLY_SENSITIVITY_MAX=.006;

export function clampBspFlySpeed(speed:number){
  return Math.max(BSP_FLY_SPEED_MIN,Math.min(BSP_FLY_SPEED_MAX,Number.isFinite(speed)?speed:360));
}
export function clampBspFlySensitivity(sensitivity:number){
  return Math.max(BSP_FLY_SENSITIVITY_MIN,Math.min(BSP_FLY_SENSITIVITY_MAX,Number.isFinite(sensitivity)?sensitivity:.002));
}
/** Keep each classname in its original game language, and include targetname when present. */
export function bspEntityLabel(entity:BspEntity){
  const name=entity.properties.targetname?.trim();
  return name ? `${entity.classname} · ${name}` : entity.classname;
}
export function bspEntitySearchText(entity:BspEntity){
  return `${entity.classname} ${entity.properties.targetname||''} ${entity.properties.target||''}`.toLowerCase();
}
/** Unit wish direction in camera-local forward/right plus global vertical movement. */
export function bspFlyAxes(keys:ReadonlySet<string>){
  return {
    forward:Number(keys.has('KeyW')||keys.has('ArrowUp'))-Number(keys.has('KeyS')||keys.has('ArrowDown')),
    right:Number(keys.has('KeyD'))-Number(keys.has('KeyA')),
    up:Number(keys.has('KeyE')||keys.has('Space'))-Number(keys.has('KeyQ'))
  };
}
export function bspFlyMultiplier(keys:ReadonlySet<string>){
  return (keys.has('ShiftLeft')||keys.has('ShiftRight'))?3:(keys.has('ControlLeft')||keys.has('ControlRight'))?.3:1;
}


/** Camera presets for the compiled BSP view. Coordinates are derived from BSP
 * contents, never from editor brush meshes, so the target is always the
 * exact geometry displayed by True Lighting. The default starts INSIDE a
 * room (preferably at info_player_start): an outside orbit can show only
 * skybox for open-top rooms, misleading users into thinking the BSP is empty.
 * Positions and targets are in Three.js [x, z, -y] world coordinates. */
export type BspCameraView='interior'|'overview';
export type BspCameraPose={position:[number,number,number];target:[number,number,number];view:BspCameraView};
export function bspCameraPose(map:Pick<BspMap,'bounds'|'entities'>,requested:BspCameraView='interior'):BspCameraPose{
  const {min,max}=map.bounds;
  const center:[number,number,number]=[0,1,2].map(i=>(min[i]+max[i])*.5) as [number,number,number];
  const size:[number,number,number]=[0,1,2].map(i=>Math.max(0,max[i]-min[i])) as [number,number,number];
  const span=Math.max(150,Math.hypot(...size));
  const toThree=(p:readonly number[]):[number,number,number]=>[p[0],p[2],-p[1]];
  // Entire-map overview is intentionally outside the bounding box.
  const overview=():BspCameraPose=>{
    const target=toThree(center);
    return {position:[target[0]+span*.8,target[1]+span*.45,target[2]+span*.8],target,view:'overview'};
  };
  if(requested==='overview'||size.filter(n=>n<12).length>=2)return overview();
  const spawn=map.entities.find(e=>/^info_player_(start|deathmatch|coop)$/i.test(e.classname)&&e.origin&&
    e.origin.every((n,i)=>Number.isFinite(n)&&n>=min[i]-16&&n<=max[i]+16));
  // Without a spawn, a large open-world BSP is safer to show in overview;
  // a room-scale map is still useful from its midpoint.
  if(!spawn&&span>4096)return overview();
  const anchor=spawn?.origin||center;
  const inside=(n:number,axis:number)=>{
    const roomSize=size[axis];
    if(roomSize<12)return center[axis];
    const margin=Math.min(24,roomSize*.12);
    return Math.max(min[axis]+margin,Math.min(max[axis]-margin,n));
  };
  // Lift the camera above spawn, but never into a sky ceiling or outside.
  const pos:[number,number,number]=[
    inside(anchor[0]+(center[0]-anchor[0])*.1,0),
    inside(anchor[1]+(center[1]-anchor[1])*.1,1),
    inside((spawn?anchor[2]+24:center[2]),2)
  ];
  // GoldSrc 'angle' is a yaw around Z. When missing, look diagonally across
  // the room so floor AND walls are visible (instead of staring vertically).
  const yaw=Number(spawn?.properties.angle);
  const hasYaw=!!spawn&&typeof spawn.properties.angle==='string'&&Number.isFinite(yaw)&&yaw>=0;
  const dirX=hasYaw?Math.cos(yaw*Math.PI/180):-0.70710678118;
  const dirY=hasYaw?Math.sin(yaw*Math.PI/180):0.70710678118;
  const forward=Math.max(20,Math.min(160,Math.max(40,Math.min(size[0],size[1])*.26)));
  let target:[number,number,number]=[
    inside(pos[0]+dirX*forward,0),
    inside(pos[1]+dirY*forward,1),
    inside(pos[2]-Math.max(8,Math.min(24,size[2]*.12)),2)
  ];
  const horizontal=Math.hypot(target[0]-pos[0],target[1]-pos[1]);
  if(horizontal<12){
    // Spawn may face a nearby wall; aim back toward the room interior.
    target=[inside(pos[0]+(center[0]-pos[0])*.8,0),inside(pos[1]+(center[1]-pos[1])*.8,1),target[2]];
    if(Math.hypot(target[0]-pos[0],target[1]-pos[1])<8){
      target=[inside(pos[0]-dirX*forward,0),inside(pos[1]-dirY*forward,1),target[2]];
    }
  }
  return {position:toThree(pos),target:toThree(target),view:'interior'};
}

/** Exact OrbitControls target for handoff from pointer-locked fly mode.
 * Normalizes any direction, preserving camera position, yaw and pitch. */
export function bspFlyOrbitTarget(position:readonly number[],direction:readonly number[],distance=160):[number,number,number]{
  const norm=Math.hypot(...direction);
  const scale=Number.isFinite(norm)&&norm>1e-8?Math.max(16,distance)/norm:0;
  return [0,1,2].map(i=>(position[i]||0)+(direction[i]||0)*scale) as [number,number,number];
}
