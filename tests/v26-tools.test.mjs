import test from 'node:test';
import assert from 'node:assert/strict';
import {simulateLogic} from '../src/engine/logicSimulator.ts';
import {buildKit} from '../src/engine/svenKits.ts';
import {analyzeReachability} from '../src/engine/mapTools24.ts';
import {createBrush} from '../src/engine/geometry.ts';
import {generateMapCfg,generateMapScript,publishChecks,defaultCfg} from '../src/engine/mapScriptCfg.ts';
import {bspBatchCandidates} from '../src/engine/bspDoorCapture.ts';

const E=(classname,props,position=[0,0,0])=>({id:props.id??Math.random().toString(36).slice(2),kind:'entity',name:classname,classname,position,props});

test('logic simulator follows delays, multi_manager, masters and counters',()=>{
  const btn=E('func_button',{target:'mm',id:'btn'});
  const objects=[btn,E('multi_manager',{targetname:'mm',door1:'0',snd:'1.5',cnt:'2',cnt2:'3'}),E('func_door',{targetname:'door1',speed:'96',wait:'2'}),
    E('ambient_generic',{targetname:'snd',message:'ambience/siren.wav'}),E('game_counter',{targetname:'cnt',health:'2',target:'done'}),
    E('trigger_relay',{targetname:'cnt2',target:'cnt'}),E('game_text',{targetname:'done',message:'Solved'})];
  const r=simulateLogic(objects,'btn');
  const a=r.events.map(e=>`${e.time.toFixed(1)} ${e.action} ${e.name}`);
  assert.ok(a.includes('0.0 open door1'));assert.ok(a.includes('1.5 sound snd'));
  assert.ok(r.events.some(e=>e.action==='count'&&e.detail.startsWith('2 / 2')));
  assert.ok(r.events.some(e=>e.action==='text'&&e.time===3));
  assert.ok(r.events.some(e=>e.action==='close'&&e.detail.includes('auto-close')));
});

test('ordered levers kit only reaches the door in the right order',()=>{
  const objs=buildKit('orderedLevers',{levers:3,door:true},[0,0,0],[]).objects;
  const levers=objs.filter(o=>o.kind==='entity'&&o.classname==='func_button');
  const last=simulateLogic(objs,levers[2].id);
  assert.ok(last.events.some(e=>e.action==='blocked'),'last lever first is blocked by its master');
  const first=simulateLogic(objs,levers[0].id);
  assert.ok(first.events.some(e=>e.action==='master'));
  assert.ok(!first.events.some(e=>e.action==='missing'));
});

test('missing targets are reported, loops are cut',()=>{
  const r=simulateLogic([E('trigger_relay',{id:'a',targetname:'a',target:'nowhere'})],'a');
  assert.ok(r.events.some(e=>e.action==='missing'));
  const loop=simulateLogic([E('trigger_random',{id:'t',targetname:'t',target_count:'1',target1:'t2',spawnflags:'9',min_delay:'0.5',max_delay:'0.5'}),E('trigger_relay',{targetname:'t2'})],'t');
  assert.ok(loop.truncated);
});

test('reachability: an item on a high ledge is unreachable, one on the floor is reachable',()=>{
  const floor=createBrush('box',[0,0,-8],[1024,1024,16]);const ledge=createBrush('box',[400,0,100],[128,128,200]);
  const roof=createBrush('box',[0,0,520],[1024,1024,16]);
  const walls=[[-520,0],[520,0],[0,-520],[0,520]].map(([x,y])=>createBrush('box',[x,y,256],[x?16:1024,y?16:1024,512]));
  const project={version:1,name:'r',objects:[floor,ledge,roof,...walls,E('info_player_start',{},[0,0,40]),E('item_battery',{id:'low'},[-200,0,16]),E('item_healthkit',{id:'high'},[400,0,216])],world:{},wadNames:[]};
  const r=analyzeReachability(project);
  assert.equal(r.targets.find(t=>t.id==='low').state,'reachable');
  assert.equal(r.targets.find(t=>t.id==='high').state,'unreachable');
});

