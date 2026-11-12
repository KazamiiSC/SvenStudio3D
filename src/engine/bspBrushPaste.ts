/** Placement of instanced *N BSP brush-model entities.
 * NOT a free worldspawn brush-geometry copier. Model geometry, hulls and VIS
 * remain unchanged; the same compiled bmodel is referenced by a new entity. */
import type {BspMap} from './bsp.ts';
import type {NativeBsp} from './bspNativeEdit.ts';
import {appendNativeBrushInstance,nativeProperty} from './bspNativeEdit.ts';
export type BspBrushAnchor='center'|'bottom';
export type BspVec3=[number,number,number];
const MAX_MODELS=32;
const modelOf=(doc:NativeBsp,index:number)=>{
 const value=nativeProperty(doc.entities[index],'model');
 const match=/^\*([1-9]\d*)$/.exec(value);
 return match?Number(match[1]):-1;
};
export function bspBrushCopyEligibility(map:BspMap,doc:NativeBsp,indices:readonly number[]):{ok:boolean;reason:string}{
 if(!indices.length)return {ok:false,reason:'Select at least one compiled brush entity.'};
 if(indices.length>MAX_MODELS)return {ok:false,reason:'Copy at most 32 brush-model entities at once.'};
 for(const index of indices){
   const source=doc.entities[index];
   if(!source||index<1)return {ok:false,reason:'Cannot copy worldspawn or a missing entity.'};
   const cls=nativeProperty(source,'classname');
   if(!['func_wall','func_illusionary'].includes(cls))return {ok:false,reason:`${cls}: only func_wall and func_illusionary can be pasted in this safe mode.`};
   const model=modelOf(doc,index);
   if(model<1||model>=map.stats.models||!map.faces.some(face=>face.model===model))
     return {ok:false,reason:'Selected entity has no valid compiled BSP submodel geometry.'};
   const origin=nativeProperty(source,'origin');
   if(origin){const coords=origin.trim().split(/\s+/).map(Number);
     if(coords.length!==3||coords.some(n=>!Number.isFinite(n)))return {ok:false,reason:'Brush source has an invalid origin.'};}
 }
 return {ok:true,reason:''};
}
export function bspBrushPasteBounds(map:BspMap,doc:NativeBsp,indices:readonly number[]):{min:BspVec3;max:BspVec3}{
 const valid=bspBrushCopyEligibility(map,doc,indices);if(!valid.ok)throw Error(valid.reason);
 const models=new Set(indices.map(index=>modelOf(doc,index)));
 const points=map.faces.filter(f=>models.has(f.model)).flatMap(f=>f.points);
 if(!points.length)throw Error('No renderable brush-model geometry.');
 const min:BspVec3=[Infinity,Infinity,Infinity],max:BspVec3=[-Infinity,-Infinity,-Infinity];
 for(const p of points)for(let a=0;a<3;a++){min[a]=Math.min(min[a],p[a]);max[a]=Math.max(max[a],p[a])}
 return {min,max};
}
export function bspBrushPasteDelta(map:BspMap,doc:NativeBsp,indices:readonly number[],destination:BspVec3,anchor:BspBrushAnchor='center'):BspVec3{
 const {min,max}=bspBrushPasteBounds(map,doc,indices);
 if(!destination.every(n=>Number.isFinite(n)&&Math.abs(n)<=131072))throw Error('Invalid BSP paste target.');
 const source:BspVec3=[(min[0]+max[0])/2,(min[1]+max[1])/2,anchor==='bottom'?min[2]:(min[2]+max[2])/2];
 return destination.map((v,i)=>v-source[i]) as BspVec3;
}
export function bspPasteBrushModelInstances(map:BspMap,doc:NativeBsp,indices:readonly number[],destination:BspVec3,anchor:BspBrushAnchor='center'):NativeBsp{
 const delta=bspBrushPasteDelta(map,doc,indices,destination,anchor);
 let next=doc;
 for(const index of indices){
   const originValue=nativeProperty(doc.entities[index],'origin');
   const source=originValue?originValue.trim().split(/\s+/).map(Number):[0,0,0];
   const pos=source.map((v,i)=>Number((v+delta[i]).toFixed(3)));
   if(pos.some(v=>!Number.isFinite(v)||Math.abs(v)>131072))throw Error('Paste moves a brush model beyond ±131072 units.');
   next=appendNativeBrushInstance(next,index,pos.join(' '));
 }
 return next;
}
