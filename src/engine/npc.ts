/** NPC & AI Studio v0.6.1. These are real Sven Co-op entity keyvalues,
 * not a simulation of game AI. Routes use path_waypoint + path_name,
 * not path_corner (which has different behaviour and is interruptible).
 */
import type {FgdClass,MapObject,PointEntity,Vec3} from './types';
import {uid} from './types';
import {uniqueTargetname} from './gameplay';

const isEntity=(value:MapObject):value is PointEntity=>value.kind==='entity';
export const isNpcClass=(classname:string)=>/^monster_[\w]+$/i.test(classname);
export const isNpcOwner=(classname:string)=>isNpcClass(classname)||classname==='squadmaker'||classname==='monstermaker';
export const npcClasses=(classes:FgdClass[])=>classes.filter(c=>c.type==='point'&&isNpcClass(c.name)).sort((a,b)=>a.name.localeCompare(b.name));
const entityById=(objects:MapObject[],id:string)=>objects.find((o):o is PointEntity=>isEntity(o)&&o.id===id);

export type NpcRoute={nodes:PointEntity[];brokenTarget?:string;loop:boolean};
export function traceNpcRoute(objects:MapObject[],ownerId:string):NpcRoute{
  const owner=entityById(objects,ownerId);
  const all=objects.filter(isEntity).filter(e=>e.classname==='path_waypoint');
  const names=new Map<string,PointEntity>();
  all.forEach(e=>{if(e.props.targetname&&!names.has(e.props.targetname))names.set(e.props.targetname,e)});
  let current=owner?.props.path_name?.trim()||'';
  const seen=new Set<string>(),nodes:PointEntity[]=[];
  while(current&&nodes.length<512){
    const node=names.get(current);
    if(!node)return {nodes,brokenTarget:current,loop:false};
    if(seen.has(node.id))return {nodes,loop:true};
    seen.add(node.id);nodes.push(node);current=node.props.target?.trim()||'';
  }
  return {nodes,loop:!!current};
}
export function createWaypoint(objects:MapObject[],ownerId:string,position:Vec3):{objects:MapObject[];id:string}{
  const owner=entityById(objects,ownerId);
  if(!owner||!isNpcOwner(owner.classname))throw Error('Select a monster or squadmaker to build an NPC route.');
  if(owner.locked)throw Error('Unlock the NPC/spawner to edit its route.');
  const route=traceNpcRoute(objects,ownerId);
  if(route.loop||route.brokenTarget)throw Error('Fix the existing NPC path before appending another waypoint.');
  const name=uniqueTargetname(objects,'npc_waypoint');
  const id=uid(),waypoint:PointEntity={id,kind:'entity',name:'path_waypoint',classname:'path_waypoint',position:[...position],layer:'AI Routes',props:{targetname:name,target:'',wait_time:'0'}};
  const last=route.nodes.at(-1);
  const updated=objects.map(obj=>obj.id===(last?.id||owner.id)&&isEntity(obj)?{
    ...obj,props:{...obj.props,[last?'target':'path_name']:name}
  }:obj);
  return {objects:[...updated,waypoint],id};
}
export type SpawnerOptions={monstercount:number;delay:number;maxLive:number;startOn:boolean};
export const DEFAULT_SPAWNER:SpawnerOptions={monstercount:5,delay:5,maxLive:2,startOn:false};
export function makeNpcSpawner(objects:MapObject[],npcId:string,options:SpawnerOptions=DEFAULT_SPAWNER):{objects:MapObject[];id:string}{
  const npc=entityById(objects,npcId);
  if(!npc||!isNpcClass(npc.classname))throw Error('Select a monster NPC, not a brush or a path waypoint.');
  if(!Number.isInteger(options.monstercount)||options.monstercount < -1 || options.monstercount > 10000)throw Error('Monster count must be -1 (unlimited) or an integer from 0 to 10000.');
  if(!Number.isFinite(options.delay)||options.delay<0||options.delay>3600)throw Error('Spawn delay must be between 0 and 3600 seconds.');
  if(!Number.isInteger(options.maxLive)||options.maxLive<-1||options.maxLive>1024)throw Error('Max live children must be -1 or an integer from 0 to 1024.');
  const id=uid(),at:Vec3=[npc.position[0]+96,npc.position[1],npc.position[2]];
  const spawner:PointEntity={id,kind:'entity',name:'squadmaker',classname:'squadmaker',position:at,layer:'Gameplay',props:{
    targetname:uniqueTargetname(objects,'squadmaker'),monstertype:npc.classname,
    monstercount:String(options.monstercount),delay:String(options.delay),
    m_imaxlivechildren:String(options.maxLive),spawnflags:String(32|(options.startOn?1:0)),
    ...(npc.props.path_name?{path_name:npc.props.path_name}:{}),
  }};
  return {objects:[...objects,spawner],id};
}
export type NpcIssue={severity:'error'|'warning';message:string;entityId?:string};
export function validateNpcLogic(objects:MapObject[]):NpcIssue[]{
  const issues:NpcIssue[]=[];
  const entities=objects.filter(isEntity);
  const names=new Set(entities.filter(e=>e.classname==='path_waypoint').map(e=>e.props.targetname).filter(Boolean));
  for(const e of entities){
    if(e.classname==='squadmaker'||e.classname==='monstermaker'){
      if(!e.props.monstertype?.trim())issues.push({severity:'error',entityId:e.id,message:`${e.classname}: missing monstertype; this could crash Sven Co-op.`});
      else if(!isNpcClass(e.props.monstertype))issues.push({severity:'warning',entityId:e.id,message:`${e.classname}: monstertype is not a monster_ classname; verify its intended use.`});
      const count=Number(e.props.monstercount),delay=Number(e.props.delay),limit=Number(e.props.m_imaxlivechildren);
      if(e.props.monstercount!==undefined&&(!Number.isInteger(count)||count < -1))issues.push({severity:'error',entityId:e.id,message:`${e.classname}: invalid monstercount.`});
      if(e.props.delay!==undefined&&(!Number.isFinite(delay)||delay<0))issues.push({severity:'error',entityId:e.id,message:`${e.classname}: invalid delay.`});
      if(e.props.m_imaxlivechildren!==undefined&&(!Number.isInteger(limit)||limit < -1))issues.push({severity:'error',entityId:e.id,message:`${e.classname}: invalid m_imaxlivechildren.`});
    }
    if(isNpcOwner(e.classname)&&e.props.path_name){
      if(!names.has(e.props.path_name))issues.push({severity:'warning',entityId:e.id,message:`${e.classname}: path_name "${e.props.path_name}" has no matching path_waypoint.`});
      else {const route=traceNpcRoute(objects,e.id);
        if(route.brokenTarget)issues.push({severity:'warning',entityId:e.id,message:`NPC route references missing path_waypoint: ${route.brokenTarget}.`});
      }
    }
    if(e.classname==='path_waypoint'&&e.props.target&&!names.has(e.props.target))issues.push({severity:'warning',entityId:e.id,message:`path_waypoint target "${e.props.target}" does not exist.`});
  }
  return issues;
}
