import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const e=require('../src/engine/npcEncounters.ts');
const m=require('../src/engine/missionEvents.ts');
const {exportMap,validateBrush}=require('../src/engine/exportMap.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts');
const {createBrush}=require('../src/engine/geometry.ts');
const base=()=>({version:1,target:'svengine',name:'test',world:{classname:'worldspawn'},wadNames:['svstudio.wad'],objects:[]});
const make=()=>e.createEncounterPreset('mixed',[0,0,0]);
const byName=(objects,name)=>objects.find(o=>o.kind==='entity'&&o.props.targetname===name);

test('3-wave chain links first entry, death counters and final native manager',()=>{
 const plan=make(),o=e.buildEncounterObjects(plan);
 assert.ok(byName(o,e.encounterStartName(plan.id)));
 assert.ok(byName(o,e.encounterFinishName(plan.id)));
 assert.equal(o.filter(x=>x.classname==='game_counter').length,3);
 for(const [i,wave] of plan.waves.entries()){
  const count=byName(o,e.waveName(wave.id,'dead'));
  assert.equal(count.classname,'game_counter');assert.equal(count.props.health,String(wave.count));assert.equal(count.props.frags,'0');
  assert.equal(count.props.spawnflags,'1');
  assert.equal(count.props.target,plan.waves[i+1]?e.waveName(plan.waves[i+1].id,'begin'):e.encounterFinishName(plan.id));
  const spawns=o.filter(x=>x.classname==='squadmaker'&&x.props.trigger_target===e.waveName(wave.id,'dead'));
  assert.equal(spawns.reduce((n,s)=>n+Number(s.props.monstercount),0),wave.count);
  assert.ok(spawns.every(s=>s.props.trigger_condition==='4'&&s.props.spawnflags==='32'&&s.props.is_not_revivable==='1'));
  assert.ok(spawns.reduce((n,s)=>n+Number(s.props.m_imaxlivechildren),0)<=wave.maxLive);
 }
});
test('entry trigger has invisible AAATRIGGER brush and owner relationship',()=>{
 const objs=e.buildEncounterObjects(make());const trigger=objs.find(o=>o.classname==='trigger_once');
 assert.ok(trigger);const b=objs.find(o=>o.kind==='brush'&&o.entityId===trigger.id);
 assert.ok(b);assert.ok(b.faces.every(f=>f.texture==='AAATRIGGER'));assert.equal(validateBrush(b).length,0);
 assert.equal(trigger.props.spawnflags,'0');
});
test('manual mode creates no unsolicited auto or entry triggers',()=>{
 const plan=make();plan.start='manual';const objs=e.buildEncounterObjects(plan);
 assert.ok(!objs.some(o=>o.classname==='trigger_once'||o.classname==='trigger_auto'));
 assert.ok(byName(objs,e.encounterStartName(plan.id)));
});
test('auto start is delayed to next server frame',()=>{
 const plan=make();plan.start='auto';const objs=e.buildEncounterObjects(plan);
 assert.equal(objs.find(o=>o.classname==='trigger_auto').props.delay,'0.5');
});
test('wave params clamp max alive without losing total death count',()=>{
 const plan=make();const w=plan.waves[0];w.count=7;w.maxLive=2;w.spawns=[[0,0,64],[100,0,64],[200,0,64],[300,0,64]];
 const group=e.buildEncounterObjects(plan).filter(x=>x.classname==='squadmaker'&&x.props.trigger_target===e.waveName(w.id,'dead'));
 assert.equal(group.length,2);assert.equal(group.reduce((n,s)=>n+Number(s.props.monstercount),0),7);
 assert.equal(group.reduce((n,s)=>n+Number(s.props.m_imaxlivechildren),0),2);
});
test('native output links both final mission objective and existing door',()=>{
 const mission=m.createMissionPreset('blank'),event=m.createEventPreset('blank');
 let p=m.applyRecord(base(),mission,'mission').project;p=m.applyRecord(p,event,'event').project;
 p.objects.push({id:'door',kind:'entity',name:'func_door',classname:'func_door',position:[0,0,0],props:{targetname:'gate'}});
 const plan=make();plan.missionStageId=mission.stages[0].id;plan.completionTarget='gate';plan.waves[0].eventSequenceId=event.id;
 const saved=e.saveEncounter(p,plan),objects=saved.objects;
 const finish=byName(objects,e.encounterFinishName(plan.id));
 assert.equal(finish.props[m.stageCompleteName(mission.stages[0].id)],'0.1');
 assert.equal(finish.props.gate,'0.1');
 assert.ok(byName(objects,e.encounterStartName(plan.id)).props[m.eventTargetName(event.id)]==='0');
});
test('save, resave and remove preserve unrelated objects',()=>{
 const world=createBrush('box',[0,0,-32],[500,500,64]);world.name='Test floor';world.faces.forEach(f=>f.texture='SV_TILE01');
 const orig={...base(),objects:[world]},plan=make();
 const saved=e.saveEncounter(orig,plan);assert.equal(saved.encounterPlans.length,1);
 assert.equal(orig.objects.length,1);
 const resaved=e.saveEncounter(saved,{...saved.encounterPlans[0],name:'Renamed scene'});
 assert.equal(resaved.encounterPlans[0].name,'Renamed scene');assert.ok(resaved.objects.some(x=>x.id===world.id));
 assert.equal(e.removeEncounter(resaved,plan.id).objects.length,1);
 assert.equal(e.removeEncounter(resaved,plan.id).encounterPlans.length,0);
});
test('manual edits and locked objects abort regeneration and removal',()=>{
 const p=e.saveEncounter(base(),make()),enc=p.encounterPlans[0];
 const damaged={...p,objects:p.objects.map(o=>o.id===enc.memberIds[0]?{...o,props:{...o.props,delay:'999'}}:o)};
 assert.throws(()=>e.saveEncounter(damaged,enc),/modified/);
 assert.throws(()=>e.removeEncounter(damaged,enc.id),/modified/);
 const detached=e.removeEncounter(damaged,enc.id,true);assert.equal(detached.objects.length,damaged.objects.length);
});
test('externally referenced deleted wave names cannot be removed silently',()=>{
 const p=e.saveEncounter(base(),make()),enc=p.encounterPlans[0];
 const external={id:'foreign',kind:'entity',classname:'trigger_relay',name:'relay',position:[0,0,64],props:{target:e.waveName(enc.waves[2].id,'begin')}};
 const withLink={...p,objects:[...p.objects,external]};
 const edited={...enc,waves:enc.waves.slice(0,2)};
 assert.throws(()=>e.saveEncounter(withLink,edited),/external links/);
 assert.throws(()=>e.removeEncounter(withLink,enc.id),/still link/);
});
test('Mission and Events protect encounter dependencies even on detach',()=>{
 const mission=m.createMissionPreset('blank'),event=m.createEventPreset('blank');
 let p=m.applyRecord(base(),mission,'mission').project;p=m.applyRecord(p,event,'event').project;
 const enc=make();enc.missionStageId=mission.stages[0].id;enc.waves[0].eventSequenceId=event.id;
 p=e.saveEncounter(p,enc);
 assert.throws(()=>m.removeRecord(p,mission.id,'mission',true),/NPC encounter/);
 assert.throws(()=>m.removeRecord(p,event.id,'event',true),/NPC encounter/);
 const updated={...mission,stages:[{...mission.stages[0],id:'other-stage'}]};
 assert.throws(()=>m.applyRecord(p,updated,'mission'),/NPC encounter/);
});
test('invalid counts, coordinates, links and loops cannot be saved',()=>{
 const plan=make();plan.waves[0].count=0;plan.waves[1].spawns=[[Infinity,0,48]];plan.completionTarget=e.encounterStartName(plan.id);
 const errors=e.encounterIssues(plan,base()).filter(x=>x.level==='error');
 assert.ok(errors.length>=3);assert.throws(()=>e.saveEncounter(base(),plan));
});
test('invalid persisted metadata aborts project load while legacy projects survive',()=>{
 const p=e.saveEncounter(base(),make());assert.doesNotThrow(()=>validateProjectFile(JSON.parse(JSON.stringify(p))));
 assert.doesNotThrow(()=>validateProjectFile(base()));
 const bad=JSON.parse(JSON.stringify(p));bad.encounterPlans[0].waves[0].maxLive=-9;
 assert.throws(()=>validateProjectFile(bad));
});
test('duplicated encounter gets distinct IDs and does not touch original',()=>{
 const p=make(),other=e.duplicateEncounter(p);
 assert.notEqual(p.id,other.id);assert.equal(p.waves.length,other.waves.length);
 assert.ok(other.waves.every((w,i)=>w.id!==p.waves[i].id));
 assert.equal(other.memberIds.length,0);assert.doesNotThrow(()=>e.saveEncounter(base(),other));
});
test('actual Valve 220 roundtrip preserves native encounter points and linked trigger brush',()=>{
 const plan=make();const floor=createBrush('box',[0,0,-32],[1024,1024,64]);floor.faces.forEach(f=>f.texture='SV_TILE01');
 const p=e.saveEncounter({...base(),objects:[floor]},plan);
 const raw=exportMap(p),checked=inspectMapImport(raw,'test.map');
 assert.equal(checked.report.skippedBrushes,0);assert.equal(checked.report.totalBrushes,2);
 assert.ok(checked.project.objects.some(o=>o.kind==='entity'&&o.classname==='squadmaker'));
 assert.ok(checked.project.objects.some(o=>o.kind==='entity'&&o.classname==='game_counter'));
});
test('NPC Studio wires Encounter Designer without duplicating an app-wide Studio',()=>{
 const source=fs.readFileSync(new URL('../src/components/NpcStudio.tsx',import.meta.url),'utf8');
 assert.ok(source.includes('EncounterDesigner'));assert.ok(source.includes('setEncountersOpen(true)'));
});
