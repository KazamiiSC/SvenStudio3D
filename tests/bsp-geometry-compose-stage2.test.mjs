import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
const {composeRecoveredBspGeometry}=require('../src/engine/bspGeometryCompose.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const fixture=readFileSync(new URL('../examples/gameplay_button_relay_door.map',import.meta.url),'utf8');

test('combines all recoverable geometry and preserves brush entities',()=>{
  const one=inspectMapImport(fixture,'fixture.map');
  assert.equal(one.report.skippedBrushes,0);
  const result=composeRecoveredBspGeometry(fixture,fixture,[1024,512,0],'copy_','both');
  const merged=inspectMapImport(result.source,'both.map');
  assert.equal(result.report.brushes,one.report.totalBrushes*2);
  assert.equal(merged.report.skippedBrushes,0);
  assert.equal(merged.project.objects.filter(o=>o.kind==='entity').length,one.project.objects.filter(o=>o.kind==='entity').length*2);
  const first=one.project.objects.find(o=>o.kind==='brush');
  assert.ok(merged.project.objects.some(o=>o.kind==='brush'&&Math.abs(o.position[0]-(first.position[0]+1024))<.5));
  assert.ok(result.source.includes('"classname" "worldspawn"'));
});
test('rejects corrupt or incomplete geometry and bad offsets',()=>{
  assert.throws(()=>composeRecoveredBspGeometry(fixture,fixture,[Infinity,0,0],'x_'),/coordinates/);
  assert.throws(()=>composeRecoveredBspGeometry(fixture,fixture,[0,0,0],'bad-prefix!'),/Prefix/);
  assert.throws(()=>composeRecoveredBspGeometry(fixture,'bad map',[0,0,0],'x_'),/No entities|Incomplete|Unbalanced/);
});
