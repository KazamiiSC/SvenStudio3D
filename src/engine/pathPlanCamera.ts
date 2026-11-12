/** Camera math for the path editor's XY view. World units are GoldSrc units. */
export type PlanCamera={centerX:number;centerY:number;spanY:number};
export type PlanSize={width:number;height:number};
export type PlanPoint=[number,number];
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
export const PLAN_MIN_SPAN=32;
export const PLAN_MAX_SPAN=65536;
export function planViewBox(camera:PlanCamera,size:PlanSize){
  const aspect=Math.max(0.1,size.width)/Math.max(1,size.height);
  const width=camera.spanY*aspect;
  return {x:camera.centerX-width/2,y:camera.centerY-camera.spanY/2,width,height:camera.spanY};
}
export function planScreenToWorld(camera:PlanCamera,size:PlanSize,screenX:number,screenY:number):PlanPoint{
  const box=planViewBox(camera,size);
  return [box.x+screenX/Math.max(1,size.width)*box.width,box.y+screenY/Math.max(1,size.height)*box.height];
}
export function planZoomAt(camera:PlanCamera,size:PlanSize,screenX:number,screenY:number,factor:number):PlanCamera{
  const anchor=planScreenToWorld(camera,size,screenX,screenY);
  const spanY=clamp(camera.spanY*factor,PLAN_MIN_SPAN,PLAN_MAX_SPAN);
  const next={...camera,spanY};
  const shifted=planScreenToWorld(next,size,screenX,screenY);
  return {...next,centerX:camera.centerX+anchor[0]-shifted[0],centerY:camera.centerY+anchor[1]-shifted[1]};
}
export function planPanFromDrag(camera:PlanCamera,size:PlanSize,dx:number,dy:number):PlanCamera{
  const box=planViewBox(camera,size);
  return {...camera,centerX:camera.centerX-dx/Math.max(1,size.width)*box.width,centerY:camera.centerY-dy/Math.max(1,size.height)*box.height};
}
export function planFitPoints(points:readonly PlanPoint[],radius:number,size:PlanSize):PlanCamera{
  if(!points.length)return {centerX:0,centerY:0,spanY:512};
  const minX=Math.min(...points.map(p=>p[0]))-radius,maxX=Math.max(...points.map(p=>p[0]))+radius;
  const minY=Math.min(...points.map(p=>p[1]))-radius,maxY=Math.max(...points.map(p=>p[1]))+radius;
  const aspect=Math.max(0.1,size.width)/Math.max(1,size.height);
  // 18% breathing room, with a generous minimum for short routes.
  const spanY=clamp(Math.max(64,(maxY-minY)*1.18,(maxX-minX)*1.18/aspect),PLAN_MIN_SPAN,PLAN_MAX_SPAN);
  return {centerX:(minX+maxX)/2,centerY:(minY+maxY)/2,spanY};
}
