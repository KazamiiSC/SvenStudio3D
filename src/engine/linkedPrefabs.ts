/** HF15: Linked MAP prefabs. Metadata only: every instance is ordinary MAP geometry.
 * No implicit writes on edits and no dependency on the browser prefab library. */
import type {MapObject,Project,Vec3} from './types';
import {uid} from './types';
import {createPrefab,placePrefab,validatePrefab,type Prefab} from './prefabs';

export type LinkedPrefabInstance={id:string;anchor:Vec3;yaw:number;memberIds:Record<string,string>;prefix:string};
export type LinkedPrefabRecord={id:string;name:string;sourceIds:string[];template:Prefab;instances:LinkedPrefabInstance[]};
export type LinkedPrefabPreview={linkId:string;name:string;instances:number;before:number;after:number;removed:number;added:number;updated:number;selectionIds:string[];project:Project};
const clone=<T>(x:T):T=>structuredClone(x);
const validVec=(v:unknown):v is Vec3=>Array.isArray(v)&&v.length===3&&v.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<=131072);
const key=(s:unknown)=>typeof s==='string'&&s.length>0&&s.length<=256;
const refKeys=new Set(['target','killtarget']);
const slug=()=>`ss${uid().replace(/[^a-z0-9]/gi,'').slice(-10).toLowerCase()}_`;
const links=(p:Project)=>p.linkedPrefabs??[];
const findLink=(p:Project,id:string)=>{const l=links(p).find(l=>l.id===id);if(!l)throw Error('Linked prefab not found.');return l};
const existing=(p:Project)=>new Map(p.objects.map(o=>[o.id,o]));
const sourceObjects=(p:Project,ids:string[],forLink?:string):MapObject[]=>{
  const idsSet=new Set(ids);
  if(!ids.length||ids.length>256||idsSet.size!==ids.length)throw Error('Select 1–256 distinct objects.');
  const blocked=new Set<string>();
  for(const link of links(p)){
    if(link.id!==forLink)link.sourceIds.forEach(id=>blocked.add(id));
    link.instances.forEach(inst=>Object.values(inst.memberIds).forEach(id=>blocked.add(id)));
  }
  if(ids.some(id=>blocked.has(id)))throw Error('Selection includes objects already managed by another prefab instance. Detach them first.');
  const byId=existing(p);
  return ids.map(id=>{const o=byId.get(id);if(!o)throw Error('A selected source object was removed.');return o});
};
/** Only EXACT internal targetname references are renamed. External and wildcard references remain untouched. */
export function namespaceLinkedTargets(objects:MapObject[],prefix:string):MapObject[]{
  const names=new Set(objects.filter(o=>o.kind==='entity').map(o=>o.kind==='entity'?o.props.targetname?.trim():null).filter((x):x is string=>!!x));
  for(const name of names)if(prefix.length+name.length>63)throw Error(`Targetname is too long for safe linked copies: ${name}`);
  return objects.map(o=>{
    if(o.kind!=='entity')return o;
    const props={...o.props};
    if(props.targetname&&names.has(props.targetname))props.targetname=prefix+props.targetname;
    for(const k of Object.keys(props)){
      if(!refKeys.has(k.toLowerCase()))continue;
      if(names.has(props[k]))props[k]=prefix+props[k];
    }
    return {...o,props};
  });
}
export function createLinkedPrefab(project:Project,selectedIds:string[],name:string):Project{
  if(links(project).length>=64)throw Error('Maximum of 64 linked prefab definitions per project.');
  const source=sourceObjects(project,selectedIds);
  const template=createPrefab(source,name);
  const record:LinkedPrefabRecord={id:uid(),name:template.name,sourceIds:source.map(o=>o.id),template,instances:[]};
  return {...project,linkedPrefabs:[...links(project),record]};
}
const copied=(template:Prefab,anchor:Vec3,yaw:number,prefix:string):{objects:MapObject[];memberIds:Record<string,string>}=>{
  const generated=namespaceLinkedTargets(placePrefab(template,anchor,'z',yaw),prefix);
  if(generated.length!==template.objects.length)throw Error('Unexpected linked prefab object count.');
  return {objects:generated,memberIds:Object.fromEntries(template.objects.map((o,i)=>[o.id,generated[i].id]))};
};
export function addLinkedPrefabInstance(project:Project,id:string,anchor:Vec3,yaw=0):{project:Project;ids:string[]}{
  const link=findLink(project,id);
  if(!validVec(anchor)||!Number.isFinite(yaw)||yaw<-360||yaw>360)throw Error('Invalid linked prefab placement.');
  if(link.instances.length>=64)throw Error('Maximum 64 copies per linked prefab.');
  const prefix=slug();
  const result=copied(link.template,anchor,yaw,prefix);
  const instance:LinkedPrefabInstance={id:uid(),anchor:[...anchor],yaw,memberIds:result.memberIds,prefix};
  const next=links(project).map(l=>l.id===id?{...l,instances:[...l.instances,instance]}:l);
  return {project:{...project,objects:[...project.objects,...result.objects],linkedPrefabs:next},ids:result.objects.map(o=>o.id)};
}
/** Fail closed if a copy is incomplete. Never delete arbitrary objects after a broken link. */
export function planLinkedPrefabSync(project:Project,id:string,newSourceIds?:string[]):LinkedPrefabPreview{
  const link=findLink(project,id);
  const ids=newSourceIds??link.sourceIds;
  const source=sourceObjects(project,ids,id);
  if(!source.some(o=>link.sourceIds.includes(o.id)))throw Error('Selection must include at least one original source object.');
  const template=createPrefab(source,link.name);
  const byId=existing(project);
  for(const inst of link.instances){
    for(const member of Object.values(inst.memberIds))if(!byId.has(member))throw Error('A linked copy is incomplete. Detach that copy before synchronizing.');
  }
  const oldMembers=new Set(link.instances.flatMap(i=>Object.values(i.memberIds)));
  const newItems:MapObject[]=[];
  const nextInstances:LinkedPrefabInstance[]=[];
  let added=0,removed=0,updated=0;
  for(const instance of link.instances){
    const next=copied(template,instance.anchor,instance.yaw,instance.prefix);
    const replacementIds=new Map<string,string>();
    for(const original of template.objects){
      const previous=instance.memberIds[original.id];
      if(previous){replacementIds.set(next.memberIds[original.id],previous);updated++}else added++;
    }
    for(const oldId of Object.keys(instance.memberIds))if(!next.memberIds[oldId])removed++;
    // Keep IDs stable for the same source part so selection, triggers and undo can survive updates.
    const memberIds:Record<string,string>={};
    for(const original of template.objects)memberIds[original.id]=replacementIds.get(next.memberIds[original.id])??next.memberIds[original.id];
    for(const generated of next.objects){
      const oldGeneratedId=generated.id;
      generated.id=replacementIds.get(oldGeneratedId)??oldGeneratedId;
      if(generated.kind==='brush'&&generated.entityId)generated.entityId=replacementIds.get(generated.entityId)??generated.entityId;
      newItems.push(generated);
    }
    nextInstances.push({...instance,memberIds});
  }
  const nextLink:LinkedPrefabRecord={...link,template,sourceIds:[...ids],instances:nextInstances};
  const nextProject:Project={...project,objects:[...project.objects.filter(o=>!oldMembers.has(o.id)),...newItems],linkedPrefabs:links(project).map(l=>l.id===id?nextLink:l)};
  return {linkId:id,name:link.name,instances:link.instances.length,before:link.template.objects.length,after:template.objects.length,removed,added,updated,selectionIds:[...ids],project:nextProject};
}
/** Reposition one entire linked copy explicitly. Never move other instances or the source. */
export function repositionLinkedPrefabInstance(project:Project,linkId:string,instanceId:string,anchor:Vec3,yaw:number):{project:Project;ids:string[]}{
  const link=findLink(project,linkId);
  const inst=link.instances.find(i=>i.id===instanceId);
  if(!inst)throw Error('Linked copy not found.');
  if(!validVec(anchor)||!Number.isFinite(yaw)||Math.abs(yaw)>360)throw Error('Invalid linked copy transform.');
  const objectIds=new Set(Object.values(inst.memberIds));
  const byId=existing(project);
  if([...objectIds].some(id=>!byId.has(id)))throw Error('A linked copy is incomplete. Detach it before repositioning.');
  const next=copied(link.template,anchor,yaw,inst.prefix);
  const replacement=new Map(link.template.objects.map(source=>[next.memberIds[source.id],inst.memberIds[source.id]]));
  const members:Record<string,string>={};
  for(const source of link.template.objects)members[source.id]=inst.memberIds[source.id];
  const items=next.objects.map(o=>{
    const previous=o.id;
    o.id=replacement.get(previous)??previous;
    if(o.kind==='brush'&&o.entityId)o.entityId=replacement.get(o.entityId)??o.entityId;
    return o;
  });
  const linkedPrefabs=links(project).map(l=>l.id!==linkId?l:{...l,instances:l.instances.map(i=>i.id===instanceId?{...i,anchor:[...anchor] as Vec3,yaw,memberIds:members}:i)});
  return {project:{...project,objects:[...project.objects.filter(o=>!objectIds.has(o.id)),...items],linkedPrefabs},ids:items.map(o=>o.id)};
}
/** Remove metadata only: never delete exported brushes or entities. */
export function detachLinkedPrefab(project:Project,id:string,instanceId?:string):Project{
  const link=findLink(project,id);
  if(!instanceId)return {...project,linkedPrefabs:links(project).filter(l=>l.id!==id)};
  if(!link.instances.some(i=>i.id===instanceId))throw Error('Linked copy not found.');
  return {...project,linkedPrefabs:links(project).map(l=>l.id===id?{...l,instances:l.instances.filter(i=>i.id!==instanceId)}:l)};
}
export function validateLinkedPrefabMetadata(project:Project):void{
  if(project.linkedPrefabs===undefined)return;
  if(!Array.isArray(project.linkedPrefabs)||project.linkedPrefabs.length>64)throw Error('Invalid linked prefab definitions.');
  const idSet=new Set<string>(),owned=new Set<string>();
  for(const item of project.linkedPrefabs){
    if(!item||!key(item.id)||!key(item.name)||idSet.has(item.id)||!Array.isArray(item.sourceIds)||!Array.isArray(item.instances)||item.instances.length>64)throw Error('Invalid linked prefab record.');
    idSet.add(item.id);
    validatePrefab(item.template);
    if(item.sourceIds.length!==item.template.objects.length||item.sourceIds.some((v,i)=>v!==item.template.objects[i].id||!key(v)||owned.has(v)))throw Error('Invalid linked prefab source mapping.');
    item.sourceIds.forEach(v=>owned.add(v));
    const copyIds=new Set<string>();
    for(const inst of item.instances){
      if(!inst||!key(inst.id)||copyIds.has(inst.id)||!validVec(inst.anchor)||typeof inst.yaw!=='number'||!Number.isFinite(inst.yaw)||Math.abs(inst.yaw)>360||typeof inst.prefix!=='string'||!/^ss[a-z0-9]{1,16}_$/.test(inst.prefix)||!inst.memberIds||typeof inst.memberIds!=='object'||Array.isArray(inst.memberIds))throw Error('Invalid linked copy metadata.');
      copyIds.add(inst.id);
      if(Object.keys(inst.memberIds).length!==item.sourceIds.length||new Set(Object.values(inst.memberIds)).size!==item.sourceIds.length||item.sourceIds.some(k=>!key(inst.memberIds[k])||owned.has(inst.memberIds[k])))throw Error('Invalid linked copy mapping.');
      Object.values(inst.memberIds).forEach(v=>owned.add(v));
    }
  }
}