test('map cfg, script and publish checks',()=>{
  const cfg=generateMapCfg('testmap',{...defaultCfg(),settings:{mp_survival_starton:'1'},weapons:['weapon_crowbar','weapon_shotgun']},'testmap');
  assert.match(cfg,/^mp_survival_starton 1$/m);assert.match(cfg,/^weapon_shotgun$/m);assert.match(cfg,/^map_script testmap$/m);
  const as=generateMapScript('testmap',['checkpoints','welcome'],{welcome:'Hola'});
  assert.match(as,/#include "point_checkpoint"/);assert.match(as,/RegisterPointCheckPointEntity\(\);/);assert.match(as,/Hola/);
  const checks=publishChecks({mapName:'Test Map',missing:2,hasCfg:false,usesCheckpoint:true,scriptHasCheckpoints:false});
  assert.ok(checks.filter(c=>c.level==='error').length>=3);
});

test('batch candidates group doors and list brush objects',()=>{
  const face=(model,x)=>({model,points:[[x,0,0],[x+32,0,0],[x+32,0,96],[x,0,96]],bspFaceIndex:model*100});
  const faces=[face(1,0),face(2,32),...[0,1,2,3].map(k=>({...face(3,500),bspFaceIndex:300+k}))];
  const ents=[{classname:'func_door',properties:{model:'*1',targetname:'g'}},{classname:'func_door',properties:{model:'*2',targetname:'g'}},{classname:'func_wall',properties:{model:'*3'}}];
  const c=bspBatchCandidates(faces,ents);
  assert.equal(c.filter(x=>x.kind==='door').length,1);assert.equal(c.find(x=>x.kind==='door').leaves,2);
  assert.equal(c.filter(x=>x.kind==='object').length,1);
});

test('mirror keeps brushes valid and outward, path array spreads copies',async()=>{
  const {mirrorBrushes,pathArrayBrushes}=await import('../src/engine/curvedGeometry.ts');
  const {validateBrush}=await import('../src/engine/exportMap.ts');
  const {transformedVertices}=await import('../src/engine/geometry.ts');
  const wedge=createBrush('wedge',[100,0,32],[64,64,64]);
  const [m]=mirrorBrushes([wedge],0,0);
  assert.deepEqual(validateBrush(m),[]);
  const xs=transformedVertices(m).map(v=>v[0]);assert.equal(Math.round(Math.max(...xs)),-68);assert.equal(Math.round(Math.min(...xs)),-132);
  const copies=pathArrayBrushes([createBrush('box',[0,0,8],[16,16,16])],{points:[[0,0,8],[300,0,8]],copies:4,align:true,scaleEnd:2});
  assert.equal(copies.length,4);assert.deepEqual(copies.map(b=>Math.round(b.position[0])),[0,100,200,300]);assert.equal(copies[3].scale[0],2);
});

test('starter room is sealed, grid aligned and has no overlapping brushes',async()=>{
  const {demoProject,STARTER_ROOM}=await import('../src/store.ts');
  const {transformedVertices}=await import('../src/engine/geometry.ts');
  const p=demoProject();const brushes=p.objects.filter(o=>o.kind==='brush');
  const box=b=>{const v=transformedVertices(b);return [0,1,2].map(i=>[Math.min(...v.map(q=>q[i])),Math.max(...v.map(q=>q[i]))]);};
  const boxes=brushes.map(box);
  for(let a=0;a<boxes.length;a++)for(let b=a+1;b<boxes.length;b++){const overlap=boxes[a].every(([lo,hi],i)=>Math.min(hi,boxes[b][i][1])-Math.max(lo,boxes[b][i][0])>0.01);assert.ok(!overlap,`${brushes[a].name} overlaps ${brushes[b].name}`);}
  for(const bb of boxes)for(const [lo,hi] of bb){assert.equal(Math.abs(lo%8),0);assert.equal(Math.abs(hi%8),0);}
  const half=STARTER_ROOM.inner/2,spawn=p.objects.find(o=>o.classname==='info_player_start');
  assert.ok(Math.abs(spawn.position[0])<half&&Math.abs(spawn.position[1])<half&&spawn.position[2]>36&&spawn.position[2]<STARTER_ROOM.height);
  assert.equal(brushes.length,6);
});
