import type {Brush,MapObject,Vec3} from './types';
import {createBrush,transformedVertices} from './geometry';

/** A generated sky enclosure is made from six separate *solid* world brushes.
 *  The cavity remains EMPTY; one giant SKY-textured box is not equivalent. */
export const SKY_ENCLOSURE_GROUP = 'Sven Studio · Auto Sky Enclosure';
export const SKY_ENCLOSURE_LAYER = 'Sky Enclosure';
export type SkyEnclosureOptions = {margin:number;thickness:number;grid:number;hideInEditor:boolean};
export const DEFAULT_SKY_ENCLOSURE:SkyEnclosureOptions = {margin:256,thickness:32,grid:16,hideInEditor:true};
export type SkyEnclosureBounds = {min:Vec3;max:Vec3};
export type SkyEnclosureResult = {
  brushes:Brush[];objects:MapObject[];inner:SkyEnclosureBounds;outer:SkyEnclosureBounds;replaced:number;
};

export function isAutoSkyEnclosure(o:MapObject):boolean {
  return o.kind==='brush'&&o.group===SKY_ENCLOSURE_GROUP;
}

function finiteBetween(value:number,min:number,max:number,label:string):number {
  if(!Number.isFinite(value)||value<min||value>max)throw new Error(`${label} must be between ${min} and ${max}.`);
  return value;
}

export function createSkyEnclosure(objects:MapObject[],options:SkyEnclosureOptions=DEFAULT_SKY_ENCLOSURE):SkyEnclosureResult {
  const margin=finiteBetween(options.margin,32,4096,'Sky margin');
  const thickness=finiteBetween(options.thickness,8,256,'Sky thickness');
  const grid=finiteBetween(options.grid,1,128,'Sky grid');
  const original=objects.filter(o=>!isAutoSkyEnclosure(o));
  const worldBrushes=original.filter((o):o is Brush=>o.kind==='brush'&&!o.entityId);
  if(!worldBrushes.length)throw new Error('Create at least one world brush before generating a sky enclosure.');
  // A common GoldSrc mistake is a single giant solid SKY box around the
  // playable area. It seals leaks but fills the room with solid worldspawn,
  // often leaving SC-RAD with no valid light patches.
  const playerSpawns=original.filter(o=>o.kind==='entity'&&o.classname.startsWith('info_player_'));
  for(const brush of worldBrushes){
    if(!brush.faces.length||!brush.faces.every(f=>f.texture.toUpperCase()==='SKY'))continue;
    const verts=transformedVertices(brush);
    const low=[0,1,2].map(i=>Math.min(...verts.map(v=>v[i])));
    const high=[0,1,2].map(i=>Math.max(...verts.map(v=>v[i])));
    if(playerSpawns.some(spawn=>[0,1,2].every(i=>spawn.position[i]>low[i]+1&&spawn.position[i]<high[i]-1))){
      throw new Error('Remove the large solid SKY cube first; it still occupies the playable space.');
    }
  }
  const points:Vec3[]=worldBrushes.flatMap(transformedVertices);
  // Place named point entities inside the enclosure as well. A light outside
  // the walls can otherwise cause a leak despite the visual sky ceiling.
  for(const entity of original)if(entity.kind==='entity')points.push(entity.position);
  if(!points.length||points.some(p=>p.some(v=>!Number.isFinite(v))))throw new Error('Invalid map coordinates.');
  const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
  for(const p of points)for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}
  const inner:SkyEnclosureBounds={
    min:min.map(v=>Math.floor((v-margin)/grid)*grid) as Vec3,
    max:max.map(v=>Math.ceil((v+margin)/grid)*grid) as Vec3
  };
  const outer:SkyEnclosureBounds={
    min:inner.min.map(v=>v-thickness) as Vec3,
    max:inner.max.map(v=>v+thickness) as Vec3
  };
  // Conservative GoldSrc-safe check; oversized sky volumes can exceed BSP limits.
  if(outer.min.some(v=>v< -16384)||outer.max.some(v=>v>16384)||outer.max.some((v,i)=>v-outer.min[i]>16384)){
    throw new Error('The sky enclosure would exceed a safe GoldSrc map extent. Reduce the margin or move distant objects.');
  }
  const [x0,y0,z0]=inner.min,[x1,y1,z1]=inner.max;
  const [ox0,oy0,oz0]=outer.min,[ox1,oy1,oz1]=outer.max;
  const slabs: {name:string;min:Vec3;max:Vec3}[]=[
    {name:'Floor',min:[ox0,oy0,oz0],max:[ox1,oy1,z0]},
    {name:'Ceiling',min:[ox0,oy0,z1],max:[ox1,oy1,oz1]},
    {name:'West',min:[ox0,y0,z0],max:[x0,y1,z1]},
    {name:'East',min:[x1,y0,z0],max:[ox1,y1,z1]},
    {name:'South',min:[ox0,oy0,z0],max:[ox1,y0,z1]},
    {name:'North',min:[ox0,y1,z0],max:[ox1,oy1,z1]}
  ];
  const brushes=slabs.map(({name,min,max})=>{
    const center=min.map((v,i)=>(v+max[i])/2) as Vec3;
    const size=min.map((v,i)=>max[i]-v) as Vec3;
    const brush=createBrush('box',center,size,`Sky Enclosure · ${name}`);
    brush.group=SKY_ENCLOSURE_GROUP;
    brush.layer=SKY_ENCLOSURE_LAYER;
    brush.hidden=options.hideInEditor;
    brush.faces=brush.faces.map(face=>({...face,texture:'SKY'}));
    return brush;
  });
  return {brushes,objects:[...original,...brushes],inner,outer,replaced:objects.length-original.length};
}
