import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {writeIsolatedBuild,validateBuildDestination,compileOutputMode} from '../server/isolatedBuild.js';
import {makePortableBsp} from '../server/portableBsp.js';
import {writeDistribution} from '../server/compiledDistribution.js';

const fixture=async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'svstudio-hf10-test-'));
 const base=path.join(root,'Sven Co-op'),gameDir=path.join(base,'svencoop'),addon=path.join(base,'svencoop_addon');
 const destinationDir=path.join(root,'Exports'),workspace=path.join(root,'workspace');
 for(const d of [gameDir,addon,destinationDir,workspace])await fs.mkdir(d,{recursive:true});
 const text=Buffer.from('{\n"classname" "worldspawn"\n"wad" "C:/temp/build/wad.wad;"\n}\n\0','latin1');
 const bsp=Buffer.alloc(124+text.length+4);bsp.writeInt32LE(30,0);
 bsp.writeInt32LE(124,4);bsp.writeInt32LE(text.length,8);text.copy(bsp,124);
 bsp.writeInt32LE(124+text.length,20);bsp.writeInt32LE(4,24);
 const compiledBspPath=path.join(workspace,'testmap.bsp');await fs.writeFile(compiledBspPath,makePortableBsp(bsp,'testmap.wad'));
 const sourceMapPath=path.join(workspace,'testmap.map');await fs.writeFile(sourceMapPath,'{\n"classname" "worldspawn"\n}\n');
 return {root,base,gameDir,addon,destinationDir,workspace,compiledBspPath,sourceMapPath};
};
const extras=[{path:'testmap.wad',bytes:Buffer.from('WAD3temporary generated texture bytes')}];
async function gameSnapshot(game){
 const walk=async(dir)=>{const r=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){
  const name=path.join(dir,e.name);if(e.isDirectory())for(const item of await walk(name))r.push(item);else r.push(path.relative(game.base,name));
 }return r.sort()};return walk(game.base);
}
test('legacy off is a no-install isolated build, explicit install is separate',()=>{
 assert.equal(compileOutputMode('off'),'build');assert.equal(compileOutputMode('build'),'build');assert.equal(compileOutputMode('install'),'install');
});
test('export target never points at game, addon, or parent',async t=>{
 const f=await fixture();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 await assert.rejects(validateBuildDestination(f.gameDir,f.gameDir),/separate export folder/);
 await assert.rejects(validateBuildDestination(f.addon,f.gameDir),/separate export folder/);
 await assert.rejects(validateBuildDestination(f.base,f.gameDir),/separate export folder/);
 assert.equal(await validateBuildDestination(f.destinationDir,f.gameDir),f.destinationDir);
});
test('isolated build contains source, log, WAD and BSP without touching game',async t=>{
 const f=await fixture();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 const before=await gameSnapshot(f);
 const r=await writeIsolatedBuild({...f,mapName:'testmap',inlineBinaryFiles:extras,format:'build',buildLog:'Completed\n'});
 for(const name of ['Distribucion/maps/testmap.bsp','Distribucion/testmap.wad','Fuentes/testmap.map','Logs/compilacion.log'])assert.equal((await fs.stat(path.join(r.destination,name))).isFile(),true,name);
 assert.deepEqual(await gameSnapshot(f),before);
});
test('complete folder + zip packages from staged BSP, never game/maps',async t=>{
 const f=await fixture();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 const before=await gameSnapshot(f);
 const r=await writeIsolatedBuild({...f,mapName:'testmap',inlineBinaryFiles:extras,format:'folder_zip',writeDistribution,buildLog:'compiled'});
 for(const rel of ['Distribucion/maps/testmap.bsp','Distribucion/testmap.wad','Fuentes/testmap.map','Logs/compilacion.log','testmap_SvenCoop.zip'])assert.ok((await fs.stat(path.join(r.destination,rel))).isFile(),rel);
 assert.deepEqual(await gameSnapshot(f),before);
 const old=await fs.readFile(r.output);
 const r2=await writeIsolatedBuild({...f,mapName:'testmap',inlineBinaryFiles:extras,format:'folder',writeDistribution});
 assert.notEqual(r.destination,r2.destination);assert.deepEqual(await fs.readFile(r.output),old);
});
test('install mode is explicit and rejects conflicts before writes',async t=>{
 const f=await fixture();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 await fs.mkdir(path.join(f.addon,'maps'),{recursive:true});
 await fs.writeFile(path.join(f.addon,'maps','testmap.bsp'),Buffer.from('different'));
 await assert.rejects(writeDistribution({...f,mapName:'testmap',destinationDir:f.gameDir,format:'install',inlineBinaryFiles:extras}),/different file/);
 assert.equal((await fs.readFile(path.join(f.addon,'maps','testmap.bsp'))).toString(),'different');
 await assert.rejects(fs.stat(path.join(f.addon,'testmap.wad')),{code:'ENOENT'});
 await fs.unlink(path.join(f.addon,'maps','testmap.bsp'));
 const installed=await writeDistribution({...f,mapName:'testmap',destinationDir:f.gameDir,format:'install',inlineBinaryFiles:extras});
 assert.equal(installed.files,3);
 assert.ok((await fs.stat(path.join(f.addon,'maps','testmap.bsp'))).isFile());
 assert.ok((await fs.stat(path.join(f.addon,'testmap.wad'))).isFile());
});
test('portable BSP keeps each other lump byte-identical, writes WAD basename only',async()=>{
 const e=Buffer.from('{"classname" "worldspawn" "wad" "C:/tmp/build/mytest.wad;"}\n\0');
 const initial=Buffer.alloc(124+e.length+10);initial.writeInt32LE(30,0);initial.writeInt32LE(124,4);initial.writeInt32LE(e.length,8);e.copy(initial,124);
 initial.writeInt32LE(124+e.length,20);initial.writeInt32LE(10,24);initial.fill(3,124+e.length);
 const final=makePortableBsp(initial,'testmap.wad');
 const ents=final.toString('latin1',final.readInt32LE(4),final.readInt32LE(4)+final.readInt32LE(8));
 assert.match(ents,/"wad" "testmap.wad;"/);assert.doesNotMatch(ents,/C:\/tmp/);
 const before=initial.subarray(initial.readInt32LE(20),initial.readInt32LE(20)+10);
 const after=final.subarray(final.readInt32LE(20),final.readInt32LE(20)+10);
 assert.deepEqual(before,after);
});

test('bundled editor WAD works without installing svstudio.wad in the game',async t=>{
 const f=await fixture();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 const {prepareCompileWads}=await import('../server/compileWads.js');
 const root=path.resolve('public','svstudio.wad');
 const map='{\n"classname" "worldspawn"\n"wad" "svstudio.wad;"\n{\n( 0 0 0 ) ( 64 0 0 ) ( 64 64 0 ) SV_BRICK01 [ 1 0 0 0 ] [ 0 1 0 0 ] 0 1 1\n}\n}\n';
 const result=await prepareCompileWads(map,{gameDir:f.gameDir,compilerDir:f.workspace,builtInWad:root});
 assert.equal(result.missingWads.length,0);
 assert.ok(result.resolvedWadList.some(w=>w.endsWith('svstudio.wad')));
 assert.ok(result.map.includes('svstudio.wad'));
 await assert.rejects(fs.stat(path.join(f.gameDir,'svstudio.wad')),{code:'ENOENT'});
});
