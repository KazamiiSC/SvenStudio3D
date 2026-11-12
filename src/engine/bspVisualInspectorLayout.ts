/** Pure UI layout helpers for the visual BSP entity browser/inspector. */
export type BspEntityCategory = 'all'|'npc'|'items'|'weapons'|'triggers'|'logic'|'environment'|'geometry'|'other';
export type FloatingBspPosition={x:number;y:number};
export const BSP_FLOAT_WIDTH=374;
export const BSP_FLOAT_HEIGHT=490;
export type FloatingBspSize={width:number;height:number};
export const BSP_FLOAT_MIN_WIDTH=300;
export const BSP_FLOAT_MIN_HEIGHT=230;
/** Preserve the requested size, but never allow the visible window to overrun its container. */
export function clampBspFloatingSize(size:FloatingBspSize,containerWidth:number,containerHeight:number):FloatingBspSize{
  const availableWidth=Math.max(1,Math.floor(Number.isFinite(containerWidth)?containerWidth-12:1));
  const availableHeight=Math.max(1,Math.floor(Number.isFinite(containerHeight)?containerHeight-12:1));
  const clamp=(value:number,min:number,max:number)=>Math.round(Math.min(max,Math.max(Math.min(min,max),Number.isFinite(value)?value:min)));
  return {width:clamp(size.width,BSP_FLOAT_MIN_WIDTH,availableWidth),height:clamp(size.height,BSP_FLOAT_MIN_HEIGHT,availableHeight)};
}
/** Clamp using the current *resized* dimensions, rather than the historical fixed size. */
export function clampBspFloatingRect(position:FloatingBspPosition,size:FloatingBspSize,containerWidth:number,containerHeight:number):FloatingBspPosition{
  const actual=clampBspFloatingSize(size,containerWidth,containerHeight);
  const xMax=Math.max(4,containerWidth-actual.width-8),yMax=Math.max(4,containerHeight-actual.height-8);
  return {x:Math.round(Math.max(4,Math.min(Number.isFinite(position.x)?position.x:4,xMax))),y:Math.round(Math.max(4,Math.min(Number.isFinite(position.y)?position.y:4,yMax)))};
}
export function parseBspFloatingSize(raw:string|null):FloatingBspSize|null{
  if(!raw)return null;
  try{
    const data:unknown=JSON.parse(raw);
    if(!data||typeof data!=='object')return null;
    const size=data as Record<string,unknown>;
    if(typeof size.width!=='number'||typeof size.height!=='number'||!Number.isFinite(size.width)||!Number.isFinite(size.height)||size.width<100||size.height<100||size.width>3000||size.height>3000)return null;
    return {width:Math.round(size.width),height:Math.round(size.height)};
  }catch{return null}
}
export function bspEntityCategory(classname:string):Exclude<BspEntityCategory,'all'>{
  const name=classname.toLowerCase();
  if(name.startsWith('monster_')||name==='squadmaker'||name.startsWith('npc_'))return 'npc';
  if(name.startsWith('item_')||name.startsWith('ammo_'))return 'items';
  if(name.startsWith('weapon_'))return 'weapons';
  if(name.startsWith('trigger_'))return 'triggers';
  if(name.startsWith('light')||name.startsWith('env_')||name.startsWith('ambient_'))return 'environment';
  if(name.startsWith('func_'))return 'geometry';
  if(name.startsWith('game_')||name.startsWith('multi_')||name.startsWith('info_')||name.startsWith('path_')||name.startsWith('aiscripted_')||name.startsWith('scripted_'))return 'logic';
  return 'other';
}
export function clampBspFloatingPosition(pos:FloatingBspPosition, width:number,height:number,panelWidth=BSP_FLOAT_WIDTH,panelHeight=BSP_FLOAT_HEIGHT):FloatingBspPosition{
  const w=Math.max(0,Number.isFinite(width)?width:0),h=Math.max(0,Number.isFinite(height)?height:0);
  const safe=(n:number)=>Number.isFinite(n)?n:0;
  return {x:Math.round(Math.max(4,Math.min(safe(pos.x),Math.max(4,w-panelWidth-8)))),y:Math.round(Math.max(4,Math.min(safe(pos.y),Math.max(4,h-Math.min(panelHeight,h*.72)-8))))};
}
export function bspFloatingNearClick(click:FloatingBspPosition,width:number,height:number,panelWidth=BSP_FLOAT_WIDTH):FloatingBspPosition{
  const x=click.x+35+panelWidth>width?click.x-panelWidth-24:click.x+35;
  return clampBspFloatingPosition({x,y:click.y-45},width,height,panelWidth);
}
export function parseBspFloatingPosition(raw:string|null):FloatingBspPosition|null{
  if(!raw)return null;
  try{
    const value:unknown=JSON.parse(raw);
    if(!value||typeof value!=='object')return null;
    const pos=value as Record<string,unknown>;
    if(typeof pos.x!=='number'||typeof pos.y!=='number'||!Number.isFinite(pos.x)||!Number.isFinite(pos.y)||Math.abs(pos.x)>100000||Math.abs(pos.y)>100000)return null;
    return {x:pos.x,y:pos.y};
  }catch{return null}
}
