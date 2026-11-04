import type {MapObject,PointEntity,Project,TextureAsset,FgdClass} from './types';
import {validateBrush} from './exportMap';

export type MapIssue={severity:'error'|'warning'|'info';category:'geometry'|'entities'|'textures'|'environment';message:string;objectId?:string;code:string;template?:string;params?:Record<string,string|number>};
export type MapReport={issues:MapIssue[];brushes:number;entities:number;faces:number;textures:number;unknownTextures:number};
const special=(name:string)=>['SKY','NULL','CLIP','ORIGIN','TRIGGER','HINT','SKIP','AAATRIGGER','BEVEL','SOLIDHINT'].includes(name.toUpperCase());
/** Advisory preflight: cannot replace SC-CSG/SC-BSP leak and WAD resolution checks. */
export function analyzeMap(project:Project,assets:TextureAsset[]=[],fgd:FgdClass[]=[],fgdLoaded=false):MapReport{
 const issues:MapIssue[]=[];
 const push=(severity:MapIssue['severity'],category:MapIssue['category'],code:string,message:string,objectId?:string,template?:string,params?:Record<string,string|number>)=>issues.push({severity,category,code,message,objectId,template,params});
 const brushes=project.objects.filter((o):o is Extract<MapObject,{kind:'brush'}>=>o.kind==='brush');
 const entities=project.objects.filter((o):o is PointEntity=>o.kind==='entity');
 if(!brushes.length)push('error','geometry','NO_BRUSHES','Map has no world or entity brushes.');
 if(!entities.some(e=>e.classname==='info_player_start'))push('error','entities','NO_SPAWN','Map has no info_player_start.');
 brushes.forEach(b=>validateBrush(b).forEach(problem=>push('error','geometry','BRUSH_INVALID',problem,b.id)));
 const names=new Map<string,PointEntity[]>();
 for(const e of entities){const name=e.props.targetname?.trim();if(name){const group=names.get(name)||[];group.push(e);names.set(name,group);}}
 entities.forEach(e=>{
  for(const key of ['target','killtarget']){const target=e.props[key]?.trim();if(target&&!names.has(target))push('warning','entities','MISSING_TARGET',`${e.classname}: ${key} = "${target}" has no matching targetname.`,e.id,'Entity target is missing: {classname}.{key} → {target}',{classname:e.classname,key,target});}
  if(fgdLoaded&&!fgd.some(c=>c.name.toLowerCase()===e.classname.toLowerCase()))push('info','entities','UNKNOWN_FGD',`${e.classname} is not defined in the loaded FGD.`,e.id,'Class not found in loaded FGD: {classname}',{classname:e.classname});
 });
 for(const [name,members] of names)if(members.length>1)push('info','entities','SHARED_TARGET',`targetname "${name}" is shared by ${members.length} entities (may be intentional).`,members[0].id,'Shared targetname: {name} ({count} entities; may be intentional)',{name,count:members.length});
 const used=new Set(brushes.flatMap(b=>b.faces.map(f=>f.texture.toUpperCase())));
 const namesInAssets=new Set(assets.map(a=>a.name.toUpperCase()));
 const unknown=[...used].filter(n=>!special(n)&&!namesInAssets.has(n));
 if(!assets.length)push('info','textures','NO_WAD_PREVIEW','Import the same WAD files used for compilation to check texture names.');
 else unknown.forEach(name=>{const owner=brushes.find(b=>b.faces.some(f=>f.texture.toUpperCase()===name));push('warning','textures','TEXTURE_NOT_IMPORTED',`Texture ${name} is absent from imported WAD previews (it may exist in a configured build WAD).`,owner?.id,'Texture not found in imported WAD previews: {texture} (may exist in build WAD)',{texture:name})});
 if([...used].includes('SKY')&&!project.world.skyname)push('warning','environment','SKYNAME_MISSING','SKY faces exist but worldspawn.skyname is empty.');
 return {issues,brushes:brushes.length,entities:entities.length,faces:brushes.reduce((a,b)=>a+b.faces.length,0),textures:used.size,unknownTextures:assets.length?unknown.length:0};
}
