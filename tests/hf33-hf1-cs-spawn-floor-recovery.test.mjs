import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createBrush} from '../src/engine/geometry.ts';
import {inspectCS16HF33} from '../src/engine/csMapDoctorHF33.ts';
import {createCS16StarterArena} from '../src/engine/csMapStarterHF33.ts';

const starter=()=>createCS16StarterArena({mode:'de',center:[0,0,0],ctCount:2,tCount:2,texture:'C1A0_LABFLR'});
const project=(objects,extra={})=>({name:'test_de_map',world:{classname:'worldspawn'},objects,...extra});
const spawnOf=objects=>objects.find(o=>o.kind==='entity'&&o.classname==='info_player_start');

test('HF33 HF1: recovered BSP skips uncertain spawn hull/floor claims but continues checking actual entity/zone issues',()=>{
 const objects=starter();
 const floor=objects.find(o=>o.kind==='brush'&&o.name==='Arena floor');
 objects.splice(objects.indexOf(floor),1);
 const spawn=spawnOf(objects);spawn.position=[0,0,900];
 const zone=objects.find(o=>o.kind==='brush'&&o.entityId);zone.faces[0].texture='C1A0_LABFLR';
 const flagged=inspectCS16HF33(project(objects,{recoveredFromBsp:true}));
 assert.ok(!flagged.some(f=>['SPAWN_NO_FLOOR','SPAWN_SOLID_HULL'].includes(f.code)));
 assert.ok(flagged.some(f=>f.code==='ZONE_TEXTURE'));
});

test('HF33 HF1: _recovered WAD legacy marker also identifies recovered BSP',()=>{
 const objects=starter();spawnOf(objects).position=[0,0,900];
 const flagged=inspectCS16HF33(project(objects,{world:{wad:'base_recovered.wad'}}));
 assert.ok(!flagged.some(f=>f.code.startsWith('SPAWN_')));
});

test('HF33 HF1: spawn supported on the seam between two brushes is valid',()=>{
 const objects=starter();
 const floor=objects.find(o=>o.kind==='brush'&&o.name==='Arena floor');
 objects.splice(objects.indexOf(floor),1,
  createBrush('box',[-544,0,-32],[1088,1408,64],'Left floor'),
  createBrush('box',[544,0,-32],[1088,1408,64],'Right floor'));
 const spawn=spawnOf(objects);spawn.position=[0,0,36];
 const flagged=inspectCS16HF33(project(objects));
 assert.ok(!flagged.some(f=>f.objectId===spawn.id&&f.code==='SPAWN_NO_FLOOR'),flagged.map(f=>f.code).join(','));
});

test('HF33 HF1: floating spawn with no geometry beneath remains a finding for native MAP',()=>{
 const objects=starter();
 const spawn=spawnOf(objects);spawn.position=[0,0,900];
 const flagged=inspectCS16HF33(project(objects));
 assert.ok(flagged.some(f=>f.objectId===spawn.id&&f.code==='SPAWN_NO_FLOOR'),flagged.map(f=>f.code).join(','));
});

test('HF33 HF1: original generator spawns still pass',()=>{
 const check=inspectCS16HF33(project(starter()));
 assert.ok(!check.some(f=>f.code==='SPAWN_NO_FLOOR'||f.code==='SPAWN_SOLID_HULL'),check.map(f=>f.code).join(','));
});

test('HF33 HF1: UI distinguishes BSP-recovered projects in six languages',async()=>{
 const s=await readFile('src/components/CSMapHF33.tsx','utf8');
 for(const locale of ['es','en','ru','ko','zh','pt'])assert.match(s,new RegExp(`\\b${locale}:'`));
 assert.match(s,/isRecoveredBspProject\(project\)/);
 assert.match(s,/recoveredBsp&&f\.code==='SPAWN_INSIDE_BRUSH'/);
 assert.match(s,/role="note"/);
});
