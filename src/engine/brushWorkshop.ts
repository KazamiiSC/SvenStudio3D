/** v1.9.7 Brush Workshop: edit an actual planar face using a 2D drawing frame.
 * Every generated piece is a closed convex GoldSrc brush, never a render mesh.
 */
import * as THREE from 'three';
import {orientFaces,transformedVertices} from './geometry';
import {subtractConvex} from './advancedModeling';
import {validateBrush} from './exportMap';
import {uid} from './types';
import type {Brush,Face,Vec3} from './types';

const vec=(p:Vec3)=>new THREE.Vector3(...p);
const asVec=(p:THREE.Vector3):Vec3=>[p.x,p.y,p.z].map(n=>Math.round(n*1e5)/1e5) as Vec3;
export type WorkshopOperation='panel'|'recess'|'opening'|'frame'|'framed-opening';
export type WorkshopProfile='rectangle'|'circle'|'ellipse'|'polygon'|'rounded';
export type WorkshopShape={u:number;v:number;width:number;height:number;depth:number;frame:number;profile?:WorkshopProfile;segments?:number};
export type FaceFrame={origin:Vec3;normal:Vec3;uAxis:Vec3;vAxis:Vec3;minU:number;maxU:number;minV:number;maxV:number;outline:[number,number][]};
export type WorkshopResult={replacement:Brush[]|null;additions:Brush[];removed:number};
export function workshopFrame(brush:Brush,faceIndex:number):FaceFrame{
  const face=brush.faces[faceIndex];if(!face||face.indices.length<3)throw Error('Choose a face with at least 3 vertices.');
  const all=transformedVertices(brush).map(vec),verts=face.indices.map(i=>all[i]);
  if(verts.some(v=>!v||!v.toArray().every(Number.isFinite)))throw Error('Invalid face vertices.');
  const a=verts[0],edge=verts[1].clone().sub(a);if(edge.lengthSq()<1e-8)throw Error('Degenerate face edge.');
  const u=edge.normalize();const n=verts[1].clone().sub(a).cross(verts[2].clone().sub(a)).normalize();
  const middle=all.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(all.length);
  if(n.dot(middle.clone().sub(a))>0)n.negate();
  const v=n.clone().cross(u).normalize();
  const origin=verts.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).divideScalar(verts.length);
  const outline=verts.map(p=>[p.clone().sub(origin).dot(u),p.clone().sub(origin).dot(v)] as [number,number]);
  return {origin:asVec(origin),normal:asVec(n),uAxis:asVec(u),vAxis:asVec(v),
    minU:Math.min(...outline.map(p=>p[0])),maxU:Math.max(...outline.map(p=>p[0])),
    minV:Math.min(...outline.map(p=>p[1])),maxV:Math.max(...outline.map(p=>p[1])),outline};
}
function insideConvex(poly:[number,number][],p:[number,number]):boolean{
  let sign=0;
  for(let i=0;i<poly.length;i++){
    const a=poly[i],b=poly[(i+1)%poly.length];
    const z=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
    if(Math.abs(z)<1e-3)continue;
    const s=Math.sign(z);if(sign&&sign!==s)return false;sign=s;
  }
  return true;
}
/** The footprint remains a convex planar polygon; the preview and MAP use identical solids. */
export function workshopFootprint(shape:WorkshopShape):[number,number][]{
  const x=shape.width/2,y=shape.height/2;
  const profile=shape.profile??'rectangle';
  const segments=Math.floor(shape.segments??16);
  if(!Number.isInteger(segments)||segments<3||segments>64)throw Error('Quality must be 3–64 segments.');
  if(profile==='rectangle')return [[-x,-y],[x,-y],[x,y],[-x,y]];
  if(profile==='circle'||profile==='ellipse'||profile==='polygon'){
    const count=profile==='polygon'?segments:Math.max(8,segments);
    const radiusX=profile==='circle'?Math.min(x,y):x;
    const radiusY=profile==='circle'?Math.min(x,y):y;
    return Array.from({length:count},(_,i)=>{
      const theta=2*Math.PI*i/count+(profile==='polygon'?-Math.PI/2:0);
      return [radiusX*Math.cos(theta),radiusY*Math.sin(theta)] as [number,number];
    });
  }
  // Rounded corners, still exactly convex, with four planar beveled arcs.
  const cornerCount=Math.max(2,Math.min(12,Math.round(segments/4)));
  const radius=Math.min(x,y)*0.4;
  const centers:[[number,number],number][]=[[[x-radius,-y+radius],-Math.PI/2],[[x-radius,y-radius],0],[[-x+radius,y-radius],Math.PI/2],[[-x+radius,-y+radius],Math.PI]];
  return centers.flatMap(([c,start])=>Array.from({length:cornerCount+1},(_,i)=>[
    c[0]+radius*Math.cos(start+(Math.PI/2)*i/cornerCount),
    c[1]+radius*Math.sin(start+(Math.PI/2)*i/cornerCount)
  ] as [number,number]));
}
/** Generates a closed convex GoldSrc prism; no unsupported open mesh geometry. */
function makePrism(brush:Brush,faceIndex:number,frame:FaceFrame,points:[number,number][],low:number,high:number,name:string):Brush{
  if(points.length<3||points.length>64||high-low<.5)throw Error('Detail polygon has invalid geometry or thickness.');
  const o=vec(frame.origin),u=vec(frame.uAxis),v=vec(frame.vAxis),n=vec(frame.normal);
  const at=(p:[number,number],distance:number):Vec3=>asVec(o.clone().addScaledVector(u,p[0]).addScaledVector(v,p[1]).addScaledVector(n,distance));
  const count=points.length;
  const vertices:Vec3[]=[...points.map(p=>at(p,low)),...points.map(p=>at(p,high))];
  const faceInfo=brush.faces[faceIndex];
  const shared:Omit<Face,'indices'>={texture:faceInfo.texture,uShift:faceInfo.uShift,vShift:faceInfo.vShift,uScale:faceInfo.uScale,vScale:faceInfo.vScale,rotation:faceInfo.rotation,uAxis:faceInfo.uAxis,vAxis:faceInfo.vAxis};
  const topology=[Array.from({length:count},(_,i)=>i),Array.from({length:count},(_,i)=>i+count),...Array.from({length:count},(_,i)=>[i,(i+1)%count,(i+1)%count+count,i+count])];
  const result:Brush={id:uid(),kind:'brush',name,primitive:'poly',vertices,faces:orientFaces(vertices,topology.map(indices=>({...shared,indices}))),
    position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],entityId:brush.entityId,layer:brush.layer,group:brush.group};
  const issues=validateBrush(result);if(issues.length)throw Error(`Invalid detail brush: ${issues[0]}`);
  return result;
}
function translatedProfile(shape:WorkshopShape):[number,number][]{
  return workshopFootprint(shape).map(([x,y])=>[x+shape.u,y+shape.v]);
}
export function planWorkshop(brush:Brush,faceIndex:number,operation:WorkshopOperation,shape:WorkshopShape):WorkshopResult{
  if(brush.hidden||brush.locked)throw Error('Unlock and show the brush before editing.');
  if(![shape.u,shape.v,shape.width,shape.height,shape.depth,shape.frame].every(Number.isFinite))throw Error('Invalid numeric dimensions.');
  if(shape.width<4||shape.height<4||shape.width>8192||shape.height>8192||shape.depth<1||shape.depth>8192)throw Error('Choose dimensions between 4 and 8192 units, and a positive depth.');
  const f=workshopFrame(brush,faceIndex);
  const polygon=translatedProfile(shape);
  if(polygon.length>64||!polygon.every(p=>insideConvex(f.outline,p)))throw Error('The drawn shape must remain completely inside the selected face.');
  const add=(points:[number,number][],z0:number,z1:number,label:string)=>makePrism(brush,faceIndex,f,points,z0,z1,`${brush.name} · ${label}`);
  let replacement:Brush[]|null=null,removed=0;
  if(operation==='recess'||operation==='opening'||operation==='framed-opening'){
    const n=vec(f.normal),o=vec(f.origin);
    const thickness=Math.max(...transformedVertices(brush).map(p=>o.clone().sub(vec(p)).dot(n)));
    const cutDepth=operation==='recess'?shape.depth:Math.max(thickness+2,shape.depth);
    const cutter=add(polygon,-cutDepth,1,'Temporary cutter');
    replacement=subtractConvex(brush,cutter).map((p,i)=>({...p,id:uid(),name:`${brush.name} · Cut ${i+1}`,group:brush.group,layer:brush.layer,entityId:brush.entityId}));
    if(!replacement.length)throw Error('This cut would delete the entire source brush.');
    if(replacement.length>96)throw Error('Too many solid pieces. Reduce detail segments.');
    removed=1;
  }
  const additions:Brush[]=[];
  if(operation==='panel')additions.push(add(polygon,0,shape.depth,'Panel'));
  if(operation==='frame'||operation==='framed-opening'){
    const border=shape.frame;
    if(border<1||border*2>=Math.min(shape.width,shape.height))throw Error('Frame border must be smaller than half of both dimensions.');
    // The rectangular case uses four conventional brushes (legacy save compatibility).
    if((shape.profile??'rectangle')==='rectangle'){
      const rect=(x:number,y:number,w:number,h:number):[number,number][]=>[[x-w/2,y-h/2],[x+w/2,y-h/2],[x+w/2,y+h/2],[x-w/2,y+h/2]];
      const u=shape.u,v=shape.v,w=shape.width,h=shape.height;
      additions.push(add(rect(u,v+(h-border)/2,w,border),0,shape.depth,'Top frame'));
      additions.push(add(rect(u,v-(h-border)/2,w,border),0,shape.depth,'Bottom frame'));
      additions.push(add(rect(u-(w-border)/2,v,border,h-2*border),0,shape.depth,'Left frame'));
      additions.push(add(rect(u+(w-border)/2,v,border,h-2*border),0,shape.depth,'Right frame'));
    }else{
      // Ring segments are separate convex quadrilateral prisms (concave annuli are invalid GoldSrc brushes).
      const rx=(shape.width-2*border)/shape.width,ry=(shape.height-2*border)/shape.height;
      const inner=polygon.map(([x,y])=>[shape.u+(x-shape.u)*rx,shape.v+(y-shape.v)*ry] as [number,number]);
      for(let i=0;i<polygon.length;i++){
        const next=(i+1)%polygon.length;
        additions.push(add([polygon[i],polygon[next],inner[next],inner[i]],0,shape.depth,`Frame ${i+1}`));
      }
    }
  }
  return {replacement,additions,removed};
}
