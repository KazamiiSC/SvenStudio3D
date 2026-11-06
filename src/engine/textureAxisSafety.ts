/** Validate and safely resolve the texture basis of a Valve 220 face.
 * SC-CSG/SC-RAD reject bases with a near-zero projection onto the face.
 * The repair is non-mutating, and offsets retain the texture phase at a
 * vertex of the original polygon. Only unusable UV bases are changed. */
import type {Vec3} from './types';
import {rebaseTexelShift} from './valve220UV.ts';

const EPS=1e-9;
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const scale=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s];
const length=(a:Vec3)=>Math.hypot(...a);
const unit=(a:Vec3):Vec3=>scale(a,1/Math.max(EPS,length(a)));
const project=(a:Vec3,n:Vec3):Vec3=>sub(a,scale(n,dot(a,n)));
const finite=(a:Vec3)=>a.length===3&&a.every(Number.isFinite);
/** A GoldSrc texture coordinate basis must span two directions on its face.
 * Use a safety margin because Valve 220 rounds axis components to 3 decimals. */
export function textureBasisQuality(normal:Vec3,u:Vec3,v:Vec3):number{
  const nl=length(normal),ul=length(u),vl=length(v);
  if(!finite(normal)||!finite(u)||!finite(v)||nl<EPS||ul<EPS||vl<EPS)return 0;
  return Math.abs(dot(unit(normal),cross(u,v)))/(ul*vl);
}
export type SafeTextureAlignment={u:Vec3;v:Vec3;uShift:number;vShift:number;repaired:boolean;quality:number};
export function safeTextureAlignment(
  normal:Vec3, anchor:Vec3, u:Vec3, v:Vec3,
  uShift=0,vShift=0,uScale=1,vScale=1
):SafeTextureAlignment{
  const quality=textureBasisQuality(normal,u,v);
  const good=quality>=0.20&&length(project(u,unit(normal)))>=0.20*length(u)
    &&length(project(v,unit(normal)))>=0.20*length(v);
  if(good)return {u,v,uShift,vShift,repaired:false,quality};
  if(!finite(normal)||length(normal)<EPS||!finite(anchor))
    throw new Error('Cannot repair UV alignment for a degenerate face.');
  const n=unit(normal);
  // Reference basis follows GoldSrc dominant-plane mapping.
  const [nx,ny,nz]=n.map(Math.abs);
  const baseU:Vec3=nz>=nx&&nz>=ny?[1,0,0]:nx>=ny?[0,1,0]:[1,0,0];
  const baseV:Vec3=nz>=nx&&nz>=ny?[0,-1,0]:[0,0,-1];
  const fallbackU=unit(project(baseU,n));
  const pu=finite(u)?project(u,n):([0,0,0] as Vec3);
  const pv=finite(v)?project(v,n):([0,0,0] as Vec3);
  const lu=length(pu),lv=length(pv);
  const uMagnitude=finite(u)?Math.max(.25,Math.min(16,length(u))):1;
  const vMagnitude=finite(v)?Math.max(.25,Math.min(16,length(v))):1;
  let outU:Vec3;
  if(lu>=.20*uMagnitude)outU=unit(pu);
  else if(lv>=.20*vMagnitude)outU=unit(cross(pv,n));
  else outU=fallbackU;
  const puOrFallback=length(project(baseU,n))>EPS?fallbackU:unit(cross(baseV,n));
  if(!finite(outU)||length(outU)<EPS)outU=puOrFallback;
  let outV:Vec3;
  if(lv>=.20*vMagnitude&&Math.abs(dot(n,cross(outU,unit(pv))))>=.20)
    outV=unit(pv);
  else {
    outV=unit(cross(n,outU));
    // Try to preserve the direction of the original V, otherwise the
    // face's default WAD orientation. Flips remain represented in scales.
    const preferred=lv>.01?pv:project(baseV,n);
    if(dot(outV,preferred)<0)outV=scale(outV,-1);
  }
  // Keep the amount of scaling in the original axes when feasible.
  outU=scale(outU,uMagnitude);outV=scale(outV,vMagnitude);
  const aU=finite(u)?u:([0,0,0] as Vec3),aV=finite(v)?v:([0,0,0] as Vec3);
  const adjustedU=rebaseTexelShift(uShift,anchor,aU,outU,uScale);
  const adjustedV=rebaseTexelShift(vShift,anchor,aV,outV,vScale);
  if(textureBasisQuality(n,outU,outV)<.5)
    throw new Error('Unable to create a valid tangent UV basis for this face.');
  return {u:outU,v:outV,uShift:adjustedU,vShift:adjustedV,repaired:true,quality};
}
