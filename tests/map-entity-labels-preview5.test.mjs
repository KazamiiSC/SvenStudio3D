import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const read=async path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const source=await read('src/engine/mapEntityLabels.ts');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022},reportDiagnostics:true});
assert.equal(output.diagnostics?.length,0);
const {DEFAULT_MAP_LABEL_SETTINGS,normalizeMapLabelSettings,mapLabelRefreshDue}=await import('data:text/javascript;base64,'+Buffer.from(output.outputText).toString('base64'));
test('Preview 5 lightweight setting defaults on and preserves legacy saved settings',()=>{
 assert.equal(DEFAULT_MAP_LABEL_SETTINGS.lightweight,true);
 assert.equal(normalizeMapLabelSettings({mode:'classic'}).lightweight,true);
 assert.equal(normalizeMapLabelSettings({lightweight:false}).lightweight,false);
});
test('Preview 5 does not poll static cameras or static labels',()=>{
 for(const last of [0,.05,.5,1,20])assert.equal(mapLabelRefreshDue(false,false,false,last,true,695),false);
});
test('Preview 5 dirty config/selection always schedules immediate refresh',()=>{
 assert.equal(mapLabelRefreshDue(true,false,false,0,true,695),true);
 assert.equal(mapLabelRefreshDue(false,true,false,.01,false,695),true);
 assert.equal(mapLabelRefreshDue(false,false,true,.01,false,695),true);
});
test('Preview 5 caps moving label layouts at 18Hz for large maps',()=>{
 assert.equal(mapLabelRefreshDue(false,true,false,.025,true,695),false);
 assert.equal(mapLabelRefreshDue(false,true,false,.056,true,695),true);
 assert.equal(mapLabelRefreshDue(false,true,false,.034,true,20),true);
});
test('Viewport diagnostics works with labels off and with Classic mode',async()=>{
 const viewport=await read('src/components/Viewport.tsx');
 const modal=await read('src/components/EntityAppearanceModal.tsx');
 assert.match(viewport,/mapLabelSettings\.diagnostics&&<MapPerformanceMonitor/);
 assert.match(viewport,/labelsEnabled=\{showEntityNames\} mode=\{mapLabelSettings\.mode\}/);
 assert.match(modal,/mapLabels\.lightweight/);
 const overlay=await read('src/components/MapEntityLabelOverlay.tsx');
 assert.match(overlay,/mapLabelRefreshDue\(/);
 assert.match(overlay,/node\.style\.boxShadow=config\.lightweight\?'none'/);
 assert.doesNotMatch(overlay,/since<\.2/);
});
test('FPS overlay unsubscribes from DOM when hidden and never updates the editor store',async()=>{
 const monitor=await read('src/components/MapPerformanceMonitor.tsx');
 assert.match(monitor,/return\(\)=>\{node\.remove\(\)/);
 assert.match(monitor,/v\.frames\/Math\.max\(\.01,elapsed\)/);
 assert.doesNotMatch(monitor,/setState\(|useEditor\.setState/);
});
test('Sven Co-op export / BSP Viewer remain separate from MAP diagnostics',async()=>{
 const monitor=await read('src/components/MapPerformanceMonitor.tsx');
 assert.doesNotMatch(monitor,/exportMap|writeFile|spawn\(/);
});
