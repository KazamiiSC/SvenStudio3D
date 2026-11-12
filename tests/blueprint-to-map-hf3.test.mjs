import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('../node_modules/typescript/lib/typescript.js');
require.extensions['.ts']=(module,filename)=>{const source=readFileSync(filename,'utf8');const result=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,allowImportingTsExtensions:true}});module._compile(result.outputText,filename)};
const {initialBlueprint,blueprintWallConnections,buildBlueprintBrushes,snapBlueprintPoint,repairBlueprintWallConnections,addBlueprintOpening,saveBlueprintToProject,saveBlueprintDraftToProject,exportBlueprintAsset,importBlueprintAsset}=require('../src/engine/blueprintToMap.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const room=(id,points)=>({id,kind:'room',name:id,points,openings:[],floor:false,ceiling:false});
const wall=(id,points)=>({id,kind:'wall',name:id,points,openings:[],floor:false,ceiling:false});
const setup=(...strokes)=>({...initialBlueprint(),strokes,imageWidth:1200,imageHeight:1200,unitsPerPixel:1,origin:[0,0]});
const project=()=>({version:1,target:'svengine',name:'HF3',objects:[],world:{classname:'worldspawn'},wadNames:['svstudio.wad']});
const assertMap=(plan)=>{
  const brushes=buildBlueprintBrushes(plan);
  assert.deepEqual(brushes.flatMap(validateBrush),[]);
  const p=saveBlueprintToProject(project(),plan).project;
  const imp=inspectMapImport(exportMap(p),'hf3-validation');
  assert.equal(imp.report.importedBrushes,brushes.length);
  return brushes;
};
const ab=(id='a')=>room(id,[[100,100],[300,100],[300,300],[100,300]]);
const bc=(id='b')=>room(id,[[300,100],[500,100],[500,300],[300,300]]);
const bounds=(brush)=>{
  const pts=brush.vertices.map(([x,y,z])=>[x+brush.position[0],y+brush.position[1],z+brush.position[2]]);
  return [Math.min(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[1]))];
};
const occupied=(brushes,x,y,z=70)=>brushes.filter(b=>{const [x0,x1,y0,y1]=bounds(b);return x-600>x0+0.001&&x-600<x1-.001&&600-y>y0+.001&&600-y<y1-.001&&b.position[2]+Math.min(...b.vertices.map(p=>p[2]))<z&&b.position[2]+Math.max(...b.vertices.map(p=>p[2]))>z;});

test('adjacent rooms create ONE shared wall, and fewer brushes than HF2',()=>{
  const b=setup(ab(),bc());const stats=blueprintWallConnections(b);
  assert.equal(stats.sharedSections,1);
  assert.ok(stats.sharedLength>199.99);
  const smart=assertMap(b);
  const legacy=buildBlueprintBrushes({...b,smartWalls:false});
  assert.ok(smart.length<legacy.length,`${smart.length} vs ${legacy.length}`);
  assert.equal(occupied(smart,300,200).length,1,'only one physical wall at shared seam');
});
test('partial shared segment is merged, with walls generated on leftover portions',()=>{
  const b=setup(ab(),room('short',[[300,150],[480,150],[480,250],[300,250]]));
  const stats=blueprintWallConnections(b);assert.equal(Math.round(stats.sharedLength),100);
  const smart=assertMap(b);
  assert.equal(occupied(smart,300,200).length,1);
  assert.equal(occupied(smart,300,120).length,1);
  assert.equal(occupied(smart,300,280).length,1);
});
test('three adjacent rooms keep shared seams, permit deleting a middle room',()=>{
  const b=setup(ab(),bc(),room('c',[[500,100],[700,100],[700,300],[500,300]]));
  const one=assertMap(b);
  assert.equal(occupied(one,300,200).length,1);
  assert.equal(occupied(one,500,200).length,1);
  const without=assertMap({...b,strokes:[b.strokes[0],b.strokes[2]]});
  assert.equal(occupied(without,300,200).length,1,'remaining room still owns its boundary');
  assert.equal(occupied(without,500,200).length,1);
});
test('T connection trims the terminating arm against continuous wall',()=>{
  const b=setup(wall('main',[[100,200],[500,200]]),wall('stem',[[300,200],[300,400]]));
  const smart=assertMap(b);
  assert.equal(occupied(smart,300,200).length,1);
  assert.equal(occupied(smart,300,210).length,1);
  assert.ok(blueprintWallConnections(b).junctions>=1);
});
test('X crossing has only one wall through its center, with convex split branches',()=>{
  const b=setup(wall('cross1',[[100,200],[500,200]]),wall('cross2',[[300,0],[300,400]]));
  const smart=assertMap(b);
  assert.equal(occupied(smart,300,200).length,1);
  assert.equal(occupied(smart,300,160).length,1);
  assert.equal(occupied(smart,300,240).length,1);
});
test('shared door is cut ONCE and keeps both room references editable',()=>{
  const b=addBlueprintOpening(setup(ab(),bc()),'a',1,{kind:'door',t:.5,width:64,height:112,sill:0});
  assert.equal(b.strokes[0].openings.length,1);
  assert.equal(b.strokes[1].openings.length,1);
  const smart=assertMap(b);
  assert.equal(occupied(smart,300,200).length,0,'door fully cuts common wall at player height');
  assert.equal(occupied(smart,300,150).length,1,'jamb outside door retains exactly one wall');
});
test('shared opening can be stored on only ONE side; regenerated wall still contains hole',()=>{
  const b=setup(ab(),bc());b.strokes[0].openings.push({id:'d1',edge:1,kind:'door',t:.5,width:64,height:112,sill:0});
  assert.equal(occupied(assertMap(b),300,200).length,0);
});
test('conflicting two-sided openings are rejected safely without mutating the project',()=>{
  const b=setup(ab(),bc());b.strokes[0].openings.push({id:'d1',edge:1,kind:'door',t:.5,width:64,height:112,sill:0});
  b.strokes[1].openings.push({id:'d2',edge:3,kind:'door',t:.5,width:80,height:112,sill:0});
  assert.throws(()=>saveBlueprintToProject(project(),b),/different door\/window dimensions/);
});
test('magnetic new-room snap chooses existing vertices and wall centerlines',()=>{
  const b=setup(ab());
  const point=snapBlueprintPoint(b,[304,104],8);
  assert.deepEqual(point,[300,100]);
  const middle=snapBlueprintPoint(b,[305,186],8);
  assert.deepEqual(middle,[300,186]);
  assert.deepEqual(snapBlueprintPoint({...b,smartWalls:false},[304,104],8),[304,104]);
  assert.deepEqual(snapBlueprintPoint(b,[304,104],8,'a'),[304,104]);
});
test('repair aligns a newer room to the older anchor, never exchanging positions',()=>{
  const b=setup(ab(),room('offset',[[304,100],[504,100],[504,300],[304,300]]));
  const after=repairBlueprintWallConnections(b,8);
  assert.deepEqual(after.strokes[0].points,b.strokes[0].points);
  assert.deepEqual(after.strokes[1].points[0],[300,100]);
  assert.deepEqual(after.strokes[1].points[3],[300,300]);
  assert.ok(blueprintWallConnections(after).sharedLength>199);
  assertMap(after);
});
test('repair rejects a destructive edit and leaves original untouched',()=>{
  const b=setup(ab(),room('offset',[[303,100],[503,100],[503,300],[303,300]]));
  b.strokes[1].openings.push({id:'d2',kind:'door',edge:3,t:.01,width:90,height:96,sill:0});
  const before=structuredClone(b);
  assert.throws(()=>repairBlueprintWallConnections(b,8));
  assert.deepEqual(b,before);
});
test('shared settings survive draft, project JSON and standalone document roundtrips',()=>{
  const b=setup(ab(),bc());b.smartWalls=true;
  const saved=saveBlueprintDraftToProject(project(),b);
  const imported=validateProjectFile(JSON.parse(JSON.stringify(saved)));
  assert.equal(imported.blueprintPlans[0].smartWalls,true);
  const asset=exportBlueprintAsset(imported.blueprintPlans[0]);
  assert.equal(importBlueprintAsset(asset).smartWalls,true);
  assertMap(b);
  assertMap({...b,smartWalls:undefined}); // legacy HF2 document enables smart by default
});

