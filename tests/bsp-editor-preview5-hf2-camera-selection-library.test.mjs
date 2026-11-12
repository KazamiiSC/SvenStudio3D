import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('flight reentry keeps one OrbitControls instance and reconciles target with current camera yaw/pitch',()=>{
 const code=source('src/components/BspViewer.tsx');
 assert.doesNotMatch(code,/key=\{fly\?'flying':'orbiting'\}/);
 assert.match(code,/const posePosition=camera.position.clone\(\),poseRotation=camera.quaternion.clone\(\)/);
 assert.match(code,/forward.set\(0,0,-1\).applyQuaternion\(poseRotation\).normalize\(\)/);
 assert.match(code,/orbitTarget.current.set\(\.\.\.bspFlyOrbitTarget\(posePosition.toArray\(\),forward.toArray\(\)\)\)/);
 assert.match(code,/camera.position.copy\(posePosition\);camera.quaternion.copy\(poseRotation\);camera.updateMatrixWorld\(\)/);
 assert.match(code,/handoffFrames.current=3/); // exit correction retained
});

test('all selected BSP point entities keep colored selection rings despite marker budget',()=>{
 const code=source('src/components/BspViewer.tsx');
 assert.match(code,/new Set\(\[\.\.\.nearest,\.\.\.extraSelected\]\)/);
 assert.match(code,/marked&&<group position=\{position.toArray\(\)\}/);
 assert.match(code,/<ringGeometry args=\{\[18,21,40\]\}/);
 assert.match(code,/extraSelected.includes\(m.i\)/);
});

test('selected MDL has a 3D outline derived from active bodygroups; preview geometry remains unmodified',()=>{
 const code=source('src/components/BspViewerAssets.tsx');
 assert.match(code,/function BspModelSelectionOutline/);
 assert.match(code,/new THREE.EdgesGeometry\(geometry\)/);
 assert.match(code,/geometry.dispose\(\)/);
 assert.match(code,/outline\?\.edges.dispose\(\)/);
 assert.match(code,/selected&&<BspModelSelectionOutline parts=\{parts\}\/>/);
});

test('BSP model library switches list and grid with lazy thumbnails and session MDL support',()=>{
 const lib=source('src/components/BspModelLibrary.tsx');
 const browser=source('src/components/ModelBrowser.tsx');
 const css=source('src/style.css');
 assert.match(lib,/svstudio-bsp-model-grid/);
 assert.match(lib,/className=\{grid\?'bsp-library-list grid':'bsp-library-list'\}/);
 assert.match(lib,/ModelThumb file=\{item\} gameDir=\{gameDir\}/);
 assert.match(lib,/initialData=\{item.source==='session'\?localModels.get\(item.path\):undefined\}/);
 assert.match(lib,/scrollRoot=".bsp-library-list"/);
 assert.match(browser,/export function ModelThumb/);
 assert.match(browser,/root:element.closest\(scrollRoot\)/);
 assert.match(browser,/const data=initialData\|\|await loadModelPreview\(gameDir,file\)/);
 assert.match(css,/\.bsp-library-list.grid/);
});

test('fly handoff targets reconstruct yaw and pitch without camera rotation across repeated entries',async()=>{
 const THREE=await import('three');
 const {bspFlyOrbitTarget}=await import('../src/engine/bspViewerTools.ts');
 for(const [yaw,pitch] of [[0,0],[.9,-.4],[-2.4,.85],[2.9,-1.15],[.3,1.12]]){
   const camera=new THREE.PerspectiveCamera(70,1,.1,1000);
   camera.position.set(120,84,-62);
   camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);
   const initial=camera.quaternion.clone();
   const forward=new THREE.Vector3(0,0,-1).applyQuaternion(initial).normalize();
   const destination=new THREE.Vector3(...bspFlyOrbitTarget(camera.position.toArray(),forward.toArray()));
   // OrbitControls' look-at must agree with the camera's current quaternion.
   camera.lookAt(destination);
   assert.ok(camera.quaternion.angleTo(initial)<1e-5,`flight handoff rotated camera at ${yaw}/${pitch}`);
 }
});
