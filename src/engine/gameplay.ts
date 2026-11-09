/** Gameplay Studio v0.6.0: explicit Svengine keyvalue wiring.
 * A graph link is NOT a script: it represents source.target = dest.targetname.
 * Keep brush geometry attached via Brush.entityId and export through Valve 220.
 */
import type {Brush,MapObject,PointEntity,Vec3} from './types';
import {uid} from './types';

const entity=(o:MapObject):o is PointEntity=>o.kind==='entity';
const brush=(o:MapObject):o is Brush=>o.kind==='brush';
export type GameplayIssue={severity:'warning'|'error';message:string;entityId?:string};
export type GameplayConnection={from:string;to:string;name:string};

export function getConnections(objects:MapObject[]):GameplayConnection[]{
  const entities=objects.filter(entity);
  const targets=new Map<string,PointEntity[]>();
  for(const e of entities){const name=e.props.targetname?.trim();if(name){const list=targets.get(name)||[];list.push(e);targets.set(name,list);}}
  return entities.flatMap(source=>{
    const name=source.props.target?.trim();
    return name?(targets.get(name)||[]).map(dest=>({from:source.id,to:dest.id,name})):[];
  });
}
export function uniqueTargetname(objects:MapObject[],prefix:string):string{
  const names=new Set(objects.filter(entity).map(o=>o.props.targetname).filter(Boolean));
  const root=prefix.toLowerCase().replace(/[^a-z0-9_]/g,'_').replace(/_+/g,'_').replace(/^_|_$/g,'')||'entity';
  for(let n=1;n<100000;n++){
    const name=`${root}_${String(n).padStart(2,'0')}`;
    if(!names.has(name))return name;
  }
  throw Error('Unable to allocate a unique targetname.');
}
export function connectGameplay(objects:MapObject[],fromId:string,toId:string,replace=false):MapObject[]{
  if(fromId===toId)throw Error('Cannot connect an entity to itself.');
  const source=objects.find(o=>o.id===fromId&&entity(o)) as PointEntity|undefined;
  const dest=objects.find(o=>o.id===toId&&entity(o)) as PointEntity|undefined;
  if(!source||!dest)throw Error('Both nodes must be Svengine entities.');
  if(source.locked||dest.locked)throw Error('Unlock both entities before changing their connections.');
  const name=dest.props.targetname?.trim()||uniqueTargetname(objects,dest.classname.replace(/^(func_|trigger_|monster_)/,''));
  const current=source.props.target?.trim();
  if(current&&current!==name&&!replace)throw Error(`Source already targets "${current}". Replace this connection explicitly.`);
  return objects.map(o=>o.id===source.id?{...source,props:{...source.props,target:name}}:o.id===dest.id?{...dest,props:{...dest.props,targetname:name}}:o);
}
export function disconnectGameplay(objects:MapObject[],fromId:string):MapObject[]{
  return objects.map(o=>o.id===fromId&&entity(o)?{...o,props:{...o.props,target:''}}:o);
}
export function makeBrushEntity(objects:MapObject[],brushId:string,classname:'func_door'|'func_button'):{objects:MapObject[];id:string}{
  const selected=objects.find(o=>o.id===brushId&&brush(o)) as Brush|undefined;
  if(!selected)throw Error('Select a brush to create a door or button.');
  if(selected.locked)throw Error('Unlock the brush first.');
  if(selected.entityId)throw Error('This brush already belongs to an entity. Select an unassigned brush.');
  const id=uid();
  const isDoor=classname==='func_door';
  const props:Record<string,string>=isDoor?{
    targetname:uniqueTargetname(objects,'door'),speed:'100',wait:'3',lip:'8',angles:'0 0 0',spawnflags:'0'
  }:{targetname:uniqueTargetname(objects,'button'),speed:'5',wait:'1',angle:'0',spawnflags:'1'};
  const ent:PointEntity={id,kind:'entity',name:classname,classname,position:[...selected.position],props,layer:'Gameplay'};
  return {id,objects:[...objects.map(o=>o.id===brushId?{...selected,entityId:id}:o),ent]};
}
export function makeRelay(objects:MapObject[],position:Vec3):{objects:MapObject[];id:string}{
  const id=uid();const e:PointEntity={id,kind:'entity',name:'trigger_relay',classname:'trigger_relay',
    position:[...position],props:{targetname:uniqueTargetname(objects,'relay'),triggerstate:'2',delay:'0',spawnflags:'0'},layer:'Gameplay'};
  return {objects:[...objects,e],id};
}
export function analyzeGameplay(objects:MapObject[]):GameplayIssue[]{
  const issues:GameplayIssue[]=[];
  const entities=objects.filter(entity);
  const byName=new Map<string,PointEntity[]>();
  for(const e of entities){const n=e.props.targetname?.trim();if(n){const list=byName.get(n)||[];list.push(e);byName.set(n,list);}}
  const brushOwners=new Set(objects.filter(brush).map(b=>b.entityId).filter(Boolean));
  const entityIds=new Set(entities.map(e=>e.id));
  for(const e of entities){
    const target=e.props.target?.trim();
    if(target&&!target.startsWith('!')&&!byName.has(target))issues.push({severity:'warning',message:`${e.classname}: target "${target}" has no matching targetname.`,entityId:e.id});
    if(target&&e.props.targetname&&target===e.props.targetname)issues.push({severity:'warning',message:`${e.classname}: self-referencing target "${target}".`,entityId:e.id});
    if(['func_door','func_button','func_door_rotating','trigger_multiple','trigger_once'].includes(e.classname)&&!brushOwners.has(e.id))
      issues.push({severity:'error',message:`${e.classname} requires a linked brush, but none was found.`,entityId:e.id});
    if(e.classname==='func_button'&&!target)issues.push({severity:'warning',message:'func_button has no target; pressing it will not activate another entity.',entityId:e.id});
    if(e.classname==='trigger_relay'&&!target)issues.push({severity:'warning',message:'trigger_relay has no target.',entityId:e.id});
  }
  for(const b of objects.filter(brush))if(b.entityId&&!entityIds.has(b.entityId))
    issues.push({severity:'error',message:`Brush "${b.name}" references a missing entity.`,entityId:b.id});
  return issues;
}
