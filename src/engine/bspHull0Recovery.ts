/** Limited BSP30 submodel hull-0 recovery.
 * Rebuilds convex *solid leaf cells* from the BSP render tree, NOT the authoring
 * brushes. Supports only an entire non-worldspawn *N submodel, with bounded
 * limits and strict validation. This does not reproduce the original collision
 * hulls, entities or surface material segmentation.
 */
import type {BspMap,BspFace} from './bsp.ts';
import type {Brush,Vec3} from './types';
import {uid} from './types';
import {validateBrush} from './exportMap';
import {bspOriginalFaceIndex} from './bspFaceSelection';

const dot=(a:readonly number[],b:readonly number[])=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:readonly number[],b:readonly number[]):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const sub=(a:readonly number[],b:readonly number[]):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const norm=(a:Vec3):Vec3=>{const l=Math.hypot(...a);return l>1e-9?a.map(v=>v/l) as Vec3:[0,0,0]};
type Plane={n:Vec3;d:number;id:number};
const validPoint=(p:readonly number[])=>p.every(v=>Number.isFinite(v)&&Math.abs(v)<=131072);
function stableOrder(points:Vec3[],normal:Vec3):number[]{
 const center=points[0].map((_,j)=>points.reduce((sum,p)=>sum+p[j],0)/points.length) as Vec3;
 const u=norm(cross(normal,Math.abs(normal[2])<.9?[0,0,1]:[0,1,0]));const v=cross(normal,u);
 const sorted=points.map((_,i)=>i).sort((a,b)=>Math.atan2(dot(sub(points[a],center),v),dot(sub(points[a],center),u))-Math.atan2(dot(sub(points[b],center),v),dot(sub(points[b],center),u)));
 let best=0,max=0;
 for(let i=0;i<sorted.length;i++){
  const a=points[sorted[i]],b=points[sorted[(i+1)%sorted.length]],c=points[sorted[(i+2)%sorted.length]];
  const value=Math.hypot(...cross(sub(b,a),sub(c,a)));
  if(value>max){max=value;best=i}
 }
 if(max<.02)throw Error('Recovered submodel contains a degenerate brush side.');
 return [...sorted.slice(best),...sorted.slice(0,best)];
}
const area=(points:readonly Vec3[]):number=>{
 if(points.length<3)return 0;let total=0;
 for(let i=1;i<points.length-1;i++)total+=Math.hypot(...cross(sub(points[i],points[0]),sub(points[i+1],points[0])))/2;
 return total;
};
const readLumps=(source:ArrayBuffer)=>{
 if(source.byteLength<124||new DataView(source).getInt32(0,true)!==30)throw Error('Expected a BSP30 source.');
 const view=new DataView(source);
 return Array.from({length:15},(_,i)=>{
  const at=view.getInt32(4+i*8,true),size=view.getInt32(8+i*8,true);
  if(at<0||size<0||at>source.byteLength||size>source.byteLength-at)throw Error(`Invalid BSP lump ${i}.`);
  return {at,size};
 });
};
function polyhedron(planes:Plane[],sourceFaces:BspFace[],map:BspMap,label:string,number:number):Brush|null{
 if(planes.length>30)throw Error('BSP hull is too complex for safe browser reconstruction (30-plane limit).');
 // Intersect triple planes and keep only intersections inside ALL halfspaces.
 const vertices:Vec3[]=[];
 for(let a=0;a<planes.length;a++)for(let b=a+1;b<planes.length;b++)for(let c=b+1;c<planes.length;c++){
  const A=planes[a],B=planes[b],C=planes[c],bc=cross(B.n,C.n),ca=cross(C.n,A.n),ab=cross(A.n,B.n),det=dot(A.n,bc);
  if(Math.abs(det)<1e-7)continue;
  const p:Vec3=[0,1,2].map(i=>(A.d*bc[i]+B.d*ca[i]+C.d*ab[i])/det) as Vec3;
  if(!validPoint(p)||planes.some(h=>dot(h.n,p)>h.d+.008))continue;
  if(!vertices.some(v=>Math.hypot(...sub(v,p))<.025))vertices.push(p);
 }
 if(vertices.length<4)return null;
 if(vertices.length>128)throw Error('Recovered solid has too many vertices.');
 const pivot=[0,1,2].map(j=>vertices.reduce((sum,p)=>sum+p[j],0)/vertices.length) as Vec3;
 const faces:Brush['faces']=[];
 const seen=new Set<string>();
 const fallback=sourceFaces.find(f=>map.textures[f.texture]&&f.sTexinfo&&f.tTexinfo)??sourceFaces[0];
 if(!fallback)throw Error('Selected submodel has no reference texture.');
 for(const plane of planes){
  const indices=vertices.map((p,i)=>Math.abs(dot(plane.n,p)-plane.d)<.02?i:-1).filter(i=>i>=0);
  if(indices.length<3)continue;
  const hash=indices.slice().sort((a,b)=>a-b).join(',');if(seen.has(hash))continue;seen.add(hash);
  const local=indices.map(i=>vertices[i]);
  if(area(local)<.02)continue;
  const center=[0,1,2].map(j=>local.reduce((sum,p)=>sum+p[j],0)/local.length) as Vec3;
  const matching=sourceFaces.map(f=>{
    if(!f.points.length||!f.sTexinfo||!f.tTexinfo||!map.textures[f.texture])return null;
    const fp=f.points[0],fn=norm(f.normal);
    const aligned=Math.abs(dot(fn,plane.n));
    if(aligned<.999||Math.abs(dot(plane.n,fp)-plane.d)>.08)return null;
    const fc=[0,1,2].map(j=>f.points.reduce((s,p)=>s+p[j],0)/f.points.length) as Vec3;
    const distance=Math.hypot(...sub(center,fc));
    return {face:f,score:distance};
  }).filter((v):v is {face:BspFace;score:number}=>!!v).sort((a,b)=>a.score-b.score);
  const textureFace=matching[0]?.face??fallback;
  const texture=map.textures[textureFace.texture];
  if(!texture||!textureFace.sTexinfo||!textureFace.tTexinfo)throw Error('Submodel reconstruction cannot resolve a valid material.');
  const order=stableOrder(local,plane.n).map(k=>indices[k]);
  faces.push({indices:order,texture:texture.name,uAxis:textureFace.sTexinfo.slice(0,3) as Vec3,vAxis:textureFace.tTexinfo.slice(0,3) as Vec3,uShift:textureFace.sTexinfo[3],vShift:textureFace.tTexinfo[3],uScale:1,vScale:1});
 }
 if(faces.length<4||faces.length>64)return null;
 const brush:Brush={id:uid(),kind:'brush',primitive:'poly',name:`${label} solid ${number}`,position:pivot,rotation:[0,0,0],scale:[1,1,1],vertices:vertices.map(p=>sub(p,pivot)),faces,layer:'Recovered BSP Hull0',group:label};
 const problems=validateBrush(brush);
 if(problems.length)throw Error(`Recovered submodel solid ${number} invalid: ${problems[0]}`);
 return brush;
}
export function recoverSolidSubmodelHull0(map:BspMap,source:ArrayBuffer,faceIds:readonly number[],label:string):{modelIndex:number;brushes:Brush[]}{
 const lumps=readLumps(source),view=new DataView(source);
 if(lumps[14].size%64||lumps[5].size%24||lumps[10].size%28||lumps[1].size%20)throw Error('Malformed BSP hull/model tables.');
 const byId=new Map(map.faces.map((f,i)=>[bspOriginalFaceIndex(f,i),f]));
 const selected=faceIds.map(id=>byId.get(id));
 if(!selected.length||selected.some(f=>!f))throw Error('Select the entire BSP submodel first.');
 const modelIndex=selected[0]!.model;
 if(!modelIndex||selected.some(f=>f!.model!==modelIndex))throw Error('Solid-hull recovery supports only one complete brush submodel *N, not worldspawn or mixed models.');
 if(modelIndex>=lumps[14].size/64)throw Error('BSP model index is out of bounds.');
 const modelAt=lumps[14].at+64*modelIndex;
 const first=view.getInt32(modelAt+56,true),count=view.getInt32(modelAt+60,true);
 if(count<4||count>256||selected.length!==count||new Set(faceIds).size!==count||faceIds.some(id=>id<first||id>=first+count))throw Error('Select the entire *N submodel (every BSP face) before reconstructing solid hulls.');
 const sourceFaces=selected as BspFace[];
 const low=[0,1,2].map(i=>view.getFloat32(modelAt+4*i,true)) as Vec3;
 const high=[0,1,2].map(i=>view.getFloat32(modelAt+12+4*i,true)) as Vec3;
 if(!validPoint(low)||!validPoint(high)||low.some((v,i)=>high[i]-v<.1||high[i]-v>8192))throw Error('Invalid or oversized submodel bounds.');
 const initial:Plane[]=[];
 for(let i=0;i<3;i++){
  const plus:Vec3=[0,0,0],minus:Vec3=[0,0,0];plus[i]=1;minus[i]=-1;
  initial.push({n:plus,d:high[i],id:-1-i*2},{n:minus,d:-low[i],id:-2-i*2});
 }
 const head=view.getInt32(modelAt+36,true),nodeCount=lumps[5].size/24,leafCount=lumps[10].size/28,planeCount=lumps[1].size/20;
 if(head<0||head>=nodeCount)throw Error('Invalid model hull-0 headnode.');
 const brushes:Brush[]=[];let visited=0;
 const walk=(node:number,path:Plane[],ancestors:Set<number>)=>{
  if(++visited>512)throw Error('BSP hull exceeds safe traversal limit.');
  if(node<0){
   const leaf=-node-1;
   if(leaf>=leafCount)throw Error('BSP hull references an invalid leaf.');
   const contents=view.getInt32(lumps[10].at+leaf*28,true);
   if(contents!==-2)return;
   const brush=polyhedron(path,sourceFaces,map,label,brushes.length+1);
   if(brush)brushes.push(brush);
   if(brushes.length>64)throw Error('Too many solid BSP hull fragments (limit 64).');
   return;
  }
  if(node>=nodeCount||ancestors.has(node))throw Error('BSP hull has an invalid or cyclic node reference.');
  if(path.length>30)throw Error('BSP hull exceeds 30 clipping planes.');
  const at=lumps[5].at+node*24,planeId=view.getInt32(at,true),front=view.getInt16(at+4,true),back=view.getInt16(at+6,true);
  if(planeId<0||planeId>=planeCount)throw Error('BSP hull has an invalid plane.');
  const atPlane=lumps[1].at+planeId*20;
  const n=[0,4,8].map(d=>view.getFloat32(atPlane+d,true)) as Vec3,d=view.getFloat32(atPlane+12,true);
  if(!validPoint(n)||!Number.isFinite(d)||Math.hypot(...n)<.5)throw Error('Invalid hull split plane.');
  const stack=new Set(ancestors);stack.add(node);
  // GoldSrc node child 0 is the positive (front) halfspace; 1 is negative.
  walk(front,[...path,{n:n.map(v=>-v) as Vec3,d:-d,id:planeId}],stack);
  walk(back,[...path,{n,d,id:planeId}],stack);
 };
 walk(head,initial,new Set());
 if(!brushes.length)throw Error('No bounded solid BSP leaf cells could be reconstructed.');
 return {modelIndex,brushes};
}
