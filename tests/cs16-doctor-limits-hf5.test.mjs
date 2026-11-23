import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBrush} from '../src/engine/geometry.ts';
import {inspectCS16HF33,inspectCS16BuildLog} from '../src/engine/csMapDoctorHF33.ts';
import {bspLimitReport,GOLDSRC_LIMITS} from '../server/bspAudit.js';

const spawn=(id,classname,x,y=0)=>({id,kind:'entity',name:id,classname,position:[x,y,36],props:{},layer:'Gameplay'});
const floor={...createBrush('box',[0,0,-8],[4096,4096,16],'Floor'),id:'floor'};

test('Map Doctor warns about thin teams and spawns outside their buy zone',()=>{
  const ct=Array.from({length:4},(_,i)=>spawn(`ct${i}`,'info_player_start',1000+i*40));
  const t=Array.from({length:12},(_,i)=>spawn(`t${i}`,'info_player_deathmatch',-1000-i*80));
  const zoneEntity={id:'bz',kind:'entity',name:'bz',classname:'func_buyzone',position:[0,0,0],props:{team:'1'}};
  const zone={...createBrush('box',[-1220,0,64],[600,256,128],'Buy T'),id:'bzb',entityId:'bz'};
  const findings=inspectCS16HF33({objects:[floor,...ct,...t,zoneEntity,zone]});
  assert.ok(findings.some(f=>f.code==='SPAWNS_FEW'&&f.detail==='CT: 4'));
  assert.ok(!findings.some(f=>f.code==='SPAWNS_FEW'&&f.detail?.startsWith('T:')));
  const outside=findings.filter(f=>f.code==='SPAWN_OUTSIDE_BUYZONE');
  // T zone covers x -1520..-920 only (t0..t6 inside, t7.. outside); CT has no zone at all.
  assert.ok(outside.some(f=>f.detail==='CT'));
  assert.ok(outside.some(f=>f.objectId==='t11'));
  assert.ok(!outside.some(f=>f.objectId==='t0'));
});

test('without any func_buyzone CS creates automatic buy areas, so nothing is reported',()=>{
  const findings=inspectCS16HF33({objects:[floor,spawn('c','info_player_start',100),spawn('t','info_player_deathmatch',-100)]});
  assert.ok(!findings.some(f=>f.code==='SPAWN_OUTSIDE_BUYZONE'));
});

test('BSP limit report ranks real lump counts against classic GoldSrc limits',()=>{
  const report=bspLimitReport({clipnodes:31000,models:100,planes:1000});
  assert.equal(report[0].name,'clipnodes');assert.equal(report[0].max,GOLDSRC_LIMITS.clipnodes);assert.equal(report[0].percent,95);
  assert.ok(inspectCS16BuildLog(['BSP limit: clipnodes 31000/32767 (95%). Classic GoldSrc may fail']).some(f=>f.code==='BSP_LIMIT_NEAR'));
  assert.match(readFileSync(new URL('../server/index.js',import.meta.url),'utf8'),/if\(gameProfile==='cs16'\)for\(const l of limits\.filter\(l=>l\.percent>=85\)\)/);
});
