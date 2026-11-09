/** Gameplay Studio 3.0: indexed, read-only presentation of native Svengine entities.
 * These helpers must not change MAP keys or assume every target is an activation.
 */
import type {MapObject,PointEntity} from './types';
import {gameplayGraphCategory,type GraphCategory,type GraphLink,type GraphPosition,GRAPH_NODE_WIDTH,GRAPH_NODE_HEIGHT} from './gameplayGraph';

export type WorkspaceIndex={
 searchById:Map<string,string>;
 layerCounts:Map<string,number>;
 groupCounts:Map<string,number>;
 categoryCounts:Record<Exclude<GraphCategory,'all'>,number>;
 duplicates:{name:string;entityIds:string[];referenced:boolean}[];
 outgoing:Map<string,GraphLink[]>;
 incoming:Map<string,GraphLink[]>;
};
export function buildGameplayWorkspaceIndex(objects:MapObject[],edges:GraphLink[]):WorkspaceIndex{
 const entities=objects.filter((o):o is PointEntity=>o.kind==='entity');
 const linkedBrushes=new Map<string,string[]>();
 for(const obj of objects)if(obj.kind==='brush'&&obj.entityId){
  const names=linkedBrushes.get(obj.entityId)||[];
  names.push(obj.name,obj.editorAlias||'');linkedBrushes.set(obj.entityId,names);
 }
 const searchById=new Map<string,string>(),layerCounts=new Map<string,number>(),groupCounts=new Map<string,number>();
 const categoryCounts:WorkspaceIndex['categoryCounts']={logic:0,brush:0,ai:0,camera:0,audio:0,other:0};
 const names=new Map<string,string[]>(),targetNames=new Set<string>();
 const outgoing=new Map<string,GraphLink[]>(),incoming=new Map<string,GraphLink[]>();
 for(const e of entities){
  const layer=e.layer?.trim()||'Unassigned';
  layerCounts.set(layer,(layerCounts.get(layer)||0)+1);
  const group=e.group?.trim()||'Unassigned';groupCounts.set(group,(groupCounts.get(group)||0)+1);
  categoryCounts[gameplayGraphCategory(e)]++;
  const name=e.props.targetname?.trim();if(name)names.set(name,[...(names.get(name)||[]),e.id]);
  const target=e.props.target?.trim();if(target)targetNames.add(target);
  searchById.set(e.id,[e.classname,e.name,e.editorAlias,e.layer,e.group,e.props.targetname,e.props.target,...(linkedBrushes.get(e.id)||[])].filter(Boolean).join(' ').toLocaleLowerCase());
 }
 for(const edge of edges){
  const from=outgoing.get(edge.from)||[];from.push(edge);outgoing.set(edge.from,from);
  const to=incoming.get(edge.to)||[];to.push(edge);incoming.set(edge.to,to);
 }
 return {searchById,layerCounts,groupCounts,categoryCounts,outgoing,incoming,
  duplicates:[...names.entries()].filter(([,ids])=>ids.length>1).map(([name,entityIds])=>({name,entityIds,referenced:targetNames.has(name)}))};
}

export type TraceStep={entityId:string;depth:number;via:string;fromId?:string};
export type TraceResult={steps:TraceStep[];truncated:boolean;cycles:number};
/** Follows keys and references, not actual game timing, effects, or activation.
 * Each entity is visited at most once, so cycles and huge maps stay bounded.
 */
export function traceGameplayReferences(startId:string,index:WorkspaceIndex,maxNodes=80,maxDepth=12):TraceResult{
 if(!startId)return {steps:[],truncated:false,cycles:0};
 const limit=Math.max(1,Math.min(1000,Math.floor(maxNodes)));
 const visited=new Set([startId]),queue:TraceStep[]=[{entityId:startId,depth:0,via:'origin'}];
 let cycles=0,truncated=false;
 for(let i=0;i<queue.length;i++){
  const current=queue[i],next=index.outgoing.get(current.entityId)||[];
  for(const edge of next){
   if(visited.has(edge.to)){cycles++;continue;}
   if(current.depth>=maxDepth||queue.length>=limit){truncated=true;continue;}
   visited.add(edge.to);
   queue.push({entityId:edge.to,depth:current.depth+1,via:edge.via,fromId:current.entityId});
  }
 }
 return {steps:queue,truncated,cycles};
}

export type GraphWindow={left:number;top:number;width:number;height:number;zoom:number};
/** Cull both nodes and wires outside the scroll viewport. Keep a margin so the
 * graph never flashes while zooming, and avoid mounting thousands of DOM nodes.
 */
