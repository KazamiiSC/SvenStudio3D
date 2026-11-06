import type {MapObject,PointEntity,Project,TextureAsset,FgdClass} from './types';
import {validateBrush} from './exportMap';
import {transformedVertices,safeFaceTextureAxes} from './geometry';

export type MapIssue={severity:'error'|'warning'|'info';category:'geometry'|'entities'|'textures'|'environment';message:string;objectId?:string;code:string;template?:string;params?:Record<string,string|number>};
export type MapReport={issues:MapIssue[];brushes:number;entities:number;faces:number;textures:number;unknownTextures:number};
const special=(name:string)=>['SKY','NULL','CLIP','ORIGIN','TRIGGER','HINT','SKIP','AAATRIGGER','BEVEL','SOLIDHINT'].includes(name.toUpperCase());
/** Exact convex volume check in world-space, including rotated brushes.
 * Only used for positive evidence: a point entity entirely inside a solid SKY brush. */
function isInsideSolidBrush(brush:Extract<MapObject,{kind:'brush'}>,point:[number,number,number]):boolean{
 const vertices=transformedVertices(brush);
 if(vertices.length<4||brush.faces.length<4)return false;
 const center=[0,1,2].map(axis=>vertices.reduce((sum,v)=>sum+v[axis],0)/vertices.length);
 let checked=0;
 for(const face of brush.faces){
  if(face.indices.length<3)return false;
  const a=vertices[face.indices[0]],b=vertices[face.indices[1]],c=vertices[face.indices[2]];
  if(!a||!b||!c)return false;
  const u=b.map((n,i)=>n-a[i]),v=c.map((n,i)=>n-a[i]);
  const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const length=Math.hypot(...normal);if(length<1e-5)return false;
  const orientation=normal.reduce((sum,n,i)=>sum+n*(a[i]-center[i]),0)>=0?1:-1;
  const distance=normal.reduce((sum,n,i)=>sum+orientation*n*(point[i]-a[i]),0)/length;
  if(distance>=-0.5)return false;
  checked++;
 }
 return checked>=4;
}
/** Advisory preflight: cannot replace SC-CSG/SC-BSP leak and WAD resolution checks. */
export function analyzeMap(project:Project,assets:TextureAsset[]=[],fgd:FgdClass[]=[],fgdLoaded=false):MapReport{
 const issues:MapIssue[]=[];
 const push=(severity:MapIssue['severity'],category:MapIssue['category'],code:string,message:string,objectId?:string,template?:string,params?:Record<string,string|number>)=>issues.push({severity,category,code,message,objectId,template,params});
 const brushes=project.objects.filter((o):o is Extract<MapObject,{kind:'brush'}>=>o.kind==='brush');
 const entities=project.objects.filter((o):o is PointEntity=>o.kind==='entity');
 if(!brushes.length)push('error','geometry','NO_BRUSHES','Map has no world or entity brushes.');
 if(!entities.some(e=>e.classname==='info_player_start'))push('error','entities','NO_SPAWN','Map has no info_player_start.');
 brushes.forEach(b=>{
  validateBrush(b).forEach(problem=>push('error','geometry','BRUSH_INVALID',problem,b.id));
  const vertices=transformedVertices(b);
  let repaired=0;
  for(const face of b.faces){
    if(face.indices.length<3)continue;
    try{if(safeFaceTextureAxes(vertices,face).repaired)repaired++;}
    catch{push('error','textures','TEXTURE_AXIS_UNREPAIRABLE',`${b.name}: face texture axes could not be corrected.`,b.id);}
  }
  if(repaired)push('warning','textures','TEXTURE_AXIS_REPAIRED',`${b.name}: ${repaired} face(s) have near-perpendicular UV axes. Renderer and Valve 220 export will apply an automatic non-destructive alignment repair.`,b.id);
 });
 // A massive solid SKY brush is not an enclosure: it occupies air and can
 // swallow the spawn/light, leaving SC-RAD with zero visible light patches.
 for(const brush of brushes){
  if(brush.entityId||!brush.faces.length||!brush.faces.every(face=>face.texture.toUpperCase()==='SKY'))continue;
  const enclosed=entities.find(entity=>['info_player_start','light','light_spot','light_environment'].includes(entity.classname)&&isInsideSolidBrush(brush,entity.position));
  if(enclosed)push('error','environment','SOLID_SKY_SPACE',`Solid SKY brush contains ${enclosed.classname}. A solid cube fills playable space; create a hollow sky enclosure instead.`,brush.id,'Solid SKY brush contains {classname}. Replace it with a hollow sky enclosure.',{classname:enclosed.classname});
 }

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
