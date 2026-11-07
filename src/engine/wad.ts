import type { TextureAsset } from './types';
import {inferOpaqueDecalBackdrop} from './decalAlpha.ts';
import {rememberWadFile} from './wadPersistence.ts';
const ascii=(v:DataView,start:number,n:number)=>{let out='';for(let i=0;i<n;i++){const x=v.getUint8(start+i);if(!x)break;out+=String.fromCharCode(x)}return out;};
let importSerial=0;
/** Index mip textures in O(entries). Pixel conversion is lazy: a 3,000-texture
 * WAD should NOT allocate 3,000 canvases or PNG data URLs on import. */
async function parseWadInternal(file:File,options:{remember?:boolean}|number,decals:boolean):Promise<TextureAsset[]>{
  const buffer=await file.arrayBuffer(),v=new DataView(buffer);
  if(buffer.byteLength<12||ascii(v,0,4)!=='WAD3')throw Error('Only uncompressed WAD3 files are supported.');
  const count=v.getInt32(4,true),offset=v.getInt32(8,true);
  if(count<0||count>10000||offset<12||offset+count*32>buffer.byteLength)throw Error('Invalid WAD directory.');
  const result:TextureAsset[]=[],serial=++importSerial;
  for(let i=0;i<count;i++){
    try{
      const dir=offset+i*32,pos=v.getInt32(dir,true),size=v.getInt32(dir+4,true);
      if(v.getUint8(dir+13)!==0||(decals?![0x40,0x43].includes(v.getUint8(dir+12)):v.getUint8(dir+12)!==0x43)||pos<12||size<40||pos+size>buffer.byteLength)continue;
      const lumpEnd=pos+size;
      const nativeDecal=decals&&v.getUint8(dir+12)===0x40;
      const name=ascii(v,pos,16),w=v.getUint32(pos+16,true),h=v.getUint32(pos+20,true);
      const texOffset=v.getUint32(pos+24,true),offset3=v.getUint32(pos+36,true);
      // A directory entry must not read pixel or palette bytes from another
      // lump. The previous checks only compared against the entire WAD file.
      if(!name||w<1||h<1||w>4096||h>4096||w*h>4194304||
         texOffset<40||offset3<texOffset||pos+texOffset+w*h>lumpEnd)continue;
      const mip3Size=Math.max(1,w>>3)*Math.max(1,h>>3);
      const paletteAt=pos+offset3+mip3Size;
      if(paletteAt+2>lumpEnd)continue;
      const nColors=v.getUint16(paletteAt,true),palette=paletteAt+2;
      if(nColors<1||nColors>256||palette+nColors*3>lumpEnd)continue;
      let cached:string|undefined,cachedThumb:string|undefined,transparentBackdrop:Uint8Array|null|undefined;
      // Some non-native 0x43 entries were imported into decals.wad with an
      // opaque near-white background, despite being intended as stencils.
      // Use a conservative border-connected preview mask, never alter the WAD.
      const backdrop=()=>{
        if(transparentBackdrop!==undefined)return transparentBackdrop;
        if(!decals||nativeDecal||name.startsWith('{'))return (transparentBackdrop=null);
        const indices=new Uint8Array(buffer.slice(pos+texOffset,pos+texOffset+w*h));
        const colors=new Uint8Array(768);for(let j=0;j<nColors*3;j++)colors[j]=v.getUint8(palette+j);
        return (transparentBackdrop=inferOpaqueDecalBackdrop(indices,w,h,colors));
      };
      const encode=(maxPixels:number)=>{
        const ratio=Math.min(1,maxPixels/Math.max(w,h));
        const previewW=Math.max(1,Math.round(w*ratio)),previewH=Math.max(1,Math.round(h*ratio));
        const canvas=document.createElement('canvas');canvas.width=previewW;canvas.height=previewH;
        const ctx=canvas.getContext('2d');if(!ctx)return '';
        const image=ctx.createImageData(previewW,previewH);
        const mask=backdrop();
        for(let y=0;y<previewH;y++)for(let x=0;x<previewW;x++){
          const srcY=Math.min(h-1,Math.floor(y*h/previewH)),srcX=Math.min(w-1,Math.floor(x*w/previewW));
          const idx=v.getUint8(pos+texOffset+srcY*w+srcX),pi=palette+Math.min(idx,nColors-1)*3,d=(y*previewW+x)*4;
          if(nativeDecal){
            // GoldSrc index-alpha decals use the pixel index as opacity and
            // the last palette entry as the decal tint (not a color per index).
            const tint=palette+Math.min(nColors-1,255)*3;
            image.data[d]=v.getUint8(tint);image.data[d+1]=v.getUint8(tint+1);image.data[d+2]=v.getUint8(tint+2);
            image.data[d+3]=idx;
          }else{
            image.data[d]=v.getUint8(pi);image.data[d+1]=v.getUint8(pi+1);image.data[d+2]=v.getUint8(pi+2);
            image.data[d+3]=name[0]==='{'&&idx===255||mask?.[srcY*w+srcX]?0:255;
          }
        }
        ctx.putImageData(image,0,0);
        return canvas.toDataURL('image/png');
      };
      result.push({name,wad:file.name,width:w,height:h,sourceId:`${serial}:${i}`,
        get thumbUrl(){return cachedThumb??(cachedThumb=encode(128));},
        get dataUrl(){return cached??(cached=encode(Number.POSITIVE_INFINITY));}
      });
    }catch{ /* Skip malformed directory entry without losing the rest. */ }
  }
  if(!result.length)throw Error(`No readable WAD3 mip textures found in ${file.name}.`);
  if(typeof options==='number'||options.remember!==false){
    try{await rememberWadFile(file)}
    catch(error){
      const message=`Could not save imported WAD ${file.name} for the next session: ${String(error)}`;
      console.warn(message);
      if(typeof window!=='undefined')window.dispatchEvent(new CustomEvent('svenstudio:wad-cache-warning',{detail:message}));
    }
  }
  return result;
}

/** Imports decals.wad without mixing it with worldspawn brush-texture WADs. */
export async function parseDecalWad(file:File,options:{remember?:boolean}={}):Promise<TextureAsset[]>{
  return parseWadInternal(file,options,true);
}
/** Ordinary world-surface WADs never accidentally import decal lumps. */
export async function parseWad(file:File,options:{remember?:boolean}|number={}):Promise<TextureAsset[]>{
  return parseWadInternal(file,options,false);
}
