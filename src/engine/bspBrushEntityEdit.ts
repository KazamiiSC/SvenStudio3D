/** v2.6 brush-entity transforms in a compiled BSP (bspguy-style, entity lump only).
 * GoldSrc draws and collides every *N bmodel at (model vertices + entity origin), so moving a
 * brush entity only means changing its "origin" keyvalue. Geometry, hulls and VIS stay untouched;
 * baked lighting stays where it was compiled. Several entities may reference the same *N. */
import type {BspFace,BspMap} from './bsp';
import {nativeClassname,nativeProperty,type NativeBsp,type NativeEntity} from './bspNativeEdit';
import type {Vec3} from './types';

export type BspModelPlacements={offsets:Map<number,Vec3>;hidden:Set<number>;instances:{model:number;delta:Vec3}[]};
const vec=(text:string|undefined):Vec3=>{const v=(text||'').trim().split(/\s+/).map(Number);return v.length===3&&v.every(Number.isFinite)?v as Vec3:[0,0,0];};
const modelOf=(props:{model?:string}|undefined)=>{const m=/^\*(\d+)$/.exec(props?.model||'');return m?Number(m[1]):0;};
const nonZero=(v:Vec3)=>v.some(x=>Math.abs(x)>1e-6);

/** Where every *N bmodel is drawn. `entities` are the current entities (BSP or edited lump). */
export function bspBrushModelPlacements(map:Pick<BspMap,'stats'>&{faces:readonly Pick<BspFace,'model'>[]},entities:readonly {properties:Record<string,string>}[]):BspModelPlacements{
  const byModel=new Map<number,Vec3[]>();
  for(const e of entities){const n=modelOf(e.properties);if(n>0)(byModel.get(n)??byModel.set(n,[]).get(n)!).push(vec(e.properties.origin));}
  const offsets=new Map<number,Vec3>(),hidden=new Set<number>(),instances:{model:number;delta:Vec3}[]=[];
  const used=new Set<number>();for(const f of map.faces)if(f.model>0)used.add(f.model);
  for(const n of used){
    const list=byModel.get(n);
    if(!list?.length){hidden.add(n);continue;}
    if(nonZero(list[0]))offsets.set(n,list[0]);
    for(const extra of list.slice(1))instances.push({model:n,delta:extra});
  }
  return {offsets,hidden,instances};
}
/** Render copy of the map with bmodels moved to their entity origin and deleted ones removed. */
export function bspApplyModelPlacements<T extends {faces:BspFace[]}>(map:T,placements:BspModelPlacements):T{
  if(!placements.offsets.size&&!placements.hidden.size)return map;
  const faces=map.faces.filter(f=>!placements.hidden.has(f.model)).map(f=>{
    const o=placements.offsets.get(f.model);if(!o)return f;
    return {...f,points:f.points.map(p=>[p[0]+o[0],p[1]+o[1],p[2]+o[2]] as Vec3)};
  });
  return {...map,faces};
}
/** Centre of each bmodel's raw faces (before the entity origin is applied). */
export function bspModelCenters(faces:readonly Pick<BspFace,'model'|'points'>[]):Map<number,Vec3>{
  const lo=new Map<number,Vec3>(),hi=new Map<number,Vec3>();
  for(const f of faces){if(f.model<=0||!Array.isArray(f.points))continue;const a=lo.get(f.model)??[Infinity,Infinity,Infinity],b=hi.get(f.model)??[-Infinity,-Infinity,-Infinity];
    for(const p of f.points)for(let i=0;i<3;i++){a[i]=Math.min(a[i],p[i]);b[i]=Math.max(b[i],p[i]);}lo.set(f.model,a);hi.set(f.model,b);}
  const out=new Map<number,Vec3>();for(const [n,a] of lo){const b=hi.get(n)!;out.set(n,[0,1,2].map(i=>(a[i]+b[i])/2) as Vec3);}return out;
}
/** Display position of a brush entity: centre of its model + its origin. */
export function bspBrushEntityCenter(entity:NativeEntity,centers:Map<number,Vec3>):Vec3|undefined{
  const n=modelOf({model:nativeProperty(entity,'model')});const c=centers.get(n);if(!c)return undefined;
  const o=vec(nativeProperty(entity,'origin'));return [c[0]+o[0],c[1]+o[1],c[2]+o[2]];
}
export const bspIsBrushEntity=(entity:NativeEntity|undefined)=>!!entity&&modelOf({model:nativeProperty(entity,'model')})>0;
/** Number of entities that use the same *N as `index` (shared model → lighting and edits are shared). */
export function bspModelUsers(doc:NativeBsp,index:number):number{
  const m=nativeProperty(doc.entities[index],'model');if(!/^\*\d+$/.test(m))return 0;
  return doc.entities.filter(e=>nativeProperty(e,'model')===m).length;
}
export const bspBrushEntityLabel=(entity:NativeEntity)=>`${nativeClassname(entity)} ${nativeProperty(entity,'model')}`;
