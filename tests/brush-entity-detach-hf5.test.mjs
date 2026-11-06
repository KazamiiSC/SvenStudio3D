import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {planBrushEntityDetach,detachBrushEntities} from '../src/engine/brushEntityDetach.ts';
const face={indices:[0,1,2],texture:'+0BUTTON3',uShift:12.5,vShift:-43,uScale:.375,vScale:-.5,uAxis:[0,1,0],vAxis:[0,0,1]};
const brush=(id,entityId,extra={})=>({kind:'brush',id,name:id,primitive:'box',position:[1,2,3],rotation:[0,0,0],scale:[1,1,1],vertices:[[0,0,0],[1,0,0],[0,1,0]],faces:[structuredClone(face)],layer:'Geometry',group:'Prefab Door',...(entityId?{entityId}:{}),...extra});
const entity=(id,classname,extra={})=>({kind:'entity',id,name:classname,classname,props:{targetname:id+'_name',target:'relay_1',spawnflags:'1'},position:[0,0,0],...extra});
const initial=()=>[brush('b1','e1'),brush('b2','e1'),brush('b3','e2'),brush('world'),entity('e1','func_train'),entity('e2','trigger_push'),entity('light','light')];

test('single brush from multi-brush entity becomes worldspawn; entity and other brushes stay',()=>{
 const objects=initial(),{objects:out,plan}=detachBrushEntities(objects,['b1']);
 assert.deepEqual(plan.brushIds,['b1']);
 assert.equal(plan.removedEntities.length,0);
 assert.equal(out.find(o=>o.id==='b1').entityId,undefined);
 assert.equal(out.find(o=>o.id==='b2').entityId,'e1');
 assert.deepEqual(out.find(o=>o.id==='e1'),objects.find(o=>o.id==='e1'));
 assert.deepEqual(out.find(o=>o.id==='b1').faces,objects.find(o=>o.id==='b1').faces);
 assert.deepEqual(out.find(o=>o.id==='b1').vertices,objects.find(o=>o.id==='b1').vertices);
 assert.equal(out.length,objects.length);
});
test('whole multi-brush entity detaches all and removes orphan entity, leaving world brushes',()=>{
 const objects=initial(),{objects:out,plan}=detachBrushEntities(objects,['b2'],true);
 assert.deepEqual(new Set(plan.brushIds),new Set(['b1','b2']));
 assert.deepEqual(plan.removedEntities.map(e=>e.classname),['func_train']);
 assert.equal(out.some(o=>o.id==='e1'),false);
 assert.equal(out.filter(o=>o.kind==='brush').length,4);
 assert.equal(out.find(o=>o.id==='b1').entityId,undefined);
 assert.equal(out.find(o=>o.id==='b2').entityId,undefined);
 assert.deepEqual(out.find(o=>o.id==='b3'),objects.find(o=>o.id==='b3'));
});
test('entity-selected detaches all its brushes (not just func_door/button)',()=>{
 for(const classname of ['func_wall','func_breakable','func_rotating','func_tank','trigger_hurt','trigger_multiple','func_conveyor']){
  const out=detachBrushEntities([brush('b','solid'),entity('solid',classname)],['solid']);
  assert.equal(out.objects.length,1);
  assert.equal(out.objects[0].entityId,undefined);
 }
});
test('mixed multi-select detaches only linked brushes and preserves unrelated point entities',()=>{
 const objects=initial(),{objects:out,plan}=detachBrushEntities(objects,['b1','b3','world','light']);
 assert.deepEqual(new Set(plan.brushIds),new Set(['b1','b3']));
 assert.deepEqual(plan.removedEntities.map(e=>e.id),['e2']);
 assert.ok(out.some(o=>o.id==='light'));
 assert.ok(out.some(o=>o.id==='e1'));
});
test('no-op for already world brushes does not alter source',()=>{
 const objects=initial(),{objects:out,plan}=detachBrushEntities(objects,['world']);
 assert.equal(plan.brushIds.length,0);
 assert.deepEqual(out,objects);
});
test('invalid dangling entityId can be cleared without losing its brush',()=>{
 const objects=[brush('dangling','missing')],{objects:out}=detachBrushEntities(objects,['dangling']);
 assert.equal(out.length,1);assert.equal(out[0].entityId,undefined);
});
test('locked selected brush is rejected atomically',()=>{
 const objects=[brush('b','e',{locked:true}),entity('e','func_wall')];
 assert.throws(()=>detachBrushEntities(objects,['b']),/Unlock/);
 assert.equal(objects[0].entityId,'e');
});
test('whole-entity detach rejects a locked member atomically',()=>{
 const objects=[brush('b1','e'),brush('b2','e',{locked:true}),entity('e','func_wall')];
 assert.throws(()=>detachBrushEntities(objects,['b1'],true),/Unlock/);
 assert.equal(objects[0].entityId,'e');
});
test('removing last brush from locked entity is rejected, partial detach still possible',()=>{
 const objects=[brush('b1','e'),brush('b2','e'),entity('e','func_train',{locked:true})];
 assert.equal(detachBrushEntities(objects,['b1']).objects.length,3);
 assert.throws(()=>detachBrushEntities(objects,['b1'],true),/Unlock/);
});
test('does not mutate source objects or touch UV, geometry, hidden or metadata',()=>{
 const objects=[brush('b','e',{hidden:true}),entity('e','func_detail')];
 const before=structuredClone(objects),out=detachBrushEntities(objects,['b']).objects;
 assert.deepEqual(objects,before);
 for(const key of ['vertices','faces','position','rotation','scale','hidden','group','layer'])assert.deepEqual(out[0][key],before[0][key]);
});
test('store uses one undoable mutate call and UI exposes contextual plus property workflows',()=>{
 const store=readFileSync(new URL('../src/store.ts',import.meta.url),'utf8');
 const props=readFileSync(new URL('../src/components/Panels.tsx',import.meta.url),'utf8');
 const context=readFileSync(new URL('../src/components/ViewportExtras.tsx',import.meta.url),'utf8');
 const exportMap=readFileSync(new URL('../src/engine/exportMap.ts',import.meta.url),'utf8');
 assert.match(store,/detachBrushEntities:\(ids,wholeEntity=false\)=>set\(s=>/);
 assert.match(store,/\.\.\.mutate\(s,objects\),selected:/);
 assert.match(context,/Detach brush from entity \(worldspawn\)/);
 assert.match(context,/Convert linked brushes to worldspawn/);
 assert.match(props,/Detach selected brushes/);
 assert.match(props,/Detach entire entity/);
 assert.match(exportMap,/!o\.entityId/);
});
