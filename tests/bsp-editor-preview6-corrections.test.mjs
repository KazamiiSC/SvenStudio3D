import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {bspToggleSelection} from '../src/engine/bspSelection.ts';
import {interpolateBoneFrames} from '../src/engine/mdl.ts';
import {bspPreviewGroundPosition,bspShouldGroundPreview} from '../src/engine/bspViewerAssets.ts';
const viewer=readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
const modelView=readFileSync(new URL('../src/components/BspViewerAssets.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');

test('multiple selections: first, add, remove, and primary promotion',()=>{
 let value={primary:null,additional:[]};
 value=bspToggleSelection(value,12,true);
 assert.deepEqual(value,{primary:12,additional:[]});
 value=bspToggleSelection(value,20,true);
 value=bspToggleSelection(value,24,true);
 assert.deepEqual(value,{primary:12,additional:[20,24]});
 value=bspToggleSelection(value,20,true);
 assert.deepEqual(value,{primary:12,additional:[24]});
 value=bspToggleSelection(value,12,true);
 assert.deepEqual(value,{primary:24,additional:[]});
 value=bspToggleSelection(value,30,false);
 assert.deepEqual(value,{primary:30,additional:[]});
 value=bspToggleSelection(value,30,true);
 assert.deepEqual(value,{primary:null,additional:[]});
});
test('selection blocks worldspawn and invalid indices',()=>{
 const current={primary:3,additional:[5]};
 assert.equal(bspToggleSelection(current,0,false),current);
 assert.equal(bspToggleSelection(current,-1,true),current);
 assert.equal(bspToggleSelection(current,Number.NaN,true),current);
});
test('rotations across the wrap use the shortest path instead of flipping limbs',()=>{
 const from=[0,0,0,0,0,179*Math.PI/180];
 const to=[10,0,0,0,0,-179*Math.PI/180];
 const m=interpolateBoneFrames(from,to,.5),position=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();
 m.decompose(position,q,scale);
 assert.ok(Math.abs(position.x-5)<1e-6);
 const turned=new THREE.Vector3(1,0,0).applyQuaternion(q);
 assert.ok(turned.x<-.99,`Expected a 180 degree rotation rather than a zero-degree limb snap, got ${turned.x}`);
});
test('studio pose rejects invalid skeleton before touching shared mesh',()=>{
 assert.match(modelView,/pose\.some\(m=>!m\.elements\.every\(Number\.isFinite\)\)/);
 assert.match(viewer,/finalFlyPose\.current=\{position:camera\.position\.clone\(\),rotation:camera\.quaternion\.clone\(\)\}/);
 assert.match(viewer,/handoffFrames\.current=3/);
 assert.match(viewer,/camera\.updateMatrixWorld\(\)/);
});
test('ground only plausible previews; items and NPCs are allowed, sky sprites not',()=>{
 assert.equal(bspShouldGroundPreview('item_battery'),true);
 assert.equal(bspShouldGroundPreview('ammo_9mmbox'),true);
 assert.equal(bspShouldGroundPreview('weapon_satchel'),true);
 assert.equal(bspShouldGroundPreview('env_sprite'),false);
 assert.equal(bspPreviewGroundPosition(54,0,-8,'item_battery'),8.5);
 assert.equal(bspPreviewGroundPosition(250,0,-8,'item_battery'),250);
 assert.equal(bspPreviewGroundPosition(54,0,-8,'env_sprite'),54);
 assert.equal(bspPreviewGroundPosition(54,null,-8,'item_battery'),54);
});
test('quick actions return search/creation and model library to toolbar',()=>{
 for(const token of ["jumpToInspector('search')","jumpToInspector('create')","setModelLibraryOpen(true)","setMultiSelectMode(v=>!v)",'extend||multiSelectMode','ref={entitySearchRef}','ref={entityCreateRef}'])assert.ok(viewer.includes(token),`Missing ${token}`);
 assert.ok(css.includes('.bsp-quick-access'));
});
