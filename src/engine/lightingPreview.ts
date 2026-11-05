/**
 * Visual-only Svengine light approximation for SvenStudio 3D Rendered mode.
 * The _light key is in GoldSrc compile units, whereas Three.js r175 PointLight
 * and SpotLight use physically attenuated luminous intensities (decay=2).
 * Passing raw _light/110 as a Three intensity produced almost no illumination
 * at a typical 128–512 unit distance. These conversion constants are tuned
 * for editor-scale geometry, not SC-RAD's baked lightmaps.
 */
export type PreviewLocalLight={intensity:number;distance:number;decay:2};
export type PreviewSunLight={intensity:number;diffuseIntensity:number};
const clamp=(n:number,min:number,max:number)=>Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;

export function previewLocalLight(brightness:number,kind:'point'|'spot'='point'):PreviewLocalLight{
  const level=clamp(brightness,1,4000);
  // Preserve the relative strength of user-authored _light values while using
  // a calibrated scale for Three.js's 1 / distance² attenuation.
  const energy=kind==='spot'?560:400;
  return {
    intensity:clamp(level*energy,400,1_800_000),
    distance:clamp(440+Math.sqrt(level)*35,580,2650),
    decay:2
  };
}

export function previewSunLight(brightness:number,diffuseBrightness:number):PreviewSunLight{
  return {
    intensity:clamp(brightness/210,0.02,4.5),
    diffuseIntensity:clamp(diffuseBrightness/480,0,0.6)
  };
}

/** GoldSrc pitch=-90 points straight down; the exported map remains unchanged.
 * Returns a direction in Three.js world axes (X right, Y up, Z back).
 * A negative pitch is down, yaw is a horizontal GoldSrc rotation.
 */
export function previewDirection(pitchInput:string|number|undefined,yawInput:string|number|undefined):[number,number,number]{
  const pitch=clamp(Number(pitchInput??-45),-90,90)*Math.PI/180;
  const yaw=(Number.isFinite(Number(yawInput))?Number(yawInput):0)*Math.PI/180;
  const cos=Math.cos(pitch),x=cos*Math.cos(yaw),y=Math.sin(pitch),z=-cos*Math.sin(yaw);
  return [x,y,z];
}

export function previewCone(innerInput:string|number|undefined,outerInput:string|number|undefined):{angle:number;penumbra:number}{
  const outer=clamp(Number(outerInput??55),2,178);
  const inner=clamp(Number(innerInput??30),1,outer);
  return {angle:outer*Math.PI/360,penumbra:clamp(1-inner/outer,0.08,0.9)};
}
