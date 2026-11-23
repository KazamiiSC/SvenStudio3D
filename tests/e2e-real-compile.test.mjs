/** End-to-end: real compile through the real API with the user's installed compilers.
 * Opt-in (it runs CSG/BSP/VIS/RAD): `npm run test:e2e` or SVEN_E2E=1.
 * Skips cleanly when no Sven Co-op game folder or SC compilers are found on this PC.
 * Writes only to a temporary folder; the game installation and Documents are never touched.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {discoverInstallations} from '../server/installationDiscovery.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const API_PORT=49387,BT_PORT=49388;
// npm sets npm_lifecycle_event, so `npm run test:e2e` works on Windows without setting variables.
const enabled=process.env.SVEN_E2E==='1'||process.env.npm_lifecycle_event==='test:e2e';
const found=enabled?await discoverInstallations().catch(()=>null):null;
const gameDir=found?.gameDirs?.[0],compilerDir=found?.compilerDirs?.[0];
const skip=!enabled?'set SVEN_E2E=1 (npm run test:e2e) to run real compilers':!gameDir||!compilerDir?'Sven Co-op game folder or SC compilers not found':false;

async function startServer(){
  const child=spawn(process.execPath,[path.join(root,'server','index.js')],{cwd:root,env:{...process.env,SVEN_API_PORT:String(API_PORT),SVEN_BUILDTOGETHER_PORT:String(BT_PORT)},stdio:['ignore','pipe','pipe'],windowsHide:true});
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    try{if((await fetch(`http://127.0.0.1:${API_PORT}/api/health`)).ok)return child;}catch{/* starting */}
    await new Promise(r=>setTimeout(r,200));
  }
  child.kill();throw Error('API did not start');
}
async function compile(body){
  const response=await fetch(`http://127.0.0.1:${API_PORT}/api/compile`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal(response.status,200,await response.clone().text().catch(()=>''));
  const events=(await response.text()).trim().split('\n').map(line=>JSON.parse(line));
  const error=events.find(e=>e.type==='error');
  assert.ok(!error,`compile error: ${error?.message}\n${events.filter(e=>e.type==='log').slice(-15).map(e=>e.message).join('\n')}`);
  return events;
}
function assertBsp(bytes){
  assert.ok(bytes.length>124,'BSP too small');
  assert.equal(bytes.readInt32LE(0),30,'GoldSrc BSP version 30');
}

test('real Sven Co-op build: SC-CSG/BSP/VIS/RAD produce a valid BSP in an isolated folder',{skip,timeout:300000},async()=>{
  const server=await startServer();
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'svenstudio-e2e-'));
  try{
    const mapData=await fs.readFile(path.join(root,'examples','starter_room.map'),'utf8');
    const events=await compile({mapName:'svstudio_e2e',mapData,gameProfile:'svengine',compilerEngine:'sc',compilerDir,gameDir,wadPaths:[],fullVis:false,extraRad:false,distributionFormat:'folder',distributionDir:output});
    for(const stage of ['CSG','BSP','VIS','RAD'])assert.ok(events.some(e=>e.type==='stage'&&e.stage===stage&&/finished/.test(e.message)),`${stage} did not finish`);
    const complete=events.find(e=>e.type==='complete');
    assert.ok(complete?.output,'no compiled output reported');
    assert.ok(path.resolve(complete.output).startsWith(path.resolve(output)),'output must stay in the chosen folder');
    assertBsp(await fs.readFile(complete.output));
    // The game installation is never written by a non-install build.
    await assert.rejects(fs.stat(path.join(gameDir,'maps','svstudio_e2e.bsp')));
  }finally{server.kill();await fs.rm(output,{recursive:true,force:true});}
});

test('real lighting preview: temporary BSP is served by id and never installed',{skip,timeout:300000},async()=>{
  const server=await startServer();
  try{
    const mapData=await fs.readFile(path.join(root,'examples','starter_room.map'),'utf8');
    const events=await compile({mapName:'svstudio_e2e_light',mapData,gameProfile:'svengine',compilerEngine:'sc',compilerDir,gameDir,wadPaths:[],fullVis:false,extraRad:false,previewOnly:true});
    const previewId=events.find(e=>e.type==='complete')?.previewId;
    assert.ok(previewId,'no preview id');
    const response=await fetch(`http://127.0.0.1:${API_PORT}/api/lighting-preview/bsp`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({previewId})});
    assert.equal(response.status,200);
    assertBsp(Buffer.from(await response.arrayBuffer()));
    await assert.rejects(fs.stat(path.join(gameDir,'maps','svstudio_e2e_light.bsp')));
  }finally{server.kill();}
});

test('real geometry-only build runs CSG+BSP and skips VIS/RAD',{skip,timeout:300000},async()=>{
  const server=await startServer();
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'svenstudio-e2e-geo-'));
  try{
    const mapData=await fs.readFile(path.join(root,'examples','starter_room.map'),'utf8');
    const events=await compile({mapName:'svstudio_e2e_geo',mapData,gameProfile:'svengine',compilerEngine:'sc',compilerDir,gameDir,wadPaths:[],buildQuality:'geometry',distributionFormat:'folder',distributionDir:output});
    const started=events.filter(e=>e.type==='stage'&&/^Starting/.test(e.message)).map(e=>e.stage);
    assert.deepEqual(started,['CSG','BSP']);
    assertBsp(await fs.readFile(events.find(e=>e.type==='complete').output));
  }finally{server.kill();await fs.rm(output,{recursive:true,force:true});}
});

test('real region build: only the boxed part compiles, sealed and leak-free, as <map>_region',{skip,timeout:300000},async()=>{
  const {importMap}=await import('../src/engine/importMap.ts');
  const {exportMap}=await import('../src/engine/exportMap.ts');
  const {buildRegionProject,regionFromObjects,regionSealTexture,regionMapName}=await import('../src/engine/compileRegion.ts');
  const server=await startServer();
  const output=await fs.mkdtemp(path.join(os.tmpdir(),'svenstudio-e2e-region-'));
  try{
    const project=importMap(await fs.readFile(path.join(root,'examples','starter_room.map'),'utf8'),'starter_room.map');
    const spawn=project.objects.find(o=>o.kind==='entity'&&/^info_player/.test(o.classname));
    assert.ok(spawn,'starter map needs a spawn');
    const region=regionFromObjects(project.objects,[spawn.id],96);
    const build=buildRegionProject(project,region,regionSealTexture(project,[]));
    assert.ok(build.kept<build.total,'the region must leave part of the map out');
    const mapName=regionMapName('svstudio_e2e');
    const events=await compile({mapName,mapData:exportMap(build.project,[]),gameProfile:'svengine',compilerEngine:'sc',compilerDir,gameDir,wadPaths:[],buildQuality:'fast',distributionFormat:'folder',distributionDir:output});
    const leaks=events.filter(e=>/leak/i.test(e.message||''));
    assert.ok(!leaks.some(e=>e.type==='leak'||/LEAK LEAK|leaked/i.test(e.message)),'region build must not leak:\n'+leaks.map(e=>e.type+': '+e.message).join('\n'));
    const complete=events.find(e=>e.type==='complete');
    assert.match(path.basename(complete.output),/svstudio_e2e_region\.bsp$/);
    assertBsp(await fs.readFile(complete.output));
  }finally{server.kill();await fs.rm(output,{recursive:true,force:true});}
});
