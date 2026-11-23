/** Original game icons for the home screen, read from the user's OWN installation.
 * SvenStudio never ships Sven Co-op or Counter-Strike assets: the icon is taken
 * from <game>/game.ico on this PC, converted to PNG in memory and never written.
 * Read-only, fixed file names only (no client-supplied file names).
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import zlib from 'node:zlib';
import {discoverInstallations} from './installationDiscovery.js';

const MAX_ICO=4*1024*1024;
const GAMES={
 svengine:{folder:'svencoop',files:['game.ico','sc.ico']},
 cs16:{folder:'cstrike',files:['game.ico','cstrike.ico']},
};
const cache=new Map();

/** Pick the best ICO entry (largest, then deepest colour) and return it as PNG bytes. */
export function icoToPng(ico){
 if(!Buffer.isBuffer(ico)||ico.length<22||ico.readUInt16LE(0)!==0||ico.readUInt16LE(2)!==1)throw Error('Not an ICO file.');
 const count=ico.readUInt16LE(4);if(!count||count>64||6+count*16>ico.length)throw Error('Invalid ICO directory.');
 const entries=[];
 for(let i=0;i<count;i++){
  const o=6+i*16,size=ico.readUInt32LE(o+8),offset=ico.readUInt32LE(o+12);
  if(!size||offset+size>ico.length)continue;
  const data=ico.subarray(offset,offset+size);
  const png=data.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  const width=png?data.readUInt32BE(16):(data.readInt32LE(4)||ico[o]||256);
  const bits=png?32:data.readUInt16LE(14);
  entries.push({data,png,width,bits});
 }
 if(!entries.length)throw Error('ICO has no readable images.');
 entries.sort((a,b)=>b.width-a.width||b.bits-a.bits);
 const best=entries[0];
 return best.png?Buffer.from(best.data):encodePng(...decodeDib(best.data));
}

function decodeDib(dib){
 const header=dib.readUInt32LE(0),width=dib.readInt32LE(4),height=Math.abs(dib.readInt32LE(8))/2,bits=dib.readUInt16LE(14),compression=dib.readUInt32LE(16);
 if(header<40||width<1||width>512||height<1||height>512||compression!==0||![1,4,8,24,32].includes(bits))throw Error('Unsupported ICO bitmap.');
 const colors=bits<=8?(dib.readUInt32LE(32)||1<<bits):0;
 const palette=header,pixels=header+colors*4,stride=((width*bits+31)>>>5)*4,maskStride=((width+31)>>>5)*4,mask=pixels+stride*height;
 if(mask+maskStride*height>dib.length&&bits!==32)throw Error('Truncated ICO bitmap.');
 const rgba=Buffer.alloc(width*height*4);let alphaUsed=false;
 for(let y=0;y<height;y++){
  const row=pixels+(height-1-y)*stride;
  for(let x=0;x<width;x++){
   let b,g,r,a=255;
   if(bits===32){const p=row+x*4;b=dib[p];g=dib[p+1];r=dib[p+2];a=dib[p+3];if(a!==255)alphaUsed=true;}
   else if(bits===24){const p=row+x*3;b=dib[p];g=dib[p+1];r=dib[p+2];}
   else{const index=bits===8?dib[row+x]:bits===4?(dib[row+(x>>1)]>>((x&1)?0:4))&15:(dib[row+(x>>3)]>>(7-(x&7)))&1;const p=palette+index*4;b=dib[p];g=dib[p+1];r=dib[p+2];}
   const q=(y*width+x)*4;rgba[q]=r;rgba[q+1]=g;rgba[q+2]=b;rgba[q+3]=a;
  }
 }
 // Classic icons (and 32-bit ones with an opaque alpha channel) keep transparency in the 1-bit AND mask.
 if(!alphaUsed&&mask+maskStride*height<=dib.length){
  for(let y=0;y<height;y++){const row=mask+(height-1-y)*maskStride;for(let x=0;x<width;x++)if((dib[row+(x>>3)]>>(7-(x&7)))&1)rgba[(y*width+x)*4+3]=0;}
 }
 return [width,height,rgba];
}

function encodePng(width,height,rgba){
 const chunk=(type,data)=>{const t=Buffer.from(type,'ascii'),len=Buffer.alloc(4),crc=Buffer.alloc(4);len.writeUInt32BE(data.length);crc.writeUInt32BE(zlib.crc32(Buffer.concat([t,data]))>>>0);return Buffer.concat([len,t,data,crc]);};
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=6;
 const raw=Buffer.alloc((width*4+1)*height);
 for(let y=0;y<height;y++)rgba.copy(raw,y*(width*4+1)+1,y*width*4,(y+1)*width*4);
 return Buffer.concat([Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}

async function readIcon(dir,game){
 for(const name of GAMES[game].files){
  const file=path.join(dir,name);
  try{const stat=await fs.stat(file);if(stat.isFile()&&stat.size<=MAX_ICO)return icoToPng(await fs.readFile(file));}catch{/* try the next candidate */}
 }
 return null;
}

/** PNG bytes of the installed game's icon, or null when the game is not installed. */
export async function gameIconPng(game,hintDir=''){
 if(!GAMES[game])throw Error('Unknown game.');
 if(cache.has(game))return cache.get(game);
 let png=null;
 // A configured game folder is tried first, but only when it is that game's folder.
 if(typeof hintDir==='string'&&hintDir.length<=1024&&path.isAbsolute(hintDir)&&path.basename(path.resolve(hintDir)).toLowerCase()===GAMES[game].folder)png=await readIcon(path.resolve(hintDir),game);
 if(!png){
  const found=await discoverInstallations().catch(()=>null);
  for(const dir of (game==='cs16'?found?.cs16GameDirs:found?.gameDirs)??[]){png=await readIcon(dir,game);if(png)break;}
 }
 if(png)cache.set(game,png);
 return png;
}
