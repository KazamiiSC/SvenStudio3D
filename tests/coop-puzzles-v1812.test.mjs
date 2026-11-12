import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),ts=require('typescript');
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const z=require('../src/engine/coopPuzzles.ts'),m=require('../src/engine/missionEvents.ts'),n=require('../src/engine/npcEncounters.ts'),d=require('../src/engine/advancedGameplayDiagnostics.ts');
const {validateProjectFile}=require('../src/engine/projectValidation.ts'),{exportMap,validateBrush}=require('../src/engine/exportMap.ts'),{inspectMapImport}=require('../src/engine/importMap.ts');
const base=()=>({version:1,name:'test',target:'svengine',world:{classname:'worldspawn'},objects:[],wadNames:['svstudio.wad']});
const get=(o,name)=>o.find(x=>x.kind==='entity'&&x.props.targetname===name);
test('switch puzzle creates three unique func_button brushes and native game_counter',()=>{
 const p=z.createPuzzlePreset('switches');p.buttons=[[0,0,90],[128,0,90],[256,0,90]];const objs=z.buildPuzzleObjects(p);
 assert.equal(objs.filter(x=>x.classname==='func_button').length,3);
 assert.equal(objs.filter(x=>x.kind==='brush').length,3);
 assert.equal(objs.filter(x=>x.kind==='brush').flatMap(b=>validateBrush(b)).length,0);
 const cnt=get(objs,z.puzzleLogicName(p.id));assert.equal(cnt.classname,'game_counter');assert.equal(cnt.props.health,'3');assert.equal(cnt.props.target,z.puzzleDoneName(p.id));
 for(let i=0;i<3;i++){const btn=get(objs,z.puzzleButtonName(p.id,i));assert.equal(btn.props.target,z.puzzleLogicName(p.id));assert.equal(btn.props.wait,'-1');assert.equal(btn.props.spawnflags,'1');assert.ok(objs.some(b=>b.kind==='brush'&&b.entityId===btn.id));}
});
test('simultaneous puzzle builds timed multi-source, one-shot relay, and no persistent counter',()=>{
 const p=z.createPuzzlePreset('simultaneous');p.window=4;const o=z.buildPuzzleObjects(p);
 assert.equal(o.filter(e=>e.classname==='multisource').length,1);assert.ok(!o.some(e=>e.classname==='game_counter'));
 const gate=get(o,z.puzzleStartName(p.id));assert.equal(gate.classname,'trigger_relay');assert.equal(gate.props.target,z.puzzleDoneName(p.id));assert.equal(gate.props.spawnflags,'1');
 assert.equal(get(o,z.puzzleLogicName(p.id)).props.target,z.puzzleStartName(p.id));assert.ok(o.filter(e=>e.classname==='func_button').every(b=>b.props.wait==='4'));
});
test('linked puzzle fires output door, mission objective and event once through native manager',()=>{
 let project=base();const mission=m.createMissionPreset('blank');project=m.applyRecord(project,mission,'mission').project;
 const event=m.createEventPreset('blank');project=m.applyRecord(project,event,'event').project;
 project.objects.push({kind:'entity',id:'door',classname:'func_door',name:'door',position:[500,0,0],props:{targetname:'gate'}});
 const puzzle=z.createPuzzlePreset();puzzle.missionStageId=mission.stages[0].id;puzzle.eventSequenceId=event.id;puzzle.completionTarget='gate';
 const p=z.savePuzzle(project,puzzle),manager=get(p.objects,z.puzzleDoneName(puzzle.id));
 assert.equal(manager.classname,'multi_manager');assert.equal(manager.props.gate,'0.1');assert.equal(manager.props[m.stageCompleteName(mission.stages[0].id)],'0.1');assert.equal(manager.props[m.eventTargetName(event.id)],'0.1');
});
test('preserves unrelated brushes, supports resave and removing with signature protection',()=>{
 let p=base(),plan=z.createPuzzlePreset();p=z.savePuzzle(p,plan);const initial=p.objects.length;
 const updated={...p.puzzlePlans[0],name:'Test rename'};p=z.savePuzzle(p,updated);assert.equal(p.objects.length,initial);assert.equal(p.puzzlePlans[0].name,'Test rename');
 const tampered={...p,objects:p.objects.map(o=>o.id===p.puzzlePlans[0].memberIds[1]?{...o,position:[o.position[0]+24,o.position[1],o.position[2]]}:o)};
 assert.throws(()=>z.savePuzzle(tampered,updated),/changed manually/);assert.throws(()=>z.removePuzzle(tampered,plan.id),/changed manually/);
 assert.equal(z.removePuzzle(tampered,plan.id,true).objects.length,tampered.objects.length);
 assert.equal(z.removePuzzle(p,plan.id).objects.length,0);
});
test('protects puzzle external consumers before deleting',()=>{
 let p=z.savePuzzle(base(),z.createPuzzlePreset());const plan=p.puzzlePlans[0];p.objects.push({kind:'entity',id:'linked',classname:'trigger_relay',name:'relay',position:[0,0,0],props:{target:z.puzzleDoneName(plan.id)}});
 assert.throws(()=>z.removePuzzle(p,plan.id),/still reference/);assert.ok(z.removePuzzle(p,plan.id,true).objects.some(o=>o.id==='linked'));
});
test('linked mission/event deletion or stage removal is blocked',()=>{
 const mission=m.createMissionPreset('blank'),event=m.createEventPreset('blank');let p=m.applyRecord(base(),mission,'mission').project;p=m.applyRecord(p,event,'event').project;
 const plan=z.createPuzzlePreset();plan.missionStageId=mission.stages[0].id;plan.eventSequenceId=event.id;p=z.savePuzzle(p,plan);
 assert.throws(()=>m.removeRecord(p,event.id,'event',true),/puzzle/);assert.throws(()=>m.removeRecord(p,mission.id,'mission',true),/puzzle/);
 assert.throws(()=>m.applyRecord(p,{...mission,stages:[{...mission.stages[0],id:'new-stage'}]},'mission'),/puzzle/);
});
test('safe metadata validation and backward compatibility',()=>{
 const p=z.savePuzzle(base(),z.createPuzzlePreset());assert.doesNotThrow(()=>validateProjectFile(JSON.parse(JSON.stringify(p))));assert.doesNotThrow(()=>validateProjectFile(base()));
 const bad=JSON.parse(JSON.stringify(p));bad.puzzlePlans[0].buttons[0][0]=Infinity;assert.throws(()=>validateProjectFile(bad));
});
test('duplicating puzzle generates fresh ids without overlap',()=>{
 const p=z.createPuzzlePreset(),other=z.duplicatePuzzle(p);assert.notEqual(other.id,p.id);assert.notEqual(z.puzzleDoneName(other.id),z.puzzleDoneName(p.id));assert.deepEqual(other.memberIds,[]);assert.equal(other.buttons[0][0]-p.buttons[0][0],256);
});
test('validator refuses malformed output, invalid mode and nonfinite coordinates',()=>{
 const p=z.createPuzzlePreset();p.completionTarget=z.puzzleDoneName(p.id);p.buttons[0]=[NaN,0,0];assert.ok(z.puzzleIssues(p,base()).filter(x=>x.level==='error').length>=2);assert.throws(()=>z.savePuzzle(base(),p));
});
test('physical puzzle brushes roundtrip through Valve 220 unchanged',()=>{
 const p=z.savePuzzle(base(),z.createPuzzlePreset());const map=exportMap(p);const parsed=inspectMapImport(map,'puzzle.map');assert.equal(parsed.report.totalBrushes,2);assert.equal(parsed.report.skippedBrushes,0);assert.equal(parsed.project.objects.filter(o=>o.classname==='func_button').length,2);
});
test('diagnostics detect missing completion targets and unused puzzle',()=>{
 let p=z.savePuzzle(base(),z.createPuzzlePreset());const audit=d.inspectAdvancedGameplay(p);assert.ok(audit.some(a=>a.area.startsWith('Puzzle:')&&a.message.includes('not linked')));
 const plan=p.puzzlePlans[0];const q={...plan,completionTarget:'missing_relay'};const issues=z.puzzleIssues(q,p);assert.ok(issues.some(i=>i.level==='warning'&&i.message.includes('missing_relay')));
});
test('new puzzle appears in navigation and preserves the rest of the studios',()=>{
 const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');assert.match(app,/CoopPuzzleStudio/);assert.match(app,/MissionEventsStudio/);assert.match(app,/NPCStudio/);assert.match(app,/TerrainShapeStudio/);assert.doesNotMatch(app,/VehicleBuilder/);
});
