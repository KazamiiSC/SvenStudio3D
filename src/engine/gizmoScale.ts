/** The six face handles use screen pixels, not fixed GoldSrc world units.
 * This keeps a tiny 8u switch and a 1024u wall equally controllable. */
export function unitsPerScreenPixel(input:{orthographic:boolean;cameraDepth:number;fovDegrees:number;orthoHeight:number;zoom:number;viewportHeight:number}):number{
  const height=Math.max(1,input.viewportHeight);
  const zoom=Math.max(0.001,input.zoom);
  if(input.orthographic)return Math.max(.00001,input.orthoHeight/zoom/height);
  const fov=Math.min(179,Math.max(1,input.fovDegrees))*Math.PI/180;
  return Math.max(.00001,2*Math.max(.01,input.cameraDepth)*Math.tan(fov/2)/zoom/height);
}
/** World units per pixel along the camera's current sight line. */
export const FACE_GIZMO_TIP_PIXELS=29;
export const FACE_GIZMO_HIT_PIXELS=15;
export function preciseFaceDistance(distance:number,step:number,snap:boolean,fine:boolean):number{
  const adjusted=fine?distance*.25:distance;
  if(!snap||fine||!Number.isFinite(step)||step<=0)return adjusted;
  return Math.round(adjusted/step)*step;
}
