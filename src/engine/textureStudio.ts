/** Texture Studio 1.4 — pure, GoldSrc/Valve 220-compatible UV operations.
 * No geometry or entity data is ever modified by these helpers. */
import type {Brush,Face,Vec3} from './types';
import {translateTexelShift,texelAt} from './valve220UV.ts';
export type TextureFaceRef={id:string;face:number};
export type TextureFacePatch=Partial<Pick<Face,'texture'|'uShift'|'vShift'|'uScale'|'vScale'|'rotation'|'uAxis'|'vAxis'>>;
export type TexturePreset={id:string;name:string;settings:TextureFacePatch};
export type UvHandle='move'|'rotate'|'n'|'ne'|'e'|'se'|'s'|'sw'|'w'|'nw';
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const norm=(a:Vec3):Vec3=>{const l=Math.hypot(...a);return l>1e-12?[a[0]/l,a[1]/l,a[2]/l]:[0,0,1]};
const asVec=(v:Vec3):Vec3=>[...v];
export function isTextureFaceRef(value:TextureFaceRef,objects:readonly {id:string;kind:string;faces?:readonly Face[];locked?:boolean;hidden?:boolean}[]):boolean{
  const object=objects.find(o=>o.id===value.id);
  return !!object&&object.kind==='brush'&&!object.locked&&!object.hidden&&Number.isInteger(value.face)&&value.face>=0&&value.face<(object.faces?.length||0);
}
export function normalizeScale(value:number):number{
  if(!Number.isFinite(value)||Math.abs(value)<0.005)throw Error('Texture scale must be finite and nonzero (>= 0.005).');
  return Math.sign(value)*Math.min(4096,Math.max(.005,Math.abs(value)));
}
export function sanitizeTexturePatch(patch:TextureFacePatch):TextureFacePatch{
  const next:TextureFacePatch={};
  for(const key of ['uShift','vShift','rotation'] as const)if(patch[key]!==undefined){if(!Number.isFinite(patch[key]))throw Error(`${key}: invalid value`);next[key]=Math.max(-131072,Math.min(131072,patch[key]));}
  for(const key of ['uScale','vScale'] as const)if(patch[key]!==undefined)next[key]=normalizeScale(patch[key]);
  if(patch.texture!==undefined){if(!/^[^\s"{}\[\]]{1,64}$/.test(patch.texture))throw Error('Invalid texture name');next.texture=patch.texture.toUpperCase();}
  for(const key of ['uAxis','vAxis'] as const)if(Object.prototype.hasOwnProperty.call(patch,key)){if(patch[key]===undefined){next[key]=undefined;continue;}if(patch[key]?.length!==3||patch[key]?.some(v=>!Number.isFinite(v)))throw Error(`Invalid ${key}`);next[key]=asVec(patch[key]!);}
  return next;
}
/** Same Euler XYZ rotation convention as THREE.Vector3.applyEuler. */
export function brushWorldVertices(brush:Brush):Vec3[]{
  const [ax,ay,az]=brush.rotation.map(v=>v*Math.PI/180);const cx=Math.cos(ax),sx=Math.sin(ax),cy=Math.cos(ay),sy=Math.sin(ay),cz=Math.cos(az),sz=Math.sin(az);
  return brush.vertices.map(v=>{
    const x=v[0]*brush.scale[0],y=v[1]*brush.scale[1],z=v[2]*brush.scale[2];
    return [brush.position[0]+cy*cz*x-cy*sz*y+sy*z,
      brush.position[1]+(cx*sz+sx*sy*cz)*x+(cx*cz-sx*sy*sz)*y-sx*cy*z,
      brush.position[2]+(sx*sz-cx*sy*cz)*x+(sx*cz+cx*sy*sz)*y+cx*cy*z];
  });
}
/** Mirrors textureAxes in geometry.ts, including explicitly imported Valve 220 UV axes. */
export function faceTextureAxes(points:readonly Vec3[],face:Face):{u:Vec3;v:Vec3;n:Vec3}{
  const [p,q,r]=face.indices.slice(0,3).map(i=>points[i]);
  if(!p||!q||!r)throw Error('Invalid face vertices');
  const n=norm(cross(sub(q,p),sub(r,p)));
  const [nx,ny,nz]=n.map(Math.abs);
  let u:Vec3,v:Vec3;
  if(nz>=nx&&nz>=ny){u=[1,0,0];v=[0,-1,0]}
  else if(nx>=ny){u=[0,1,0];v=[0,0,-1]}
  else {u=[1,0,0];v=[0,0,-1]}
  if(face.uAxis)u=asVec(face.uAxis);
  if(face.vAxis)v=asVec(face.vAxis);
  const angle=(face.rotation||0)*Math.PI/180;
  if(angle){const c=Math.cos(angle),s=Math.sin(angle),a=u,b=v;u=a.map((x,i)=>x*c-b[i]*s) as Vec3;v=a.map((x,i)=>x*s+b[i]*c) as Vec3;}
  return {u,v,n};
}
/** Texture lock for pure translation in GoldSrc world space.
 * A face samples U=(dot(worldPosition,uAxis)/uScale+uShift)/textureWidth.
 * Compensating the shift by -dot(delta,axis)/scale keeps every sampled pixel in
 * place on the *moving brush*, including custom Valve 220 axes/rotation and
 * mirrored, nonuniform texture scales. Do not change rotation, scales or axes.
 * Geometry and source brushes are not mutated. */
export function lockTranslatedBrushTextures(brush:Brush,position:Vec3):Face[]{
  const displacement=position.map((value,axis)=>value-brush.position[axis]) as Vec3;
  if(displacement.every(value=>value===0))return brush.faces;
  if(displacement.some(value=>!Number.isFinite(value)))throw Error('Invalid brush translation.');
  const world=brushWorldVertices(brush);
  return brush.faces.map(face=>{
    if(face.indices.length<3)return face;
    const {u,v}=faceTextureAxes(world,face);
    return {...face,
      uShift:translateTexelShift(face.uShift??0,displacement,u,face.uScale||1),
      vShift:translateTexelShift(face.vShift??0,displacement,v,face.vScale||1)};
  });
}

export function faceUvBounds(brush:Brush,faceIndex:number){
  const points=brushWorldVertices(brush);const face=brush.faces[faceIndex];if(!face)throw Error('Face not found');
  const {u,v}=faceTextureAxes(points,face);const us=face.indices.map(i=>dot(points[i],u)),vs=face.indices.map(i=>dot(points[i],v));
  return {minU:Math.min(...us),maxU:Math.max(...us),minV:Math.min(...vs),maxV:Math.max(...vs)};
}
export function fitFace(brush:Brush,faceIndex:number,width:number,height:number,repeatU=1,repeatV=1):TextureFacePatch{
  if(![width,height,repeatU,repeatV].every(v=>Number.isFinite(v)&&v>0))throw Error('Invalid dimensions or repeat count');
  const b=faceUvBounds(brush,faceIndex);
  return sanitizeTexturePatch({uScale:Math.max(.005,(b.maxU-b.minU)/(width*repeatU)),vScale:Math.max(.005,(b.maxV-b.minV)/(height*repeatV)),uShift:-b.minU/Math.max(.005,(b.maxU-b.minU)/(width*repeatU)),vShift:-b.minV/Math.max(.005,(b.maxV-b.minV)/(height*repeatV))});
}
/** World-based alignment works across coplanar faces; around corners, reproject the axes
 * onto the destination plane and phase-match at the nearest vertex pair. */
export function centerFace(brush:Brush,faceIndex:number,width:number,height:number):TextureFacePatch{
  const b=faceUvBounds(brush,faceIndex),f=brush.faces[faceIndex];
  return sanitizeTexturePatch({uShift:width/2-(b.minU+b.maxU)/(2*(f.uScale||1)),vShift:height/2-(b.minV+b.maxV)/(2*(f.vScale||1))});
}
export function flipFace(brush:Brush,faceIndex:number,axis:'u'|'v'):TextureFacePatch{
  const b=faceUvBounds(brush,faceIndex),f=brush.faces[faceIndex];
  return axis==='u'?sanitizeTexturePatch({uScale:-(f.uScale||1),uShift:(b.minU+b.maxU)/(f.uScale||1)+(f.uShift||0)}):sanitizeTexturePatch({vScale:-(f.vScale||1),vShift:(b.minV+b.maxV)/(f.vScale||1)+(f.vShift||0)});
}
export function alignFaceToReference(source:Brush,sourceIndex:number,destination:Brush,destinationIndex:number):TextureFacePatch{
  const a=source.faces[sourceIndex],b=destination.faces[destinationIndex];if(!a||!b)throw Error('Face missing');
  const aPoints=brushWorldVertices(source),bPoints=brushWorldVertices(destination);
  const axesA=faceTextureAxes(aPoints,a),axesB=faceTextureAxes(bPoints,b);
  const project=(axis:Vec3,n:Vec3)=>sub(axis,n.map(v=>v*dot(axis,n)) as Vec3);
  const tangent=(axis:Vec3,fallback:Vec3):Vec3=>{const projected=project(axis,axesB.n);const length=Math.hypot(...projected);return length>0.1?projected.map(v=>v/length) as Vec3:fallback;};
  const u=tangent(axesA.u,axesB.u),v=tangent(axesA.v,axesB.v);
  let closest:[Vec3,Vec3]|null=null,dist=Infinity;
  for(const ia of a.indices)for(const ib of b.indices){const p=aPoints[ia],q=bPoints[ib];const d=dot(sub(p,q),sub(p,q));if(d<dist){dist=d;closest=[p,q];}}
  if(!closest)throw Error('No vertices');
  const anchor:Vec3=closest[0].map((v,i)=>(v+closest![1][i])/2) as Vec3;
  const sU=a.uScale??1,sV=a.vScale??1;
  const uShift=texelAt(anchor,axesA.u,sU,a.uShift||0)-dot(anchor,u)/sU;
  const vShift=texelAt(anchor,axesA.v,sV,a.vShift||0)-dot(anchor,v)/sV;
  return sanitizeTexturePatch({texture:a.texture,uAxis:u,vAxis:v,rotation:0,uScale:sU,vScale:sV,uShift,vShift});
}
export function gesturePatch(face:Face,handle:UvHandle,dx:number,dy:number,keepRatio=false):TextureFacePatch{
  if(!Number.isFinite(dx)||!Number.isFinite(dy))return {};
  if(handle==='move')return sanitizeTexturePatch({uShift:(face.uShift||0)+dx*.8,vShift:(face.vShift||0)-dy*.8});
  if(handle==='rotate')return sanitizeTexturePatch({rotation:(face.rotation||0)+dx*.55});
  const flipU=handle.includes('w')?-1:1,flipV=handle.includes('n')?-1:1;
  const changeU=handle.includes('e')||handle.includes('w');const changeV=handle.includes('n')||handle.includes('s');
  const fx=Math.exp(Math.max(-5,Math.min(5,dx*flipU/180))),fy=Math.exp(Math.max(-5,Math.min(5,dy*flipV/180)));
  const factor=keepRatio?Math.exp(Math.max(-5,Math.min(5,((dx*flipU)+(dy*flipV))/360))):1;
  return sanitizeTexturePatch({...(changeU||keepRatio?{uScale:(face.uScale??1)*(keepRatio?factor:fx)}:{}),...(changeV||keepRatio?{vScale:(face.vScale??1)*(keepRatio?factor:fy)}:{})});
}
const STORAGE='svenstudio:texture-presets:v1';
export function readTexturePresets():TexturePreset[]{
  try{const raw=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(!Array.isArray(raw))return [];return raw.slice(0,100).filter(x=>x&&typeof x.id==='string'&&typeof x.name==='string'&&x.settings&&typeof x.settings==='object').map(x=>({id:x.id,name:x.name.slice(0,60),settings:sanitizeTexturePatch({...x.settings,uAxis:x.settings.uAxis,vAxis:x.settings.vAxis})}));}catch{return []}
}
export function writeTexturePresets(presets:TexturePreset[]):void{
  try{localStorage.setItem(STORAGE,JSON.stringify(presets.slice(0,100)))}catch{/* session-only fallback */}
}
export function faceTexturePatch(face:Face):TextureFacePatch{
  return {texture:face.texture,uShift:face.uShift??0,vShift:face.vShift??0,uScale:face.uScale??1,vScale:face.vScale??1,rotation:face.rotation??0,uAxis:face.uAxis?asVec(face.uAxis):undefined,vAxis:face.vAxis?asVec(face.vAxis):undefined};
}
