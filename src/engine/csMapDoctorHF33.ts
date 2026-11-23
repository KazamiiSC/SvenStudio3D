/** HF33: conservative CS 1.6 preflight and compiler-log diagnosis.
 * This is not a map compiler, a leak detector or a proof of player collision.
 */
import {transformedVertices} from './geometry';
import {analyzeBuildLog} from './compileDiagnostics';
import {isRecoveredBspProject} from './recoveredBspPreview';
import type {Brush,MapObject,PointEntity,Project,TextureAsset,Vec3} from './types';

export type CS16HF33Finding={code:string;severity:'error'|'warning'|'info';objectId?:string;detail?:string};
const tool=/^(?:AAATRIGGER|SKY|NULL|CLIP|ORIGIN|HINT|SKIP|BEVEL|SOLIDHINT)$/i;
// Some perfectly valid GoldSrc solids use NULL on unseen sides. Excluding an
// entire brush because one side has NULL caused bogus no-floor warnings.
const worldSolid=(b:Brush)=>!b.hidden&&!b.entityId&&b.faces.length>0&&
 !b.faces.some(f=>/^(?:AAATRIGGER|SKY|ORIGIN)$/i.test(f.texture)||f.texture.startsWith('!'))&&
 !b.faces.every(f=>/^(?:NULL|HINT|SKIP|BEVEL|SOLIDHINT)$/i.test(f.texture));
function aabb(brush:Brush){
 const verts=transformedVertices(brush);
 return {min:[0,1,2].map(i=>Math.min(...verts.map(p=>p[i]))) as Vec3,
         max:[0,1,2].map(i=>Math.max(...verts.map(p=>p[i]))) as Vec3};
}
const intersects=(minA:Vec3,maxA:Vec3,minB:Vec3,maxB:Vec3)=>minA.every((n,i)=>n<maxB[i]-0.5&&maxA[i]>minB[i]+0.5);

/** Map-space floor probe: vertical ray against the upward faces of original brushes.
 * Unlike a nested AABB test, this works at brush seams, stairs and sloped surfaces.
 * A BSP-reconstructed MAP is explicitly excluded by the calling preflight: its
 * reconstructed polygons are NOT the engine's original collision hulls.
 */
