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
