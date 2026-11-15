/** HF11 VIS & Portal Explorer: strictly read-only BSP30 visibility inspection.
 * A PVS is a *potential* visibility set, not an occlusion/cost estimate.
 * Leaf bounds are BSP bounding boxes, not exact portal/leaf polygons.
 */
import type {Vec3} from './types';

export interface BspVisLeaf {
  index:number;
  contents:number;
  visOffset:number;
  min:Vec3;
  max:Vec3;
  markSurfaces:number;
}
export interface BspVisExplorerData {
  leaves:BspVisLeaf[];
  visBytes:Uint8Array;
  planes:{normal:Vec3;distance:number}[];
  nodes:{plane:number;front:number;back:number}[];
  worldHeadNode:number;
  /** Count of vis leaves declared by the compiled world model, for diagnostics. */
  worldVisLeaves:number;
}
export interface BspPvsResult {status:'ok'|'unavailable'|'invalid'|'solid';indices:number[];message:string}
export interface BspPortal {front:number;back:number;points:Vec3[]}
export interface BspPortalFile {leaves:number;portals:BspPortal[]}

const MAX_FILE=256*1024*1024;
const MAX_LEAVES=200000;
function checkedLump(view:DataView,index:number,stride?:number){
  const start=view.getInt32(4+index*8,true),size=view.getInt32(8+index*8,true);
  if(start<0||size<0||start>view.byteLength||size>view.byteLength-start||stride&&size%stride)
    throw new Error(`Invalid BSP30 lump #${index}.`);
  return {start,size};
}
export function readBspVisExplorer(source:ArrayBuffer):BspVisExplorerData {
  if(source.byteLength<124||source.byteLength>MAX_FILE)throw new Error('Invalid BSP30 size.');
  const v=new DataView(source);
  if(v.getInt32(0,true)!==30)throw new Error('Only GoldSrc/Svengine BSP30 is supported.');
  const leafLump=checkedLump(v,10,28),visLump=checkedLump(v,4),planeLump=checkedLump(v,1,20);
  const nodeLump=checkedLump(v,5,24),marksLump=checkedLump(v,11,2),modelLump=checkedLump(v,14,64);
  const leafCount=leafLump.size/28,nodeCount=nodeLump.size/24,planeCount=planeLump.size/20;
  if(leafCount>MAX_LEAVES||nodeCount>200000||planeCount>200000)throw new Error('BSP visibility limits exceeded.');
  const leaves:BspVisLeaf[]=[];
  for(let i=0;i<leafCount;i++){
    const p=leafLump.start+i*28,first=v.getUint16(p+20,true),n=v.getUint16(p+22,true);
    if(first+n>marksLump.size/2)throw new Error(`Invalid marksurface range on leaf #${i}.`);
    const min:Vec3=[v.getInt16(p+8,true),v.getInt16(p+10,true),v.getInt16(p+12,true)];
    const max:Vec3=[v.getInt16(p+14,true),v.getInt16(p+16,true),v.getInt16(p+18,true)];
    leaves.push({index:i,contents:v.getInt32(p,true),visOffset:v.getInt32(p+4,true),min,max,markSurfaces:n});
  }
  const planes=Array.from({length:planeCount},(_,i)=>{
    const p=planeLump.start+i*20;
    return {normal:[v.getFloat32(p,true),v.getFloat32(p+4,true),v.getFloat32(p+8,true)] as Vec3,distance:v.getFloat32(p+12,true)};
  });
  const nodes=Array.from({length:nodeCount},(_,i)=>{
    const p=nodeLump.start+i*24;
    return {plane:v.getInt32(p,true),front:v.getInt16(p+4,true),back:v.getInt16(p+6,true)};
  });
  const worldHeadNode=modelLump.size? v.getInt32(modelLump.start+36,true):-1;
  const worldVisLeaves=modelLump.size? v.getInt32(modelLump.start+52,true):0;
  return {leaves,planes,nodes,worldHeadNode,worldVisLeaves,
    visBytes:new Uint8Array(source,visLump.start,visLump.size)};
}
/** GoldSrc BSP30 leaf 0 is reserved CONTENTS_SOLID. PVS bit 0 is leaf #1. */
export function decodeBspPvs(data:BspVisExplorerData,index:number):BspPvsResult {
  const leaf=data.leaves[index];
  if(!leaf||index===0||leaf.contents===-2)return {status:'solid',indices:[],message:'Not a non-solid visibility leaf.'};
  if(data.worldVisLeaves<1||data.worldVisLeaves>=data.leaves.length||index>data.worldVisLeaves)return {status:'unavailable',indices:[],message:'This leaf is outside the world model PVS range.'};
  if(!data.visBytes.length||leaf.visOffset===-1)return {status:'unavailable',indices:[],message:'VIS data was not compiled or is unavailable for this leaf.'};
  const size=Math.ceil(data.worldVisLeaves/8),out=new Uint8Array(size);
  let inPos=leaf.visOffset,outPos=0;
  if(inPos<0||inPos>=data.visBytes.length)return {status:'invalid',indices:[],message:'VIS offset is outside the visibility lump.'};
  while(outPos<size){
    if(inPos>=data.visBytes.length)return {status:'invalid',indices:[],message:'Truncated VIS bitstream.'};
    const byte=data.visBytes[inPos++];
    if(byte!==0){out[outPos++]=byte;continue}
    if(inPos>=data.visBytes.length)return {status:'invalid',indices:[],message:'Truncated VIS zero run.'};
    const run=data.visBytes[inPos++];
    if(run===0||run>size-outPos)return {status:'invalid',indices:[],message:'Invalid VIS zero run length.'};
    outPos+=run;
  }
  const indices:number[]=[];
  for(let i=1;i<=data.worldVisLeaves;i++){
    if((out[(i-1)>>3]&(1<<((i-1)&7)))&&data.leaves[i].contents!==-2)indices.push(i);
  }
  return {status:'ok',indices,message:''};
}
/** Traverse world hull-0 BSP nodes to find the leaf containing a position. */
export function bspLeafAtPoint(data:BspVisExplorerData,point:Vec3):number|null {
  if(point.some(p=>!Number.isFinite(p)))return null;
  let node=data.worldHeadNode;
  const visited=new Set<number>();
  while(node>=0){
    if(node>=data.nodes.length||visited.has(node))return null;
    visited.add(node);
    const entry=data.nodes[node],plane=data.planes[entry.plane];
    if(!plane||!plane.normal.every(Number.isFinite)||!Number.isFinite(plane.distance))return null;
    const side=point[0]*plane.normal[0]+point[1]*plane.normal[1]+point[2]*plane.normal[2]-plane.distance;
    node=side>=0?entry.front:entry.back;
  }
  const leaf=-node-1;
  return leaf<data.leaves.length?leaf:null;
}
/** Optional PRT1 input: exact portal polygons are NOT stored in BSP30 itself.
 * Portal leaf numbers are NOT presumed equal to BSP leaf indices.
 */
