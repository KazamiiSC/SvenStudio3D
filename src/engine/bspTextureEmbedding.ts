/** Stage 6C: lossless insertion of selected WAD3 miptextures into a copy of a BSP30.
 * Only the TEXTURES lump changes. The original directory entries are rebased,
 * not decoded/re-encoded. No game files or external WADs are modified.
 */
import {parseBsp} from './bsp.ts';
import {readNativeBsp} from './bspNativeEdit.ts';
import {findMipTextureInWads,type WAD3MipTexture} from './bspWadMipTexture.ts';
import {bspEditableTextureName} from './bspSurfaceEdit.ts';
export type BspWadChoice = {name:string;width:number;height:number};
const MAX_BYTES=256*1024*1024;
const align4=(n:number)=>(n+3)&~3;
const sameBytes=(a:Uint8Array,b:Uint8Array)=>a.byteLength===b.byteLength&&a.every((x,i)=>x===b[i]);
/** Validates the matching WAD miptex and rejects dangerous special textures. */
export function selectBspWadMipTextures(wads:readonly Uint8Array[],choices:readonly BspWadChoice[]):WAD3MipTexture[]{
  if(choices.length>128)throw Error('At most 128 new WAD textures can be embedded in one export.');
  const names=new Set<string>();
  return choices.map(choice=>{
    const upper=choice.name.toUpperCase();
    if(!bspEditableTextureName(choice.name)||choice.width%16!==0||choice.height%16!==0||names.has(upper))throw Error(`Duplicate or unsupported WAD texture: ${choice.name}`);
    names.add(upper);
    const found=findMipTextureInWads(wads,choice.name,choice.width,choice.height);
    if(!found)throw Error(`WAD texture ${choice.name} is missing. Import its original WAD3 file first.`);
    return found;
  });
}
/** Appends a replacement TEXTURES lump and updates its header only. Indices in the returned
 * map remain unchanged for old textures; new textures use (old count + order).
 */
export function writeBspEmbeddedTextures(source:ArrayBuffer,additions:readonly WAD3MipTexture[]):ArrayBuffer{
  if(!additions.length)return source.slice(0);
  if(additions.length>128)throw Error('Too many new WAD textures.');
  const native=readNativeBsp(source),before=parseBsp(source,'before.bsp');
  const lump=native.lumps[2],v=new DataView(source);
  if(lump.length<4)throw Error('BSP texture lump has no directory.');
  const oldCount=v.getInt32(lump.offset,true),oldDirectory=4+oldCount*4;
  if(oldCount<0||oldCount>32768||oldDirectory>lump.length||oldCount!==before.textures.length)throw Error('Invalid original BSP texture directory.');
  if(oldCount+additions.length>32768)throw Error('Too many BSP textures.');
  const oldNames=new Set(before.textures.map(texture=>texture.name.toUpperCase()));
  for(const tex of additions){
    if(!bspEditableTextureName(tex.name)||oldNames.has(tex.name.toUpperCase())||!tex.raw.length)throw Error(`Texture ${tex.name} conflicts with BSP or is unsupported.`);
    oldNames.add(tex.name.toUpperCase());
  }
  const directory=4+(oldCount+additions.length)*4,oldPayload=lump.length-oldDirectory;
  let length=align4(directory+oldPayload);
  const locations:number[]=[];
  for(const tex of additions){locations.push(length);length=align4(length+tex.raw.length)}
  const at=align4(source.byteLength);
  if(at+length>MAX_BYTES)throw Error('BSP with embedded WAD textures exceeds 256 MiB.');
  const result=new ArrayBuffer(at+length),out=new Uint8Array(result),next=new DataView(result);
  out.set(new Uint8Array(source));
  next.setInt32(at,oldCount+additions.length,true);
  for(let i=0;i<oldCount;i++){
    const oldOffset=v.getInt32(lump.offset+4+i*4,true);
    if(oldOffset!==-1&&(oldOffset<oldDirectory||oldOffset>=lump.length))throw Error(`BSP texture offset #${i} is invalid.`);
    next.setInt32(at+4+i*4,oldOffset<0?-1:oldOffset+directory-oldDirectory,true);
  }
  out.set(new Uint8Array(source,lump.offset+oldDirectory,oldPayload),at+directory);
  additions.forEach((tex,i)=>{
    next.setInt32(at+4+(oldCount+i)*4,locations[i],true);
    out.set(tex.raw,at+locations[i]);
  });
  next.setInt32(4+2*8,at,true);next.setInt32(8+2*8,length,true);
  const reopened=readNativeBsp(result),parsed=parseBsp(result,'embedded.bsp');
  if(parsed.textures.length!==oldCount+additions.length)throw Error('Embedded texture directory failed to reload.');
  for(let i=0;i<oldCount;i++){
    const a=before.textures[i],b=parsed.textures[i];
    if(a.name!==b.name||a.width!==b.width||a.height!==b.height||a.external!==b.external||
      (!!a.rgba!==!!b.rgba)||(a.rgba&&b.rgba&&!sameBytes(a.rgba,b.rgba)))throw Error(`Original BSP texture #${i} was changed.`);
  }
  for(let i=0;i<additions.length;i++){
    const a=additions[i],b=parsed.textures[oldCount+i];
    if(a.name.toUpperCase()!==b.name.toUpperCase()||a.width!==b.width||a.height!==b.height||b.external||!b.rgba)
      throw Error(`New WAD texture ${a.name} did not survive export/reimport.`);
  }
  for(let i=0;i<15;i++){
    if(i===2)continue;
    const a=native.lumps[i],b=reopened.lumps[i];
    if(a.offset!==b.offset||a.length!==b.length||!sameBytes(new Uint8Array(source,a.offset,a.length),new Uint8Array(result,b.offset,b.length)))
      throw Error(`Unrelated BSP lump #${i} was modified.`);
  }
  return result;
}
/** Adds only textures actually used in staged surface changes, then remaps their
 * temporary editor indices to compact, stable BSP texture indices. */
export function writeBspWadSurfaceCopy(source:ArrayBuffer,changes:Record<number,{s:[number,number,number,number];t:[number,number,number,number];texture:number}>,
   choices:readonly BspWadChoice[],wads:readonly Uint8Array[],writeSurfaces:(bytes:ArrayBuffer,edits:typeof changes)=>ArrayBuffer):ArrayBuffer{
  const count=parseBsp(source,'before.bsp').textures.length;
  const used=[...new Set(Object.values(changes).map(change=>change.texture).filter(index=>index>=count))].sort((a,b)=>a-b);
  if(!used.length)return writeSurfaces(source,changes);
  const requested=used.map(index=>{
    const choice=choices[index-count];if(!choice)throw Error(`Unknown staged WAD texture index: ${index}.`);
    return choice;
  });
  const bytes=writeBspEmbeddedTextures(source,selectBspWadMipTextures(wads,requested));
  const remapped=Object.fromEntries(Object.entries(changes).map(([face,edit])=>{
    const pos=used.indexOf(edit.texture);
    return [face,{...edit,texture:pos<0?edit.texture:count+pos}];
  }));
  return writeSurfaces(bytes,remapped);
}
