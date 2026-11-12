import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {listSkies,skyFace,decodeTga} from '../server/skyAssets.js';
const work=await fs.mkdtemp(path.join(os.tmpdir(),'svstudio-skies-'));
try{
 const folder=path.join(work,'svencoop','gfx','env');await fs.mkdir(folder,{recursive:true});
 const makeTga=()=>{const header=Buffer.alloc(18);header[2]=2;header.writeUInt16LE(2,12);header.writeUInt16LE(2,14);header[16]=24;header[17]=0x20;
  return Buffer.concat([header,Buffer.from([255,0,0,0,255,0,0,0,255,255,255,255])])};
 for(const side of ['ft','bk','lf','rt','up','dn'])await fs.writeFile(path.join(folder,'stars'+side+'.tga'),makeTga());
 await fs.writeFile(path.join(folder,'partialft.tga'),makeTga());
 const items=await listSkies(path.join(work,'svencoop'));
 assert.equal(items.length,2);assert.equal(items.find(s=>s.name==='stars').complete,true);assert.equal(items.find(s=>s.name==='partial').complete,false);
 const {buffer,mime}=await skyFace(path.join(work,'svencoop'),'svencoop','stars','ft');assert.equal(mime,'image/png');assert.equal(buffer.subarray(1,4).toString(),'PNG');assert.equal(buffer.readUInt32BE(16),2);
 assert.equal(decodeTga(makeTga()).readUInt32BE(20),2);
 await assert.rejects(()=>skyFace(path.join(work,'svencoop'),'svencoop','../bad','ft'));
 await assert.rejects(()=>skyFace(path.join(work,'svencoop'),'invalid','stars','ft'));
 // Uncompressed and RLE TGA should both be readable.
 const rle=Buffer.alloc(18);rle[2]=10;rle.writeUInt16LE(1,12);rle.writeUInt16LE(2,14);rle[16]=24;
 const png=decodeTga(Buffer.concat([rle,Buffer.from([0x81,0,128,255])]));assert.equal(png.readUInt32BE(20),2);
 console.log('PASS v0.6.4 skies: layered inventory, complete/incomplete skyboxes, PNG conversion, RLE TGA, path guards.');
}finally{await fs.rm(work,{recursive:true,force:true})}
