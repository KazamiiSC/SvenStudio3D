import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('first launch: all three functional dock panels visible and user layout remains customizable',async()=>{
 globalThis.localStorage={getItem:()=>null,setItem:()=>{},removeItem:()=>{}};globalThis.window={localStorage:globalThis.localStorage};
 const {useStudioLayout,mergeSavedLayout}=await import('../src/layout.ts');
 const s=useStudioLayout.getState();
 for(const id of ['assets','explorer','properties'])assert.equal(s.visible[id],true,id);
 const upgraded=useStudioLayout.persist.getOptions().migrate?.({visible:{assets:false,explorer:false,properties:false},widths:{left:300,right:350}},1);
 for(const id of ['assets','explorer','properties'])assert.equal(upgraded.visible[id],true,id);
 const merged=mergeSavedLayout(upgraded,s);
 assert.equal(merged.widths.left,300);assert.equal(merged.widths.right,350);
 assert.equal(mergeSavedLayout({visible:{assets:false}},s).visible.assets,false,'explicit user choices after migration must persist');
});
test('BuildTogether help lives inside collaboration dialog, preserving session actions',()=>{
 const app=source('src/App.tsx'),panel=source('src/components/BuildTogether.tsx');
 assert.ok(!app.includes('manual-buildTogether'), 'global Help should not contain duplicated BT guide');
 for(const feature of ['createBuildTogether(name)','joinBuildTogether(address,code,name','leaveBuildTogether()','setBuildTogetherFollow(','downloadBuildTogetherBackup()'])assert.ok(panel.includes(feature),feature);
 for(const marker of ['bt-tabs','bt-guide','bt-porthole-steps','role="tabpanel"','TCP 49178'])assert.ok(panel.includes(marker),marker);
});
test('build configuration exposes local Browse and automatic detection without sharing settings in BuildTogether',()=>{
 const app=source('src/App.tsx'),picker=source('src/components/LocalFolderPicker.tsx'),client=source('src/engine/buildTogetherClient.ts');
 assert.ok(app.includes('autoDetectInstallations'));assert.ok(app.includes("setPicker('compiler')"));assert.ok(app.includes("setPicker('game')"));
 assert.ok(app.includes('if(!settings.gameDir||!settings.compilerDir)void detect();'));
 assert.ok(app.includes('initialDetection.current=true'));
 assert.ok(picker.includes('/api/setup/folders'));assert.ok(picker.includes('/api/setup/verify'));
 assert.ok(!client.includes('compilerDir'), 'compiler paths must not be serialized over WebSocket');
});
