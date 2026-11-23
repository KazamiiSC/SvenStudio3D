import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBrush} from '../src/engine/geometry.ts';
import {validateBrush} from '../src/engine/exportMap.ts';
import {buildEntityReport,planTargetnameRename,planBulkKeyvalue,entityMatches,entityReferences} from '../src/engine/entityReport.ts';
import {linearArrayBrushes} from '../src/engine/curvedGeometry.ts';
import {projectObjects,pickProjected,dragDelta,project2d} from '../src/engine/orthoProjection.ts';

const ent=(id,classname,props={},extra={})=>({id,kind:'entity',name:id,classname,position:[0,0,0],props:{classname,...props},layer:'Gameplay',...extra});
const map=()=>[
  ent('btn','func_button',{targetname:'b1',target:'door1'}),
  ent('door','func_door',{targetname:'door1'}),
  ent('mm','multi_manager',{targetname:'mm1',door1:'0','door1#2':'2.5',lamp:'1'}),
  ent('relay','trigger_relay',{targetname:'r1',killtarget:'door1',target:'ghost'}),
  ent('wild','trigger_relay',{target:'door*'}),
  ent('beam','env_beam',{LightningStart:'door1',LightningEnd:'lamp'}),
  ent('lamp','light',{targetname:'lamp'}),
];

test('report: incoming counts, multi_manager targets and broken references',()=>{
  const rows=Object.fromEntries(buildEntityReport(map()).map(r=>[r.id,r]));
  assert.equal(rows.door.incoming,5,'button target, 2 multi_manager keys, killtarget, beam start');
  assert.deepEqual(rows.relay.brokenRefs,['target → ghost']);
  assert.deepEqual(rows.wild.brokenRefs,[],'Sven wildcard targets are valid');
  assert.deepEqual(entityReferences(map()[2]).map(r=>r.value).sort(),['door1','door1','lamp']);
  assert.ok(entityMatches(map()[0],'door1')&&entityMatches(map()[0],'FUNC_BUT')&&!entityMatches(map()[0],'nothing'));
});

test('rename updates the targetname and every reference, keeps multi_manager order, skips wildcards',()=>{
  const plan=planTargetnameRename(map(),'door1','gate_a');
  const by=Object.fromEntries(plan.objects.map(o=>[o.id,o]));
  assert.equal(by.door.props.targetname,'gate_a');
  assert.equal(by.btn.props.target,'gate_a');
  assert.equal(by.relay.props.killtarget,'gate_a');
  assert.equal(by.beam.props.LightningStart,'gate_a');
  assert.equal(by.beam.props.LightningEnd,'lamp');
  assert.deepEqual(Object.keys(by.mm.props),['classname','targetname','gate_a','gate_a#2','lamp']);
  assert.equal(by.mm.props['gate_a#2'],'2.5');
  assert.equal(by.wild.props.target,'door*');
  assert.equal(plan.renamedEntities,1);
  assert.equal(plan.updatedReferences,5);
  assert.equal(plan.skippedWildcards,1);
  assert.equal(map()[1].props.targetname,'door1','input is not mutated');
});

test('rename refuses invalid names and skips locked entities',()=>{
  assert.throws(()=>planTargetnameRename(map(),'door1','has space'));
  assert.throws(()=>planTargetnameRename(map(),'door1','door1'));
  assert.throws(()=>planTargetnameRename(map(),'','x'));
  const locked=map().map(o=>o.id==='btn'?{...o,locked:true}:o);
  const plan=planTargetnameRename(locked,'door1','gate');
  assert.equal(plan.skippedLocked,1);
  assert.equal(plan.objects.find(o=>o.id==='btn').props.target,'door1');
});

