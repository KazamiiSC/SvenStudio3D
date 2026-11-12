import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const component=read('src/components/BspRecoveryStudio.tsx');
const locale=read('src/i18n.ts');
const style=read('src/style.css');
const server=read('server/index.js');
const project=JSON.parse(read('package.json'));
test('migration stays on the true v1.9 base and preserves existing controls',()=>{
 assert.equal(project.version,'1.9.0');
 assert.match(read('src/components/ExplorerOrganized.tsx'),/EMPTY_BRUSH_COMPOSITES/);
 assert.match(component,/nativeChanged\(doc\)/);
 assert.match(component,/writeNativeBsp/);
 assert.match(component,/recoveryTab==='entities'/);
 assert.match(component,/recoveryTab==='compose'/);
 assert.match(component,/recoveryTab==='convert'/);
});
test('composition is loss-aware and keeps independent recovery operations',()=>{
 assert.match(component,/setPartialConfirmed\(false\)/);
 assert.match(component,/allowPartial:true/);
 assert.match(component,/Download recovery diagnostic/);
 assert.match(component,/geometryAbort\.current\?\.abort\('cancel'\)/);
 assert.match(component,/composeRecoveredBspGeometry/);
 assert.match(server,/signal:job\.signal/);
 assert.match(read('server/surfDecompile.js'),/shell:false,signal/);
});
test('large map performance only selects the existing editor preview preset',()=>{
 assert.match(component,/geometryResult\.report\.brushes>=2500/);
 assert.match(component,/layout\.setPerformancePreset\('large'\)/);
 assert.match(component,/setPerformancePreset\(previousPreset\)/);
 assert.match(style,/\.bsp-compose-performance/);
 assert.match(component,/openingCombined/);
});
test('all six languages have composition headings and new performance help',()=>{
 for(const lang of ['es','en','ru','ko','zh','pt']){
  assert.match(locale,new RegExp('Object\\.assign\\('+lang+',\\{[\\s\\S]*?Use Large maps preview mode when opening a large composition'));
 }
 assert.match(style,/\.bsp-recovery-tabs/);
 assert.match(style,/\.bsp-recovery-tools-scroll/);
});
