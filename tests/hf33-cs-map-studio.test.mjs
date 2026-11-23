import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createCS16StarterArena,canCreateCS16Starter} from '../src/engine/csMapStarterHF33.ts';
import {inspectCS16HF33,inspectCS16BuildLog} from '../src/engine/csMapDoctorHF33.ts';
import {cs16ApplyBatch} from '../src/engine/csMapStudio.ts';
import {exportMap} from '../src/engine/exportMap.ts';
import {inspectMapImport} from '../src/engine/importMap.ts';

const project=objects=>({version:1,target:'cs16',name:'HF33 test',world:{classname:'worldspawn',mapversion:'220',message:'CS HF33'},wadNames:['halflife.wad'],objects});
const n=(objects,c)=>objects.filter(o=>o.kind==='entity'&&o.classname===c).length;

for(const mode of ['de','cs','fy','aim'])test(`HF33 ${mode}_ arena generates native entities and Valve 220 roundtrip`,()=>{
 const objects=createCS16StarterArena({mode,center:[0,0,0],ctCount:8,tCount:8,texture:'C1A0_LABFLR'});
 assert.equal(n(objects,'info_player_start'),8);assert.equal(n(objects,'info_player_deathmatch'),8);
 assert.equal(n(objects,'func_buyzone'),2);assert.equal(n(objects,'light'),3);
 assert.ok(objects.filter(o=>o.kind==='brush'&&!o.entityId).length>=12);
 assert.equal(objects.filter(o=>o.kind==='brush'&&o.entityId).length,mode==='de'?4:mode==='cs'?3:2);
 assert.equal(n(objects,'func_bomb_target'),mode==='de'?2:0);
 assert.equal(n(objects,'hostage_entity'),mode==='cs'?4:0);
 assert.equal(n(objects,'func_hostage_rescue'),mode==='cs'?1:0);
 assert.equal(n(objects,'armoury_entity'),['fy','aim'].includes(mode)?4:0);
 assert.ok(objects.filter(o=>o.kind==='brush'&&!o.entityId).every(o=>o.faces.every(f=>f.texture==='C1A0_LABFLR')));
 assert.equal(new Set(objects.map(o=>o.id)).size,objects.length);
 assert.deepEqual(cs16ApplyBatch([],objects),objects);
 const warnings=inspectCS16HF33(project(objects));
 assert.ok(!warnings.some(w=>['SPAWN_SOLID_HULL','SPAWN_NO_FLOOR','BRUSH_ORPHAN','ZONE_TEXTURE','NO_WORLD_BRUSHES'].includes(w.code)),warnings.map(w=>w.code).join(','));
 const txt=exportMap(project(objects));
 const read=inspectMapImport(txt,`${mode}_hf33.map`);
 assert.equal(read.report.skippedBrushes,0);
 assert.equal(n(read.project.objects,'info_player_start'),8);
 assert.equal(n(read.project.objects,'info_player_deathmatch'),8);
 assert.equal(n(read.project.objects,'func_bomb_target'),mode==='de'?2:0);
 assert.ok(read.project.objects.filter(o=>o.kind==='brush').length>=objects.filter(o=>o.kind==='brush').length);
});

test('HF33 builder refuses invalid coordinates, unsafe textures or player counts, and does not modify old projects',()=>{
 const args={mode:'de',center:[0,0,0],ctCount:8,tCount:8,texture:'C1A0_LABFLR'};
 for(const bad of [{texture:'AAATRIGGER'},{texture:'WAD PATH'},{center:[9999,0,0]},{ctCount:17},{tCount:-1},{mode:'svencoop'}]){
  assert.throws(()=>createCS16StarterArena({...args,...bad}));
 }
 assert.equal(canCreateCS16Starter('cs16',false,false,[]),true);
 assert.equal(canCreateCS16Starter('svengine',false,false,[]),false);
 assert.equal(canCreateCS16Starter('cs16',true,false,[]),false);
 assert.equal(canCreateCS16Starter('cs16',false,false,createCS16StarterArena(args)),false);
});

