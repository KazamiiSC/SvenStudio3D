import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bspDirectLightmapUv,bspPaddedLightmap} from '../src/engine/bspLightmap.ts';
import {inspectBspLighting} from '../src/engine/bspLightingDiagnostics.ts';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('per-face lightmap contains the exact RGB luxels and a replicated edge, not transparent black',()=>{
 const raw=Uint8Array.from([10,20,30,40,50,60,70,80,90,100,110,120]);
 const padded=bspPaddedLightmap(raw,2,2);
 const pixel=(x,y)=>[...padded.subarray((y*4+x)*4,(y*4+x)*4+4)];
 assert.deepEqual(pixel(0,0),[10,20,30,255]);
 assert.deepEqual(pixel(1,1),[10,20,30,255]);
 assert.deepEqual(pixel(2,1),[40,50,60,255]);
 assert.deepEqual(pixel(1,2),[70,80,90,255]);
 assert.deepEqual(pixel(3,3),[100,110,120,255]);
 assert.throws(()=>bspPaddedLightmap(new Uint8Array(2),2,2));
});
test('GoldSrc texel coordinates point at centers of the padded light samples',()=>{
 const uv00=bspDirectLightmapUv([-32,16],[-2,1],2,2);
 const uv11=bspDirectLightmapUv([-16,32],[-2,1],2,2);
 assert.deepEqual(uv00,[1.5/4,1-1.5/4]);
 assert.deepEqual(uv11,[2.5/4,1-2.5/4]);
 assert.throws(()=>bspDirectLightmapUv([0,0],[0,0],0,2));
});
test('black compiled illumination is distinguishable from missing and valid samples',()=>{
 const f=(color)=>({lightStyles:[0],lightLayers:[color],lightRgb:color});
 const black=inspectBspLighting([f(Uint8Array.of(0,0,0))]);
 assert.equal(black.status,'black');assert.equal(black.litFaces,1);assert.equal(black.zeroFaces,1);
 const missing=inspectBspLighting([{}]);assert.equal(missing.status,'missing');
 const valid=inspectBspLighting([f(Uint8Array.of(80,120,200)),{}]);
 assert.equal(valid.status,'valid');assert.equal(valid.peak,200);assert.equal(valid.missingFaces,1);
});
test('BSP viewer uses per-face compiled textures on small scenes; geometry inspection never pretends to be baked',()=>{
 const viewer=read('src/components/BspViewer.tsx');const truePanel=read('src/components/TrueLightingPreview.tsx');
 assert.match(viewer,/map\.faces\.length<=64/);
 assert.match(viewer,/bspPaddedLightmap\(rgb,w,h\)/);
 assert.match(viewer,/bspDirectLightmapUv\(uv,face\.lightMin/);
 assert.match(viewer,/surfaceOnly\?new THREE\.MeshBasicMaterial/);
 assert.match(truePanel,/Inspect geometry \(unlit\)/);
 assert.match(truePanel,/inspectBspLighting/);
});
