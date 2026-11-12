import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {inspectMapPackage,createMapPackage,cleanRelative,bspEntities} from '../server/mapPackager.js';
const fixtures=async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'sven-packager-test-'));
  const gameDir=path.join(root,'svencoop'),addon=path.join(root,'svencoop_addon');
  await fs.mkdir(gameDir,{recursive:true});await fs.mkdir(addon,{recursive:true});
  const write=async(folder,rel,data)=>{const p=path.join(folder,rel);await fs.mkdir(path.dirname(p),{recursive:true});await fs.writeFile(p,data)};
  const ents='{"classname" "worldspawn" "skyname" "testsky"}\n{"classname" "monster_custom" "model" "models/custom/test.mdl"}\n{"classname" "ambient_generic" "message" "custom/boom.wav"}\n';
  const data=Buffer.from(ents+'\0','latin1'),bsp=Buffer.alloc(124+data.length+4);
  bsp.writeInt32LE(30,0);bsp.writeInt32LE(124,4);bsp.writeInt32LE(data.length,8);
  const texStart=124+data.length;bsp.writeInt32LE(texStart,4+2*8);bsp.writeInt32LE(4,8+2*8);data.copy(bsp,124);bsp.writeInt32LE(0,texStart);
  await write(gameDir,'maps/testmap.bsp',bsp);
  await write(addon,'maps/testmap.cfg','map_script my_mod/monster\n');
  await write(addon,'maps/testmap.res','sprites/custom/banner.spr\n');
  await write(addon,'sprites/custom/banner.spr',Buffer.alloc(40,3));
  await write(addon,'scripts/maps/my_mod/monster.as','#include "shared.as"\nvoid MapInit(){}\n');
  await write(addon,'scripts/maps/my_mod/shared.as','void Helper(){}\n');
  await write(addon,'models/custom/test.mdl',Buffer.alloc(80,8));
  await write(addon,'models/custom/testT.mdl',Buffer.alloc(80,7));
  await write(addon,'sound/custom/boom.wav',Buffer.alloc(80,4));
  for(const face of ['bk','dn','ft','lf','rt','up'])await write(addon,`gfx/env/testsky${face}.tga`,Buffer.alloc(32,5));
  await write(gameDir,'models/default/hl.mdl',Buffer.from('base game model'));
  return {root,gameDir,addon,write,bsp};
};

test('validates resource paths and rejects traversal and dangerous entries',()=>{
  for(const bad of ['../evil','models/../secret.mdl','C:/secret.mdl','models/evil.exe','/etc/passwd','scripts/server/plugin.as','models/../../something','models/a\\..\\secret.mdl'])
    assert.throws(()=>cleanRelative(bad));
  assert.equal(cleanRelative('models/custom/example.mdl'),'models/custom/example.mdl');
});

test('reads BSP entity lump without accessing gameplay store',()=>{
  const buf=Buffer.alloc(124+40);buf.writeInt32LE(30,0);buf.writeInt32LE(124,4);buf.writeInt32LE(37,8);
  Buffer.from('{"classname" "worldspawn"}\n\0').copy(buf,124);
  assert.equal(bspEntities(buf)[0].classname,'worldspawn');
  assert.throws(()=>bspEntities(Buffer.alloc(5)));
});

test('scans BSP, CFG, six sky faces, models, sounds and #include, ZIP is independent of installed files',async()=>{
  const f=await fixtures();try{
    const before=await fs.readFile(path.join(f.addon,'maps/testmap.cfg'));
    const input={gameDir:f.gameDir,mapName:'testmap'};
    const result=await inspectMapPackage(input);
    assert.equal(result.missing,0,JSON.stringify(result.entries.filter(x=>x.status==='missing')));
    const paths=result.entries.map(x=>x.path);
    for(const name of ['maps/testmap.bsp','maps/testmap.cfg','scripts/maps/my_mod/monster.as','scripts/maps/my_mod/shared.as','models/custom/test.mdl','models/custom/testT.mdl','sound/custom/boom.wav','sprites/custom/banner.spr','gfx/env/testskyup.tga'])assert.ok(paths.includes(name),name);
    const {zip}=await createMapPackage(input);
    assert.equal(zip.readUInt32LE(0),0x04034b50);
    assert.equal(zip.readUInt32LE(zip.length-22),0x06054b50);
    assert.ok(zip.includes(Buffer.from('SVENSTUDIO_PACKAGING_REPORT.txt')));
    assert.ok(zip.includes(Buffer.from('scripts/maps/my_mod/shared.as')));
    assert.deepEqual(await fs.readFile(path.join(f.addon,'maps/testmap.cfg')),before);
  }finally{await fs.rm(f.root,{recursive:true,force:true})}
});

test('requires explicit acknowledgement of missing dependencies',async()=>{
  const f=await fixtures();try{
    await fs.unlink(path.join(f.addon,'sound/custom/boom.wav'));
    const input={gameDir:f.gameDir,mapName:'testmap'};
    assert.ok((await inspectMapPackage(input)).missing>0);
    await assert.rejects(createMapPackage(input),/resources missing/);
    const output=await createMapPackage({...input,acknowledgeMissing:true});assert.ok(output.zip.length>200);
  }finally{await fs.rm(f.root,{recursive:true,force:true})}
});

