import test from 'node:test';
import assert from 'node:assert/strict';
import {validateBrush,exportMap,validateProject} from '../src/engine/exportMap.ts';
import {transformedVertices} from '../src/engine/geometry.ts';
import {KIT_DEFINITIONS,buildKit,kitPreviewBrushes} from '../src/engine/svenKits.ts';

const project=objects=>({version:1,name:'kits',objects,world:{},wadNames:[]});

test('every Sven kit builds valid, exportable brushes and entities', ()=>{
  for(const def of KIT_DEFINITIONS){
    for(const yaw of ['0','90','180','270']){
      const {objects,summary}=buildKit(def.id,{...def.defaults,yaw},[256,-128,64],[], 'SV_BRICK01');
      assert.ok(objects.length>0,def.id);
      assert.ok(summary.entities+summary.brushes>0,`${def.id} creates something`);
      const ids=new Set(objects.filter(o=>o.kind==='entity').map(o=>o.id));
      for(const o of objects){
        if(o.kind!=='brush')continue;
        assert.deepEqual(validateBrush(o),[],`${def.id}/${yaw} ${o.name}`);
        if(o.entityId)assert.ok(ids.has(o.entityId),`${def.id}: brush ${o.name} owner exists`);
        assert.deepEqual(o.rotation,[0,0,0]);
      }
      const map=exportMap(project(objects));
      assert.match(map,/"classname" "worldspawn"/);
      assert.equal(validateProject(project(objects)).filter(x=>/error/i.test(x)).length,0,def.id);
    }
  }
});

test('kits never reuse a targetname that already exists in the map', ()=>{
  const first=buildKit('checkpoint',{},[0,0,0],[]).objects;
  const second=buildKit('checkpoint',{},[512,0,0],first).objects;
  const names=o=>o.filter(x=>x.kind==='entity'&&x.props.targetname).map(x=>x.props.targetname);
  for(const n of names(second).filter(n=>/^checkpoint_\d+$/.test(n)))assert.ok(!names(first).includes(n),n);
});

test('door kit wiring follows the chosen opening mode', ()=>{
  const ents=(opts)=>buildKit('door',opts,[0,0,0],[]).objects.filter(o=>o.kind==='entity');
  const prox=ents({open:'proximity'});
  const door=prox.find(e=>e.classname==='func_door');const trig=prox.find(e=>e.classname==='trigger_multiple');
  assert.equal(trig.props.target,door.props.targetname);
  const key=ents({open:'key',keyName:'card_blue'});
  assert.equal(key.find(e=>e.classname==='func_door').props.item_name_required,'card_blue');
  assert.ok(key.some(e=>e.classname==='item_inventory'&&e.props.item_name==='card_blue'));
  const keyDouble=ents({open:'key',double:true,keyName:'k1'});
  assert.ok(keyDouble.some(e=>e.classname==='func_button'&&e.props.item_name_required==='k1'),'double doors carry the rule on a button');
  const rot=buildKit('door',{style:'rotating',glass:true},[0,0,0],[]).objects;
  const leaves=rot.filter(o=>o.kind==='entity'&&o.classname==='func_door_rotating');
  assert.equal(leaves.length,2,'leaf + glass pane');
  for(const l of leaves)assert.ok(rot.some(b=>b.kind==='brush'&&b.entityId===l.id&&b.faces[0].texture==='ORIGIN'),'origin brush per leaf');
  assert.equal(new Set(leaves.map(l=>l.props.targetname)).size,1);
  const npc=ents({open:'npcOnly'});assert.equal(npc.find(e=>e.classname==='func_door').props.m_iOpenFlags,'2');
});

test('sliding glass pane travels the same distance as its leaf', ()=>{
  const objs=buildKit('door',{glass:true,style:'sliding',width:64},[0,0,0],[]).objects;
  const leaves=objs.filter(o=>o.kind==='entity'&&o.classname==='func_door');
  const width=e=>{const xs=objs.filter(b=>b.kind==='brush'&&b.entityId===e.id).flatMap(b=>transformedVertices(b).map(v=>v[0]));return Math.max(...xs)-Math.min(...xs);};
  const travel=e=>width(e)-Number(e.props.lip||0);
  assert.equal(Math.round(travel(leaves[0])),Math.round(travel(leaves[1])));
});

test('elevator stops cycle through every floor and open the floor doors', ()=>{
  const objs=buildKit('elevator',{floors:3,doors:true},[0,0,0],[]).objects.filter(o=>o.kind==='entity');
  const paths=objs.filter(e=>e.classname==='path_corner');
  assert.equal(paths.length,4);
  const byName=new Map(paths.map(p=>[p.props.targetname,p]));
  for(const p of paths)assert.ok(byName.has(p.props.target),'closed loop');
  for(const p of paths)assert.ok(objs.some(e=>e.classname==='func_door'&&e.props.targetname===p.props.message),'door fired on arrival');
});

