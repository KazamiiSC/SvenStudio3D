/** Terrain & Shape Studio — GoldSrc/Svengine-only convex brush generation.
 * Never create Source displacement meshes or change project geometry until the
 * user explicitly applies a validated preview. Coordinates are GoldSrc XYZ.
 */
import type {Brush,Face,Vec3} from './types';
import {uid} from './types';
import {orientFaces,createBrush} from './geometry';
import {rebuildConvexBrush} from './modeling';
import {validateBrush} from './exportMap';

export const TERRAIN_RESOLUTIONS=[4,8,12,16] as const;
export type TerrainTool='raise'|'lower'|'smooth'|'flatten'|'noise';
export type TerrainDefinition={
  id:string;name:string;origin:Vec3;width:number;depth:number;resolution:number;
  heights:number[];texture:string;/** Optional for compatibility with terrain groups from Preview 1/2. */baseDepth?:number;brushIds:string[];brushSignatures:string[];
};
export type TerrainDraft=Pick<TerrainDefinition,'id'|'name'|'origin'|'width'|'depth'|'resolution'|'heights'|'texture'|'baseDepth'>;
export type RockOptions={origin:Vec3;count:number;radius:number;height:number;seed:number;texture:string};
const finite=(n:number)=>Number.isFinite(n);
const round=(n:number)=>Math.round(n*100)/100;
export function defaultTerrain(origin:Vec3=[0,0,0]):TerrainDraft{
  return {id:uid(),name:'Terrain 01',origin:[...origin],width:512,depth:512,resolution:8,heights:Array(81).fill(0),texture:'SV_BRICK01',baseDepth:96};
}
function terrainSignatureData(brush:Brush):string{
  return JSON.stringify([brush.position,brush.rotation,brush.scale,brush.vertices,brush.faces,brush.entityId]);
}
/** Compact, deterministic signature. Older projects stored the entire JSON
 * geometry as a signature, which duplicated every terrain vertex and face in
 * map metadata and every BuildTogether terrain update. Two independent 32-bit
 * hashes keep the saved signature under 24 bytes while detecting edits.
 */
export function terrainBrushSignature(brush:Brush):string{
  const data=terrainSignatureData(brush);
  let a=2166136261,b=0x9747b28c;
  for(let i=0;i<data.length;i++){
    const c=data.charCodeAt(i);
    a=Math.imul(a^c,16777619);
    b=Math.imul(b^(c+(i&255)),0x5bd1e995);
  }
  return `v2:${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}`;
}
/** Old user projects remain editable. The legacy JSON is computed only when
 * its stored signature actually is legacy JSON; no silent format migration. */
