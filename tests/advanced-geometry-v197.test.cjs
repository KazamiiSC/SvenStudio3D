const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,f);
const {createBrush,transformedVertices}=require('../src/engine/geometry.ts');
const {previewFusion}=require('../src/engine/brushFusion.ts');
const {planWorkshop,workshopFrame}=require('../src/engine/brushWorkshop.ts');
const {buildCurvedRamp,defaultCurveSettings,radialArrayBrushes}=require('../src/engine/curvedGeometry.ts');
const {validateBrush,exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {useEditor}=require('../src/store.ts');
const source=()=>createBrush('box',[0,0,64],[128,128,128],'Wall');
const mapGeometry=objects=>{
 for(const b of objects)assert.deepEqual(validateBrush(b),[],`invalid ${b.name}`);
 const map=exportMap({...useEditor.getState().project,objects});
 const back=inspectMapImport(map,'geometry197.map');assert.equal(back.report.skippedBrushes,0);
 assert.equal(back.project.objects.filter(o=>o.kind==='brush').length,objects.length);
};
test('Smart Fusion only creates a real brush for a convex union with equal surface data',()=>{
 const a=createBrush('box',[0,0,64],[64,64,64]),b=createBrush('box',[64,0,64],[64,64,64]);
 const plan=previewFusion([a,b]);assert.equal(plan.kind,'single');assert.equal(plan.outputCount,1);mapGeometry([plan.merged]);
 const textured={...b,faces:b.faces.map((f,i)=>i===0?{...f,texture:'TEST_WAD'}:f)};
 assert.equal(previewFusion([a,textured]).kind,'composite');
 assert.throws(()=>previewFusion([a,textured],'single'),/texture|UV/i);
});
test('non-convex or disconnected collections preserve all member brushes',()=>{
 const a=createBrush('box',[0,0,64],[64,64,64]),b=createBrush('box',[60,60,64],[64,64,64]);
 assert.equal(previewFusion([a,b]).kind,'composite');
 assert.throws(()=>previewFusion([a,{...b,locked:true}]),/visible, unlocked/i);
});
test('Brush Workshop panel, frame, opening and recess produce valid compiler solids',()=>{
 const src=source();const face=0;
 const frame=workshopFrame(src,face);assert.ok(frame.maxU-frame.minU>70);
 const shape={u:0,v:0,width:48,height:56,depth:12,frame:8};
 for(const op of ['panel','frame','opening','framed-opening','recess']){
  const result=planWorkshop(src,face,op,shape);const solids=[...(result.replacement??[src]),...result.additions];
  assert.ok(solids.length>=1);mapGeometry(solids);
  if(op==='opening')assert.ok(result.replacement.length>=2);
 }
});
test('invalid Workshop cuts never replace the original brush',()=>{
 const src=source();
 assert.throws(()=>planWorkshop(src,0,'opening',{u:0,v:0,width:9000,height:12,depth:20,frame:4}),/dimension|inside/i);
 assert.throws(()=>planWorkshop({...src,locked:true},0,'panel',{u:0,v:0,width:24,height:24,depth:8,frame:4}),/Unlock/i);
});
test('Curved ramps, slopes and steep helixes compile to valid triangular convex prisms',()=>{
 for(const rise of [0,128,-256,512]){
  const opts={...defaultCurveSettings,segments:10,sweep:180,radius:256,rise,origin:[0,0,100]};
  const solids=buildCurvedRamp(opts);assert.equal(solids.length,20);mapGeometry(solids);
 }
});
test('radial arrays preserve source and produce valid rigid copies',()=>{
 const src=source(),copies=radialArrayBrushes([src],{origin:[0,0,400],radius:400,rise:80,sweep:180,startAngle:0,copies:6});
 assert.equal(copies.length,6);assert.notEqual(src.id,copies[0].id);mapGeometry(copies);
});
test('Fusion in store is a reversible single Undo transaction with project metadata',()=>{
 const state=useEditor.getState(),old=structuredClone(state.project);
 try{
  const a=createBrush('box',[0,0,64],[64,64,64]),b=createBrush('box',[64,64,64],[64,64,64]);
  useEditor.setState(s=>({...s,project:{...s.project,objects:[a,b]},selected:a.id,selectedIds:[a.id,b.id],history:[],future:[]}));
  useEditor.getState().fuseSelection('auto');
  let now=useEditor.getState();assert.equal(now.selectedIds.length,2);assert.equal(now.project.brushComposites.length,1);
  now.selectObject(a.id,false);assert.equal(useEditor.getState().selectedIds.length,2);
  now.separateSelectedComposite();assert.equal(useEditor.getState().project.brushComposites.length,0);
  now.undo();assert.equal(useEditor.getState().project.brushComposites.length,1);
 }finally{useEditor.setState(s=>({...s,project:old,selected:null,selectedIds:[],history:[],future:[]}));}
});
test('UI exposes Workshop and World Builder curve tools without duplicating the studio',()=>{
 const root=__dirname+'/../src/';
 for(const p of ['components/QuickToolRail.tsx','components/ViewportExtras.tsx']){
  const s=fs.readFileSync(root+p,'utf8');assert.match(s,/Brush Workshop/);assert.match(s,/World Builder · Curves/);
 }
 const app=fs.readFileSync(root+'App.tsx','utf8');assert.match(app,/dialog==='workshop'/);assert.doesNotMatch(app,/dialog==='curves'/);
 const world=fs.readFileSync(root+'components/TerrainShapeStudio.tsx','utf8');assert.match(world,/CurvedGeometryPanel embedded/);
});

const {validateProjectFile}=require('../src/engine/projectValidation.ts');
test('parametric curved ramp regenerates atomically and protects manual edits',()=>{
 const state=useEditor.getState(),old=structuredClone(state.project);
 try{
  useEditor.setState(s=>({...s,project:{...s.project,objects:[]},selected:null,selectedIds:[],history:[],future:[]}));
  useEditor.getState().createCurvedRamp({...defaultCurveSettings,segments:5});
  let p=useEditor.getState().project;assert.equal(p.curveAssemblies.length,1);
  assert.equal(validateProjectFile(JSON.parse(JSON.stringify(p))).curveAssemblies.length,1);
  const record=p.curveAssemblies[0],oldIds=[...record.memberIds];
  useEditor.getState().updateCurvedRamp(record.id,{...defaultCurveSettings,segments:7,rise:96});
  p=useEditor.getState().project;assert.equal(p.curveAssemblies[0].memberIds.length,14);
  assert.ok(!p.objects.some(o=>oldIds.includes(o.id)));
  // A change to even a single primitive must cancel regeneration without mutation.
  const first=p.curveAssemblies[0].memberIds[0];
  const altered=p.objects.map(o=>o.id===first?{...o,name:'Custom detail',vertices:o.vertices.map((v,i)=>i===0?[v[0]+1,v[1],v[2]]:v)}:o);
  useEditor.setState(s=>({...s,project:{...s.project,objects:altered}}));
  const snapshot=JSON.stringify(useEditor.getState().project);
  assert.throws(()=>useEditor.getState().updateCurvedRamp(record.id,defaultCurveSettings),/manually/);
  assert.equal(JSON.stringify(useEditor.getState().project),snapshot);
  useEditor.getState().detachCurvedRamp(record.id);
  assert.equal(useEditor.getState().project.curveAssemblies.length,0);
 }finally{useEditor.setState(s=>({...s,project:old,selected:null,selectedIds:[],history:[],future:[]}));}
});
test('Brush Workshop store creates attached func_door details and Undo restores source',()=>{
 const state=useEditor.getState(),old=structuredClone(state.project);
 try{
   const door=source();door.entityId='func-door-key';
   useEditor.setState(s=>({...s,project:{...s.project,objects:[door]},selected:door.id,selectedIds:[door.id],history:[],future:[]}));
   useEditor.getState().applyBrushWorkshop(door.id,0,'panel',{u:0,v:0,width:24,height:24,depth:8,frame:4});
   const objects=useEditor.getState().project.objects;assert.equal(objects.length,2);assert.equal(objects[1].entityId,'func-door-key');
   useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.length,1);
 }finally{useEditor.setState(s=>({...s,project:old,selected:null,selectedIds:[],history:[],future:[]}));}
});
test('Fusion metadata roundtrip in JSON preserves previous group names',()=>{
 const state=useEditor.getState(),old=structuredClone(state.project);
 try{
  const a={...createBrush('box',[0,0,64],[64,64,64]),group:'Wall A'},b={...createBrush('box',[80,0,64],[64,64,64]),group:'Wall B'};
  useEditor.setState(s=>({...s,project:{...s.project,objects:[a,b]},selected:a.id,selectedIds:[a.id,b.id],history:[],future:[]}));
  useEditor.getState().fuseSelection('composite');
  let p=validateProjectFile(JSON.parse(JSON.stringify(useEditor.getState().project)));
  assert.equal(p.brushComposites[0].previousGroups[a.id],'Wall A');
  useEditor.getState().separateSelectedComposite();p=useEditor.getState().project;
  assert.equal(p.objects.find(o=>o.id===a.id).group,'Wall A');assert.equal(p.objects.find(o=>o.id===b.id).group,'Wall B');
 }finally{useEditor.setState(s=>({...s,project:old,selected:null,selectedIds:[],history:[],future:[]}));}
});
