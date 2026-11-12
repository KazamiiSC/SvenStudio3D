import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const root=new URL('../examples/advanced-coop-v1812/',import.meta.url);const project=JSON.parse(fs.readFileSync(new URL('sv_coop_systems_validation.svenstudio.json',root),'utf8'));
const map=fs.readFileSync(new URL('sv_coop_systems_validation.map',root),'utf8');const entities=project.objects.filter(o=>o.kind==='entity'),brushes=project.objects.filter(o=>o.kind==='brush');
const by=n=>entities.find(e=>e.props.targetname===n),aabb=b=>{const vs=[0,1,2].map(i=>b.vertices.map(v=>v[i]+b.position[i]));return vs.map(v=>[Math.min(...v),Math.max(...v)])};
const overlap=(a,b)=>a.every(([mn,mx],i)=>mn<b[i][1]&&mx>b[i][0]);
test('Map contains 3 mission stages, 2 native puzzles, 3 NPC waves and 3 events',()=>{
 assert.equal(project.puzzlePlans.length,2);assert.deepEqual(project.puzzlePlans.map(x=>x.mode),['switches','simultaneous']);
 assert.equal(project.missionPlans[0].stages.length,3);assert.equal(project.encounterPlans[0].waves.length,3);assert.equal(project.eventSequences.length,3);
 assert.equal(brushes.length,87);assert.equal(entities.length,78);assert.match(map,/"classname" "worldspawn"/);assert.match(map,/SV_METAL01/);
});
test('Power switches link each of three physical buttons to a counter and entrance door',()=>{
 const p=project.puzzlePlans[0];const prefix=`sv_pz_${p.id.replace(/[^A-Za-z0-9]/g,'').slice(0,19)}`;
 const counter=by(`${prefix}_logic`),manager=by(`${prefix}_done`);assert.equal(counter.classname,'game_counter');assert.equal(counter.props.health,'3');assert.equal(manager.props.test_entry_gate,'0.1');
 assert.equal(entities.filter(e=>e.classname==='func_button'&&e.props.target===counter.props.targetname).length,3);
 assert.equal(entities.filter(e=>e.classname==='func_door'&&e.props.targetname==='test_entry_gate').length,1);
});
test('Simultaneous puzzle uses two 5-second buttons and one-shot relay to last mission objective',()=>{
 const p=project.puzzlePlans[1],prefix=`sv_pz_${p.id.replace(/[^A-Za-z0-9]/g,'').slice(0,19)}`;
 const multi=by(`${prefix}_logic`),relay=by(`${prefix}_gate`),done=by(`${prefix}_done`);assert.equal(multi.classname,'multisource');assert.equal(relay.classname,'trigger_relay');assert.equal(relay.props.spawnflags,'1');
 assert.equal(multi.props.target,relay.props.targetname);assert.equal(entities.filter(e=>e.classname==='func_button'&&e.props.target===multi.props.targetname&&e.props.wait==='5').length,2);
 const stage=project.missionPlans[0].stages[2],stageName=`sv_ms_${stage.id.replace(/[^A-Za-z0-9]/g,'').slice(0,24)}_done`;assert.ok(done.props[stageName]);
});
test('All enemy waves have native death-triggered counters',()=>{
 const p=project.encounterPlans[0];for(const w of p.waves){const dead=`sv_ew_${w.id.replace(/[^a-zA-Z0-9]/g,'').slice(0,19)}_dead`;const c=by(dead);assert.equal(c.classname,'game_counter');assert.equal(c.props.health,String(w.count));assert.equal(entities.filter(e=>e.classname==='squadmaker'&&e.props.trigger_target===dead).reduce((s,e)=>s+Number(e.props.monstercount),0),w.count);}
});
test('Both sliding doors have clear +Y pockets without static brush intersection',()=>{
 const doors=entities.filter(e=>e.classname==='func_door');assert.equal(doors.length,2);
 for(const door of doors){const leaf=brushes.find(b=>b.entityId===door.id);assert.ok(leaf);const base=aabb(leaf),travel=[base[0],[base[1][0],base[1][1]+221],base[2]];
  for(const brush of brushes)if(!brush.entityId&&brush.id!==leaf.id)assert.ok(!overlap(aabb(brush),travel),`Gate ${door.props.targetname} blocked by ${brush.name}`);
 }
});
test('Assets, editable project and build report exist',()=>{
 assert.ok(fs.statSync(new URL('svstudio.wad',root)).size>10000);assert.ok(fs.statSync(new URL('LEEME_README.md',root)).size>1000);assert.ok(fs.statSync(new URL('BUILD_REPORT.json',root)).size>500);
});
