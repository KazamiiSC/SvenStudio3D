/** v1.5.21 — CSS layout pixels only. Never use display DPI as a layout input. */
export type HeaderDensity='wide'|'compact'|'tight'|'minimal';
export function headerDensity(width:number):HeaderDensity {
  if(!Number.isFinite(width)||width<=0)return 'wide';
  return width<1060?'minimal':width<1450?'tight':width<1740?'compact':'wide';
}
/** Clamp the rendered widget without changing persisted percentage coordinates. */
export function clampHudPosition(x:number,y:number,containerWidth:number,containerHeight:number,widgetWidth:number,widgetHeight:number){
  const safe=(n:number)=>Number.isFinite(n)?Math.max(0,n):0;
  const width=safe(containerWidth),height=safe(containerHeight);
  const maxX=Math.max(0,width-safe(widgetWidth)-4),maxY=Math.max(0,height-safe(widgetHeight)-4);
  const rawX=width*safe(x)/100,rawY=height*safe(y)/100;
  return {x:Math.min(rawX,maxX),y:Math.min(rawY,maxY)};
}
