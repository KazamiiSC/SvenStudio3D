import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bspEntityCategory,clampBspFloatingPosition,clampBspFloatingSize,clampBspFloatingRect,bspFloatingNearClick,parseBspFloatingPosition,parseBspFloatingSize} from '../src/engine/bspVisualInspectorLayout.ts';
const viewer=readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
test('classifies NPC, triggers, solid brush entities and pickups without deleting any',()=>{
 assert.equal(bspEntityCategory('monster_alien_grunt'),'npc');assert.equal(bspEntityCategory('squadmaker'),'npc');
 assert.equal(bspEntityCategory('ammo_9mmbox'),'items');assert.equal(bspEntityCategory('weapon_crowbar'),'weapons');
 assert.equal(bspEntityCategory('func_door'),'geometry');assert.equal(bspEntityCategory('trigger_once'),'triggers');
 assert.equal(bspEntityCategory('light_spot'),'environment');assert.equal(bspEntityCategory('multi_manager'),'logic');
});
test('floating panel remains reachable on small viewports',()=>{
 assert.deepEqual(clampBspFloatingPosition({x:10000,y:-30},600,600),{x:218,y:4});
 const p=bspFloatingNearClick({x:555,y:240},850,700);assert.ok(p.x<555 && p.y>=4);
 assert.deepEqual(parseBspFloatingPosition('{"x":140,"y":45}'),{x:140,y:45});
 for(const bad of ['{','{"x":null,"y":2}','{"x":-999999999,"y":1}'])assert.equal(parseBspFloatingPosition(bad),null);
});
test('BSP editor provides draggable floating properties and paginated categorized browser',()=>{
 assert.match(viewer,/bsp-floating-inspector/);assert.match(viewer,/onPointerMove=\{dragBspProperties\}/);
 assert.match(viewer,/bsp-entity-browser-grid/);assert.match(viewer,/browsePage/);
 assert.match(viewer,/setPropertiesOpen\(true\)/);assert.match(viewer,/bsp-fgd-tabs/);
 assert.match(css,/\.bsp-floating-inspector/);assert.match(css,/\.bsp-entity-browser-grid/);
});
test('BSP rotation gizmo uses a compact pair of curved arrows and a generous grab zone',()=>{
 const section=viewer.split('/** Compact rotating two-arc handle.')[1]?.split('/** Commit a keyvalue')[0] || '';
 assert.match(section,/geometry=\{rotationArcs\}/);
 assert.match(section,/bspRotationArcTriangles/);
 assert.match(section,/BSP_RING_VISUAL\.grabInnerRadius/);
 assert.match(section,/BSP_RING_VISUAL\.grabOuterRadius/);
 assert.match(section,/onPointerDown=\{beginRing\}/);
 assert.match(section,/onPointerMove=\{moveRing\}/);
 assert.match(section,/setPointerCapture/);
 assert.match(section,/Yaw:/);
 assert.doesNotMatch(section,/<coneGeometry|compassTicks|ringGeometry args=\{\[35,48,96\]\}/);
 assert.match(section,/mode==='translate'&&<TransformControls/);
});

test('Fly WASD is immediately before Search entities, with a distinct outline',()=>{
 const toolbar=viewer.split('className="bsp-toolbar bsp-toolbar-compact bsp-toolbar-split"')[1]?.split('className="bsp-content')[0]||'';
 const search=toolbar.indexOf("title={t('Search entities...')}");
 const flight=toolbar.indexOf('bsp-fly-button');
 const place=toolbar.indexOf("title={t('Place point entity')}");
 assert.ok(flight>=0&&search>flight&&place>search);
 assert.match(toolbar,/bsp-fly-priority/);
 assert.match(css,/\.bsp-toolbar-end \.bsp-fly-button\.bsp-fly-priority/);
});

test('resizable property window persists valid dimensions and never leaves the viewport',()=>{
 assert.deepEqual(parseBspFloatingSize('{"width":640,"height":580}'),{width:640,height:580});
 for(const bad of ['not-json','{"width":-40,"height":500}','{"width":null,"height":440}','{"width":600,"height":9000}'])assert.equal(parseBspFloatingSize(bad),null);
 assert.deepEqual(clampBspFloatingSize({width:640,height:580},1200,900),{width:640,height:580});
 assert.deepEqual(clampBspFloatingSize({width:900,height:800},600,400),{width:588,height:388});
 assert.deepEqual(clampBspFloatingSize({width:120,height:120},1000,800),{width:300,height:230});
 assert.deepEqual(clampBspFloatingRect({x:950,y:740},{width:640,height:580},1200,900),{x:552,y:312});
 assert.deepEqual(clampBspFloatingRect({x:-10,y:0},{width:640,height:580},1200,900),{x:4,y:4});
 assert.match(viewer,/bsp-floating-inspector-resize/);
 assert.match(viewer,/onPointerDown=\{beginBspPropertiesResize\}/);
 assert.match(viewer,/onPointerMove=\{dragBspPropertiesResize\}/);
 assert.match(viewer,/sven-bsp-floating-properties-size-v1/);
 assert.match(css,/\.bsp-floating-inspector-resize/);
});
test('yaw display remains near the compact handle',()=>{
 const section=viewer.split('/** Compact rotating two-arc handle.')[1]?.split('/** Commit a keyvalue')[0] || '';
 assert.match(section,/<Html position=\{\[0,27,0\]\}/);
});
