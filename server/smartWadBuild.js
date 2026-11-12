/** HF7 Smart WAD packer for SC-CSG/SDHLT. Build-only, never rewrites a source WAD.
 * Copies untouched WAD3 texture lumps (mipmaps + palettes) used by this MAP.
 * A failed/missing/colliding dependency rejects the smart build rather than silently
 * replacing a texture or generating an unusable BSP.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {referencedTextures,patchWorldWads} from './compileWads.js';

const key=name=>name.toUpperCase();
// Tool surfaces have compiler semantics; their preview pixels may differ across WADs.
// Prefer the compiler-provided tool WAD instead of failing over harmless art.
const TOOL_TEXTURES=new Set(['CLIP','NULL']);
function preferredToolTexture(options){return [...options].sort((a,b)=>{
 const rank=o=>/^(zhlt|sdhlt)\.wad$/i.test(path.basename(o.source))?0:1;
 return rank(a)-rank(b);
})[0]}

const checksum=bytes=>createHash('sha256').update(bytes).digest('hex');
const ascii=(buffer,start,len)=>buffer.toString('latin1',start,start+len).split('\0')[0];
function validMipTexture(data){
 if(!data||data.length<44)return false;
 const width=data.readUInt32LE(16),height=data.readUInt32LE(20);
 if(width<1||height<1||width>4096||height>4096||width*height>4194304)return false;
 let end=40;
 for(let mip=0;mip<4;mip++){
  const offset=data.readUInt32LE(24+mip*4);
  const size=Math.max(1,width>>>mip)*Math.max(1,height>>>mip);
  if(offset<end||offset+size>data.length)return false;
  end=offset+size;
 }
 if(end+2>data.length)return false;
 const count=data.readUInt16LE(end);
 return count>=1&&count<=256&&end+2+count*3<=data.length;
}
function readSourceWad(bytes,filename){
 if(bytes.length<12||bytes.toString('ascii',0,4)!=='WAD3')throw Error(`Not a WAD3 file: ${filename}`);
 const count=bytes.readInt32LE(4),offset=bytes.readInt32LE(8);
 if(count<0||count>12000||offset<12||offset+count*32>bytes.length)throw Error(`Invalid WAD3 directory: ${filename}`);
 const items=[];
 for(let i=0;i<count;i++){
  const d=offset+i*32,at=bytes.readInt32LE(d),size=bytes.readInt32LE(d+4),type=bytes[d+12],compressed=bytes[d+13],name=ascii(bytes,d+16,16);
  if(!name)continue;
  // Reject unsupported entries only when one of them is selected for build.
  const valid=at>=12&&size>=40&&at+size<=bytes.length&&compressed===0&&type===0x43&&validMipTexture(bytes.subarray(at,at+size));
  items.push({name,source:filename,valid,bytes:valid?bytes.subarray(at,at+size):null,type});
 }
 return items;
}
function animationSet(name){
 // GoldSrc animated textures: +0..+9, +A..+J and -0..-9, -A..-J.
 if(!/^[+\-][0-9A-J]/i.test(name))return null;
 return {symbol:name[0],suffix:name.slice(2).toUpperCase()};
}
export function buildSmartWadBytes(entries){
 if(!entries.length)throw Error('No WAD3 entries to pack.');
 if(entries.length>10000)throw Error('WAD3 texture directory exceeds safety limit.');
 const chunks=[],directory=[];let offset=12;
 for(const e of entries){
  if(!e.bytes||e.bytes.length<40||!e.name||Buffer.byteLength(e.name,'latin1')>16)throw Error(`Invalid source WAD texture: ${e.name}`);
  const source=Buffer.from(e.bytes);
  const name=ascii(source,0,16);
  if(key(name)!==key(e.name))throw Error(`WAD source name mismatch for ${e.name}.`);
  const padded=(offset+3)&~3;
  if(padded>offset)chunks.push(Buffer.alloc(padded-offset));
  offset=padded;chunks.push(source);
  directory.push({name:e.name,offset,length:source.length});offset+=source.length;
  if(offset>128*1024*1024)throw Error('Optimized WAD exceeds 128 MiB safety limit.');
 }
 const buffer=Buffer.alloc(offset+directory.length*32);
 buffer.write('WAD3',0,'ascii');buffer.writeInt32LE(directory.length,4);buffer.writeInt32LE(offset,8);
 let at=12;for(const chunk of chunks){chunk.copy(buffer,at);at+=chunk.length}
 for(let i=0;i<directory.length;i++){
  const e=directory[i],d=offset+i*32;
  buffer.writeInt32LE(e.offset,d);buffer.writeInt32LE(e.length,d+4);buffer.writeInt32LE(e.length,d+8);
  buffer[d+12]=0x43;buffer[d+13]=0;buffer.write(e.name,d+16,16,'latin1');
 }
 return buffer;
}
export async function planSmartWadBuild(source,providerFiles,{workDir,mapName,mode='off'}={}){
 if(!['embed','external'].includes(mode))throw Error('Choose embed or external Smart WAD mode.');
 const requested=referencedTextures(source);
 if(!requested.size)throw Error('No brush-face textures found in MAP source.');
 const files=[...new Set(providerFiles.filter(Boolean))];const byName=new Map();
 for(const file of files){
  let entries;try{entries=readSourceWad(await fs.readFile(file),file)}catch(e){throw Error(`Smart WAD cannot read ${file}: ${e.message}`)}
  for(const entry of entries){const id=key(entry.name);const list=byName.get(id)||[];list.push(entry);byName.set(id,list)}
 }
 const needed=new Set(requested);
 for(const name of requested){
  const group=animationSet(name);if(!group)continue;
  for(const candidate of byName.keys()){
   const other=animationSet(candidate);
   if(other&&other.symbol===group.symbol&&other.suffix===group.suffix)needed.add(candidate);
  }
 }
 const chosen=[];const missing=[],conflicts=[],unsupported=[],toolResolved=[];let skippedDuplicates=0;
 for(const name of [...needed].sort()){
  const options=byName.get(name)||[];
  if(!options.length){missing.push(name);continue}
  const valid=options.filter(e=>e.valid);
  if(!valid.length){unsupported.push(`${name} (${options[0].source})`);continue}
  const hashes=new Set(valid.map(e=>checksum(e.bytes)));
  if(hashes.size>1){
   if(TOOL_TEXTURES.has(name)){chosen.push(preferredToolTexture(valid));toolResolved.push(name);continue}
   conflicts.push(`${name}: ${[...new Set(valid.map(e=>path.basename(e.source)))].join(', ')}`);continue
  }
  skippedDuplicates+=valid.length-1;chosen.push(valid[0]);
 }
 if(missing.length)throw Error(`Smart WAD missing ${missing.length} used texture(s): ${missing.slice(0,12).join(', ')}. Import/configure the source WAD or select Legacy compilation.`);
 if(unsupported.length)throw Error(`Smart WAD cannot package unsupported texture lump(s): ${unsupported.slice(0,8).join(', ')}.`);
 if(conflicts.length)throw Error(`Smart WAD name collision (different pixels for the same GoldSrc name): ${conflicts.slice(0,8).join('; ')}. Resolve WAD priority manually before packing.`);
 const buffer=buildSmartWadBytes(chosen);
 const hash=checksum(buffer).slice(0,12);
 const basename=`ss_${mapName.slice(0,30)}_${hash}.wad`;
 const file=path.join(workDir,basename);
 await fs.writeFile(file,buffer,{flag:'wx'});
 return {map:patchWorldWads(source,[file]),file,basename,buffer,mode,hash,textureCount:chosen.length,usedCount:requested.size,
  extraFrames:chosen.length-requested.size,duplicateCount:skippedDuplicates,sourceCount:files.length,toolResolved,
  csgArgs:mode==='embed'?['-wadinclude',basename]:[]};
}
/** External WAD is needed by the game. Install only after the BSP build succeeds.
 * Never overwrite another map's WAD. Content-hashed filenames avoid collisions.
 */
export async function installSmartWadExternal(plan,gameDir){
 if(plan.mode!=='external')return null;
 const chosen=path.resolve(gameDir);const layer=path.basename(chosen).toLowerCase();
 const root=['svencoop','svencoop_addon','svencoop_downloads'].includes(layer)?path.dirname(chosen):chosen;
 const addon=path.join(root,'svencoop_addon');await fs.mkdir(addon,{recursive:true});
 const target=path.join(addon,plan.basename);
 try{const existing=await fs.readFile(target);if(!existing.equals(plan.buffer))throw Error(`Generated WAD ${target} already exists with different content.`);return target}
 catch(e){if(e.code!=='ENOENT')throw e}
 try{await fs.writeFile(target,plan.buffer,{flag:'wx'});}catch(e){if(e.code==='EEXIST')throw Error('Generated WAD appeared during build; refusing to overwrite.');throw e}
 return target;
}
