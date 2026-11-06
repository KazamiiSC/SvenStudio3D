/** Presentation-only graph helpers for Gameplay Studio.
 * Never edit GoldSrc properties here: target can mean an activation, a path,
 * a camera look-at reference, or another entity-specific relationship.
 */
import type {PointEntity} from './types';
import type {GameplayConnection} from './gameplay';
import {getConnections} from './gameplay';
import type {MapObject} from './types';
export type GraphPosition={x:number;y:number};
export type GraphCategory='all'|'logic'|'brush'|'ai'|'camera'|'audio'|'other';
export const GRAPH_NODE_WIDTH=218, GRAPH_NODE_HEIGHT=106;
export type GraphLink=GameplayConnection & {via:'target'|'moveto'|'killtarget'|'master'};

/** Presentation-only edges for common native entity references.
 * Non-target edges are read-only here: changing them requires a keyvalue editor,
 * not the regular target port, whose semantics differ between entity classes.
 * Returning a new array must not mutate MAP data or the original objects.
 */
export function getGameplayGraphConnections(objects:MapObject[]):GraphLink[]{
 const entities=objects.filter((o):o is PointEntity=>o.kind==='entity');
 const byName=new Map<string,PointEntity[]>();
 for(const e of entities){const n=e.props.targetname?.trim();if(n)byName.set(n,[...(byName.get(n)||[]),e]);}
 const links:GraphLink[]=getConnections(objects).map(e=>({...e,via:'target'}));
 const optionalKeys=['moveto','killtarget','master'] as const;
 for(const source of entities)for(const via of optionalKeys){
  const name=source.props[via]?.trim();if(!name||name.startsWith('!'))continue;
  for(const to of byName.get(name)||[])links.push({from:source.id,to:to.id,name,via});
 }
 return links;
}

const STEP_X=294,STEP_Y=140;

export function gameplayGraphCategory(e:PointEntity):Exclude<GraphCategory,'all'>{
 const c=e.classname.toLowerCase();
 if(c==='trigger_camera'||c==='trigger_cameratarget'||(c==='info_target'||c==='path_corner')&&/^(cs_|camera)/i.test(e.props.targetname||''))return 'camera';
 if(c==='ambient_generic'||c==='env_sound'||c==='speaker'||c.startsWith('ambient_'))return 'audio';
 if(c.startsWith('monster_')||c.startsWith('path_')||c.includes('scripted_')||c.startsWith('info_node')||c==='squadmaker')return 'ai';
 if(c.startsWith('func_'))return 'brush';
 if(c.startsWith('trigger_')||c.startsWith('game_')||c==='multi_manager'||c==='multi_watcher'||c.startsWith('env_global'))return 'logic';
 return 'other';
}

export function gameplayReferenceKind(source:PointEntity):'path'|'look'|'reference'{
 if(source.classname==='path_corner'||source.classname==='path_track')return 'path';
 if(source.classname==='trigger_camera')return 'look';
 return 'reference';
}

export function filterGameplayNodes(
 entities:PointEntity[],edges:GameplayConnection[],options:{query?:string;category?:GraphCategory;onlyReferenced?:boolean;neighborhood?:string|null}
):PointEntity[]{
 const q=(options.query||'').trim().toLocaleLowerCase();
 const involved=new Set(edges.flatMap(e=>[e.from,e.to]));
 // Entities with broken outgoing targets still count as references.
 for(const e of entities)if(e.props.target?.trim())involved.add(e.id);
 const cameraRelated=new Set(entities.filter(e=>e.classname==='trigger_camera'||e.classname==='trigger_cameratarget').map(e=>e.id));
 // Camera grouping follows camera look/moveto and path_corner chains, regardless
 // of the naming convention used for the referenced entities.
 const cameraQueue=[...cameraRelated];
 const byId=new Map(entities.map(e=>[e.id,e]));
 for(let i=0;i<cameraQueue.length;i++){
  const current=cameraQueue[i],from=byId.get(current);
  if(!from||!(from.classname==='trigger_camera'||from.classname==='trigger_cameratarget'||from.classname==='path_corner'||from.classname==='path_track'))continue;
  for(const edge of edges)if(edge.from===current&&!cameraRelated.has(edge.to)){
   cameraRelated.add(edge.to);cameraQueue.push(edge.to);
  }
 }
 const neighbors=new Set<string>();
 if(options.neighborhood){
  neighbors.add(options.neighborhood);
  for(const edge of edges)if(edge.from===options.neighborhood||edge.to===options.neighborhood){neighbors.add(edge.from);neighbors.add(edge.to)}
 }
 return entities.filter(e=>{
  if(q&&![e.classname,e.name,e.props.targetname,e.props.target,e.layer,e.group].some(s=>(s||'').toLocaleLowerCase().includes(q)))return false;
  if(options.category&&options.category!=='all'&&gameplayGraphCategory(e)!==options.category&&!(options.category==='camera'&&cameraRelated.has(e.id)))return false;
  if(options.onlyReferenced&&!involved.has(e.id))return false;
  if(options.neighborhood&&!neighbors.has(e.id))return false;
  return true;
 });
}