test('preview adds a marker for point entities only', ()=>{
  const {objects}=buildKit('sparks',{},[0,0,0],[]);
  assert.equal(kitPreviewBrushes(objects).length,1);
});

test('phase 3 kits wire their entities together', ()=>{
  const ents=(id,o={})=>buildKit(id,o,[0,0,0],[]).objects.filter(x=>x.kind==='entity');
  const v=ents('vending');const bev=v.find(e=>e.classname==='env_beverage');
  assert.equal(v.find(e=>e.classname==='func_button').props.target,bev.props.targetname);
  const t=ents('turret',{mode:'player'});const tank=t.find(e=>e.classname==='func_tank');
  assert.equal(t.find(e=>e.classname==='func_tankcontrols').props.target,tank.props.targetname);
  assert.equal(tank.props.spawnflags,'32');
  const laser=ents('turret',{weapon:'laser',mode:'auto'});
  assert.equal(laser.find(e=>e.classname==='func_tanklaser').props.laserentity,laser.find(e=>e.classname==='env_laser').props.targetname);
  const tp=ents('teleporter',{twoWay:true});const dests=new Set(tp.filter(e=>e.classname==='info_teleport_destination').map(e=>e.props.targetname));
  const pads=tp.filter(e=>e.classname==='trigger_teleport');assert.equal(pads.length,2);for(const p of pads)assert.ok(dests.has(p.props.target));
  const cams=ents('securityCamera',{cameras:3});const names=new Set(cams.filter(e=>e.classname==='trigger_camera').map(e=>e.props.targetname));
  assert.equal(names.size,3);for(const b of cams.filter(e=>e.classname==='func_button'))assert.ok(names.has(b.props.target));
  const mon=ents('monitor');assert.equal(mon.find(e=>e.classname==='func_breakable').props.killtarget,mon.find(e=>e.classname==='env_sprite').props.targetname);
});

test('phase 4: changelevel kit, optimisation assistant and lights.rad bridge', async ()=>{
  const cl=buildKit('changelevel',{map:'next_map',mode:'touch',percent:75},[0,0,0],[]).objects.filter(o=>o.kind==='entity');
  const t=cl.find(e=>e.classname==='trigger_changelevel');assert.equal(t.props.map,'next_map');assert.equal(t.props.percent_of_players,'75');assert.equal(t.props.keep_inventory,'1');
  const btn=buildKit('changelevel',{map:'m2',mode:'button',countdown:4},[0,0,0],[]).objects.filter(o=>o.kind==='entity');
  const mm=btn.find(e=>e.classname==='multi_manager');const lvl=btn.find(e=>e.classname==='trigger_changelevel');
  assert.equal(mm.props[lvl.props.targetname],'4');assert.equal(lvl.props.spawnflags,'2');
  assert.throws(()=>buildKit('changelevel',{map:'bad name!'},[0,0,0],[]));
  const {analyzeOptimization,convertToDetail}=await import('../src/engine/mapOptimizer.ts');
  const {createBrush}=await import('../src/engine/geometry.ts');
  const objects=[createBrush('box',[0,0,0],[1024,1024,16]),createBrush('box',[0,0,24],[16,16,32]),createBrush('box',[64,0,24],[24,24,24])];
  const project={version:1,name:'opt',objects,world:{},wadNames:[]};
  const r=analyzeOptimization(project);const detail=r.findings.find(f=>f.id==='detail');
  assert.deepEqual(new Set(detail.ids),new Set([objects[1].id,objects[2].id]),'only the small brushes are detail candidates');
  const conv=convertToDetail(objects,detail.ids);
  assert.equal(conv.objects.filter(o=>o.kind==='brush'&&o.entityId===conv.entityId).length,2);
  assert.equal(conv.objects.find(o=>o.id===conv.entityId).classname,'func_detail');
  assert.ok(!analyzeOptimization({...project,objects:conv.objects}).findings.some(f=>f.id==='detail'));
  const {parseLightsRad,formatLightsRad,mergeRadEntries,emissiveCandidates}=await import('../src/engine/advancedLighting.ts');
  const p=parseLightsRad('// comment\n+0~LIGHT6A 255 235 198 800\n~LAB1 180 200 255 1500\nbroken line');
  assert.equal(p.entries.length,2);assert.equal(p.errors.length,1);
  const props=mergeRadEntries({targetname:'tl'},p.entries);
  assert.equal(formatLightsRad(props),'+0~LIGHT6A 255 235 198 800\n~LAB1 180 200 255 1500\n');
  assert.deepEqual(emissiveCandidates(['~LAB1','C1A0_LABFLRA','FLUOR_PANEL','SKY'],['~lab1']),['FLUOR_PANEL']);
});
