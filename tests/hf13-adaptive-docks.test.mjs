import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const component=readFileSync(new URL('../src/components/DockWorkspace.tsx',import.meta.url),'utf8');
const asset=readFileSync(new URL('../src/components/Panels.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
const adaptive=css.slice(css.indexOf('/* v1.4.0 HF13 — adaptive horizontal docks.'));
test('every movable pane is tagged with its active docking side',()=>{
  assert.match(component,/data-dock-side=\{side\}/);
  assert.match(component,/move\(id,dest\)/);
});
test('library grid responds to its container width rather than viewport width',()=>{
  assert.match(css,/\.dock-pane\{container-type:inline-size\}/);
  assert.match(adaptive,/@container \(min-width: 620px\)/);
  for(const side of ['top','bottom'])assert.ok(adaptive.includes(`data-dock-side="${side}"`));
  assert.match(asset,/data-resource=\{resource\}/);
});
test('wide texture browser has bounded thumbnails and a scrollable results row',()=>{
  assert.match(adaptive,/\.texture-results \.texture-grid\{\s*grid-template-columns:repeat\(auto-fill,minmax\(104px,140px\)\)/);
  assert.match(adaptive,/grid-row:3;min-height:0;min-width:0;\s*overflow-y:auto/);
  assert.match(adaptive,/height:64px;max-height:64px;object-fit:contain/);
});
test('entity search, FGD import and category filtering remain exposed',()=>{
  assert.match(adaptive,/\.asset-panel>\.search-field/);
  assert.match(adaptive,/\.asset-panel>\.import-area/);
  assert.match(adaptive,/\.asset-panel>\.entity-category-row/);
  assert.match(adaptive,/\.asset-panel>\.entity-list/);
});
test('sound, model and layer browsing have allocated horizontal content regions',()=>{
  for(const name of ['.model-browser','.sound-browser','.assets-scroll:not(.entity-list)'])assert.ok(adaptive.includes(name));
  assert.match(adaptive,/\.sound-file-scroll\{\s*grid-column:2 \/ -1;grid-row:2/);
});
test('wide properties distribute fields but keep the scrolling body',()=>{
  assert.match(adaptive,/\.property-scroll\{\s*display:grid;grid-template-columns:repeat\(auto-fit,minmax\(240px,1fr\)\)/);
  assert.match(adaptive,/overflow-y:auto;overflow-x:hidden;min-height:0/);
  assert.match(adaptive,/grid-column:1 \/ -1;min-width:0/);
});
test('narrow side docks still use the existing vertical layout',()=>{
  assert.ok(adaptive.trim().endsWith('}'));
  assert.match(css,/\.texture-results \.texture-grid\{overflow:visible;min-height:0;flex:initial;display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}/);
  assert.match(css,/\.properties\{display:flex;flex:1;min-height:0;flex-direction:column\}/);
});
