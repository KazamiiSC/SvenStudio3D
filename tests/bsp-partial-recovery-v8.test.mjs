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
// Add a syntactically valid brush block with a degenerate plane to the first worldspawn.
const broken=fixture.replace(/^\{\s*\n/m, `\{\n\{\n( 0 0 0 ) ( 1 1 1 ) ( 2 2 2 ) NULL 0 0 0 1 1\n\}\n`);
test('reports the exact location and reconstruction failure of an invalid solid',()=>{
 const report=inspectMapImport(broken).report;
 assert.equal(report.skippedBrushes,1);
 assert.equal(report.skippedDetails?.length,1);
 assert.equal(report.skippedDetails?.[0].entity,1);
 assert.match(report.skippedDetails?.[0].reason??'',/face syntax/);
});
test('requires explicit opt-in before combining recovered MAPs with missing solids',()=>{
 assert.throws(()=>composeRecoveredBspGeometry(broken,fixture,[1000,0,0],'copy_'),/blocked/);
 const partial=composeRecoveredBspGeometry(broken,fixture,[1000,0,0],'copy_','partial',{allowPartial:true});
 assert.equal(partial.report.partial,true);
 assert.equal(partial.report.lostBrushes,1);
 assert.equal(inspectMapImport(partial.source).report.skippedBrushes,0);
 assert.equal(partial.report.brushes,inspectMapImport(fixture).report.totalBrushes*2);
});
