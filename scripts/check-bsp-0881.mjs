import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const input=fs.readFileSync(new URL('../src/engine/bspViewerTools.ts',import.meta.url),'utf8');
const js=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {bspEntityLabel,bspEntitySearchText,bspFlyAxes,bspFlyMultiplier,clampBspFlySpeed,clampBspFlySensitivity}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const entity={classname:'func_door',properties:{targetname:'north_gate',target:'relay_1'},origin:[10,20,30]};
assert.equal(bspEntityLabel(entity),'func_door · north_gate');
assert.equal(bspEntityLabel({classname:'light',properties:{}}),'light');
assert.ok(bspEntitySearchText(entity).includes('north_gate'));
assert.ok(bspEntitySearchText(entity).includes('relay_1'));
assert.deepEqual(bspFlyAxes(new Set(['KeyW','KeyD','Space'])),{forward:1,right:1,up:1});
assert.deepEqual(bspFlyAxes(new Set(['KeyA','KeyS','KeyQ'])),{forward:-1,right:-1,up:-1});
assert.deepEqual(bspFlyAxes(new Set(['KeyW','KeyS','KeyA','KeyD','KeyE','KeyQ'])),{forward:0,right:0,up:0});
assert.equal(bspFlyMultiplier(new Set(['ShiftLeft'])),3);
assert.equal(bspFlyMultiplier(new Set(['ControlLeft'])),.3);
assert.equal(bspFlyMultiplier(new Set(['ShiftLeft','ControlLeft'])),3);
assert.equal(bspFlyMultiplier(new Set()),1);
assert.equal(clampBspFlySpeed(-5),40);
assert.equal(clampBspFlySpeed(50000),2000);
assert.equal(clampBspFlySpeed(NaN),360);
assert.equal(clampBspFlySensitivity(0),.0005);
assert.equal(clampBspFlySensitivity(.9),.006);
for(const file of ['../src/components/BspViewer.tsx','../src/engine/bspViewerTools.ts','../src/i18n.ts']){
  const fname=new URL(file,import.meta.url);const source=fs.readFileSync(fname,'utf8');
  const result=ts.transpileModule(source,{fileName:fname.pathname,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}});
  assert.equal(result.diagnostics?.length||0,0,`Syntax errors in ${file}`);
}
const viewer=fs.readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
for(const token of ['<sprite','bspEntityLabel(',"t('Entity labels')",'requestPointerLock()',"t('Movement speed')",'setFocus(',"t('Focus selected entity')"]){
  assert.ok(viewer.includes(token),`Missing feature connection: ${token}`);
}
const locales=fs.readFileSync(new URL('../src/i18n.ts',import.meta.url),'utf8');
for(const locale of ['es','ru','ko'])assert.ok(locales.includes(`Object.assign(${locale},{\n  'Entity labels':`),`Missing labels translations: ${locale}`);
console.log('BSP v0.8.8.1: 20 navigation/label/translation checks passed.');