export function terrainBrushMatchesSignature(brush:Brush,signature:string):boolean{
  if(signature.startsWith('v2:'))return terrainBrushSignature(brush)===signature;
  return terrainSignatureData(brush)===signature;
}
export function validateTerrainDraft(d:TerrainDraft):string[]{
  const errors:string[]=[];
  if(!TERRAIN_RESOLUTIONS.includes(d.resolution as typeof TERRAIN_RESOLUTIONS[number]))errors.push('Unsupported terrain resolution.');
  if(!finite(d.width)||!finite(d.depth)||d.width<64||d.depth<64||d.width>4096||d.depth>4096)errors.push('Terrain width/depth must be 64–4096 units.');
  if([d.width/d.resolution,d.depth/d.resolution].some(x=>!finite(x)||x<8))errors.push('Terrain cells must be at least 8 units wide.');
  if(d.origin.length!==3||d.origin.some(x=>!finite(x)||Math.abs(x)>125000))errors.push('Invalid terrain position.');
  if(d.heights.length!==(d.resolution+1)**2||d.heights.some(h=>!finite(h)||h< -512||h>512))errors.push('Invalid terrain heights (limit ±512).');
  if(d.baseDepth!==undefined&&(!finite(d.baseDepth)||d.baseDepth<64||d.baseDepth>1024))errors.push('Terrain base depth must be 64–1024 units.');
  if(!/^[^\s"()[\]]{1,32}$/.test(d.texture))errors.push('Invalid GoldSrc texture name.');
  return errors;
}
export function sculptTerrain(d:TerrainDraft,tool:TerrainTool,atX:number,atY:number,radius:number,strength:number):number[]{
  const errors=validateTerrainDraft(d);
  if(errors.length)throw Error(errors[0]);
  if(![atX,atY,radius,strength].every(finite)||radius<=0||strength<0||strength>128)throw Error('Invalid brush settings.');
  const n=d.resolution,original=d.heights,next=[...original];
  const index=(i:number,j:number)=>j*(n+1)+i;
  const ix=Math.round(Math.min(n,Math.max(0,atX/d.width*n)));
  const iy=Math.round(Math.min(n,Math.max(0,atY/d.depth*n)));
  const target=original[index(ix,iy)];
  for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){
    const distance=Math.hypot((i/n*d.width-atX),(j/n*d.depth-atY));
    if(distance>radius)continue;
    const weight=(1-distance/radius)**2;
    const k=index(i,j),h=original[k];
    let changed=h;
    if(tool==='raise')changed=h+strength*weight;
    if(tool==='lower')changed=h-strength*weight;
    if(tool==='flatten')changed=h+(target-h)*Math.min(1,strength/40)*weight;
    if(tool==='smooth'){
      let total=0,c=0;
      for(let y=Math.max(0,j-1);y<=Math.min(n,j+1);y++)for(let x=Math.max(0,i-1);x<=Math.min(n,i+1);x++){
        total+=original[index(x,y)];c++;
      }
      changed=h+(total/c-h)*Math.min(1,strength/40)*weight;
    }
    if(tool==='noise'){
      const noise=Math.sin((i+17)*127.1+(j+13)*311.7)*43758.5453;
      changed=h+((noise-Math.floor(noise))*2-1)*strength*weight;
    }
    next[k]=round(Math.max(-512,Math.min(512,changed)));
  }
  return next;
}
/** Lowest wall of the solid terrain, in world GoldSrc Z. Preview 1/2 had
 * exactly this rule with 96 as its implicit default. Keeping the legacy
 * fallback preserves brushes in previously saved projects until edited.
 * The automatic 64-u clearance prevents a bottom plane crossing a valley.
 */
export function terrainBaseZ(d:TerrainDraft):number{
  return round(d.origin[2]+Math.min(-(d.baseDepth??96),Math.min(...d.heights)-64));
}
/** Source-of-truth vertex for export and preview; values are rounded to
 * GoldSrc MAP precision, so the visible outer silhouette is identical.
 */
export function terrainTopVertex(d:TerrainDraft,i:number,j:number):Vec3{
  const n=d.resolution,cellX=d.width/n,cellY=d.depth/n;
  return [round(d.origin[0]-d.width/2+i*cellX),
    round(d.origin[1]-d.depth/2+j*cellY),
    round(d.origin[2]+d.heights[j*(n+1)+i])];
}
/** Triangulated exterior of the exported *solid* terrain. Unlike the brush
 * export, this only renders the outside skin: top, boundary walls and bottom.
 * This avoids z-fighting between adjacent internal brush faces in WebGL.
 * Positions are local Three.js XYZ (GoldSrc X,Z,-Y), relative to origin.
 * Texture UVs are approximate; actual GoldSrc texture axes come from MAP.
 */
export function createTerrainPreviewShell(d:TerrainDraft){
  const problems=validateTerrainDraft(d);if(problems.length)throw Error(problems.join(' '));
  const n=d.resolution,base=terrainBaseZ(d);
  const topPositions:number[]=[],topUvs:number[]=[],basePositions:number[]=[],baseUvs:number[]=[];
  const vertex=(i:number,j:number)=>terrainTopVertex(d,i,j);
  const lower=(p:Vec3):Vec3=>[p[0],p[1],base];
  const add=(positions:number[],uvs:number[],p:Vec3,side=false,xside=false)=>{
    positions.push(round(p[0]-d.origin[0]),round(p[2]-d.origin[2]),round(d.origin[1]-p[1]));
    uvs.push((side?(xside?p[1]:p[0]):p[0])/64,(side?p[2]:p[1])/64);
  };
  const triangle=(positions:number[],uvs:number[],a:Vec3,b:Vec3,c:Vec3,side=false,xside=false)=>{
    add(positions,uvs,a,side,xside);add(positions,uvs,b,side,xside);add(positions,uvs,c,side,xside);
  };
  const wall=(a:Vec3,b:Vec3,xside=false)=>{
    triangle(basePositions,baseUvs,a,b,lower(b),true,xside);
    triangle(basePositions,baseUvs,a,lower(b),lower(a),true,xside);
  };
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const a=vertex(i,j),b=vertex(i+1,j),c=vertex(i+1,j+1),e=vertex(i,j+1);
    // Same two top triangles as createTerrainBrushes.
    triangle(topPositions,topUvs,a,b,c);
    triangle(topPositions,topUvs,a,c,e);
    triangle(basePositions,baseUvs,lower(c),lower(b),lower(a));
    triangle(basePositions,baseUvs,lower(e),lower(c),lower(a));
  }
  for(let i=0;i<n;i++){
    wall(vertex(i,0),vertex(i+1,0));
    wall(vertex(i+1,n),vertex(i,n));
  }
  for(let j=0;j<n;j++){
    wall(vertex(0,j+1),vertex(0,j),true);
    wall(vertex(n,j),vertex(n,j+1),true);
  }
  return {topPositions,topUvs,basePositions,baseUvs,bottomZ:base};
}
/** Two 5-face closed triangular prisms per cell (GoldSrc planar, convex). */
export function createTerrainBrushes(d:TerrainDraft,existingIds?:string[]):Brush[]{
  const issues=validateTerrainDraft(d);if(issues.length)throw Error(issues.join(' '));
  const n=d.resolution,bottom=terrainBaseZ(d);
  const top=(i:number,j:number):Vec3=>terrainTopVertex(d,i,j);
  const output:Brush[]=[];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const p00=top(i,j),p10=top(i+1,j),p01=top(i,j+1),p11=top(i+1,j+1);
    for(const tri of [[p00,p10,p11],[p00,p11,p01]]){
      const vertices:Vec3[]=[...tri, ...tri.map(([x,y])=>[x,y,round(bottom)] as Vec3)];
      const faceIndices=[[0,1,2],[5,4,3],[0,3,4,1],[1,4,5,2],[2,5,3,0]];
      const faces:Face[]=orientFaces(vertices,faceIndices.map(indices=>({indices,texture:d.texture})));
      const brush:Brush={id:existingIds?.[output.length]||uid(),kind:'brush',name:`${d.name} · ${output.length+1}`,
        primitive:'poly',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices,faces,layer:'Terrain',group:d.name};
      const errors=validateBrush(brush);if(errors.length)throw Error(`Terrain cell ${i},${j}: ${errors[0]}`);
      output.push(brush);
    }
  }
  return output;
}
export function terrainRecord(d:TerrainDraft,brushes:Brush[]):TerrainDefinition{
  return {...d,origin:[...d.origin],heights:[...d.heights],brushIds:brushes.map(b=>b.id),brushSignatures:brushes.map(terrainBrushSignature)};
}
function random(seed:number){let x=Math.floor(seed)||1;return ()=>{x=(Math.imul(1664525,x)+1013904223)|0;return (x>>>0)/4294967296}}
/** Individual convex rock fragments; this is not a Source mesh/displacement. */
export function createRockCluster(options:RockOptions):Brush[]{
  const {origin,count,radius,height,seed,texture}=options;
  if(origin.length!==3||origin.some(n=>!finite(n)||Math.abs(n)>125000)||![count,radius,height,seed].every(finite)||count<1||count>24||!Number.isInteger(count)||radius<16||radius>512||height<16||height>512)throw Error('Invalid rock cluster settings.');
  if(!/^[^\s"()[\]]{1,32}$/.test(texture))throw Error('Invalid rock texture.');
  const rnd=random(seed),group=`Rocks ${uid().slice(-6)}`;
  return Array.from({length:count},(_,i)=>{
    const angle=rnd()*Math.PI*2,dist=Math.sqrt(rnd())*radius*.7;
    const width=(.48+rnd()*.48)*radius,depth=(.48+rnd()*.48)*radius,tall=(.55+rnd()*.65)*height;
    const brush=createBrush('icosphere',[round(origin[0]+Math.cos(angle)*dist),round(origin[1]+Math.sin(angle)*dist),round(origin[2]+tall*.38)],[width,depth,tall],`Rock ${i+1}`);
    const points=brush.vertices.map((v,j)=>{
      const irregularity=.86+rnd()*.22;
      return v.map((x,k)=>round(x*irregularity*(k===2?(.92+j%3*.04):1))) as Vec3;
    });
    const candidate=rebuildConvexBrush(brush,points,{requireAllVertices:false});
    candidate.faces=candidate.faces.map(f=>({...f,texture}));
    candidate.layer='Terrain';candidate.group=group;
    const errors=validateBrush(candidate);if(errors.length)throw Error(`Rock ${i+1}: ${errors[0]}`);
    return candidate;
  });
}
