/** Cinematic Camera Studio — native Sven Co-op entities only.
 * No custom entity classnames, script/timeline serialization or MAP exporter changes.
 * For trigger_camera: target LOOKS at an entity; moveto names the first path_corner.
 */
import type {MapObject,PointEntity,Vec3} from './types';
import {uid} from './types';
import {uniqueTargetname} from './gameplay';

export type CinematicOptions={
  name:string;position:Vec3;lookAt:Vec3;duration:number;speed:number;
  moving:boolean;freezePlayer:boolean;allPlayers:boolean;invulnerable:boolean;
  activatorId?:string;
};
export type CameraSettings=Pick<CinematicOptions,'duration'|'speed'|'freezePlayer'|'allPlayers'|'invulnerable'> & {
  /** Native trigger_camera keyvalues. Optional for callers written for Preview 2. */
  acceleration?:number;deceleration?:number;turnspeed?:number;
  startAtPlayer?:boolean;followPlayer?:boolean;forceView?:boolean;noInstantTurn?:boolean;instantMove?:boolean;
  hideHealth?:boolean;hideFlashlight?:boolean;hideWeapons?:boolean;
};
export type CinematicScene={camera:PointEntity;lookTarget:PointEntity|null;route:PointEntity[];brokenTarget:string|null;warnings:string[];generated:boolean};
const entity=(o:MapObject):o is PointEntity=>o.kind==='entity';
const finiteVec=(a:Vec3)=>a.length===3&&a.every(v=>Number.isFinite(v)&&Math.abs(v)<=131072);
const validText=(name:string)=>name.trim().replace(/[\r\n"<>]/g,'').slice(0,64)||'Camera';
const bounded=(n:number,min:number,max:number,label:string)=>{
  if(!Number.isFinite(n)||n<min||n>max)throw Error(`${label}: value must be between ${min} and ${max}.`);
  return n;
};
const key=(obj:PointEntity,k:string)=>obj.props[k]?.trim()||'';
const generated=(camera:PointEntity)=>key(camera,'targetname').startsWith('cs_camera_')||camera.group?.startsWith('Cinematic:')===true;
const flags=(settings:Pick<CameraSettings,'freezePlayer'|'allPlayers'|'invulnerable'>)=>
  (settings.freezePlayer?4:0)|(settings.allPlayers?8:0)|(settings.invulnerable?256:0);
export function defaultCinematicOptions(at:Vec3=[0,0,96]):CinematicOptions{
  return {name:'Intro',position:[at[0]-160,at[1]-160,at[2]+88],lookAt:[at[0],at[1],at[2]+24],duration:10,speed:180,
    moving:false,freezePlayer:true,allPlayers:false,invulnerable:true};
}
export function createCinematicScene(objects:MapObject[],options:CinematicOptions):{objects:MapObject[];cameraId:string}{
  if(!finiteVec(options.position)||!finiteVec(options.lookAt))throw Error('Camera and target must have valid GoldSrc coordinates.');
  bounded(options.duration,1,120,'Duration');bounded(options.speed,1,2000,'Speed');
  const cameraName=uniqueTargetname(objects,'cs_camera'),name=validText(options.name),group=`Cinematic: ${cameraName}`;
  const targetName=uniqueTargetname([...objects,{kind:'entity',id:'_name',name:'',classname:'info_target',position:options.position,props:{targetname:cameraName}}],'cs_look');
  const startName=options.moving?uniqueTargetname([...objects,{kind:'entity',id:'_name',name:'',classname:'trigger_camera',position:options.position,props:{targetname:cameraName}},{kind:'entity',id:'_targetname',name:'',classname:'info_target',position:options.lookAt,props:{targetname:targetName}}],'cs_path'):'';
  const camera:PointEntity={id:uid(),kind:'entity',classname:'trigger_camera',name:`Camera · ${name}`,position:[...options.position],layer:'Gameplay',group,props:{
    targetname:cameraName,target:targetName,wait:String(options.duration),moveto:startName,
    speed:String(options.speed),acceleration:'500',deceleration:'500',turnspeed:'40',spawnflags:String(flags(options)),angles:'0 0 0'
  }};
  const target:PointEntity={id:uid(),kind:'entity',classname:'info_target',name:`Look at · ${name}`,
    position:[...options.lookAt],layer:'Gameplay',group,props:{targetname:targetName}};
  const next:MapObject[]=[...objects,camera,target];
  if(options.moving)next.push({id:uid(),kind:'entity',classname:'path_corner',name:`Camera path 1 · ${name}`,
    position:[...options.position],layer:'Gameplay',group,props:{targetname:startName}});
  if(options.activatorId){
    const source=objects.find(o=>o.id===options.activatorId&&entity(o)) as PointEntity|undefined;
    if(!source||!['trigger_once','trigger_multiple','trigger_auto','trigger_relay','func_button'].includes(source.classname))
      throw Error('Select a supported trigger or button as the activator.');
    if(source.locked)throw Error('Unlock the activator before linking it.');
    if(key(source,'target'))throw Error('Activator already has a target. Connection refused to prevent overwriting existing logic.');
    const index=next.findIndex(o=>o.id===source.id);
    next[index]={...source,props:{...source.props,target:cameraName}};
  }
  return {objects:next,cameraId:camera.id};
}
export function readCinematicScene(objects:MapObject[],cameraId:string):CinematicScene|null{
  const camera=objects.find((o):o is PointEntity=>o.kind==='entity'&&o.id===cameraId&&o.classname==='trigger_camera');
  if(!camera)return null;
  const list=objects.filter(entity),lookup=(name:string)=>list.find(o=>key(o,'targetname')===name)||null;
  const lookTarget=lookup(key(camera,'target'));
  const route:PointEntity[]=[],visited=new Set<string>(),warnings:string[]=[];
  let name=key(camera,'moveto'),brokenTarget:string|null=null;
  while(name){
    const point=lookup(name);
    if(!point||point.classname!=='path_corner'){brokenTarget=name;warnings.push(`Missing path_corner: ${name}`);break;}
    if(visited.has(point.id)){warnings.push('Cyclic path detected. End the route at the last corner.');break;}
    visited.add(point.id);route.push(point);
    name=key(point,'target');
    if(route.length>128){warnings.push('Path is too long for this assistant.');break;}
  }
  if(key(camera,'target')&&!lookTarget)warnings.push(`Missing look target: ${key(camera,'target')}`);
  if(!key(camera,'target'))warnings.push('Without a target the camera uses its angles, which are not previewed exactly.');
  if(route.length===1)warnings.push('Add another path point to move the camera.');
  if(!Number.isFinite(Number(camera.props.wait))||Number(camera.props.wait)<=0)warnings.push('Invalid camera hold time.');
  return {camera,lookTarget,route,brokenTarget,warnings,generated:generated(camera)};
}
export function appendCinematicWaypoint(objects:MapObject[],cameraId:string,position:Vec3):{objects:MapObject[];pointId:string}{
  if(!finiteVec(position))throw Error('Invalid waypoint position.');
  const scene=readCinematicScene(objects,cameraId);
  if(!scene||!scene.generated)throw Error('Select a camera created by Cinematic Camera Studio.');
  if(scene.brokenTarget||scene.warnings.some(s=>s.startsWith('Cyclic')))throw Error('Repair the current path before adding points.');
  if(scene.route.length>=64)throw Error('Maximum 64 camera route points.');
  const previous=scene.route.at(-1);
  if(previous&&Math.hypot(...position.map((x,i)=>x-previous.position[i]))<8)throw Error('Move at least 8 units from the previous point.');
  let next=[...objects];
  let last=previous;
  if(!previous){
    // trigger_camera.moveto is the first corner, so start the path at the camera itself.
    const startName=uniqueTargetname(next,'cs_path');
    const start:PointEntity={id:uid(),kind:'entity',classname:'path_corner',name:'Camera path 1',position:[...scene.camera.position],layer:'Gameplay',group:scene.camera.group,props:{targetname:startName}};
    next=next.map(o=>o.id===scene.camera.id?{...scene.camera,props:{...scene.camera.props,moveto:startName}}:o);
    next.push(start);
    last=start;
  }
  if(!last)throw Error('Cannot find or create the route start.');
  if(last.locked)throw Error('Unlock the last path point to extend the route.');
  const newName=uniqueTargetname(next,'cs_path');
  const point:PointEntity={id:uid(),kind:'entity',classname:'path_corner',name:`Camera path ${scene.route.length+2}`,position:[...position],layer:'Gameplay',group:scene.camera.group,props:{targetname:newName}};
  next=next.map(o=>o.id===last.id?{...last,props:{...last.props,target:newName}}:o);
  next.push(point);
  return {objects:next,pointId:point.id};
}
/** Safely remove ONLY the terminal corner created by this assistant. Links from other
 * gameplay entities are never rewritten or disconnected without consent. */
export function removeLastCinematicWaypoint(objects:MapObject[],cameraId:string):MapObject[]{
  const scene=readCinematicScene(objects,cameraId);
  if(!scene||!scene.generated||!scene.route.length||scene.brokenTarget||scene.warnings.some(w=>w.startsWith('Cyclic')))
    throw Error('Select a generated camera with a valid path.');
  const last=scene.route.at(-1)!;
  if(last.locked)throw Error('Unlock the last path point first.');
  const prior=scene.route.at(-2);
  const targetName=key(last,'targetname');
  // Allowed inbound references: previous path_corner or trigger_camera.moveto for first corner.
  const external=objects.some(o=>o.kind==='entity'&&o.id!==last.id&&o.id!==(prior?.id||scene.camera.id)&&
    (o.props.target===targetName||o.props.moveto===targetName||o.props.netname===targetName));
  if(external)throw Error('Another entity references this path point. Remove that link manually first.');
  if(prior?.locked||(!prior&&scene.camera.locked))throw Error('Unlock the preceding point or camera first.');
  return objects.filter(o=>o.id!==last.id).map(o=>{
    if(prior&&o.id===prior.id){const props={...prior.props};delete props.target;return {...prior,props};}
    if(!prior&&o.id===scene.camera.id)return {...scene.camera,props:{...scene.camera.props,moveto:''}};
    return o;
  });
}

export function updateCinematicCamera(objects:MapObject[],cameraId:string,settings:CameraSettings):MapObject[]{
  const scene=readCinematicScene(objects,cameraId);
  if(!scene||!scene.generated)throw Error('Only cameras created in Cinematic Camera Studio are editable here.');
  if(scene.camera.locked)throw Error('Unlock the camera before updating settings.');
  bounded(settings.duration,1,120,'Duration');bounded(settings.speed,1,2000,'Speed');
  // Never reset flags that this UI does not control, including future Svengine flags.
  const prior=Number(scene.camera.props.spawnflags)||0;
  const always=4|8|256;
  const optionalFlags: [keyof CameraSettings,number][]=[
    ['startAtPlayer',1],['followPlayer',2],['forceView',16],['noInstantTurn',32],['instantMove',64]
  ];
  let nextFlags=(prior&~always)|flags(settings);
  for(const [name,mask] of optionalFlags){
    if(settings[name]!==undefined)nextFlags=settings[name]?(nextFlags|mask):(nextFlags&~mask);
  }
  const props:Record<string,string>={...scene.camera.props,wait:String(settings.duration),speed:String(settings.speed),spawnflags:String(nextFlags)};
  for(const name of ['acceleration','deceleration','turnspeed'] as const){
    if(settings[name]!==undefined){
      bounded(settings[name],0,4000,name);props[name]=String(settings[name]);
    }
  }
  for(const [name,keyName] of [
    ['hideHealth','hud_health'],['hideFlashlight','hud_flashlight'],['hideWeapons','hud_weapons']
  ] as const){
    if(settings[name]!==undefined)props[keyName]=settings[name]?'1':'0';
  }
  return objects.map(o=>o.id===cameraId?{...scene.camera,props}:o);
}
export function previewCinematicPosition(scene:CinematicScene,seconds:number):Vec3{
  const points=scene.route.map(o=>o.position);
  if(!points.length)return [...scene.camera.position];
  if(points.length===1)return [...points[0]];
  // Editor-only constant-distance approximation, NOT Svengine acceleration/path easing.
  const distances=points.slice(1).map((p,i)=>Math.hypot(...p.map((n,j)=>n-points[i][j])));
  const length=distances.reduce((a,b)=>a+b,0);
  const speed=Math.max(1,Number(scene.camera.props.speed)||180);
  const t=Math.min(1,Math.max(0,seconds*speed/Math.max(length,.001)));
  let remaining=t*length;
  for(let i=0;i<distances.length;i++){
    if(remaining<=distances[i]||i===distances.length-1){const f=distances[i]===0?0:Math.min(1,remaining/distances[i]);
      return points[i].map((v,j)=>v+(points[i+1][j]-v)*f) as Vec3;}
    remaining-=distances[i];
  }
  return [...points.at(-1)!];
}

/** Each leg is measured between *path_corners*. `path_corner.speed` means TRAIN speed
 * in the official FGD; it is NOT a documented camera speed override.
 * The optional per-corner values here live in `.svenstudio.json` only. */
export function cinematicRouteLegs(scene:CinematicScene):{from:PointEntity;to:PointEntity;distance:number}[]{
  return scene.route.slice(1).map((to,i)=>{
    const from=scene.route[i];
    return {from,to,distance:Math.hypot(...to.position.map((v,j)=>v-from.position[j]))};
  });
}
/** Time-based, piecewise-linear PREVIEW model. No claim of Svengine equivalence. */
export function previewCinematicSegmentPosition(scene:CinematicScene,seconds:number,speeds:Record<string,number>):Vec3{
  const legs=cinematicRouteLegs(scene);
  if(!legs.length)return previewCinematicPosition(scene,seconds);
  let time=Math.max(0,Number.isFinite(seconds)?seconds:0);
  for(const leg of legs){
    const configured=speeds[leg.to.id];
    const speed=Number.isFinite(configured)&&configured>=1&&configured<=2000?configured:Math.max(1,Number(scene.camera.props.speed)||180);
    const travel=leg.distance/speed;
    if(time<=travel){const factor=travel>0?time/travel:1;return leg.from.position.map((v,j)=>v+(leg.to.position[j]-v)*factor) as Vec3;}
    time-=travel;
  }
  return [...legs.at(-1)!.to.position];
}
