/** Entity report: one table of every entity, with problems, bulk keyvalue edits and a
 * targetname rename that also updates every reference to it (one Undo step in the store).
 * Only GoldSrc/Sven keys that really hold a targetname are rewritten; classnames, models,
 * sounds and messages are never touched.
 */
import type {MapObject,PointEntity} from './types';
import {hasStaticSvenTarget} from './svenEntitySemantics';

/** Keys whose value is another entity's targetname. */
export const TARGET_REFERENCE_KEYS=['target','killtarget','master','moveto','LightningStart','LightningEnd','LaserTarget','m_iszNewTarget','m_iszEntity'] as const;
const REFERENCE=new Set<string>(TARGET_REFERENCE_KEYS);
/** multi_manager stores its targets as keys ("door1" or "door1#2" for repeats). */
const MULTI_MANAGER_RESERVED=new Set(['classname','targetname','origin','spawnflags','wait','angles','angle','frags','health','renderamt','rendermode','rendercolor','renderfx','globalname','zhlt_lightflags','light_origin']);

export type EntityRow={
  id:string;classname:string;targetname:string;target:string;origin:[number,number,number];
  brushCount:number;incoming:number;brokenRefs:string[];hidden:boolean;locked:boolean;keyCount:number;
};
export type RenamePlan={objects:MapObject[];renamedEntities:number;updatedReferences:number;skippedWildcards:number;skippedLocked:number};

const isEntity=(o:MapObject):o is PointEntity=>o.kind==='entity';
const runtimeRef=(v:string)=>v.startsWith('!');

function multiManagerTargets(e:PointEntity):string[]{
  if(e.classname!=='multi_manager')return [];
  return Object.keys(e.props).filter(k=>!MULTI_MANAGER_RESERVED.has(k)).map(k=>k.replace(/#\d+$/,''));
}

/** Every targetname an entity points at (for links, incoming counts and broken-reference checks). */
export function entityReferences(e:PointEntity):{key:string;value:string}[]{
  const out:{key:string;value:string}[]=[];
  for(const [key,raw] of Object.entries(e.props)){
    const value=String(raw??'').trim();
    if(value&&REFERENCE.has(key))out.push({key,value});
  }
  for(const name of multiManagerTargets(e))out.push({key:'multi_manager',value:name});
  return out;
}

export function buildEntityReport(objects:readonly MapObject[]):EntityRow[]{
  const entities=objects.filter(isEntity);
  const names=new Set(entities.map(e=>e.props.targetname?.trim()).filter((n):n is string=>!!n));
  const incoming=new Map<string,number>();
  for(const e of entities)for(const r of entityReferences(e))incoming.set(r.value,(incoming.get(r.value)??0)+1);
  const brushCounts=new Map<string,number>();
  for(const o of objects)if(o.kind==='brush'&&o.entityId)brushCounts.set(o.entityId,(brushCounts.get(o.entityId)??0)+1);
  return entities.map(e=>{
    const targetname=e.props.targetname?.trim()??'';
    const brokenRefs=entityReferences(e).filter(r=>!runtimeRef(r.value)&&!hasStaticSvenTarget(r.value,names)).map(r=>`${r.key} → ${r.value}`);
    return {id:e.id,classname:e.classname,targetname,target:e.props.target?.trim()??'',origin:[...e.position] as [number,number,number],
      brushCount:brushCounts.get(e.id)??0,incoming:targetname?incoming.get(targetname)??0:0,brokenRefs,hidden:!!e.hidden,locked:!!e.locked,keyCount:Object.keys(e.props).length};
  });
}

/** Free-text filter over classname, targetname and every key/value of the entity. */
export function entityMatches(e:PointEntity,query:string):boolean{
  const q=query.trim().toLowerCase();
  if(!q)return true;
  if(e.classname.toLowerCase().includes(q))return true;
  return Object.entries(e.props).some(([k,v])=>k.toLowerCase().includes(q)||String(v).toLowerCase().includes(q));
}

export function validTargetname(name:string):boolean{
  return /^[^\s"*!]{1,127}$/.test(name);
}

/** Rename a targetname and every reference to it. Wildcard ("door*") and runtime ("!activator")
 * references are left alone and counted. Locked entities are skipped and reported. */
export function planTargetnameRename(objects:readonly MapObject[],from:string,to:string):RenamePlan{
  const oldName=from.trim(),newName=to.trim();
  if(!oldName)throw Error('Choose the targetname to rename.');
  if(!validTargetname(newName))throw Error('The new targetname cannot be empty or contain spaces, quotes, * or !.');
  if(oldName===newName)throw Error('The new targetname is the same as the old one.');
  let renamedEntities=0,updatedReferences=0,skippedWildcards=0,skippedLocked=0;
  const next=objects.map(o=>{
    if(!isEntity(o))return o;
    let props=o.props,changed=false;
    const touches=o.props.targetname?.trim()===oldName||entityReferences(o).some(r=>r.value===oldName);
    if(touches&&o.locked){skippedLocked++;return o;}
    if(o.props.targetname?.trim()===oldName){props={...props,targetname:newName};renamedEntities++;changed=true;}
    for(const [key,raw] of Object.entries(o.props)){
      if(!REFERENCE.has(key))continue;
      const value=String(raw??'').trim();
      if(value===oldName){props={...props,[key]:newName};updatedReferences++;changed=true;}
      else if(value.endsWith('*')&&oldName.startsWith(value.slice(0,-1)))skippedWildcards++;
    }
    if(o.classname==='multi_manager'){
      const entries=Object.entries(props);
      if(entries.some(([k])=>!MULTI_MANAGER_RESERVED.has(k)&&k.replace(/#\d+$/,'')===oldName)){
        // Keep key order: GoldSrc fires multi_manager targets in keyvalue order.
        props=Object.fromEntries(entries.map(([k,v])=>{
          if(MULTI_MANAGER_RESERVED.has(k))return [k,v];
          const suffix=k.match(/#\d+$/)?.[0]??'';
          if(k.slice(0,k.length-suffix.length)!==oldName)return [k,v];
          updatedReferences++;return [`${newName}${suffix}`,v];
        }));
        changed=true;
      }
    }
    return changed?{...o,props}:o;
  });
  return {objects:next,renamedEntities,updatedReferences,skippedWildcards,skippedLocked};
}

/** Set (or remove, with an empty value) one keyvalue on many entities. classname/origin are protected. */
export function planBulkKeyvalue(objects:readonly MapObject[],ids:readonly string[],key:string,value:string):{objects:MapObject[];changed:number;skippedLocked:number}{
  const k=key.trim();
  if(!k||/[\s"]/.test(k))throw Error('Enter a key without spaces or quotes.');
  if(k==='classname'||k==='origin')throw Error('classname and origin cannot be edited in bulk.');
  if(/"/.test(value))throw Error('Values cannot contain double quotes.');
  const chosen=new Set(ids);let changed=0,skippedLocked=0;
  const next=objects.map(o=>{
    if(!isEntity(o)||!chosen.has(o.id))return o;
    if(o.locked){skippedLocked++;return o;}
    const current=o.props[k];
    if(value===''){if(current===undefined)return o;const {[k]:_removed,...rest}=o.props;changed++;return {...o,props:rest};}
    if(current===value)return o;
    changed++;return {...o,props:{...o.props,[k]:value}};
  });
  return {objects:next,changed,skippedLocked};
}
