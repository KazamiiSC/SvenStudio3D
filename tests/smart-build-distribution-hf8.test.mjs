import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {writeDistribution,distributionOptions} from '../server/compiledDistribution.js';

const prepare=async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sven-hf8-dist-'));
 const gameDir=path.join(root,'Sven Co-op','svencoop'),addon=path.join(root,'Sven Co-op','svencoop_addon'),exports=path.join(root,'Exports');
 await fs.mkdir(path.join(gameDir,'maps'),{recursive:true});await fs.mkdir(addon,{recursive:true});await fs.mkdir(exports);
 const ents=Buffer.from('{"classname" "worldspawn"}\n{"classname" "ambient_generic" "message" "hf8/sound.wav"}\n\0');
 const bsp=Buffer.alloc(124+ents.length+4);bsp.writeInt32LE(30,0);bsp.writeInt32LE(124,4);bsp.writeInt32LE(ents.length,8);ents.copy(bsp,124);
 bsp.writeInt32LE(124+ents.length,20);bsp.writeInt32LE(4,24);bsp.writeInt32LE(0,124+ents.length);
 await fs.writeFile(path.join(gameDir,'maps','testmap.bsp'),bsp);
 await fs.mkdir(path.join(addon,'sound','hf8'),{recursive:true});await fs.writeFile(path.join(addon,'sound','hf8','sound.wav'),Buffer.from('RIFFtestwav'));
 return {root,gameDir,addon,exports};
};
test('config requires valid absolute user destination and format',()=>{
 assert.throws(()=>distributionOptions({mapName:'bad/thing',destinationDir:'/tmp'}),/map name/i);
 assert.throws(()=>distributionOptions({mapName:'testmap',destinationDir:'relative'}),/absolute/);
 assert.throws(()=>distributionOptions({mapName:'testmap',destinationDir:'/tmp',format:'overwrite'}),/format/);
});
test('organizes compiled map and referenced audio using existing packager, plus optional ZIP',async t=>{
 const f=await prepare();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 const result=await writeDistribution({gameDir:f.gameDir,mapName:'testmap',destinationDir:f.exports,format:'folder_zip'});
 assert.equal(result.missing,0);
 const expected=['maps/testmap.bsp','maps/testmap.res','sound/hf8/sound.wav','SVENSTUDIO_PACKAGING_REPORT.txt','testmap_SvenCoop.zip'];
 for(const name of expected)assert.ok((await fs.stat(path.join(result.destination,name))).isFile(),name);
 const res=await fs.readFile(path.join(result.destination,'maps/testmap.res'),'utf8');assert.ok(res.includes('sound/hf8/sound.wav'));
 const before=await fs.readFile(path.join(f.addon,'sound/hf8/sound.wav'));
 const again=await writeDistribution({gameDir:f.gameDir,mapName:'testmap',destinationDir:f.exports,format:'folder'});
 assert.notEqual(result.destination,again.destination);assert.ok(again.destination.endsWith('_2'));
 assert.deepEqual(await fs.readFile(path.join(f.addon,'sound/hf8/sound.wav')),before);
});
test('missing audio blocks incomplete package but leaves game BSP and destination untouched',async t=>{
 const f=await prepare();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 await fs.unlink(path.join(f.addon,'sound/hf8/sound.wav'));
 await assert.rejects(writeDistribution({gameDir:f.gameDir,mapName:'testmap',destinationDir:f.exports}),/resources missing/);
 assert.deepEqual(await fs.readdir(f.exports),[]);
 assert.ok((await fs.stat(path.join(f.gameDir,'maps/testmap.bsp'))).isFile());
});
test('refuses to create packages inside active svencoop data folder',async t=>{
 const f=await prepare();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 await assert.rejects(writeDistribution({gameDir:f.gameDir,mapName:'testmap',destinationDir:f.gameDir}),/separate export folder/);
});
