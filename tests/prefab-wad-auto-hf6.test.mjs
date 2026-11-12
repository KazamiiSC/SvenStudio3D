import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prefabMaterialNames,prefabWadReport,decodePrefabTextures,appendConfiguredWadPath,prefabWadFile} from '../src/engine/prefabWadDependencies.ts';
import {createBrush} from '../src/engine/geometry.ts';
import {createPrefab} from '../src/engine/prefabs.ts';
import {installPrefabWad,validPrefabWadFilename,validatePrefabWadBytes} from '../server/prefabWadInstall.js';

function wadBytes(name='PREFAB_TEST'){
 const n=16*16,raw=Buffer.alloc(40+n+64+16+4+2+256*3);
 raw.write(name,0,'ascii');raw.writeUInt32LE(16,16);raw.writeUInt32LE(16,20);
 let off=40;
 for(const size of [256,64,16,4]){raw.writeUInt32LE(off,24+([256,64,16,4].indexOf(size))*4);off+=size}
 raw.writeUInt16LE(256,off);
 for(let i=0;i<256;i++){raw[off+2+i*3]=i;raw[off+3+i*3]=i;raw[off+4+i*3]=i;}
 const directory=12+raw.length,out=Buffer.alloc(directory+32);
 out.write('WAD3',0);out.writeInt32LE(1,4);out.writeInt32LE(directory,8);raw.copy(out,12);
 out.writeInt32LE(12,directory);out.writeInt32LE(raw.length,directory+4);out.writeInt32LE(raw.length,directory+8);out[directory+12]=0x43;out.write(name,directory+16,'ascii');
 return out;
}
function prefab(){
 const brush=createBrush('box',[0,0,0],[64,64,64]);for(const face of brush.faces)face.texture='PREFAB_TEST';
 return {...createPrefab([brush],'Test PC'),format:'svenstudio-bsp-object',sourceBsp:'sample.bsp',wad:{filename:'pc_materials.wad',base64:wadBytes().toString('base64')},faceIds:[1,2]};
}
test('Studio lists every material and the exact embedded WAD dependency',()=>{
 const p=prefab();const report=prefabWadReport(p,[], 'C:\\Game\\svencoop_addon\\pc_materials.wad');
 assert.deepEqual(prefabMaterialNames(p),['PREFAB_TEST']);assert.equal(report.embedded,true);
 assert.equal(report.filename,'pc_materials.wad');assert.equal(report.missing.length,1);
 assert.ok(report.configuredPath?.includes('pc_materials.wad'));
 assert.equal(wadBaseCheck(),true);
 function wadBaseCheck(){return appendConfiguredWadPath('C:\\Other\\a.wad','C:\\Game\\pc_materials.wad').split('\n').length===2;}
});
test('mouse placement decoder uses the same original WAD pixels as file import',async()=>{
 const p=prefab(),result=await decodePrefabTextures(p,[]);
 assert.equal(result.textures.length,1);assert.equal(result.textures[0].name,'PREFAB_TEST');
 assert.equal(result.file.name,'pc_materials.wad');assert.deepEqual(Buffer.from(await result.file.arrayBuffer()),wadBytes());
 assert.equal(prefabWadReport(p,result.textures,'').missing.length,0);
});
test('same texture name from a conflicting WAD never replaces active MAP assets',async()=>{
 const p=prefab();
 await assert.rejects(()=>decodePrefabTextures(p,[{name:'PREFAB_TEST',wad:'other.wad',width:32,height:32,dataUrl:'different'}]),/conflict/i);
 await assert.rejects(()=>decodePrefabTextures(p,[{name:'OLD',wad:'pc_materials.wad',width:16,height:16,dataUrl:'other'}]),/different WAD/i);
});
test('server WAD installation validates game root and refuses overwriting user WAD files',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sven-prefab-wad-test-'));
 try{
   const gameDir=path.join(root,'svencoop');await fs.mkdir(path.join(gameDir,'maps'),{recursive:true});
   const bytes=wadBytes(),first=await installPrefabWad(gameDir,'pc_materials.wad',bytes);
   assert.equal(first.existing,false);
   assert.deepEqual(await fs.readFile(first.path),bytes);
   const again=await installPrefabWad(gameDir,'pc_materials.wad',bytes);assert.equal(again.existing,true);
   const other=wadBytes('ANOTHER');
   await assert.rejects(()=>installPrefabWad(gameDir,'pc_materials.wad',other),/nothing was overwritten/);
   assert.deepEqual(await fs.readFile(first.path),bytes);
   await assert.rejects(()=>installPrefabWad(path.join(root,'fake'), 'other.wad',bytes),/valid Sven Co-op/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('malformed or malicious WAD uploads are rejected before disk access',()=>{
 for(const name of ['../file.wad','decals.wad','svstudio.wad','evil.exe','folder/a.wad'])assert.equal(validPrefabWadFilename(name),false);
 assert.equal(validPrefabWadFilename('pc_materials.wad'),true);
 assert.throws(()=>validatePrefabWadBytes(Buffer.alloc(128)),/WAD/i);
 assert.deepEqual([...validatePrefabWadBytes(wadBytes())],['PREFAB_TEST']);
});
test('compilation config adds a path once, without changing unrelated WAD paths',()=>{
 const existing='C:\\Sven\\halflife.wad\nC:\\Sven\\svstudio.wad';
 const next=appendConfiguredWadPath(existing,'C:\\Sven\\svencoop_addon\\pc_materials.wad');
 assert.equal(next.split('\n').length,3);
 assert.equal(appendConfiguredWadPath(next,'D:\\backup\\pc_materials.wad'),next);
});
