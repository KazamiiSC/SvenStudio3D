import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {resolveGameLaunch,launchGame} from '../server/gameLauncher.js';

async function fakeInstall(kind){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'sv-launch-'));
  const layer=kind==='cs16'?'cstrike':'svencoop';
  await fs.mkdir(path.join(root,layer,'maps'),{recursive:true});
  await fs.writeFile(path.join(root,kind==='cs16'?'hl.exe':'svencoop.exe'),'');
  return {root,gameDir:path.join(root,layer)};
}

test('Sven Co-op launch uses svencoop.exe +map and requires an installed BSP',async()=>{
  const {root,gameDir}=await fakeInstall('svengine');
  try{
    await assert.rejects(resolveGameLaunch({gameProfile:'svengine',gameDir,mapName:'my_map'}),/not installed/);
    await fs.mkdir(path.join(root,'svencoop_addon','maps'),{recursive:true});
    await fs.writeFile(path.join(root,'svencoop_addon','maps','my_map.bsp'),'BSP');
    const plan=await resolveGameLaunch({gameProfile:'svengine',gameDir,mapName:'my_map'});
    assert.equal(path.basename(plan.exe),'svencoop.exe');
    assert.deepEqual(plan.args,['+map','my_map']);
    assert.equal(plan.root,root);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('CS 1.6 launch uses hl.exe -game cstrike and finds maps in cstrike_downloads',async()=>{
  const {root,gameDir}=await fakeInstall('cs16');
  try{
    await fs.mkdir(path.join(root,'cstrike_downloads','maps'),{recursive:true});
    await fs.writeFile(path.join(root,'cstrike_downloads','maps','de_test.bsp'),'BSP');
    const calls=[];
    const result=await launchGame({gameProfile:'cs16',gameDir,mapName:'de_test'},{spawnProcess:(exe,args,options)=>{calls.push({exe,args,options});return {on(){},unref(){}};}});
    assert.equal(result.launched,true);
    assert.equal(path.basename(calls[0].exe),'hl.exe');
    assert.deepEqual(calls[0].args,['-game','cstrike','+map','de_test']);
    assert.equal(calls[0].options.detached,true);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('launch rejects unsafe map names and relative game folders',async()=>{
  await assert.rejects(resolveGameLaunch({gameDir:'C:/x',mapName:'../evil'}),/Invalid map name/);
  await assert.rejects(resolveGameLaunch({gameDir:'relative/svencoop',mapName:'ok'}),/game folder/);
});

test('the output window offers Test in game and installs first when needed',async()=>{
  const app=await fs.readFile(new URL('../src/App.tsx',import.meta.url),'utf8');
  assert.match(app,/if\(!lastInstalled&&!\(await installCompiledWithoutRebuild\(\)\)\)return;/);
  assert.match(app,/fetch\('\/api\/game\/launch'/);
  assert.match(await fs.readFile(new URL('../server/index.js',import.meta.url),'utf8'),/app\.post\('\/api\/game\/launch'/);
});
