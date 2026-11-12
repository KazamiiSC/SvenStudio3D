import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {editorManual,EDITOR_SHORTCUT_GROUPS} from '../src/engine/editorManual.ts';
import {DEFAULT_CONTROLS,CONTROL_ACTIONS} from '../src/engine/controls.ts';
import {mergeSavedLayout,useStudioLayout} from '../src/layout.ts';
const source=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('HF3: top build configuration replaces duplicate save; File save stays',()=>{
  const app=source('src/App.tsx');
  assert.match(app,/className="top-build-settings"[^>]*onClick=\{\(\)=>setDialog\('settings'\)\}/);
  assert.doesNotMatch(app,/className="top-save"/);
  assert.match(app,/t\('Save project'\)/);
  assert.match(app,/const compile=async/);
  assert.match(source('server/index.js'),/path\.join\(gameDir,'maps'\)/);
  assert.match(source('server/index.js'),/await fs\.copyFile\(`\$\{mapBase\}\.bsp`,output\)/);
});
test('HF3: first-run guide is shown once and dismissal is persisted',()=>{
  const app=source('src/App.tsx');
  assert.match(app,/localStorage\.getItem\('svenstudio:welcome-guide-v1'\)/);
  assert.match(app,/localStorage\.setItem\('svenstudio:welcome-guide-v1','seen'\)/);
  assert.match(app,/dialog==='about'&&<AboutModal onClose=\{closeHelp\}/);
  assert.doesNotMatch(app,/guide\.groups\.map\(/);
});
test('HF3: default Workspace matches screenshot but saved workspace is respected',()=>{
  const current=useStudioLayout.getState();
  assert.equal(current.visible.assets,true);
  assert.equal(current.visible.explorer,true);
  assert.equal(current.visible.properties,true);
  assert.equal(current.toolbarDock,'top');
  assert.equal(current.compactTools,false);
  assert.deepEqual(current.order.slice(0,3),['assets','properties','explorer']);
  const customized=mergeSavedLayout({visible:{assets:false},compactTools:true,toolbarDock:'left',order:['explorer','assets','properties']},current);
  assert.equal(customized.visible.assets,false);
  assert.equal(customized.compactTools,true);
  assert.equal(customized.toolbarDock,'left');
  assert.deepEqual(customized.order.slice(0,3),['explorer','assets','properties']);
});
test('HF3: manual has studios, resource flow, report links and all configurable bindings',()=>{
  const es=editorManual('es'),en=editorManual('en');
  for(const manual of [es,en]){
    assert.ok(manual.studios.length>=13);
    assert.ok(manual.first.length>=4);
    assert.ok(manual.camera.length>=4);
    assert.ok(manual.technical.some(p=>p.includes('127.0.0.1')));
    assert.ok(manual.workspace.some(p=>p.includes('Workspace')));
    assert.ok(manual.notice.length>60);
  }
  assert.match(es.contact,/kzsheez/);
  const groups=Object.values(EDITOR_SHORTCUT_GROUPS).flat();
  assert.equal(groups.length,CONTROL_ACTIONS.length);
  assert.equal(new Set(groups).size,CONTROL_ACTIONS.length);
  assert.deepEqual(new Set(groups),new Set(CONTROL_ACTIONS.map(a=>a.id)));
  assert.ok(groups.every(id=>typeof DEFAULT_CONTROLS.shortcuts[id]==='string'));
  assert.match(source('src/App.tsx'),/controls\.shortcuts\[id\]/);
  assert.match(source('src/App.tsx'),/steamcommunity\.com\/id\/KazamiiSC/);
});
test('HF3: spawn animation uses 30fps update tick and hides during Gameplay Test',()=>{
  assert.match(source('src/components/ModelBrowser.tsx'),/elapsed\.current<1\/30/);
  assert.match(source('src/components/Viewport.tsx'),/!\(walking&&isSpawn\)/);
  assert.match(source('src/components/Viewport.tsx'),/animationSpeed=\{isSpawn\?1\.4:1\}/);
});
test('HF3: Spanish Wireframe label is unchanged from English',()=>{
  const i18n=source('src/i18n.ts');
  assert.doesNotMatch(i18n,/Alámbrico/i);
  assert.match(i18n,/'Wireframe':'Wireframe'/);
});
