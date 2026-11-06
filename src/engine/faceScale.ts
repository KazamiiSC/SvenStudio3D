/** Face-based resizing of convex GoldSrc brushes. No vertices/faces are rewritten:
 * only a positive local scale and a world-position offset are committed. */
import * as THREE from 'three';
import type {Brush,Vec3} from './types';
export type FaceAxis=0|1|2;
export type FaceSign=-1|1;
export function faceLocalBounds(brush:Brush){
  const mins:[number,number,number]=[Infinity,Infinity,Infinity];
  const maxs:[number,number,number]=[-Infinity,-Infinity,-Infinity];
  for(const vertex of brush.vertices)for(let i=0;i<3;i++){mins[i]=Math.min(mins[i],vertex[i]);maxs[i]=Math.max(maxs[i],vertex[i]);}
  return {mins,maxs};
}
export function resizeFromFace(brush:Brush,axis:FaceAxis,sign:FaceSign,travel:number,minWidth=4):{position:Vec3;scale:Vec3}{
  if(brush.kind!=='brush'||!Number.isFinite(travel)||!brush.vertices.length)throw Error('Invalid face resize');
  const {mins,maxs}=faceLocalBounds(brush);
  const originalSpan=(maxs[axis]-mins[axis])*brush.scale[axis];
  if(!(originalSpan>.0001)||brush.scale[axis]<=0)throw Error('Degenerate brush face');
  const nextSpan=Math.max(minWidth,Math.min(16384,originalSpan+travel));
  const updatedScale=[...brush.scale] as Vec3;
  updatedScale[axis]*=nextSpan/originalSpan;
  // Moving one face keeps the opposite local plane fixed even for rotated,
  // off-center, or irregular brushes.
  const fixedLocal=sign===1?mins[axis]:maxs[axis];
  const offset=new THREE.Vector3();
  offset.setComponent(axis,(brush.scale[axis]-updatedScale[axis])*fixedLocal);
  const euler=new THREE.Euler(...brush.rotation.map(r=>THREE.MathUtils.degToRad(r)) as Vec3,'XYZ');
  offset.applyEuler(euler);
  return {position:brush.position.map((v,i)=>v+offset.getComponent(i)) as Vec3,scale:updatedScale};
}
