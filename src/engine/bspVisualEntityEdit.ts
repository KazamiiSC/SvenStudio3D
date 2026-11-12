/** Point-entity edits for the BSP viewport. Never edits compiled brush-model references.
 * This layer reuses bspNativeEdit's validated, copy-on-export entity lump writer.
 */
import type {BspEntity, BspMap} from './bsp';
import {addNativeEntity,addNativeProperty,nativeClassname,nativeProperty,removeNativeEntity,setNativeValue,type NativeBsp,type NativeEntity} from './bspNativeEdit';
import type {Vec3} from './types';

export const bspPointEditable=(entity:NativeEntity|undefined,index:number)=>!!entity&&index>0&&
  nativeClassname(entity)!=='worldspawn'&&!entity.pairs.some(p=>p.key==='model'&&/^\*\d+$/.test(p.value));

export function bspEditVector(value:string):Vec3{
  const fields=value.trim().split(/\s+/);
  if(fields.length!==3||!fields.every(v=>v.length>0&&Number.isFinite(Number(v))))throw Error('Origin must contain three finite numbers.');
  const numbers=fields.map(Number);
  if(numbers.some(v=>Math.abs(v)>131072))throw Error('Entity coordinates must be within ±131072 units.');
  return numbers as Vec3;
}
const lastPairIndex=(entity:NativeEntity,key:string)=>{
  for(let i=entity.pairs.length-1;i>=0;i--)if(entity.pairs[i].key===key)return i;
  return -1;
};
const lastPairValue=(entity:NativeEntity,key:string)=>{
  const index=lastPairIndex(entity,key);return index>=0?entity.pairs[index].value:'';
};
export const bspFormatNumber=(v:number)=>String(Number(v.toFixed(3)));
export const bspFormatVector=(pos:Vec3)=>pos.map(bspFormatNumber).join(' ');

export function bspSetPointField(doc:NativeBsp,index:number,key:string,value:string,pairIndex?:number):NativeBsp{
  if(!bspPointEditable(doc.entities[index],index))throw Error('Compiled brush entities and worldspawn cannot be transformed in BSP visual edit mode.');
  if(key==='origin')bspEditVector(value);
  if(key==='model'&&/^\*\d+$/.test(value))throw Error('Cannot assign a compiled brush model reference to a point entity.');
  if(key==='angles'||key==='angle'){
    const nums=value.trim().split(/\s+/).map(Number);
    if(nums.length!==(key==='angles'?3:1)||!nums.every(Number.isFinite))throw Error('Angles must contain finite numbers.');
  }
  const pairs=doc.entities[index].pairs;
  const pair=pairIndex===undefined?lastPairIndex(doc.entities[index],key):pairIndex;
  if(pairIndex!==undefined&&pairs[pairIndex]?.key!==key)throw Error('Keyvalue changed before edit was committed.');
  return pair>=0?setNativeValue(doc,index,pair,value):addNativeProperty(doc,index,key,value);
}
export function bspMovePoint(doc:NativeBsp,index:number,position:Vec3):NativeBsp{
  return bspSetPointField(doc,index,'origin',bspFormatVector(position));
}
export function bspRotatePointYaw(doc:NativeBsp,index:number,yaw:number):NativeBsp{
  if(!Number.isFinite(yaw))throw Error('Invalid rotation.');
  const current=doc.entities[index];
  const angles=lastPairValue(current,'angles');
  if(angles.trim()){
    const values=angles.trim().split(/\s+/).map(Number);
    if(values.length!==3||!values.every(Number.isFinite))throw Error('Cannot rotate malformed angles.');
    return bspSetPointField(doc,index,'angles',`${bspFormatNumber(values[0])} ${bspFormatNumber(yaw)} ${bspFormatNumber(values[2])}`);
  }
  return bspSetPointField(doc,index,'angle',bspFormatNumber(yaw));
}
export function bspPointYaw(entity:NativeEntity):number{
  const angles=lastPairValue(entity,'angles').trim().split(/\s+/).map(Number);
  if(angles.length===3&&angles.every(Number.isFinite))return angles[1];
  const yaw=Number(lastPairValue(entity,'angle'));return Number.isFinite(yaw)?yaw:0;
}
export function bspDuplicatePoint(doc:NativeBsp,index:number):NativeBsp{
  const entity=doc.entities[index];if(!bspPointEditable(entity,index))throw Error('Only point entities can be duplicated in BSP visual edit mode.');
  const start=doc.entities.length;
  const origin=bspEditVector(lastPairValue(entity,'origin')||'0 0 0');
  let next=addNativeEntity(doc,nativeClassname(entity),bspFormatVector([origin[0]+32,origin[1],origin[2]]));
  for(const pair of entity.pairs){
    if(pair.key==='classname'||pair.key==='origin')continue;
    // Avoid two distinct entities declaring exactly the same targetname.
    const value=pair.key==='targetname'?`${pair.value}_copy`:pair.value;
    next=addNativeProperty(next,start,pair.key,value);
  }
  return next;
}
export function bspDeletePoint(doc:NativeBsp,index:number):NativeBsp{
  if(!bspPointEditable(doc.entities[index],index))throw Error('Only point entities can be removed in BSP visual edit mode.');
  return removeNativeEntity(doc,index);
}
/** Original BSP geometry stays in place. This only substitutes entities for fast live preview. */
export function bspPreviewEntities(doc:NativeBsp):BspEntity[]{
  return doc.entities.map(entity=>{
    const properties:Record<string,string>={};
    for(const {key,value} of entity.pairs)properties[key]=value;
    let origin:Vec3|undefined;
    try{if(properties.origin)origin=bspEditVector(properties.origin)}catch{/* Keep malformed origin in properties, not scene coordinates. */}
    return {classname:nativeClassname(entity),origin,properties};
  });
}
export function bspPreviewMap(map:BspMap,doc:NativeBsp):BspMap{
  const entities=bspPreviewEntities(doc);
  return {...map,entities,stats:{...map.stats,entities:entities.length}};
}
