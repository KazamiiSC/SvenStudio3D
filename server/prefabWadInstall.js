/** Install a WAD included with a BSP prefab into a user-configured Sven Co-op
 * addon folder. Only an explicit UI action calls this; existing files are NEVER overwritten.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {verifyLocalInstall} from './installationDiscovery.js';
import {wadTextureNames} from './compileWads.js';

export const validPrefabWadFilename=name=>typeof name==='string'&&/^[A-Za-z0-9_-]{1,64}\.wad$/i.test(name)&&name.toLowerCase()!=='svstudio.wad'&&name.toLowerCase()!=='decals.wad';
export function validatePrefabWadBytes(bytes){
 if(!Buffer.isBuffer(bytes)||bytes.length<44||bytes.length>24*1024*1024)throw Error('Invalid prefab WAD size (maximum 24 MB).');
 const names=wadTextureNames(bytes);
 if(!names.size||names.size>256||bytes.readInt32LE(4)>256)throw Error('Prefab WAD does not contain a valid texture directory.');
 const dir=bytes.readInt32LE(8),count=bytes.readInt32LE(4);
 for(let i=0;i<count;i++){
   const at=dir+i*32,offset=bytes.readInt32LE(at),length=bytes.readInt32LE(at+4);
   if(bytes[at+13]!==0||bytes[at+12]!==0x43||offset<12||length<40||offset+length>bytes.length)throw Error('Unsupported or malformed prefab WAD texture.');
   const w=bytes.readUInt32LE(offset+16),h=bytes.readUInt32LE(offset+20);
   if(w<1||h<1||w>4096||h>4096||w*h>4194304)throw Error('Invalid WAD texture dimensions.');
   const end=offset+length;
   for(let mip=0;mip<4;mip++){
     const atMip=bytes.readUInt32LE(offset+24+mip*4);
     const mipSize=Math.max(1,w>>>mip)*Math.max(1,h>>>mip);
     if(atMip<40||offset+atMip+mipSize>end)throw Error('WAD mipmap data is incomplete.');
   }
   const paletteAt=offset+bytes.readUInt32LE(offset+36)+Math.max(1,w>>>3)*Math.max(1,h>>>3);
   if(paletteAt+2>end)throw Error('WAD palette is missing.');
   const colors=bytes.readUInt16LE(paletteAt);
   if(colors<1||colors>256||paletteAt+2+colors*3>end)throw Error('WAD palette is invalid.');
 }
 return names;
}
export async function installPrefabWad(gameDir,name,bytes){
 if(!validPrefabWadFilename(name))throw Error('Invalid companion WAD filename.');
 validatePrefabWadBytes(bytes);
 if(!await verifyLocalInstall(gameDir,'game'))throw Error('Choose a valid Sven Co-op game data folder in Build Configuration.');
 const chosen=path.resolve(gameDir),layer=path.basename(chosen).toLowerCase();
 const root=['svencoop','svencoop_addon','svencoop_downloads'].includes(layer)?path.dirname(chosen):chosen;
 // The directory must belong to an existing Sven Co-op installation, not an arbitrary path.
 const gamePath=path.join(root,'svencoop');
 if(!await verifyLocalInstall(gamePath,'game'))throw Error('Sven Co-op svencoop directory not found beside the configured game folder.');
 const addon=path.join(root,'svencoop_addon');
 await fs.mkdir(addon,{recursive:true});
 const destination=path.join(addon,name);
 const checksum=createHash('sha256').update(bytes).digest('hex');
 try{
   const existing=await fs.readFile(destination);
   if(createHash('sha256').update(existing).digest('hex')!==checksum)throw Error(`${name} already exists with different data; nothing was overwritten. Rename/isolate the prefab WAD.`);
   return {path:destination,existing:true};
 }catch(error){if(error?.code!=='ENOENT')throw error;}
 try{const handle=await fs.open(destination,'wx');try{await handle.writeFile(bytes)}finally{await handle.close()}}
 catch(error){if(error?.code==='EEXIST')throw Error('The WAD was created by another process; nothing was overwritten.');throw error}
 return {path:destination,existing:false};
}
