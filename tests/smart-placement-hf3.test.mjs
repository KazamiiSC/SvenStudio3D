import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {snappedFacing,rotatedPointZ,surfacePlacementAnchor,axisDrawnBox} from '../src/engine/smartPlacementMath.ts';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=(file)=>readFileSync(resolve(root,file),'utf8');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6,`${a} ≠ ${b}`);
test('orientation follows all four wall normals',()=>{
  near(snappedFacing([0,1,0]),0);
  near(snappedFacing([1,0,0]),-90);
  near(snappedFacing([0,-1,0]),-180);
  near(snappedFacing([-1,0,0]),90);
});
test('rotations preserve height, original points and support 15°',()=>{
  const point=[30,0,8];const rotated=rotatedPointZ(point,90);
  near(rotated[0],0);near(rotated[1],30);near(rotated[2],8);
  const r15=rotatedPointZ(point,15);near(Math.hypot(r15[0],r15[1]),30);
  assert.deepEqual(point,[30,0,8]);
});
test('surface alignment anchors walls without burying the geometry',()=>{
  const local=[[-4,-2,0],[4,-2,10],[-4,2,0],[4,2,10]];
  const anchor=surfacePlacementAnchor([100,80,70],[1,0,0],local);
  near(anchor[0],104.5);near(anchor[1],80);near(anchor[2],65);
  const floor=surfacePlacementAnchor([10,20,40],[0,0,1],local);near(floor[2],40.5);
  const ceiling=surfacePlacementAnchor([10,20,40],[0,0,-1],local);near(ceiling[2],29.5);
});
test('drawing supports all three orthogonal planes',()=>{
  for(const axis of ['xy','xz','yz']){
    const b=axisDrawnBox([0,0,0],[32,16,48],8,axis,4);
    const orth=axis==='xy'?2:axis==='xz'?1:0;
    near(b.size[orth],8);near(b.center[orth],4);
    assert.ok(b.size.every(n=>n>0));
  }
});
test('shape ghost and commit share orientation and coordinates',()=>{
  const viewport=source('src/components/Viewport.tsx'),store=source('src/store.ts');
  assert.match(viewport,/rotateObjectsForPlacement\(initial,\[0,0,0\],axis,angle,hoverYaw\)/);
  assert.match(store,/rotateObjectsForPlacement\(shape,position,s\.placementAxis,s\.placementAngle,autoYaw\)/);
  assert.match(viewport,/placeShapeAt\(result\.anchor,result\.autoYaw\)/);
});
test('prefabs rotate around their own pivot and preserve entity links',()=>{
  const prefab=source('src/engine/prefabs.ts');
  assert.match(prefab,/const placed=rotateObjectsForPlacement\(objects,at,axis,angle,autoYaw\)/);
  assert.match(prefab,/clone\.entityId=ids\.get\(clone\.entityId\)/);
  assert.match(prefab,/lockTranslatedBrushTextures/);
});
test('contextual placement keyboard handlers do not capture Ctrl shortcuts',()=>{
  const viewport=source('src/components/Viewport.tsx');
  assert.match(viewport,/event\.altKey\|\|event\.ctrlKey\|\|event\.metaKey/);
  assert.match(viewport,/event\.code==='KeyR'/);
  assert.match(viewport,/event\.code==='KeyF'/);
  assert.match(viewport,/event\.code==='Digit0'/);
  assert.match(viewport,/event\.code==='KeyP'/);
  assert.match(viewport,/event\.code==='KeyX'/);
  assert.match(viewport,/event\.code==='KeyY'/);
  assert.match(viewport,/\['KeyX','KeyY','KeyZ'\]/);
});
test('fullscreen keyboard lock is opt-in and provides explicit exit',()=>{
  const app=source('src/App.tsx');
  const viewport=source('src/components/Viewport.tsx');
  assert.match(app,/requestFullscreen/);
  assert.match(app,/document\.exitFullscreen\(\)/);
  assert.match(app,/keyboard\?\.unlock\?\.\(\)/);
  assert.match(app,/document\.fullscreenElement&&event\.ctrlKey&&event\.code==='KeyD'/);
  assert.match(app,/<FullscreenMenuButton\/>/);
  assert.doesNotMatch(viewport,/onClick=\{toggleImmersive\}/);
});
