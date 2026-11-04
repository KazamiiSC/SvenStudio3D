import type { TextureAsset } from './types';
const ascii=(v:DataView,start:number,n:number)=>{let out='';for(let i=0;i<n;i++){const x=v.getUint8(start+i);if(!x)break;out+=String.fromCharCode(x)}return out;};
let importSerial=0;
/** Index mip textures in O(entries). Pixel conversion is lazy: a 3,000-texture
 * WAD should NOT allocate 3,000 canvases or PNG data URLs on import. */
export async function parseWad(file:File):Promise<TextureAsset[]>{
  const buffer=await file.arrayBuffer(),v=new DataView(buffer);
  if(buffer.byteLength<12||ascii(v,0,4)!=='WAD3')throw Error('Only uncompressed WAD3 files are supported.');
  const count=v.getInt32(4,true),offset=v.getInt32(8,true);
  if(count<0||count>10000||offset<12||offset+count*32>buffer.byteLength)throw Error('Invalid WAD directory.');
  const result:TextureAsset[]=[],serial=++importSerial;
  for(let i=0;i<count;i++){
    try{
      const dir=offset+i*32,pos=v.getInt32(dir,true),size=v.getInt32(dir+4,true);
      if(v.getUint8(dir+13)!==0||v.getUint8(dir+12)!==0x43||pos<12||size<40||pos+size>buffer.byteLength)continue;
      const name=ascii(v,pos,16),w=v.getUint32(pos+16,true),h=v.getUint32(pos+20,true);
      const texOffset=v.getUint32(pos+24,true),offset3=v.getUint32(pos+36,true);
      if(!name||w<1||h<1||w>4096||h>4096||w*h>4194304||texOffset<40||pos+texOffset+w*h>buffer.byteLength)continue;
      const paletteAt=pos+offset3+(w>>3)*(h>>3);
      if(paletteAt+2>buffer.byteLength)continue;
      const nColors=v.getUint16(paletteAt,true),palette=paletteAt+2;
      if(nColors<1||nColors>256||palette+nColors*3>buffer.byteLength)continue;
      let cached:string|undefined,cachedThumb:string|undefined;
      const encode=(maxPixels:number)=>{
        const ratio=Math.min(1,maxPixels/Math.max(w,h));
        const previewW=Math.max(1,Math.round(w*ratio)),previewH=Math.max(1,Math.round(h*ratio));
        const canvas=document.createElement('canvas');canvas.width=previewW;canvas.height=previewH;
        const ctx=canvas.getContext('2d');if(!ctx)return '';
        const image=ctx.createImageData(previewW,previewH);
        for(let y=0;y<previewH;y++)for(let x=0;x<previewW;x++){
          const srcY=Math.min(h-1,Math.floor(y*h/previewH)),srcX=Math.min(w-1,Math.floor(x*w/previewW));
          const idx=v.getUint8(pos+texOffset+srcY*w+srcX),pi=palette+Math.min(idx,nColors-1)*3,d=(y*previewW+x)*4;
          image.data[d]=v.getUint8(pi);image.data[d+1]=v.getUint8(pi+1);image.data[d+2]=v.getUint8(pi+2);
          image.data[d+3]=name[0]==='{'&&idx===255?0:255;
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
  return result;
}
