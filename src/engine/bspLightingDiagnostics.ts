import type {BspFace} from './bsp';
import {composeBspFaceLighting} from './bspLighting.ts';
import type {BspEntity} from './bsp';

/** Objective diagnostics for a compiled BSP, not an estimate from Three.js.
 * Nonzero does not prove the game will look identical, but near-zero lightmaps
 * explain why a physically honest baked renderer produces black polygons. */
export function inspectBspLighting(faces:readonly BspFace[],entities:readonly BspEntity[]=[],frame=0){
  let litFaces=0,missingFaces=0,zeroFaces=0,samples=0,sum=0,nonZero=0,peak=0;
  for(const face of faces){
    const rgb=composeBspFaceLighting(face,entities,frame);
    if(!rgb?.length){missingFaces++;continue}
    litFaces++;
    let facePeak=0;
    for(let i=0;i<rgb.length;i+=3){
      const luminance=(rgb[i]*0.2126+rgb[i+1]*0.7152+rgb[i+2]*0.0722);
      sum+=luminance;samples++;
      if(luminance>0.5)nonZero++;
      facePeak=Math.max(facePeak,rgb[i],rgb[i+1],rgb[i+2]);
      peak=Math.max(peak,facePeak);
    }
    if(!facePeak)zeroFaces++;
  }
  const average=samples?sum/samples:0;
  return {litFaces,missingFaces,zeroFaces,samples,nonZero,peak,average,
    status:litFaces===0?'missing':nonZero===0?'black':average<2?'very-dark':'valid'} as const;
}
