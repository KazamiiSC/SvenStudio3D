/** BSP lightmap regression: r175 uses uv1 (channel 1), and BSP samples are linear. */
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as THREE from 'three';

const original=readFileSync(new URL('../src/engine/bspLightmap.ts',import.meta.url),'utf8');
const js=ts.transpileModule(original,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
assert.equal(js.diagnostics?.length||0,0);
const {BSP_LIGHTMAP_UV_CHANNEL,BSP_LIGHTMAP_DEFAULT_INTENSITY,BSP_LIGHTMAP_DEFAULT_AMBIENT,bspLightmapAtlasUv}=
  await import(`data:text/javascript;base64,${Buffer.from(js.outputText).toString('base64')}`);
assert.equal(THREE.REVISION,'175');
assert.equal(BSP_LIGHTMAP_UV_CHANNEL,1);
const texture=new THREE.Texture();
texture.channel=BSP_LIGHTMAP_UV_CHANNEL;
texture.colorSpace=THREE.LinearSRGBColorSpace;
assert.equal(texture.channel,1);
assert.equal(texture.colorSpace,THREE.LinearSRGBColorSpace);
assert(BSP_LIGHTMAP_DEFAULT_INTENSITY>1&&BSP_LIGHTMAP_DEFAULT_INTENSITY<6);
assert(BSP_LIGHTMAP_DEFAULT_AMBIENT>=0&&BSP_LIGHTMAP_DEFAULT_AMBIENT<1);
// A baked grid at lightMin (2,4) maps its first sample to the centre of the first luxel.
const uv=bspLightmapAtlasUv([32,64],[2,4],{x:20,y:30},1024);
assert.deepEqual(uv,[20.5/1024,1-30.5/1024]);
const next=bspLightmapAtlasUv([48,80],[2,4],{x:20,y:30},1024);
assert(Math.abs(next[0]-uv[0]-1/1024)<1e-10);
assert(Math.abs(next[1]-uv[1]+1/1024)<1e-10);
assert.throws(()=>bspLightmapAtlasUv([0,0],[0,0],{x:1,y:1},0),/atlas size/);
const source=readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
assert(source.includes("geometry.setAttribute('uv1',new THREE.Float32BufferAttribute(part.uv1,2))"),'BSP geometry must provide second UV in uv1');
assert(!source.includes("geometry.setAttribute('uv2'"),'Stale lightmap uv2 attribute');
assert(source.includes('tex.colorSpace=THREE.LinearSRGBColorSpace;tex.channel=BSP_LIGHTMAP_UV_CHANNEL'),'Lightmap texture must use linear data and channel 1');
assert(source.includes('bspLightmapAtlasUv(uv,face.lightMin,placement,ATLAS_SIZE)'),'Lightmap UV calculation must use face placement');
assert(source.includes('new THREE.MeshBasicMaterial(common)'),'Surfaces without light samples should remain visible');
assert(source.includes('lightmaps?ambientFill:1.7'),'Lighting on/off must preserve separate fill settings');
assert(source.includes("t('Ambient fill')")&&source.includes("t('Reset lighting')"),'Lighting controls missing');
const locale=readFileSync(new URL('../src/i18n.ts',import.meta.url),'utf8');
for(const lang of ['es','ru','ko'])assert(locale.includes(`Object.assign(${lang},{\n  'Lightmap intensity'`),`Lighting locale ${lang} missing`);
console.log('PASS BSP v0.8.9.1 lighting: texture channel, second UV, linear color, UV increments, fallback, controls, 4 locales.');