test('rotated neighboring room layouts keep one shared wall for many angles/scales',()=>{
  for(let deg=0;deg<360;deg+=15){
    for(const scale of [.6,1,2]){
      const angle=deg*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
      const rotate=([x,y])=>[600+(x-300)*scale*c-(y-200)*scale*s,600+(x-300)*scale*s+(y-200)*scale*c];
      const p=setup(room('r1',[[100,100],[300,100],[300,300],[100,300]].map(rotate)),
        room('r2',[[300,100],[500,100],[500,300],[300,300]].map(rotate)));
      const stats=blueprintWallConnections(p);
      assert.ok(stats.sharedLength>190*scale,`${deg} deg ×${scale}: ${stats.sharedLength}`);
      const brushes=buildBlueprintBrushes(p);
      assert.ok(brushes.length<=8);
      assert.deepEqual(brushes.flatMap(validateBrush),[],`${deg} ×${scale}`);
    }
  }
});
test('true parallel nearby walls are NOT silently combined; explicit repair is required',()=>{
  const p=setup(ab(),room('near',[[304,100],[504,100],[504,300],[304,300]]));
  assert.equal(blueprintWallConnections(p).sharedLength,0);
  const after=repairBlueprintWallConnections(p,8);
  assert.ok(blueprintWallConnections(after).sharedLength>=199);
});
test('HF3 document can regenerate safely without duplicating brushes; manual edits block replacement',()=>{
  const p=setup(ab(),bc());
  const initial=saveBlueprintToProject(project(),p).project;
  const previous=initial.objects.length;
  const edited={...structuredClone(initial.blueprintPlans[0]),wallHeight:256};
  const next=saveBlueprintToProject(saveBlueprintDraftToProject(initial,edited),edited).project;
  assert.equal(next.objects.length,previous);
  assert.equal(next.blueprintPlans.length,1);
  const protectedVersion=structuredClone(next);
  protectedVersion.objects[0].position[0]+=16;
  assert.throws(()=>saveBlueprintToProject(protectedVersion,{...edited,wallHeight:320}),/manually edited/);
});
test('smart wall mode avoids duplicate openings even if one owner is reverse-orientated',()=>{
  const p=setup(ab(),bc());
  p.strokes[0].openings=[{id:'da',kind:'door',edge:1,t:.5,width:56,height:104,sill:0}];
  p.strokes[1].openings=[{id:'db',kind:'door',edge:3,t:.5,width:56,height:104,sill:0}];
  const brushes=assertMap(p);
  assert.equal(occupied(brushes,300,200).length,0);
  assert.equal(occupied(brushes,300,140).length,1);
});
