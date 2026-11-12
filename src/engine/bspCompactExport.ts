/** BSP30 compact exporter (stage 6E).
 * The earlier native writers intentionally appended new lumps while leaving
 * their superseded bytes in gaps. Repack ONLY the current 15 header-addressed
 * lumps. All internal BSP30 references remain lump-relative or index-based.
 * Never attempts to renumber textures, texinfos, faces, planes or lightofs.
 */
import {readNativeBsp} from './bspNativeEdit.ts';
import {parseBsp} from './bsp.ts';

const BSP_HEADER=4+15*8;
const MAX_BSP=256*1024*1024;
const align4=(n:number)=>(n+3)&~3;
const same=(a:Uint8Array,b:Uint8Array)=>a.byteLength===b.byteLength&&a.every((byte,i)=>byte===b[i]);

export interface BspCompactionReport {
  beforeBytes:number;
  afterBytes:number;
  recoveredBytes:number;
}
/** Rebuilds a validated BSP file using only the referenced lump payloads.
 * Preserves each lump byte for byte (including mipmaps, palette, lightstyles,
 * VIS, hulls and geometry) but normalizes offsets and 4-byte alignment.
 */
export function compactBspCopy(input:ArrayBuffer):{bytes:ArrayBuffer;report:BspCompactionReport}{
  const native=readNativeBsp(input);
  // Refuse malformed non-BSP geometry before attempting any rewrite.
  const before=parseBsp(input,'before_compaction.bsp');
  let used=BSP_HEADER;
  const offsets=native.lumps.map(({length})=>{
    if(!length)return 0;
    used=align4(used);
    const position=used;
    used+=length;
    if(used>MAX_BSP)throw Error('Compacted BSP exceeds the 256 MiB limit.');
    return position;
  });
  const bytes=new ArrayBuffer(align4(used));
  const output=new Uint8Array(bytes),view=new DataView(bytes);
  view.setInt32(0,30,true);
  native.lumps.forEach(({offset,length},i)=>{
    if(length)output.set(new Uint8Array(input,offset,length),offsets[i]);
    view.setInt32(4+i*8,offsets[i],true);
    view.setInt32(8+i*8,length,true);
  });
  const checked=readNativeBsp(bytes),after=parseBsp(bytes,'after_compaction.bsp');
  for(let i=0;i<15;i++){
    const old=native.lumps[i],next=checked.lumps[i];
    if(old.length!==next.length||!same(new Uint8Array(input,old.offset,old.length),new Uint8Array(bytes,next.offset,next.length)))
      throw Error(`BSP lump #${i} failed compact-export integrity verification.`);
  }
  // A semantic cross-check is additional to exact lump comparison.
  if(after.faces.length!==before.faces.length||after.entities.length!==before.entities.length||
    after.textures.length!==before.textures.length||after.stats.models!==before.stats.models||
    after.stats.lightmappedFaces!==before.stats.lightmappedFaces)
    throw Error('Compacted BSP changed the parsed map unexpectedly.');
  return {bytes,report:{beforeBytes:input.byteLength,afterBytes:bytes.byteLength,recoveredBytes:input.byteLength-bytes.byteLength}};
}
