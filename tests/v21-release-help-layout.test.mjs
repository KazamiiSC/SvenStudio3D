import {withSplitParts} from './support/splitParts.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {helpV21} from '../src/engine/helpV21.ts';
import {useStudioLayout} from '../src/layout.ts';
const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('the current version is reflected in the package, Windows launcher and visible UI',()=>{
 const pkg=JSON.parse(read('package.json'));
 const lock=JSON.parse(read('package-lock.json'));
 const label=`v${pkg.version.split('.').slice(0,2).join('.')}`;
 assert.equal(lock.version,pkg.version);
 assert.equal(lock.packages[''].version,pkg.version);
 for(const [path,signature] of [
  ['SvenStudio3D.bat',`SvenStudio 3D ${label}`],
  ['src/App.tsx',`className="version-label">${label}`],
  ['index.html',`SvenStudio 3D ${label}`]]){
  assert.ok(read(path).includes(signature),`${path}: missing ${signature}`);
 }
});

test('the six language help chapters describe actual cumulative tools and safety rules',()=>{
 for(const locale of ['es','en','ru','ko','zh','pt']){
  const guide=helpV21(locale);
  assert.ok(/v2\.[1-9]/.test(guide.title),locale); // the cumulative v2.x chapter keeps the latest version in its title
  assert.equal(guide.cards.length,6,locale);
  assert.ok(guide.cards.every(card=>card.title&&card.description.length>100),locale);
  const text=guide.intro+' '+guide.cards.map(c=>c.title+' '+c.description).join(' ');
  for(const keyword of ['Smart Connect','BSP','Ctrl+Z','CLEAN','BuildTogether','GoldSrc']){
   assert.ok(text.includes(keyword),`${locale}: ${keyword} undocumented`);
  }
 }
});

test('Help navigation and output safety rules stay connected to the UI',()=>{
 const app=withSplitParts(read('src/App.tsx'),'App');
 assert.ok(app.includes('id="manual-v21"'));
 assert.ok(app.includes("['v21',v21Help.title]"));
 assert.ok(app.includes('event.preventDefault();document.getElementById(`manual-${id}`)'));
 assert.ok(!app.includes('Playtest · Sven Co-op'));
 assert.ok(/v2\.\d/.test(read('src/engine/releaseHelpV2.ts')));
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
