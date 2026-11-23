/** Compile region ("cordon"): build only part of the map for fast tests.
 * The editable project is never changed. A copy keeps every brush that touches the box,
 * every point entity inside it and the brush entities of kept brushes, then six sealing
 * brushes close the box so the partial map cannot leak. The build uses <map>_region, so it
 * never overwrites the real map in the game folders.
 */
import type {Brush,MapObject,PointEntity,Project,Vec3} from './types';
import {createBrush,transformedVertices} from './geometry';

export type CompileRegion={min:Vec3;max:Vec3};
export type RegionBuild={project:Project;kept:number;total:number;sealTexture:string;spawnInside:boolean};

export const REGION_SUFFIX='_region';
const WALL=16;
const MIN_SIZE=64;
const SPAWNS=new Set(['info_player_start','info_player_deathmatch','info_player_coop','info_player_dm2']);

export function regionMapName(mapName:string):string{
  const name=mapName.endsWith(REGION_SUFFIX)?mapName:`${mapName}${REGION_SUFFIX}`;
  if(name.length>64)throw Error('The map name is too long for a region build (64 characters maximum).');
  return name;
}

export function objectBounds(object:MapObject):{min:Vec3;max:Vec3}{
  if(object.kind==='entity')return {min:[...object.position] as Vec3,max:[...object.position] as Vec3};
  const points=transformedVertices(object);
  const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
  for(const p of points)for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}
  return {min,max};
}

/** Box around the selected objects plus padding, snapped outward to 16 units. */
export function regionFromObjects(objects:readonly MapObject[],ids:readonly string[],padding=64):CompileRegion|null{
  const chosen=new Set(ids);
  const picked=objects.filter(o=>chosen.has(o.id)||(o.kind==='brush'&&o.entityId&&chosen.has(o.entityId)));
  if(!picked.length)return null;
  const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
  for(const o of picked){const b=objectBounds(o);for(let i=0;i<3;i++){min[i]=Math.min(min[i],b.min[i]);max[i]=Math.max(max[i],b.max[i]);}}
  for(let i=0;i<3;i++){
    min[i]=Math.floor((min[i]-padding)/16)*16;max[i]=Math.ceil((max[i]+padding)/16)*16;
    if(max[i]-min[i]<MIN_SIZE){const mid=(min[i]+max[i])/2;min[i]=Math.floor((mid-MIN_SIZE/2)/16)*16;max[i]=min[i]+MIN_SIZE;}
  }
  return {min,max};
}

export function validRegion(region:CompileRegion|null|undefined):region is CompileRegion{
  return !!region&&region.min.every((v,i)=>Number.isFinite(v)&&Number.isFinite(region.max[i])&&region.max[i]-v>=MIN_SIZE);
}

const touches=(b:{min:Vec3;max:Vec3},r:CompileRegion)=>b.min.every((v,i)=>v<r.max[i]&&b.max[i]>r.min[i]);
const inside=(p:Vec3,r:CompileRegion)=>p.every((v,i)=>v>r.min[i]&&v<r.max[i]);

/** Six brushes forming a closed shell just outside the region. */
export function sealingBrushes(region:CompileRegion,texture:string):Brush[]{
  const {min,max}=region;
  const size:Vec3=[max[0]-min[0],max[1]-min[1],max[2]-min[2]];
  const center:Vec3=[(min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2];
  const out=(axis:0|1|2,sign:1|-1):Brush=>{
    const s:Vec3=[size[0]+WALL*2,size[1]+WALL*2,size[2]+WALL*2];s[axis]=WALL;
    const c:Vec3=[...center] as Vec3;c[axis]=(sign>0?max[axis]:min[axis])+sign*WALL/2;
    const brush=createBrush('box',c,s,`Region seal ${'XYZ'[axis]}${sign>0?'+':'-'}`);
    return {...brush,id:`region-seal-${axis}-${sign>0?'p':'n'}`,layer:'Geometry',faces:brush.faces.map(f=>({...f,texture}))};
  };
  return [out(0,1),out(0,-1),out(1,1),out(1,-1),out(2,1),out(2,-1)];
}

/** Sealing texture: SKY when it is loaded (keeps light_environment working), else the map's most used texture. */
export function regionSealTexture(project:Project,loadedTextures:readonly string[]):string{
  const sky=loadedTextures.find(n=>n.toLowerCase()==='sky');
  if(sky)return sky;
  const counts=new Map<string,number>();
  for(const o of project.objects)if(o.kind==='brush')for(const f of o.faces)if(f.texture)counts.set(f.texture,(counts.get(f.texture)??0)+1);
  return [...counts].sort((a,b)=>b[1]-a[1])[0]?.[0]??'sky';
}

export function buildRegionProject(project:Project,region:CompileRegion,sealTexture:string):RegionBuild{
  if(!validRegion(region))throw Error('The compile region is too small or invalid.');
  const keptBrushes=project.objects.filter((o):o is Brush=>o.kind==='brush'&&touches(objectBounds(o),region));
  const brushOwners=new Set(keptBrushes.map(b=>b.entityId).filter((id):id is string=>!!id));
  const keptEntities=project.objects.filter((o):o is PointEntity=>o.kind==='entity'&&(brushOwners.has(o.id)||inside(o.position,region)));
  const keptIds=new Set<string>([...keptBrushes,...keptEntities].map(o=>o.id));
  const objects=[...project.objects.filter(o=>keptIds.has(o.id)),...sealingBrushes(region,sealTexture)];
  const spawnInside=keptEntities.some(e=>SPAWNS.has(e.classname)&&inside(e.position,region));
  return {project:{...project,objects},kept:keptIds.size,total:project.objects.length,sealTexture,spawnInside};
}
