import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root=new URL('../examples/npc-encounters-v1811/',import.meta.url);
const project=JSON.parse(fs.readFileSync(new URL('sv_encounter_validation.svenstudio.json',root),'utf8'));
const map=fs.readFileSync(new URL('sv_encounter_validation.map',root),'utf8');
const entities=project.objects.filter(o=>o.kind==='entity');
const brushes=project.objects.filter(o=>o.kind==='brush');
const byTarget=target=>entities.find(e=>e.props.targetname===target);
const aabb=b=>{
 const xs=b.vertices.map(v=>v[0]+b.position[0]),ys=b.vertices.map(v=>v[1]+b.position[1]),zs=b.vertices.map(v=>v[2]+b.position[2]);
 return [[Math.min(...xs),Math.max(...xs)],[Math.min(...ys),Math.max(...ys)],[Math.min(...zs),Math.max(...zs)]];
};
const overlap=(a,b)=>a.every(([mn,mx],i)=>mn<b[i][1]&&mx>b[i][0]);
test('Demo project packages 70 valid-looking brushes and 60 entities',()=>{
 assert.equal(brushes.length,70);assert.equal(entities.length,60);
 assert.equal(project.missionPlans.length,1);assert.equal(project.missionPlans[0].stages.length,2);
 assert.equal(project.eventSequences.length,2);assert.equal(project.encounterPlans.length,1);
 assert.match(map,/"classname" "worldspawn"/);assert.match(map,/SV_TILE01/);
});
test('Each wave is death-counted and linked to next wave',()=>{
 const plan=project.encounterPlans[0];
 assert.deepEqual(plan.waves.map(w=>[w.monster,w.count]),[['monster_human_grunt',4],['monster_zombie',3],['monster_alien_grunt',2]]);
 for(let i=0;i<plan.waves.length;i++){
   const wave=plan.waves[i];const counter=byTarget(`sv_ew_${wave.id.replace(/[^a-zA-Z0-9]/g,'').slice(0,19)}_dead`);
   assert.ok(counter);assert.equal(counter.classname,'game_counter');assert.equal(Number(counter.props.health),wave.count);
   const squads=entities.filter(x=>x.classname==='squadmaker'&&x.props.trigger_target===counter.props.targetname);
   assert.equal(squads.reduce((n,x)=>n+Number(x.props.monstercount),0),wave.count);
   assert.ok(squads.every(x=>x.props.trigger_condition==='4'));
 }
});
test('Winning the combat triggers mission success and the named extraction door',()=>{
 const plan=project.encounterPlans[0];const prefix=`sv_en_${plan.id.replace(/[^a-zA-Z0-9]/g,'').slice(0,19)}`;
 const manager=byTarget(prefix+'_finish');assert.equal(manager.classname,'multi_manager');
 assert.ok(Object.keys(manager.props).includes('test_gate_open'));
 assert.ok(entities.some(x=>x.classname==='func_door'&&x.props.targetname==='test_gate_open'));
 assert.ok(entities.some(x=>x.props.targetname===`sv_en_${plan.id.replace(/[^a-zA-Z0-9]/g,'').slice(0,19)}_entry`));
});
test('Sliding exit door has a free pocket for its movement in +Y',()=>{
 const door=entities.find(e=>e.classname==='func_door');assert.ok(door);
 const doorBrush=brushes.find(b=>b.entityId===door.id);assert.ok(doorBrush);
 const original=aabb(doorBrush);
 // Door is ~238 units wide and moves along +Y (angle 90) by width minus lip.
 const projected=[original[0],[original[1][0],original[1][1]+221],original[2]];
 for(const b of brushes){
  if(b.id===doorBrush.id||b.entityId)continue;
  const box=aabb(b);
  // Floor/ceiling touch at boundaries, but should not overlap the door volume.
  assert.ok(!overlap(box,projected),`Door travel blocked by static brush ${b.name}`);
 }
});
test('Demo assets and guide are bundled',()=>{
 assert.ok(fs.statSync(new URL('svstudio.wad',root)).size>10000);
 assert.ok(fs.statSync(new URL('LEEME_README.md',root)).size>1000);
 assert.ok(fs.statSync(new URL('BUILD_REPORT.json',root)).size>100);
});
