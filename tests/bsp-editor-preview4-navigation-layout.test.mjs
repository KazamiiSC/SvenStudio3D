import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bspFlyOrbitTarget} from '../src/engine/bspViewerTools.ts';
import {bspPaneWidth} from '../src/engine/bspPaneLayout.ts';
import {bspIdlePoseInterval,bspNearestMarkerIndices,bspIdlePreviewFrame,bspIdleSequence} from '../src/engine/bspViewerAssets.ts';
const source=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
test('flight handoff target remains directly ahead, preserving position and pitch',()=>{
  assert.deepEqual(bspFlyOrbitTarget([200,55,300],[0,0,-1]),[200,55,140]);
  assert.deepEqual(bspFlyOrbitTarget([-10,180,0],[2,0,0],20),[10,180,0]);
  assert.deepEqual(bspFlyOrbitTarget([100,10,0],[0,0,0]),[100,10,0]);
});
test('left and right panels clamp to view-friendly widths and reject invalid stored data',()=>{
  assert.equal(bspPaneWidth('left',1000,1650,328),470);
  assert.equal(bspPaneWidth('left',0,1650,328),165);
  assert.equal(bspPaneWidth('right',500,900,210),334);
  assert.equal(bspPaneWidth('right',Number.NaN,1650,220),328);
});
test('nearby markers remain visible when their entity indices exceed the first 800 records',()=>{
  const entities=Array.from({length:1000},(_,index)=>({classname:'info_node',origin:[10000+index,0,0]}));
  entities[995]={classname:'monster_zombie',origin:[8,0,0]};
  const indices=bspNearestMarkerIndices(entities,[0,0,0],800);
  assert.ok(indices.includes(995),'nearest entity must be rendered on initial map load');
  const farSelected=bspNearestMarkerIndices(entities,[0,0,0],800,999);
  assert.ok(farSelected.includes(999),'selected entity must remain addressable outside distance budget');
});
test('looping idles are preferred and non-looping poses do not snap back',()=>{
  const seqs=[{name:'idle',available:true,frames:15,fps:15,loop:false},{name:'idle1',available:true,frames:19,fps:15,loop:true}];
  assert.equal(bspIdleSequence(seqs),1);
  assert.equal(bspIdlePreviewFrame(50,{frames:15,fps:15,loop:false}),14);
  assert.equal(bspIdlePreviewFrame(.5,{frames:19,fps:12,loop:true}),6);
});
test('idle pose rate improves old 11fps without unbounded CPU costs',()=>{
  assert.equal(bspIdlePoseInterval(8000),1/30);
  assert.equal(bspIdlePoseInterval(41000),1/24);
  assert.equal(bspIdlePoseInterval(90000),1/18);
});
test('BSP Viewer retains 3D camera on fly exit and docks tools beside inspector',()=>{
  const viewer=source('src/components/BspViewer.tsx');
  assert.match(viewer,/useLayoutEffect\(\(\)=>\{/);
  assert.match(viewer,/bspFlyOrbitTarget\(posePosition\.toArray\(\)/);
  assert.match(viewer,/camera\.position\.copy\(posePosition\);camera\.quaternion\.copy\(poseRotation\)/);
  // Controls remain mounted on flight entry: remounting used to restore stale yaw/pitch.
  assert.doesNotMatch(viewer,/key=\{fly\?'flying':'orbiting'\}/);
  assert.match(viewer,/control.target.copy\(orbitTarget.current\);control.update\(\)/);
  assert.match(viewer,/bsp-content-docked/);
  assert.match(viewer,/bsp-tool-rail/);
  assert.match(viewer,/bsp-panel-splitter/);
  assert.match(viewer,/onPointerMove=\{movePaneResize\}/);
  assert.match(viewer,/bsp-info-docked/);
  assert.match(viewer,/setShowEntities\(true\);setShowLabels\(true\)/);
});
test('model browser uses frame timing rather than old 50ms setInterval',()=>{
  const browser=source('src/components/ModelBrowser.tsx');
  const assets=source('src/components/BspViewerAssets.tsx');
  assert.doesNotMatch(browser,/window\.setInterval\(\(\)=>setFrame/);
  assert.match(browser,/window\.requestAnimationFrame\(step\)/);
  assert.match(assets,/bspIdlePoseInterval\(vertices\)/);
  assert.match(assets,/spawnModelFootHeight\(model,placement\.body\)/);
});
test('CSS contains dock overflow protections and small viewport layout',()=>{
  const css=source('src/style.css');
  assert.match(css,/\.bsp-content-docked\{/);
  assert.match(css,/\.bsp-tool-rail\{/);
  assert.match(css,/\.bsp-info\.bsp-info-docked\{/);
  assert.match(css,/\.bsp-panel-splitter/);
  assert.match(css,/\.bsp-info-docked \.bsp-visual-property/);
});
