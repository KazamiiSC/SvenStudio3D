import test from 'node:test';
import assert from 'node:assert/strict';
import {primitiveGeometry} from '../src/engine/geometry.ts';
import {createSmartSnapCache,resolveSmartSnap,smartSnapWorldTolerance} from '../src/engine/smartSnapping.ts';
import {readControls,DEFAULT_CONTROLS} from '../src/engine/controls.ts';

const box=(id,position=[0,0,0],size=[16,16,16],extra={})=>({
  id,name:id,kind:'brush',primitive:'box',position,rotation:[0,0,0],scale:[1,1,1],...primitiveGeometry('box',size),...extra
});
const entity=(id,position)=>({id,name:id,kind:'entity',classname:'info_target',position,props:{}});
const cache=(selected,other)=>createSmartSnapCache(selected,[...selected,...other]);

test('HF12 snaps a moving wall face exactly against the nearest adjacent wall',()=>{
  const moving=box('moving',[0,0,0]),target=box('target',[32,0,0]);
  const snap=resolveSmartSnap(cache([moving],[target]),[15,0,0],2,'face');
  assert.equal(snap?.kind,'face');
  assert.deepEqual(snap?.delta,[16,0,0]);
  assert.equal(snap?.target[0],24);
});
test('HF12 matches transformed vertices while respecting the active mode',()=>{
  const moving=box('moving'),target=box('target',[32,0,0]);
  const snap=resolveSmartSnap(cache([moving],[target]),[31,0,0],2,'vertex');
  assert.equal(snap?.kind,'vertex');
  assert.deepEqual(snap?.delta,[32,0,0]);
});
test('HF12 snaps edge midpoint to a real edge segment without rotating geometry',()=>{
  const moving=box('moving'),target=box('target',[32,0,0]);
  const snap=resolveSmartSnap(cache([moving],[target]),[15,0,0],2,'edge');
  assert.equal(snap?.kind,'edge');
  assert.deepEqual(snap?.delta,[16,0,0]);
});
test('HF12 snaps a point entity to a brush surface',()=>{
  const moving=entity('light',[0,0,20]);
  const snap=resolveSmartSnap(cache([moving],[box('floor')]),[0,0,-11],2,'face');
  assert.equal(snap?.kind,'surface');
  assert.deepEqual(snap?.delta,[0,0,-12]);
});
test('HF12 never moves locked axes, and distant targets do not attract',()=>{
  const c=cache([box('a')],[box('b',[32,0,0])]);
  assert.equal(resolveSmartSnap(c,[15,0,0],2,'face',[false,true,true]),null);
  assert.equal(resolveSmartSnap(c,[4,0,0],2,'all'),null);
});
test('HF12 excludes hidden and selected objects, and does not mutate the original map',()=>{
  const moving=box('a'),hidden=box('b',[32,0,0],undefined,{hidden:true});
  const locked=box('c',[32,0,0],undefined,{locked:true});
  const before=JSON.stringify([moving,hidden,locked]);
  const c=cache([moving],[moving,hidden,locked]);
  assert.deepEqual(c.targets.map(x=>x.id),['c']);
  resolveSmartSnap(c,[15,0,0],2);
  assert.equal(JSON.stringify([moving,hidden,locked]),before);
});
test('HF12 preserves multi-selection movement as a single translation',()=>{
  const a=box('a'),b=box('b',[0,32,0]),target=box('target',[32,0,0]);
  const c=cache([a,b],[target]);
  const result=resolveSmartSnap(c,[15,0,0],2,'face');
  assert.deepEqual(result?.delta,[16,0,0]);
  assert.ok(c.moving.every(item=>item.id==='a'||item.id==='b'));
});
test('HF12 uses pixel tolerances for perspective and orthographic cameras with safe caps',()=>{
  assert.ok(smartSnapWorldTolerance({fov:60},200,1000,12)>0);
  assert.ok(smartSnapWorldTolerance({isOrthographicCamera:true,top:500,bottom:-500,zoom:1},300,1000,12)>0);
  assert.ok(smartSnapWorldTolerance({fov:90},1e12,1,24)<=128);
});
test('HF12 keeps magnetism off for old saved control configurations',()=>{
  assert.equal(DEFAULT_CONTROLS.smartSnapEnabled,false);
  const saved=globalThis.localStorage;
  try{
    globalThis.localStorage={getItem:()=>JSON.stringify({gizmoSize:.9,smartSnapMode:'invalid'}),setItem(){},removeItem(){}};
    const result=readControls();
    assert.equal(result.smartSnapEnabled,false);
    assert.equal(result.smartSnapMode,'all');
    assert.equal(result.smartSnapPixels,12);
  }finally{if(saved===undefined)delete globalThis.localStorage;else globalThis.localStorage=saved}
});
test('HF12 handles no selected brushes, invalid deltas and empty target sets',()=>{
  assert.equal(resolveSmartSnap(createSmartSnapCache([],[]),[1,0,0],12),null);
  assert.equal(resolveSmartSnap(cache([box('a')],[box('b',[32,0,0])]),[NaN,0,0],12),null);
  assert.equal(resolveSmartSnap(cache([box('a')],[]),[1,0,0],12),null);
});
test('HF12 uses actual rotated faces, never the misleading axis-aligned bounding box',()=>{
  const a={...box('rotated'),rotation:[0,0,45]};
  const b=box('axisAligned',[26,0,0]);
  const result=resolveSmartSnap(cache([a],[b]),[1,0,0],3,'face');
  assert.equal(result,null,'nonparallel face planes must not attract');
});
test('HF12 can place an entity onto a rotated brush surface',()=>{
  const rotated={...box('rotated'),rotation:[0,0,45]};
  const p=entity('marker',[8.2,8.2,0]);
  const result=resolveSmartSnap(cache([p],[rotated]),[-2,-2,0],2,'face');
  assert.equal(result?.kind,'surface');
  const projected=result?.target??[0,0,0];
  assert.ok(Math.abs(projected[0]+projected[1]-Math.SQRT2*8)<.01);
});
