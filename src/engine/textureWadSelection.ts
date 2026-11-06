import type {TextureAsset} from './types';
/** GoldSrc compilers resolve textures by name and WAD search order.
 * Resolve preview and texture dimensions from that same first available WAD,
 * instead of whichever archive happened to be imported last. */
export function wadBasename(path:string):string{return path.trim().replace(/\\/g,'/').split('/').pop()?.toLowerCase()||'';}
export function preferredTextureAssets(assets:TextureAsset[],paths:string[],projectWads:string[]=[]):Map<string,TextureAsset>{
  const order=(paths.length?paths:projectWads).map(wadBasename);
  const priorities=new Map(order.map((name,index)=>[name,index]));
  const selected=new Map<string,{asset:TextureAsset;rank:number}>();
  for(const asset of assets){
    const key=asset.name.toLowerCase(),rank=priorities.get(asset.wad.toLowerCase())??Number.MAX_SAFE_INTEGER;
    const current=selected.get(key);
    if(!current||rank<current.rank||rank===current.rank)selected.set(key,{asset,rank});
  }
  return new Map([...selected].map(([name,value])=>[name,value.asset]));
}
