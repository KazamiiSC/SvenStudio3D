import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const { importedBrushEntityAnchor } = await import('../src/engine/brushEntityAnchor.ts');
const importSource = readFileSync(new URL('../src/engine/importMap.ts', import.meta.url), 'utf8');
const exportSource = readFileSync(new URL('../src/engine/exportMap.ts', import.meta.url), 'utf8');
const originalMap = readFileSync(new URL('./fixtures/brush-entities-without-origin.map', import.meta.url), 'utf8');

function box(center, sizes, entityId='door') {
  const offsets = [-1,1];
  const vertices=[];
  for (const dx of offsets) for (const dy of offsets) for (const dz of offsets)
    vertices.push([dx*sizes[0]/2,dy*sizes[1]/2,dz*sizes[2]/2]);
  return {kind:'brush', entityId, position:center, vertices};
}

test('one non-origin brush anchors the marker at its world-space bounds center',()=>{
  const result=importedBrushEntityAnchor([box([-268.26,-2,58.766],[12,92,116])]);
  assert.ok(result);
  for (const [i, value] of [-268.26,-2,58.766].entries()) assert.ok(Math.abs(result[i]-value)<1e-8);
});
test('union of multiple entity brushes uses combined bounds (not first brush or origin)',()=>{
  const a=box([100,200,25],[20,20,50]);
  const b=box([240,200,75],[20,20,50]);
  assert.deepEqual(importedBrushEntityAnchor([a,b]),[170,200,50]);
});
test('empty brush entity has no synthetic anchor; point entities unaffected',()=>{
  assert.equal(importedBrushEntityAnchor([]),null);
});
test('zero-area or degenerate data cannot invent a bogus position',()=>{
  assert.equal(importedBrushEntityAnchor([{...box([0,0,0],[12,12,12]),vertices:[[NaN,0,0]]}]),null);
});
test('MAP importer anchors only brush entities with no explicit origin; keeps real origin',()=>{
  assert.match(importSource,/kv\.origin === undefined/);
  assert.match(importSource,/let entity:PointEntity\|undefined/);
  assert.match(importSource,/entity\.position=anchor/);
  assert.match(importSource,/importedBrushEntityAnchor\(linkedBrushes\)/);
});
test('export never adds origin keyvalue for a brush entity',()=>{
  assert.match(exportSource,/if\(!\(groups\[e\.id\]\|\|\[\]\)\.length\)props\.origin=/);
});
test('round-trip fixture from uploaded MAP has func_button and func_door solids but no explicit origin; point spawn does',()=>{
  const door=originalMap.split('"classname" "func_door"')[1]?.split('}\n}')[0];
  const button=originalMap.split('"classname" "func_button"')[1]?.split('}\n}')[0];
  assert.ok(door?.includes('LAB1_DOOR1'));
  assert.ok(button?.includes('+0BUTTON3'));
  assert.doesNotMatch(door,/"origin"/);
  assert.doesNotMatch(button,/"origin"/);
  assert.match(originalMap,/"classname" "info_player_start"\s*"origin" "0 0 48"/);
});


test('actual MAP plane coordinates reproduce door and button anchors away from world origin',()=>{
  for (const [classname, expected] of [
    ['func_door',[-268.26,-2,58.766]],
    ['func_button',[-230.074,75.715,66]],
  ]) {
    const body=originalMap.split(`"classname" "${classname}"`)[1]?.split('}\n}')[0];
    assert.ok(body);
    const points=[...body.matchAll(/\(\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\)/g)].map(m=>m.slice(1,4).map(Number));
    assert.ok(points.length>=12);
    const min=[0,1,2].map(i=>Math.min(...points.map(p=>p[i])));
    const max=[0,1,2].map(i=>Math.max(...points.map(p=>p[i])));
    const center=min.map((value,i)=>(value+max[i])/2);
    const brush={position:center,vertices:points.map(p=>p.map((v,i)=>v-center[i]))};
    const actual=importedBrushEntityAnchor([brush]);
    assert.ok(actual);
    for (let i=0;i<3;i++) assert.ok(Math.abs(actual[i]-expected[i])<.15,`${classname} axis ${i}: ${actual[i]}`);
    assert.ok(Math.hypot(...actual)>200,`${classname} should NOT be at the map origin`);
  }
});
