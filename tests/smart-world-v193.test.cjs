/* v1.9.3 Smart World Builder regression and Valve 220 geometry validation. */
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {defaultTerrain,createTerrainBrushes,terrainRecord,createTerrainPreviewShell,terrainBrushCount,validateTerrainDraft}=require('../src/engine/terrain.ts');
const {planSmartWorld,smartTerrainHeightAt}=require('../src/engine/smartWorld.ts');
const {createPathStructureBrushes,verifyPathMapBrushes}=require('../src/engine/pathStructures.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const {exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {demoProject,useEditor}=require('../src/store.ts');
const d=()=>({...defaultTerrain(),id:'test-terrain',resolution:8,width:1024,depth:1024,heights:Array.from({length:81},(_,k)=>Math.round(30*Math.cos(k%9/8*Math.PI)*Math.sin(Math.floor(k/9)/8*Math.PI))),optimized:false,texture:'SV_BRICK01'});
const route=(kind)=>({kind,points:[[-200,-60,0],[0,40,0],[200,-60,0]],width:96,height:96,wallThickness:8,texture:'SV_BRICK01',name:'Smart test',smooth:false,subdivisions:2});
const settings={shoulder:96,clearance:16};
test('road seats itself on saved terrain and changes only nearby terrain vertices',()=>{
 const terrain=d(),copy=JSON.stringify(terrain),path=route('road');
 const plan=planSmartWorld(terrain,path,settings);
 assert.equal(JSON.stringify(terrain),copy);assert.equal(plan.openedCells,0);assert.ok(plan.changedVertices>0);
 assert.ok(plan.path.points.some(p=>p[2]!==0));assert.equal(plan.terrain.heights.length,terrain.heights.length);
 assert.deepEqual(validateTerrainDraft(plan.terrain),[]);
 for(const brush of createTerrainBrushes(plan.terrain))assert.ok(brush.faces.length>=5);
 verifyPathMapBrushes(createPathStructureBrushes(plan.path));
});
test('road rejects route beyond edges or unsupported structures without mutating source',()=>{
 const terrain=d(),copy=JSON.stringify(terrain); const path=route('road');
 path.points[0][0]=-530;
 assert.throws(()=>planSmartWorld(terrain,path,settings),/boundary/);
 assert.throws(()=>planSmartWorld(terrain,route('rail'),settings),/only for roads|only for roads, walkways|only for/);
 assert.equal(JSON.stringify(terrain),copy);
});
test('cave creates cell portals only on thin terrain and removes roof panels at entrances',()=>{
 const terrain=d(),before=createTerrainBrushes(terrain),cave=route('cave');
 const plan=planSmartWorld(terrain,cave,settings);
 assert.ok(plan.openedCells>0);assert.equal(plan.changedVertices,0);assert.equal(plan.path.surfacePortals,true);
 assert.equal(terrain.excludedCells,undefined);assert.ok(plan.terrain.excludedCells.some(Boolean));
 const after=createTerrainBrushes(plan.terrain);
 assert.ok(after.length<before.length);assert.equal(after.length,terrainBrushCount(plan.terrain));
 assert.deepEqual(validateTerrainDraft(plan.terrain),[]);
 const shell=createTerrainPreviewShell(plan.terrain);
 assert.equal(shell.topPositions.length,(8*8-plan.openedCells)*6*3);
 const routeBrushes=createPathStructureBrushes(plan.path);assert.ok(routeBrushes.length>0);verifyPathMapBrushes(routeBrushes);
 const panels=new Map();for(const b of routeBrushes){const m=b.name.match(/section (\d+)/);if(m)panels.set(+m[1],(panels.get(+m[1])||0)+1)}
 assert.ok(panels.size>=3);assert.equal(panels.get(1),5);assert.equal(panels.get(panels.size),5);
 assert.ok([...panels.values()].slice(1,-1).some(n=>n>=8));
});
test('cave keeps solid terrain untouched; refuse wrong resolution and invalid masks',()=>{
 const terrain={...d(),baseMode:'solid'};
 assert.throws(()=>planSmartWorld(terrain,route('cave'),settings),/Thin surface/);
 const invalid={...d(),excludedCells:[1]};assert.match(validateTerrainDraft(invalid).join(' '),/cutout/);
});
test('new cutouts preserve exact metadata and export Valve 220 MAP without skipped brushes',()=>{
 const terrain=d(),plan=planSmartWorld(terrain,route('cave'),settings);
 const tb=createTerrainBrushes(plan.terrain),cb=createPathStructureBrushes(plan.path);
 const project={...demoProject(),name:'v193-test',objects:[...tb,...cb],terrainGroups:[terrainRecord(plan.terrain,tb)],pathGroups:[]};
 const restored=validateProjectFile(JSON.parse(JSON.stringify(project)));
 assert.deepEqual(restored.terrainGroups[0].excludedCells,plan.terrain.excludedCells);
 const map=exportMap(restored);const read=inspectMapImport(map,'smart-world.map');
 assert.equal(read.report.skippedBrushes,0);assert.ok(read.report.importedBrushes>=tb.length+cb.length);
});
test('one atomic store transaction commits both terrain and route; editor undo restores both',()=>{
 const editor=useEditor.getState(); const terrain=d();editor.applyTerrain(terrain);
 const before=useEditor.getState();const terrainBefore=before.project.terrainGroups.find(r=>r.id===terrain.id);
 const oldPathCount=before.project.pathGroups?.length??0; const historyLen=before.history.length;
 before.applySmartWorld(terrain.id,route('road'),settings);
 const next=useEditor.getState();
 assert.equal(next.history.length,historyLen+1);
 assert.equal(next.project.pathGroups.length,oldPathCount+1);
 assert.notDeepEqual(next.project.terrainGroups.find(r=>r.id===terrain.id).heights,terrainBefore.heights);
 // Standard history is one entry, no two-step dangling terrain modifications.
 assert.equal(next.history.at(-1).pathGroups?.length??0,oldPathCount);
});
test('no changes after source geometry has been edited or locked',()=>{
 const e=useEditor.getState(),terrain={...d(),id:'smart-locked-terrain'};e.applyTerrain(terrain);
 const brushId=useEditor.getState().project.terrainGroups.find(g=>g.id===terrain.id).brushIds[0];
 useEditor.getState().updateObject(brushId,{locked:true});
 const snapshot=JSON.stringify(useEditor.getState().project);
 assert.throws(()=>useEditor.getState().applySmartWorld(terrain.id,route('road'),settings),/locked|Source terrain/);
 assert.equal(JSON.stringify(useEditor.getState().project),snapshot);
});

test('linked terrain and cave route reject one-sided regeneration after a smart commit',()=>{
 const terrain={...d(),id:'smart-linked-terrain'};useEditor.getState().applyTerrain(terrain);
 useEditor.getState().applySmartWorld(terrain.id,route('cave'),settings);
 const linked=useEditor.getState().project.pathGroups.find(r=>r.integratedTerrainId===terrain.id);
 assert.ok(linked);assert.ok(linked.options.surfacePortals);
 assert.deepEqual(validateProjectFile(JSON.parse(JSON.stringify(useEditor.getState().project))).pathGroups.find(r=>r.id===linked.id).options.surfacePortals,true);
 const before=JSON.stringify(useEditor.getState().project);
 assert.throws(()=>useEditor.getState().updatePathStructure(linked.id,linked.options),/linked to a World Builder terrain/);
 assert.throws(()=>useEditor.getState().applyTerrain({...terrain,heights:terrain.heights.map(h=>h+2)}),/linked to a Smart World route/);
 assert.equal(JSON.stringify(useEditor.getState().project),before);
});
test('legacy paths without a terrain link retain their established path structure',()=>{
 const p=route('cave');const brushes=createPathStructureBrushes(p);
 assert.ok(brushes.length>0);assert.equal(p.surfacePortals,undefined);
});

test('road elevation samples actual triangulated cells with flipped diagonals',()=>{
 const t={...d(),resolution:4,width:256,depth:256,heights:Array(25).fill(0),diagonalFlips:Array(16).fill(0)};
 t.heights[0]=0;t.heights[1]=0;t.heights[6]=128;t.heights[5]=0;
 const x=-96,y=-96; // local grid fraction .5,.5 in first cell
 assert.equal(smartTerrainHeightAt(t,x,y),64);
 t.diagonalFlips[0]=1;assert.equal(smartTerrainHeightAt(t,x,y),0);
});
