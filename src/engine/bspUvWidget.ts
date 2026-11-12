/** Pure gesture-to-UV operation mapping shared with the MAP Texture Studio 1.4.
 * The widget position is independent from scene/camera coordinates (uvOverlay.ts).
 */
import {gesturePatch,type UvHandle} from './textureStudio.ts';
import type {BspSurfaceOperation} from './bspSurfaceEdit.ts';
export function bspUvGestureOperation(handle:UvHandle,dx:number,dy:number,keepRatio:boolean,lit:boolean):BspSurfaceOperation{
  const patch=gesturePatch({texture:'DEFAULT',indices:[0,1,2],uShift:0,vShift:0,uScale:1,vScale:1,rotation:0},handle,dx,dy,keepRatio);
  const offsetU=patch.uShift??0,offsetV=patch.vShift??0;
  return {texture:-1,offsetU:lit?Math.round(offsetU/16)*16:offsetU,
    offsetV:lit?Math.round(offsetV/16)*16:offsetV,rotation:patch.rotation??0,
    scaleU:Math.max(.125,Math.min(8,patch.uScale??1)),scaleV:Math.max(.125,Math.min(8,patch.vScale??1))};
}
