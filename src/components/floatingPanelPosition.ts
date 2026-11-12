/** UI viewport coordinates only; never map coordinates or camera state. */
export function clampFloatingPanelPosition(position:{x:number;y:number},viewport:{width:number;height:number},panelWidth:number){
 const x=Number.isFinite(position.x)?position.x:8;
 const y=Number.isFinite(position.y)?position.y:8;
 return {x:Math.max(8,Math.min(x,viewport.width-Math.min(panelWidth,viewport.width-16)-8)),
   y:Math.max(8,Math.min(y,viewport.height-220))};
}
