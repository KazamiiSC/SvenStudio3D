import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const read=async (file)=>readFile(new URL('../'+file,import.meta.url),'utf8');
const helperSource=await read('src/engine/cameraKeyboard.ts');
const js=ts.transpileModule(helperSource,{fileName:'cameraKeyboard.ts',compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {keyboardVerticalDirection}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));

test('Q descends and E ascends, cancelling each other',()=>{
  assert.equal(keyboardVerticalDirection(new Set(['KeyQ'])),-1);
  assert.equal(keyboardVerticalDirection(new Set(['KeyE'])),1);
  assert.equal(keyboardVerticalDirection(new Set(['KeyQ','KeyE'])),0);
  assert.equal(keyboardVerticalDirection(new Set()),0);
});

test('E remains available for face extrusion and Gameplay Test interaction',async()=>{
  assert.equal(keyboardVerticalDirection(new Set(['KeyE']),true),0);
  assert.equal(keyboardVerticalDirection(new Set(['KeyQ']),true),-1);
  const app=await read('src/App.tsx');
  assert.match(app,/e.code==='KeyE'[^\n]+!useEditor.getState\(\).flyMode[^\n]+geometryMode==='face'/);
  const viewport=await read('src/components/Viewport.tsx');
  assert.match(viewport,/if\(e.code==='KeyE'&&walkSettingsRef\.current\.interactions\)/);
});

test('RMB drag turns camera and Q E move vertically',async()=>{
  const viewport=await read('src/components/Viewport.tsx');
  assert.match(viewport,/rightMouseLook\.current/);
  assert.match(viewport,/canvas\.addEventListener\('pointermove',move,true\)/);
  assert.match(viewport,/const vertical=keyboardVerticalDirection\(active,faceExtrudeActive\)/);
  assert.match(viewport,/if\(vertical\)move\.y\+=vertical/);
  assert.match(viewport,/camera\.position\.add\(move\)/);
  assert.doesNotMatch(viewport,/const yaw=keyboardYawDelta/);
});

test('FPS is draggable even when editor occupies its former position',async()=>{
  const hud=await read('src/components/HudCustomizer.tsx');
  const css=await read('src/style.css');
  const widget=await read('src/components/HudWidget.tsx');
  assert.match(hud,/editing&&selected==='fps'\?'hud-editor-avoid-fps'/);
  assert.match(hud,/aria-label="HUD X"/);
  assert.match(hud,/aria-label="HUD Y"/);
  assert.match(css,/\.hud-editor-controls\.hud-editor-avoid-fps\{left:9px;right:auto;/);
  assert.match(css,/\.hud-fps\.hud-editing\.hud-selected\{z-index:50\}/);
  assert.match(widget,/onPointerDown=\{e=>start\(e,'move'\)\}/);
});

test('HF1 modifications parse as TypeScript/TSX without syntax diagnostics',async()=>{
  for(const name of ['src/engine/cameraKeyboard.ts','src/components/HudCustomizer.tsx','src/components/Viewport.tsx','src/App.tsx','src/i18n.ts']){
    const src=await read(name);
    const output=ts.transpileModule(src,{fileName:name,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
    const errors=(output.diagnostics||[]).filter(d=>d.category===ts.DiagnosticCategory.Error);
    assert.deepEqual(errors.map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[],name);
  }
});