test('HF33 preflight flags conservative map faults and texture catalogue gaps',()=>{
 const clean=createCS16StarterArena({mode:'de',center:[0,0,0],ctCount:8,tCount:8,texture:'C1A0_LABFLR'});
 const altered=structuredClone(clean);
 const spawn=altered.find(o=>o.kind==='entity'&&o.classname==='info_player_start');spawn.position=[0,0,36];
 const cover=altered.find(o=>o.kind==='brush'&&o.name==='Cover 0/1');cover.position=[0,0,48];
 const zone=altered.find(o=>o.kind==='brush'&&o.entityId);
 zone.faces[0].texture='C1A0_LABFLR';
 const orphan=structuredClone(zone);orphan.id='orphan-unique';orphan.entityId='missing-id';altered.push(orphan);
 const check=inspectCS16HF33(project(altered),[{name:'SOME_OTHER_TEXTURE'}]);
 assert.ok(check.some(e=>e.code==='SPAWN_SOLID_HULL'));
 assert.ok(check.some(e=>e.code==='ZONE_TEXTURE'));
 assert.ok(check.some(e=>e.code==='BRUSH_ORPHAN'));
 assert.ok(check.some(e=>e.code==='TEXTURE_NOT_LOADED'));
 assert.ok(check.every(f=>['error','warning','info'].includes(f.severity)));
});

test('HF33 ZHLT diagnostics are based on log text, never predicted from geometry',()=>{
 assert.deepEqual(inspectCS16BuildLog([]),[]);
 const issues=inspectCS16BuildLog(['hlbsp.exe','LEAK in hull 0','Error: Mixed face contents','Error: Too many clipnodes','Texture not found in WAD']);
 assert.ok(issues.some(i=>i.code==='BSP_LEAK'));
 assert.ok(issues.some(i=>i.code==='MIXED_CONTENTS'));
 assert.ok(issues.some(i=>i.code==='GOLDSRC_CAPACITY'));
 assert.ok(issues.some(i=>i.code==='MISSING_TEXTURE'));
 assert.ok(!inspectCS16BuildLog(['hlbsp finished','hlvis finished','hlrad finished']).length);
});

test('HF33 studio uses one native undo batch and six translations without new transforms',async()=>{
 const src=await readFile('src/components/CSMapStudio.tsx','utf8');
 const panel=await readFile('src/components/CSMapHF33.tsx','utf8');
 const css=await readFile('src/components/csMapStudio.css','utf8');
 assert.match(src,/section==='builder'/);assert.match(src,/CSMapHF33Audit/);
 assert.match(panel,/addObjects\(added\)/);assert.match(panel,/cs16ApplyBatch\(project.objects,added\)/);
 assert.match(panel,/onCancel\(\)/);assert.match(css,/repeat\(6,minmax/);
 for(const locale of ['es','en','ru','ko','zh','pt'])assert.match(panel,new RegExp(`\\b${locale}:\\{builder:`));
});

test('HF33 builder appends through existing editor history and Ctrl+Z restores empty map',async()=>{
 const {useEditor}=await import('../src/store.ts');
 const original=useEditor.getState();
 const prev={project:original.project,settings:original.settings,history:original.history,future:original.future};
 try{
  useEditor.setState({project:project([]),settings:{...original.settings,gameProfile:'cs16'},history:[],future:[]});
  const objects=createCS16StarterArena({mode:'aim',center:[0,0,0],ctCount:4,tCount:4,texture:'C1A0_LABFLR'});
  const api=useEditor.getState();
  cs16ApplyBatch(api.project.objects,objects);
  api.addObjects(objects);
  assert.equal(useEditor.getState().history.length,1);
  assert.equal(useEditor.getState().project.objects.length,objects.length);
  useEditor.getState().undo();
  assert.equal(useEditor.getState().project.objects.length,0);
 }finally{useEditor.setState(prev)}
});

test('HF33 Map Doctor chooses CS-specific diagnostics and does not show Svengine doctor under CS profile',async()=>{
 const src=await readFile('src/components/MapDoctor.tsx','utf8');
 assert.match(src,/editor\.settings\.gameProfile==='cs16'/);
 assert.match(src,/CS Map Doctor 2\.0 · GoldSrc \/ ZHLT/);
 assert.match(src,/<CSMapHF33Audit/);
});
