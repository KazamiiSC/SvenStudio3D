/** UI-only Svengine scene organization. No project entities or MAP keyvalues are altered. */
import type {MapObject,PointEntity} from './types';
import {isNpcOwner,traceNpcRoute} from './npc';

const isPoint=(o:MapObject):o is PointEntity=>o.kind==='entity';
export type RouteGroup={key:string;name:string;owners:PointEntity[];nodes:PointEntity[];shared:boolean;broken:boolean;loop:boolean};
export type SceneGroup={id:string;name:string;items:MapObject[]};
export type SceneOrganization={routes:RouteGroup[];orphanWaypoints:PointEntity[];groups:SceneGroup[];memberships:Map<string,string[]>};

export function organizeScene(objects:MapObject[]):SceneOrganization{
  const points=objects.filter(isPoint);
  const pointsById=new Map(points.map(p=>[p.id,p]));
  const routes=new Map<string,RouteGroup>();
  const memberships=new Map<string,string[]>();
  for(const owner of points.filter(p=>isNpcOwner(p.classname)&&p.props.path_name?.trim())){
    const pathName=owner.props.path_name.trim();
    let group=routes.get(pathName);
    if(!group){
      const result=traceNpcRoute(objects,owner.id);
      group={key:pathName,name:pathName,owners:[],nodes:result.nodes,broken:!!result.brokenTarget,loop:result.loop,shared:false};
      routes.set(pathName,group);
    }
    group.owners.push(owner);
  }
  for(const group of routes.values()){
    group.shared=group.owners.length>1;
    for(const node of group.nodes)memberships.set(node.id,[...(memberships.get(node.id)||[]),group.key]);
  }
  const waypoints=points.filter(p=>p.classname==='path_waypoint');
  const orphanWaypoints=waypoints.filter(p=>!memberships.has(p.id));
  const claimedBrushIds=new Set<string>();
  const groups:SceneGroup[]=[
    {id:'geometry',name:'Geometry',items:objects.filter(o=>o.kind==='brush'&&!o.entityId)},
    {id:'npc',name:'NPCs',items:points.filter(p=>p.classname.startsWith('monster_'))},
    {id:'spawners',name:'NPC Spawners',items:points.filter(p=>p.classname==='squadmaker'||p.classname==='monstermaker')},
    {id:'audio',name:'Audio',items:points.filter(p=>/^(ambient_generic|ambient_music|env_sound)$/.test(p.classname))},
    {id:'lighting',name:'Lighting',items:points.filter(p=>p.classname.startsWith('light')||p.classname==='light_environment')},
    {id:'triggers',name:'Triggers & Logic',items:points.filter(p=>/^(trigger_|multi_|game_|logic_)/.test(p.classname)||p.classname==='func_button')},
    {id:'brushentities',name:'Doors & Brush Entities',items:points.filter(p=>p.classname.startsWith('func_')&&p.classname!=='func_button')},
    {id:'items',name:'Items & Weapons',items:points.filter(p=>/^(item_|weapon_|ammo_)/.test(p.classname))},
  ];
  for(const o of objects)if(o.kind==='brush'&&o.entityId){
    const owner=pointsById.get(o.entityId);
    if(owner){
      let category=groups.find(g=>g.items.includes(owner));
      if(!category){category=groups.find(g=>g.id==='brushentities')!;}
      category.items.push(o);claimedBrushIds.add(o.id);
    }
  }
  const classified=new Set(groups.flatMap(g=>g.items.map(o=>o.id)));
  groups.push({id:'other',name:'Other Entities',items:objects.filter(o=>!classified.has(o.id)&&!(o.kind==='entity'&&o.classname==='path_waypoint')&&!claimedBrushIds.has(o.id))});
  return {routes:[...routes.values()],orphanWaypoints,groups,memberships};
}

/** Deterministic colors distinguish nearby paths without modifying map files. */
export function routeColor(key:string):string{
  let hash=2166136261;
  for(let i=0;i<key.length;i++)hash=Math.imul(hash^key.charCodeAt(i),16777619)>>>0;
  return `hsl(${hash%360} 88% 67%)`;
}
export function routeForNode(organization:SceneOrganization,nodeId:string){
  const keys=organization.memberships.get(nodeId)||[];
  return organization.routes.filter(r=>keys.includes(r.key));
}
