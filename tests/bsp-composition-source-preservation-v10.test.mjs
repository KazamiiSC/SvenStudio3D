import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
const {composeRecoveredBspGeometry}=require('../src/engine/bspGeometryCompose.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const fixture=readFileSync(new URL('../examples/gameplay_button_relay_door.map',import.meta.url),'utf8');
const firstPlane='( -272 -272 -32 ) ( 272 272 -32 ) ( -272 272 -32 ) SV_TILE01 [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1';

test('preserves the primary source plane and texture basis without a mesh re-export',()=>{
  const weirdPlane=firstPlane.replace('SV_TILE01 [ 1 0 0 0 ] [ 0 -1 0 0 ]', 'SV_TILE01 [ 1 0.05 0 0.13284 ] [ 0 -1 0 -7.03421 ]');
  const primary=fixture.replace(firstPlane,weirdPlane);
  const composed=composeRecoveredBspGeometry(primary,fixture,[1024,0,0],'dup_');
  assert.ok(composed.source.includes(weirdPlane),'the recovered plane must retain its original precision');
  assert.equal(composed.report.combined.skippedBrushes,0);
  assert.equal(composed.report.brushes,inspectMapImport(fixture).report.totalBrushes*2);
});

test('moves the source solids and offsets Valve 220 UV shifts to preserve visual alignment',()=>{
  const combined=composeRecoveredBspGeometry(fixture,fixture,[128,256,0],'copy_');
  assert.match(combined.source,/\( -144 -16 -32 \) \( 400 528 -32 \) \( -144 528 -32 \) SV_TILE01 \[ 1 0 0 -128 \] \[ 0 -1 0 256 \]/);
  assert.match(combined.source,/"targetname" "copy_door_01"/);
  assert.match(combined.source,/"targetname" "door_01"/);
  assert.equal(combined.report.combined.skippedBrushes,0);
});

test('partial recovered source omits precisely the invalid brush, without silently dropping any other',()=>{
  const invalid=fixture.replace(/^\{\s*\n/m, `\{\n\{\n( 0 0 0 ) ( 1 1 1 ) ( 2 2 2 ) NULL 0 0 0 1 1\n\}\n`);
  const base=inspectMapImport(invalid);
  assert.equal(base.report.skippedBrushes,1);
  const composed=composeRecoveredBspGeometry(invalid,fixture,[0,0,0],'p_','partial',{allowPartial:true});
  assert.equal(composed.report.lostBrushes,1);
  assert.equal(composed.report.brushes,inspectMapImport(fixture).report.totalBrushes*2);
  assert.equal(composed.report.combined.skippedBrushes,0);
  assert.ok(!composed.source.includes('( 0 0 0 ) ( 1 1 1 ) ( 2 2 2 ) NULL'));
});

test('a larger recovered map validates all kept source plane blocks',()=>{
  const brush=fixture.match(/\{\n\( -272 -272 -32 \)[\s\S]*?\n\}/)?.[0];
  assert.ok(brush);
  const enhanced=fixture.replace('"wad" "svstudio.wad;"', '"wad" "svstudio.wad;"\n'+Array.from({length:70},()=>brush).join('\n'));
  const start=inspectMapImport(enhanced);
  assert.equal(start.report.skippedBrushes,0);
  const combined=composeRecoveredBspGeometry(enhanced,fixture,[2048,0,0],'many_');
  assert.equal(combined.report.brushes,start.report.totalBrushes+inspectMapImport(fixture).report.totalBrushes);
  assert.equal(combined.report.combined.skippedBrushes,0);
});
