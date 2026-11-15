/** HF16 Seamless UV: non-destructive, edge-connected Valve 220 texture alignment.
 * Only explicitly selected faces can be modified. A world-space shared edge
 * is required; touching corners or nearby but separated surfaces are excluded.
 * The texture basis is rotated around that common edge between face planes,
 * which preserves texel coordinates along the entire seam (including corners).
 */
import type {Brush,Face,Vec3} from './types';
import {brushWorldVertices,faceTextureAxes,isTextureFaceRef,sanitizeTexturePatch,type TextureFacePatch,type TextureFaceRef} from './textureStudio.ts';
import {textureBasisQuality} from './textureAxisSafety.ts';

const EPS=.03, LIMIT=300;
const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const add=(a:Vec3,b:Vec3):Vec3=>[a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const mul=(a:Vec3,s:number):Vec3=>[a[0]*s,a[1]*s,a[2]*s];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const length=(a:Vec3)=>Math.hypot(...a);
const unit=(a:Vec3):Vec3=>mul(a,1/length(a));
const finite=(a:Vec3)=>a.every(Number.isFinite);
const rotateAround=(v:Vec3,axis:Vec3,theta:number):Vec3=>{
  const c=Math.cos(theta),s=Math.sin(theta);
  return add(add(mul(v,c),mul(cross(axis,v),s)),mul(axis,dot(axis,v)*(1-c)));
};
const key=(r:TextureFaceRef)=>`${r.id}:${r.face}`;

type PreparedFace={ref:TextureFaceRef;brush:Brush;face:Face;vertices:Vec3[];edges:[Vec3,Vec3][];normal:Vec3;bounds:[Vec3,Vec3]};
export type SeamlessUvChange={ref:TextureFaceRef;from:TextureFaceRef;patch:TextureFacePatch;edge:[Vec3,Vec3];maxSeamError:number;beforeSeamError:number};
export type SeamlessUvPlan={anchor:TextureFaceRef|null;selectedCount:number;changes:SeamlessUvChange[];unreachable:TextureFaceRef[];alreadyAligned:number;reason?:string};
export type SeamlessUvOptions={copyTexture:boolean};
/** Return the genuinely overlapping collinear segment, not just the nearest vertex.
 * Handles brushes of different lengths sharing only part of a border. */
export function sharedFaceEdge(a:readonly [Vec3,Vec3][],b:readonly [Vec3,Vec3][]):[Vec3,Vec3]|null{
  let best:[Vec3,Vec3]|null=null,bestLength=0;
  for(const [p,q] of a){
    const direction=sub(q,p),len=length(direction);
    if(!Number.isFinite(len)||len<.25)continue;
    const axis=mul(direction,1/len);
    for(const [r,s] of b){
      const delta=sub(s,r),otherLen=length(delta);
      if(!Number.isFinite(otherLen)||otherLen<.25||length(cross(axis,mul(delta,1/otherLen)))>.002)continue;
      if(length(cross(sub(r,p),axis))>EPS||length(cross(sub(s,p),axis))>EPS)continue;
      const t1=dot(sub(r,p),axis),t2=dot(sub(s,p),axis);
      const low=Math.max(0,Math.min(t1,t2)),high=Math.min(len,Math.max(t1,t2));
      if(high-low<=.25||high-low<=bestLength)continue;
      bestLength=high-low;best=[add(p,mul(axis,low)),add(p,mul(axis,high))];
    }
  }
  return best;
}
function prepare(brush:Brush,faceIndex:number):PreparedFace|null{
  const face=brush.faces[faceIndex];if(!face||face.indices.length<3)return null;
  const vertices=brushWorldVertices(brush);
  if(vertices.some(p=>!finite(p)))return null;
  const points=face.indices.map(i=>vertices[i]);
  if(points.some(p=>!p||!finite(p)))return null;
  const n=cross(sub(points[1],points[0]),sub(points[2],points[0]));
  if(length(n)<1e-6)return null;
  const edges=points.map((p,i)=>[p,points[(i+1)%points.length]] as [Vec3,Vec3]);
  const min:Vec3=[0,1,2].map(i=>Math.min(...points.map(p=>p[i]))) as Vec3;
  const max:Vec3=[0,1,2].map(i=>Math.max(...points.map(p=>p[i]))) as Vec3;
  return {ref:{id:brush.id,face:faceIndex},brush,face,vertices,edges,normal:unit(n),bounds:[min,max]};
}
function alignedPatch(source:PreparedFace,sourcePatch:TextureFacePatch|undefined,target:PreparedFace,edge:[Vec3,Vec3],copyTexture:boolean):{patch:TextureFacePatch;error:number}|null{
  const srcFace={...source.face,...sourcePatch};
  const {u,v}=faceTextureAxes(source.vertices,srcFace);
  const edgeDir=unit(sub(edge[1],edge[0]));
  const cos=Math.max(-1,Math.min(1,dot(source.normal,target.normal)));
  // Opposite facing coplanar surfaces have ambiguous wrap direction.
  if(cos<-.985)return null;
  const theta=Math.atan2(dot(edgeDir,cross(source.normal,target.normal)),cos);
  const outU=rotateAround(u,edgeDir,theta),outV=rotateAround(v,edgeDir,theta);
  if(textureBasisQuality(target.normal,outU,outV)<.20||!finite(outU)||!finite(outV))return null;
  const su=srcFace.uScale??1,sv=srcFace.vScale??1;
  if(![su,sv].every(v=>Number.isFinite(v)&&Math.abs(v)>=.005))return null;
  const anchor=edge[0];
  const uShift=(srcFace.uShift??0)+dot(anchor,u)/su-dot(anchor,outU)/su;
  const vShift=(srcFace.vShift??0)+dot(anchor,v)/sv-dot(anchor,outV)/sv;
  const patch=sanitizeTexturePatch({
    ...(copyTexture?{texture:srcFace.texture}:{}),
    uAxis:outU,vAxis:outV,rotation:0,uScale:su,vScale:sv,uShift,vShift
  });
  // Numerical seam check at BOTH endpoints (offset-only match is insufficient).
  const after={...target.face,...patch};
  const mapped=faceTextureAxes(target.vertices,after);
  let error=0;
  for(const point of edge){
    error=Math.max(error,
      Math.abs(dot(point,u)/su+(srcFace.uShift??0)-dot(point,mapped.u)/(after.uScale??1)-(after.uShift??0)),
      Math.abs(dot(point,v)/sv+(srcFace.vShift??0)-dot(point,mapped.v)/(after.vScale??1)-(after.vShift??0)));
  }
  if(!Number.isFinite(error)||error>.04)return null;
  return {patch,error};
}
function samePatch(face:Face,patch:TextureFacePatch):boolean{
  const eps=1e-6;
  if(patch.texture!==undefined&&patch.texture!==face.texture)return false;
  if(Math.abs((patch.uShift??0)-(face.uShift??0))>eps||Math.abs((patch.vShift??0)-(face.vShift??0))>eps)return false;
  if(Math.abs((patch.uScale??1)-(face.uScale??1))>eps||Math.abs((patch.vScale??1)-(face.vScale??1))>eps||Math.abs((patch.rotation??0)-(face.rotation??0))>eps)return false;
  // Missing explicit UV axes differ from a patch that supplies them.
  return (['uAxis','vAxis'] as const).every(axis=>!!face[axis]&&patch[axis]?.every((v,i)=>Math.abs(v-face[axis]![i])<=eps));
}
export function planSeamlessUV(objects:readonly {id:string;kind:string;faces?:readonly Face[];locked?:boolean;hidden?:boolean}[],selected:readonly TextureFaceRef[],options:SeamlessUvOptions={copyTexture:false}):SeamlessUvPlan{
  const empty:SeamlessUvPlan={anchor:null,selectedCount:0,changes:[],unreachable:[],alreadyAligned:0};
  const dedup=[...new Map(selected.map(ref=>[key(ref),ref])).values()];
  if(dedup.length>LIMIT)return {...empty,reason:`Select at most ${LIMIT} faces for one operation.`};
  const brushes=objects.filter((o):o is Brush=>o.kind==='brush') as Brush[];
  const byId=new Map(brushes.map(b=>[b.id,b]));
  const faces=dedup.filter(ref=>isTextureFaceRef(ref,objects)).map(ref=>{
    const b=byId.get(ref.id);return b?prepare(b,ref.face):null;
  }).filter((f):f is PreparedFace=>!!f);
  if(faces.length<2)return {...empty,anchor:faces[0]?.ref??null,selectedCount:faces.length,reason:'Select at least two valid, unlocked faces.'};
  const changes:SeamlessUvChange[]=[],visited=new Set([key(faces[0].ref)]),queued:[PreparedFace,TextureFacePatch|undefined][]=[[faces[0],undefined]];
  let alreadyAligned=0;
  // Breadth-first traversal uses each accepted, newly aligned face as the
  // reference for the next connected surface, so corners can be chained.
  while(queued.length){
    const [src,srcPatch]=queued.shift()!;
    for(const dest of faces){
      const destKey=key(dest.ref);if(visited.has(destKey))continue;
      if(!options.copyTexture&&dest.face.texture.toUpperCase()!==faces[0].face.texture.toUpperCase())continue;
      if([0,1,2].some(i=>src.bounds[0][i]>dest.bounds[1][i]+EPS||dest.bounds[0][i]>src.bounds[1][i]+EPS))continue;
      const edge=sharedFaceEdge(src.edges,dest.edges);if(!edge)continue;
      const alignment=alignedPatch(src,srcPatch,dest,edge,options.copyTexture);if(!alignment)continue;
      visited.add(destKey);
      queued.push([dest,alignment.patch]);
      if(samePatch(dest.face,alignment.patch))alreadyAligned++;
      else {
        const sourceFace={...src.face,...srcPatch};
        const su=faceTextureAxes(src.vertices,sourceFace),du=faceTextureAxes(dest.vertices,dest.face);
        let before=0;
        for(const point of edge){
          before=Math.max(before,
            Math.abs(dot(point,su.u)/(sourceFace.uScale??1)+(sourceFace.uShift??0)-dot(point,du.u)/(dest.face.uScale??1)-(dest.face.uShift??0)),
            Math.abs(dot(point,su.v)/(sourceFace.vScale??1)+(sourceFace.vShift??0)-dot(point,du.v)/(dest.face.vScale??1)-(dest.face.vShift??0)));
        }
        changes.push({ref:dest.ref,from:src.ref,patch:alignment.patch,edge,maxSeamError:alignment.error,beforeSeamError:before});
      }
    }
  }
  return {anchor:faces[0].ref,selectedCount:faces.length,changes,unreachable:faces.filter(f=>!visited.has(key(f.ref))).map(f=>f.ref),alreadyAligned};
}
