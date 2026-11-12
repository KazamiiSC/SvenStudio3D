import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DEFAULT_ENTITY_APPEARANCE,normalizeEntityAppearance,automaticEntityMarkerKind,markerKindForEntity,markerColorForEntity} from '../src/engine/entityAppearance.ts';
import {entityDisplayName,entityConnectionLabel,connectionSearchText} from '../src/engine/entityNaming.ts';
const here=path.dirname(fileURLToPath(import.meta.url)),r=p=>fs.readFileSync(path.resolve(here,'..',p),'utf8');
const defaults=DEFAULT_ENTITY_APPEARANCE;
test('HF7 settings migrate to automatic appearance without losing original global choice',()=>{
 const settings=normalizeEntityAppearance({markerShape:'diamond',markerSize:.6,colors:defaults.colors});
 assert.equal(settings.markerMode,'automatic');assert.equal(settings.markerShape,'diamond');assert.equal(settings.markerSize,.6);
});
test('uniform selection supersedes special class shapes',()=>{
 const cfg=normalizeEntityAppearance({...defaults,markerMode:'uniform',markerShape:'cone'});
 for(const cls of ['light','func_door','func_button','info_player_start','ambient_generic','trigger_relay','mystery_entity'])assert.equal(markerKindForEntity(cls,cfg),'cone');
});
test('automatic specialized types use distinct shapes',()=>{
 const examples={light:'light',light_spot:'light',func_door:'door',func_door_rotating:'door',func_button:'button',button_target:'button',info_player_start:'capsule',monster_zombie:'capsule',ambient_generic:'speaker',trigger_relay:'relay',trigger_multiple:'trigger',weapon_crowbar:'item'};
 for(const [classname,kind] of Object.entries(examples))assert.equal(automaticEntityMarkerKind(classname),kind,classname);
});
test('unknown FGD classes gracefully use chosen global fallback',()=>{
 assert.equal(automaticEntityMarkerKind('custom_sven_class'),null);
 assert.equal(markerKindForEntity('custom_sven_class',normalizeEntityAppearance({...defaults,markerShape:'bubble'})),'bubble');
});
test('invalid colors and modes are normalized before storage',()=>{
 const cfg=normalizeEntityAppearance({...defaults,markerMode:'broken',colorMode:'uniform',uniformColor:'javascript:alert(1)'});
 assert.equal(cfg.markerMode,'automatic');assert.equal(cfg.uniformColor,defaults.uniformColor);
});
test('color modes do not change entity classname or object data',()=>{
 const cfg=normalizeEntityAppearance({...defaults,colorMode:'uniform',uniformColor:'#123456'});
 assert.equal(markerColorForEntity('light',cfg),'#123456');assert.equal(markerColorForEntity('func_button',cfg),'#123456');
 assert.equal(markerColorForEntity('light',defaults),defaults.colors.light);
});
const door={id:'door-id',kind:'entity',name:'func_door',classname:'func_door',props:{targetname:'door_01'},position:[0,0,0]};
const doorBrush={id:'brush-id',kind:'brush',name:'Puerta del laboratorio',primitive:'box',entityId:'door-id',position:[0,0,0]};
test('naming a linked brush makes its entity findable, even without renaming classname',()=>{
 const objects=[door,doorBrush];assert.equal(entityDisplayName(door,objects),'Puerta del laboratorio');
 assert.match(connectionSearchText(door,objects),/laboratorio/);
 assert.match(entityConnectionLabel(door,objects),/Puerta del laboratorio/);
 assert.match(entityConnectionLabel(door,objects),/func_door/);
 assert.match(entityConnectionLabel(door,objects),/door_01/);
});
test('even a short custom name like Door is honored when explicitly entered',()=>{
  const short={...doorBrush,name:'Door',editorAlias:'Door'};
  assert.equal(entityDisplayName(door,[door,short]),'Door');
});
test('entity alias takes precedence over linked brush alias',()=>{
 const named={...door,name:'Puerta de emergencias'};
 assert.equal(entityDisplayName(named,[named,doorBrush]),'Puerta de emergencias');
 assert.ok(connectionSearchText(named,[named,doorBrush]).includes('laboratorio'));
});
test('missing targetname is shown as automatic and does not mutate engine data',()=>{
 const unlinked={...door,props:{}};const original=JSON.stringify(unlinked);
 assert.match(entityConnectionLabel(unlinked,[unlinked,doorBrush]),/auto targetname/);
 assert.equal(JSON.stringify(unlinked),original);
});
test('context menu can rename brushes and point entities through existing undoable store operation',()=>{
 const menu=r('src/components/ViewportExtras.tsx');
 assert.ok(menu.includes("'Rename in editor…'"));assert.ok(menu.includes('store.updateObject(obj.id,{name,editorAlias:name})'));
 const store=r('src/store.ts');assert.ok(store.includes('updateObject:(id,changes)=>set'));
});
test('quick connection uses native connectGameplay to protect actual target/targetname',()=>{
 const assistant=r('src/components/EntityAssistant.tsx');
 assert.ok(assistant.includes('connectionSearchText(target,objects)')||assistant.includes('connectionSearchText(t,objects)'));
 assert.ok(assistant.includes('connect(entity.id,e.target.value,true)'));
 const properties=r('src/components/Panels.tsx');assert.ok(properties.includes('connectGameplay(point.id,chosen.id,true)'));
});
test('marker modal presents one global picker, automatic/global mode and independent color mode',()=>{
 const ui=r('src/components/EntityAppearanceModal.tsx');
 assert.equal((ui.match(/\{t\('Global marker shape'\)\}/g)||[]).length,1);
 assert.ok(ui.includes('appearance.markerMode'));assert.ok(ui.includes('appearance.colorMode'));
});
test('aliases can be searched in Explorer and Gameplay Studio',()=>{
 const explorer=r('src/components/ExplorerOrganized.tsx'),graph=r('src/components/GameplayStudio.tsx');
 assert.ok(explorer.includes('tree.groups.map(groupNode)'));
 assert.ok(explorer.includes('connectionSearchText(o,objects)'));
 assert.ok(graph.includes('connectionSearchText(e,objects)'));
});
test('brush and entity names remain project metadata, not rewritten in Valve 220 exporter',()=>{
 const type=r('src/engine/types.ts'),exp=r('src/engine/exportMap.ts');
 assert.ok(type.includes("name: string; primitive:"));
 assert.ok(!exp.includes('entityDisplayName'));
});
