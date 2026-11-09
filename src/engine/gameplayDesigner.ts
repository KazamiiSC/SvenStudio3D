/** Gameplay Studio 3.0 spatial/event workspace. Presentation-only: no MAP keyvalues are created here. */
import type {MapObject,PointEntity} from './types';
import type {GraphLink,GraphCategory} from './gameplayGraph';
import {gameplayGraphCategory} from './gameplayGraph';

export type DesignZone={id:string;title:string;entityIds:string[];count:number;center:[number,number];linked:number};
export type Interaction={id:string;from:string;to:string;via:GraphLink['via'];name:string};
export type DesignFilter={query:string;category:GraphCategory;layer:string;zoneId:string|null};
export const GAMEPLAY_MAP_PROJECTION='schematic' as const;

/** Spatial buckets are virtual workspace groups, never GoldSrc entity groups or layers.
 * Multiple pages prevent a dense origin or multi_manager stack becoming a 1,000-row list.
 */
export function buildDesignZones(entities:PointEntity[],links:GraphLink[],pageSize=64):DesignZone[]{
 if(!entities.length)return [];
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 for(const e of entities){minX=Math.min(minX,e.position[0]);maxX=Math.max(maxX,e.position[0]);minY=Math.min(minY,e.position[1]);maxY=Math.max(maxY,e.position[1]);}
 const target=Math.max(1,Math.ceil(Math.sqrt(entities.length/42)));
 const cell=Math.max(384,Math.max(maxX-minX,maxY-minY)/target||384);
 const groups=new Map<string,PointEntity[]>();
 for(const e of entities){const ix=Math.floor((e.position[0]-minX)/cell),iy=Math.floor((e.position[1]-minY)/cell);const key=`${ix}:${iy}`;const group=groups.get(key)||[];group.push(e);groups.set(key,group);}
 const connected=new Set<string>();for(const l of links){connected.add(l.from);connected.add(l.to);}
 const zones:DesignZone[]=[];const size=Math.max(12,Math.min(100,Math.floor(pageSize)));
 for(const [key,group] of groups){const [x,y]=key.split(':').map(Number);
  for(let i=0;i<group.length;i+=size){const members=group.slice(i,i+size),entityIds=members.map(e=>e.id);
   const center:[number,number]=[members.reduce((s,e)=>s+e.position[0],0)/members.length,members.reduce((s,e)=>s+e.position[1],0)/members.length];
   zones.push({id:`zone:${key}:${i/size}`,title:`Sector ${x+1} · ${y+1}${group.length>size?` / ${i/size+1}`:''}`,entityIds,count:members.length,center,linked:members.filter(e=>connected.has(e.id)||!!e.props.target?.trim()).length});
  }
 }
 return zones.sort((a,b)=>b.linked-a.linked||b.count-a.count||a.title.localeCompare(b.title));
}

export function filterDesignEntities(entities:PointEntity[],zones:DesignZone[],filter:DesignFilter):PointEntity[]{
 const q=filter.query.trim().toLocaleLowerCase(),zone=filter.zoneId?zones.find(z=>z.id===filter.zoneId):null;
 const members=zone?new Set(zone.entityIds):null;
 return entities.filter(e=>(!members||members.has(e.id))&&(filter.layer==='all'||(e.layer?.trim()||'Unassigned')===filter.layer)
  &&(filter.category==='all'||gameplayGraphCategory(e)===filter.category)
  &&(!q||[e.classname,e.name,e.editorAlias,e.layer,e.group,e.props.targetname,e.props.target].some(s=>(s||'').toLocaleLowerCase().includes(q))));
}

/** Native references (not necessarily activations); don't turn camera/path references into scripted gameplay. */
export function buildDesignInteractions(links:GraphLink[]):Interaction[]{
 return links.map((link,i)=>({id:`${link.from}:${link.to}:${link.via}:${i}`,from:link.from,to:link.to,via:link.via,name:link.name}));
}

export type ProjectionMode='top'|'iso';
export function projectGameplayPosition(point:readonly [number,number,number],projection:ProjectionMode):[number,number]{
 const [x,y,z]=point;
 return projection==='top'?[x,-y]:[(x-y)*0.866,(x+y)*-.43-z*.55];
}
export function gameplayMapBounds(objects:MapObject[],projection:ProjectionMode):{minX:number;minY:number;maxX:number;maxY:number}{
 let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
 for(const o of objects){
  const p=projectGameplayPosition(o.position,projection);
  const radius=o.kind==='brush'?Math.max(16,...o.vertices.map(v=>Math.hypot(v[0]*o.scale[0],v[1]*o.scale[1]))):24;
  minX=Math.min(minX,p[0]-radius);maxX=Math.max(maxX,p[0]+radius);
  minY=Math.min(minY,p[1]-radius);maxY=Math.max(maxY,p[1]+radius);
 }
 if(!Number.isFinite(minX))return {minX:-300,minY:-250,maxX:300,maxY:250};
 return {minX,minY,maxX,maxY};
}
