/** Read-only lookup of WAD3 miptextures for binary BSP submodel composition.
 * Imports EXACT mip pixels and palette from a user-selected WAD into the new
 * BSP's texture lump, so the copied submodel does not silently depend on a
 * worldspawn WAD path unavailable to the destination map.
 * Does not mutate external resources or use HTML canvas/re-encoding.
 */
export interface WAD3MipTexture {name:string;width:number;height:number;raw:Uint8Array}
export class MissingBspWadTextureError extends Error {
 constructor(readonly textureName:string,readonly wadFilesProvided:boolean){
  super(`External texture ${textureName} is not present in destination or in the supplied WAD3 files.`);
  this.name='MissingBspWadTextureError';
 }
}
const MAX_WADS=8,MAX_WAD_BYTES=64*1024*1024,MAX_TOTAL_WADS_BYTES=128*1024*1024;
const ascii=(bytes:Uint8Array,start:number,length:number)=>{
 let s='';for(let i=0;i<length;i++){const ch=bytes[start+i];if(!ch)break;if(ch<32||ch>126)throw Error('WAD3 has an invalid texture name.');s+=String.fromCharCode(ch)}return s;
};
const view=(bytes:Uint8Array)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
const invalid=(msg:string):never=>{throw Error(`WAD3 texture import: ${msg}`)};

/** Every supplied WAD directory must be valid. Individual textures are read
 * only when their name matches the missing external BSP miptexture. */
export function findMipTextureInWads(wads:readonly Uint8Array[],name:string,width:number,height:number):WAD3MipTexture|null{
 if(wads.length>MAX_WADS)invalid(`Select at most ${MAX_WADS} WAD3 files.`);
 if(wads.reduce((n,w)=>n+w.byteLength,0)>MAX_TOTAL_WADS_BYTES)invalid('Selected WAD3 files exceed 128 MiB total.');
 let match:WAD3MipTexture|null=null;
 for(const bytes of wads){
  if(bytes.byteLength<12||bytes.byteLength>MAX_WAD_BYTES)invalid('WAD3 file is empty or exceeds 64 MiB.');
  if(ascii(bytes,0,4)!=='WAD3')invalid('Only uncompressed WAD3 files are supported.');
  const v=view(bytes),count=v.getInt32(4,true),dir=v.getInt32(8,true);
  if(count<0||count>10000||dir<12||dir+count*32>bytes.length)invalid('Invalid WAD3 texture directory.');
  for(let i=0;i<count;i++){
   const p=dir+i*32,entryName=ascii(bytes,p+16,16);
   if(entryName.toLowerCase()!==name.toLowerCase())continue;
   const at=v.getInt32(p,true),packed=v.getInt32(p+4,true),unpacked=v.getInt32(p+8,true);
   const type=v.getUint8(p+12),compression=v.getUint8(p+13);
   if(type!==0x43||compression!==0||packed!==unpacked)invalid(`Texture ${name} is not an uncompressed WAD3 miptexture.`);
   if(at<12||packed<40||at+packed>bytes.length||at+packed>dir&&at<dir+count*32&&at+packed>dir)invalid(`Truncated WAD3 texture ${name}.`);
   const raw=bytes.subarray(at,at+packed),r=view(raw);
   if(ascii(raw,0,16).toLowerCase()!==name.toLowerCase())invalid(`WAD3 directory/header name mismatch for ${name}.`);
   const w=r.getUint32(16,true),h=r.getUint32(20,true);
   if(w!==width||h!==height)invalid(`Texture ${name} has incompatible dimensions in the WAD3 (${w}x${h}, expected ${width}x${height}).`);
   if(w<1||h<1||w>2048||h>2048||w*h>4_194_304)invalid(`Invalid WAD3 texture dimensions for ${name}.`);
   const offsets=[0,1,2,3].map(j=>r.getUint32(24+j*4,true));
   const sizes=[w*h,Math.max(1,w>>1)*Math.max(1,h>>1),Math.max(1,w>>2)*Math.max(1,h>>2),Math.max(1,w>>3)*Math.max(1,h>>3)];
   if(offsets[0]<40||offsets.some((off,j)=>off<40||off+sizes[j]>raw.length)||offsets.some((off,j)=>j>0&&off<offsets[j-1]+sizes[j-1]))invalid(`Truncated mip levels for WAD3 texture ${name}.`);
   const paletteAt=offsets[3]+sizes[3];
   if(paletteAt+2>raw.length)invalid(`Missing palette for WAD3 texture ${name}.`);
   const colors=r.getUint16(paletteAt,true),need=paletteAt+2+colors*3;
   if(colors<1||colors>256||need>raw.length)invalid(`Invalid palette for WAD3 texture ${name}.`);
   // Ignore unrelated alignment bytes at the end, preserving pixel indices
   // and the actual WAD RGB palette without any color conversion.
   const candidate={name,width:w,height:h,raw:raw.slice(0,need)};
   if(match){
    if(match.raw.length!==candidate.raw.length||!match.raw.every((value,j)=>value===candidate.raw[j]))invalid(`Ambiguous texture ${name}: selected WAD3 files have different image contents.`);
   }else match=candidate;
  }
 }
 return match;
}
