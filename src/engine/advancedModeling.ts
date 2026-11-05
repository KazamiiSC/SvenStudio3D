/** Svengine/GoldSrc-safe solid modeling for SvenStudio 3D v0.7.0.
 * Every result is a closed, planar CONVEX brush; concave booleans produce
 * multiple convex world/brush-entity solids, not an unsupported mesh.
 */
import * as THREE from 'three';
import {transformedVertices,round} from './geometry';
import {rebuildConvexBrush,uniqueBrushEdges} from './modeling';
import {validateBrush} from './exportMap';
import {uid} from './types';
import type {Brush,Face,Vec3} from './types';

const EPS=1e-5;
type Plane={normal:THREE.Vector3;constant:number};
const V=(p:Vec3)=>new THREE.Vector3(...p);
const asVec=(v:THREE.Vector3):Vec3=>[round(v.x,5),round(v.y,5),round(v.z,5)];
function worldBrush(brush:Brush):Brush{
  return {...brush,vertices:transformedVertices(brush),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
}
function uniqueAdd(points:Vec3[],p:Vec3){if(!points.some(q=>q.every((n,i)=>Math.abs(n-p[i])<1e-4)))points.push(p)}
function planes(brush:Brush):Plane[]{
  const vertices=transformedVertices(brush).map(V);
  const centroid=new THREE.Vector3();vertices.forEach(p=>centroid.add(p));centroid.divideScalar(vertices.length);
  return brush.faces.map(face=>{
    const [a,b,c]=face.indices.slice(0,3).map(i=>vertices[i]);
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if(normal.dot(centroid.clone().sub(a))>0)normal.negate();
    return {normal,constant:normal.dot(a)};
  });
}
/** Clip against an arbitrary world-space supporting plane; keep its negative
 * halfspace (inside) or positive halfspace (outside). */
export function clipConvex(brush:Brush,plane:Plane,inside=true):Brush|null{
  if(!Number.isFinite(plane.constant)||plane.normal.lengthSq()<.001)throw Error('Invalid clipping plane.');
  const base=worldBrush(brush),points=base.vertices;
  const distances=points.map(p=>plane.normal.dot(V(p))-plane.constant);
  const kept=(d:number)=>inside?d<=EPS:d>=-EPS;
  if(distances.every(kept))return {...brush,id:uid()};
  if(distances.every(d=>inside?d>=-EPS:d<=EPS))return null;
  const out:Vec3[]=[];
  points.forEach((p,i)=>{if(kept(distances[i]))uniqueAdd(out,[...p])});
  for(const [a,b] of uniqueBrushEdges(base)){
    const da=distances[a],db=distances[b];
    if((da>EPS&&db< -EPS)||(da< -EPS&&db>EPS)){
      const t=da/(da-db);
      uniqueAdd(out,asVec(V(points[a]).lerp(V(points[b]),t)));
    }
  }
  if(out.length<4)return null;
  // Collinear intermediate edge points may be unused by ConvexHull; strip
  // them before export so indices and planes are canonical.
  let result:Brush;
  try{result=rebuildConvexBrush(base,out,{requireAllVertices:false})}catch{return null}
  const used=[...new Set(result.faces.flatMap(f=>f.indices))].sort((a,b)=>a-b);
  const index=new Map(used.map((old,i)=>[old,i]));
  result={...result,vertices:used.map(i=>result.vertices[i]),faces:result.faces.map(f=>({...f,indices:f.indices.map(i=>index.get(i)!)}))};
  const problems=validateBrush(result);
  if(problems.length)throw Error(`CSG created invalid brush: ${problems[0]}`);
  return {...result,id:uid(),name:brush.name,layer:brush.layer,entityId:brush.entityId};
}
/** Intersection is convex, so it is representable by one brush or empty. */
export function intersectConvex(a:Brush,b:Brush):Brush|null{
  let part:Brush|null=a;
  for(const plane of planes(b)){
    if(!part)break;
    part=clipConvex(part,plane,true);
  }
  return part;
}
/** A - B = pieces OUTSIDE each B plane, plus a remainder INSIDE to clip
 * by the next plane. Pieces are non-overlapping and have valid brush faces. */
export function subtractConvex(a:Brush,b:Brush):Brush[]{
  let remainder:Brush|null=a;
  const pieces:Brush[]=[];
  for(const plane of planes(b)){
    if(!remainder)break;
    const outside=clipConvex(remainder,plane,false);
    if(outside)pieces.push(outside);
    remainder=clipConvex(remainder,plane,true);
    if(pieces.length>128)throw Error('CSG subtract exceeded safe brush limit (128).');
  }
  return pieces.map((p,i)=>({...p,name:`${a.name} Subtract ${i+1}`}));
}
/** Union is represented as A plus B-A, rather than merging into a concave
 * GoldSrc-invalid brush. */
export function unionConvex(a:Brush,b:Brush):Brush[]{
  if(a.entityId!==b.entityId)throw Error('Union requires both brushes to belong to the same world/entity.');
  return [{...a,id:uid(),name:`${a.name} Union`},...subtractConvex(b,a).map((p,i)=>({...p,name:`${a.name} Union ${i+2}`,entityId:a.entityId,layer:a.layer}))];
}
function edgePlane(brush:Brush,a:number,b:number,amount:number):Plane{
  const adjacent=brush.faces.map((f,i)=>({f,i})).filter(({f})=>
    f.indices.some((v,j)=>v===a&&f.indices[(j+1)%f.indices.length]===b||v===b&&f.indices[(j+1)%f.indices.length]===a));
  if(adjacent.length!==2)throw Error('Bevel needs a manifold edge shared by two faces.');
  const p=planes(brush);const normal=p[adjacent[0].i].normal.clone().add(p[adjacent[1].i].normal).normalize();
  if(normal.lengthSq()<0.5)throw Error('Cannot bevel a flat edge.');
  return {normal,constant:normal.dot(V(transformedVertices(brush)[a]))-amount};
}
/** Clips off one sharp edge to add a new sloped planar face. */
export function bevelEdge(brush:Brush,a:number,b:number,width:number):Brush{
  if(!Number.isFinite(width)||width<=EPS)throw Error('Bevel width must be positive.');
  if(!uniqueBrushEdges(brush).some(([u,v])=>u===a&&v===b||u===b&&v===a))throw Error('Select a real brush edge.');
  const cut=edgePlane(brush,a,b,width);
  const result=clipConvex(brush,cut,true);
  if(!result||result.faces.length<=brush.faces.length)throw Error('Bevel width is too large or removes the brush.');
  return {...result,name:brush.name+' Bevel'};
}
/** Inset-style tapered rim: chamfers all edges surrounding the chosen face,
 * preserving a smaller top polygon. A coplanar inset of a single face is NOT
 * representable in GoldSrc as one convex brush. */
export function taperInsetFace(brush:Brush,faceIndex:number,width:number):Brush{
  if(!Number.isFinite(width)||width<=EPS)throw Error('Inset width must be positive.');
  const face=brush.faces[faceIndex];if(!face)throw Error('Select a face first.');
  const cuts=face.indices.map((a,i)=>edgePlane(brush,a,face.indices[(i+1)%face.indices.length],width));
  let current:Brush|null=brush;
  for(const cut of cuts){
    current=clipConvex(current,cut,true);
    if(!current)throw Error('Inset too large for this face.');
  }
  if(current.faces.length<=brush.faces.length)throw Error('Inset did not create a valid rim.');
  return {...current,name:brush.name+' Inset'};
}
/** New separate convex brush extruded outward from a selected polygon.
 * The source brush remains unchanged. Adjacent coplanar faces are resolved by
 * the official SC-CSG compiler. */
export function extrudeFaceBrush(brush:Brush,faceIndex:number,distance:number):Brush{
  if(!Number.isFinite(distance)||distance<=EPS)throw Error('Extrusion must be a positive outward distance.');
  const face=brush.faces[faceIndex];if(!face||face.indices.length<3)throw Error('Select a face first.');
  const transformed=transformedVertices(brush);let ids=[...face.indices];
  const a=V(transformed[ids[0]]),b=V(transformed[ids[1]]),c=V(transformed[ids[2]]);
  const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  const center=new THREE.Vector3();transformed.forEach(p=>center.add(V(p)));center.divideScalar(transformed.length);
  if(normal.dot(center.clone().sub(a))>0){ids=ids.reverse();normal.negate()}
  const base=ids.map(i=>transformed[i]);const n=base.length;
  const vertices:Vec3[]=[...base.map(p=>[...p] as Vec3),...base.map(p=>asVec(V(p).addScaledVector(normal,distance)))];
  const faceMetadata={texture:face.texture,uShift:face.uShift,vShift:face.vShift,uScale:face.uScale,vScale:face.vScale,rotation:face.rotation,uAxis:face.uAxis,vAxis:face.vAxis};
  const faces:Face[]=[
    {...faceMetadata,indices:Array.from({length:n},(_,i)=>n-1-i)},
    {...faceMetadata,indices:Array.from({length:n},(_,i)=>i+n)},
    ...Array.from({length:n},(_,i)=>({...faceMetadata,indices:[i,(i+1)%n,(i+1)%n+n,i+n]}))
  ];
  const result:Brush={...worldBrush(brush),id:uid(),primitive:'poly',name:brush.name+' Extrusion',vertices,faces};
  const errors=validateBrush(result);if(errors.length)throw Error(errors[0]);
  return result;
}