test('bulk keyvalue sets, removes and protects classname/origin',()=>{
  const set=planBulkKeyvalue(map(),['door','lamp'],'health','50');
  assert.equal(set.changed,2);
  assert.equal(set.objects.find(o=>o.id==='lamp').props.health,'50');
  const removed=planBulkKeyvalue(set.objects,['door'],'health','');
  assert.equal(removed.objects.find(o=>o.id==='door').props.health,undefined);
  assert.throws(()=>planBulkKeyvalue(map(),['door'],'classname','x'));
  assert.throws(()=>planBulkKeyvalue(map(),['door'],'bad key','x'));
  assert.throws(()=>planBulkKeyvalue(map(),['door'],'k','a"b'));
});

const box=(id,pos,size)=>({...createBrush('box',pos,size,id),id});
test('linear array: N copies offset step by step, valid brushes, texture lock, limits',()=>{
  const base=box('step',[0,0,8],[64,128,16]);
  const copies=linearArrayBrushes([base],{offset:[64,0,16],copies:5,yawStep:0});
  assert.equal(copies.length,5);
  assert.deepEqual(copies.map(c=>c.position),[[64,0,24],[128,0,40],[192,0,56],[256,0,72],[320,0,88]]);
  assert.ok(copies.every(c=>validateBrush(c).length===0&&c.id!==base.id));
  const turned=linearArrayBrushes([base],{offset:[0,0,0],copies:3,yawStep:90});
  assert.deepEqual(turned.map(c=>c.rotation[2]),[90,180,270]);
  assert.throws(()=>linearArrayBrushes([base],{offset:[0,0,0],copies:3,yawStep:0}),/overlap/);
  assert.throws(()=>linearArrayBrushes([base],{offset:[64,0,0],copies:0,yawStep:0}));
  assert.throws(()=>linearArrayBrushes([{...base,locked:true}],{offset:[64,0,0],copies:2,yawStep:0}));
});

test('ortho projection: axes, picking smallest object, snapped drag deltas',()=>{
  assert.deepEqual(project2d([10,20,30],'top'),[10,-20]);
  assert.deepEqual(project2d([10,20,30],'front'),[10,-30]);
  assert.deepEqual(project2d([10,20,30],'side'),[20,-30]);
  const objects=[box('big',[0,0,0],[512,512,64]),box('small',[0,0,0],[32,32,32]),{...ent('spawn','info_player_start'),position:[200,0,0]},{...box('hid',[0,0,0],[8,8,8]),hidden:true}];
  const top=projectObjects(objects,'top');
  assert.ok(!top.some(p=>p.id==='hid'),'hidden objects are not drawn');
  assert.equal(pickProjected(top,0,0,4),'small');
  assert.equal(pickProjected(top,200,0,4),'spawn');
  assert.equal(pickProjected(top,9999,0,4),null);
  assert.deepEqual(dragDelta('top',37,-70,16),[32,64,0]);
  assert.deepEqual(dragDelta('front',33,-20,16),[32,0,16]);
  assert.deepEqual(dragDelta('side',0,40,0),[0,0,-40]);
});

test('wiring: report in Studios menu, skybox reuses the BSP Viewer loader, 4 views are optional',()=>{
  const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
  const viewport=readFileSync(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8');
  const assets=readFileSync(new URL('../src/components/BspViewerAssets.tsx',import.meta.url),'utf8');
  const quick=readFileSync(new URL('../src/components/ViewportQuickActions.tsx',import.meta.url),'utf8');
  assert.match(app,/setDialog\('entityReport'\)/);
  assert.match(app,/\{dialog==='entityReport'&&<EntityReport/);
  assert.match(assets,/export function BspSkyBackground[\s\S]*<SkyboxBackground skyname=\{map\.skyname\}/);
  assert.match(viewport,/<SkyboxBackground skyname=\{skyname\} gameDir=\{gameDir\}/);
  assert.match(app,/settings\.quadView&&!walkMode&&<ErrorBoundary label="4 views" compact><OrthoViews\/>/);
  assert.match(quick,/setSettings\(\{quadView:!s\.settings\.quadView\}\)/);
  assert.match(quick,/setSettings\(\{editorSkybox:!s\.settings\.editorSkybox\}\)/);
});
