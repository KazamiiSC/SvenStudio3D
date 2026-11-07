/** Screen-space placement for a compact UV manipulator. No UV or MAP data is modified. */
export type ScreenPoint={x:number;y:number};
export function compactUvAnchor(points:ReadonlyArray<ScreenPoint>,width:number,height:number,margin=86):ScreenPoint|null{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||!points.length)return null;
  const valid=points.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));
  if(!valid.length)return null;
  const minX=Math.min(...valid.map(p=>p.x)),maxX=Math.max(...valid.map(p=>p.x));
  const minY=Math.min(...valid.map(p=>p.y)),maxY=Math.max(...valid.map(p=>p.y));
  const left=Math.max(0,minX),right=Math.min(width,maxX),top=Math.max(0,minY),bottom=Math.min(height,maxY);
  if(right<left||bottom<top)return null; // No part of the face is on screen.
  const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
  const mx=Math.min(Math.max(0,margin),width/2),my=Math.min(Math.max(0,margin),height/2);
  return {x:clamp((left+right)/2,mx,width-mx),y:clamp((top+bottom)/2,my,height-my)};
}

/** Pin an UV handle to the clicked screen point, independently of camera zoom.
 * Browser client coordinates must be scaled to R3F's canvas-relative units. */
export function pinUvAnchor(
  click:ScreenPoint,
  canvas:{left:number;top:number;width:number;height:number},
  width:number,height:number,margin=86
):ScreenPoint|null{
  if(!Number.isFinite(click.x)||!Number.isFinite(click.y)||
     !Number.isFinite(canvas.left)||!Number.isFinite(canvas.top)||
     canvas.width<=0||canvas.height<=0||width<=0||height<=0)return null;
  const mx=Math.min(margin,width/2),my=Math.min(margin,height/2);
  const clamp=(value:number,min:number,max:number)=>Math.min(max,Math.max(min,value));
  return {
    x:clamp((click.x-canvas.left)*width/canvas.width,mx,width-mx),
    y:clamp((click.y-canvas.top)*height/canvas.height,my,height-my)
  };
}

/** Constrain a 120px screen-space UV palette (including its drag tab) to the viewport.
 * No camera, world-space vertices, or brush geometry participate in this value. */
export function clampUvWidgetPosition(point:ScreenPoint,width:number,height:number):ScreenPoint{
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return {x:0,y:0};
  const safe=(n:number,fallback:number)=>Number.isFinite(n)?n:fallback;
  const left=Math.min(70,width/2),right=Math.max(left,width-70);
  const top=Math.min(85,height/2),bottom=Math.max(top,height-105);
  const clamp=(n:number,min:number,max:number)=>Math.min(max,Math.max(min,n));
  return {x:clamp(safe(point.x,width/2),left,right),y:clamp(safe(point.y,height/2),top,bottom)};
}
