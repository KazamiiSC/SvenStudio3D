import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
const {safeTextureAlignment,textureBasisQuality}=require('../src/engine/textureAxisSafety.ts');
const {texelAt}=require('../src/engine/valve220UV.ts');
const {composeRecoveredBspGeometry}=require('../src/engine/bspGeometryCompose.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const fixture=readFileSync(new URL('../examples/gameplay_button_relay_door.map',import.meta.url),'utf8');

test('repairs recovered texinfo axes that were accepted at 0.20 but rejected at 0.50',()=>{
  // Both axes project onto the face, but they are near parallel and carry
  // large components into the normal; the old postcondition threw here.
  const normal=[0,0,1],anchor=[320,48,16],u=[1,0,2],v=[.95,.32,2];
  const shiftU=23.25,shiftV=-104.5,scaleU=.75,scaleV=-.5;
  const result=safeTextureAlignment(normal,anchor,u,v,shiftU,shiftV,scaleU,scaleV);
  assert.equal(result.repaired,true);
  assert.ok(textureBasisQuality(normal,result.u,result.v)>.65);
  for(const [before,after,shiftBefore,shiftAfter,scale] of [
    [u,result.u,shiftU,result.uShift,scaleU],
    [v,result.v,shiftV,result.vShift,scaleV]
  ])assert.ok(Math.abs(texelAt(anchor,before,scale,shiftBefore)-texelAt(anchor,after,scale,shiftAfter))<1e-8);
  assert.deepEqual(u,[1,0,2]);assert.deepEqual(v,[.95,.32,2]);
});

test('recovered BSP MAP with skewed axes still combines without losing a valid brush',()=>{
  const corruptedUv=fixture.replace(
    'SV_TILE01 [ 1 0 0 0 ] [ 0 -1 0 0 ]',
    'SV_TILE01 [ 1 0 2 0 ] [ 0.95 0.32 2 0 ]'
  );
  assert.notEqual(corruptedUv,fixture);
  assert.equal(inspectMapImport(corruptedUv).report.skippedBrushes,0);
  const output=composeRecoveredBspGeometry(corruptedUv,fixture,[2048,0,0],'uv_');
  assert.equal(output.report.lostBrushes,0);
  assert.equal(output.report.combined.skippedBrushes,0);
  assert.equal(output.report.brushes,inspectMapImport(fixture).report.totalBrushes*2);
});

test('degenerate faces remain rejected: UV repair never manufactures geometry',()=>{
  assert.throws(()=>safeTextureAlignment([0,0,0],[0,0,0],[1,0,0],[0,1,0]),/degenerate/);
});

// The real BSP Recovery workflow can have two independent problems at once:
// one genuinely unreconstructable solid, plus damaged texture axes on a valid
// solid. Confirming a partial MAP must not abort again for the unrelated UV.
test('explicitly confirmed partial recovery survives damaged UV axes on a remaining solid',()=>{
  const withSkew=fixture.replace(
    'SV_TILE01 [ 1 0 0 0 ] [ 0 -1 0 0 ]',
    'SV_TILE01 [ 1 0 2 0 ] [ 0.95 0.32 2 0 ]'
  );
  const partialInput=withSkew.replace(/^\{\s*\n/m, `{\n{\n( 0 0 0 ) ( 1 1 1 ) ( 2 2 2 ) NULL 0 0 0 1 1\n}\n`);
  assert.equal(inspectMapImport(partialInput).report.skippedBrushes,1);
  assert.throws(()=>composeRecoveredBspGeometry(partialInput,fixture,[2048,0,0],'uv_'),/blocked/);
  const output=composeRecoveredBspGeometry(partialInput,fixture,[2048,0,0],'uv_','partial',{allowPartial:true});
  assert.equal(output.report.lostBrushes,1);
  assert.equal(output.report.combined.skippedBrushes,0);
  assert.equal(output.report.brushes,inspectMapImport(fixture).report.totalBrushes*2);
});
