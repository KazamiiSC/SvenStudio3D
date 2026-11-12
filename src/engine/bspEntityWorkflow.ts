/** BSP Editor Preview 5: entity-only batch edits and visual I/O wiring.
 * Operates strictly on the native entity lump; BSP faces, models and hulls stay untouched.
 */
import type {BspEntity} from './bsp';
import {addNativeProperty,nativeClassname,setNativeValue,type NativeBsp,type NativeEntity} from './bspNativeEdit';
import {bspEditVector,bspFormatNumber,bspMovePoint,bspPointEditable,bspSetPointField} from './bspVisualEntityEdit';
import type {Vec3} from './types';

export type BspConnection={from:number;to:number;key:'target'|'killtarget'|'trigger_target';name:string};
export type BspConnectionAudit={connections:BspConnection[];unresolved:Array<{from:number;key:BspConnection['key'];name:string}>};
export const BSP_CONNECTION_KEYS=['target','killtarget','trigger_target'] as const;
const clean=(value:string)=>value.trim().toLowerCase();

/** Multiple destination entities may share one targetname in GoldSrc. All matches are retained. */
export function bspEntityConnections(entities:Pick<BspEntity,'properties'>[],fromFilter?:readonly number[]):BspConnectionAudit{
  const names=new Map<string,number[]>();
  for(let i=0;i<entities.length;i++){
    const name=clean(entities[i].properties.targetname||'');if(!name)continue;
    const destinations=names.get(name)||[];destinations.push(i);names.set(name,destinations);
  }
  const allowed=fromFilter?new Set(fromFilter):null;
  const connections:BspConnection[]=[],unresolved:BspConnectionAudit['unresolved']=[];
  for(let from=1;from<entities.length;from++){
    if(allowed&&!allowed.has(from))continue;
    for(const key of BSP_CONNECTION_KEYS){
      const name=entities[from].properties[key]?.trim();if(!name)continue;
      // Sven Co-op target lists/scripts are not a single named target; don't invent a wire.
      if(/[;,]/.test(name)||name.startsWith('!'))continue;
      const targets=names.get(clean(name));
      if(!targets?.length){unresolved.push({from,key,name});continue}
      for(const to of targets)connections.push({from,to,key,name});
    }
  }
  return {connections,unresolved};
}
const last=(entity:NativeEntity,key:string)=>[...entity.pairs].reverse().find(pair=>pair.key===key)?.value||'';
const safeIndex=(doc:NativeBsp,index:number)=>Number.isInteger(index)&&index>0&&index<doc.entities.length;
/** Generate a targetname only if needed; never rewrite other entities' target references. */
export function bspConnectEntities(doc:NativeBsp,from:number,to:number,key:BspConnection['key']='target'):NativeBsp{
  if(!safeIndex(doc,from)||!safeIndex(doc,to)||!bspPointEditable(doc.entities[from],from))throw Error('Choose an editable point entity as the connection source and a valid destination.');
  if(!BSP_CONNECTION_KEYS.includes(key))throw Error('Unsupported entity connection key.');
  const targetEntity=doc.entities[to];let name=last(targetEntity,'targetname').trim(),next=doc;
  if(!name){
    const prefix=nativeClassname(targetEntity).replace(/[^A-Za-z0-9_]/g,'_').slice(0,34)||'entity';
    const used=new Set(doc.entities.map(e=>last(e,'targetname').toLowerCase()).filter(Boolean));
    for(let n=1;n<100000;n++){
      const candidate=`${prefix}_bsp${n}`;
      if(!used.has(candidate.toLowerCase())){name=candidate;break}
    }
    if(!name)throw Error('Could not allocate a unique targetname.');
    let existing=-1;for(let i=targetEntity.pairs.length-1;i>=0;i--)if(targetEntity.pairs[i].key==='targetname'){existing=i;break}
    next=existing>=0?setNativeValue(next,to,existing,name):addNativeProperty(next,to,'targetname',name);
  }
  return bspSetPointField(next,from,key,name);
}
/** Transactional batch edit: prevalidate EVERY entity before changing any of them. */
export function bspSetMultiplePointFields(doc:NativeBsp,indices:readonly number[],key:string,value:string):NativeBsp{
  const unique=[...new Set(indices)];
  if(!unique.length||unique.length>256||unique.some(i=>!safeIndex(doc,i)||!bspPointEditable(doc.entities[i],i)))throw Error('Select 1–256 editable point entities.');
  if(['classname','model','origin','angles','angle','targetname'].includes(key))throw Error('Bulk editing this field could invalidate compiled models, positions, or entity names.');
  let next=doc;
  for(const i of unique)next=bspSetPointField(next,i,key,value);
  return next;
}
/** Preserve relative offsets when moving a group. Every member is validated first. */
export function bspTranslatePoints(doc:NativeBsp,indices:readonly number[],delta:Vec3):NativeBsp{
  const unique=[...new Set(indices)];
  if(!unique.length||unique.length>256||unique.some(i=>!safeIndex(doc,i)||!bspPointEditable(doc.entities[i],i)))throw Error('Select 1–256 editable point entities.');
  if(delta.length!==3||delta.some(v=>!Number.isFinite(v)))throw Error('Invalid group displacement.');
  const current=unique.map(i=>bspEditVector(last(doc.entities[i],'origin')||'0 0 0'));
  const destination=current.map(p=>p.map((v,k)=>v+delta[k]) as Vec3);
  for(const position of destination)bspEditVector(position.map(bspFormatNumber).join(' '));
  let next=doc;
  for(let k=0;k<unique.length;k++)next=bspMovePoint(next,unique[k],destination[k]);
  return next;
}
export function bspFlagValue(value:string,bit:number,enabled:boolean):string{
  if(!Number.isInteger(bit)||bit<=0||bit>0x80000000||(bit&(bit-1))!==0)throw Error('Invalid FGD spawnflag bit.');
  if(!/^-?\d+$/.test(value.trim()||'0'))throw Error('Spawnflags must be a signed 32-bit or unsigned 32-bit integer.');
  const current=Number(value.trim()||'0');
  if(!Number.isSafeInteger(current)||current>0xffffffff||current < -2147483648)throw Error('Invalid spawnflags value.');
  const updated=(enabled?(current|bit):(current&~bit))>>>0;
  return String(current<0?(updated|0):updated);
}
/** Convenience for showing a bounded line set in the 3D viewport. */
export function bspConnectionPositions(entities:Pick<BspEntity,'origin'|'properties'>[],connections:readonly BspConnection[],limit=160){
  return connections.filter(c=>entities[c.from]?.origin&&entities[c.to]?.origin).slice(0,limit).map(c=>({
    ...c,start:entities[c.from].origin!,end:entities[c.to].origin!
  }));
}
