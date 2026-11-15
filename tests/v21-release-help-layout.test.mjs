import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {helpV21} from '../src/engine/helpV21.ts';
import {useStudioLayout} from '../src/layout.ts';
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('v2.1 is reflected in the package, Windows launcher and visible UI',()=>{
 const pkg=JSON.parse(read('package.json'));
 const lock=JSON.parse(read('package-lock.json'));
 assert.equal(pkg.version,'2.1.0');
 assert.equal(lock.version,'2.1.0');
 assert.equal(lock.packages[''].version,'2.1.0');
 for(const [path,signature] of [
  ['SvenStudio3D.bat','SvenStudio 3D v2.1'],
  ['src/App.tsx','className="version-label">v2.1'],
  ['src/components/SmartBuildSettingsModal.tsx','v2.1 · Smart Build 3.0'],
  ['index.html','SvenStudio 3D v2.1']]){
  assert.ok(read(path).includes(signature),`${path}: missing ${signature}`);
 }
});

test('the six language help chapters describe actual cumulative tools and safety rules',()=>{
 for(const locale of ['es','en','ru','ko','zh','pt']){
  const guide=helpV21(locale);
  assert.ok(guide.title.includes('v2.1'),locale);
  assert.equal(guide.cards.length,6,locale);
  assert.ok(guide.cards.every(card=>card.title&&card.description.length>100),locale);
  const text=guide.intro+' '+guide.cards.map(c=>c.title+' '+c.description).join(' ');
  for(const keyword of ['Smart Connect','BSP','Ctrl+Z','CLEAN','BuildTogether','GoldSrc']){
   assert.ok(text.includes(keyword),`${locale}: ${keyword} undocumented`);
  }
 }
});

test('Help navigation and output safety rules stay connected to the UI',()=>{
 const app=read('src/App.tsx');
 assert.ok(app.includes('id="manual-v21"'));
 assert.ok(app.includes("['v21',v21Help.title]"));
 assert.ok(app.includes('event.preventDefault();document.getElementById(`manual-${id}`)'));
 assert.ok(!app.includes('Playtest · Sven Co-op'));
 assert.ok(read('src/engine/releaseHelpV2.ts').includes('v2.1'));
});

test('Creative workspace preset is distinct, but preserves user preferences',()=>{
 const before=useStudioLayout.getState();
 const backup={...before};
 try{
  before.setScale(1.1);
  before.setFontScale(1.15);
  before.setPerformancePreset('large');
  before.usePreset('creative');
  const creative=useStudioLayout.getState();
  assert.deepEqual(creative.widths,{left:286,right:294});
  assert.equal(creative.visible.explorer,false);
  assert.equal(creative.toolbarGroups[0],'geometry');
  assert.equal(creative.uiScale,1.1);
  assert.equal(creative.fontScale,1.15);
  assert.equal(creative.performancePreset,'large');
  before.usePreset('classic');
  assert.notDeepEqual(useStudioLayout.getState().widths,creative.widths);
 }finally{
  useStudioLayout.setState(backup,true);
 }
});
