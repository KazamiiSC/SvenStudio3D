import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('../node_modules/typescript/lib/typescript.js');
require.extensions['.ts']=(module,filename)=>{const source=readFileSync(filename,'utf8');const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,allowImportingTsExtensions:true}});module._compile(result.outputText,filename)};
const {initialBlueprint,calibrateBlueprint,blueprintPixelToWorld,blueprintWorldToPixel,buildBlueprintBrushes,validateBlueprintPlan,saveBlueprintToProject,removeBlueprintFromProject}=require('../src/engine/blueprintToMap.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const base=()=>({version:1,target:'svengine',name:'Blueprint test',objects:[],world:{classname:'worldspawn'},wadNames:['svstudio.wad']});
const rect=[[100,100],[500,100],[500,400],[100,400]];
const room=(points=rect,props={})=>({id:'room1',name:'Test room',kind:'room',points,openings:[],floor:true,ceiling:true,...props});
const plan=(strokes=[room()],rest={})=>({...initialBlueprint(),imageWidth:640,imageHeight:480,unitsPerPixel:1,wallHeight:224,wallThickness:16,slabThickness:16,texture:'SV_BRICK01',strokes,...rest});
const valid=p=>assert.deepEqual(buildBlueprintBrushes(p).flatMap(validateBrush),[]);
const door={id:'door1',edge:0,t:.5,kind:'door',width:80,height:128,sill:0};
const windowOpen={id:'window1',edge:2,t:.5,kind:'window',width:96,height:80,sill:96};
test('calibration from two reference points determines precise world geometry',()=>{
 const p=plan([]);const scaled=calibrateBlueprint(p,[100,200],[300,200],512);
 assert.equal(scaled.unitsPerPixel,2.56);assert.deepEqual(blueprintWorldToPixel(scaled,blueprintPixelToWorld(scaled,[320,240])),[320,240]);
 assert.throws(()=>calibrateBlueprint(p,[0,0],[0,0],128));
});
test('polygonal rooms produce sealed convex MAP brushes with floor and roof',()=>{
 for(const points of [rect,[[100,100],[500,100],[520,250],[500,400],[100,400]],[[90,90],[530,90],[530,190],[310,190],[310,400],[90,400]]]){
  const p=plan([room(points)]),br=buildBlueprintBrushes(p);assert.ok(br.length>=6);valid(p);
  assert.ok(br.some(b=>b.name.includes('Floor')));assert.ok(br.some(b=>b.name.includes('Ceiling')));
 }
});
test('walls at arbitrary diagonals remain closed convex solids',()=>{
 const p=plan([{id:'w1',kind:'wall',name:'Diagonal hall',floor:false,ceiling:false,openings:[],points:[[100,120],[230,210],[450,175]]}]);valid(p);
});
test('doors and windows create discrete convex jamb and lintel segments',()=>{
 const p=plan([room(rect,{openings:[door,windowOpen]})]);const br=buildBlueprintBrushes(p);
 assert.ok(br.some(b=>b.name.includes('lintel')));assert.ok(br.some(b=>b.name.includes('sill')));assert.ok(br.length>10);valid(p);
});
test('invalid outlines and overlapping openings are rejected before project mutation',()=>{
 const bad=[
  room([[100,100],[500,400],[100,400],[500,100]]),
  room([[100,100],[120,100],[120,120]]),
  room(rect,{openings:[door,{...door,id:'door2',t:.54}]}),
  room(rect,{openings:[{...door,t:.02}]}),
 ];
 for(const s of bad)assert.throws(()=>buildBlueprintBrushes(plan([s])));
 assert.throws(()=>buildBlueprintBrushes(plan([room()],{texture:'BAD TEX'})));
});
test('projects save and edit without losing other objects, one atomic geometry replacement',()=>{
 const first=plan([room()]);const saved=saveBlueprintToProject(base(),first);
 assert.equal(saved.project.blueprintPlans.length,1);assert.equal(saved.memberIds.length,saved.project.objects.length);
 assert.doesNotThrow(()=>validateProjectFile(saved.project));
 const edited=saveBlueprintToProject(saved.project,{...saved.project.blueprintPlans[0],wallHeight:300});
 assert.equal(edited.project.blueprintPlans.length,1);assert.ok(edited.project.objects.length>0);
 assert.deepEqual(edited.project.objects.flatMap(validateBrush),[]);
 assert.equal(edited.project.blueprintPlans[0].wallHeight,300);
 const detached=removeBlueprintFromProject(edited.project,first.id,true);
 assert.equal(detached.blueprintPlans.length,0);assert.equal(detached.objects.length,edited.project.objects.length);
 const gone=removeBlueprintFromProject(edited.project,first.id,false);
 assert.equal(gone.objects.length,0);
});
test('manual edits or deletions block both rebuild and destructive remove',()=>{
 const saved=saveBlueprintToProject(base(),plan([room()]));
 const changed={...saved.project,objects:saved.project.objects.map((o,i)=>i===0?{...o,position:[o.position[0]+3,o.position[1],o.position[2]]}:o)};
 assert.throws(()=>saveBlueprintToProject(changed,{...changed.blueprintPlans[0],wallHeight:280}),/manually edited/);
 assert.throws(()=>removeBlueprintFromProject(changed,changed.blueprintPlans[0].id),/manually edited/);
 assert.equal(removeBlueprintFromProject(changed,changed.blueprintPlans[0].id,true).objects.length,changed.objects.length);
});
test('Valve 220 MAP exports and reimports all generated brushes without loss',()=>{
 for(const p of [plan([room()]),plan([room(rect,{openings:[door,windowOpen]})]),plan([room([[90,90],[530,90],[530,190],[310,190],[310,400],[90,400]])])]){
  const saved=saveBlueprintToProject(base(),p);
  const text=exportMap(saved.project);
  assert.match(text,/mapversion" "220/);
  const imported=inspectMapImport(text,'blueprint test');
  assert.equal(imported.report.importedBrushes,saved.memberIds.length);
  assert.equal(imported.report.skippedBrushes,0);
 }
});
test('imported blueprint project image and trace metadata are validated',()=>{
 const original=plan([room()]);const saved=saveBlueprintToProject(base(),original).project;
 const revived=validateProjectFile(JSON.parse(JSON.stringify(saved)));
 assert.equal(revived.blueprintPlans.length,1);
 assert.throws(()=>validateProjectFile({...saved,blueprintPlans:[{...saved.blueprintPlans[0],unitsPerPixel:0}]}));
 assert.throws(()=>validateProjectFile({...saved,blueprintPlans:[{...saved.blueprintPlans[0],imageDataUrl:'data:image/svg+xml,<svg/onload=alert(1)>'}]}));
});
test('multiple documents stay separate and save existing records independently',()=>{
 const first=saveBlueprintToProject(base(),plan([room()]));
 const second=saveBlueprintToProject(first.project,plan([room()],{id:'other-blueprint',name:'Other'}));
 assert.equal(second.project.blueprintPlans.length,2);
 const reduced=removeBlueprintFromProject(second.project,first.project.blueprintPlans[0].id);
 assert.equal(reduced.blueprintPlans.length,1);
 assert.equal(reduced.objects.length,second.memberIds.length);
});
test('256 rotated and scaled layouts with door/window openings remain MAP-valid',()=>{
 for(let i=0;i<256;i++){
  const angle=i*Math.PI/128,scale=.5+(i%7)*.2,cx=300,cy=230;
  const rotate=([x,y])=>{const dx=(x-cx)*scale,dy=(y-cy)*scale;return [cx+dx*Math.cos(angle)-dy*Math.sin(angle),cy+dx*Math.sin(angle)+dy*Math.cos(angle)]};
  const roomCoords=[[170,120],[450,120],[450,340],[170,340]].map(rotate);
  const p=plan([room(roomCoords,{openings:[{...door,width:64,height:120},{...windowOpen,width:72,sill:72,height:80}]})],
    {wallHeight:200+i%6*16,baseZ:i%7*32,wallThickness:8+i%4*4,slabThickness:8+i%3*4});
  const brushes=buildBlueprintBrushes(p);
  assert.deepEqual(brushes.flatMap(validateBrush),[],`invalid rotated layout ${i}`);
 }
});
test('editing blueprint origin translates the entire layout without touching dimensions',()=>{
 const first=saveBlueprintToProject(base(),plan([room()])).project;
 const next=saveBlueprintToProject(first,{...first.blueprintPlans[0],origin:[256,-192]});
 const old=first.objects[0],now=next.project.objects[0];
 assert.equal(Math.round(now.position[0]-old.position[0]),256);
 assert.equal(Math.round(now.position[1]-old.position[1]),-192);
 assert.equal(now.vertices.length,old.vertices.length);
 assert.deepEqual(next.project.objects.flatMap(validateBrush),[]);
});
