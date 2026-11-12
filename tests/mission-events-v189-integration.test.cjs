const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,file);
const {useEditor,demoProject}=require('../src/store.ts');
const {createMissionPreset,createEventPreset,stageCompleteName,eventTargetName}=require('../src/engine/missionEvents.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const {exportMap}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {validateExportIntegrity}=require('../src/engine/exportMap.ts');
let count=0;
function run(name,fn){fn();count++;console.log(`PASS ${name}`)}
useEditor.getState().loadProject(demoProject());
let event=createEventPreset('blank');event.name='Fire alarm';event.cues=[{id:'cue1',target:'alarm_bell',at:1.5,mode:'on',note:''}];
useEditor.getState().saveEventSequence(event);
run('store creates and records event manager',()=>{
 const p=useEditor.getState().project;assert.equal(p.eventSequences.length,1);
 assert.equal(p.objects.filter(o=>o.kind==='entity'&&o.classname==='multi_manager').length,1);
 assert.equal(p.objects.find(o=>o.props?.targetname===eventTargetName(event.id)).props.alarm_bell,'1.5#1');
});
let mission=createMissionPreset('infiltration');mission.stages[0].sequenceId=event.id;
useEditor.getState().saveMissionPlan(mission);
run('mission stage calls linked event manager',()=>{
 const p=useEditor.getState().project;
 assert.ok(p.objects.some(o=>o.kind==='entity'&&o.classname==='multi_manager'&&o.props[eventTargetName(event.id)]==='0.15'));
 assert.equal(p.missionPlans.length,1);
});
run('MAP export contains real point entities and reimports',()=>{
 const p=useEditor.getState().project;
 assert.deepEqual(validateExportIntegrity(p),[]);
 const map=exportMap(p);
 assert.match(map,/"classname" "game_text"/);assert.match(map,/"classname" "trigger_relay"/);
 assert.match(map,/"classname" "multi_manager"/);assert.match(map,/"classname" "trigger_auto"/);
 assert.match(map,/"alarm_bell" "1.5#1"/);
 const imported=inspectMapImport(map);assert.ok(imported);
});
run('saved mission and sequence metadata survive strict JSON import validator',()=>{
 const p=JSON.parse(JSON.stringify(useEditor.getState().project));
 assert.equal(validateProjectFile(p).missionPlans.length,1);
 assert.equal(validateProjectFile(p).eventSequences.length,1);
});
run('one MAP undo removes mission plus native entity graph',()=>{
 const prev=useEditor.getState().project;
 useEditor.getState().undo();const p=useEditor.getState().project;
 assert.equal(p.missionPlans?.length||0,0);
 assert.ok(!p.objects.some(o=>o.kind==='entity'&&o.props.targetname===stageCompleteName(mission.stages[0].id)));
 useEditor.getState().redo();assert.equal(useEditor.getState().project.objects.length,prev.objects.length);
});
run('manual target change blocks destructive regen',()=>{
 const p=useEditor.getState().project;const target=p.missionPlans[0].memberIds[0];
 useEditor.getState().setObjectProp(target,'target','manually_changed');
 assert.throws(()=>useEditor.getState().saveMissionPlan(p.missionPlans[0]),/modified or removed/);
 assert.throws(()=>useEditor.getState().removeMissionPlan(mission.id),/changed/);
 useEditor.getState().undo();
});
run('unlink required before removing event sequence',()=>{
 assert.throws(()=>useEditor.getState().removeEventSequence(event.id),/referenced/);
 const p=useEditor.getState().project;const next={...p.missionPlans[0],stages:p.missionPlans[0].stages.map(s=>({...s,sequenceId:''}))};
 useEditor.getState().saveMissionPlan(next);
 useEditor.getState().removeEventSequence(event.id);
 assert.equal(useEditor.getState().project.eventSequences.length,0);
});
console.log(`Mission / Events integrated store and MAP roundtrip: ${count} checks passed`);
