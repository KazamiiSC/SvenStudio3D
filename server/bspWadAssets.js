/** Read-only, bounded GoldSrc WAD3 texture discovery for the BSP viewer.
 * Search only known Sven Co-op overlay folders, never client-provided paths.
 * Return only textures that a compiled BSP actually references. */
import fs from 'node:fs/promises';
import path from 'node:path';

const LAYERS=['svencoop_addon','svencoop_downloads','svencoop'];
const MAX_WAD_BYTES=160*1024*1024;
const MAX_TEXELS=4*1024*1024;
const MAX_REQUESTED=128;
const MAX_REPLY_BYTES=12*1024*1024;
const MAX_WADS=192;
const cleanTexture=name=>typeof name==='string'&&/^[A-Za-z0-9_{}!~+*.%^-]{1,16}$/.test(name);
export const wadBasename=value=>{
  if(typeof value!=='string')return null;
  const normalized=value.trim().replaceAll('\\','/');
  const name=normalized.split('/').pop();
  return name&&/^[a-zA-Z0-9_+(). -]{1,120}\.wad$/i.test(name)?name.toLowerCase():null;
};
export async function bspWadRoots(gameDir){
  if(typeof gameDir!=='string'||!gameDir.trim()||gameDir.length>1024)throw Error('Configure the Sven Co-op game directory first.');
  const target=path.resolve(gameDir),base=path.basename(target).toLowerCase();
  const parent=LAYERS.includes(base)?path.dirname(target):target;
  const roots=[];
  for(const layer of LAYERS){
    const candidate=path.join(parent,layer);
    try{if((await fs.stat(candidate)).isDirectory())roots.push({layer,root:await fs.realpath(candidate)})}catch{}
  }
  // Also support a custom explicitly selected game directory, without scanning its parent.
  if(!roots.length){
    try{if((await fs.stat(target)).isDirectory())roots.push({layer:'game',root:await fs.realpath(target)})}catch{}
  }
  return roots;
}
async function discoverFiles(roots){
  const results=[];
  for(const {layer,root} of roots){
    for(const sub of ['', 'textures', 'maps']){
      const dir=path.join(root,sub);
      let entries=[];
      try{
        const real=await fs.realpath(dir);
        if(real!==root&&!real.startsWith(root+path.sep))continue;
        entries=await fs.readdir(real,{withFileTypes:true});
      }catch{continue}
      for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
        if(!entry.isFile()||entry.isSymbolicLink()||!wadBasename(entry.name))continue;
        results.push({name:entry.name.toLowerCase(),full:path.join(dir,entry.name),layer});
      }
    }
  }
  return results;
}
async function readAt(handle,offset,count){
  const buffer=Buffer.allocUnsafe(count);let done=0;
  while(done<count){const {bytesRead}=await handle.read(buffer,done,count-done,offset+done);if(!bytesRead)throw Error('Incomplete WAD read');done+=bytesRead}
  return buffer;
}
/** Scan one WAD's directory and extract only requested, uncompressed MIPTEX textures. */
export async function readMissingWadTextures(file,needed,budget){
  const found=[];
  const handle=await fs.open(file,'r');
  try{
    const stat=await handle.stat();
    if(!stat.isFile()||stat.size<12||stat.size>MAX_WAD_BYTES)return found;
    const head=await readAt(handle,0,12);
    if(head.toString('ascii',0,4)!=='WAD3')return found;
    const count=head.readInt32LE(4),start=head.readInt32LE(8);
    if(count<0||count>16000||start<12||start+count*32>stat.size)return found;
    const directory=await readAt(handle,start,count*32);
    for(let i=0;i<count&&needed.size&&budget.remaining>0;i++){
      const off=i*32,pos=directory.readInt32LE(off),size=directory.readInt32LE(off+4),type=directory[off+12],compression=directory[off+13];
      if(type!==0x43||compression!==0||pos<12||size<42||pos+size>stat.size)continue;
      const name=directory.toString('latin1',off+16,off+32).split('\0')[0];
      const key=name.toLowerCase();if(!needed.has(key))continue;
      try{
        const header=await readAt(handle,pos,40),width=header.readUInt32LE(16),height=header.readUInt32LE(20);
        const mip0=header.readUInt32LE(24),mip3=header.readUInt32LE(36),pixels=width*height;
        if(!width||!height||width>4096||height>4096||pixels>MAX_TEXELS||pixels>budget.remaining||mip0<40||!mip3||mip0+pixels>size)continue;
        const palAt=mip3+Math.max(1,width>>3)*Math.max(1,height>>3);
        if(palAt+2>size)continue;
        const colorCount=(await readAt(handle,pos+palAt,2)).readUInt16LE(0);
        if(colorCount<1||colorCount>256||palAt+2+colorCount*3>size)continue;
        const palette=await readAt(handle,pos+palAt+2,colorCount*3);
        const indices=await readAt(handle,pos+mip0,pixels);
        found.push({name,width,height,indices:indices.toString('base64'),palette:palette.toString('base64')});
        budget.remaining-=pixels;needed.delete(key);
      }catch{ /* Skip malformed individual MIPTEX data. */ }
    }
    return found;
  }finally{await handle.close()}
}
export async function findBspWadTextures({gameDir,wadNames=[],textureNames=[]}={}){
  if(!Array.isArray(wadNames)||!Array.isArray(textureNames)||wadNames.length>256||textureNames.length>4096)throw Error('Invalid BSP texture request.');
  const allNames=[...new Set(textureNames.map(x=>typeof x==='string'?x.trim().toLowerCase():'').filter(cleanTexture))];
  const requested=allNames.slice(0,MAX_REQUESTED);
  const roots=await bspWadRoots(gameDir);
  if(!roots.length)throw Error('Sven Co-op game directory not found.');
  if(!requested.length)return {textures:[],missing:[],scanned:0,truncated:false};
  const inventory=await discoverFiles(roots),priority=[...new Set(wadNames.map(wadBasename).filter(Boolean))];
  const ordered=[...inventory.filter(f=>priority.includes(f.name)).sort((a,b)=>priority.indexOf(a.name)-priority.indexOf(b.name)),...inventory.filter(f=>!priority.includes(f.name))];
  const remaining=new Set(requested),budget={remaining:MAX_REPLY_BYTES},textures=[];
  let scanned=0;
  for(const entry of ordered.slice(0,MAX_WADS)){
    if(!remaining.size||budget.remaining<=0)break;
    try{
      const loaded=await readMissingWadTextures(entry.full,remaining,budget);
      textures.push(...loaded.map(tex=>({...tex,wad:entry.name,source:entry.layer})));
    }catch{ /* Unreadable WAD: try the next overlay. */ }
    scanned++;
  }
  return {textures,missing:[...remaining],scanned,truncated:allNames.length>MAX_REQUESTED||(remaining.size>0&&scanned>=MAX_WADS&&inventory.length>MAX_WADS)||(remaining.size>0&&budget.remaining<=0)};
}
