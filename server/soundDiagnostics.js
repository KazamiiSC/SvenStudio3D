// Read-only diagnostics. Matches are returned in configured folder scan order,
// which is not a guarantee about the engine's cache or runtime precedence.
import fs from 'node:fs/promises';
import path from 'node:path';
import {soundRoots,validSoundPath} from './soundAssets.js';

function wavInfo(buffer){
  if(buffer.length<44||buffer.toString('ascii',0,4)!=='RIFF'||buffer.toString('ascii',8,12)!=='WAVE')return null;
  let i=12;
  while(i+24<=buffer.length){
    const length=buffer.readUInt32LE(i+4);
    if(buffer.toString('ascii',i,i+4)==='fmt '&&length>=16){
      return {format:buffer.readUInt16LE(i+8),channels:buffer.readUInt16LE(i+10),rate:buffer.readUInt32LE(i+12),bits:buffer.readUInt16LE(i+22)};
    }
    i+=8+length+(length%2);
  }
  return null;
}
export async function inspectSoundReference(gameDir,soundPath){
  if(!validSoundPath(soundPath))throw Error('Use a valid sound path relative to the sound folder (without sound/).');
  const roots=await soundRoots(gameDir),matches=[];
  for(const {source,root} of roots){
    const file=path.resolve(root,...soundPath.split('/'));
    if(!file.startsWith(root+path.sep))continue;
    try{
      const real=await fs.realpath(file);
      if(!real.startsWith(root+path.sep))continue;
      const stat=await fs.stat(real);if(!stat.isFile())continue;
      const handle=await fs.open(real,'r');let buf;
      try{buf=Buffer.alloc(Math.min(stat.size,4096));await handle.read(buf,0,buf.length,0)}finally{await handle.close()}
      matches.push({source,bytes:stat.size,wav:path.extname(soundPath).toLowerCase()==='.wav'?wavInfo(buf):null});
    }catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error}
  }
  return {path:soundPath,matches};
}
