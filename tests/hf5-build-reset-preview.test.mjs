import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {smartWadFilename,planSmartWadBuild,assertNoInstalledWadCollision} from '../server/smartWadBuild.js';
import {readWorldWadList,prepareCompileWads} from '../server/compileWads.js';
import {makePortableBsp} from '../server/portableBsp.js';

const source=`{\n"classname" "worldspawn"\n"wad" "svstudio.wad;"\n{\n( 0 0 0 ) ( 128 0 0 ) ( 0 128 0 ) SV_BRICK01 [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1\n}\n}`;
test('custom Smart WAD name is validated and cannot shadow built-in or game WADs',()=>{
 assert.equal(smartWadFilename('', 'roof', '123456789abc'),'ss_roof_123456789abc.wad');
 assert.equal(smartWadFilename('roof_night_textures.wad','roof','1234'),'roof_night_textures.wad');
 for(const bad of ['../oops.wad','../../bad.wad','roof.wad/../file','halflife.wad','svstudio.wad','decals.wad','my textures.wad','wrong.exe','9roof.wad','r'.repeat(49)+'.wad']){
  assert.throws(()=>smartWadFilename(bad,'roof','1234'),/Invalid|Reserved/,bad);
 }
});
test('generated file and compiler MAP share exact custom WAD basename',async t=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'hf5-smart-name-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const src=path.resolve('public/svstudio.wad');
 const plan=await planSmartWadBuild(source,[src],{workDir:dir,mapName:'rooftop',mode:'external',wadName:'rooftop_custom.wad'});
 assert.equal(plan.basename,'rooftop_custom.wad');
 assert.equal(path.basename(plan.file),'rooftop_custom.wad');
 assert.equal((await fs.readFile(plan.file)).equals(plan.buffer),true);
 assert.equal(path.basename(readWorldWadList(plan.map)[0]),plan.basename);
 assert.equal(readWorldWadList(source)[0],'svstudio.wad');
});
test('delivered BSP worldspawn points at custom WAD filename rather than the temporary path',()=>{
 const header=124,world=Buffer.from('{\n"classname" "worldspawn"\n"wad" "C:/Temp/ss_abc.wad;"\n}\0','latin1');
 const bytes=Buffer.alloc(header+world.length);bytes.writeInt32LE(30,0);bytes.writeInt32LE(header,4);bytes.writeInt32LE(world.length,8);world.copy(bytes,header);
 const actual=makePortableBsp(bytes,'rooftop_custom.wad');
 const entities=actual.toString('latin1',actual.readInt32LE(4),actual.readInt32LE(4)+actual.readInt32LE(8));
 assert.match(entities,/"wad" "rooftop_custom\.wad;"/);assert.doesNotMatch(entities,/C:\/Temp/);
});
test('source resolver finds halflife.wad in the sibling valve folder',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hf5-valve-wad-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const game=path.join(root,'svencoop'),valve=path.join(root,'valve');await fs.mkdir(game);await fs.mkdir(valve);
 await fs.copyFile(path.resolve('public/svstudio.wad'),path.join(valve,'halflife.wad'));
 const map=source.replace('svstudio.wad','halflife.wad');
 const result=await prepareCompileWads(map,{gameDir:game,compilerDir:root,builtInWad:path.resolve('public/svstudio.wad')});
 assert.equal(result.missingWads.length,0);assert.ok(result.resolvedWadList.includes(path.join(valve,'halflife.wad')));
});

test('custom WAD refuses a conflicting existing game-layer file without modifying it',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hf5-wad-collision-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const game=path.join(root,'svencoop');await fs.mkdir(game);
 const filename='roof_custom.wad',existing=path.join(game,filename);
 const buffer=Buffer.from('WAD3-new');const plan={mode:'external',basename:filename,buffer};
 await assertNoInstalledWadCollision(plan,game);
 await fs.writeFile(existing,Buffer.from('WAD3-old'));
 await assert.rejects(assertNoInstalledWadCollision(plan,game),/name collision/);
 assert.equal((await fs.readFile(existing)).toString(),'WAD3-old');
 await fs.writeFile(existing,buffer);
 await assertNoInstalledWadCollision(plan,game);
});
test('reset controls are deliberately scoped and WebGL canvas overlay cannot obscure preview',async()=>{
 const reset=await fs.readFile('src/engine/studioReset.ts','utf8'),ui=await fs.readFile('src/components/StudioResetDialog.tsx','utf8'),viewer=await fs.readFile('src/components/BrushWorkshopPreview3D.tsx','utf8');
 assert.match(reset,/forgetSavedWadFiles/);assert.match(reset,/clearRecoveryForFactoryReset/);assert.match(reset,/studioStorageKeys/);
 assert.match(ui,/typed!=='CLEAN'/);assert.match(ui,/resetStudioBrowserData/);
 assert.match(viewer,/<Canvas/);assert.match(viewer,/OrbitControls/);assert.match(viewer,/onFaceSelect/);
 const style=await fs.readFile('src/style.css','utf8');
 assert.match(style,/\.bw-3d-stage>div:not\(\.bw-3d-watermark\)/);
 assert.match(style,/\.bw-3d-stage>\.bw-3d-watermark\{width:max-content!important;height:auto!important/);
});
