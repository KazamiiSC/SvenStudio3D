/** CS 1.6 Map Studio: create only conventional GoldSrc/CS classes.
 * Does not produce map geometry or validate a compiled BSP.
 */
import type {Brush,MapObject,PointEntity,Project,Vec3} from './types';
import {uid} from './types';
import {createBrush} from './geometry';

export type CS16MapKind='de'|'cs'|'fy'|'aim';
export type CS16Team='ct'|'t';
export type CS16ZoneKind='bomb_a'|'bomb_b'|'buy_ct'|'buy_t'|'rescue';
export const CS16_ARMOURY_ITEMS=[
 {value:'0',name:'MP5 Navy'},{value:'1',name:'TMP'},{value:'2',name:'P90'},
 {value:'3',name:'MAC-10'},{value:'4',name:'AK-47'},{value:'5',name:'SG552'},
 {value:'6',name:'M4A1'},{value:'7',name:'AUG'},{value:'8',name:'Scout'},
 {value:'9',name:'AWP'}] as const;

function finiteVec(v:Vec3):Vec3 {
 if(v.length!==3||v.some(n=>!Number.isFinite(n)||Math.abs(n)>8192))throw Error('CS16_INVALID_COORDS');
 return [...v];
}
function positiveInt(value:number,min:number,max:number):number {
 if(!Number.isInteger(value)||value<min||value>max)throw Error('CS16_INVALID_AMOUNT');
 return value;
}
export function cs16NormalizeYaw(yaw:number):number{
 if(!Number.isFinite(yaw))throw Error('CS16_INVALID_SPACING');
 return ((Math.round(yaw)%360)+360)%360;
}
/** GoldSrc yaw zero looks along +X; 90 degrees along +Y. */
export function cs16FacingXY(yaw:number):[number,number]{
 const radians=cs16NormalizeYaw(yaw)*Math.PI/180;
 return [Math.cos(radians),Math.sin(radians)];
}
function point(name:string,at:Vec3,props:Record<string,string>={}):PointEntity{
 return {id:uid(),kind:'entity',classname:name,name,position:finiteVec(at),props,layer:'CS 1.6'};
}
/** Generate a centered grid of player entities, with at least 64u separation.
 * GoldSrc entity origin is placed about 36u above the ground. */
export function cs16Spawns(team:CS16Team,count:number,center:Vec3,spacing=80,columns=4,yaw=0):PointEntity[]{
 positiveInt(count,1,32);positiveInt(columns,1,8);
 if(!Number.isFinite(spacing)||spacing<64||spacing>512||!Number.isFinite(yaw))throw Error('CS16_INVALID_SPACING');
 const origin=finiteVec(center),cols=Math.min(columns,count),rows=Math.ceil(count/cols);
 const classname=team==='ct'?'info_player_start':'info_player_deathmatch';
 return Array.from({length:count},(_,i)=>{
  const row=Math.floor(i/cols),col=i%cols;
  const rowCount=Math.min(cols,count-row*cols);
  const x=origin[0]+(col-(rowCount-1)/2)*spacing;
  const y=origin[1]+(row-(rows-1)/2)*spacing;
  return point(classname,[x,y,origin[2]],{angles:`0 ${cs16NormalizeYaw(yaw)} 0`});
 });
}
/** A trigger volume brush tied to the corresponding native CS 1.6 solid entity.
 * floorCenter Z is the bottom of the volume (unlike brush center). */
