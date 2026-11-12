const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {createPathStructureBrushes,validatePathStructure,samplePath,sampleCableSag,sweepFrames3D}=require('../src/engine/pathStructures.ts');
const {validateBrush}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {exportBrush}=require('../src/engine/exportMap.ts');
const defaults={width:64,height:64,wallThickness:8,texture:'SV_BRICK01',smooth:true,subdivisions:6};
const profiles={
  straight:[[0,0,0],[256,0,0]],
  corner:[[0,0,0],[160,0,0],[160,160,0]],
  riseAndTurn:[[0,0,0],[0,0,128],[0,128,128]],
  wallAndCeiling:[[0,0,0],[128,0,0],[128,0,160],[128,128,160]],
  slopingTurn:[[0,0,0],[100,100,48],[150,200,150]],
  downAndTurn:[[0,0,256],[0,0,128],[128,0,128],[128,128,24]],
};
let passes=0;
for(const kind of ['pipe','vent','cable'])for(const [name,points] of Object.entries(profiles))for(const smooth of [false,true]){
  const options={...defaults,kind,points,smooth,width:kind==='cable'?8:64,cableSag:kind==='cable'?24:0,cableCount:kind==='cable'?2:undefined,cableSpacing:16};
  assert.deepEqual(validatePathStructure(options),[],kind+' '+name);
  let brushes;try{brushes=createPathStructureBrushes(options,true);}catch(error){console.error(kind,name,smooth,error.message);throw error;}
  assert.ok(brushes.length>0&&brushes.length<=640);
  for(const brush of brushes)assert.deepEqual(validateBrush(brush),[],brush.name);
  const map=`{\n"classname" "worldspawn"\n${brushes.map(exportBrush).join('\n')}\n}`;
  const result=inspectMapImport(map,'sweep.map');assert.equal(result.report.skippedBrushes,0);
  passes++;
}
// Default Studio route continues to work for the new modes.
for(const kind of ['pipe','vent','cable']){
 const options={...defaults,kind,points:[[-160,-80,0],[0,50,0],[160,-80,0]],width:kind==='cable'?8:96,cableSag:kind==='cable'?32:0};
 const brushes=createPathStructureBrushes(options,true);assert.ok(brushes.length>0);passes++;
}
const anchors=[[0,0,100],[128,0,100]];
const sag=sampleCableSag(anchors,32);
assert.equal(sag[0][2],100);assert.equal(sag.at(-1)[2],100);
assert.ok(Math.min(...sag.map(p=>p[2]))<=68);
const frames=sweepFrames3D([[0,0,0],[0,0,100],[100,0,100]]);
for(const f of frames){
 assert.ok(Math.abs(f.right.dot(f.up))<1e-6);
 assert.ok(Math.abs(f.tangent.dot(f.right))<1e-6);
 assert.ok(Math.abs(f.tangent.dot(f.up))<1e-6);
}
for(const bad of [
 {...defaults,kind:'cable',points:profiles.straight,width:128},
 {...defaults,kind:'cable',points:profiles.straight,cableCount:5},
 {...defaults,kind:'cable',points:profiles.straight,cableSag:-5},
 {...defaults,kind:'vent',points:[[0,0,0],[0,0,8]]},
 {...defaults,kind:'pipe',points:profiles.straight,width:16,wallThickness:12}
])assert.ok(validatePathStructure(bad).length>0||(()=>{try{createPathStructureBrushes(bad,true);return false}catch{return true}})());
// Persist and safely regenerate a cable route through the actual editor store.
const {useEditor,demoProject}=require('../src/store.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
useEditor.getState().loadProject(demoProject());
const cable={...defaults,kind:'cable',name:'Wiring run',points:[[0,0,100],[128,0,100],[256,48,160]],width:8,cableSag:32,cableCount:2,cableSpacing:16};
useEditor.getState().addPathStructure(cable,[0,0,0]);
let project=useEditor.getState().project;
assert.deepEqual(validateProjectFile(structuredClone(project)),project);
const group=project.pathGroups[0];
assert.equal(group.options.cableSag,32);
useEditor.getState().updatePathStructure(group.id,{...cable,cableSag:48});
project=useEditor.getState().project;
assert.equal(project.pathGroups[0].options.cableSag,48);
useEditor.getState().undo();
assert.equal(useEditor.getState().project.pathGroups[0].options.cableSag,32);
assert.ok(validateProjectFile(structuredClone(useEditor.getState().project)));
console.log(`v1.8.6: ${passes} full MAP round-trip route cases passed; cable sag, vertical frame, persisted editing/Undo, and invalid-input guards checked.`);
