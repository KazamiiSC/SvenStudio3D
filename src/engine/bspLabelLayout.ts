/** Frame-local screen-space placement for BSP entity labels. No scene mutation. */
export type BspLabelCandidate={index:number;x:number;y:number;width:number;height:number;distance:number;priority:number;selected?:boolean};
export type BspLabelOptions={width:number;height:number;limit:number;smart:boolean;padding?:number};
type Rect={left:number;top:number;right:number;bottom:number};
/** Selected labels and important entities have priority; smart mode rejects overlap. */
export function layoutBspLabels(input:readonly BspLabelCandidate[],options:BspLabelOptions):number[]{
  const {width,height,smart}=options;
  if(width<=0||height<=0)return [];
  const limit=Math.max(1,Math.min(100,Math.floor(options.limit)));
  const margin=Math.max(0,Math.min(16,options.padding??5));
  const ordered=input.filter(item=>Number.isFinite(item.x)&&Number.isFinite(item.y)&&item.x>=-20&&item.x<=width+20&&item.y>=-20&&item.y<=height+20)
    .sort((a,b)=>Number(!!b.selected)-Number(!!a.selected)||b.priority-a.priority||a.distance-b.distance||a.index-b.index);
  const result:number[]=[],rects:Rect[]=[];
  for(const item of ordered){
    if(result.length>=limit)break;
    const half=Math.max(6,item.width/2),halfH=Math.max(5,item.height/2);
    const rect={left:item.x-half-margin,right:item.x+half+margin,top:item.y-halfH-margin,bottom:item.y+halfH+margin};
    if(smart&&!item.selected&&rects.some(prev=>rect.left<prev.right&&rect.right>prev.left&&rect.top<prev.bottom&&rect.bottom>prev.top))continue;
    result.push(item.index);rects.push(rect);
  }
  return result;
}
/** Higher numbers first, preserving the selected label above every other entity. */
export function bspLabelPriority(classname:string,targetname:string|undefined,selected:boolean){
  if(selected)return 1000;
  if(/^(info_player_|info_teleport_destination)/i.test(classname))return 130;
  if(targetname?.trim())return 60;
  if(/^(monster_|npc_|func_door|trigger_)/i.test(classname))return 30;
  return 0;
}
