/** BSP30 baked lighting coordinates. Three.js r175 uses `uv1` for Texture.channel=1.
 * GoldSrc light sample coordinates are spaced 16 world-texture texels apart.
 * The atlas uses a flipped canvas (Y grows downward). Do not reuse base UVs. */
export const BSP_LIGHTMAP_UV_CHANNEL = 1;
export const BSP_LIGHTMAP_DEFAULT_INTENSITY = 2.6;
export const BSP_LIGHTMAP_DEFAULT_AMBIENT = 0.32;

export type BspLightmapPlacement = {x:number;y:number};
export function bspLightmapAtlasUv(
  texel:[number,number], lightMin:[number,number], placement:BspLightmapPlacement, atlasSize:number
):[number,number]{
  if(!Number.isFinite(atlasSize)||atlasSize<=0)throw Error('Invalid BSP lightmap atlas size');
  const lux=(texel[0]-lightMin[0]*16)/16+0.5;
  const luy=(texel[1]-lightMin[1]*16)/16+0.5;
  return [(placement.x+lux)/atlasSize,1-(placement.y+luy)/atlasSize];
}

/** Single-face texture coordinates for the small-map precision path.
 * Exactly one luxel is sampled at each integer GoldSrc 16-unit light step.
 * The one-pixel duplicated border prevents black bleeding at the perimeter.
 */
export function bspDirectLightmapUv(
  texel:[number,number],lightMin:[number,number],lightWidth:number,lightHeight:number
):[number,number]{
  if(lightWidth<1||lightHeight<1)throw Error('Invalid face lightmap size');
  const u=(texel[0]-16*lightMin[0])/16+1.5;
  const v=(texel[1]-16*lightMin[1])/16+1.5;
  return [u/(lightWidth+2),1-v/(lightHeight+2)];
}

/** RGBA with a 1-pixel replicated edge, suitable for exact per-face sampling. */
export function bspPaddedLightmap(rgb:Uint8Array,width:number,height:number):Uint8ClampedArray{
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||width>256||height>256||rgb.length!==width*height*3)
    throw Error('Invalid compiled RGB face samples');
  const rgba=new Uint8ClampedArray((width+2)*(height+2)*4);
  for(let y=-1;y<=height;y++)for(let x=-1;x<=width;x++){
    const sourceX=Math.max(0,Math.min(width-1,x)),sourceY=Math.max(0,Math.min(height-1,y));
    const src=(sourceY*width+sourceX)*3,dst=((y+1)*(width+2)+x+1)*4;
    rgba[dst]=rgb[src];rgba[dst+1]=rgb[src+1];rgba[dst+2]=rgb[src+2];rgba[dst+3]=255;
  }
  return rgba;
}
