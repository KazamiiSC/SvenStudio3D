import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('../node_modules/typescript/lib/typescript.js');
require.extensions['.ts']=(module,filename)=>{const source=readFileSync(filename,'utf8');const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}});module._compile(result.outputText,filename)};
const {initialBlueprint,blueprintLevels,buildBlueprintBrushes,blueprintStairRectangle,validateBlueprintPlan,exportBlueprintAsset,importBlueprintAsset,addBlueprintOpening,saveBlueprintToProject}=require('../src/engine/blueprintToMap.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const rect=(id,levelId)=>({id,kind:'room',name:id,levelId,points:[[100,100],[600,100],[600,600],[100,600]],openings:[],floor:true,ceiling:true});
const plan=()=>{const p=initialBlueprint();p.imageWidth=800;p.imageHeight=800;p.strokes=[rect('lower','ground'),rect('upper','l2')];p.levels=[{id:'ground',name:'Ground',offsetZ:0},{id:'l2',name:'Floor 2',offsetZ:240}];p.stairs=[{id:'s1',name:'Stairs',fromLevelId:'ground',toLevelId:'l2',start:[200,300],direction:0,width:80,length:320,steps:16}];return p;};
const project=()=>({version:1,target:'svengine',name:'test',objects:[],world:{classname:'worldspawn'},wadNames:['svstudio.wad']});
test('HF4 plans load as one ground floor, unchanged',()=>{const p=initialBlueprint();assert.equal(blueprintLevels(p).length,1);assert.equal(buildBlueprintBrushes({...p,strokes:[rect('legacy',undefined)]}).length>0,true)});
test('two levels and stairs produce valid Valve 220 convex brushes, roundtrip',()=>{
 const p=plan();validateBlueprintPlan(p);const bs=buildBlueprintBrushes(p);assert.ok(bs.length>25);assert.equal(bs.flatMap(validateBrush).length,0);
 const exported=saveBlueprintToProject(project(),p).project;
 const parsed=inspectMapImport(exportMap(exported),'multilevel');assert.equal(parsed.report.importedBrushes,bs.length);
});
test('stairwell is open in floor above and ceiling below',()=>{
 const p=plan(),bs=buildBlueprintBrushes(p),rect=blueprintStairRectangle(p,p.stairs[0]);
 const center=[rect.reduce((a,x)=>a+x[0],0)/4,rect.reduce((a,x)=>a+x[1],0)/4];
 const crossing=bs.filter(b=>(b.name.includes(' Floor ')||b.name.includes(' Ceiling '))&&Math.abs(b.position[2]-232)<20).filter(b=>{
 const minx=Math.min(...b.vertices.map(v=>v[0]+b.position[0])),maxx=Math.max(...b.vertices.map(v=>v[0]+b.position[0]));
 const miny=Math.min(...b.vertices.map(v=>v[1]+b.position[1])),maxy=Math.max(...b.vertices.map(v=>v[1]+b.position[1]));
 return center[0]>minx+1&&center[0]<maxx-1&&center[1]>miny+1&&center[1]<maxy-1;
 });assert.equal(crossing.length,0,'no slab crosses stair shaft centre');
});
test('old projects remain editable and multi-level metadata survives asset roundtrip',()=>{
 const p=plan(),q=importBlueprintAsset(exportBlueprintAsset(p));assert.deepEqual(q.levels,p.levels);assert.deepEqual(q.stairs,p.stairs);assert.equal(q.memberIds.length,0);
});
test('upper floor doors do not generate phantom opening in ground floor wall',()=>{
 const p=plan();const q=addBlueprintOpening(p,'upper',0,{kind:'door',t:.5,width:64,height:96,sill:0});assert.equal(q.strokes[0].openings.length,0);assert.equal(q.strokes[1].openings.length,1);
});
test('pitched gable and shed roofs are convex and survive Valve 220 roundtrip',()=>{
  for(const kind of ['gable','shed']){
    const p=plan();p.strokes[1].roof={kind,rise:80};
    const bs=buildBlueprintBrushes(p);const roofs=bs.filter(b=>b.name.includes(' Roof '));
    assert.equal(roofs.length,kind==='gable'?2:1);assert.deepEqual(roofs.flatMap(validateBrush),[]);
    const map=exportMap(saveBlueprintToProject(project(),p).project);
    assert.equal(inspectMapImport(map,'roof').report.importedBrushes,bs.length);
  }
});
test('pitched roofs on middle floors are rejected, avoiding a hidden collision',()=>{
  const p=plan();p.strokes[0].roof={kind:'gable',rise:80};
  assert.throws(()=>buildBlueprintBrushes(p),/top floor/i);
});
test('three floors with two independent stairs remain convex, and no cross-level wall union',()=>{
 const p=plan();p.levels.push({id:'l3',name:'Floor 3',offsetZ:480});p.strokes.push(rect('top','l3'));
 p.stairs.push({id:'s2',name:'Upper stair',fromLevelId:'l2',toLevelId:'l3',start:[200,440],direction:0,width:64,length:320,steps:16});
 const bs=buildBlueprintBrushes(p);assert.equal(bs.flatMap(validateBrush).length,0);assert.ok(bs.filter(b=>b.name.includes('Step')).length===32);
});
test('steep staircase is rejected before generating broken or unusable geometry',()=>{
 const p=plan();p.stairs[0].steps=8;p.stairs[0].length=128;
 assert.throws(()=>buildBlueprintBrushes(p),/too steep/i);
});
test('legacy metadata remains valid, new levels are stored as optional extensions',()=>{
 const p=initialBlueprint();p.strokes.push(rect('legacy',undefined));
 validateBlueprintPlan(p);assert.equal('levels' in p,false);
 const q=importBlueprintAsset(exportBlueprintAsset(p));assert.equal(q.levels,undefined);
});
test('preview controls and accessible layout are present in the 3D editor',()=>{
 const ui=readFileSync(new URL('../src/components/BlueprintToMapStudio.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/components/blueprintToMapStudio.css',import.meta.url),'utf8');
 for(const item of ['bp-levelbar','wallVis','CameraSectorWatcher','StairEditor3D','onSelectStair','selectedStair','F.stairs','allFloors','bp-inspector-tabs','bp-opening-z'])assert.ok(ui.includes(item),item);
 for(const item of ['.bp-levelbar','.bp-stair-properties','.bp-inspector-content','min-height:59px'])assert.ok(css.includes(item),item);
});
test('gable roof directly seals walls when the upper room has no optional ceiling slab',()=>{
 const p=plan();p.strokes[1].ceiling=false;p.strokes[1].roof={kind:'gable',rise:64};
 const roofs=buildBlueprintBrushes(p).filter(b=>b.name.includes(' Roof '));
 const wallTop=p.baseZ+p.levels[1].offsetZ+p.wallHeight;
 for(const roof of roofs){const bottom=roof.position[2]+Math.min(...roof.vertices.map(v=>v[2]));assert.equal(bottom,wallTop);}
});
