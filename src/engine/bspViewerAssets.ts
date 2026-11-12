/** BSP Viewer 2.0 asset selection. Paths and BSP data are read-only. */
import type {BspEntity,BspFace} from './bsp';

export const BSP_SKY_CUBE_SIDES=['rt','lf','up','dn','bk','ft'] as const;
export type BspSkySide=typeof BSP_SKY_CUBE_SIDES[number];
export type InstalledBspSky={name:string;source:string;complete:boolean;faces:number};
export type BspModelPlacement={index:number;path:string;origin:[number,number,number];angles:[number,number,number];skin:number;body:number;classname:string};

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
/** Accept engine-relative MDL paths and the leading-slash form seen in custom maps.
 * Never allow traversal, URL schemes or absolute operating-system paths. */
export function bspMdlPath(value:string|undefined){
  let path=(value||'').trim().replace(/\\/g,'/');
  if(path.startsWith('/'))path=path.slice(1);
  if(!path.toLowerCase().startsWith('models/'))path=`models/${path}`;
  if(path.length>230||!/^models\/[\w.\- /]+\.mdl$/i.test(path)||path.split('/').some(piece=>piece==='..'||piece==='.'||!piece))return null;
  return path;
}
/** Spawn markers other than the singleplayer start never become MDL characters. */
export function bspAllowStudioModel(classname:string){
  return !/^info_player_/i.test(classname)||classname.toLowerCase()==='info_player_start';
}
/** Select an actual idle/stand sequence; do not animate a walk, attack or death
 * sequence just because it is the first looping animation. */
export function bspIdleSequence(sequences:ReadonlyArray<{name:string;available:boolean;frames:number;fps:number;loop:boolean}>){
  const idle=/^(?:idle(?:[0-9_ ]|$)|stand(?:[0-9_ ]|$)|rest(?:[0-9_ ]|$)|wait(?:[0-9_ ]|$)|look(?:[0-9_ ]|$))/i;
  const matching=(seq:{name:string;available:boolean;frames:number;fps:number;loop:boolean})=>
    seq.available&&seq.frames>1&&seq.fps>0&&idle.test(seq.name);
  // Use a true looping idle before a similarly named non-looping action;
  // restarting a non-looping pose caused jerky, artificial snapping.
  const looping=sequences.findIndex(seq=>seq.loop&&matching(seq));
  return looping>=0?looping:sequences.findIndex(matching);
}
/** Preserve frame interpolation; hold the last pose of non-looping sequences. */
export function bspIdlePreviewFrame(elapsedSeconds:number,sequence:{frames:number;fps:number;loop:boolean}):number{
  const last=Math.max(0,sequence.frames-1),time=Math.max(0,Number.isFinite(elapsedSeconds)?elapsedSeconds:0);
  const frame=time*Math.max(0,Number.isFinite(sequence.fps)?sequence.fps:0);
  return last<=0?0:sequence.loop?frame%last:Math.min(last,frame);
}
/** Independent distance gate for entities, labels and model previews. Selected
 * entities remain selectable, even when outside the configured range. */
export function bspEntityWithinDistance(origin:readonly number[]|undefined,camera:readonly number[],distance:number,selected=false){
  if(selected)return true;
  if(!origin)return false;
  return (origin[0]-camera[0])**2+(origin[1]-camera[1])**2+(origin[2]-camera[2])**2<=distance*distance;
}
/** Approximate visible floor below a grounded NPC, using compiled worldspawn
 * polygons. Preview-only: never mutate the BSP origin or hull. */
export function bspFloorZ(faces:ReadonlyArray<Pick<BspFace,'points'|'normal'|'model'>>,origin:readonly number[],maxDrop=112):number|null{
  const [x,y,z]=origin;
  let best=-Infinity;
  for(const face of faces){
    if(face.model!==0||face.points.length<3||face.normal[2]<.65)continue;
    const points=face.points;
    let inside=false;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const a=points[i],b=points[j];
      if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
    }
    if(!inside)continue;
    const normal=face.normal,at=points[0];
    const planeZ=at[2]-(normal[0]*(x-at[0])+normal[1]*(y-at[1]))/normal[2];
    if(planeZ<=z+24&&planeZ>=z-maxDrop&&planeZ>best)best=planeZ;
  }
  return Number.isFinite(best)?best:null;
}
export function bspShouldGroundPreview(classname:string){
  const cls=classname.toLowerCase();
  if(cls==='info_player_start'||cls==='squadmaker'||cls==='monstermaker')return true;
  if(/^(item_|ammo_|weapon_)/.test(cls)||cls==='item_generic')return true;
  return cls.startsWith('monster_')&&!/(?:barnacle|ichthyosaur|controller|flyer|bat|tentacle|osprey|apache)/.test(cls);
}
/** Don't pull deliberately airborne props dozens of units down into the map;
 * ground only eligible previews that have a nearby valid compiled floor. */
export function bspPreviewGroundPosition(originZ:number,floorZ:number|null,footHeight:number,classname:string){
  if(floorZ===null||!bspShouldGroundPreview(classname))return originZ;
  const result=floorZ-footHeight+0.5,difference=result-originZ;
  const max=Math.max(18,classname.startsWith('monster_')?128:88);
  return Number.isFinite(result)&&Math.abs(difference)<=max?result:originZ;
}

