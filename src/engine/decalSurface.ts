import type {Brush,Vec3} from './types';
import * as THREE from 'three';
/** Project an editor decal onto the same brush face it was placed on.
 * Native infodecal only stores a 3D origin and texture, never angles/UV data.
 * This helper is used by direct manipulation, gizmos and Property fields.
 * Supports tilted, rotated and non-axis-aligned convex brush faces. */
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul=(a:Vec3,k:number):Vec3=>[a[0]*k,a[1]*k,a[2]*k];
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=(a:Vec3)=>Math.sqrt(dot(a,a));
const nearSegment=(v:Vec3,a:Vec3,b:Vec3):Vec3=>{const d=sub(b,a),l=dot(d,d),t=l?Math.max(0,Math.min(1,dot(sub(v,a),d)/l)):0;return add(a,mul(d,t));};
export function constrainDecalToBrush(brush:Brush,normal:Vec3,oldPosition:Vec3,newPosition:Vec3):Vec3|null{
  if(![...normal,...oldPosition,...newPosition].every(Number.isFinite))return null;
  const nLen=length(normal);if(nLen<.5)return null;
  const n=mul(normal,1/nLen);
  const euler=new THREE.Euler(...brush.rotation.map(value=>THREE.MathUtils.degToRad(value)) as Vec3,'XYZ');
  const vertices=brush.vertices.map(v=>{
    const point=new THREE.Vector3(v[0]*brush.scale[0],v[1]*brush.scale[1],v[2]*brush.scale[2]).applyEuler(euler);
    return [point.x+brush.position[0],point.y+brush.position[1],point.z+brush.position[2]] as Vec3;
  });
  let face:Vec3[]|null=null,best=Infinity;
  for(const f of brush.faces){
    const pts=f.indices.map(i=>vertices[i]).filter((p):p is Vec3=>Array.isArray(p)&&p.length===3);
    if(pts.length<3)continue;
    const faceNormal=cross(sub(pts[1],pts[0]),sub(pts[2],pts[0]));
    const size=length(faceNormal);if(size<1e-7||Math.abs(dot(faceNormal,n)/size)<.97)continue;
    // Which parallel face owns the decal? An origin at placement is 0.8u away.
    const distance=Math.abs(dot(sub(oldPosition,pts[0]),n));
    if(distance<best){best=distance;face=pts;}
  }
  // Avoid moving a decal to an unrelated parallel face when its brush changed.
  if(!face||best>6)return null;
  const planePoint=face[0];
  const projected=sub(newPosition,mul(n,dot(sub(newPosition,planePoint),n)));
  // Convex polygon: all oriented edge crosses must have the same sign.
  let positive=false,negative=false;
  for(let i=0;i<face.length;i++){
    const a=face[i],b=face[(i+1)%face.length];
    const sign=dot(cross(sub(b,a),sub(projected,a)),n);
    if(sign>1e-5)positive=true;
    if(sign< -1e-5)negative=true;
  }
  let bounded=projected;
  if(positive&&negative){
    let distance=Infinity;
    for(let i=0;i<face.length;i++){
      const candidate=nearSegment(projected,face[i],face[(i+1)%face.length]);
      const d=length(sub(projected,candidate));
      if(d<distance){bounded=candidate;distance=d;}
    }
  }
  // Keep the original side of the face; GoldSrc decal trace must hit its surface.
  return add(bounded,mul(n,.8));
}
