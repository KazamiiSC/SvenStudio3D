import test from 'node:test';
import assert from 'node:assert/strict';
import {browserWadsForSmartBuild} from '../src/engine/smartBuildBrowserWads.ts';
import {studioStorageKeys} from '../src/engine/studioReset.ts';
const project={objects:[{kind:'brush',faces:[{texture:'USED'}]}]};
const assets=[{name:'USED',wad:'big.wad'}];
test('large browser WAD does not trigger the old 14/20 MiB compilation-blocking error',async()=>{
 const bytes=Buffer.alloc(14*1024*1024+5);bytes.write('WAD3');
 const prefabs=[{wad:{filename:'big.wad',base64:bytes.toString('base64')}}];
 const result=await browserWadsForSmartBuild(project,assets,prefabs);
 assert.deepEqual(result,[],'oversized browser WAD is deferred to on-disk resolver');
});
test('small browser WAD is still injected for portable prefab builds',async()=>{
 const bytes=Buffer.alloc(1024);bytes.write('WAD3');
 const prefabs=[{wad:{filename:'big.wad',base64:bytes.toString('base64')}}];
 const result=await browserWadsForSmartBuild(project,assets,prefabs);
 assert.equal(result.length,1);assert.equal(result[0].name,'big.wad');
 assert.equal(Buffer.from(result[0].base64,'base64').equals(bytes),true);
});
test('local reset includes saved workspace layouts but not unrelated browser storage',()=>{
 const keys=['svenstudio-settings','sven-studio-ui-layout-041','svstudio-model-grid','sven-bsp-fly-speed','unrelated-app-secret'];
 const selected=studioStorageKeys({length:keys.length,key:i=>keys[i]});
 assert.deepEqual(selected,keys.slice(0,4));
});
