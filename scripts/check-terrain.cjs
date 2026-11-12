const fs=require('node:fs'),Module=require('node:module'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(mod,filename)=>{
 const source=fs.readFileSync(filename,'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX},fileName:filename}).outputText;
 mod._compile(compiled,filename);
};
const {defaultTerrain,sculptTerrain,createTerrainBrushes,createRockCluster,terrainBrushSignature,terrainRecord,validateTerrainDraft}=require('../src/engine/terrain.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const {demoProject,useEditor}=require('../src/store.ts');
const results=[];
function test(name,fn){try{fn();results.push([name,'PASS']);}catch(e){console.error('FAIL',name,e);process.exitCode=1}}
test('Flat/steep terrain (4, 8, 12, 16) is closed, convex Valve 220 geometry',()=>{
 for(const resolution of [4,8,12,16]){
  const d={...defaultTerrain(),resolution,heights:Array((resolution+1)**2).fill(0)};
  d.heights=d.heights.map((_,i)=>(i%3===0?100:i%3===1?-120:80));
  const brushes=createTerrainBrushes(d);
  assert.equal(brushes.length,2*resolution*resolution);
  for(const b of brushes)assert.deepEqual(validateBrush(b),[]);
  const project={...demoProject(),objects:[...demoProject().objects,...brushes]};
  assert.ok(exportMap(project).includes('SV_BRICK01'));
 }
});
test('Terrain sculpt, smooth, flatten and noise remain finite and bounded',()=>{
 let d=defaultTerrain();
 for(const tool of ['raise','lower','smooth','flatten','noise']){
  d={...d,heights:sculptTerrain(d,tool,200,200,250,90)};
  assert.deepEqual(validateTerrainDraft(d),[]);
 }
 assert.equal(createTerrainBrushes(d).length,128);
});
test('Valve 220 terrain MAP round-trip preserves complete geometry',()=>{
 const d={...defaultTerrain([768,0,0]),resolution:4,heights:Array(25).fill(0).map((_,i)=>i%4*12)};
 const src=demoProject(),brushes=createTerrainBrushes(d);
 const text=exportMap({...src,objects:[...src.objects,...brushes]});
 const imported=inspectMapImport(text,'terrain_test.map');
 assert.equal(imported.report.skippedBrushes,0);
 assert.equal(imported.project.objects.filter(o=>o.kind==='brush').length,src.objects.filter(o=>o.kind==='brush').length+brushes.length);
});
test('Invalid geometries and out-of-bound settings are rejected',()=>{
 for(const width of [-1,0,8,50000,NaN])assert.throws(()=>createTerrainBrushes({...defaultTerrain(),width}));
 assert.throws(()=>createTerrainBrushes({...defaultTerrain(),heights:[5]}));
 assert.throws(()=>sculptTerrain(defaultTerrain(),'raise',100,100,0,20));
});
test('Rock clusters deterministic in geometry and closed convex across seeds',()=>{
 for(const seed of [1,12,12345,-12]){
  const opts={origin:[0,0,0],count:24,radius:128,height:96,seed,texture:'SV_BRICK01'};
  const rocks=createRockCluster(opts);
  assert.equal(rocks.length,24);
  for(const b of rocks)assert.deepEqual(validateBrush(b),[]);
  const twice=createRockCluster(opts);
  assert.deepEqual(rocks.map(b=>b.vertices),twice.map(b=>b.vertices));
 }
});
test('Terrain records roundtrip through project validation (old projects still open)',()=>{
 const base=demoProject(),d=defaultTerrain(),bs=createTerrainBrushes(d),record=terrainRecord(d,bs);
 const project={...base,objects:[...base.objects,...bs],terrainGroups:[record]};
 const parsed=validateProjectFile(JSON.parse(JSON.stringify(project)));
 assert.equal(parsed.terrainGroups?.length,1);assert.equal(validateProjectFile(base).objects.length,base.objects.length);
});
test('Terrain redo/undo and manual edits protection',()=>{
 const base=demoProject();useEditor.getState().loadProject(base);
 const d=defaultTerrain([1024,0,0]);
 useEditor.getState().applyTerrain(d);
 const after=useEditor.getState().project;
 assert.equal(after.terrainGroups?.length,1);
 assert.equal(after.objects.length,base.objects.length+128);
 useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.length,base.objects.length);
 useEditor.getState().redo();assert.equal(useEditor.getState().project.objects.length,base.objects.length+128);
 const edited={...d,heights:sculptTerrain(d,'raise',256,256,96,32)};
 useEditor.getState().applyTerrain(edited);
 assert.equal(useEditor.getState().project.objects.length,base.objects.length+128);
 const id=useEditor.getState().project.terrainGroups[0].brushIds[0];
 useEditor.getState().updateObject(id,{position:[10,0,0]});
 assert.throws(()=>useEditor.getState().applyTerrain(edited),/edited/);
});
for(const [name,result] of results)console.log(result,name);
if(!process.exitCode)console.log(`Terrain tests ${results.length}/${results.length} PASS`);
