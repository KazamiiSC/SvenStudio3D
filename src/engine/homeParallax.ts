/** Pure, bounded cursor motion shared by the landing screen and its tests. */
export type HomePoint = {x:number; y:number};
export type HomeBounds = {left:number; top:number; width:number; height:number};
const bound=(v:number)=>Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0;
/** Center of the welcome viewport is (0, 0); any edge is -1 / 1. */
export function normalizeHomePointer(clientX:number,clientY:number,rect:HomeBounds):HomePoint {
  if(!Number.isFinite(rect.width)||!Number.isFinite(rect.height)||rect.width<=0||rect.height<=0)return {x:0,y:0};
  return {x:bound(((clientX-rect.left)/rect.width-.5)*2),y:bound(((clientY-rect.top)/rect.height-.5)*2)};
}
/** Deterministic easing; returns a neutral point for invalid inputs. */
export function easeHomePointer(current:HomePoint,target:HomePoint,smoothing=0.14):HomePoint {
  const rate=Number.isFinite(smoothing)?Math.max(0,Math.min(1,smoothing)):0.14;
  return {x:bound(current.x+(target.x-current.x)*rate),y:bound(current.y+(target.y-current.y)*rate)};
}
