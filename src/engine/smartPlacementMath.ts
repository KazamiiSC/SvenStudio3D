import type {Vec3} from './types';
export type PlacementAxis='x'|'y'|'z';
export type DrawPlane='xy'|'xz'|'yz';
export const normalizeAngle=(degrees:number)=>((degrees%360)+360)%360;
export function snappedFacing(normal:Vec3):number {
  const [x,y]=normal;
  if(Math.hypot(x,y)<.5)return 0;
  const raw=Math.atan2(y,x)*180/Math.PI-90;
  return Math.round(raw/90)*90;
}
export function rotatedPointZ(point:Vec3,angleDegrees:number):Vec3 {
  const r=angleDegrees*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  return [point[0]*c-point[1]*s,point[0]*s+point[1]*c,point[2]];
}
/** Anchor a rotated ghost just outside the face, with its vertical middle at the hit on walls. */
export function surfacePlacementAnchor(hit:Vec3,normal:Vec3,localPoints:Vec3[]):Vec3 {
  if(!localPoints.length)return [...hit];
  const range=(axis:0|1|2)=>[Math.min(...localPoints.map(v=>v[axis])),Math.max(...localPoints.map(v=>v[axis]))];
  if(Math.abs(normal[2])>=.5){
    const [lo,hi]=range(2);
    return [hit[0],hit[1],hit[2]-(normal[2]>0?lo:hi)+normal[2]*.5];
  }
  const projection=localPoints.map(p=>p[0]*normal[0]+p[1]*normal[1]);
  const min=Math.min(...projection),[lo,hi]=range(2);
  return [hit[0]+normal[0]*(.5-min),hit[1]+normal[1]*(.5-min),hit[2]-(lo+hi)/2];
}
export function axisDrawnBox(from:Vec3,to:Vec3,depth:number,axis:DrawPlane,step=1):{center:Vec3;size:Vec3}{
  const snap=(n:number)=>Math.round(n/Math.max(1,step))*Math.max(1,step);
  const a=from.map(snap) as Vec3,b=to.map(snap) as Vec3;
  const size=a.map((v,i)=>Math.max(Math.max(1,step),Math.abs(v-b[i]))) as Vec3;
  const center=a.map((v,i)=>(v+b[i])/2) as Vec3;
  const orthogonal=axis==='xy'?2:axis==='xz'?1:0;
  size[orthogonal]=depth;center[orthogonal]=a[orthogonal]+depth/2;
  return {center,size};
}
