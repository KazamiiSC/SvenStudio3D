import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sv-mission-v189-'));
for(const name of ['types','missionEvents']){
 let source=fs.readFileSync(new URL(`../src/engine/${name}.ts`,import.meta.url),'utf8');
 const {outputText}=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}});
 fs.writeFileSync(path.join(tmp,`${name}.mjs`),outputText.replaceAll("from './types'","from './types.mjs'"));
}
const {createMissionPreset,createEventPreset,createMissionEntities,createEventEntities,applyRecord,removeRecord,missionIssues,cueIssues,signature,eventTargetName,stageStartName,stageCompleteName,validateMissionEventMetadata}=await import(pathToFileURL(path.join(tmp,'missionEvents.mjs')));
const base=()=>({version:1,name:'test',objects:[],world:{classname:'worldspawn'},wadNames:[],target:'svengine'});
const mission=()=>createMissionPreset('infiltration');
const sequence=()=>createEventPreset('blank');
const createNative=(id,classname,targetname)=>({id,kind:'entity',classname,name:classname,position:[0,0,64],props:{targetname}});
test('mission preset includes ordered, stable objective relay names',()=>{
 const m=mission();assert.equal(m.stages.length,4);
 const names=m.stages.map(s=>stageCompleteName(s.id));assert.equal(new Set(names).size,4);
 assert.ok(names.every(n=>/^[a-z0-9_]+$/.test(n)));
});
test('native mission graph relays route stage starts, text, and next objectives',()=>{
 const m=mission();const entities=createMissionEntities(m);
 assert.equal(entities.length,m.stages.length*4+1);
 const first=m.stages[0],second=m.stages[1];
 assert.equal(entities.find(e=>e.props.targetname===stageCompleteName(first.id)).props.target,stageStartName(second.id));
 assert.ok(entities.some(e=>e.classname==='game_text'&&e.props.message.includes(first.title)));
 const autostart=entities.find(e=>e.classname==='trigger_auto');assert.equal(autostart.props.target,stageStartName(first.id));assert.equal(autostart.props.delay,'0.5');
});
test('manual start does not generate a trigger_auto',()=>{const m=mission();m.autoStart=false;assert.equal(createMissionEntities(m).length,m.stages.length*4)});
test('event timeline uses per-target delay values and trigger modes',()=>{
 const seq=sequence();seq.cues=[{id:'a',at:0,target:'door_01',mode:'toggle',note:''},{id:'b',at:1.5,target:'lights',mode:'on',note:''},{id:'c',at:2,target:'door_01',mode:'off',note:''},{id:'d',at:3,target:'alarm',mode:'kill',note:''}];
 const mgr=createEventEntities(seq)[0];assert.equal(mgr.classname,'multi_manager');
 assert.equal(mgr.props.door_01,'0');assert.equal(mgr.props.lights,'1.5#1');assert.equal(mgr.props['door_01#1'],'2#0');assert.equal(mgr.props.alarm,'3#2');
});
test('event sequence missing target is warning not silent success',()=>{
 const seq=sequence();seq.cues=[{id:'a',at:2,target:'missing_entity',mode:'toggle',note:''}];
 assert.deepEqual(cueIssues(seq.cues,base(),seq.id).map(i=>i.level),['warning']);
});
test('self-reference, invalid target and out of bounds event are rejected',()=>{
 const seq=sequence();seq.cues=[{id:'a',at:999,target:eventTargetName(seq.id),mode:'toggle',note:''},{id:'b',at:0,target:'bad target',mode:'toggle',note:''}];
 assert.equal(cueIssues(seq.cues,base(),seq.id).filter(x=>x.level==='error').length,3);
});
test('mission reference to event sequence validated by ID',()=>{
 const m=mission();m.stages[0].sequenceId='missing';assert.ok(missionIssues(m,base()).some(x=>x.level==='error'));
});
test('saving a new sequence generates editable native objects in a single project',()=>{
 const s=sequence();s.cues=[{id:'1',at:1,target:'door_1',mode:'toggle',note:''}];
 const out=applyRecord(base(),s,'event');assert.equal(out.project.eventSequences.length,1);
 assert.equal(out.project.objects.length,1);assert.equal(out.record.memberIds.length,1);
 assert.equal(out.record.signatures[0],signature(out.project.objects[0]));
});
test('re-saving a sequence replaces only its previously generated entities',()=>{
 const ext=createNative('ext','func_button','door_1');
 const s=sequence();let p=applyRecord({...base(),objects:[ext]},s,'event').project;
 const oldId=p.eventSequences[0].memberIds[0];
 p=applyRecord(p,{...p.eventSequences[0],name:'changed',cues:[{id:'b',at:2,target:'door_1',mode:'on',note:''}]},'event').project;
 assert.equal(p.objects.length,2);assert.notEqual(p.eventSequences[0].memberIds[0],oldId);
 assert.ok(p.objects.includes(ext));
});
test('mutated native entity cannot be overwritten or destroyed silently',()=>{
 const m=mission();let p=applyRecord(base(),m,'mission').project;
 p={...p,objects:p.objects.map((o,i)=>i===0?{...o,props:{...o.props,target:'manual'}}:o)};
 assert.throws(()=>applyRecord(p,{...p.missionPlans[0],name:'Updated'},'mission'),/modified or removed/);
 assert.throws(()=>removeRecord(p,m.id,'mission'),/changed/);
 assert.equal(removeRecord(p,m.id,'mission',true).objects.length,p.objects.length);
});
test('colliding native targetname blocks generation without changes',()=>{
 const s=sequence();assert.throws(()=>applyRecord({...base(),objects:[createNative('ext','trigger_relay',eventTargetName(s.id))]},s,'event'),/already in use/);
});
test('linked event sequence cannot be deleted without unlinking mission',()=>{
 const s=sequence(),m=mission();m.stages[0].sequenceId=s.id;
 const p={...base(),missionPlans:[m],eventSequences:[{...s,memberIds:[],signatures:[]}]};
 assert.throws(()=>removeRecord(p,s.id,'event'),/referenced/);
});
test('JSON project roundtrip keeps metadata; invalid data fails validation',()=>{
 const s=sequence(),m=mission();let p=applyRecord(base(),s,'event').project;p=applyRecord(p,m,'mission').project;
 const parsed=JSON.parse(JSON.stringify(p));assert.doesNotThrow(()=>validateMissionEventMetadata(parsed));
 assert.equal(parsed.missionPlans.length,1);assert.equal(parsed.eventSequences.length,1);
 parsed.missionPlans[0].stages[0].output='invalid target';assert.throws(()=>validateMissionEventMetadata(parsed),/Invalid project/);
});
test('too many cues or stages fail validation',()=>{
 const s=sequence();s.cues=Array.from({length:49},(_,i)=>({id:String(i),at:0,target:'light',mode:'on',note:''}));assert.ok(cueIssues(s.cues,base()).some(x=>x.level==='error'));
 const m=mission();m.stages=Array.from({length:25},(_,i)=>({...m.stages[0],id:String(i)}));assert.ok(missionIssues(m,base()).some(x=>x.level==='error'));
});
