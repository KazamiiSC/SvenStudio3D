import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBsp} from '../src/engine/bsp.ts';
import {bspDirectLightmapUv} from '../src/engine/bspLightmap.ts';
import {inspectBspLighting} from '../src/engine/bspLightingDiagnostics.ts';
import {BSP_BAKED_LIGHT_UV_ATTRIBUTE,BSP_BAKED_VERTEX_SHADER,BSP_BAKED_FRAGMENT_SHADER} from '../src/engine/bspBakedShader.ts';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('real submitted BSP has all 14 faces with nonblack compiled RGB and one stable style',()=>{
  const bytes=readFileSync(new URL('./fixtures/maptest1_lighting_v159.bsp',import.meta.url));
  const map=parseBsp(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
  assert.equal(map.version,30);
  assert.equal(map.faces.length,14);
  assert.equal(map.stats.lightmappedFaces,14);
  assert.equal(map.stats.entities,9);
  const info=inspectBspLighting(map.faces,map.entities);
  assert.equal(info.status,'valid');
  assert.equal(info.zeroFaces,0);
  assert.equal(info.peak,188);
  assert.ok(info.average>160&&info.average<175);
  for(const face of map.faces){
    assert.deepEqual(face.lightStyles,[0]);
    assert.equal(face.lightRgb?.length,face.lightWidth*face.lightHeight*3);
    for(const texel of face.texels){
      const uv=bspDirectLightmapUv(texel,face.lightMin,face.lightWidth,face.lightHeight);
      assert.ok(uv.every(n=>Number.isFinite(n)&&n>=0&&n<=1),`Out-of-bounds lightmap coord ${uv}`);
    }
  }
});

test('ShaderMaterial references an explicitly declared light UV attribute, not Three.js conditional uv1',()=>{
  assert.equal(BSP_BAKED_LIGHT_UV_ATTRIBUTE,'bspLightUv');
  assert.match(BSP_BAKED_VERTEX_SHADER,/attribute\s+vec2\s+bspLightUv\s*;/);
  assert.match(BSP_BAKED_VERTEX_SHADER,/vUvLight\s*=\s*bspLightUv\s*;/);
  assert.doesNotMatch(BSP_BAKED_VERTEX_SHADER,/vUvLight\s*=\s*uv1/);
  assert.match(BSP_BAKED_FRAGMENT_SHADER,/texture2D\(uLighting\s*,\s*vUvLight\)/);
  assert.match(BSP_BAKED_FRAGMENT_SHADER,/#include <colorspace_fragment>/);
  const viewer=source('src/components/BspViewer.tsx');
  assert.match(viewer,/geometry\.setAttribute\('uv1',lightUv\)/);
  assert.match(viewer,/geometry\.setAttribute\(BSP_BAKED_LIGHT_UV_ATTRIBUTE,lightUv\)/);
  assert.match(viewer,/vertexShader:BSP_BAKED_VERTEX_SHADER/);
  assert.match(viewer,/fragmentShader:BSP_BAKED_FRAGMENT_SHADER/);
});
