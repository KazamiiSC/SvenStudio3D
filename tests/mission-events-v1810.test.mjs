import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sv-mission-v1810-'));
for(const name of ['types','missionEvents']){
 const source=fs.readFileSync(new URL(`../src/engine/${name}.ts`,import.meta.url),'utf8');
 fs.writeFileSync(path.join(tmp,`${name}.mjs`),ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replaceAll("from './types'","from './types.mjs'"));
}
const m=await import(pathToFileURL(path.join(tmp,'missionEvents.mjs')));
const base=()=>({version:1,name:'test',objects:[],world:{classname:'worldspawn'},wadNames:[],target:'svengine'});
const mission=()=>m.createMissionPreset('infiltration');
const point=(id,name)=>({id,kind:'entity',classname:'trigger_relay',name:'trigger_relay',position:[0,0,96],props:{targetname:name}});
test('success branch overrides sequential objective',()=>{
 const plan=mission();plan.stages[0].nextStageId=plan.stages[2].id;
 const native=m.createMissionEntities(plan);
 const finish=native.find(e=>e.props.targetname===m.stageCompleteName(plan.stages[0].id));
 assert.equal(finish.props.target,m.stageStartName(plan.stages[2].id));
 assert.ok(m.missionIssues(plan,base()).some(i=>i.level==='warning'&&i.message.includes('unreachable')));
});
test('end branch finishes even with later stages',()=>{
 const plan=mission();plan.stages[0].nextStageId='__end__';plan.stages[0].output='finish_map';
 const finish=m.createMissionEntities(plan).find(e=>e.props.targetname===m.stageCompleteName(plan.stages[0].id));
 assert.equal(finish.props.target,'finish_map');
});
test('trigger count generates a single-use native game_counter',()=>{
 const plan=mission();plan.stages[0].requiredActivations=3;
 const native=m.createMissionEntities(plan).find(e=>e.props.targetname===m.stageCompleteName(plan.stages[0].id));
 assert.equal(native.classname,'game_counter');assert.equal(native.props.health,'3');assert.equal(native.props.frags,'0');assert.equal(native.props.spawnflags,'1');
 const initial=m.newMissionSimulation(plan),one=m.stepMissionSimulation(plan,initial,'complete');
 assert.equal(one.activeId,plan.stages[0].id);assert.equal(one.counts[plan.stages[0].id],1);
 const two=m.stepMissionSimulation(plan,one,'complete');assert.equal(two.activeId,plan.stages[0].id);
 const three=m.stepMissionSimulation(plan,two,'complete');assert.equal(three.activeId,plan.stages[1].id);
});
test('failure relay routes to a stage and optional external output',()=>{
 const plan=mission();plan.stages[0].failStageId=plan.stages[2].id;plan.stages[0].failureOutput='alarm_start';
 const native=m.createMissionEntities(plan).find(e=>e.props.targetname===m.stageFailureName(plan.stages[0].id));
 assert.equal(native.classname,'multi_manager');assert.equal(native.props[m.stageStartName(plan.stages[2].id)],'0');assert.equal(native.props.alarm_start,'0');
 const result=m.stepMissionSimulation(plan,m.newMissionSimulation(plan),'fail');
 assert.equal(result.activeId,plan.stages[2].id);assert.ok(result.history.some(h=>h.target==='alarm_start'));
});
test('cycles and missing stage references stop save',()=>{
 const plan=mission();plan.stages[1].nextStageId=plan.stages[0].id;
 assert.ok(m.missionIssues(plan,base()).some(i=>i.level==='error'&&i.message.includes('cycle')));
 assert.equal(m.missionGraph(plan).cycles.length>0,true);
 plan.stages[1].nextStageId='not_found';
 assert.ok(m.missionIssues(plan,base()).some(i=>i.level==='error'&&i.message.includes('missing')));
});
test('self branch and bad count are errors',()=>{
 const plan=mission();plan.stages[0].nextStageId=plan.stages[0].id;plan.stages[1].requiredActivations=17;
 const issues=m.missionIssues(plan,base());assert.ok(issues.filter(i=>i.level==='error').length>=2);
});
test('optional design annotation does not fabricate gate entities',()=>{
 const plan=mission();plan.stages[1].optional=true;
 const baseline=m.createMissionEntities(mission()).length;
 assert.equal(m.createMissionEntities(plan).length,baseline);
});
test('new metadata survives JSON validation; old metadata remains valid',()=>{
 const plan=mission();plan.stages[0].requiredActivations=4;plan.stages[0].failStageId=plan.stages[2].id;plan.stages[0].optional=true;
 let project=m.applyRecord(base(),plan,'mission').project;
 assert.doesNotThrow(()=>m.validateMissionEventMetadata(JSON.parse(JSON.stringify(project))));
 const old=mission();project=m.applyRecord(base(),old,'mission').project;
 assert.doesNotThrow(()=>m.validateMissionEventMetadata(JSON.parse(JSON.stringify(project))));
 const invalid=JSON.parse(JSON.stringify(project));invalid.missionPlans[0].stages[0].requiredActivations=NaN;
 assert.throws(()=>m.validateMissionEventMetadata(invalid));
});
test('branch targets cannot be changed when their generated entity was edited manually',()=>{
 const plan=mission();plan.stages[0].failStageId=plan.stages[2].id;
 const saved=m.applyRecord(base(),plan,'mission').project;
 const damaged={...saved,objects:saved.objects.map((o,i)=>i===0?{...o,props:{...o.props,target:'hijacked'}}:o)};
 assert.throws(()=>m.applyRecord(damaged,{...saved.missionPlans[0],name:'changed'},'mission'),/modified/);
});
test('timeline inspection sorted by timestamp, highlights missing targets, does not modify project',()=>{
 const sequence=m.createEventPreset('blank');sequence.cues=[
  {id:'later',at:8,target:'sound',mode:'on',note:''},
  {id:'first',at:1,target:'alarm',mode:'off',note:''},
  {id:'last',at:4,target:'door',mode:'toggle',note:''}];
 const project={...base(),objects:[point('1','alarm'),point('2','door')]};
 const before=JSON.stringify(project);const inspected=m.inspectEventTimeline(sequence,5,project);
 assert.deepEqual(inspected.map(i=>i.cue.id),['first','last']);assert.deepEqual(inspected.map(i=>i.exists),[true,true]);
 assert.equal(JSON.stringify(project),before);
 assert.deepEqual(m.inspectEventTimeline(sequence,10,project).map(i=>i.exists),[true,true,false]);
});
test('all mission stage error branches and event manager survive native file export limits',()=>{
 const plan=mission();for(let i=0;i<plan.stages.length-1;i++)plan.stages[i].failureOutput=`alarm_${i}`;
 const project=m.applyRecord(base(),plan,'mission').project;
 assert.equal(project.missionPlans[0].memberIds.length,4*4+3+1);
 assert.doesNotThrow(()=>m.validateMissionEventMetadata(project));
});
test('generated failure target is known to Event Studio after save',()=>{
 const plan=mission();plan.stages[0].failureOutput='alarm_0';
 const project=m.applyRecord(base(),plan,'mission').project;
 const name=m.stageFailureName(plan.stages[0].id);const cue=[{id:'1',at:1,target:name,mode:'on',note:''}];
 assert.deepEqual(m.cueIssues(cue,project).filter(i=>i.level==='warning'),[]);
});
test('UI has map picker, timeline drag and logic inspector hooks without adding duplicate studios',()=>{
 const src=fs.readFileSync(new URL('../src/components/MissionEventsStudio.tsx',import.meta.url),'utf8');
 for(const part of ['me-map-pick-layer','onPointerMove','missionSim','finishDrag','startPick','simComplete','requiredActivations','failStageId'])assert.ok(src.includes(part),part);
});

