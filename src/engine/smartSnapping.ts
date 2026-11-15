/** Smart Snapping 2.0 (HF12). Read-only geometry queries for editor translations.
 * No changes to authored brushes, Valve 220 faces, UVs or BSP data.
 * Coordinates and distances are Sven/GoldSrc units (Z-up).
 */
import type {MapObject,Vec3} from './types';
import {transformedVertices} from './geometry';
import {uniqueBrushEdges} from './modeling';

export type SmartSnapMode='all'|'face'|'vertex'|'edge';
export type SmartSnapKind='face'|'vertex'|'edge'|'surface';
export type SnapAxes=readonly [boolean,boolean,boolean];
export const ALL_SNAP_AXES:SnapAxes=[true,true,true];
export type SnapFace={point:Vec3;normal:Vec3;vertices:Vec3[]};
export type SnapShape={id:string;kind:'brush'|'entity';min:Vec3;max:Vec3;vertices:Vec3[];edges:ReadonlyArray<readonly [Vec3,Vec3]>;faces:SnapFace[]};
export type SmartSnapCache={moving:SnapShape[];targets:SnapShape[]};
export type SmartSnapResult={delta:Vec3;kind:SmartSnapKind;source:Vec3;target:Vec3;correction:number};
const LIMITS={moving:32,targets:320,vertices:32,edges:48,faces:18};
const finite=(v:number)=>Number.isFinite(v);
const validVec=(v:Vec3)=>v.every(finite);
function bounds(points:Vec3[]):{min:Vec3;max:Vec3}{
  return {min:[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))) as Vec3,
    max:[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))) as Vec3};
}
function sampled<T>(list:readonly T[],max:number):T[]{
  if(list.length<=max)return [...list];
  const result:T[]=[];for(let i=0;i<max;i++)result.push(list[Math.floor(i*list.length/max)]);
  return result;
}
function shapeOf(object:MapObject):SnapShape|null{
  if(object.kind==='entity'){
    if(!validVec(object.position))return null;
    const p=[...object.position] as Vec3;
    return {id:object.id,kind:'entity',min:p,max:p,vertices:[p],edges:[],faces:[]};
  }
  if(object.kind!=='brush'||!object.vertices.length)return null;
  const all=transformedVertices(object);
  if(!all.length||!all.every(validVec))return null;
  const {min,max}=bounds(all);
  const edges=sampled(uniqueBrushEdges(object),LIMITS.edges)
    .filter(([a,b])=>all[a]&&all[b]).map(([a,b])=>[all[a],all[b]] as const);
  const faces:SnapFace[]=[];
  for(const f of object.faces.slice(0,LIMITS.faces)){
    const vertices=f.indices.map(i=>all[i]).filter((p):p is Vec3=>!!p);
    if(vertices.length<3)continue;
    const edge1=sub(vertices[1],vertices[0]),edge2=sub(vertices[2],vertices[0]);
    const n=cross(edge1,edge2),length=Math.hypot(...n);
    if(length<1e-6)continue;
    faces.push({vertices,normal:mul(n,1/length),point:mean(vertices)});
  }
  return {id:object.id,kind:'brush',min,max,vertices:sampled(all,LIMITS.vertices),edges,faces};
}
function boxDistanceSq(a:SnapShape,b:SnapShape):number{
  let dist=0;
  for(let i=0;i<3;i++){
    const gap=Math.max(0,a.min[i]-b.max[i],b.min[i]-a.max[i]);dist+=gap*gap;
  }
  return dist;
}
/** Capture candidates once per gesture, excluding selected/hidden objects.
 * The closest target brushes are retained. Limits cap per-frame work in huge maps.
 */
