import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=async file=>readFile(new URL('../'+file,import.meta.url),'utf8');

test('MAP FPS stays visible on default HUD independently of entity labels and projects',async()=>{
  const viewport=await source('src/components/Viewport.tsx');
  const hud=await source('src/hudLayout.ts');
  const labels=await source('src/engine/mapEntityLabels.ts');
  assert.match(hud,/fps:item\(90,15,\.9\)/);
  assert.match(viewport,/!walkMode&&fpsHudVisible&&<MapPerformanceMonitor\/>/);
  assert.match(viewport,/!walkMode&&<HudWidget id="fps"><div className="map-fps-mount" data-map-fps-mount\/><\/HudWidget>/);
  assert.doesNotMatch(viewport,/mapFpsEnabled|fpsHudVisible&&mapLabelSettings\.diagnostics/);
  assert.match(labels,/diagnostics:false/); // Must not hide FPS after CLEAN or new project.
});

test('Appearance checkbox and Edit HUD control the same persisted FPS visibility',async()=>{
  // v2.4: the FPS switch lives in Preferences > 3D viewport & performance.
  const modal=await source('src/components/DockWorkspace.tsx');
  const hud=await source('src/hudLayout.ts');
  assert.match(modal,/const fps=useHudLayout\(s=>s\.items\.fps\.visible\)/);
  assert.match(modal,/checked=\{fps\} onChange=\{e=>updateHud\('fps',\{visible:e\.target\.checked\}\)\}/);
  assert.doesNotMatch(modal,/checked=\{mapLabels\.diagnostics\}/);
  assert.match(hud,/partialize:s=>\(\{items:s\.items,globalOpacity:s\.globalOpacity,preset:s\.preset,layoutVersion:s\.layoutVersion\}\)/);
  assert.match(hud,/resetItem:id=>set/);
});

test('FPS renderer measures frames and releases its badge without rebuilding the scene',async()=>{
  const counter=await source('src/components/MapPerformanceMonitor.tsx');
  const css=await source('src/style.css');
  assert.match(counter,/useFrame\(\(\{clock\}\)=>/);
  assert.match(counter,/nodes\.badge\.textContent=`\$\{fps\} FPS`/);
  assert.match(counter,/return\(\)=>\{[\s\S]*badge\.remove\(\);panel\.remove\(\)/);
  assert.match(css,/\.hud-fps \.map-fps-mount:empty::before\{content:"— FPS"/);
  assert.doesNotMatch(counter,/useEditor\.setState|setState\(/);
});
