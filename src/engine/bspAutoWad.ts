import type {TextureAsset} from './types';
export type AutoWadTexture={name:string;width:number;height:number;indices:string;palette:string;wad:string;source:string};
export type AutoWadResponse={textures:AutoWadTexture[];missing:string[];scanned:number;truncated:boolean};

/** Bounded per-request searches avoid sending hundreds of BSP names at once.
 * The server has an independent texture and reply-size budget. */
export const BSP_WAD_BATCH_SIZE=64;
export function bspWadBatches(textureNames:string[],batchSize=BSP_WAD_BATCH_SIZE):string[][]{
  const unique=[...new Set(textureNames.map(name=>name.trim()).filter(Boolean))];
  const size=Math.max(1,Math.min(128,Math.floor(batchSize)||BSP_WAD_BATCH_SIZE));
  const batches:string[][]=[];
  for(let i=0;i<unique.length;i+=size)batches.push(unique.slice(i,i+size));
  return batches;
}
export type AutoWadProgress={textures:AutoWadTexture[];missing:string[];scanned:number;limited:boolean;batchesCompleted:number;batchesTotal:number};
/** Search all requested texture names in batches, retaining results across pages.
 * Aborting cancels future pages; the caller guards against stale map responses. */
export async function fetchBspAutoWads(
  gameDir:string,wadNames:string[],textureNames:string[],signal:AbortSignal,
  onProgress?:(result:AutoWadProgress)=>void,
  request:typeof fetch=fetch,
):Promise<AutoWadProgress>{
  const batches=bspWadBatches(textureNames);
  const result:AutoWadProgress={textures:[],missing:[],scanned:0,limited:false,batchesCompleted:0,batchesTotal:batches.length};
  const found=new Set<string>();
  for(const names of batches){
    if(signal.aborted)throw new DOMException('WAD search cancelled.','AbortError');
    const response=await request('/api/bsp/wad-textures',{
      method:'POST',signal,headers:{'Content-Type':'application/json'},
      body:JSON.stringify({gameDir,wadNames,textureNames:names}),
    });
    const data=await response.json() as AutoWadResponse & {error?:string};
    if(!response.ok)throw Error(data.error||`HTTP ${response.status}`);
    for(const texture of data.textures){
      const key=texture.name.toLowerCase();
      if(!found.has(key)){found.add(key);result.textures.push(texture)}
    }
    result.missing.push(...data.missing);
    result.scanned+=data.scanned;
    result.limited||=data.truncated;
    result.batchesCompleted++;
    onProgress?.({...result,textures:[...result.textures],missing:[...result.missing]});
  }
  return result;
}
function decodeBase64(text:string){
  const binary=atob(text),result=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)result[i]=binary.charCodeAt(i);
  return result;
}
/** Build lazy client previews: WAD3 palette indices are decoded only when displayed. */
export function autoWadTexturesToAssets(items:AutoWadTexture[]):TextureAsset[]{
  return items.filter(item=>item.width>0&&item.height>0&&item.width*item.height<=4*1024*1024).map((item,i)=>{
    let full:string|undefined,thumb:string|undefined,indices:Uint8Array|undefined,palette:Uint8Array|undefined;
    const draw=(limit:number)=>{
      indices??=decodeBase64(item.indices);palette??=decodeBase64(item.palette);
      const ratio=Math.min(1,limit/Math.max(item.width,item.height)),w=Math.max(1,Math.round(item.width*ratio)),h=Math.max(1,Math.round(item.height*ratio));
      const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext('2d');if(!ctx)return '';
      const image=ctx.createImageData(w,h);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){
        const sy=Math.min(item.height-1,Math.floor(y*item.height/h)),sx=Math.min(item.width-1,Math.floor(x*item.width/w));
        const idx=indices[sy*item.width+sx]??0,p=Math.min(idx,255)*3,o=(y*w+x)*4;
        image.data[o]=palette[p]??0;image.data[o+1]=palette[p+1]??0;image.data[o+2]=palette[p+2]??0;
        image.data[o+3]=item.name.startsWith('{')&&idx===255?0:255;
      }
      ctx.putImageData(image,0,0);
      return canvas.toDataURL('image/png');
    };
    return {name:item.name,wad:`${item.source}/${item.wad}`,width:item.width,height:item.height,sourceId:`auto-bsp:${i}`,
      get thumbUrl(){return thumb??(thumb=draw(128));},
      get dataUrl(){return full??(full=draw(Number.POSITIVE_INFINITY));}};
  });
}
