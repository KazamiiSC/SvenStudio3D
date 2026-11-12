import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('../node_modules/typescript/lib/typescript.js');
require.extensions['.ts']=(module,filename)=>{const source=readFileSync(filename,'utf8');const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,allowImportingTsExtensions:true}});module._compile(result.outputText,filename)};
const {initialBlueprint,validateBlueprintPlan,saveBlueprintDraftToProject,saveBlueprintToProject,fitBlueprintOpening,repairBlueprintOpenings,exportBlueprintAsset,importBlueprintAsset,addBlueprintOpening,buildBlueprintBrushes,blueprintPixelToWorld}=require('../src/engine/blueprintToMap.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const project=()=>({version:1,target:'svengine',name:'HF2 test',objects:[],world:{classname:'worldspawn'},wadNames:['svstudio.wad']});
const room=(id='room',points=[[100,100],[500,100],[500,400],[100,400]])=>({id,kind:'room',name:id,points,floor:true,ceiling:false,openings:[]});
const sample=()=>({...initialBlueprint(),name:'A finished house',imageWidth:640,imageHeight:480,strokes:[room()]});
const door=(id='door1',t=.5,width=80)=>({id,edge:0,t,kind:'door',width,height:112,sill:0});

test('invalid corner placement can be SAVED and imported as a draft without generating unsafe brushes',()=>{
 const plan=sample();plan.strokes[0].openings.push(door('d1',.06,100));
 assert.throws(()=>validateBlueprintPlan(plan));
 const saved=saveBlueprintDraftToProject(project(),plan);
 assert.equal(saved.objects.length,0);assert.equal(saved.blueprintPlans[0].strokes[0].openings[0].t,.06);
 assert.equal(validateProjectFile(JSON.parse(JSON.stringify(saved))).blueprintPlans.length,1);
 assert.throws(()=>saveBlueprintToProject(saved,plan));
});
test('automatic fit repairs an invalid corner while retaining a safe margin',()=>{
 const plan=sample();plan.strokes[0].openings.push(door('d1',.02,88));
 const corrected=repairBlueprintOpenings(plan);
 assert.doesNotThrow(()=>validateBlueprintPlan(corrected));
 assert.ok(corrected.strokes[0].openings[0].t>plan.strokes[0].openings[0].t);
 assert.deepEqual(buildBlueprintBrushes(corrected).flatMap(validateBrush),[]);
});
test('fit clamps width and position to a safe interval and never loses other openings',()=>{
 const plan=sample();plan.strokes[0].openings.push(door('d1',.5,80));
 const a=fitBlueprintOpening(plan,'room','d1',{t:.02,width:170});
 assert.doesNotThrow(()=>validateBlueprintPlan(a));
 assert.ok(a.strokes[0].openings[0].t>.02);
 assert.equal(a.strokes[0].openings.length,1);
 const b=fitBlueprintOpening(a,'room','d1',{height:420,sill:230});
 assert.doesNotThrow(()=>validateBlueprintPlan(b));
 assert.ok(b.strokes[0].openings[0].sill+b.strokes[0].openings[0].height<=b.wallHeight-8);
});
test('edits propagate through two rooms sharing the same wall centerline',()=>{
 const plan=sample();plan.strokes.push(room('adjacent',[[500,100],[800,100],[800,400],[500,400]]));
 const withDoor=addBlueprintOpening(plan,'room',1,{kind:'door',t:.5,width:72,height:112,sill:0});
 const before=withDoor.strokes.map(s=>s.openings[0]);
 assert.equal(before.length,2);
 const after=fitBlueprintOpening(withDoor,'room',before[0].id,{width:56,height:96,t:.6});
 assert.equal(after.strokes[0].openings[0].width,56);
 assert.equal(after.strokes[1].openings[0].width,56);
 assert.equal(after.strokes[1].openings[0].height,96);
 const center=(stroke,opening)=>{
   const a=stroke.points[opening.edge],b=stroke.points[(opening.edge+1)%stroke.points.length];
   return blueprintPixelToWorld(after,[a[0]+(b[0]-a[0])*opening.t,a[1]+(b[1]-a[1])*opening.t]);
 };
 assert.ok(Math.hypot(...center(after.strokes[0],after.strokes[0].openings[0]).map((v,i)=>v-center(after.strokes[1],after.strokes[1].openings[0])[i]))<1e-5);
 assert.deepEqual(buildBlueprintBrushes(after).flatMap(validateBrush),[]);
});
test('standalone editable file contains image and source but strips all project brush provenance',()=>{
 let b=sample();b.imageDataUrl='data:image/png;base64,iVBORw0KGgo=';
 const generated=saveBlueprintToProject(project(),b).project;
 const file=exportBlueprintAsset(generated.blueprintPlans[0]);
 assert.equal(file.format,'svenstudio-blueprint');assert.equal(file.version,1);
 assert.deepEqual(file.plan.memberIds,[]);assert.deepEqual(file.plan.signatures,[]);
 const reopened=importBlueprintAsset(JSON.parse(JSON.stringify(file)));
 assert.equal(reopened.name,b.name);assert.equal(reopened.imageDataUrl,b.imageDataUrl);
 assert.notEqual(reopened.id,b.id);assert.deepEqual(reopened.strokes,b.strokes);
 const newProject=saveBlueprintDraftToProject(project(),reopened);
 assert.equal(newProject.objects.length,0);
 const placed=saveBlueprintToProject(newProject,reopened).project;
 const imported=inspectMapImport(exportMap(placed),'reusable');
 assert.equal(imported.report.importedBrushes,placed.objects.length);
});
test('import rejects unsafe image links, malformed documents, and absurd sizes',()=>{
 const asset=exportBlueprintAsset(sample());
 assert.throws(()=>importBlueprintAsset({...asset,format:'whatever'}));
 assert.throws(()=>importBlueprintAsset({...asset,plan:{...asset.plan,imageDataUrl:'https://external.example/img.png'}}));
 assert.throws(()=>importBlueprintAsset({...asset,plan:{...asset.plan,wallHeight:100000}}));
 assert.throws(()=>importBlueprintAsset({}));
});
test('generated plan remains editable across save/reopen without duplication',()=>{
 const a=sample();let p=saveBlueprintToProject(project(),a).project;
 const oldBrushCount=p.objects.length;
 const changed={...p.blueprintPlans[0],name:'Updated',wallHeight:256};
 p=saveBlueprintDraftToProject(p,changed);
 assert.equal(p.objects.length,oldBrushCount);
 const imported=validateProjectFile(JSON.parse(JSON.stringify(p)));
 p=saveBlueprintToProject(imported,imported.blueprintPlans[0]).project;
 assert.equal(p.blueprintPlans.length,1);assert.equal(p.objects.length,oldBrushCount);
 assert.equal(p.blueprintPlans[0].wallHeight,256);
 assert.deepEqual(p.objects.flatMap(validateBrush),[]);
});
