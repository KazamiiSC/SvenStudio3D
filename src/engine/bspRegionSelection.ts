/** BSP Editor HF8 — safe grouped surface selection.
 * A GoldSrc BSP30 does not store the author's original worldspawn brush IDs.
 * A worldspawn 'region' is therefore only a connected island of visible BSP
 * faces using the SAME compiled texture, never an asserted original brush.
 * For compiled *N submodels, the model's face range is authoritative.
 * This module selects existing face IDs; it does not write geometry/lumps.
 */
import type {BspMap,BspFace} from './bsp.ts';
import {bspOriginalFaceIndex} from './bspFaceSelection.ts';

export type BspRegionKind='submodel'|'material-island';
export type BspRegionResult={indices:number[];kind:BspRegionKind;reason:string};
export const BSP_REGION_SELECTION_LIMIT=256;

type FaceIndex={byId:Map<number,BspFace>;neighbors:Map<number,Set<number>>;models:Map<number,number[]>};
const cache=new WeakMap<object,FaceIndex>();
// Quantization is for indexing surface endpoints only, not for modifying BSP coordinates.
const quantize=(v:number)=>Math.round(v*16);
const pointKey=(p:readonly number[])=>p.map(quantize).join(',');
const edgeKey=(a:readonly number[],b:readonly number[])=>{
  const x=pointKey(a),y=pointKey(b);return x<y?`${x}|${y}`:`${y}|${x}`;
};
// BSP compiler T-junctions may split one polygon edge into several edges.
// Group collinear edges by approximate supporting line and compare intervals,
// so a shared partial edge is still recognized without flood-selecting at corners.
function lineSpan(a:readonly number[],b:readonly number[]):{key:string;start:number;end:number}|null{
  const length=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
  if(!Number.isFinite(length)||length<.001)return null;
  const d=[(b[0]-a[0])/length,(b[1]-a[1])/length,(b[2]-a[2])/length];
  const first=d.find(n=>Math.abs(n)>1e-6);
  if(first!==undefined&&first<0)for(let i=0;i<3;i++)d[i]=-d[i];
  // Point-to-line perpendicular offset, invariant as a moves along the line.
  const offset=[a[1]*d[2]-a[2]*d[1],a[2]*d[0]-a[0]*d[2],a[0]*d[1]-a[1]*d[0]];
  const key=[...d.map(n=>Math.round(n*1024)),...offset.map(n=>Math.round(n*4))].join(',');
  const x=a[0]*d[0]+a[1]*d[1]+a[2]*d[2],y=b[0]*d[0]+b[1]*d[1]+b[2]*d[2];
  return {key,start:Math.min(x,y),end:Math.max(x,y)};
}
function indexFaces(map:Pick<BspMap,'faces'>):FaceIndex{
  const cached=cache.get(map);if(cached)return cached;
  const byId=new Map<number,BspFace>(),neighbors=new Map<number,Set<number>>(),models=new Map<number,number[]>();
  const edges=new Map<string,number[]>();
  const lines=new Map<string,Array<{id:number;start:number;end:number}>>();
  for(const [parsedId,face] of map.faces.entries()){
    const id=bspOriginalFaceIndex(face,parsedId);
    byId.set(id,face);neighbors.set(id,new Set());
    const group=models.get(face.model)||[];group.push(id);models.set(face.model,group);
    if(face.points.length<3)continue;
    for(let i=0;i<face.points.length;i++){
      const a=face.points[i],b=face.points[(i+1)%face.points.length];
      if(a.some(n=>!Number.isFinite(n))||b.some(n=>!Number.isFinite(n)))continue;
      const key=edgeKey(a,b),existing=edges.get(key)||[];
      // Indexed once per face; huge malformed overlaps are ignored safely.
      if(existing.length<128)existing.push(id);
      edges.set(key,existing);
      const span=lineSpan(a,b);if(span){const list=lines.get(span.key)||[];list.push({id,start:span.start,end:span.end});lines.set(span.key,list)}
    }
  }
  for(const ids of edges.values()){
    if(ids.length<2||ids.length>=128)continue;
    for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++){
      const left=byId.get(ids[a]),right=byId.get(ids[b]);
      if(!left||!right||left.model!==right.model||left.texture!==right.texture)continue;
      neighbors.get(ids[a])?.add(ids[b]);neighbors.get(ids[b])?.add(ids[a]);
    }
  }
  // The additional T-junction pass only links same-material faces whose
  // actual edge segments overlap, never faces touching at just one corner.
  for(const spans of lines.values()){
    if(spans.length<2||spans.length>128)continue;
    spans.sort((a,b)=>a.start-b.start);
    for(let a=0;a<spans.length;a++)for(let b=a+1;b<spans.length;b++){
      if(spans[b].start>=spans[a].end-.125)break;
      const left=byId.get(spans[a].id),right=byId.get(spans[b].id);
      if(!left||!right||left.model!==right.model||left.texture!==right.texture||spans[a].id===spans[b].id)continue;
      neighbors.get(spans[a].id)?.add(spans[b].id);neighbors.get(spans[b].id)?.add(spans[a].id);
    }
  }
  const result={byId,neighbors,models};cache.set(map,result);return result;
}
/** Select a COMPLETE recoverable group or refuse; never silently return a truncated group. */
export function bspSelectSurfaceRegion(map:Pick<BspMap,'faces'>,seedId:number,maxFaces=BSP_REGION_SELECTION_LIMIT):BspRegionResult{
  if(!Number.isSafeInteger(seedId)||seedId<0)return {indices:[],kind:'material-island',reason:'Invalid BSP face ID.'};
  const index=indexFaces(map),face=index.byId.get(seedId);
  if(!face)return {indices:[],kind:'material-island',reason:'The BSP face was not found.'};
  if(face.model>0){
    const faces=index.models.get(face.model)||[];
    if(faces.length>maxFaces)return {indices:[],kind:'submodel',reason:`Compiled *${face.model} has ${faces.length} visible faces (limit ${maxFaces}). No partial group selected.`};
    return {indices:[...faces].sort((a,b)=>a-b),kind:'submodel',reason:''};
  }
  // A source brush cannot be recovered exactly from BSP30. This selects only
  // the connected same-material render region and is intentionally read-only
  // with respect to geometry and collision.
  const seen=new Set<number>([seedId]),queue=[seedId];
  for(let head=0;head<queue.length;head++){
    for(const other of index.neighbors.get(queue[head])||[]){
      if(seen.has(other))continue;
      seen.add(other);queue.push(other);
      if(queue.length>maxFaces)return {indices:[],kind:'material-island',reason:`This material island contains more than ${maxFaces} faces. No partial region selected.`};
    }
  }
  return {indices:queue.sort((a,b)=>a-b),kind:'material-island',reason:''};
}
/** A Ctrl+click toggles the whole region, keeping a bounded, deterministic selection. */
export function bspToggleRegionSelection(selected:readonly number[],region:readonly number[],extend:boolean,maxFaces=BSP_REGION_SELECTION_LIMIT):number[]|null{
  if(!region.length||region.length>maxFaces)return null;
  if(!extend)return [...region];
  const set=new Set(selected),whole=region.every(id=>set.has(id));
  for(const id of region)whole?set.delete(id):set.add(id);
  return set.size>maxFaces?null:[...set];
}
