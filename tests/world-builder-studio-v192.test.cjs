/* World Builder Studio 1.9.2: regression + read/export geometry tests.
   Run: node --test tests/world-builder-studio-v192.test.cjs */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {createTerrainBrushes,createTerrainPreviewShell,terrainRecord,defaultTerrain,validateTerrainDraft}=require('../src/engine/terrain.ts');
const {generateWorldHeights,applyWorldFeature}=require('../src/engine/worldBuilderTerrain.ts');
const {createPathStructureBrushes,verifyPathMapBrushes}=require('../src/engine/pathStructures.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const {demoProject}=require('../src/store.ts');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const make=(resolution=4)=>({...defaultTerrain(),resolution,width:512,depth:512,optimized:false,heights:generateWorldHeights(resolution,'valley',96,21)});
const toProject=(d,bs)=>({...demoProject(),objects:[...demoProject().objects,...bs],terrainGroups:[terrainRecord(d,bs)]});
test('cell diagonals alter the actual top triangles, not only viewport display',()=>{
 const a=make(),b={...a,diagonalFlips:Array(16).fill(0)};b.diagonalFlips[4]=1;
 const original=createTerrainBrushes(a),flipped=createTerrainBrushes(b);
 assert.equal(flipped.length,original.length);assert.equal(flipped.length,32);
 assert.notDeepEqual(flipped[8].vertices,original[8].vertices);
 assert.deepEqual(validateBrush(flipped[8]),[]);
 const shell=createTerrainPreviewShell(b);
 assert.ok(shell.topPositions.length>0);assert.equal(shell.topPositions.length,16*2*3*3);
 assert.deepEqual(validateTerrainDraft(b),[]);
});
test('both diagonal directions survive actual Valve 220 MAP roundtrip',()=>{
 const d=make(8);d.diagonalFlips=Array.from({length:64},(_,i)=>i%2);
 const brushes=createTerrainBrushes(d);
 for(const brush of brushes)assert.deepEqual(validateBrush(brush),[]);
 const txt=exportMap(toProject(d,brushes));const parsed=inspectMapImport(txt,'advanced-terrain.map');
 assert.equal(parsed.report.skippedBrushes,0);
 assert.equal(parsed.report.importedBrushes>=brushes.length,true);
 const persisted=validateProjectFile(JSON.parse(JSON.stringify(toProject(d,brushes))));
 assert.deepEqual(persisted.terrainGroups[0].diagonalFlips,d.diagonalFlips);
});
test('legacy groups lacking diagonalFlips still preserve their geometry',()=>{
 const d=make();const raw=JSON.stringify(d),bs=createTerrainBrushes(d);
 assert.equal(JSON.stringify(d),raw);
 assert.equal(validateProjectFile(JSON.parse(JSON.stringify(toProject(d,bs)))).terrainGroups[0].diagonalFlips,undefined);
});
test('invalid diagonal metadata is rejected rather than truncating a saved project',()=>{
 const d=make(),bs=createTerrainBrushes(d),p=toProject(d,bs);
 p.terrainGroups[0].diagonalFlips=[1];
 assert.throws(()=>validateProjectFile(JSON.parse(JSON.stringify(p))),/terrain/i);
 assert.match(validateTerrainDraft({...d,diagonalFlips:[0]}).join(' '),/diagonal/i);
});
test('landforms create repeatable, bounded and adjustable heightmaps',()=>{
 for(const mode of ['ridge','riverbed','cliff']){
  const d=make(8),before=JSON.stringify(d);
  const opts={height:64,width:112,seed:9,direction:'x'};
  const result=applyWorldFeature(d,mode,opts);
  assert.equal(JSON.stringify(d),before);assert.equal(result.length,d.heights.length);
  assert.deepEqual(result,applyWorldFeature(d,mode,opts));
  assert.ok(result.some((v,i)=>v!==d.heights[i]));assert.ok(result.every(n=>n>=-512&&n<=512));
  const bs=createTerrainBrushes({...d,heights:result});assert.ok(bs.length>0);
  for(const b of bs)assert.deepEqual(validateBrush(b),[]);
 }
});
test('dangerous landform parameter combinations are rejected',()=>{
 const d=make();for(const width of [NaN,-1,Infinity,100000])assert.throws(()=>applyWorldFeature(d,'ridge',{height:32,width,seed:1,direction:'y'}));
 assert.throws(()=>applyWorldFeature(d,'bad',{height:64,width:128,seed:1,direction:'y'}));
});
test('walkable cave shell comprises closed convex brushes with open cross-section',()=>{
 const opts={kind:'cave',points:[[-160,-80,0],[160,-80,0]],width:160,height:144,wallThickness:12,texture:'SV_BRICK01',smooth:false,subdivisions:2,name:'Test cave'};
 const bs=createPathStructureBrushes(opts);
 assert.equal(bs.length,8);for(const b of bs)assert.deepEqual(validateBrush(b),[]);
 verifyPathMapBrushes(bs);
 const groupNames=new Set(bs.map(b=>b.group));assert.deepEqual([...groupNames],['Test cave']);
});
test('cave route gracefully rejects a wall thicker than its navigable opening',()=>{
 const opts={kind:'cave',points:[[0,0,0],[180,0,0]],width:48,height:48,wallThickness:20,texture:'SV_BRICK01',smooth:false};
 assert.throws(()=>createPathStructureBrushes(opts),/too (large|narrow)|interior/i);
});
test('existing vent, pipe, road and rail modes remain available',()=>{
 const src=read('src/engine/pathStructures.ts');
 for(const kind of ['road','walkway','vent','pipe','cable','rail','fence','bridge'])assert.ok(src.includes(`'${kind}'`));
});
test('studio has focus layout, camera presets, large controls and localized title',()=>{
 const src=read('src/components/TerrainShapeStudio.tsx'),css=read('src/style.css'),app=read('src/App.tsx'),i18n=read('src/i18n.ts');
 for(const str of ['World Builder Studio','wb-terrain-focus','TerrainVertexHandles','toggleDiagonal','TerrainCameraRig','wb-floating-tools','Focus 3D workspace'])assert.ok(src.includes(str),str);
 for(const str of ['wb-viewport-overlay','wb-floating-tools','wb-terrain-focus','min-height:43px'])assert.ok(css.includes(str),str);
 assert.match(app,/t\('World Builder Studio'\)/);
 for(const language of ['es','ru','ko','zh','pt'])assert.match(i18n,new RegExp(`Object\\.assign\\(${language},\\{[^\\n]+World Builder Studio`));
});