export function createSmartSnapCache(selection:readonly MapObject[],objects:readonly MapObject[]):SmartSnapCache{
  const moving=selection.slice(0,LIMITS.moving).map(shapeOf).filter((v):v is SnapShape=>!!v);
  const selected=new Set(selection.map(o=>o.id));
  const candidates=objects.filter(o=>!selected.has(o.id)&&!o.hidden&&o.kind==='brush')
    .map(shapeOf).filter((v):v is SnapShape=>!!v);
  candidates.sort((a,b)=>{
    const da=Math.min(...moving.map(m=>boxDistanceSq(m,a)));
    const db=Math.min(...moving.map(m=>boxDistanceSq(m,b)));
    return da-db;
  });
  return {moving,targets:candidates.slice(0,LIMITS.targets)};
}
function add(a:Vec3,b:Vec3):Vec3{return [a[0]+b[0],a[1]+b[1],a[2]+b[2]];}
function sub(a:Vec3,b:Vec3):Vec3{return [a[0]-b[0],a[1]-b[1],a[2]-b[2]];}
function mul(a:Vec3,n:number):Vec3{return [a[0]*n,a[1]*n,a[2]*n];}
function dot(a:Vec3,b:Vec3):number{return a.reduce((s,x,i)=>s+x*b[i],0);}
function cross(a:Vec3,b:Vec3):Vec3{return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function mean(points:Vec3[]):Vec3{return mul(points.reduce(add,[0,0,0] as Vec3),1/points.length);}
function unit(v:Vec3):Vec3{return mul(v,1/Math.max(1e-8,Math.hypot(...v)));}
function faceOverlap(a:SnapFace,b:SnapFace,delta:Vec3):boolean{
  // Compare real polygon projections on two axes within their common plane.
  const reference=Math.abs(a.normal[2])<.9?[0,0,1] as Vec3:[0,1,0] as Vec3;
  const u=unit(cross(a.normal,reference)),v=unit(cross(a.normal,u));
  for(const axis of [u,v]){
    const aCoords=a.vertices.map(p=>dot(add(p,delta),axis));
    const bCoords=b.vertices.map(p=>dot(p,axis));
    if(Math.min(...aCoords)>Math.max(...bCoords)+.001||Math.min(...bCoords)>Math.max(...aCoords)+.001)return false;
  }
  return true;
}
function insideFace(p:Vec3,face:SnapFace):boolean{
  // Convex brush faces, accepting both authoring winding directions.
  let positive=true,negative=true;
  for(let i=0;i<face.vertices.length;i++){
    const a=face.vertices[i],b=face.vertices[(i+1)%face.vertices.length];
    const side=dot(cross(sub(b,a),sub(p,a)),face.normal);
    if(side<-.001)positive=false;
    if(side>.001)negative=false;
  }
  return positive||negative;
}
function nearestSegment(p:Vec3,a:Vec3,b:Vec3):Vec3{
  const ab=sub(b,a),d=dot(ab,ab),f=d>1e-8?Math.max(0,Math.min(1,dot(sub(p,a),ab)/d)):0;
  return add(a,mul(ab,f));
}
function allowed(correction:Vec3,axes:SnapAxes){return correction.every((v,i)=>axes[i]||Math.abs(v)<1e-5);}
function center(a:Vec3,b:Vec3):Vec3{return mul(add(a,b),.5);}
/** Return an exact translation and its on-screen guide anchor, if within tolerance.
 * Explicit axis constraints always win. This never rotates, scales, or edits objects.
 */
export function resolveSmartSnap(cache:SmartSnapCache,delta:Vec3,tolerance:number,mode:SmartSnapMode='all',axes:SnapAxes=ALL_SNAP_AXES):SmartSnapResult|null{
  if(!validVec(delta)||!finite(tolerance)||tolerance<=0||!cache.moving.length||!cache.targets.length)return null;
  const limit=Math.min(128,Math.max(.05,tolerance));
  let best:SmartSnapResult|null=null,score=Infinity;
  const propose=(kind:SmartSnapKind,src:Vec3,target:Vec3,weight=1)=>{
    const correction=sub(target,src);
    if(!allowed(correction,axes))return;
    const dist=Math.sqrt(dot(correction,correction));
    if(dist>limit||dist<.0001)return;
    const value=dist*weight;
    if(value>=score)return;
    score=value;best={kind,source:src,target,delta:add(delta,correction),correction:dist};
  };
  let nearbyPairs=0;
  for(const moving of cache.moving){
    const movedMin=add(moving.min,delta),movedMax=add(moving.max,delta);
    for(const target of cache.targets){
      const shifted={...moving,min:movedMin,max:movedMax};
      if(boxDistanceSq(shifted,target)>(limit+.001)**2)continue;
      if(++nearbyPairs>96)break; // cap expensive feature comparisons per frame
      if(mode==='all'||mode==='face'){
        if(moving.kind==='brush'){
          for(const sourceFace of moving.faces)for(const targetFace of target.faces){
            // Only parallel real polygon planes, facing one another, qualify.
            if(dot(sourceFace.normal,targetFace.normal)>-.995||!faceOverlap(sourceFace,targetFace,delta))continue;
            const source=add(sourceFace.point,delta);
            const offset=dot(sub(targetFace.point,source),sourceFace.normal);
            const destination=add(source,mul(sourceFace.normal,offset));
            propose('face',source,destination,.92);
          }
        }else{
          const point=add(moving.vertices[0],delta);
          for(const face of target.faces){
            const offset=dot(sub(face.point,point),face.normal);
            const destination=add(point,mul(face.normal,offset));
            if(insideFace(destination,face))propose('surface',point,destination,.92);
          }
        }
      }
      if(mode==='all'||mode==='vertex'){
        for(const v of moving.vertices){const a=add(v,delta);
          for(const b of target.vertices)propose('vertex',a,b);
        }
      }
      if(mode==='all'||mode==='edge'){
        // Snap a moved edge midpoint to the closest point of an unselected edge.
        for(const [a,b] of moving.kind==='entity'?[[moving.vertices[0],moving.vertices[0]] as const]:moving.edges){const middle=add(center(a,b),delta);
          for(const [c,d] of target.edges)propose('edge',middle,nearestSegment(middle,c,d),1.05);
        }
      }
    }
  }
  return best;
}
/** Pixel-sized tolerance converted to map units at the selection's depth. */
export function smartSnapWorldTolerance(camera:{isOrthographicCamera?:boolean;top?:number;bottom?:number;zoom?:number;fov?:number},distance:number,viewportHeight:number,pixels:number){
  const px=Math.max(4,Math.min(30,pixels));
  const height=Math.max(1,viewportHeight);
  const units=camera.isOrthographicCamera
    ?(Math.abs((camera.top??1)-(camera.bottom??-1))/Math.max(.01,camera.zoom??1))/height
    :2*Math.max(1,distance)*Math.tan((Math.max(1,camera.fov??60)*Math.PI/180)/2)/height;
  return Math.min(128,Math.max(.05,units*px));
}