export function readGoldSrcPrt(text:string):BspPortalFile {
  if(text.length>8_000_000)throw new Error('PRT file exceeds the 8 MB limit.');
  const lines=text.replace(/\r/g,'').split('\n').map(s=>s.trim()).filter(Boolean);
  if(lines[0]!=='PRT1')throw new Error('Only PRT1 portal files are supported.');
  const leafCount=Number(lines[1]),portalCount=Number(lines[2]);
  if(!Number.isSafeInteger(leafCount)||leafCount<1||leafCount>MAX_LEAVES||!Number.isSafeInteger(portalCount)||portalCount<0||portalCount>20000)
    throw new Error('Invalid PRT1 leaf/portal count.');
  if(lines.length!==portalCount+3)throw new Error('PRT1 portal count does not match file lines.');
  const portals:BspPortal[]=[];
  const pattern=/\(\s*([^()\s]+)\s+([^()\s]+)\s+([^()\s]+)\s*\)/g;
  for(let i=0;i<portalCount;i++){
    const line=lines[i+3];
    const header=/^(\d+)\s+(\d+)\s+(\d+)\s+/.exec(line);
    if(!header)throw new Error(`Malformed PRT1 portal #${i}.`);
    const n=Number(header[1]),front=Number(header[2]),back=Number(header[3]);
    if(n<3||n>64||front>=leafCount||back>=leafCount||front===back)throw new Error(`Invalid PRT1 portal #${i}.`);
    const body=line.slice(header[0].length),points:Vec3[]=[];
    for(const match of body.matchAll(pattern)){
      const coords=match.slice(1).map(Number);
      if(!coords.every(value=>Number.isFinite(value)&&Math.abs(value)<=1000000))throw new Error(`Invalid portal coordinate #${i}.`);
      points.push(coords as Vec3);
    }
    if(points.length!==n||body.replace(pattern,'').trim())throw new Error(`Invalid PRT1 vertex count at portal #${i}.`);
    portals.push({front,back,points});
  }
  return {leaves:leafCount,portals};
}
