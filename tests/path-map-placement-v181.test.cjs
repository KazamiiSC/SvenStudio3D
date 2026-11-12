const assert=require('node:assert/strict');
const fs=require('node:fs');
const ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {useEditor,demoProject}=require('../src/store.ts');
const {createPathStructureBrushes}=require('../src/engine/pathStructures.ts');
const {defaultTerrain}=require('../src/engine/terrain.ts');
const state=useEditor.getState();
state.loadProject(demoProject());
const originalCount=useEditor.getState().project.objects.length;
const base=defaultTerrain();base.origin=[96,32,0];
const path={points:[[0,0,0],[96,0,0],[128,64,0]],kind:'walkway',width:64,height:64,wallThickness:8,texture:'SV_BRICK01',name:'Placement test',smooth:false};
const reference=createPathStructureBrushes(path);
state.startTerrainPlacement({kind:'path',draft:base,path});
assert.equal(useEditor.getState().project.objects.length,originalCount,'arming tool must not change the map');
state.placePendingTerrain([512,256,48]);
const current=useEditor.getState();
assert.equal(current.terrainPlacement,null,'a successful placement must disarm the tool');
assert.equal(current.project.objects.length,originalCount+reference.length);
for(let i=0;i<reference.length;i++)for(let j=0;j<reference[i].vertices.length;j++){
 const actual=current.project.objects[originalCount+i].vertices[j];const expected=reference[i].vertices[j];
 assert.ok(actual.every((v,axis)=>Math.abs(v-(expected[axis]+[416,224,48][axis]))<0.002),'each path vertex must translate from stored placement origin');
}
current.undo();
assert.equal(useEditor.getState().project.objects.length,originalCount,'Undo must remove placement');
state.startTerrainPlacement({kind:'path',draft:base,path:{...path,points:[[0,0,0],[0,0,0]]}});
assert.throws(()=>state.placePendingTerrain([512,256,0]));
assert.equal(useEditor.getState().project.objects.length,originalCount,'invalid path must not add brushes');
console.log('Path click placement, translation, undo and invalid geometry: PASS');
