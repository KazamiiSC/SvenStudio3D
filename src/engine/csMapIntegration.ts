/** HF32: read-only CS 1.6 inventory and selection helpers.
 * Uses editor-native object IDs; never changes MAP entity keyvalues or geometry.
 */
import type {Brush,MapObject,PointEntity,Vec3} from './types';
import {transformedVertices} from './geometry';

export type CS16ObjectGroup='ct'|'t'|'bomb'|'buy'|'rescue'|'hostage'|'weapon';
export type CS16InventoryItem={
 id:string;classname:string;group:CS16ObjectGroup;label:string;
 position:Vec3;brushIds:string[];hidden:boolean;locked:boolean;
};
const CS16_COLORS:Record<CS16ObjectGroup,string>={ct:'#45b6ff',t:'#ff796b',bomb:'#ffce65',buy:'#7db4ff',rescue:'#70e0a2',hostage:'#b6e383',weapon:'#d3a1ff'};
export function cs16ObjectGroup(entity:Pick<PointEntity,'classname'|'props'>):CS16ObjectGroup|null{
 switch(entity.classname.toLowerCase()){
  case 'info_player_start':return 'ct';
  case 'info_player_deathmatch':return 't';
  case 'func_bomb_target':case 'info_bomb_target':return 'bomb';
  case 'func_buyzone':return 'buy';
  case 'func_hostage_rescue':case 'info_hostage_rescue':return 'rescue';
  case 'hostage_entity':return 'hostage';
  case 'armoury_entity':return 'weapon';
  default:return null;
 }
}
export function cs16MarkerTint(entity:Pick<PointEntity,'classname'|'props'>):string|null{
 const group=cs16ObjectGroup(entity);
 if(!group)return null;
 if(group==='buy')return entity.props.team==='1'?'#ff796b':entity.props.team==='2'?'#45b6ff':CS16_COLORS.buy;
 return CS16_COLORS[group];
}
export function cs16Inventory(objects:readonly MapObject[]):CS16InventoryItem[]{
 const brushes=new Map<string,Brush[]>();
 for(const o of objects)if(o.kind==='brush'&&o.entityId){
  if(!brushes.has(o.entityId))brushes.set(o.entityId,[]);
  brushes.get(o.entityId)!.push(o);
 }
 const items:CS16InventoryItem[]=[];
 for(const o of objects){
  if(o.kind!=='entity')continue;
  const group=cs16ObjectGroup(o);if(!group)continue;
  const linked=brushes.get(o.id)||[];
  const explicit=o.name.trim()&&o.name.trim()!==o.classname?o.name.trim():null;
  const label=explicit||((group==='buy'&&o.props.team==='1')?'T Buyzone':(group==='buy'&&o.props.team==='2')?'CT Buyzone':o.classname);
  items.push({id:o.id,classname:o.classname,group,label,position:[...o.position],brushIds:linked.map(b=>b.id),
   hidden:!!o.hidden||linked.some(b=>b.hidden),locked:!!o.locked||linked.some(b=>b.locked)});
 }
 return items;
}
/** A native MAP brush zone is a single editable unit: select its entity and every linked brush.
 * Other entities keep one selected ID. Hidden/locked objects are intentionally skipped.
 */
export function cs16SelectionIds(items:readonly CS16InventoryItem[],group:CS16ObjectGroup|'all'|'single',id?:string):string[]{
 const selected=group==='single'?items.filter(item=>item.id===id):items.filter(item=>group==='all'||item.group===group);
 const ids=new Set<string>();
 for(const item of selected)if(!item.hidden&&!item.locked){ids.add(item.id);for(const brushId of item.brushIds)ids.add(brushId)}
 return [...ids];
}
export function cs16ItemSelected(item:CS16InventoryItem,selectedIds:readonly string[]):boolean{
 return selectedIds.includes(item.id)||item.brushIds.some(id=>selectedIds.includes(id));
}
export type CS16AdvancedWarning={code:'SPAWN_INSIDE_BRUSH'|'ZONE_NO_BRUSH'|'ZONE_BRUSH_HIDDEN';entityId:string;position:Vec3};
/** Conservative AABB test restricted to axis-aligned solid world brushes.
 * No claims about compiled collision hulls, or visibility/navigation.
 */
export function inspectCS16Advanced(objects:readonly MapObject[]):CS16AdvancedWarning[]{
 const entities=objects.filter((o):o is PointEntity=>o.kind==='entity');
 const linkedIds=new Set(objects.filter((o):o is Brush=>o.kind==='brush'&&!!o.entityId).map(b=>b.entityId!));
 const warnings:CS16AdvancedWarning[]=[];
 const staticBrushes=objects.filter((o):o is Brush=>o.kind==='brush'&&!o.entityId&&!o.hidden&&!o.rotation.some(r=>Math.abs(r)>0.001)
   &&o.faces.every(f=>!/^(!|sky|aaatrigger|origin|clip|null)/i.test(f.texture||'')));
 const solidBounds=staticBrushes.map(brush=>{
  const verts=transformedVertices(brush);return {
   min:([0,1,2] as const).map(axis=>Math.min(...verts.map(v=>v[axis]))) as Vec3,
   max:([0,1,2] as const).map(axis=>Math.max(...verts.map(v=>v[axis]))) as Vec3
  };
 });
 for(const entity of entities){
  if(entity.hidden)continue;
  const group=cs16ObjectGroup(entity);
  if((entity.classname==='func_bomb_target'||entity.classname==='func_buyzone'||entity.classname==='func_hostage_rescue')&&!linkedIds.has(entity.id)){
   warnings.push({code:'ZONE_NO_BRUSH',entityId:entity.id,position:[...entity.position]});
  }
  if(group!=='ct'&&group!=='t')continue;
  // Player origin is above the floor; only warn if it lies deep inside a solid AABB.
  const p=entity.position;
  if(solidBounds.some(b=>p.every((v,i)=>v>b.min[i]+8&&v<b.max[i]-8)))
   warnings.push({code:'SPAWN_INSIDE_BRUSH',entityId:entity.id,position:[...p]});
 }
 return warnings;
}