/** Compact, deterministic layout. Uses actual target references, but never edits them.
 * Disconnected objects are in a grid rather than a tall single column.
 * Cycles are supported: traversal has a visited set and every node is placed once.
 */
export function layoutGameplayGraph(entities:PointEntity[],edges:GameplayConnection[]):Record<string,GraphPosition>{
 const ids=new Set(entities.map(e=>e.id)),byId=new Map(entities.map(e=>[e.id,e]));
 const adjacent=new Map(entities.map(e=>[e.id,new Set<string>()]));
 const outgoing=new Map(entities.map(e=>[e.id,new Set<string>()]));
 const indegree=new Map(entities.map(e=>[e.id,0]));
 for(const edge of edges){
  if(!ids.has(edge.from)||!ids.has(edge.to)||edge.from===edge.to)continue;
  adjacent.get(edge.from)!.add(edge.to);adjacent.get(edge.to)!.add(edge.from);
  if(!outgoing.get(edge.from)!.has(edge.to)){
   outgoing.get(edge.from)!.add(edge.to);
   indegree.set(edge.to,(indegree.get(edge.to)||0)+1);
  }
 }
 const seen=new Set<string>(),components:string[][]=[];
 for(const e of entities){
  if(seen.has(e.id))continue;
  const queue=[e.id],group:string[]=[];seen.add(e.id);
  for(let i=0;i<queue.length;i++){
   const id=queue[i];group.push(id);
   for(const next of adjacent.get(id)||[])if(!seen.has(next)){seen.add(next);queue.push(next)}
  }
  components.push(group);
 }
 const connected=components.filter(c=>c.length>1).sort((a,b)=>b.length-a.length);
 const standalone=components.filter(c=>c.length===1).map(c=>c[0]);
 if(standalone.length)connected.push(standalone);
 const positions:Record<string,GraphPosition>={};
 let offsetX=36,offsetY=40,rowHeight=0;
 for(const component of connected){
  const member=new Set(component),ordered:string[]=[],visited=new Set<string>();
  const roots=component.filter(id=>(indegree.get(id)||0)===0);
  // Deterministic traversal, using source order for SCCs and fan-out branches.
  for(const start of [...roots,...component]){
   if(visited.has(start))continue;
   const queue=[start];visited.add(start);
   for(let i=0;i<queue.length;i++){
    const id=queue[i];ordered.push(id);
    for(const next of outgoing.get(id)||[])if(member.has(next)&&!visited.has(next)){visited.add(next);queue.push(next)}
   }
  }
  // Isolated group is packed more densely. Other groups use connected traversal.
  const cols=Math.min(9,Math.max(component.length===1?1:2,Math.ceil(Math.sqrt(component.length*1.6))));
  const rows=Math.ceil(ordered.length/cols);
  const blockW=cols*STEP_X,blockH=rows*STEP_Y;
  if(offsetX>36&&offsetX+blockW>3000){offsetX=36;offsetY+=rowHeight+60;rowHeight=0}
  ordered.forEach((id,index)=>{
   if(!byId.has(id))return;
   positions[id]={x:offsetX+(index%cols)*STEP_X,y:offsetY+Math.floor(index/cols)*STEP_Y};
  });
  offsetX+=blockW+60;
  rowHeight=Math.max(rowHeight,blockH);
 }
 return positions;
}

export function graphBounds(ids:string[],positions:Record<string,GraphPosition>){
 if(!ids.length)return {minX:0,minY:0,maxX:900,maxY:550,width:900,height:550};
 const pts=ids.map(id=>positions[id]).filter(Boolean);
 if(!pts.length)return {minX:0,minY:0,maxX:900,maxY:550,width:900,height:550};
 const minX=Math.min(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y));
 const maxX=Math.max(...pts.map(p=>p.x))+GRAPH_NODE_WIDTH,maxY=Math.max(...pts.map(p=>p.y))+GRAPH_NODE_HEIGHT;
 return {minX,minY,maxX,maxY,width:Math.max(1,maxX-minX),height:Math.max(1,maxY-minY)};
}
