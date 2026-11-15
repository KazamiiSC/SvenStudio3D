/** Synthetic draw-call estimate, not a WebGL or FPS benchmark.
 * Run: node --experimental-transform-types --experimental-loader ./scripts/bsp-test-resolver.mjs scripts/benchmark-hf17-hf1.mjs
 */
import * as THREE from 'three';
import {performance} from 'node:perf_hooks';
import {createBrush,buildMeshGeometry} from '../src/engine/geometry.ts';
import {buildOpaqueBrushBatches,disposeOpaqueBatches,reuseOpaqueBrushChunks} from '../src/engine/opaqueBrushBatches.ts';
const count=1125;
const materialPool=Array.from({length:16},(_,i)=>new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(i/16,.5,.65),side:THREE.DoubleSide}));
const brushes=Array.from({length:count},(_,i)=>{
  const brush=createBrush('box',[(i%45)*128,Math.floor(i/45)*96,64],[96,80,128],`Brush ${i}`);
  brush.id=`b${i}`;
  return brush;
});
const inputs=brushes.map((brush,i)=>({brush,materials:brush.faces.map((_,f)=>materialPool[(i+f*7)%materialPool.length])}));
let originalDraws=0,originalTriangles=0;
for(const input of inputs){
 const g=buildMeshGeometry(input.brush);
 originalDraws+=g.groups.length;
 originalTriangles+=(g.getIndex()?.count||0)/3;
 g.dispose();
}
const chunks=reuseOpaqueBrushChunks(brushes,[],96);
let afterDraws=0,afterTriangles=0;
const start=performance.now();
for(const chunk of chunks){
 const ids=new Set(chunk.map(b=>b.id));
 const result=buildOpaqueBrushBatches(inputs.filter(it=>ids.has(it.brush.id)));
 afterDraws+=result.batches.length;
 afterTriangles+=result.sourceTriangles;
 disposeOpaqueBatches(result);
}
const ms=performance.now()-start;
console.log(JSON.stringify({note:'Synthetic CPU batching estimate; NOT rendered FPS or real GPU draw call measurement',brushes:count,materials:materialPool.length,
  originalPerFaceDrawGroups:originalDraws,batchedMaterialDrawGroups:afterDraws,originalTriangles,afterTriangles,
  estimatedDrawGroupReductionPct:((1-afterDraws/originalDraws)*100).toFixed(1),batchBuildMs:ms.toFixed(1)},null,2));
