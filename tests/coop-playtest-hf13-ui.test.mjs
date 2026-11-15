import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('HF13: Co-op tool is a tab of existing Map Doctor, not a separate duplicative Studio',()=>{
 const src=read('../src/components/MapDoctor.tsx');
 assert.match(src,/CoopPlaytestPanel/);assert.match(src,/doctor-mode-tabs/);
 assert.match(src,/tab==='general'/);
 const app=read('../src/App.tsx');assert.match(app,/<MapDoctor onClose=/);
});
test('HF13: ghost overlay cannot intercept selection or run during walk mode',()=>{
 const src=read('../src/components/Viewport.tsx');
 assert.match(src,/<CoopGhostOverlay\/>/);assert.match(src,/!walkMode&&<CoopGhostOverlay/);
 assert.match(src,/raycast=\{\(\)=>null\}/);
});
test('HF13: preview is separate from project persistence',()=>{
 const src=read('../src/coopPlaytestState.ts');
 assert.match(src,/create/);assert.doesNotMatch(src,/persist\(|localStorage|setProject|loadProject/);
 const engine=read('../src/engine/coopPlaytest.ts');
 assert.doesNotMatch(engine,/exportMap|compileMap|writeFile/);
});
test('HF13: includes all six interface languages',()=>{
 const src=read('../src/components/CoopPlaytestPanel.tsx');
 for(const locale of ['es','en','ru','ko','zh','pt'])assert.match(src,new RegExp(`(?:^|\\s)${locale}:\\{`));
});
