import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>readFileSync(path.join(root,file),'utf8');
const grid=await import('../src/engine/gridPrecision.ts');
test('editor snap and visible grid have independent default steps',()=>{
  assert.equal(grid.DEFAULT_EDIT_STEP,1);
  assert.equal(grid.DEFAULT_VISIBLE_GRID,16);
  assert.deepEqual(grid.GRID_STEPS,[1,2,4,8,16,32,64,128,256]);
});
test('visible grid value is strictly validated',()=>{
  for(const v of grid.GRID_STEPS)assert.equal(grid.normalizeGridStep(v),v);
  for(const v of [0,-1,3,NaN,Infinity,'8',1024])assert.equal(grid.normalizeGridStep(v),16);
  assert.equal(grid.normalizeGridStep(3,1),1);
});
test('visible grid setting survives reload without changing editing precision',()=>{
  const backup=globalThis.localStorage;
  const items=new Map();
  globalThis.localStorage={getItem:k=>items.get(k)??null,setItem:(k,v)=>items.set(k,String(v))};
  try{
    assert.equal(grid.loadVisibleGridStep(),16);
    grid.saveVisibleGridStep(64);
    grid.saveEditStep(2);
    assert.equal(grid.loadEditStep(),2);
    assert.equal(grid.loadVisibleGridStep(),64);
    assert.equal(grid.DEFAULT_EDIT_STEP,1);
    items.set('svenstudio:grid-visible-step-v1','999');
    assert.equal(grid.loadVisibleGridStep(),16);
  }finally{if(backup===undefined)delete globalThis.localStorage;else globalThis.localStorage=backup}
});
test('store offers separate setters without writing to MAP/project state',()=>{
  const s=read('src/store.ts');
  assert.match(s,/snap:loadEditStep\(\),snapping:true,gridDisplayStep:loadVisibleGridStep\(\)/);
  assert.match(s,/setSnap:value=>set\(\(\)=>\{const snap=normalizeGridStep\(value,1\);saveEditStep\(snap\);return \{snap\}\}\)/);
  assert.match(s,/setGridDisplayStep:value=>set\(\(\)=>\{const gridDisplayStep=normalizeGridStep\(value\);saveVisibleGridStep\(gridDisplayStep\);return \{gridDisplayStep\}\}\)/);
});
test('ground grid uses only visible step; placement and draw snap use edit step',()=>{
  const viewport=read('src/components/Viewport.tsx');
  assert.match(viewport,/function Ground\(\)\{\s*const show=useEditor\(s=>s.showGrid\),snap=useEditor\(s=>s.gridDisplayStep\)/);
  assert.match(viewport,/const span=Math\.min\(8192,Math\.max\(snap\*256,minSpan\)\)/);
  assert.match(viewport,/return show\?<gridHelper/);
  assert.doesNotMatch(viewport,/snap<16&&<gridHelper/);
  const store=read('src/store.ts');
  assert.match(store,/boxFromGroundDrag\(from,to,s.drawHeight,s.snapping\?s.snap:1/);
  assert.match(viewport,/GRID_STEPS\.map\(step=>/);
  assert.match(viewport,/aria-label=\{t\('Visual grid'\)\} value=\{gridDisplayStep\}/);
  assert.match(viewport,/aria-label=\{t\('Move \/ draw step'\)\} value=\{snap\}/);
});
test('rotation and scaling have dedicated precision controls',()=>{
  const v=read('src/components/Viewport.tsx');
  assert.match(v,/t\('Rotation step'\)/);
  assert.match(v,/setControls\(\{rotationSnapDegrees:Number\(e.target.value\)\}\)/);
  assert.match(v,/t\('Scale step'\)/);
  assert.match(v,/setControls\(\{scaleSnapStep:Number\(e.target.value\)\}\)/);
});
test('Shift respects temporary free move in both gizmo preview and commit',()=>{
  const v=read('src/components/Viewport.tsx');
  assert.match(v,/const isGridSnapping=\(\)=>transformGesture\(transformMode,gizmoKeys.current,settings,snapping,false\)\.grid/);
  assert.match(v,/drag.current.mode==='translate'&&isGridSnapping\(\)/);
  assert.match(v,/session.mode==='translate'&&isGridSnapping\(\)/);
  assert.doesNotMatch(v,/\(snapping\|\|gizmoKeys.current.ctrl\)/);
});
test('both HUD and ribbon use visible grid independent from edit snap',()=>{
  const a=read('src/App.tsx'),v=read('src/components/Viewport.tsx');
  assert.match(a,/value=\{gridDisplayStep\} onChange=\{e=>setGridDisplayStep/);
  assert.match(a,/value=\{snap\} onChange=\{e=>setSnap/);
  assert.match(v,/value=\{gridDisplayStep\} onChange=\{e=>setGridDisplayStep/);
});
