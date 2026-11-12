const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {useEditor}=require('../src/store.ts');
const {demoProject}=require('../src/store.ts');
test('UI preferences never mutate brushes or project history',()=>{
 const start=useEditor.getState();const map=JSON.stringify(start.project),count=start.history.length;
 start.setUniversalPlacement({mode:'grid',planeZ:512,position:[17,19,31],lockPosition:true});
 assert.equal(JSON.stringify(useEditor.getState().project),map);
 assert.equal(useEditor.getState().history.length,count);
 useEditor.getState().resetUniversalPlacement();
 assert.equal(JSON.stringify(useEditor.getState().project),map);
});
test('exact coordinates are respected by placement even when grid snap is active',()=>{
 let state=useEditor.getState();state.loadProject(demoProject());state.setSnap(16);
 state.setUniversalPlacement({mode:'free',planeZ:777.5,lockPosition:true,position:[33.25,48.5,777.5]});
 state.setPlacementShape('box');
 state.placeShapeAt([33.25,48.5,777.5]);
 state=useEditor.getState();
 const object=state.project.objects.find(o=>o.id===state.selected);
 assert.ok(object);
 // The UI specifies the exact insertion *base*; the brush center is half a height above it.
 assert.deepEqual(object.position,[33.25,48.5,777.5+state.shapeSize[2]/2]);
 state.undo();assert.ok(!useEditor.getState().project.objects.some(o=>o.id===object.id));
});
