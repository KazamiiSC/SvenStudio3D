/** Editor-only screen-space label budgets. No map objects or keyvalues are mutated. */
export type MapLabelMode='optimized'|'classic';
export type MapLabelSettings={mode:MapLabelMode;maxLabels:number;distance:number;avoidOverlap:boolean;diagnostics:boolean;lightweight:boolean};
export const DEFAULT_MAP_LABEL_SETTINGS:MapLabelSettings={mode:'optimized',maxLabels:48,distance:2400,avoidOverlap:true,diagnostics:false,lightweight:true};
const STORAGE_KEY='svenstudio-map-label-settings-v1';
export function normalizeMapLabelSettings(value:Partial<MapLabelSettings>={}):MapLabelSettings{
 const base=DEFAULT_MAP_LABEL_SETTINGS;
 const finite=(value:number|undefined,min:number,max:number,fallback:number)=>typeof value==='number'&&Number.isFinite(value)?Math.max(min,Math.min(max,Math.round(value))):fallback;
 return {mode:value.mode==='classic'?'classic':'optimized',maxLabels:finite(value.maxLabels,8,240,base.maxLabels),
  distance:finite(value.distance,200,16000,base.distance),avoidOverlap:typeof value.avoidOverlap==='boolean'?value.avoidOverlap:base.avoidOverlap,
  diagnostics:typeof value.diagnostics==='boolean'?value.diagnostics:base.diagnostics,
  lightweight:typeof value.lightweight==='boolean'?value.lightweight:base.lightweight};
}
export function loadMapLabelSettings():MapLabelSettings{
 try{return normalizeMapLabelSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'))}catch{return {...DEFAULT_MAP_LABEL_SETTINGS}}
}
export function saveMapLabelSettings(value:MapLabelSettings):void{
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(normalizeMapLabelSettings(value)))}catch{/* storage may be unavailable */}
}
/** Whether an expensive full MAP label layout pass is needed.
 * Dirty data/config updates refresh immediately; ordinary camera/pointer
 * movement is frame-budgeted; idle scenes never poll for redundant layouts.
 */
export function mapLabelRefreshDue(dirty:boolean,cameraMoved:boolean,pointerMoved:boolean,secondsSinceLast:number,hasRun:boolean,labelCount:number):boolean{
 if(!dirty&&!cameraMoved&&!pointerMoved)return false;
 if(dirty||!hasRun)return true;
 const hz=labelCount>400?18:30;
 return secondsSinceLast>=1/hz;
}
export type MapLabelScreenCandidate={id:string;x:number;y:number;width:number;height:number;distanceSquared:number;
 priority:number;selected:boolean;spawn:boolean};
export type MapLabelLayout={ids:string[];inView:number};
/** Deterministic overlap rejection with a small screen-space grid, O(n log n + n*k).
 * Selected labels bypass distance/limit/collision, but must be in front of the camera.
 * Inputs are already projected/frustum-filtered; only visible labels create DOM.
 */
export function layoutMapLabels(candidates:readonly MapLabelScreenCandidate[],options:{width:number;height:number;limit:number;avoidOverlap:boolean;padding?:number}):MapLabelLayout{
 const {width,height}=options;
 if(width<=0||height<=0)return {ids:[],inView:0};
 const limit=Math.max(8,Math.min(240,Math.floor(options.limit)));
 const gap=Math.max(0,Math.min(20,options.padding??6));
 const ordered=candidates.filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.y)&&c.x>=-c.width/2&&c.x<=width+c.width/2&&c.y>=-c.height/2&&c.y<=height+c.height/2)
  .sort((a,b)=>Number(b.selected)-Number(a.selected)||b.priority-a.priority||a.distanceSquared-b.distanceSquared||a.id.localeCompare(b.id));
 const result:string[]=[];
 const cells=new Map<string,number[]>();
 const boxes:Array<{left:number;right:number;top:number;bottom:number}>=[];
 const cellSize=96;
 let normal=0;
 for(const c of ordered){
  if(!c.selected&&normal>=limit)continue;
  const box={left:c.x-c.width/2-gap,right:c.x+c.width/2+gap,top:c.y-c.height/2-gap,bottom:c.y+c.height/2+gap};
  const x0=Math.floor(box.left/cellSize),x1=Math.floor(box.right/cellSize),y0=Math.floor(box.top/cellSize),y1=Math.floor(box.bottom/cellSize);
  let collision=false;
  if(options.avoidOverlap&&!c.selected){
   collisionCheck:for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
    for(const n of cells.get(`${x}:${y}`)||[]){const prev=boxes[n];if(box.left<prev.right&&box.right>prev.left&&box.top<prev.bottom&&box.bottom>prev.top){collision=true;break collisionCheck}}
   }
  }
  if(collision)continue;
  const n=boxes.length;boxes.push(box);result.push(c.id);
  if(!c.selected)normal++;
  for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++){
   const key=`${x}:${y}`,bucket=cells.get(key);
   if(bucket)bucket.push(n);else cells.set(key,[n]);
  }
 }
 return {ids:result,inView:ordered.length};
}
/** Priority is only used for label visibility; the underlying entity remains selectable. */
export function mapLabelPriority(classname:string,targetname:string|undefined,spawn:boolean,hovered:boolean){
 if(hovered)return 400;
 if(spawn)return 250;
 if(targetname?.trim())return 120;
 if(/^(monster_|npc_|path_|info_target|trigger_|func_door)/i.test(classname))return 70;
 return 10;
}