test('duplicated mission preserves branch topology but not any generated provenance',()=>{
 const plan=mission();plan.stages[0].nextStageId=plan.stages[2].id;plan.stages[1].failStageId=plan.stages[3].id;
 const duplicate=m.duplicateMissionPlan(plan);
 assert.notEqual(duplicate.id,plan.id);assert.equal(duplicate.memberIds.length,0);
 assert.notDeepEqual(duplicate.stages.map(s=>s.id),plan.stages.map(s=>s.id));
 assert.equal(duplicate.stages[0].nextStageId,duplicate.stages[2].id);
 assert.equal(duplicate.stages[1].failStageId,duplicate.stages[3].id);
 assert.ok(!m.missionIssues(duplicate,base()).some(i=>i.level==='error'));
});
test('duplicated event creates new native target and cue identities',()=>{
 const event=m.createEventPreset('alarm'),cloned=m.duplicateEventSequence(event);
 assert.notEqual(m.eventTargetName(event.id),m.eventTargetName(cloned.id));
 assert.deepEqual(cloned.cues.map(c=>c.target),event.cues.map(c=>c.target));
 assert.ok(cloned.cues.every((c,i)=>c.id!==event.cues[i].id));
 assert.doesNotThrow(()=>m.applyRecord(base(),cloned,'event'));
});
test('event sequences reject indirect trigger loops',()=>{
 const a=m.createEventPreset('blank'),b=m.createEventPreset('blank');
 a.cues=[{id:'a',at:0,target:m.eventTargetName(b.id),mode:'toggle',note:''}];
 b.cues=[{id:'b',at:0,target:m.eventTargetName(a.id),mode:'toggle',note:''}];
 const project={...base(),eventSequences:[a,b]};
 assert.ok(m.cueIssues(a.cues,project,a.id).some(i=>i.level==='error'&&i.message.includes('cycle')));
 b.cues=[];
 assert.ok(!m.cueIssues(a.cues,{...base(),eventSequences:[a,b]},a.id).some(i=>i.level==='error'));
});
test('saving a branch update protects referenced targets that would disappear',()=>{
 const plan=mission();plan.stages[0].failureOutput='alarm';
 const project=m.applyRecord(base(),plan,'mission').project;
 const downstream=m.stageFailureName(plan.stages[0].id);
 const event=m.createEventPreset('blank');event.cues=[{id:'e',at:0,target:downstream,mode:'on',note:''}];
 const withEvent=m.applyRecord(project,event,'event').project;
 const updated={...plan,stages:plan.stages.map((s,i)=>i?{...s}:{...s,failureOutput:''})};
 assert.throws(()=>m.applyRecord(withEvent,updated,'mission'),/still referenced/);
 assert.throws(()=>m.removeRecord(withEvent,plan.id,'mission'),/still referenced/);
 assert.equal(m.removeRecord(withEvent,plan.id,'mission',true).objects.length,withEvent.objects.length);
});
test('event dependency blocks deletion when another native sequence targets it',()=>{
 const first=m.createEventPreset('blank'),second=m.createEventPreset('blank');
 let project=m.applyRecord(base(),first,'event').project;
 second.cues=[{id:'a',at:1,target:m.eventTargetName(first.id),mode:'toggle',note:''}];
 project=m.applyRecord(project,second,'event').project;
 assert.throws(()=>m.removeRecord(project,first.id,'event'),/still referenced/);
});
