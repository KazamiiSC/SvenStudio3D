import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveVisualizationMode,shouldBuildLightingPreview} from '../src/engine/viewportVisualization.ts';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('normal, quick, and compiled modes resolve correctly',()=>{
  assert.equal(resolveVisualizationMode(false,false),'normal');
  assert.equal(resolveVisualizationMode(false,true),'quick');
  assert.equal(resolveVisualizationMode(true,false),'baked');
  assert.equal(resolveVisualizationMode(true,true),'baked');
});
test('reopening a cached bake never recompiles and concurrent jobs are blocked',()=>{
  assert.equal(shouldBuildLightingPreview(true,false,false),false);
  assert.equal(shouldBuildLightingPreview(false,true,false),false);
  assert.equal(shouldBuildLightingPreview(false,false,true),false);
  assert.equal(shouldBuildLightingPreview(false,false,false),true);
});
test('True Lighting moves to Studios; Visualization keeps only normal and quick modes',()=>{
  const app=read('src/App.tsx'),viewport=read('src/components/Viewport.tsx');
  assert.doesNotMatch(app,/className="top-compile true-light-launch"/);
  assert.match(viewport,/viewport-visualization-trigger/);
  for(const mode of ['normal','quick'])assert.match(viewport,new RegExp("id:'"+mode+"'"));
  assert.doesNotMatch(viewport,/id:'baked',Icon:/);
  assert.match(app,/setTruePreviewOpen\(true\);setTruePreviewLayout\('split'\);setStudiosMenu\(false\)/);
  assert.doesNotMatch(app,/setDialog\('buildTogether'\);setStudiosMenu\(false\)/);
  assert.match(app,/onVisualizationMode=\{chooseVisualization\}/);
  assert.match(app,/chooseVisualization=\(mode:/);
});
test('full lighting fills MAP workspace, and BSP Viewer remains accessible',()=>{
  const app=read('src/App.tsx'),preview=read('src/components/TrueLightingPreview.tsx'),css=read('src/style.css');
  assert.match(app,/truePreviewLayout/);
  assert.match(app,/true-light-full/);
  assert.match(preview,/onToggleLayout/);
  assert.match(preview,/onOpenBsp/);
  assert.match(css,/true-light-workbench\.true-light-full \.true-light-map\{display:none\}/);
});
test('lighting controls are in a collapsible settings menu, status remains in toolbar footer',()=>{
  const preview=read('src/components/TrueLightingPreview.tsx');
  assert.match(preview,/settingsOpen&&<div className="true-light-settings"/);
  assert.match(preview,/true-light-footer/);
  assert.match(preview,/Lightmap filtering/);
  assert.match(preview,/BSP env_fog/);
  assert.match(preview,/compilerLabel} RGB/);
  assert.match(preview,/true-light-camera-presets/);
});
test('MAP exporter and SC-RAD engine are untouched by the UI work',()=>{
  const app=read('src/App.tsx');
  assert.match(app,/exportMap\(project,wadPaths\)/);
  assert.match(app,/previewOnly:mode==='preview'/);
  assert.match(app,/setTruePreviewSnapshot\(project\)/);
});
