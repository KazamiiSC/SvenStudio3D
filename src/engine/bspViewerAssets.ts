/** BSP Viewer 2.0 asset selection. Paths and BSP data are read-only. */
import type {BspEntity} from './bsp';

export const BSP_SKY_CUBE_SIDES=['rt','lf','up','dn','bk','ft'] as const;
export type BspSkySide=typeof BSP_SKY_CUBE_SIDES[number];
export type InstalledBspSky={name:string;source:string;complete:boolean;faces:number};
export type BspModelPlacement={index:number;path:string;origin:[number,number,number];angles:[number,number,number];skin:number;body:number};

/** Don't trust worldspawn skyname as a local path or a URL. */
export function findInstalledBspSky(items:InstalledBspSky[],skyname:string){
  if(!/^[\w-]{1,64}$/.test(skyname))return null;
  return items.find(item=>item.complete&&item.name.toLowerCase()===skyname.toLowerCase()&&
    ['svencoop','svencoop_addon','svencoop_downloads'].includes(item.source))||null;
}
export function bspSkyFaceUrl(gameDir:string,sky:InstalledBspSky,side:BspSkySide){
  const q=new URLSearchParams({gameDir,source:sky.source,sky:sky.name,side});
  return `/api/assets/sky-face?${q}`;
}
/** Explicit model= paths only; implicit NPC models and brush models (*N) are excluded. */
export function bspMdlPath(value:string|undefined){
  const path=(value||'').trim().replace(/\\/g,'/');
  if(path.length>190||!/^models\/[\w.\- /]+\.mdl$/i.test(path)||path.split('/').includes('..'))return null;
  return path;
}
function finiteNumber(value:string|undefined,defaultValue=0){
  const n=Number(value);return Number.isFinite(n)?n:defaultValue;
}
export function bspModelPlacements(entities:BspEntity[],maxInstances=48,maxModels=12):BspModelPlacement[]{
  const models=new Set<string>(),placements:BspModelPlacement[]=[];
  for(let i=0;i<entities.length&&placements.length<maxInstances;i++){
    const e=entities[i],path=bspMdlPath(e.properties.model);
    if(!path||!e.origin||e.classname==='worldspawn')continue;
    const key=path.toLowerCase();
    if(!models.has(key)&&models.size>=maxModels)continue;
    models.add(key);
    const values=(e.properties.angles||'').trim().split(/\s+/).map(Number);
    const angles: [number,number,number]=values.length===3&&values.every(Number.isFinite)?[values[0],values[1],values[2]]:
      [0,finiteNumber(e.properties.angle),0];
    placements.push({index:i,path:key,origin:e.origin,angles,
      skin:Math.max(0,Math.min(31,Math.trunc(finiteNumber(e.properties.skin)))),
      body:Math.max(0,Math.min(4095,Math.trunc(finiteNumber(e.properties.body))))});
  }
  return placements;
}

/** Large-map batching uses face centroids for spatial frustum culling. A face is
 * never cropped: its complete geometry stays in its chosen cell. */
export function bspSpatialBatchCell(points:ReadonlyArray<readonly number[]>,size=2048){
  if(!points.length)return '0:0:0';
  const sums=[0,0,0];
  for(const pt of points)for(let axis=0;axis<3;axis++)sums[axis]+=pt[axis];
  return sums.map(value=>Math.floor(value/points.length/size)).join(':');
}
