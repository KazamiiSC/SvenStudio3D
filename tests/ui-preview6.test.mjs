import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const read=async file=>readFile(new URL('../'+file,import.meta.url),'utf8');

test('Preview 6 modified React/TypeScript modules parse successfully',async()=>{
  const files=['src/App.tsx','src/components/Viewport.tsx','src/components/MapPerformanceMonitor.tsx','src/components/MapEntityLabelOverlay.tsx','src/components/HudWidget.tsx','src/components/DockWorkspace.tsx','src/components/EntityAppearanceModal.tsx','src/hudLayout.ts','src/layout.ts','src/i18n.ts'];
  for(const path of files){
    const input=await read(path);
    const parsed=ts.transpileModule(input,{fileName:path,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
    assert.deepEqual(parsed.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).map(d=>ts.flattenDiagnosticMessageText(d.messageText,' ')),[],path);
  }
});

test('FPS monitor has only FPS display, updates no React or editor store',async()=>{
  const src=await read('src/components/MapPerformanceMonitor.tsx');
  assert.match(src,/node\.textContent=`\$\{fps\} FPS`/);
  assert.match(src,/v\.frames\/Math\.max\(\.01,elapsed\)/);
  assert.match(src,/return\(\)=>\{node\.remove\(\)/);
  assert.doesNotMatch(src,/Draw calls|Triangles|Label candidates|Rendered labels|\.setState\(|useEditor\.setState/);
});

test('FPS uses a movable HUD slot without covering mouse help',async()=>{
  const hud=await read('src/hudLayout.ts');
  const widget=await read('src/components/HudWidget.tsx');
  const viewport=await read('src/components/Viewport.tsx');
  const css=await read('src/style.css');
  assert.match(hud,/'fps'\] as const/);
  assert.match(hud,/fps:item\(90,15/);
  assert.match(widget,/fps:'FPS'/);
  assert.match(viewport,/<HudWidget id="fps">/);
  assert.match(viewport,/data-map-fps-mount/);
  assert.match(css,/\.hud-fps \.map-performance-monitor\{position:static!important/);
  assert.match(css,/\.hud-fps .hud-widget-content\{pointer-events:none\}/);
});

test('No separate on-screen label diagnostic counter remains',async()=>{
  const overlay=await read('src/components/MapEntityLabelOverlay.tsx');
  assert.doesNotMatch(overlay,/createElement\('div'\);stats\.className='map-label-stats'/);
  assert.match(overlay,/layoutMapLabels\(/);
});

test('Workspace secondary actions are grouped and all settings remain reachable',async()=>{
  const app=await read('src/App.tsx');
  for(const dialog of ['layout','visibility','entityAppearance','controls','output']){
    assert.match(app,new RegExp(`setDialog\\('${dialog}'\\);setWorkspaceMenu\\(false\\)`));
  }
  const workspaceSection=app.split('id="sven-workspace-menu"')[1].split('</TopDropdown></div>')[0];
  assert.doesNotMatch(workspaceSection,/t\('Build configuration'\)/);
  assert.match(app,/className="top-build-settings"/);
  assert.match(app,/svenstudio:toggle-gameplay-settings/);
  assert.match(app,/setDialog\('packager'\)/);
  assert.match(app,/saveProject\(project\)/);
  assert.match(app,/onClick=\{compile\}/);
  assert.match(app,/toolbarGroupProps\('geometry'\)/);
  assert.match(app,/\<BspViewer map=\{bspMap\}/);
});

test('Organized preset retains all panels and both toolbar presentations',async()=>{
  const layout=await read('src/layout.ts');
  const docking=await read('src/components/DockWorkspace.tsx');
  assert.match(layout,/if\(preset==='organized'\)/);
  assert.match(layout,/assets:true,explorer:true,properties:true,console:false/);
  assert.match(docking,/'organized','creative','classic','focus','wide','minimal'/);
  assert.match(docking,/setCompactTools\(true\)/);
  assert.match(docking,/setCompactTools\(false\)/);
});
