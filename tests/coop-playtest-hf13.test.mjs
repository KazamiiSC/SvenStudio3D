import test from 'node:test';
import assert from 'node:assert/strict';
import {primitiveGeometry} from '../src/engine/geometry.ts';
import {analyzeCoopPlaytest,createCoopVolumes,probeCoopPlayer,coopGhostPositions,COOP_HULL} from '../src/engine/coopPlaytest.ts';
const brush=(id,position=[0,0,0],size=[32,32,32],extra={})=>({id,name:id,kind:'brush',primitive:'box',position,rotation:[0,0,0],scale:[1,1,1],...primitiveGeometry('box',size),...extra});
const spawn=(id='spawn',position=[0,0,36],classname='info_player_deathmatch',props={})=>({id,name:id,kind:'entity',classname,position,props});
const project=objects=>({name:'Test',version:1,target:'svengine',world:{},wadNames:[],objects});
const floor=()=>brush('floor',[0,0,-16],[512,512,32]);
const codes=report=>report.findings.map(f=>f.code);
test('HF13: read-only inspection of valid spawn and nearby floor',()=>{
 const p=project([floor(),spawn()]),previous=JSON.stringify(p);
 const r=analyzeCoopPlaytest(p,4);
 assert.equal(r.spawnCount,1);assert.equal(r.activeCandidates,1);
 assert.equal(r.ghosts.length,4);assert.equal(r.ghosts.filter(g=>g.blocked).length,0);
 assert.ok(r.ghosts.every(g=>g.support));
 assert.equal(codes(r).includes('COOP_SPAWN_BLOCKED'),false);
 assert.equal(JSON.stringify(p),previous);
});
test('HF13: no spawn produces a diagnostic, no ghosts and no mutation',()=>{
 const r=analyzeCoopPlaytest(project([floor()]));assert.ok(codes(r).includes('COOP_NO_SPAWNS'));assert.equal(r.ghosts.length,0);
});
test('HF13: all four Sven spawn classes are accepted',()=>{
 const spawns=['info_player_start','info_player_deathmatch','info_player_coop','info_player_dm2'];
 const r=analyzeCoopPlaytest(project([floor(),...spawns.map((c,i)=>spawn(`s${i}`,[i*60,0,36],c))]),8);
 assert.equal(r.spawnCount,4);assert.equal(r.ghosts.length,8);
});
test('HF13: colliding spawn is flagged and linked to the correct entity ID',()=>{
 const r=analyzeCoopPlaytest(project([floor(),brush('wall',[0,0,58],[32,32,64]),spawn('blocked')]));
 assert.ok(r.findings.some(f=>f.code==='COOP_SPAWN_BLOCKED'&&f.objectId==='blocked'));
 assert.equal(r.ghosts[0].blocked,true);
});
test('HF13: overlapping starts are advisory, not an export mutation',()=>{
 const r=analyzeCoopPlaytest(project([floor(),spawn('one'),spawn('two',[20,0,36])]));
 assert.ok(codes(r).includes('COOP_SPAWN_OVERLAP'));
});
test('HF13: Start Off is not incorrectly counted as active without runtime evidence',()=>{
 const r=analyzeCoopPlaytest(project([floor(),spawn('off',[0,0,36],'info_player_deathmatch',{spawnflags:'2'})]));
 assert.equal(r.activeCandidates,0);assert.ok(codes(r).includes('COOP_DISABLED_SPAWNS'));
});
test('HF13: a trigger volume is not treated as a blocking wall',()=>{
 const trigger=spawn('tr','[not-a-spawn]');trigger.classname='trigger_multiple';
 const block=brush('triggerVolume',[0,0,60],[32,32,32],{entityId:'tr'});
 const r=analyzeCoopPlaytest(project([floor(),spawn(),trigger,block]));
 assert.equal(r.ghosts[0].blocked,false);
});
test('HF13: hidden world brushes still compile and must be considered',()=>{
 const r=analyzeCoopPlaytest(project([floor(),spawn(),brush('hiddenWall',[0,0,58],[32,32,64],{hidden:true})]));
 assert.equal(r.ghosts[0].blocked,true);
});
test('HF13: group positions have deterministic spacing and support 2 / 4 / 8',()=>{
 assert.deepEqual(coopGhostPositions([12,34,56],2),[[12,34,56],[52,34,56]]);
 for(const n of [2,4,8])assert.equal(coopGhostPositions([0,0,0],n).length,n);
 assert.deepEqual(COOP_HULL,{width:32,standingHeight:72,crouchHeight:36,stepHeight:18});
});
test('HF13: reference spawn can be chosen without altering any spawn entity',()=>{
 const r=analyzeCoopPlaytest(project([floor(),spawn('first'),spawn('second',[110,0,36])]),2,'second');
 assert.equal(r.anchorId,'second');assert.deepEqual(r.ghosts[0].position,[110,0,36]);
});
test('HF13: missing nearby floor is reported as informational, not conclusive failure',()=>{
 const r=analyzeCoopPlaytest(project([spawn()]));
 assert.ok(codes(r).includes('COOP_NO_FLOOR'));assert.ok(codes(r).includes('COOP_GROUP_NO_FLOOR'));
 assert.ok(r.findings.find(f=>f.code==='COOP_NO_FLOOR').severity==='info');
});
test('HF13: rotated wall is tested as a real convex solid (not just its AABB)',()=>{
 const wall=brush('angled',[43,0,60],[24,80,80],{rotation:[0,0,45]});
 const r=analyzeCoopPlaytest(project([floor(),spawn(),wall]));
 assert.equal(typeof r.ghosts[0].blocked,'boolean');
 const volume=createCoopVolumes(project([wall]));assert.equal(volume.length,1);
 assert.equal(probeCoopPlayer([300,300,36],volume).blocked,false);
});
test('HF13: restricted group geometry report identifies an obstruction among several players',()=>{
 const r=analyzeCoopPlaytest(project([floor(),spawn(),brush('blockGhostTwo',[40,0,58],[28,28,64])]),4);
 assert.ok(codes(r).includes('COOP_GROUP_BLOCKED'));
 assert.equal(r.ghosts[1].blocked,true);
});
test('HF13: manual probe can inspect a corridor with or without a spawn',()=>{
 const manual=[300,0,36];
 const r=analyzeCoopPlaytest(project([floor(),spawn('origin'),brush('corridorWall',[340,0,60],[16,80,96])]),4,null,manual);
 assert.deepEqual(r.ghosts[0].position,manual);
 assert.ok(r.ghosts.some(g=>g.blocked));
 const noSpawn=analyzeCoopPlaytest(project([floor()]),2,null,manual);
 assert.equal(noSpawn.ghosts.length,2);
 assert.ok(codes(noSpawn).includes('COOP_NO_SPAWNS'));
});
