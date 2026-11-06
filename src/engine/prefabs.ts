/** Portable reusable room/brush/entity prefabs for SvenStudio 3D 0.7.0. */
import type {MapObject,Vec3} from './types';
import {uid} from './types';
import {validateBrush} from './exportMap';
import {lockTranslatedBrushTextures} from './textureStudio';
import {rotateObjectsForPlacement} from './smartPlacement';
import type {PlacementAxis} from './smartPlacementMath';
export type Prefab={version:1;id:string;name:string;origin:Vec3;objects:MapObject[]};
const copy=<T>(value:T):T=>structuredClone(value);
const finitePosition=(p:unknown):p is Vec3=>Array.isArray(p)&&p.length===3&&p.every(v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=131072);
export function createPrefab(objects:MapObject[],label:string):Prefab{
  const name=label.trim().slice(0,64);
  if(!name)throw Error('Enter a prefab name.');
  if(!objects.length||objects.length>256)throw Error('Select between 1 and 256 objects.');
  if(objects.some(o=>!finitePosition(o.position)))throw Error('Prefab contains invalid coordinates.');
  const origin=([0,1,2].map(i=>objects.reduce((sum,o)=>sum+o.position[i],0)/objects.length) as Vec3);
  const ids=new Set(objects.map(o=>o.id));
  const copies=objects.map(o=>{
    const clone=copy(o);
    // A prefab that excludes the func_ entity cannot leave dangling entity IDs.
    if(clone.kind==='brush'&&clone.entityId&&!ids.has(clone.entityId))delete clone.entityId;
    return clone;
  });
  return {id:uid(),version:1,name,origin,objects:copies};
}
/** Create a copy at a desired pivot; remap func_ owner ids and group labels. */
export function placePrefab(prefab:Prefab,at:Vec3,axis:PlacementAxis='z',angle=0,autoYaw=0):MapObject[]{
  if(!finitePosition(at))throw Error('Invalid prefab placement.');
  const checked=validatePrefab(prefab);
  const ids=new Map(checked.objects.map(o=>[o.id,uid()]));
  const groupNames=new Map<string,string>();
  const objects=checked.objects.map(original=>{
    const clone=copy(original);
    clone.id=ids.get(original.id)!;
    const nextPosition=original.position.map((value,i)=>value-checked.origin[i]+at[i]) as Vec3;
    // A reused door, button or wall must retain its original visible UV layout.
    if(original.kind==='brush'&&clone.kind==='brush')clone.faces=lockTranslatedBrushTextures(original,nextPosition);
    clone.position=nextPosition;
    if(clone.group){
      if(!groupNames.has(clone.group))groupNames.set(clone.group,`${clone.group} ${clone.id.slice(0,6)}`);
      clone.group=groupNames.get(clone.group);
    }
    if(clone.kind==='brush'&&clone.entityId)clone.entityId=ids.get(clone.entityId);
    return clone;
  });
  const placed=rotateObjectsForPlacement(objects,at,axis,angle,autoYaw);
  for(const object of placed){
    if(!finitePosition(object.position))throw Error('Prefab is outside the map limits.');
    if(object.kind==='brush'){
      const problems=validateBrush(object);if(problems.length)throw Error(problems[0]);
    }
  }
  return placed;
}
export function validatePrefab(value:unknown):Prefab{
  const o=value as Partial<Prefab>;
  if(!o||o.version!==1||typeof o.id!=='string'||typeof o.name!=='string'||o.name.length<1||o.name.length>64||
     !finitePosition(o.origin)||!Array.isArray(o.objects)||o.objects.length<1||o.objects.length>256)
    throw Error('Invalid Sven Studio prefab file.');
  const ids=new Set<string>();
  for(const item of o.objects){
    if(!item||typeof item.id!=='string'||ids.has(item.id)||!finitePosition(item.position)||
      (item.kind!=='brush'&&item.kind!=='entity'))throw Error('Prefab contains malformed objects.');
    ids.add(item.id);
    if(item.kind==='brush'){
      if(!Array.isArray(item.vertices)||!Array.isArray(item.faces)||!finitePosition(item.rotation)||!finitePosition(item.scale))throw Error('Malformed prefab brush.');
      const problems=validateBrush(item);if(problems.length)throw Error(problems[0]);
    }else if(typeof item.classname!=='string'||!item.props||typeof item.props!=='object')throw Error('Malformed prefab entity.');
  }
  return o as Prefab;
}
export function readPrefabLibrary():Prefab[]{
  try{const value=JSON.parse(localStorage.getItem('svenstudio-prefabs-v1')||'[]');return Array.isArray(value)?value.slice(0,64).flatMap(p=>{try{return [validatePrefab(p)]}catch{return []}}):[]}catch{return []}
}
export function writePrefabLibrary(prefabs:Prefab[]){
  if(prefabs.length>64)throw Error('Prefab library maximum is 64 entries.');
  localStorage.setItem('svenstudio-prefabs-v1',JSON.stringify(prefabs));
}