function finiteNumber(value:string|undefined,defaultValue=0){
  const n=Number(value);return Number.isFinite(n)?n:defaultValue;
}
const stockNpcModels:Readonly<Record<string,string>>={
  monster_gman:'models/gman.mdl',monster_zombie:'models/zombie.mdl',monster_scientist:'models/scientist.mdl',
  monster_barney:'models/barney.mdl',monster_human_grunt:'models/hgrunt.mdl',
  monster_human_grunt_ally:'models/hgrunt_opfor.mdl',monster_grunt_ally_repel:'models/hgrunt_opfor.mdl',monster_headcrab:'models/headcrab.mdl',
  monster_houndeye:'models/houndeye.mdl',monster_bullsquid:'models/bullsquid.mdl',monster_alien_grunt:'models/agrunt.mdl',
  monster_alien_slave:'models/islave.mdl',monster_gonome:'models/gonome.mdl',monster_bigmomma:'models/big_mom.mdl',
  monster_tentacle:'models/tentacle2.mdl',monster_barnacle:'models/barnacle.mdl',monster_ichthyosaur:'models/icky.mdl',
};
export function bspResolvedModelPath(entity:BspEntity,studioByClass:Readonly<Record<string,string>>={}):string|null{
  if(!bspAllowStudioModel(entity.classname))return null;
  const explicit=bspMdlPath(entity.properties.model);
  if(explicit)return explicit;
  // Engine brush models (*N) must not be interpreted as MDL assets.
  if((entity.properties.model||'').trim().startsWith('*'))return null;
  const replacement=bspMdlPath(entity.properties.new_model)||bspMdlPath(entity.properties.custom_model);
  return replacement||bspMdlPath(studioByClass[entity.classname.toLowerCase()])||bspMdlPath(stockNpcModels[entity.classname.toLowerCase()])||
    (entity.classname.toLowerCase()==='info_player_start'?'models/player/gordon/gordon.mdl':null);
}
export function bspModelPlacements(entities:BspEntity[],maxInstances=72,maxModels=18,studioByClass:Readonly<Record<string,string>>={},selectedIndex:number|null=null,viewerOrigin?:readonly number[]):BspModelPlacement[]{
  const models=new Set<string>(),placements:BspModelPlacement[]=[];
  const anchor=viewerOrigin||selectedIndex!==null&&entities[selectedIndex]?.origin||entities.find(e=>e.classname==='info_player_start'&&e.origin)?.origin||[0,0,0];
  const distanceSq=(i:number)=>{
    const pos=entities[i].origin;
    return pos?(pos[0]-anchor[0])**2+(pos[1]-anchor[1])**2+(pos[2]-anchor[2])**2:Number.POSITIVE_INFINITY;
  };
  const indices=entities.map((_,i)=>i).sort((a,b)=>{
    if(a===selectedIndex)return -1;
    if(b===selectedIndex)return 1;
    return distanceSq(a)-distanceSq(b);
  });
  for(const i of indices){
    if(placements.length>=maxInstances)break;
    const e=entities[i],path=bspResolvedModelPath(e,studioByClass);
    if(!path||!e.origin||e.classname==='worldspawn')continue;
    const key=path.toLowerCase();
    if(!models.has(key)&&models.size>=maxModels)continue;
    models.add(key);
    const values=(e.properties.angles||'').trim().split(/\s+/).map(Number);
    const angles: [number,number,number]=values.length===3&&values.every(Number.isFinite)?[values[0],values[1],values[2]]:
      [0,finiteNumber(e.properties.angle),0];
    placements.push({index:i,path:key,origin:e.origin,angles,classname:e.classname,
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

/** Pose updates use real elapsed time and adapt their CPU budget to scene size.
 * Previous BSP rendering updated geometry every 90ms (~11 fps), visibly
 * stuttering even when the viewport itself ran at 60fps. */
export function bspIdlePoseInterval(vertexCount:number):number{
  if(!Number.isFinite(vertexCount)||vertexCount<=0)return 1/30;
  if(vertexCount>85000)return 1/18;
  if(vertexCount>38000)return 1/24;
  return 1/30;
}

/** Prioritize entity markers near the current viewport, not the first 800 BSP
 * records. Large Sven Co-op maps often store nearby NPCs late in the entity
 * lump; truncating by index made their markers appear only after an edit. */
export function bspNearestMarkerIndices(entities:ReadonlyArray<{classname:string;origin?:readonly number[]}>,cameraGame:readonly number[],limit=800,selected:number|null=null):number[]{
  const positions=entities.flatMap((entity,index)=>entity.classname!=='worldspawn'&&entity.origin?.length===3&&entity.origin.every(Number.isFinite)
    ?[{index,dist:(entity.origin[0]-cameraGame[0])**2+(entity.origin[1]-cameraGame[1])**2+(entity.origin[2]-cameraGame[2])**2}]:[]);
  if(positions.length>limit)positions.sort((a,b)=>a.dist-b.dist||a.index-b.index);
  const first=positions.slice(0,Math.max(1,limit)).map(item=>item.index);
  if(selected!==null&&selected>=0&&selected<entities.length&&!first.includes(selected)&&entities[selected].origin&&entities[selected].classname!=='worldspawn'){
    first[first.length-1]=selected;
  }
  return first;
}
