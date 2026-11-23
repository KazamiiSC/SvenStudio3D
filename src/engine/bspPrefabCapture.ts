/** v2.6 helpers for saving BSP objects as prefabs: whole-object selection by box, the owning
 * brush entity (func_door, func_button…), point entities inside the object and a thumbnail. */
import type {BspFace} from './bsp';
import {bspOriginalFaceIndex} from './bspFaceSelection';
import {transformedVertices} from './geometry';
import type {BspExtractEntity,BspExtractPoint} from './bspObjectExtractor';
import type {MapObject,Vec3} from './types';

type Ent={classname:string;origin?:Vec3;properties:Record<string,string>};
const modelOrigin=(entities:readonly Ent[],model:number):Vec3=>{
  const e=entities.find(x=>x.properties.model===`*${model}`);const o=(e?.properties.origin||'').trim().split(/\s+/).map(Number);
  return o.length===3&&o.every(Number.isFinite)?o as Vec3:[0,0,0];
};
function boundsOf(faces:readonly BspFace[],entities:readonly Ent[]){
  const lo:Vec3=[Infinity,Infinity,Infinity],hi:Vec3=[-Infinity,-Infinity,-Infinity];
  for(const f of faces){const o=f.model>0?modelOrigin(entities,f.model):[0,0,0];for(const p of f.points)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],p[i]+o[i]);hi[i]=Math.max(hi[i],p[i]+o[i]);}}
  return {lo,hi};
}
/** Every face (any texture) that lies completely inside the box of the current selection + margin.
 * Lets one click on a chair leg grow to the whole chair without taking the floor under it. */
export function bspSelectFacesInBox(faces:readonly BspFace[],selected:readonly number[],margin:number,entities:readonly Ent[]=[],limit=1024):number[]{
  const byId=new Map(faces.map((f,i)=>[bspOriginalFaceIndex(f,i),f]));
  const chosen=selected.map(id=>byId.get(id)).filter((f):f is BspFace=>!!f);
  if(!chosen.length)throw Error('Select at least one face of the object first.');
  const {lo,hi}=boundsOf(chosen,entities);const m=Math.max(0,Math.min(512,margin));
  const out:number[]=[];
  faces.forEach((f,i)=>{const o=f.model>0?modelOrigin(entities,f.model):[0,0,0];
    if(f.points.length&&f.points.every(p=>p.every((v,k)=>v+o[k]>=lo[k]-m-.01&&v+o[k]<=hi[k]+m+.01)))out.push(bspOriginalFaceIndex(f,i));});
  if(out.length>limit)throw Error(`The box contains ${out.length} faces (limit ${limit}). Reduce the margin or select a smaller object.`);
  return out;
}
/** Brush entity owning the selection (when every face is from one *N) and point entities inside it.
 * Point origins are returned in the same space as the extracted faces (model-local for *N). */