test('includes explicitly supplied Custom NPC sources without modifying game CFG',async()=>{
  const f=await fixtures();try{
    const input={gameDir:f.gameDir,mapName:'testmap',inlineFiles:[{path:'scripts/maps/custom_test.as',content:'void MapInit(){ /* test */ }'}],scriptLines:['map_script custom_test']};
    const inventory=await inspectMapPackage(input);
    assert.ok(inventory.entries.some(x=>x.path==='scripts/maps/custom_test.as'&&x.status==='ready'));
    const packaged=(await createMapPackage(input)).zip;
    assert.ok(packaged.includes(Buffer.from('scripts/maps/custom_test.as')));
    assert.ok(packaged.includes(Buffer.from('SVENSTUDIO_CUSTOM_NPC_SETUP.txt')));
    assert.ok(packaged.includes(Buffer.from('map_script custom_test')));
    await assert.rejects(inspectMapPackage({...input,manualPaths:['../../passwd']}),/Invalid resource path/);
  }finally{await fs.rm(f.root,{recursive:true,force:true})}
});

function zipFiles(buffer){
  const files=new Map();let pos=0;
  while(pos+30<=buffer.length&&buffer.readUInt32LE(pos)===0x04034b50){
    const count=buffer.readUInt16LE(pos+26),extra=buffer.readUInt16LE(pos+28),size=buffer.readUInt32LE(pos+18);
    const name=buffer.toString('utf8',pos+30,pos+30+count);
    const start=pos+30+count+extra;files.set(name,buffer.subarray(start,start+size));pos=start+size;
  }
  return files;
}

test('generated RES lists selected client resources, not server scripts/CFG/BSP or vanilla files',async()=>{
  const f=await fixtures();try{
    const input={gameDir:f.gameDir,mapName:'testmap'};
    const before=await fs.readFile(path.join(f.addon,'maps/testmap.res'));
    const inventory=await inspectMapPackage(input);
    assert.ok(inventory.resPreview.includes('models/custom/test.mdl'));
    assert.ok(inventory.resPreview.includes('sound/custom/boom.wav'));
    assert.ok(!inventory.resPreview.some(x=>x.endsWith('.bsp')||x.endsWith('.cfg')||x.endsWith('.as')||x.endsWith('.res')));
    const generated=await createMapPackage(input);const files=zipFiles(generated.zip);
    const manifest=files.get('maps/testmap.res')?.toString('utf8');
    assert.ok(manifest?.includes('models/custom/test.mdl\n'));
    assert.ok(manifest?.includes('sprites/custom/banner.spr\n'));
    assert.ok(!manifest?.includes('maps/testmap.bsp'));
    assert.ok(!manifest?.includes('scripts/maps/'));
    assert.ok(!manifest?.includes('maps/testmap.cfg'));
    assert.equal(manifest?.split('\n').filter(x=>x==='sound/custom/boom.wav').length,1);
    assert.deepEqual(await fs.readFile(path.join(f.addon,'maps/testmap.res')),before,'installed RES remains untouched');
    const withoutModel=await createMapPackage({...input,selectedPaths:['sound/custom/boom.wav','maps/testmap.bsp','maps/testmap.cfg']});
    const filtered=zipFiles(withoutModel.zip);
    const filteredRes=filtered.get('maps/testmap.res').toString('utf8');
    assert.ok(filteredRes.includes('sound/custom/boom.wav'));
    assert.ok(!filteredRes.includes('models/custom/test.mdl'));
    assert.ok(!filtered.has('models/custom/test.mdl'));
    const legacy=zipFiles((await createMapPackage({...input,generateRes:false})).zip);
    assert.deepEqual(legacy.get('maps/testmap.res'),before,'disabled auto-RES preserves existing manifest');
  }finally{await fs.rm(f.root,{recursive:true,force:true})}
});

test('case-mismatched files are repacked to referenced path without editing game content',async()=>{
  const f=await fixtures();try{
    await fs.rename(path.join(f.addon,'sound/custom'),path.join(f.addon,'sound/Custom'));
    await fs.rename(path.join(f.addon,'sound/Custom/boom.wav'),path.join(f.addon,'sound/Custom/Boom.wav'));
    const result=await inspectMapPackage({gameDir:f.gameDir,mapName:'testmap'});
    assert.equal(result.missing,0);
    assert.ok(result.warnings.some(x=>x.includes('sound/custom/boom.wav: file on disk is sound/Custom/Boom.wav')));
    const files=zipFiles((await createMapPackage({gameDir:f.gameDir,mapName:'testmap'})).zip);
    assert.ok(files.has('sound/custom/boom.wav'),'ZIP gets BSP spelling for Linux compatibility');
    assert.ok(!files.has('sound/Custom/Boom.wav'));
    assert.ok(files.get('maps/testmap.res').toString().includes('sound/custom/boom.wav'));
  }finally{await fs.rm(f.root,{recursive:true,force:true})}
});
