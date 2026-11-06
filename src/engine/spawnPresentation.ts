/** Editor-only spawn presentation helpers; never move or rewrite the spawn origin. */
import type {Brush,MapObject,Vec3} from './types';
import type {StudioPreview} from './mdl';
import {transformedVertices} from './geometry';

export function spawnYaw(props:Record<string,string>):number{
  const parts=(props.angles||'').trim().split(/\s+/);
  const candidate=parts.length>=2?Number(parts[1]):Number(props.angle||0);
  return Number.isFinite(candidate)?((candidate%360)+360)%360:0;
}
export function withSpawnYaw(props:Record<string,string>,yaw:number):string{
  const parts=(props.angles||'0 0 0').trim().split(/\s+/);
  const pitch=Number(parts[0])||0,roll=Number(parts[2])||0;
  return `${pitch} ${((Math.round(yaw)%360)+360)%360} ${roll}`;
}
/** Raycast vertically against world brush polygons. Only faces spanning x/y
 * can act as a floor; brush entities (doors/triggers) are excluded.
 * Spawn origin is typically above the player's feet in GoldSrc. */
export function spawnFloorZ(spawn:Vec3,objects:MapObject[],fallbackOffset=36):number{
  let best=-Infinity;
  const [x,y,z]=spawn;
  for(const object of objects){
    if(object.kind!=='brush'||object.hidden||object.entityId)continue;
    const vertices=transformedVertices(object as Brush);
    for(const face of object.faces){
      if(face.indices.length<3)continue;
      const origin=vertices[face.indices[0]];
      if(!origin)continue;
      for(let i=1;i+1<face.indices.length;i++){
        const a=origin,b=vertices[face.indices[i]],c=vertices[face.indices[i+1]];
        if(!b||!c)continue;
        const det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1]);
        if(Math.abs(det)<1e-6)continue;
        const wA=((b[1]-c[1])*(x-c[0])+(c[0]-b[0])*(y-c[1]))/det;
        const wB=((c[1]-a[1])*(x-c[0])+(a[0]-c[0])*(y-c[1]))/det;
        const wC=1-wA-wB;
        if(wA<-.001||wB<-.001||wC<-.001)continue;
        const height=wA*a[2]+wB*b[2]+wC*c[2];
        if(height<=z+12&&height>=z-256&&height>best)best=height;
      }
    }
  }
  return Number.isFinite(best)?best:z-fallbackOffset;
}

/** Lowest vertex in the ACTUAL idle pose and active bodygroups shown by StudioModel.
 * Measuring data.meshes in the bind pose can bury the legs when a GoldSrc idle
 * sequence moves the root bone, or when other bodygroups have different bounds.
 * This is editor-only; it never changes info_player_start.origin or exported MAP.
 */
export function spawnModelFootHeight(data:StudioPreview,body=0):number{
  const selected=data.bodyparts.flatMap(part=>{
    const index=part.base>0&&part.models.length>0
      ? Math.floor(Math.max(0,body)/part.base)%part.models.length:0;
    return part.models[index]?.meshes||[];
  });
  const preferred=data.sequences.findIndex(sequence=>sequence.available&&/^(idle|idle1|idle2|stand|rest)$/i.test(sequence.name||''));
  const sequence=preferred>=0?preferred:data.sequences.findIndex(item=>item.available&&item.loop&&item.frames>1);
  const poses:ReturnType<StudioPreview['samplePose']>[]=[];
  if(sequence>=0){
    try{
      const count=Math.max(1,Math.min(8,data.sequences[sequence].frames));
      for(let i=0;i<count;i++){
        const frame=count===1?0:Math.round(i*(data.sequences[sequence].frames-1)/(count-1));
        poses.push(data.samplePose(sequence,frame));
      }
    }catch{/* Use the bind pose if animation data is corrupt. */}
  }
  let bottom=Infinity;
  for(const pose of (poses.length?poses:[null])){
    for(const mesh of selected){
      for(let i=0;i<mesh.positions.length;i+=3){
        const bone=pose?.[mesh.boneIndices[i/3]];
        const local=mesh.localPositions;
        const m=bone?.elements;
        // ModelGeometry converts MDL Z-up into Three Y-up after skinning.
        const y=m?m[2]*local[i]+m[6]*local[i+1]+m[10]*local[i+2]+m[14]:mesh.positions[i+1];
        if(Number.isFinite(y)&&y<bottom)bottom=y;
      }
    }
  }
  return Number.isFinite(bottom)?bottom:0;
}
