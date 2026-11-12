import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {restoreVisibleBspTextures}=require('../src/engine/bspSurfaceTextureRestore.ts');
const {transformedVertices}=require('../src/engine/geometry.ts');
const base=fs.readFileSync(new URL('../examples/starter_room.map',import.meta.url),'utf8');
const makeNull=(s)=>s.replace(/^(\s*\(\s*[-\d.]+\s+[-\d.]+\s+[-\d.]+\s*\)\s*\(\s*[-\d.]+\s+[-\d.]+\s+[-\d.]+\s*\)\s*\(\s*[-\d.]+\s+[-\d.]+\s+[-\d.]+\s*\))\s+(\S+)/m,'$1 NULL');
const input=makeNull(base);
const inspected=inspectMapImport(input);
assert.equal(inspected.report.skippedBrushes,0);
const brush=inspected.importedBrushes[0].brush;
const poly=brush.faces[0].indices.map(i=>transformedVertices(brush)[i]);
const face=(points=poly,texture=0)=>({points,texture,flags:0,model:0,normal:[0,0,1],texels:[],lightWidth:0,lightHeight:0,lightMin:[0,0],sTexinfo:[.5,0,0,3],tTexinfo:[0,.5,0,7]});
const bsp=(faces,textures=['BRICK_A'])=>({faces,textures:textures.map(name=>({name,width:128,height:128,external:true})),name:'example.bsp'});
test('restores only the matching NULL face and its compiled texture axes',()=>{
  const out=restoreVisibleBspTextures(input,bsp([face()]),inspected);
  assert.equal(out.report.restoredFaces,1);
  assert.match(out.source,/BRICK_A \[ 0\.5 0 0 3 \] \[ 0 0\.5 0 7 \] 0 1 1/);
  assert.ok(out.report.unmatchedFaces>=0);
});
test('never changes already textured MAP faces',()=>{
  const out=restoreVisibleBspTextures(base,bsp([face()]),inspectMapImport(base));
  assert.equal(out.report.restoredFaces,0);assert.equal(out.source,base);
});
test('does not falsely paint coplanar but non-overlapping faces',()=>{
  const shifted=poly.map(p=>[p[0]+3000,p[1]+3000,p[2]]);
  const out=restoreVisibleBspTextures(input,bsp([face(shifted)]),inspected);
  assert.equal(out.report.restoredFaces,0);assert.equal(out.source,input);
});
test('ambiguous overlapping materials are preserved as NULL',()=>{
  const out=restoreVisibleBspTextures(input,bsp([face(poly,0),face(poly,1)],['BRICK_A','BRICK_B']),inspected);
  assert.equal(out.report.restoredFaces,0);assert.ok(out.report.ambiguousFaces>=1);
});