function xyInside(x:number,y:number,poly:readonly Vec3[]):boolean{
 let inside=false;
 for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];
  const cross=(x-a[0])*(b[1]-a[1])-(y-a[1])*(b[0]-a[0]);
  if(Math.abs(cross)<0.001 && x>=Math.min(a[0],b[0])-0.01&&x<=Math.max(a[0],b[0])+0.01 && y>=Math.min(a[1],b[1])-0.01&&y<=Math.max(a[1],b[1])+0.01)return true;
  if((a[1]>y)!==(b[1]>y) && x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function hasNearbyFloor(p:Vec3,solid:readonly {brush:Brush;min:Vec3;max:Vec3}[]):boolean{
 const foot=p[2]-36;
 // A standing player needs support under at least a part of its footprint.
 // Sampling inside the 32x32 hull reduces false reports at brush seams.
 const samples:[[number,number],...[number,number][]]=[[p[0],p[1]],[p[0]-10,p[1]],[p[0]+10,p[1]],[p[0],p[1]-10],[p[0],p[1]+10]];
 for(const {brush,min,max} of solid){
  if(max[2]<foot-96||min[2]>foot+8)continue;
  if(samples.every(([x,y])=>x<min[0]-0.1||x>max[0]+0.1||y<min[1]-0.1||y>max[1]+0.1))continue;
  const verts=transformedVertices(brush);
  const center:Vec3=[0,0,0];for(const v of verts)for(let k=0;k<3;k++)center[k]+=v[k]/verts.length;
  for(const face of brush.faces){
   const poly=face.indices.map(i=>verts[i]).filter((v):v is Vec3=>!!v);
   if(poly.length<3)continue;
   const [a,b,c]=poly;
   let nx=(b[1]-a[1])*(c[2]-a[2])-(b[2]-a[2])*(c[1]-a[1]);
   let ny=(b[2]-a[2])*(c[0]-a[0])-(b[0]-a[0])*(c[2]-a[2]);
   let nz=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
   const faceCenter:Vec3=[0,0,0];for(const v of poly)for(let k=0;k<3;k++)faceCenter[k]+=v[k]/poly.length;
   if(nx*(faceCenter[0]-center[0])+ny*(faceCenter[1]-center[1])+nz*(faceCenter[2]-center[2])<0){nx=-nx;ny=-ny;nz=-nz;}
   if(nz<=0.25*Math.hypot(nx,ny,nz))continue;
   for(const [x,y] of samples){
    if(!xyInside(x,y,poly))continue;
    const z=a[2]-(nx*(x-a[0])+ny*(y-a[1]))/nz;
    if(z<=foot+8&&z>=foot-96)return true;
   }
  }
 }
 return false;
}
/** Do not report an issue as a certainty when compiled hull geometry is unknown. */
export function inspectCS16HF33(project:Pick<Project,'objects'> & Partial<Pick<Project,'name'|'world'|'recoveredFromBsp'>>,loadedTextures:readonly Pick<TextureAsset,'name'>[]=[]):CS16HF33Finding[]{
 const all=project.objects,brushes=all.filter((o):o is Brush=>o.kind==='brush');
 const entities=all.filter((o):o is PointEntity=>o.kind==='entity');
 const results:CS16HF33Finding[]=[];
 const put=(code:string,severity:CS16HF33Finding['severity'],objectId?:string,detail?:string)=>results.push({code,severity,objectId,detail});
 const recoveredBsp=isRecoveredBspProject({name:project.name||'',world:project.world||{},recoveredFromBsp:project.recoveredFromBsp});
 const solid=recoveredBsp?[]:brushes.filter(worldSolid).slice(0,12000).map(b=>({brush:b,...aabb(b)}));
 if(!brushes.some(b=>!b.entityId))put('NO_WORLD_BRUSHES','warning');
 if(entities.length>900)put('ENTITY_VOLUME','info',undefined,String(entities.length));
 for(const b of brushes){
  if(b.faces.length>32)put('BRUSH_FACE_LIMIT','warning',b.id,`${b.name} · ${b.faces.length}`);
  const special=new Set(b.faces.map(f=>f.texture.toUpperCase()).filter(t=>/^(SKY|CLIP|ORIGIN|AAATRIGGER|NULL)$/.test(t)));
  if(special.has('SKY')&&b.faces.some(f=>f.texture.toUpperCase()!=='SKY'))put('MIXED_SKY','warning',b.id,b.name);
 }
 for(const p of (recoveredBsp?[]:entities.filter(e=>/^(info_player_start|info_player_deathmatch)$/i.test(e.classname)).slice(0,64))){
  // GoldSrc standing player hull approximately 32 x 32 x 72 with origin at its center.
  const boxMin:Vec3=[p.position[0]-16,p.position[1]-16,p.position[2]-36];
  const boxMax:Vec3=[p.position[0]+16,p.position[1]+16,p.position[2]+36];
  if(solid.some(b=>intersects(boxMin,boxMax,b.min,b.max)))put('SPAWN_SOLID_HULL','warning',p.id);
  else if(solid.length&&!hasNearbyFloor(p.position,solid))put('SPAWN_NO_FLOOR','info',p.id);
 }
 // HF5: team spawn volume and buy-zone coverage (only when the map defines func_buyzone;
 // without one, CS creates automatic buy areas around the spawns).
 const ctSpawns=entities.filter(e=>e.classname.toLowerCase()==='info_player_start'),tSpawns=entities.filter(e=>e.classname.toLowerCase()==='info_player_deathmatch');
 for(const [team,list] of [['CT',ctSpawns],['T',tSpawns]] as const)if(list.length>0&&list.length<10)put('SPAWNS_FEW','warning',undefined,`${team}: ${list.length}`);
 const entityById=new Map(entities.map(e=>[e.id,e]));
 const buyZones=brushes.filter(b=>b.entityId&&entityById.get(b.entityId)?.classname.toLowerCase()==='func_buyzone').map(b=>({team:entityById.get(b.entityId!)!.props.team||'0',...aabb(b)}));
 if(buyZones.length&&!recoveredBsp){
  for(const [teamId,list] of [['2',ctSpawns],['1',tSpawns]] as const)for(const p of list.slice(0,64)){
   const covered=buyZones.some(z=>(z.team==='0'||z.team===teamId)&&p.position.every((v,i)=>v>=z.min[i]-16&&v<=z.max[i]+16));
   if(!covered)put('SPAWN_OUTSIDE_BUYZONE','info',p.id,teamId==='2'?'CT':'T');
  }
 }
 const ids=new Set(entities.map(e=>e.id));
 for(const b of brushes.filter(o=>!!o.entityId))if(!ids.has(b.entityId!))put('BRUSH_ORPHAN','warning',b.id,b.name);
 const zoneIds=new Set(entities.filter(e=>/^(func_bomb_target|func_hostage_rescue|func_buyzone)$/.test(e.classname)).map(e=>e.id));
 for(const b of brushes.filter(o=>o.entityId&&zoneIds.has(o.entityId))){
  if(b.faces.some(f=>f.texture.toUpperCase()!=='AAATRIGGER'))put('ZONE_TEXTURE','warning',b.id,b.name);
 }
 if(!entities.some(e=>e.classname==='light'||e.classname==='light_environment'))put('NO_LIGHTS','info');
 if(loadedTextures.length){
  const known=new Set(loadedTextures.map(a=>a.name.toUpperCase()));let added=0;
  const missing=new Set<string>();
  for(const b of brushes)for(const f of b.faces){
   const t=f.texture.toUpperCase();
   if(tool.test(t)||t.startsWith('!')||known.has(t)||missing.has(t))continue;
   missing.add(t);if(added++<8)put('TEXTURE_NOT_LOADED','info',b.id,t);
  }
 }
 return results;
}

/** Uses real stored ZHLT output only; does not infer success/failure from preflight. */
export function inspectCS16BuildLog(lines:readonly string[]):CS16HF33Finding[]{
 if(!lines.length)return [];
 const text=lines.slice(-2000).join('\n').slice(-250000);
 const found=analyzeBuildLog(lines).map(f=>({code:f.code,severity:f.severity,detail:f.stage||undefined}));
 const add=(code:string,severity:CS16HF33Finding['severity'])=>{if(!found.some(f=>f.code===code))found.push({code,severity,detail:undefined})};
 if(/mixed face contents/i.test(text))add('MIXED_CONTENTS','error');
 if(/BSP limit[^\n]*\b(?:9\d|1\d\d)%/i.test(text))add('BSP_LIMIT_NEAR','warning');
 if(/(?:too many|maximum.*|exceeded).*\b(?:planes|clipnodes|marksurfaces|nodes|models|vertices|edges|faces|patches|entities)\b/i.test(text))add('GOLDSRC_CAPACITY','error');
 if(/(?:could not find|couldn.t open|not found).*\b(?:\.wad|texture)|\b(?:wad file not found|texture not found)\b/i.test(text))add('WAD_MISSING','error');
 if(/(?:LEAK\s+in\s+hull|\*\*\*\*\s*leaked\s*\*\*\*|\bleaked\b)/i.test(text))add('LEAK_REPORTED','error');
 if(/(?:brush.*(?:no volume|non.planar|invalid)|illegal brush|brush.*plane.*invalid)/i.test(text))add('INVALID_GEOMETRY','error');
 return found;
}
