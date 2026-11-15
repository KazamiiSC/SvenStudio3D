/** HF17: bounded viewport-preview selection. This file never changes map objects,
 * visibility lumps, face geometry, texture coordinates, or compile settings.
 * It selects exactly the same nearest preview IDs as a stable full sort, with
 * O(N log K) work / O(K) memory instead of O(N log N) / O(N).
 */

import type {Brush,MapObject,PointEntity} from './types';

/** Group contiguous MAP objects without reordering opaque/transparent drawables.
 * This keeps the original Three.js scene traversal and pointer-hit order while
 * memoizing unchanged brush runs across camera-only preview updates. */
export type RenderSegment={kind:'brush';objects:Brush[]}|{kind:'entity';objects:PointEntity[]};
export function groupMapRenderSegments(objects:readonly MapObject[]):RenderSegment[]{
  const segments:RenderSegment[]=[];
  for(const object of objects){
    const last=segments[segments.length-1];
    if(object.kind==='brush'){
      if(last?.kind==='brush')last.objects.push(object);
      else segments.push({kind:'brush',objects:[object]});
    }else{
      if(last?.kind==='entity')last.objects.push(object);
      else segments.push({kind:'entity',objects:[object]});
    }
  }
  return segments;
}

/** Reuse immutable segment arrays when unrelated map objects change. This is
 * especially valuable while editing an entity in a map with thousands of
 * brushes: React.memo can skip every unchanged brush run. */
export function reuseMapRenderSegments(previous:readonly RenderSegment[],next:RenderSegment[]):RenderSegment[]{
  return next.map((segment,index)=>{
    const old=previous[index];
    if(!old||old.kind!==segment.kind||old.objects.length!==segment.objects.length)return segment;
    for(let j=0;j<segment.objects.length;j++)if(old.objects[j]!==segment.objects[j])return segment;
    return old;
  });
}

export type PreviewPoint={x:number;y:number;z:number};
export type PreviewCandidate={entity:{id:string;classname:string;props:{model?:string}};point:PreviewPoint};
export type PreviewPreset='quality'|'balanced'|'large';
export type PreviewSets={labels:Set<string>;lights:Set<string>;models:Set<string>};
type Ranked={id:string;distance:number;order:number};

function worse(a:Ranked,b:Ranked):boolean{
  return a.distance>b.distance||(a.distance===b.distance&&a.order>b.order);
}
/** The heap root is the farthest item, with later source order losing ties. */
function insertNearest(heap:Ranked[],value:Ranked,capacity:number):void{
  if(capacity<=0)return;
  if(heap.length<capacity){
    let i=heap.length;heap.push(value);
    while(i>0){const parent=(i-1)>>1;if(!worse(value,heap[parent]))break;
      heap[i]=heap[parent];i=parent;}
    heap[i]=value;return;
  }
  if(!worse(heap[0],value))return;
  const size=heap.length;let i=0;
  while(true){
    let child=i*2+1;if(child>=size)break;
    if(child+1<size&&worse(heap[child+1],heap[child]))child++;
    if(!worse(heap[child],value))break;
    heap[i]=heap[child];i=child;
  }
  heap[i]=value;
}
function sortedIds(heap:Ranked[]):Set<string>{
  heap.sort((a,b)=>a.distance-b.distance||a.order-b.order);
  return new Set(heap.map(item=>item.id));
}
export function previewBudget(preset:PreviewPreset):readonly [number,number,number]{
  return preset==='quality'?[240,26,45]:preset==='large'?[32,4,3]:[95,10,14];
}
export function selectMapPreviewBudget(
  candidates:readonly PreviewCandidate[],camera:PreviewPoint,preset:PreviewPreset,optimizedLabels:boolean
):PreviewSets{
  const [labelLimit,lightLimit,modelLimit]=previewBudget(preset);
  const labels:Ranked[]=[],lights:Ranked[]=[],models:Ranked[]=[];
  for(let i=0;i<candidates.length;i++){
    const {entity,point}=candidates[i];
    const dx=point.x-camera.x,dy=point.y-camera.y,dz=point.z-camera.z;
    const distance=dx*dx+dy*dy+dz*dz;
    // Non-finite positions have no meaningful distance. Original Three.js
    // distance sorting would keep those entries in input order; preserve this
    // conservative behavior by treating them as infinitely far away.
    const ranked={id:entity.id,distance:Number.isFinite(distance)?distance:Infinity,order:i};
    if(!optimizedLabels)insertNearest(labels,ranked,labelLimit);
    if(entity.classname.startsWith('light'))insertNearest(lights,ranked,lightLimit);
    if(entity.props.model?.startsWith('models/')||entity.classname.startsWith('monster_'))insertNearest(models,ranked,modelLimit);
  }
  return {labels:sortedIds(labels),lights:sortedIds(lights),models:sortedIds(models)};
}
export function samePreviewIds(a:ReadonlySet<string>,b:ReadonlySet<string>):boolean{
  if(a.size!==b.size)return false;
  for(const id of a)if(!b.has(id))return false;
  return true;
}
export function samePreviewSets(a:PreviewSets,b:PreviewSets):boolean{
  return samePreviewIds(a.labels,b.labels)&&samePreviewIds(a.lights,b.lights)&&samePreviewIds(a.models,b.models);
}
/** Zustand selectors run for every subscribed object on each store mutation.
 * Selection arrays are immutable in the editor, so cache the membership set
 * by array identity: selecting 500 brushes no longer performs 500 .includes()
 * comparisons for every one of thousands of visual subscriptions.
 */
const membershipCache=new WeakMap<readonly string[],ReadonlySet<string>>();
export function isObjectSelected(ids:readonly string[],id:string):boolean{
  if(ids.length<=2)return ids.includes(id);
  let lookup=membershipCache.get(ids);
  if(!lookup){lookup=new Set(ids);membershipCache.set(ids,lookup);}
  return lookup.has(id);
}
