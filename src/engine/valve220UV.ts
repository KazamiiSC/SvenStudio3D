/** GoldSrc / Valve 220 face projection, matching compiled BSP texinfo.
 * Compiler stores axis / scale in vecs[0..2] and the shift directly in
 * vecs[3]. Thus the shift is in TEXELS and must not be divided by scale.
 * This common implementation is shared by preview and UV tools.
 */
import type {Vec3} from './types';
export const texelAt=(point:Vec3,axis:Vec3,scale:number,shift:number):number=>
  (point[0]*axis[0]+point[1]*axis[1]+point[2]*axis[2])/(scale||1)+shift;
export const normalizedUvAt=(point:Vec3,axis:Vec3,scale:number,shift:number,size:number):number=>
  texelAt(point,axis,scale,shift)/(size||128);
/** Translation compensation in texels; phase preserved even for scales != 1. */
export const translateTexelShift=(original:number,delta:Vec3,axis:Vec3,scale:number):number=>
  original-(delta[0]*axis[0]+delta[1]*axis[1]+delta[2]*axis[2])/(scale||1);
/** Preserve the original face's texture phase when replacing an axis. */
export const rebaseTexelShift=(original:number,anchor:Vec3,oldAxis:Vec3,newAxis:Vec3,scale:number):number=>
  original+((anchor[0]*(oldAxis[0]-newAxis[0])+anchor[1]*(oldAxis[1]-newAxis[1])+anchor[2]*(oldAxis[2]-newAxis[2]))/(scale||1));
