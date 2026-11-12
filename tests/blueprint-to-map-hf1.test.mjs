import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('../node_modules/typescript/lib/typescript.js');
require.extensions['.ts']=(module,filename)=>{const source=readFileSync(filename,'utf8');const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,allowImportingTsExtensions:true}});module._compile(result.outputText,filename)};
const {initialBlueprint,validateBlueprintPlan,saveBlueprintDraftToProject,placeBlueprintAtPoint,saveBlueprintToProject,calibrateBlueprint,blueprintPixelToWorld}=require('../src/engine/blueprintToMap.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const base=()=>({version:1,target:'svengine',name:'HF1',objects:[],world:{classname:'worldspawn'},wadNames:['svstudio.wad']});
const room={id:'room',kind:'room',name:'Test room',points:[[100,100],[500,100],[500,400],[100,400]],floor:true,ceiling:true,openings:[]};
const sample=()=>({...initialBlueprint(),name:'Casa',imageWidth:640,imageHeight:480,texture:'SV_BRICK01',strokes:[structuredClone(room)]});
test('save draft preserves image and geometry but adds zero brushes',()=>{
 const b=sample();b.imageDataUrl='data:image/png;base64,iVBORw0KGgo=';
 const saved=saveBlueprintDraftToProject(base(),b);
 assert.equal(saved.objects.length,0);assert.equal(saved.blueprintPlans[0].imageDataUrl,b.imageDataUrl);
 assert.equal(validateProjectFile(saved).blueprintPlans.length,1);
});
test('save draft and then generate maintains one editable document and intact provenance',()=>{
 const p=sample();let saved=saveBlueprintDraftToProject(base(),p);
 const generated=saveBlueprintToProject(saved,saved.blueprintPlans[0]);saved=generated.project;
 const edited={...saved.blueprintPlans[0],name:'Casa editada',wallHeight:256};
 const persisted=saveBlueprintDraftToProject(saved,edited);
 assert.equal(persisted.objects.length,saved.objects.length);
 assert.equal(persisted.blueprintPlans.length,1);
 assert.deepEqual(persisted.blueprintPlans[0].memberIds,saved.blueprintPlans[0].memberIds);
 assert.equal(persisted.blueprintPlans[0].name,'Casa editada');
 const refreshed=saveBlueprintToProject(persisted,persisted.blueprintPlans[0]);
 assert.equal(refreshed.project.blueprintPlans[0].wallHeight,256);
 assert.deepEqual(refreshed.project.objects.flatMap(validateBrush),[]);
});
test('saving 2 documents keeps both and most recently saved one last',()=>{
 const first=sample(),second={...sample(),id:'another',name:'Segundo'};
 let p=saveBlueprintDraftToProject(base(),first);
 p=saveBlueprintDraftToProject(p,second);
 p=saveBlueprintDraftToProject(p,{...first,name:'Primero modificado'});
 assert.equal(p.blueprintPlans.length,2);
 assert.equal(p.blueprintPlans.at(-1).name,'Primero modificado');
});
test('click placement moves traced bounds center to requested XY and baseZ to hit surface',()=>{
 const p=sample();const saved=saveBlueprintDraftToProject(base(),p);
 const target=[384,-256,32];const placed=placeBlueprintAtPoint(saved,p.id,target);
 const record=placed.project.blueprintPlans[0];
 const pointWorld=record.strokes[0].points.map(pt=>blueprintPixelToWorld(record,pt));
 const center=[(Math.min(...pointWorld.map(pt=>pt[0]))+Math.max(...pointWorld.map(pt=>pt[0])))/2,
  (Math.min(...pointWorld.map(pt=>pt[1]))+Math.max(...pointWorld.map(pt=>pt[1])))/2];
 assert.deepEqual(center,target.slice(0,2));assert.equal(record.baseZ,target[2]);
 assert.deepEqual(placed.project.objects.flatMap(validateBrush),[]);
 const imported=inspectMapImport(exportMap(placed.project),'hf1');
 assert.equal(imported.report.importedBrushes,placed.memberIds.length);
});
test('replacing saved generated geometry at a second map location does not duplicate brushes',()=>{
 const p=sample();const first=placeBlueprintAtPoint(saveBlueprintDraftToProject(base(),p),p.id,[0,0,0]);
 const second=placeBlueprintAtPoint(first.project,p.id,[200,-100,64]);
 assert.equal(second.project.objects.length,first.project.objects.length);
 assert.equal(second.project.blueprintPlans.length,1);
 assert.deepEqual(second.project.objects.flatMap(validateBrush),[]);
});
test('calibration rejects identical points without corrupting persisted draft',()=>{
 const p=sample(),project=saveBlueprintDraftToProject(base(),p);
 assert.throws(()=>calibrateBlueprint(p,[100,100],[100,100],128));
 assert.equal(project.blueprintPlans[0].unitsPerPixel,1);
 assert.doesNotThrow(()=>validateBlueprintPlan(project.blueprintPlans[0]));
});
test('invalid placement or missing plan does not mutate project',()=>{
 const before=base();assert.throws(()=>placeBlueprintAtPoint(before,'nonexistent',[0,0,0]));
 assert.equal(before.objects.length,0);
 const b=saveBlueprintDraftToProject(before,sample());assert.throws(()=>placeBlueprintAtPoint(b,b.blueprintPlans[0].id,[100000,0,0]));
 assert.equal(b.objects.length,0);
});
test('a door on a shared wall opens both adjacent rooms rather than leaving a blocked passage',()=>{
 const {addBlueprintOpening}=require('../src/engine/blueprintToMap.ts');
 const p=sample();
 p.strokes.push({...structuredClone(room),id:'room2',name:'Second room',points:[[500,100],[800,100],[800,400],[500,400]]});
 const next=addBlueprintOpening(p,'room',1,{kind:'door',width:80,height:128,sill:0,t:.5});
 assert.equal(next.strokes[0].openings.length,1);
 assert.equal(next.strokes[1].openings.length,1);
 assert.equal(next.strokes[1].openings[0].edge,3);
 assert.equal(next.strokes[1].openings[0].t,.5);
 assert.deepEqual(require('../src/engine/blueprintToMap.ts').buildBlueprintBrushes(next).flatMap(validateBrush),[]);
});
test('an impossible shared wall opening fails atomically without modifying either room',()=>{
 const {addBlueprintOpening}=require('../src/engine/blueprintToMap.ts');
 const p=sample();
 p.strokes.push({...structuredClone(room),id:'room2',name:'Second room',points:[[500,100],[800,100],[800,400],[500,400]]});
 assert.throws(()=>addBlueprintOpening(p,'room',1,{kind:'door',width:296,height:128,sill:0,t:.5}));
 assert.equal(p.strokes[0].openings.length,0);
 assert.equal(p.strokes[1].openings.length,0);
});
