/** Lightweight, pure drawing geometry for Gameplay Studio's schematic view.
 * This module DOES NOT change brush geometry or any game keyvalue.
 */
import type {Brush,MapObject,PointEntity,Vec3} from './types';
export type MapProjection='top'|'iso';
export type Point2=readonly [number,number];
export type MapOutline={id:string;zMin:number;zMax:number;polygon:Point2[];bounds:{minX:number;maxX:number;minY:number;maxY:number}};
export type ScreenMarker={id:string;x:number;y:number;z:number};
export type MarkerGroup={id:string;x:number;y:number;members:string[]};

const EPS=1e-7;
export const projectMapPoint=(p:readonly number[],mode:MapProjection):[number,number]=>mode==='top'?[p[0],-p[1]]:[(p[0]-p[1])*.8660254038,-(p[0]+p[1])*.5-p[2]*.7];

/** Exactly matches brushWorldVertices' Euler XYZ transform, but without Three.js in the drawing hot path. */
export function gameplayBrushVertices(b:Brush):Vec3[]{
 const [a,c,d]=b.rotation.map(v=>v*Math.PI/180),ca=Math.cos(a),sa=Math.sin(a),cc=Math.cos(c),sc=Math.sin(c),cd=Math.cos(d),sd=Math.sin(d);
 return b.vertices.map(v=>{
  const [x,y,z]=v.map((n,i)=>n*b.scale[i]);
  return [b.position[0]+cc*cd*x-cc*sd*y+sc*z,
   b.position[1]+(ca*sd+sa*sc*cd)*x+(ca*cd-sa*sc*sd)*y-sa*cc*z,
   b.position[2]+(sa*sd-ca*sc*cd)*x+(sa*cd+ca*sc*sd)*y+ca*cc*z];
 });
}

/** Monotonic chain hull. Input is never mutated; duplicate vertices and tiny triangles are safe. */
export function mapConvexHull(points:readonly Point2[]):Point2[]{
 const sorted=points.filter(p=>Number.isFinite(p[0])&&Number.isFinite(p[1])).map(p=>[p[0],p[1]] as Point2)
  .sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
 const unique=sorted.filter((p,i)=>i===0||Math.abs(p[0]-sorted[i-1][0])>EPS||Math.abs(p[1]-sorted[i-1][1])>EPS);
 if(unique.length<=2)return unique;
 const cross=(a:Point2,b:Point2,c:Point2)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const lower:Point2[]=[],upper:Point2[]=[];
 for(const p of unique){while(lower.length>1&&cross(lower[lower.length-2],lower[lower.length-1],p)<=EPS)lower.pop();lower.push(p)}
 for(let i=unique.length-1;i>=0;i--){const p=unique[i];while(upper.length>1&&cross(upper[upper.length-2],upper[upper.length-1],p)<=EPS)upper.pop();upper.push(p)}
 lower.pop();upper.pop();return [...lower,...upper];
}

export function brushMapOutline(b:Brush,mode:MapProjection):MapOutline|null{
 if(b.hidden||!b.vertices.length)return null;
 const verts=gameplayBrushVertices(b);
 const zMin=Math.min(...verts.map(v=>v[2])),zMax=Math.max(...verts.map(v=>v[2]));
 // A top-down plan uses the true XY footprint, not axis-aligned bounds drawn as if rotated.
 // An ISO plan uses the silhouette of all projected 3D vertices, not a fake diamond.
 const polygon=mapConvexHull(verts.map(p=>projectMapPoint(p,mode)));
 if(polygon.length<2)return null;
 return {id:b.id,zMin,zMax,polygon,bounds:{minX:Math.min(...polygon.map(p=>p[0])),maxX:Math.max(...polygon.map(p=>p[0])),minY:Math.min(...polygon.map(p=>p[1])),maxY:Math.max(...polygon.map(p=>p[1]))}};
}
export function gameplayOutlineBounds(outlines:readonly MapOutline[],entities:readonly PointEntity[],mode:MapProjection){
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const o of outlines){minX=Math.min(minX,o.bounds.minX);maxX=Math.max(maxX,o.bounds.maxX);minY=Math.min(minY,o.bounds.minY);maxY=Math.max(maxY,o.bounds.maxY)}
 for(const e of entities){const [x,y]=projectMapPoint(e.position,mode);minX=Math.min(minX,x-24);maxX=Math.max(maxX,x+24);minY=Math.min(minY,y-24);maxY=Math.max(maxY,y+24)}
 return Number.isFinite(minX)?{minX,maxX,minY,maxY}:{minX:-300,maxX:300,minY:-250,maxY:250};
}

/** Group points by screen position, independent of world Z (top view) or source order.
 * This prevents invisible stacked markers and keeps hit-testing O(n).
 */
export function groupMapMarkers(markers:readonly ScreenMarker[],radius=15):MarkerGroup[]{
 const size=radius*2,grid=new Map<string,number[]>(),groups:MarkerGroup[]=[];
 const ordered=[...markers].sort((a,b)=>a.id.localeCompare(b.id));
 for(const m of ordered){const gx=Math.floor(m.x/size),gy=Math.floor(m.y/size);let nearest=-1,dist=radius*radius;
  for(let x=gx-1;x<=gx+1;x++)for(let y=gy-1;y<=gy+1;y++)for(const i of grid.get(`${x}:${y}`)||[]){const g=groups[i],d=(g.x-m.x)**2+(g.y-m.y)**2;if(d<=dist){dist=d;nearest=i}}
  if(nearest>=0){groups[nearest].members.push(m.id);continue}
  const index=groups.length;groups.push({id:m.id,x:m.x,y:m.y,members:[m.id]});const key=`${gx}:${gy}`;
  grid.set(key,[...(grid.get(key)||[]),index]);
 }
 return groups;
}

/** Preserve map-unit coordinates; only the raster projection is allowed to change with zoom. */
export function mapWorldToScreen(point:Point2,view:{cx:number;cy:number;scale:number},width:number,height:number):[number,number]{
 return [(point[0]-view.cx)*view.scale+width/2,(point[1]-view.cy)*view.scale+height/2];
}
export function mapScreenToWorld(point:Point2,view:{cx:number;cy:number;scale:number},width:number,height:number):[number,number]{
 return [(point[0]-width/2)/view.scale+view.cx,(point[1]-height/2)/view.scale+view.cy];
}
export function mapZoomAt(view:{cx:number;cy:number;scale:number},factor:number,point:Point2,width:number,height:number){
 const world=mapScreenToWorld(point,view,width,height),scale=Math.min(16,Math.max(.02,view.scale*factor));
 return {cx:world[0]-(point[0]-width/2)/scale,cy:world[1]-(point[1]-height/2)/scale,scale};
}
/** A contained height slice is a presentation filter, not a change to project objects. */
export function inHeightSlice(z:number,center:number,halfRange:number):boolean{return Math.abs(z-center)<=halfRange;}
export function brushIntersectsHeight(outline:MapOutline,center:number,halfRange:number){return outline.zMax>=center-halfRange&&outline.zMin<=center+halfRange;}
export function getGameplayMapBrushes(objects:readonly MapObject[]):Brush[]{return objects.filter((o):o is Brush=>o.kind==='brush'&&!o.hidden)};
