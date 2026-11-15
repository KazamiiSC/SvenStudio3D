import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {createBrush,buildMeshGeometry} from '../src/engine/geometry.ts';
import {buildOpaqueBrushBatches,disposeOpaqueBatches,isOpaqueBatchMaterial} from '../src/engine/opaqueBrushBatches.ts';
import {updateBrushChunkReadout,clearBrushChunkReadout,getBrushBatchSummary} from '../src/engine/mapRenderDiagnostics.ts';

const file=(name)=>readFileSync(new URL(`../${name}`,import.meta.url),'utf8');

test('hidden NULL face material is removed from rendering, not just transparent',()=>{
  const source=file('src/components/Viewport.tsx');
  assert.match(source,/if\(isBspRecovered&&hideRecoveryNull&&!solidShading&&!wireframe&&f\.texture\.toUpperCase\(\)==='NULL'\)/);
  assert.match(source,/new THREE\.MeshStandardMaterial\(\{visible:false,side:THREE\.DoubleSide\}\)/);
  assert.doesNotMatch(source,/new THREE\.MeshStandardMaterial\(\{color:'#ffffff',transparent:true,opacity:0,depthWrite:false,side:THREE\.DoubleSide\}\)/);
  // Three's native raycaster must still hit a face hidden by material.visible:
  // the original per-brush UV and face-index geometry is untouched.
  const brush=createBrush('box',[0,0,0],[64,64,64]);
  const before=JSON.stringify(brush);
  const geo=buildMeshGeometry(brush);
  const hidden=new THREE.MeshStandardMaterial({visible:false,side:THREE.DoubleSide});
  const picker=new THREE.Mesh(geo,hidden);
  const hits=new THREE.Raycaster(new THREE.Vector3(0,100,0),new THREE.Vector3(0,-1,0)).intersectObject(picker);
  assert.ok(hits.length>0,'face raycast must still work');
  assert.equal(isOpaqueBatchMaterial(hidden),false,'hidden NULL must never be merged into visible GPU batches');
  assert.equal(JSON.stringify(brush),before);
  geo.dispose();hidden.dispose();
});

test('diagnostic counts NULL faces and which ones are actually suppressed',()=>{
  const a=Symbol('null-a'),b=Symbol('null-b');
  updateBrushChunkReadout(a,{brushes:24,batchedBrushes:12,batchDrawMeshes:6,sourceTriangles:80,eligibleForChunk:true,batchingEnabled:true,nullFaces:38,hiddenNullFaces:38});
  updateBrushChunkReadout(b,{brushes:3,batchedBrushes:0,batchDrawMeshes:0,sourceTriangles:0,eligibleForChunk:false,batchingEnabled:true,nullFaces:7,hiddenNullFaces:7});
  const summary=getBrushBatchSummary();
  assert.equal(summary.nullFaces,45);
  assert.equal(summary.hiddenNullFaces,45);
  assert.equal(summary.smallChunks,1);
  clearBrushChunkReadout(a);clearBrushChunkReadout(b);
});

test('WebGL diagnostic reads complete previous frame and avoids GPU sync or manual rendering',()=>{
  const source=file('src/components/MapPerformanceMonitor.tsx');
  assert.match(source,/gl\.info\.autoReset=false/);
  assert.match(source,/lastCompletedRender\.current=\{drawCalls:gl\.info\.render\.calls,triangles:gl\.info\.render\.triangles,lines:gl\.info\.render\.lines\}/);
  assert.match(source,/gl\.info\.reset\(\)/);
  assert.match(source,/\},-1000\)/);
  assert.match(source,/gl\.info\.autoReset=priorAutoReset\.current/);
  assert.doesNotMatch(source.replace(/\/\*[\s\S]*?\*\//g,''),/gl\.render\(|readPixels\(|EXT_disjoint_timer_query/);
});
