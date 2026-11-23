import {test} from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import {resolveCompilerProfile} from '../server/sdhltCompiler.js';
import {isCS16GameDirectory,loadCS16Fgd} from '../server/cs16Profile.js';
import {discoverInstallations,verifyLocalInstall} from '../server/installationDiscovery.js';
import {writeIsolatedBuild,validateBuildDestination} from '../server/isolatedBuild.js';
import {bspWadRoots} from '../server/bspWadAssets.js';
import {modelRoots} from '../server/modelAssets.js';
import {skyRoots} from '../server/skyAssets.js';
import {soundRoots} from '../server/soundAssets.js';
const bundled=path.resolve('server/cs16-basic.fgd');
const read=p=>fs.readFile(p,'utf8');

test('game-specific ZHLT compiler profile requires all four native binaries and does not fall back to SC',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ss-cs16-tools-'));
 try{
  for(const stage of ['csg','bsp','vis','rad'])await fs.writeFile(path.join(root,`hl${stage}.exe`),'mock');
  const found=resolveCompilerProfile({compilerEngine:'zhlt',compilerDir:root});
  assert.equal(found.engine,'zhlt');assert.equal(found.executablePaths.length,4);assert.deepEqual(found.radArgs,[]);
  assert.throws(()=>resolveCompilerProfile({compilerEngine:'wrong',compilerDir:root}),/Unknown compiler engine/);
  await fs.unlink(path.join(root,'hlvis.exe'));
  assert.throws(()=>resolveCompilerProfile({compilerEngine:'zhlt',compilerDir:root}),/compiler missing.*VIS/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('CS directory identity and FGD selection do not touch Sven Co-op',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ss-cs16-game-'));
 try{
  const cstrike=path.join(root,'cstrike'),svencoop=path.join(root,'svencoop');
  await fs.mkdir(cstrike);await fs.mkdir(svencoop);
  await fs.writeFile(path.join(cstrike,'liblist.gam'),'game "Counter-Strike"');
  await fs.writeFile(path.join(svencoop,'liblist.gam'),'game "Sven Co-op"');
  assert.equal(await isCS16GameDirectory(cstrike),true);
  assert.equal(await isCS16GameDirectory(svencoop),false);
  assert.equal(await verifyLocalInstall(cstrike,'game'),true);
  let result=await loadCS16Fgd(cstrike,bundled);
  assert.equal(result.source,'bundled');assert.match(result.contents,/func_bomb_target/);
  const custom='@PointClass = cs_special : "Special" []';
  await fs.writeFile(path.join(cstrike,'cstrike.fgd'),custom);
  result=await loadCS16Fgd(cstrike,bundled);
  assert.equal(result.source,'local');assert.match(result.contents,/cs_special/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('Steam Half-Life/cstrike discovery is additional to original Sven discovery',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ss-cs16-steam-'));
 try{
  const common=path.join(root,'steamapps','common');
  await fs.mkdir(path.join(common,'Half-Life','cstrike'),{recursive:true});
  await fs.mkdir(path.join(common,'Sven Co-op','svencoop'),{recursive:true});
  const result=await discoverInstallations({drives:[],steamPaths:[root]});
  assert.equal(result.cs16GameDirs.length,1);assert.equal(result.gameDirs.length,1);
  assert.match(result.cs16GameDirs[0],/cstrike$/);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
test('CS16 isolated output uses a dedicated name and never writes into the game',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'ss-cs16-output-'));
 try{
  const cstrike=path.join(tmp,'Half-Life','cstrike'),destination=path.join(tmp,'exports'),src=path.join(tmp,'source.map'),bsp=path.join(tmp,'compiled.bsp');
  await fs.mkdir(cstrike,{recursive:true});await fs.mkdir(destination);
  await fs.writeFile(src,'MAP SOURCE');await fs.writeFile(bsp,'BSP BYTES');
  const before=await fs.readdir(cstrike);
  const result=await writeIsolatedBuild({gameProfile:'cs16',gameDir:cstrike,mapName:'de_demo',compiledBspPath:bsp,sourceMapPath:src,destinationDir:destination,buildLog:'OK'});
  assert.match(result.destination,/de_demo_CS16/);
  assert.equal(await read(result.output),'BSP BYTES');
  assert.equal(await read(path.join(result.destination,'Fuentes','de_demo.map')),'MAP SOURCE');
  assert.deepEqual(await fs.readdir(cstrike),before);
  await assert.rejects(()=>validateBuildDestination(cstrike,cstrike));
 }finally{await fs.rm(tmp,{recursive:true,force:true})}
});
test('CS16 bundled FGD has CT/T spawns, bombsite and buyzone with proper point/solid classes',async()=>{
 const text=await read(bundled);
 assert.match(text,/@PointClass[^\n]*info_player_start/);
 assert.match(text,/@PointClass[^\n]*info_player_deathmatch/);
 assert.match(text,/@SolidClass[^\n]*func_bomb_target/);
 assert.match(text,/@SolidClass[^\n]*func_buyzone/);
});
test('source profile selection and compilation safety blocks are wired in the app and server',async()=>{
 const [store,app,server,modal,validation]=await Promise.all([
  read('src/store.ts'),read('src/App.tsx'),read('server/index.js'),read('src/components/SmartBuildSettingsModal.tsx'),read('src/engine/projectValidation.ts')]);
 assert.match(modal,/Counter-Strike 1\.6 · GoldSrc/);assert.match(store,/setGameProfile:profile=>set/);
 assert.match(store,/target:profile/);assert.match(app,/gameProfile:cs16\?'cs16':'svengine'/);
 assert.match(server,/CS 1\.6 requires the ZHLT compilers/);assert.match(server,/isCS16GameDirectory\(gameDir\)/);
 assert.match(validation,/input\.target!=='cs16'/);
});

test('CS BSP WAD, model, sound and sky browsers use cstrike then valve (read only)',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'ss-cs16-assets-'));
 try{
  for(const folder of ['cstrike','valve']){
   for(const sub of ['models','sound','gfx/env'])await fs.mkdir(path.join(root,folder,sub),{recursive:true});
  }
  const dir=path.join(root,'cstrike');
  const wads=await bspWadRoots(dir),models=await modelRoots(dir),sounds=await soundRoots(dir),skies=await skyRoots(dir);
  for(const list of [wads,models,sounds,skies])assert.deepEqual(list.map(x=>x.layer||x.folder||x.source),['cstrike','valve']);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
