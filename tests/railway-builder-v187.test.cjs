const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {createRailwayExtras,checkRailwayGraph,railwayEntitySignature,validateRailwaySettings}=require('../src/engine/railwayBuilder.ts');
const {createPathStructureBrushes}=require('../src/engine/pathStructures.ts');
const {exportMap,validateBrush}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {useEditor,demoProject}=require('../src/store.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const {terrainBrushMatchesSignature}=require('../src/engine/terrain.ts');
let count=0;
function run(name,fn){try{fn();count++;console.log('PASS',name)}catch(err){console.error('FAIL',name);throw err}}
function options(extra={}){return {kind:'rail',name:'Railway test',width:96,height:96,wallThickness:8,texture:'SV_BRICK01',repeatSpacing:128,
  smooth:true,subdivisions:5,points:[[0,0,0],[256,0,0],[512,128,64]],railway:{prefix:'rail_test_187',...extra}}}
run('Native path_track network follows sampled curve with connected targets',()=>{
 const o=options(),b=createRailwayExtras(o,true),nodes=b.entities.filter(e=>e.classname==='path_track');
 assert.ok(nodes.length>=o.points.length);
 assert.equal(nodes[0].props.targetname,'rail_test_187_p1');
 assert.equal(nodes[0].props.target,nodes[1].props.targetname);
 assert.equal(nodes.at(-1).props.target,undefined);
 assert.deepEqual(checkRailwayGraph(b.entities),[]);
});
run('Turnout sets altpath and produces physical branch and switch',()=>{
 const o=options({branch:true,branchNode:1,branchSide:'right'}),b=createRailwayExtras(o,true);
 assert.ok(b.brushes.length>5);
 const j=b.entities.find(e=>e.props.altpath);
 assert.equal(j.props.altpath,'rail_test_187_b1');
 assert.ok(b.entities.some(e=>e.classname==='func_button'&&e.props.target===j.props.targetname));
 assert.deepEqual(checkRailwayGraph(b.entities),[]);
});
run('Double railway creates valid MAP brushes',()=>{
 const o=options({doubleTrack:true,parallelSpacing:224});const b=createRailwayExtras(o,true);
 assert.ok(b.brushes.length>4);for(const brush of b.brushes)assert.deepEqual(validateBrush(brush),[],brush.name);
});
run('Station includes a valid angled platform brush',()=>{
 const o=options({station:true,stationNode:1,stationSide:'left',platformLength:192,platformWidth:96});const b=createRailwayExtras(o,true);
 assert.ok(b.brushes.some(x=>x.name.includes('station platform')));
 assert.equal(b.entities.some(e=>e.classname==='func_traincontrols'),false);
});
run('Train has func_tracktrain, ORIGIN brush and func_traincontrols',()=>{
 const b=createRailwayExtras(options({train:true,trainControls:true,trainLength:96,trainSpeed:180}),true);
 const train=b.entities.find(e=>e.classname==='func_tracktrain');const control=b.entities.find(e=>e.classname==='func_traincontrols');
 assert.ok(train&&control);assert.equal(train.props.target,'rail_test_187_p1');
 assert.equal(control.props.target,train.props.targetname);
 const origin=b.brushes.find(x=>x.faces.every(f=>f.texture==='ORIGIN'));
 assert.ok(origin);assert.equal(origin.entityId,train.id);
 assert.ok(b.brushes.some(x=>x.entityId===control.id));
 assert.deepEqual(checkRailwayGraph(b.entities),[]);
});
run('Combined station/switch/train/double track exports and reimports full Valve 220 map',()=>{
 const o=options({station:true,doubleTrack:true,train:true,branch:true,stationNode:1,branchNode:0,trainControls:true});
 const geo=createPathStructureBrushes(o,true),extra=createRailwayExtras(o,true);
 const project=demoProject();project.objects.push(...geo,...extra.brushes,...extra.entities);
 const map=exportMap(project);assert.match(map,/"classname" "func_tracktrain"/);
 assert.match(map,/"classname" "func_traincontrols"/);assert.match(map,/"altpath"/);
 assert.match(map,/ ORIGIN /);
 const imported=inspectMapImport(map);assert.ok(imported);
});
run('Stored railway can be modified without losing native nodes',()=>{
 useEditor.getState().loadProject(demoProject());const o=options({station:true,branch:true,train:true});
 useEditor.getState().addPathStructure(o,[0,0,0]);let project=useEditor.getState().project;
 assert.equal(project.pathGroups.length,1);
 const saved=project.pathGroups[0];assert.ok(saved.entityIds.length>5);
 assert.ok(saved.entityIds.every((id,i)=>{
  const e=project.objects.find(obj=>obj.id===id);return e&&railwayEntitySignature(e)===saved.entitySignatures[i];
 }));
 assert.ok(saved.brushIds.every((id,i)=>terrainBrushMatchesSignature(project.objects.find(obj=>obj.id===id),saved.signatures[i])));
 assert.deepEqual(validateProjectFile(project),project);
 const updated={...o,points:[[0,0,0],[256,50,0],[512,128,64]]};
 useEditor.getState().updatePathStructure(saved.id,updated);
 project=useEditor.getState().project;
 assert.equal(project.pathGroups[0].options.points[1][1],50);
 assert.equal(project.objects.filter(x=>x.kind==='entity'&&x.props.targetname?.startsWith('rail_test_187')).length,
  new Set(project.objects.filter(x=>x.kind==='entity'&&x.props.targetname?.startsWith('rail_test_187')).map(x=>x.props.targetname)).size);
 useEditor.getState().undo();
 assert.deepEqual(useEditor.getState().project.pathGroups[0].options.points,o.points);
});
run('Editing railway entities blocks destructive regeneration',()=>{
 const state=useEditor.getState(),rec=state.project.pathGroups[0];
 const ent=state.project.objects.find(o=>o.id===rec.entityIds[0]);
 state.updateObject(ent.id,{props:{...ent.props,targetname:'modified_by_user'}});
 const before=JSON.stringify(useEditor.getState().project);
 assert.throws(()=>state.updatePathStructure(rec.id,{...rec.options,points:[[0,0,0],[300,0,0],[512,128,64]]}),/entities were changed/i);
 assert.equal(JSON.stringify(useEditor.getState().project),before);
});
run('Reject malformed network names or out-of-range switches',()=>{
 assert.ok(validateRailwaySettings({prefix:'bad !',branch:true},options().points).length);
 assert.ok(validateRailwaySettings({prefix:'rail_valid',branchNode:99},options().points).length);
});
run('Two networks with same prefix are rejected rather than producing ambiguous targetnames',()=>{
 useEditor.getState().loadProject(demoProject());useEditor.getState().addPathStructure(options(),[0,0,0]);
 assert.throws(()=>useEditor.getState().addPathStructure(options(),[0,0,0]),/conflicts/i);
});
console.log(`Railway Builder 2.0: ${count} directed checks passed`);
