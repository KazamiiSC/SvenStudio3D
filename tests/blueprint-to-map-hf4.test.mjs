import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('../node_modules/typescript/lib/typescript.js');
require.extensions['.ts']=(module,filename)=>{const source=readFileSync(filename,'utf8');const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,allowImportingTsExtensions:true}});module._compile(result.outputText,filename)};
const {initialBlueprint,fitBlueprintOpening,validateBlueprintPlan,buildBlueprintBrushes,exportBlueprintAsset,importBlueprintAsset,addBlueprintOpening,saveBlueprintToProject}=require('../src/engine/blueprintToMap.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const project=()=>({version:1,target:'svengine',name:'HF4',objects:[],world:{classname:'worldspawn'},wadNames:['svstudio.wad']});
const rect=(id,pts)=>({id,kind:'room',name:id,points:pts,openings:[],floor:true,ceiling:false});
const plan=()=>({...initialBlueprint(),imageWidth:900,imageHeight:900,unitsPerPixel:1,origin:[0,0],wallHeight:224,strokes:[rect('room',[[100,100],[500,100],[500,450],[100,450]])]});
const placed=()=>addBlueprintOpening(plan(),'room',0,{kind:'window',t:.5,width:64,height:80,sill:64});
const inspect=(p)=>{
  validateBlueprintPlan(p);
  const brushes=buildBlueprintBrushes(p);
  assert.deepEqual(brushes.flatMap(validateBrush),[]);
  const exported=saveBlueprintToProject(project(),p).project;
  const imported=inspectMapImport(exportMap(exported),'hf4-vertical');
  assert.equal(imported.report.importedBrushes,brushes.length);
  return brushes;
};
test('raising a window changes Z without changing width, height, or wall position',()=>{
 const before=placed();const o=before.strokes[0].openings[0];
 const after=fitBlueprintOpening(before,'room',o.id,{sill:o.sill+24}).strokes[0].openings[0];
 assert.equal(after.sill,88);assert.equal(after.height,o.height);assert.equal(after.width,o.width);assert.equal(after.t,o.t);
 inspect(fitBlueprintOpening(before,'room',o.id,{sill:o.sill+24}));
});
test('lowering window clamps precisely at floor and remains valid',()=>{
 const b=placed(),id=b.strokes[0].openings[0].id;
 const lowered=fitBlueprintOpening(b,'room',id,{sill:-1000});
 assert.equal(lowered.strokes[0].openings[0].sill,0);
 assert.equal(lowered.strokes[0].openings[0].height,80);
 inspect(lowered);
});
test('raising near ceiling clamps sill instead of shrinking opening',()=>{
 const b=placed(),id=b.strokes[0].openings[0].id;
 const raised=fitBlueprintOpening(b,'room',id,{sill:10000});
 assert.equal(raised.strokes[0].openings[0].sill,224-80-8);
 assert.equal(raised.strokes[0].openings[0].height,80);
 inspect(raised);
});
test('3D vertical Z is preserved through export and reimport of editable plan',()=>{
 const b=placed(),id=b.strokes[0].openings[0].id;
 const raised=fitBlueprintOpening(b,'room',id,{sill:112});
 const reopened=importBlueprintAsset(exportBlueprintAsset(raised));
 assert.equal(reopened.strokes[0].openings[0].sill,112);
 inspect(reopened);
});
test('shared wall updates vertical window positions on both sides',()=>{
 const b=plan();b.strokes.push(rect('neighbor',[[500,100],[680,100],[680,450],[500,450]]));
 const w=addBlueprintOpening(b,'room',1,{kind:'window',t:.5,width:48,height:72,sill:72});
 const id=w.strokes[0].openings[0].id;
 const moved=fitBlueprintOpening(w,'room',id,{sill:104});
 assert.equal(moved.strokes[0].openings[0].sill,104);
 assert.equal(moved.strokes[1].openings[0].sill,104);
 inspect(moved);
});
test('HF4 inspector has clear independent sections, bigger room selectors and 3D sill handle',()=>{
 const ui=readFileSync(new URL('../src/components/BlueprintToMapStudio.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/components/blueprintToMapStudio.css',import.meta.url),'utf8');
 for(const needle of ["setInspectorTab('properties')",'bp-inspector-tabs','bp-inspector-content','bp-room-list','bp-opening-z','bp-opening-z-buttons',"handler('sill')",'H.heightZ'])assert.ok(ui.includes(needle),needle);
 for(const needle of ['.bp-inspector-tabs','.bp-inspector-content','.bp-room-list','.bp-opening-z-buttons','min-height:59px'])assert.ok(css.includes(needle),needle);
});
