const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {useEditor,demoProject}=require('../src/store.ts');
const {createMissionPreset,createEventPreset,stageCompleteName,stageFailureName,eventTargetName}=require('../src/engine/missionEvents.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const {exportMap,validateExportIntegrity}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
let n=0;const run=(label,fn)=>{fn();n++;console.log('PASS',label)};
useEditor.getState().loadProject(demoProject());
let plan=createMissionPreset('infiltration');plan.stages[0].requiredActivations=2;plan.stages[0].failStageId=plan.stages[2].id;
plan.stages[0].failureOutput='alarm_system';plan.stages[1].nextStageId='__end__';plan.stages[1].output='exit_relay';
useEditor.getState().saveMissionPlan(plan);
run('store generates counter and dual-output failure manager',()=>{
 const p=useEditor.getState().project;
 const counter=p.objects.find(o=>o.kind==='entity'&&o.props.targetname===stageCompleteName(plan.stages[0].id));
 const failure=p.objects.find(o=>o.kind==='entity'&&o.props.targetname===stageFailureName(plan.stages[0].id));
 assert.equal(counter.classname,'game_counter');assert.equal(counter.props.health,'2');
 assert.equal(failure.classname,'multi_manager');assert.equal(failure.props.alarm_system,'0');
});
run('native MAP export/import supports branched mission and counter',()=>{
 const p=useEditor.getState().project;assert.deepEqual(validateExportIntegrity(p),[]);
 const map=exportMap(p);assert.match(map,/"classname" "game_counter"/);assert.match(map,/"health" "2"/);
 assert.match(map,/"classname" "multi_manager"/);assert.ok(inspectMapImport(map));
});
run('metadata JSON validation accepts new fields',()=>{
 const parsed=JSON.parse(JSON.stringify(useEditor.getState().project));const valid=validateProjectFile(parsed);
 assert.equal(valid.missionPlans[0].stages[0].requiredActivations,2);
 assert.equal(valid.missionPlans[0].stages[0].failStageId,plan.stages[2].id);
});
run('undo and redo preserve branch metadata in one operation',()=>{
 useEditor.getState().undo();assert.equal(useEditor.getState().project.missionPlans?.length||0,0);
 useEditor.getState().redo();assert.equal(useEditor.getState().project.missionPlans[0].stages[0].requiredActivations,2);
});
run('event sequence referencing mission failure relay can be created',()=>{
 const ev=createEventPreset('blank');ev.cues=[{id:'one',at:2,target:stageFailureName(plan.stages[0].id),mode:'on',note:''}];
 useEditor.getState().saveEventSequence(ev);
 assert.ok(useEditor.getState().project.eventSequences.some(s=>s.id===ev.id));
});
run('guard refuses to delete a referenced mission',()=>{
 assert.throws(()=>useEditor.getState().removeMissionPlan(plan.id),/still referenced/);
});
run('replacing an event with no old-target references is safe and MAP undoable',()=>{
 const p=useEditor.getState().project;const event=p.eventSequences[0];
 useEditor.getState().saveEventSequence({...event,name:'Changed event'});
 assert.equal(useEditor.getState().project.eventSequences[0].name,'Changed event');
 useEditor.getState().undo();assert.equal(useEditor.getState().project.eventSequences[0].name,event.name);
});
console.log(`Mission / Events 2.0 integrated: ${n} checks passed`);
