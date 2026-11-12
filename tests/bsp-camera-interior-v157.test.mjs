import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bspCameraPose} from '../src/engine/bspViewerTools.ts';
const source=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const room={bounds:{min:[-256,-256,0],max:[256,256,256]},entities:[{classname:'worldspawn',properties:{}},{classname:'info_player_start',origin:[0,0,32],properties:{angle:'0'}}]};
const inBounds=(vec,map)=>vec.every((v,i)=>v>map.bounds.min[i]&&v<map.bounds.max[i]);
const asGame=(three)=>[three[0],-three[2],three[1]];
test('default BSP camera is inside the player room and looks horizontally toward its walls',()=>{
  const pose=bspCameraPose(room);
  assert.equal(pose.view,'interior');
  assert.equal(inBounds(asGame(pose.position),room),true);
  assert.equal(inBounds(asGame(pose.target),room),true);
  assert.ok(Math.hypot(pose.position[0]-pose.target[0],pose.position[2]-pose.target[2])>24);
});
test('exterior view remains available to inspect the whole compiled BSP',()=>{
  const pose=bspCameraPose(room,'overview');
  assert.equal(pose.view,'overview');
  assert.equal(inBounds(asGame(pose.position),room),false);
});
test('rooms without a player spawn still begin inside; large landscapes without spawn begin outside',()=>{
  const noSpawn={...room,entities:[room.entities[0]]};
  assert.equal(bspCameraPose(noSpawn).view,'interior');
  assert.equal(inBounds(asGame(bspCameraPose(noSpawn).position),noSpawn),true);
  const landscape={bounds:{min:[-8000,-8000,-128],max:[8000,8000,4096]},entities:[]};
  assert.equal(bspCameraPose(landscape).view,'overview');
});
test('invalid or outside player spawn does not put the camera outside the map',()=>{
  const invalid={...room,entities:[{classname:'info_player_start',origin:[9999,0,32],properties:{angle:'180'}}]};
  assert.equal(inBounds(asGame(bspCameraPose(invalid).position),room),true);
});
test('both compiled viewers use the same BSP interior camera preset and expose an exterior switch',()=>{
  const bsp=source('src/components/BspViewer.tsx'),preview=source('src/components/TrueLightingPreview.tsx');
  assert.match(bsp,/bspCameraPose\(map,view\)/);
  assert.match(bsp,/view=\{cameraView\}/);
  assert.match(preview,/view=\{cameraView\}/);
  assert.match(preview,/setCameraView\('overview'\)/);
  assert.match(preview,/setCameraView\('interior'\)/);
});
