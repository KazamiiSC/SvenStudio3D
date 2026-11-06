/** Read-only extraction of miptex images embedded in a GoldSrc BSP30.
 * WAD3 entries contain the original mipmaps/palette bytes, not a re-encoded PNG.
 * External-only textures cannot be recovered from a BSP and are left untouched.
 */
export type EmbeddedWad = {name:string;bytes:Uint8Array;textureNames:string[]};
const MAX_WAD_BYTES=64*1024*1024;
function ascii(view:DataView,offset:number,length:number){
  let text='';for(let i=0;i<length;i++){
    const ch=view.getUint8(offset+i);if(ch===0)break;
    if(ch<32||ch>126)return '';
    text+=String.fromCharCode(ch);
  }
  return text;
}
export function extractEmbeddedBspWad(source:ArrayBuffer,bspName:string):EmbeddedWad|null{
  if(source.byteLength<124||source.byteLength>256*1024*1024)return null;
  const v=new DataView(source);
  if(v.getInt32(0,true)!==30)return null;
  const lumpStart=v.getInt32(4+2*8,true),lumpSize=v.getInt32(8+2*8,true);
  if(lumpStart<124||lumpSize<4||lumpStart>source.byteLength||lumpSize>source.byteLength-lumpStart)return null;
  const n=v.getInt32(lumpStart,true);
  if(n<1||n>4096||4+n*4>lumpSize)return null;
  const result:{name:string;data:Uint8Array}[]=[];
  let total=12;const seen=new Set<string>();
  for(let i=0;i<n;i++){
    const rel=v.getInt32(lumpStart+4+i*4,true);
    if(rel<4+n*4||rel+40>lumpSize)continue;
    const base=lumpStart+rel,name=ascii(v,base,16);
    if(!name||seen.has(name.toLowerCase()))continue;
    const w=v.getUint32(base+16,true),h=v.getUint32(base+20,true);
    if(w<1||h<1||w>4096||h>4096||w*h>4194304)continue;
    const offsets=[0,1,2,3].map(j=>v.getUint32(base+24+j*4,true));
    if(offsets[0]<40||offsets.some(o=>o<40))continue; // external-only miptex
    const mipSize=[w*h,Math.max(1,w>>1)*Math.max(1,h>>1),Math.max(1,w>>2)*Math.max(1,h>>2),Math.max(1,w>>3)*Math.max(1,h>>3)];
    if(offsets.some((off,j)=>off+mipSize[j]>lumpSize-rel))continue;
    const paletteAt=base+offsets[3]+mipSize[3];
    if(paletteAt+2>lumpStart+lumpSize)continue;
    const colors=v.getUint16(paletteAt,true);
    if(colors<1||colors>256||paletteAt+2+colors*3>lumpStart+lumpSize)continue;
    const minimum=paletteAt+2+colors*3-base;
    // Keep short alignment padding from the BSP's original miptex block.
    const nextOffsets=Array.from({length:n},(_,j)=>v.getInt32(lumpStart+4+j*4,true)).filter(other=>other>rel);
    const end=nextOffsets.length?Math.min(...nextOffsets):lumpSize;
    const available=end-rel;
    const size=available>=minimum&&available<=minimum+3?available:minimum;
    if(total+size+32>MAX_WAD_BYTES)break;
    // Preserve native miptex bytes and palette exactly.
    result.push({name,data:new Uint8Array(source,base,size).slice()});
    total+=size+32;seen.add(name.toLowerCase());
  }
  if(!result.length)return null;
  const length=12+result.reduce((sum,item)=>sum+item.data.length,0)+result.length*32;
  const bytes=new Uint8Array(length),view=new DataView(bytes.buffer);
  bytes.set([87,65,68,51]);view.setInt32(4,result.length,true);
  const directory=length-result.length*32;view.setInt32(8,directory,true);
  let cursor=12;
  for(let i=0;i<result.length;i++){
    const item=result[i],dir=directory+i*32;
    bytes.set(item.data,cursor);
    view.setInt32(dir,cursor,true);view.setInt32(dir+4,item.data.length,true);view.setInt32(dir+8,item.data.length,true);
    view.setUint8(dir+12,0x43);
    for(let c=0;c<Math.min(item.name.length,15);c++)view.setUint8(dir+16+c,item.name.charCodeAt(c));
    cursor+=item.data.length;
  }
  const safe=(bspName.replace(/\.bsp$/i,'').replace(/[^a-z0-9_-]/gi,'_').slice(0,52)||'recovered');
  return {name:`${safe}_recovered.wad`,bytes,textureNames:result.map(item=>item.name)};
}
/** The companion WAD must be installed before compiling the decompiled MAP.
 * Preserve user WAD references; discard only obsolete SvenStudio Temp recovery files. */
export function appendRecoveryWadToMap(source:string,wad:string):string{
  const open=source.indexOf('{'),next=source.indexOf('{',open+1);
  if(open<0||next<0)return source;
  const header=source.slice(open,next);
  if(!/"classname"\s+"worldspawn"/i.test(header))return source;
  const field=/"wad"\s+"([^"]*)"/i;
  if(field.test(header)){
    const updated=header.replace(field,(whole,old:string)=>{
      const list=old.split(';').map(s=>s.trim()).filter(Boolean).filter(path=>!/[\\/]Temp[\\/]svenstudio-bsp-recovery-[^;]+[\\/]reconstructed_embedded\.wad$/i.test(path));
      if(list.some(item=>item.replace(/\\/g,'/').split('/').pop()?.toLowerCase()===wad.toLowerCase()))return `"wad" "${list.join(';')};"`;
      return `"wad" "${[...list,wad].join(';')};"`;
    });
    return source.slice(0,open)+updated+source.slice(next);
  }
  const updated=header.replace(/"classname"\s+"worldspawn"/i,whole=>`${whole}\n"wad" "${wad};"`);
  return source.slice(0,open)+updated+source.slice(next);
}