export function gameplayVisibleWindow<T extends {id:string}>(
 entities:T[],edges:GraphLink[],positions:Record<string,GraphPosition>,view:GraphWindow,margin=280
):{nodes:T[];edges:GraphLink[]}{
 const z=Math.max(.05,view.zoom||1),left=view.left/z-margin,top=view.top/z-margin;
 const right=(view.left+view.width)/z+margin,bottom=(view.top+view.height)/z+margin;
 const nodes=entities.filter(e=>{
  const p=positions[e.id];return !!p&&p.x<right&&p.x+GRAPH_NODE_WIDTH>left&&p.y<bottom&&p.y+GRAPH_NODE_HEIGHT>top;
 });
 // Wires crossing the viewport must remain even when their endpoints are off-screen.
 const windowEdges=edges.filter(edge=>{
  const a=positions[edge.from],b=positions[edge.to];
  if(!a||!b)return false;
  const x1=a.x+GRAPH_NODE_WIDTH,y1=a.y+62,x2=b.x,y2=b.y+62;
  const curveExtension=Math.max(65,Math.abs(x2-x1)*.48);
  const minX=Math.min(x1,x2)-curveExtension,maxX=Math.max(x1,x2)+curveExtension;
  return maxX>=left&&minX<=right&&Math.max(y1,y2)>=top&&Math.min(y1,y2)<=bottom;
 });
 return {nodes,edges:windowEdges};
}

/** Gameplay Studio 3.1: presentation-only systems. Connected components are
 * separate editing contexts; unconnected entities are packed by layer/category
 * so thousands of isolated entities cannot flood the initial overview.
 * Never writes a target, targetname, graphPosition, or entity group.
 */
export type GameplaySystem={id:string;title:string;entityIds:string[];count:number;links:number;category:Exclude<GraphCategory,'all'>;layer:string;kind:'network'|'unlinked'};
export function groupGameplaySystems(entities:PointEntity[],edges:GraphLink[],maxLooseGroup=24):GameplaySystem[]{
 const byId=new Map(entities.map(e=>[e.id,e]));
 const parent=new Map(entities.map(e=>[e.id,e.id]));
 const find=(id:string):string=>{let p=parent.get(id)!;while(parent.get(p)!==p){const next=parent.get(p)!;parent.set(p,parent.get(next)!);p=next;}return p};
 const union=(a:string,b:string)=>{const ra=find(a),rb=find(b);if(ra!==rb)parent.set(rb,ra)};
 const degree=new Map<string,number>();
 for(const edge of edges){
  if(!byId.has(edge.from)||!byId.has(edge.to))continue;
  union(edge.from,edge.to);
  degree.set(edge.from,(degree.get(edge.from)||0)+1);
  degree.set(edge.to,(degree.get(edge.to)||0)+1);
 }
 const linksByRoot=new Map<string,number>();
 for(const edge of edges)if(byId.has(edge.from)&&byId.has(edge.to)){const root=find(edge.from);linksByRoot.set(root,(linksByRoot.get(root)||0)+1)}
 const components=new Map<string,PointEntity[]>();
 for(const e of entities){const root=find(e.id),list=components.get(root)||[];list.push(e);components.set(root,list)}
 const groups:GameplaySystem[]=[],loose=new Map<string,PointEntity[]>();
 for(const component of components.values()){
  const first=component[0];
  const referenced=component.length>1||component.some(e=>degree.has(e.id)||['target','moveto','killtarget','master'].some(key=>!!e.props[key]?.trim()));
  if(!referenced){const layer=first.layer?.trim()||'Unassigned',cat=gameplayGraphCategory(first),key=JSON.stringify([layer,cat]);const list=loose.get(key)||[];list.push(first);loose.set(key,list);continue}
  const ids=component.map(e=>e.id);
  const links=linksByRoot.get(find(first.id))||0;
  const category=gameplayGraphCategory(first);
  const named=component.find(e=>e.props.targetname?.trim())?.props.targetname?.trim();
  const name=named||first.name||first.classname;
  groups.push({id:`net:${ids[0]}`,title:name,count:ids.length,links,category,layer:first.layer?.trim()||'Unassigned',kind:'network',entityIds:ids});
 }
 const size=Math.max(4,Math.min(60,Math.floor(maxLooseGroup)||24));
 for(const [key,list] of loose){const [layer,category]=JSON.parse(key) as [string,Exclude<GraphCategory,'all'>];
  for(let start=0;start<list.length;start+=size){const slice=list.slice(start,start+size),ids=slice.map(e=>e.id);
   groups.push({id:`loose:${ids[0]}`,title:`${layer} · ${category}`,entityIds:ids,count:ids.length,links:0,category,layer,kind:'unlinked'});
  }
 }
 // Connected contexts first; stable order avoids rearranging cards due to cursors.
 return groups.sort((a,b)=>(a.kind==='network'?0:1)-(b.kind==='network'?0:1)||b.links-a.links||b.count-a.count||a.title.localeCompare(b.title));
}
