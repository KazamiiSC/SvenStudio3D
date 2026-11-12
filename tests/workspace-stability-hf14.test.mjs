import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mergeSavedLayout,useStudioLayout,TOOLBAR_GROUPS} from '../src/layout.ts';
const files=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('HF14: a partially saved workspace retains every missing dock and action',()=>{
  const original=useStudioLayout.getState();
  const merged=mergeSavedLayout({
    sides:{assets:'bottom'},visible:{assets:true},order:['properties','assets'],
    widths:{left:355},toolbarGroups:['view','edit']
  },original);
  assert.deepEqual(merged.sides,{assets:'bottom',explorer:'right',properties:'right',console:'bottom'});
  assert.deepEqual(merged.order,['properties','assets','explorer','console']);
  assert.equal(merged.visible.assets,true);
  assert.equal(merged.visible.explorer,true);
  assert.equal(merged.widths.left,355);
  assert.equal(merged.widths.right,302);
  assert.deepEqual(merged.toolbarGroups.slice(0,2),['view','edit']);
  assert.equal(merged.toolbarGroups.length,TOOLBAR_GROUPS.length);
  assert.equal(merged.movePanel,original.movePanel,'hydrating preferences must keep live store actions');
});

test('HF14: invalid saved dimensions, docking, and scales reset safely',()=>{
  const original=useStudioLayout.getState();
  const merged=mergeSavedLayout({
    sides:{assets:'outside',explorer:999},
    visible:{assets:'yes'},
    order:['assets','assets','ghost',null],
    widths:{left:NaN,right:-1000},heights:{top:Infinity,bottom:50000},
    weights:{assets:NaN,properties:-1},
    uiScale:NaN,fontScale:Infinity,toolbarDock:'invalid',
    accent:'fuchsia',performancePreset:'turbo',
    toolbarGroups:[null,'view','view','missing']
  },original);
  assert.equal(merged.sides.assets,'left');
  assert.equal(merged.sides.explorer,'right');
  assert.equal(merged.visible.assets,true);
  assert.deepEqual(merged.order,['assets','properties','explorer','console']);
  assert.equal(merged.widths.left,254);
  assert.equal(merged.widths.right,190);
  assert.equal(merged.heights.top,192);
  assert.equal(merged.heights.bottom,500);
  assert.equal(merged.weights.assets,1);
  assert.equal(merged.weights.properties,.12);
  assert.equal(merged.uiScale,1);
  assert.equal(merged.fontScale,1);
  assert.equal(merged.toolbarDock,'top');
  assert.equal(merged.accent,'nebula');
  assert.equal(merged.performancePreset,'balanced');
  assert.equal(new Set(merged.toolbarGroups).size,TOOLBAR_GROUPS.length);
});

test('HF14: malformed saved data never removes required dock records',()=>{
  const original=useStudioLayout.getState();
  for(const malformed of [null,undefined,42,'junk',[],{widths:42,weights:[],sides:'no'}]){
    const hydrated=mergeSavedLayout(malformed,original);
    assert.deepEqual(Object.keys(hydrated.sides).sort(),['assets','console','explorer','properties']);
    assert.ok(hydrated.widths.left>=190);
    assert.equal(hydrated.order.length,4);
  }
});

test('HF14: resize drags release cursor on cancel, browser blur, and Escape',()=>{
  const source=files('src/components/DockWorkspace.tsx');
  const css=files('src/style.css');
  assert.equal((source.match(/window\.addEventListener\('blur',stop\)/g)||[]).length,2);
  assert.equal((source.match(/window\.addEventListener\('pointercancel',(?:onUp|up)\)/g)||[]).length,2);
  assert.equal((source.match(/window\.addEventListener\('keydown',onKey\)/g)||[]).length,2);
  assert.match(source,/document\.body\.style\.userSelect='none'/);
  assert.match(source,/document\.body\.style\.userSelect=previousSelection/);
  assert.match(css,/\.dock-split\{[^}]*touch-action:none/);
  assert.match(css,/\.zone-size-handle\{[^}]*touch-action:none/);
});