export function cs16Zone(kind:CS16ZoneKind,floorCenter:Vec3,size:Vec3):[Brush,PointEntity]{
 const [width,depth,height]=finiteVec(size);
 if(width<32||depth<32||height<32||width>2048||depth>2048||height>512)throw Error('CS16_INVALID_ZONE_SIZE');
 const floor=finiteVec(floorCenter),center:Vec3=[floor[0],floor[1],floor[2]+height/2];
 const classname=kind.startsWith('bomb_')?'func_bomb_target':kind==='rescue'?'func_hostage_rescue':'func_buyzone';
 const label=kind==='bomb_a'?'Bombsite A':kind==='bomb_b'?'Bombsite B':kind==='buy_ct'?'CT Buyzone':kind==='buy_t'?'T Buyzone':'Hostage Rescue';
 const brush=createBrush('box',center,[width,depth,height],label);
 brush.faces=brush.faces.map(f=>({...f,texture:'AAATRIGGER'}));
 brush.layer='CS 1.6';
 const props:Record<string,string>={};
 if(kind==='buy_ct')props.team='2';
 if(kind==='buy_t')props.team='1';
 const entity=point(classname,center,props);entity.name=label;
 brush.entityId=entity.id;
 return [brush,entity];
}
export function cs16Hostages(count:number,center:Vec3,spacing=72,yaw=0):PointEntity[]{
 positiveInt(count,1,8);
 const origin=finiteVec(center);
 if(!Number.isFinite(yaw))throw Error('CS16_INVALID_SPACING');
 return Array.from({length:count},(_,i)=>point('hostage_entity',[
  origin[0]+(i-(count-1)/2)*spacing,origin[1],origin[2]
 ],{angles:`0 ${cs16NormalizeYaw(yaw)} 0`}));
}
export function cs16Armoury(position:Vec3,item:string,count:number,yaw=0):PointEntity{
 if(!CS16_ARMOURY_ITEMS.some(i=>i.value===item))throw Error('CS16_INVALID_WEAPON');
 positiveInt(count,1,32);
 if(!Number.isFinite(yaw))throw Error('CS16_INVALID_SPACING');
 return point('armoury_entity',position,{item,count:String(count),angles:`0 ${cs16NormalizeYaw(yaw)} 0`});
}
export type CS16LayoutWarning={code:string;severity:'warning'|'info';detail:string};
/** Prevent obvious spatial mistakes, not a replacement for checking hulls in-game. */
export function inspectCS16Layout(project:Pick<Project,'objects'>,mode:CS16MapKind):CS16LayoutWarning[]{
 const all=project.objects;
 const entities=all.filter((o):o is PointEntity=>o.kind==='entity');
 const count=(classname:string)=>entities.filter(e=>e.classname===classname).length;
 const warnings:CS16LayoutWarning[]=[];
 const ct=entities.filter(e=>e.classname==='info_player_start'),t=entities.filter(e=>e.classname==='info_player_deathmatch');
 for(const group of [ct,t])for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++){
  const [a,b]=[group[i].position,group[j].position];
  if(Math.hypot(a[0]-b[0],a[1]-b[1])<48&&Math.abs(a[2]-b[2])<72){warnings.push({code:'SPAWN_OVERLAP',severity:'warning',detail:`${group[i].classname}: ${group[i].name} overlaps another spawn (${group[i].id}, ${group[j].id}).`});break}
 }
 for(const e of ct)for(const other of t){
  const [a,b]=[e.position,other.position];
  if(Math.hypot(a[0]-b[0],a[1]-b[1])<48&&Math.abs(a[2]-b[2])<72){warnings.push({code:'OPPOSING_SPAWNS',severity:'warning',detail:'A CT spawn overlaps a Terrorist spawn.'});break}
 }
 const tied=(classname:string)=>{
  const ids=new Set(entities.filter(e=>e.classname===classname).map(e=>e.id));
  return all.some(o=>o.kind==='brush'&&!!o.entityId&&ids.has(o.entityId));
 };
 if(mode==='de'&&!tied('func_bomb_target')&&!count('info_bomb_target'))warnings.push({code:'DE_BOMB',severity:'warning',detail:'de_ maps need a bomb target entity tied to a brush or an info_bomb_target.'});
 if(mode==='cs'&&count('hostage_entity')===0)warnings.push({code:'CS_HOSTAGES',severity:'warning',detail:'cs_ maps normally require hostages.'});
 if(mode==='cs'&&!tied('func_hostage_rescue')&&!count('info_hostage_rescue'))warnings.push({code:'CS_RESCUE',severity:'warning',detail:'cs_ maps require a hostage rescue location.'});
 const unrelated=mode==='de'&&count('hostage_entity')>0||mode==='cs'&&(tied('func_bomb_target')||count('info_bomb_target')>0);
 if(unrelated)warnings.push({code:'MIXED_OBJECTIVES',severity:'info',detail:'This layout contains entities from a different CS game mode.'});
 if(!ct.length||!t.length)warnings.push({code:'MISSING_TEAMS',severity:'warning',detail:'Place at least one CT and one T spawn.'});
 return warnings;
}

/** A map name is advisory; never rename an existing project without user action. */
export function cs16ModeFromMapName(name:string):CS16MapKind{
 const match=/^(de|cs|fy|aim)_/i.exec(name.trim());return (match?.[1]?.toLowerCase() as CS16MapKind|undefined)??'de';
}
export function cs16CanApply(profile:string|undefined,bspMode:boolean,walkMode:boolean):boolean{
 return profile==='cs16'&&!bspMode&&!walkMode;
}
export function cs16ApplyBatch(existing:MapObject[],objects:MapObject[]):MapObject[]{
 const ids=new Set(existing.map(o=>o.id));
 if(objects.some(o=>ids.has(o.id)))throw Error('CS16_DUPLICATE_OBJECT_ID');
 if(objects.some(o=>o.kind==='brush'&&o.entityId&&!objects.some(e=>e.kind==='entity'&&e.id===o.entityId)&&!ids.has(o.entityId)))throw Error('CS16_BROKEN_BRUSH_ENTITY_LINK');
 return [...existing,...objects];
}
