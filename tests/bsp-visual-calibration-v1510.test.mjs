import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBsp} from '../src/engine/bsp.ts';
import {readBspFog,bspFogFactor,normalizeBspDisplayGamma} from '../src/engine/bspPresentation.ts';
import {inspectBspLighting} from '../src/engine/bspLightingDiagnostics.ts';
import {BSP_BAKED_FRAGMENT_SHADER,BSP_BAKED_VERTEX_SHADER} from '../src/engine/bspBakedShader.ts';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const bytes=readFileSync(new URL('./fixtures/maptest1_lighting_v159.bsp',import.meta.url));
const map=parseBsp(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));

test('user BSP fog is read from native env_fog values and is initially enabled',()=>{
  const fog=readBspFog(map.entities);
  assert.deepEqual(fog?.color,[105,123,172]);
  assert.equal(fog?.hex,'#697bac');
  assert.equal(fog?.start,128);
  assert.equal(fog?.end,1800);
  assert.equal(fog?.initiallyEnabled,true);
});
test('fog start-off flag is retained and independent of SC-RAD lightmaps',()=>{
  const inactive=[{classname:'env_fog',properties:{iuser2:'128',iuser3:'1800',rendercolor:'105 123 172',spawnflags:'1'}}];
  assert.equal(readBspFog(inactive)?.initiallyEnabled,false);
  assert.equal(readBspFog([{classname:'env_fog',properties:{iuser2:'0',iuser3:'12',rendercolor:'1 2 3'}}]),null);
  assert.equal(readBspFog([{classname:'env_fog',properties:{iuser2:'10',iuser3:'9',rendercolor:'1 2 3'}}]),null);
  assert.equal(readBspFog([]),null);
  const fog=readBspFog(map.entities);
  assert.equal(bspFogFactor(0,fog),0);
  assert.equal(bspFogFactor(128,fog),0);
  assert.ok(Math.abs(bspFogFactor(964,fog)-.5)<1e-8);
  assert.equal(bspFogFactor(1800,fog),1);
  assert.equal(bspFogFactor(5000,fog),1);
});
test('calibration starts neutral and cannot write to compiled BSP samples',()=>{
  assert.equal(normalizeBspDisplayGamma(Number.NaN),1);
  assert.equal(normalizeBspDisplayGamma(1),1);
  assert.equal(normalizeBspDisplayGamma(100),1.6);
  assert.equal(normalizeBspDisplayGamma(0),.65);
  const before=map.faces.map(f=>f.lightRgb?.slice());
  const fog=readBspFog(map.entities);
  assert.ok(bspFogFactor(600,fog)>0);
  assert.ok(normalizeBspDisplayGamma(1.25)>1);
  map.faces.forEach((face,i)=>assert.deepEqual(face.lightRgb,before[i]));
  assert.equal(inspectBspLighting(map.faces,map.entities).zeroFaces,0);
});
test('baked shader mixes fog before sRGB output and retains explicit per-face light UV',()=>{
  assert.match(BSP_BAKED_VERTEX_SHADER,/attribute vec2 bspLightUv;/);
  assert.match(BSP_BAKED_VERTEX_SHADER,/vViewDepth=-viewPosition.z;/);
  assert.match(BSP_BAKED_FRAGMENT_SHADER,/uniform bool uFogEnabled;/);
  assert.match(BSP_BAKED_FRAGMENT_SHADER,/uniform float uDisplayGamma;/);
  assert.match(BSP_BAKED_FRAGMENT_SHADER,/mix\(litColor,uFogColor,fogFactor\)/);
  assert.ok(BSP_BAKED_FRAGMENT_SHADER.indexOf('mix(litColor,uFogColor,fogFactor)')<BSP_BAKED_FRAGMENT_SHADER.indexOf('colorspace_fragment'));
});
test('both map lighting and full BSP viewer expose calibration without changes to SC-RAD',()=>{
  const viewer=read('src/components/BspViewer.tsx');
  const preview=read('src/components/TrueLightingPreview.tsx');
  const server=read('server/index.js');
  assert.match(viewer,/readBspFog\(map.entities\)/);
  assert.match(viewer,/u\.uFogColor\.value\.set/);
  assert.match(viewer,/lightFilter==='nearest'/);
  assert.match(viewer,/Niebla BSP \(env_fog\)/);
  assert.match(preview,/fog=\{surfaceOnly\?null:effectiveFog\}/);
  assert.match(preview,/Reset calibration/);
  assert.match(preview,/Lightmap filtering/);
  assert.match(server,/previewOnly/);
});