export function bspCaptureContext(faces:readonly BspFace[],selected:readonly number[],entities:readonly Ent[]):{entity:BspExtractEntity|null;points:BspExtractPoint[];modelIndex:number}{
  const byId=new Map(faces.map((f,i)=>[bspOriginalFaceIndex(f,i),f]));
  const chosen=selected.map(id=>byId.get(id)).filter((f):f is BspFace=>!!f);
  const models=new Set(chosen.map(f=>f.model));
  const modelIndex=models.size===1?[...models][0]:-1;
  let entity:BspExtractEntity|null=null;let offset:Vec3=[0,0,0];
  if(modelIndex>0){const e=entities.find(x=>x.properties.model===`*${modelIndex}`);if(e){entity={classname:e.classname,props:{...e.properties}};offset=modelOrigin(entities,modelIndex);}}
  const {lo,hi}=boundsOf(chosen,entities);
  const points:BspExtractPoint[]=[];
  for(const e of entities){
    if(!e.origin||e.properties.model?.startsWith('*')||/^(worldspawn|info_player_|info_node|info_landmark)/.test(e.classname))continue;
    if(e.origin.every((v,i)=>v>=lo[i]-16&&v<=hi[i]+16))points.push({classname:e.classname,origin:e.origin.map((v,i)=>v-offset[i]) as Vec3,props:{...e.properties}});
  }
  return {entity,points:points.slice(0,64),modelIndex};
}
/** Small isometric PNG of the prefab geometry for the library (no WebGL needed). */
export function prefabThumbnail(objects:readonly MapObject[],size=160):string{
  if(typeof document==='undefined')return '';
  const polys:{pts:[number,number][];depth:number;shade:number}[]=[];
  const c30=Math.cos(Math.PI/6),s30=.5;
  for(const o of objects){if(o.kind!=='brush'||o.faces.some(f=>/^(origin|aaatrigger|clip|null)$/i.test(f.texture)))continue;
    const v=transformedVertices(o);
    for(const f of o.faces){const p=f.indices.map(i=>v[i]);if(p.length<3)continue;
      const a=[p[1][0]-p[0][0],p[1][1]-p[0][1],p[1][2]-p[0][2]],b=[p[2][0]-p[0][0],p[2][1]-p[0][1],p[2][2]-p[0][2]];
      const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];const l=Math.hypot(...n)||1;
      if((n[0]+n[1]+n[2]*1.2)/l<-.05)continue; // back faces (viewer looks from +x +y +z)
      polys.push({pts:p.map(q=>[(q[0]-q[1])*c30,-(q[0]+q[1])*s30-q[2]]),depth:p.reduce((s,q)=>s+q[0]+q[1]+q[2],0)/p.length,shade:.45+.55*Math.max(0,(n[2]*.8+n[0]*.35+n[1]*.15)/l)});}}
  if(!polys.length)return '';
  const xs=polys.flatMap(p=>p.pts.map(q=>q[0])),ys=polys.flatMap(p=>p.pts.map(q=>q[1]));
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const scale=(size-16)/Math.max(maxX-minX,maxY-minY,1);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const g=canvas.getContext('2d');if(!g)return '';
  g.fillStyle='#172431';g.fillRect(0,0,size,size);g.lineWidth=1;g.strokeStyle='rgba(15,25,35,.85)';
  const ox=(size-(maxX-minX)*scale)/2,oy=(size-(maxY-minY)*scale)/2;
  for(const p of polys.sort((a,b)=>a.depth-b.depth)){
    g.beginPath();p.pts.forEach(([x,y],i)=>{const X=ox+(x-minX)*scale,Y=oy+(y-minY)*scale;i?g.lineTo(X,Y):g.moveTo(X,Y);});g.closePath();
    const c=Math.round(80+150*p.shade);g.fillStyle=`rgb(${c},${Math.round(c*.93)},${Math.round(c*.82)})`;g.fill();g.stroke();
  }
  return canvas.toDataURL('image/png');
}

/** Grows the selection through faces that share a vertex, as long as the object stays within
 * `maxSize` units and the new face is not much bigger than the faces already taken (that stops
 * the flood at floors and walls). Works from a single clicked face. */
export function bspGrowConnectedFaces(faces:readonly BspFace[],selected:readonly number[],maxSize=256,entities:readonly Ent[]=[],limit=1024):number[]{
  const ids=faces.map((f,i)=>bspOriginalFaceIndex(f,i));
  const index=new Map(ids.map((id,i)=>[id,i]));
  const start=selected.map(id=>index.get(id)).filter((i):i is number=>i!==undefined);
  if(!start.length)throw Error('Select at least one face of the object first.');
  const world=faces.map(f=>{const o=f.model>0?modelOrigin(entities,f.model):[0,0,0];return f.points.map(p=>[p[0]+o[0],p[1]+o[1],p[2]+o[2]] as Vec3);});
  const key=(p:Vec3)=>p.map(v=>Math.round(v)).join(',');
  const byVertex=new Map<string,number[]>();
  world.forEach((pts,i)=>{for(const p of pts){const k=key(p);(byVertex.get(k)??byVertex.set(k,[]).get(k)!).push(i);}});
  const area=(pts:Vec3[])=>{let a=0;for(let i=1;i<pts.length-1;i++){const u=pts[i].map((v,k)=>v-pts[0][k]),w=pts[i+1].map((v,k)=>v-pts[0][k]);a+=Math.hypot(u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0])/2;}return a;};
  const taken=new Set(start);const lo:Vec3=[Infinity,Infinity,Infinity],hi:Vec3=[-Infinity,-Infinity,-Infinity];
  const grow=(i:number)=>{for(const p of world[i])for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],p[k]);hi[k]=Math.max(hi[k],p[k]);}};
  let biggest=0;for(const i of start){grow(i);biggest=Math.max(biggest,area(world[i]));}
  const queue=[...start];
  while(queue.length){
    const i=queue.shift()!;
    for(const p of world[i])for(const j of byVertex.get(key(p))??[]){
      if(taken.has(j)||faces[j].model!==faces[i].model&&faces[i].model>0)continue;
      const a=area(world[j]);if(a>Math.max(biggest*4,256))continue;
      const nlo=lo.map((v,k)=>Math.min(v,...world[j].map(q=>q[k]))),nhi=hi.map((v,k)=>Math.max(v,...world[j].map(q=>q[k])));
      if(nhi.some((v,k)=>v-nlo[k]>maxSize))continue;
      taken.add(j);grow(j);biggest=Math.max(biggest,a);queue.push(j);
      if(taken.size>limit)throw Error(`The object has more than ${limit} faces. Lower the maximum size.`);
    }
  }
  return [...taken].map(i=>ids[i]);
}