/* World Builder v1.9 regression tests: pure operations and real MAP geometry. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {defaultTerrain,validateTerrainDraft,createTerrainBrushes,terrainBrushCount,terrainRecord}=require('../src/engine/terrain.ts');
const {generateWorldHeights,heightsFromRgba,transformWorldHeights,sampleTerrainHeight,worldTerrainStats}=require('../src/engine/worldBuilderTerrain.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const {demoProject}=require('../src/store.ts');
const all=['flat','hills','mountains','valley','canyon','island','crater','dunes','plateau'];
for(const preset of all)test(`preset ${preset} is deterministic and produces valid exported GoldSrc geometry`,()=>{
 const d={...defaultTerrain(),width:512,depth:512,resolution:8,optimized:true,heights:generateWorldHeights(8,preset,160,2026)};
 assert.deepEqual(d.heights,generateWorldHeights(8,preset,160,2026));
 assert.equal(d.heights.length,81);assert.deepEqual(validateTerrainDraft(d),[]);
 const solids=createTerrainBrushes(d);assert.equal(solids.length,terrainBrushCount(d));
 for(const b of solids)assert.deepEqual(validateBrush(b),[]);
 const project={...demoProject(),objects:[...demoProject().objects,...solids],terrainGroups:[terrainRecord(d,solids)]};
 assert.equal(validateProjectFile(JSON.parse(JSON.stringify(project))).terrainGroups.length,1);
 const map=exportMap(project);assert.ok(map.includes(d.texture));
 const parsed=inspectMapImport(map,'world-test.map');assert.equal(parsed.report.skippedBrushes,0);
});
test('all presets stay within safe elevation constraints at maximum size and amplitude',()=>{
 for(const preset of all){const h=generateWorldHeights(16,preset,512,13);assert.equal(h.length,289);assert.ok(h.every(x=>x>=-512&&x<=512&&Number.isFinite(x)));}
});
test('RGBA heightmap maps dark-to-low, light-to-high and supports inverted mapping',()=>{
 const image=new Uint8ClampedArray([0,0,0,255,255,255,255,255,128,128,128,255,64,64,64,255]);
 const sample=heightsFromRgba(image,2,2,2,-256,256);
 assert.equal(sample.length,9);assert.equal(sample[0],-256);assert.equal(sample[2],256);
 const inverted=heightsFromRgba(image,2,2,2,-256,256,true);
 assert.equal(inverted[0],256);assert.equal(inverted[2],-256);
 assert.equal(sample[1],0);assert.ok(Math.abs(sample[4]-Math.round((128+64+255)/4-128))<200);
 assert.deepEqual(Array.from(image.slice(0,4)),[0,0,0,255]);
 assert.throws(()=>heightsFromRgba(image,2,2,2,256,-256),/ascending/);
 assert.throws(()=>heightsFromRgba(image,9000,2,2,0,1));
});
test('pure terrain transformations preserve original heights and inverse geometry',()=>{
 const d={...defaultTerrain(),resolution:4,heights:Array.from({length:25},(_,i)=>i*3-25)};
 for(const op of ['smooth','terrace','normalize','mirrorX','mirrorY','rotate90']){
   const next=transformWorldHeights(d,op,{terraceStep:16});assert.equal(next.length,25);
   assert.deepEqual(d.heights,Array.from({length:25},(_,i)=>i*3-25));
   assert.ok(next.every(h=>h>=-512&&h<=512));
 }
 const reflected=transformWorldHeights({...d,heights:transformWorldHeights(d,'mirrorX')},'mirrorX');assert.deepEqual(reflected,d.heights);
 let rotated=d.heights;
 for(let i=0;i<4;i++)rotated=transformWorldHeights({...d,heights:rotated},'rotate90');
 assert.deepEqual(rotated,d.heights);
 assert.equal(sampleTerrainHeight(d.heights,4,0,0),d.heights[0]);
 assert.equal(sampleTerrainHeight(d.heights,4,1,1),d.heights.at(-1));
 assert.equal(worldTerrainStats(d.heights).range,72);
});
test('World Builder UI is merged with original terrain/path/rock tabs and uses large controls',()=>{
 const component=fs.readFileSync(require('node:path').join(__dirname,'../src/components/TerrainShapeStudio.tsx'),'utf8');
 const app=fs.readFileSync(require('node:path').join(__dirname,'../src/App.tsx'),'utf8');
 const css=fs.readFileSync(require('node:path').join(__dirname,'../src/style.css'),'utf8');
 assert.match(app,/World Builder/);
 assert.match(component,/createRockCluster/);assert.match(component,/createPathStructureBrushes/);assert.match(component,/createTerrainBrushes/);
 assert.match(component,/onStrokeStart=\{snapshotHeights\}/);assert.match(component,/importHeightmap/);
 assert.match(component,/applyHeightTransform/);assert.match(component,/terrain-shell world-builder-shell/);
 assert.match(css,/\.world-builder-shell \.terrain-tools/);
 assert.match(css,/min-height:42px/);assert.match(css,/min-height:44px/);
});
