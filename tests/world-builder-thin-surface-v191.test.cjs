/* Regression: thin convex terrain, old solid groups, custom base and Valve 220 round-trip. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {defaultTerrain,createTerrainBrushes,createTerrainPreviewShell,terrainBaseZ,terrainBrushCount,terrainRecord,terrainLowerVertex,validateTerrainDraft}=require('../src/engine/terrain.ts');
const {generateWorldHeights}=require('../src/engine/worldBuilderTerrain.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const {demoProject}=require('../src/store.ts');
const sample=(mode,preset='valley',opt=true,extra={})=>({...defaultTerrain(),baseMode:mode,resolution:8,width:512,depth:512,optimized:opt,heights:generateWorldHeights(8,preset,160,5),...extra});
const projectOf=(d,brushes)=>({...demoProject(),objects:[...demoProject().objects,...brushes],terrainGroups:[terrainRecord(d,brushes)]});
test('new terrain defaults to thin but legacy project remains full solid and unchanged',()=>{
 const d=defaultTerrain();assert.equal(d.baseMode,'thin');assert.equal(d.surfaceThickness,16);
 const legacy=sample(undefined,'valley',false);
 const before=JSON.stringify(legacy);const oldBottom=legacy.origin[2]+Math.min(-(legacy.baseDepth??96),Math.min(...legacy.heights)-64);
 assert.equal(terrainBaseZ(legacy),Math.round(oldBottom*100)/100);
 const brushes=createTerrainBrushes(legacy);assert.equal(brushes.length,128);
 assert.equal(brushes[0].faces.every(f=>f.texture===legacy.texture),true);
 assert.equal(JSON.stringify(legacy),before);
 assert.equal(validateProjectFile(JSON.parse(JSON.stringify(projectOf(legacy,brushes)))).terrainGroups[0].baseMode,undefined);
});
test('thin facets follow the top at constant thickness; walls are not extended to one base plane',()=>{
 const d=sample('thin','valley',false,{surfaceThickness:16,hideUnderside:true});
 assert.deepEqual(validateTerrainDraft(d),[]);
 const list=createTerrainBrushes(d),topHeights=new Set();assert.equal(list.length,128);
 for(const b of list){assert.deepEqual(validateBrush(b),[]);assert.equal(b.faces[0].texture,d.texture);
   assert.ok(b.faces.slice(1).every(f=>f.texture==='NULL'));
   const vs=b.vertices;
   for(let i=0;i<vs.length/2;i++){
     topHeights.add(vs[i][2]);assert.ok(Math.abs(vs[i][2]-vs[i+vs.length/2][2]-16)<1e-6);
   }
 }
 assert.ok(topHeights.size>3);
 assert.equal(terrainBaseZ(d),Math.min(...d.heights)-16);
 const shell=createTerrainPreviewShell(d);
 assert.ok(shell.topPositions.length>0&&shell.basePositions.length>0);
 assert.equal(shell.bottomZ,terrainBaseZ(d));
 assert.equal(terrainLowerVertex(d,[3,4,80])[2],64);
});
test('thin optimized planar regions and non-planar wedges are valid GoldSrc brushes',()=>{
 for(const preset of ['flat','valley','canyon','mountains','island','crater','dunes']){
   for(const optimized of [true,false]){
     const d=sample('thin',preset,optimized,{surfaceThickness:8});const brushes=createTerrainBrushes(d);
     assert.equal(brushes.length,terrainBrushCount(d));
     for(const brush of brushes)assert.deepEqual(validateBrush(brush),[]);
   }
 }
});
test('thin terrain with NULL faces survives actual Valve 220 MAP export/import without lost brushes',()=>{
 for(const preset of ['flat','valley','mountains']){
   const d=sample('thin',preset,true);const brushes=createTerrainBrushes(d);const project=projectOf(d,brushes);
   const text=exportMap(project);
   assert.match(text,/ NULL \[/);assert.match(text,/ SV_BRICK01 \[/);
   assert.equal(inspectMapImport(text,'thin.map').report.skippedBrushes,0);
   const saved=validateProjectFile(JSON.parse(JSON.stringify(project)));
   assert.equal(saved.terrainGroups[0].surfaceThickness,16);
   assert.equal(saved.terrainGroups[0].baseMode,'thin');
   assert.equal(saved.terrainGroups[0].hideUnderside,true);
 }
});
test('optional textured underside and old solid base use the same top geometry',()=>{
 const d=sample('thin','hills',true,{hideUnderside:false});const faceList=createTerrainBrushes(d);
 assert.ok(faceList.every(b=>b.faces.every(f=>f.texture===d.texture)));
 const solid=createTerrainBrushes({...d,baseMode:'solid'});
 assert.equal(solid.length,faceList.length);
 for(let i=0;i<solid.length;i++)assert.deepEqual(solid[i].vertices.slice(0,solid[i].vertices.length/2),faceList[i].vertices.slice(0,faceList[i].vertices.length/2));
});
test('custom base honors exact Z and rejects intersecting base before map mutation',()=>{
 const d=sample('custom','valley',true,{customBaseOffset:-192});assert.deepEqual(validateTerrainDraft(d),[]);
 const brushes=createTerrainBrushes(d);assert.ok(brushes.length>0);
 assert.equal(terrainBaseZ(d),-192);for(const b of brushes){assert.deepEqual(validateBrush(b),[]);for(let k=b.vertices.length/2;k<b.vertices.length;k++)assert.equal(b.vertices[k][2],-192);}
 const unsafe={...d,customBaseOffset:Math.min(...d.heights)-2};
 assert.match(validateTerrainDraft(unsafe).join(' '),/Custom base must be/);
 assert.throws(()=>createTerrainBrushes(unsafe),/Custom base/);
 assert.throws(()=>validateProjectFile(projectOf(unsafe,brushes)),/invalid geometry settings/);
});
test('bad thickness/offset/mode cannot be saved or exported; old optional fields still work',()=>{
 for(const wrong of [{surfaceThickness:0},{surfaceThickness:300},{customBaseOffset:1000},{baseMode:'unknown'},{hideUnderside:3}]){
   const d={...sample('thin'),...wrong};assert.ok(validateTerrainDraft(d).length>0);
   assert.throws(()=>createTerrainBrushes(d));
 }
 const d=sample('thin');const brushes=createTerrainBrushes(d);const p=projectOf(d,brushes);
 for(const wrong of [{surfaceThickness:0},{surfaceThickness:300},{customBaseOffset:3000},{baseMode:'bad'},{hideUnderside:3}]){
   const q=JSON.parse(JSON.stringify(p));Object.assign(q.terrainGroups[0],wrong);assert.throws(()=>validateProjectFile(q));
 }
});
test('existing roads, pipes, rocks and bridges are not changed by thin terrain mode',()=>{
 const studio=fs.readFileSync(path.join(__dirname,'../src/components/TerrainShapeStudio.tsx'),'utf8');
 assert.match(studio,/createRockCluster/);assert.match(studio,/createPathStructureBrushes/);
 assert.match(studio,/pathThickness/);assert.match(studio,/wb-depth-modes/);
 assert.match(studio,/selectBaseMode/);assert.match(studio,/loadTerrain/);
 assert.match(studio,/startTerrainPlacement\(\{kind:'path'/);
});
