/** Read-only Sven Co-op skybox browser. Paths are confined to gfx/env folders. */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
const SIDES=['ft','bk','lf','rt','up','dn'];
const EXTENSIONS=['.tga','.bmp','.png','.jpg','.jpeg'];
const acceptable=(s)=>typeof s==='string'&&/^[a-zA-Z0-9_-]{1,64}$/.test(s);
export async function skyRoots(gameDir){
 if(typeof gameDir!=='string'||!gameDir||gameDir.length>1024)throw Error('Configure Sven Co-op game directory first.');
 const resolved=path.resolve(gameDir),base=path.basename(resolved).toLowerCase();
 const parent=['svencoop','svencoop_addon','svencoop_downloads'].includes(base)?path.dirname(resolved):resolved;
 const roots=[];
 for(const source of ['svencoop_addon','svencoop_downloads','svencoop']){
  const dir=path.join(parent,source,'gfx','env');
  try{const stat=await fs.stat(dir);if(stat.isDirectory())roots.push({source,root:await fs.realpath(dir)})}catch{}
 }
 return roots;
}
export async function listSkies(gameDir){
 const roots=await skyRoots(gameDir),entries=new Map();
 for(const {source,root} of roots){
  for(const entry of await fs.readdir(root,{withFileTypes:true}).catch(()=>[])){
   if(!entry.isFile()||entry.isSymbolicLink())continue;
   const match=/^([a-zA-Z0-9_-]+?)(ft|bk|lf|rt|up|dn)\.(tga|bmp|png|jpe?g)$/i.exec(entry.name);
   if(!match)continue;
   const sky=match[1],side=match[2].toLowerCase(),extension='.'+match[3].toLowerCase();
   if(!acceptable(sky))continue;
   const key=sky.toLowerCase();let previous=entries.get(key);
   if(!previous){previous={name:sky,source,sides:{}};entries.set(key,previous)}
   if(previous.source!==source)continue; // first overlay folder wins
   if(!previous.sides[side])previous.sides[side]=extension;
  }
 }
 return [...entries.values()].map(({name,source,sides})=>({name,source,complete:SIDES.every(s=>s in sides),faces:Object.keys(sides).length,thumbnailSide:sides.ft?'ft':Object.keys(sides)[0]})).sort((a,b)=>a.name.localeCompare(b.name));
}
function crc32(buffer){let crc=0xffffffff;for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^0xffffffff)>>>0}
function chunk(kind,buffer){const len=Buffer.alloc(4);len.writeUInt32BE(buffer.length);const content=Buffer.from(kind);const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([content,buffer])));return Buffer.concat([len,content,buffer,crc])}
function rgbaToPng(rgba,w,h){const stride=w*4,raw=Buffer.alloc((stride+1)*h);for(let y=0;y<h;y++)rgba.copy(raw,y*(stride+1)+1,y*stride,(y+1)*stride);
 const header=Buffer.alloc(13);header.writeUInt32BE(w,0);header.writeUInt32BE(h,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw,{level:5})),chunk('IEND',Buffer.alloc(0))]);}
/** Only 24/32-bit raw or RLE TGA is decoded. Other files return a clear unsupported error. */
export function decodeTga(buffer){
 if(buffer.length<18)throw Error('TGA header missing.');
 const idLength=buffer[0],mapType=buffer[1],type=buffer[2],w=buffer.readUInt16LE(12),h=buffer.readUInt16LE(14),depth=buffer[16],descriptor=buffer[17];
 if(mapType!==0||![2,10].includes(type)||![24,32].includes(depth)||!w||!h||w>4096||h>4096||w*h>5_000_000)throw Error('Unsupported TGA format.');
 const pixelSize=depth/8,rgba=Buffer.alloc(w*h*4);let cursor=18+idLength,index=0;
 const writePixel=()=>{if(cursor+pixelSize>buffer.length)throw Error('Truncated TGA pixel data.');const b=buffer[cursor++],g=buffer[cursor++],r=buffer[cursor++],a=pixelSize===4?buffer[cursor++]:255;return [r,g,b,a]};
 const put=p=>{const x=index%w,y=Math.floor(index/w),actualY=(descriptor&0x20)?y:h-1-y,actualX=(descriptor&0x10)?w-1-x:x;const at=(actualY*w+actualX)*4;rgba[at]=p[0];rgba[at+1]=p[1];rgba[at+2]=p[2];rgba[at+3]=p[3];index++};
 if(type===2){while(index<w*h)put(writePixel())}
 else while(index<w*h){if(cursor>=buffer.length)throw Error('Truncated TGA RLE.');const packet=buffer[cursor++],count=(packet&127)+1;if(index+count>w*h)throw Error('Invalid TGA RLE length.');if(packet&128){const px=writePixel();for(let i=0;i<count;i++)put(px)}else for(let i=0;i<count;i++)put(writePixel())}
 return rgbaToPng(rgba,w,h);
}
export async function skyFace(gameDir,source,sky,side){
 if(!acceptable(sky)||!SIDES.includes(side)||!['svencoop','svencoop_addon','svencoop_downloads'].includes(source))throw Error('Invalid sky request.');
 const roots=await skyRoots(gameDir),root=roots.find(r=>r.source===source)?.root;if(!root)throw Error('Sky folder not installed.');
 for(const ext of EXTENSIONS){
  const file=path.join(root,sky+side+ext);let real;
  try{real=await fs.realpath(file)}catch{continue}
  if(!real.startsWith(root+path.sep))throw Error('Sky path escapes game folder.');
  const stat=await fs.stat(real);if(!stat.isFile()||stat.size>20*1024*1024)throw Error('Sky asset too large.');
  const body=await fs.readFile(real);
  if(ext==='.tga')return {buffer:decodeTga(body),mime:'image/png'};
  return {buffer:body,mime:ext==='.bmp'?'image/bmp':ext==='.png'?'image/png':'image/jpeg'};
 }
 throw Error('Sky face not found.');
}
