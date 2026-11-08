import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const load=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('HF4: Build Configuration is only in the top bar, never a Workspace menu entry',()=>{
  const app=load('src/App.tsx');
  const workspace=app.split('id="sven-workspace-menu"')[1].split('</TopDropdown></div>')[0];
  assert.doesNotMatch(workspace,/Build configuration|setDialog\('settings'\)/);
  assert.match(app,/className="top-build-settings"[^>]+onClick=\{\(\)=>setDialog\('settings'\)\}/);
  assert.match(app,/onClick=\{\(\)=>void compile\('game'\)\}/);
});

test('HF4: UV widget has a separate draggable header with persistent position',()=>{
  const src=load('src/components/TextureStudio.tsx');
  const css=load('src/style.css');
  assert.match(src,/const UV_WIDGET_POS_KEY='svenstudio:uv-widget-position-v2'/);
  assert.match(src,/localStorage\.setItem\(UV_WIDGET_POS_KEY,JSON\.stringify\(pinned\.current\)\)/);
  assert.match(src,/const beginMoveWidget=/);
  assert.match(src,/const moveWidget=/);
  assert.match(src,/positionDrag\.current=\{pointerId:e\.pointerId/);
  assert.match(src,/pinned\.current=p;setPosition\(p\)/);
  assert.doesNotMatch(src,/pinned\.current\?\.key===activeKey/);
  assert.match(src,/className="texture-uv-drag-header"/);
  assert.match(css,/\.texture-uv-drag-header\{[\s\S]*?pointer-events:auto/);
  assert.match(src,/onPointerDown=\{e=\>down\(e,h\)\}/);
});

test('HF4: brush clipboard copies snapshots, remaps IDs and creates one undoable batch per paste',()=>{
  const store=load('src/store.ts');
  const app=load('src/App.tsx');
  assert.match(store,/brushClipboard:Brush\[\];brushPasteCount:number/);
  assert.match(store,/copySelectedBrushes:\(\)=>set\(s=>\{/);
  assert.match(store,/brushClipboard:clone\(copied\),brushPasteCount:0/);
  assert.match(store,/pasteCopiedBrushes:\(\)=>set\(s=>\{/);
  assert.match(store,/copy\.id=uid\(\)/);
  assert.match(store,/copy\.entityId=undefined/);
  assert.match(store,/mutate\(s,\[\.\.\.s\.project\.objects,\.\.\.copies\]\)/);
  assert.match(app,/e\.code==='KeyC'/);
  assert.match(app,/e\.code==='KeyV'/);
  assert.match(app,/target\?\.closest\('input, textarea, select, \[contenteditable\]'\)/);
  assert.match(load('src/engine/editorManual.ts'),/Ctrl\+C copia los brushes/);
});
