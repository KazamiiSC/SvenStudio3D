import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBsp} from '../src/engine/bsp.ts';
import {readNativeBsp} from '../src/engine/bspNativeEdit.ts';
import {bspApplySurfaceOperation,bspReprojectFaceLightmap,writeBspSurfaceEdits} from '../src/engine/bspSurfaceEdit.ts';
import {bspBatchedUvVertex,bspFaceIdVertexRanges} from '../src/engine/bspRealtimeUv.ts';
const fixture=readFileSync(new URL('./fixtures/maptest1_lighting_v159.bsp',import.meta.url));
const fresh=()=>fixture.buffer.slice(fixture.byteOffset,fixture.byteOffset+fixture.byteLength);
const op=(rotation=0,scaleU=1,scaleV=1,offsetU=0,offsetV=0)=>({texture:-1,offsetU,offsetV,rotation,scaleU,scaleV});
const same=(a,b)=>assert.deepEqual(Array.from(a),Array.from(b));
const faceBy=(map,id)=>map.faces.find(f=>f.bspFaceIndex===id);

test('6D: lightmapped face rotates and scales; every exported RGB style is reprojected and reimported',()=>{
 const source=fresh(),map=parseBsp(source);
 const face=map.faces.find(f=>f.lightRgb&&f.lightStyles.length>0&&f.flags===0);
 const delta=bspApplySurfaceOperation(map,{},[face.bspFaceIndex],op(45,1.5,.75));
 const desired=bspReprojectFaceLightmap(face,delta[face.bspFaceIndex]);
 assert.ok(desired&&desired.layers.length>0);
 const written=writeBspSurfaceEdits(source,delta),reparsed=faceBy(parseBsp(written),face.bspFaceIndex);
 assert.equal(reparsed.lightWidth,desired.width);assert.equal(reparsed.lightHeight,desired.height);
 assert.deepEqual(reparsed.lightStyles,face.lightStyles);
 desired.layers.forEach((layer,index)=>same(reparsed.lightLayers[index],layer));
 assert.deepEqual(new Uint8Array(source),new Uint8Array(fixture));
});

test('6D: unselected face lighting, geometry, VIS, collision and original lightmap bytes remain intact',()=>{
 const source=fresh(),map=parseBsp(source),face=map.faces.find(f=>f.lightRgb&&f.flags===0),other=map.faces.find(f=>f.bspFaceIndex!==face.bspFaceIndex&&f.lightRgb);
 const delta=bspApplySurfaceOperation(map,{},[face.bspFaceIndex],op(90,1,1,3,4));
 const output=writeBspSurfaceEdits(source,delta),native=readNativeBsp(source),rebuilt=readNativeBsp(output);
 const parsed=parseBsp(output),untouched=faceBy(parsed,other.bspFaceIndex);
 same(untouched.lightRgb,other.lightRgb);
 assert.deepEqual(untouched.sTexinfo,other.sTexinfo);
 for(let i=0;i<15;i++){
   if([6,7,8].includes(i))continue;
   assert.deepEqual(rebuilt.lumps[i],native.lumps[i],`lump ${i} header`);
   same(new Uint8Array(output,rebuilt.lumps[i].offset,rebuilt.lumps[i].length),new Uint8Array(source,native.lumps[i].offset,native.lumps[i].length));
 }
 same(new Uint8Array(output,rebuilt.lumps[8].offset,native.lumps[8].length),new Uint8Array(source,native.lumps[8].offset,native.lumps[8].length));
});

test('6D: untouched 16-texel shifts preserve original RGB offsets and lighting lump byte-for-byte',()=>{
 const source=fresh(),map=parseBsp(source),face=map.faces.find(f=>f.lightRgb&&f.flags===0);
 const delta=bspApplySurfaceOperation(map,{},[face.bspFaceIndex],op(0,1,1,32,-16));
 const result=writeBspSurfaceEdits(source,delta),a=readNativeBsp(source),b=readNativeBsp(result);
 assert.deepEqual(b.lumps[8],a.lumps[8]);
 assert.equal(faceBy(parseBsp(result),face.bspFaceIndex).lightmapOffset,face.lightmapOffset);
});

test('6D: lightmap bounds and missing style data fail closed rather than exporting corrupted BSP',()=>{
 const raw=fresh(),map=parseBsp(raw),face=map.faces.find(f=>f.lightRgb&&f.flags===0);
 const bad=structuredClone(map);const target=faceBy(bad,face.bspFaceIndex);target.lightLayers=[];
 assert.throws(()=>bspApplySurfaceOperation(bad,{},[face.bspFaceIndex],op(45)),/lightmap|lightstyle/i);
 assert.throws(()=>bspApplySurfaceOperation(map,{},[face.bspFaceIndex],op(0,.125,.125)),/safe|recompilation|limits/i);
});

test('6D: batched GPU diffuse UV update uses same GoldSrc axis convention and original BSP face triangle IDs',()=>{
 const s=[.125,1,0,128],t=[0,0,-2,-32];
 const point=[100,40,-30]; // game X=100, Y=30, Z=40
 const [u,v]=bspBatchedUvVertex(...point,s,t,128,64);
 assert.equal(u,(100*.125+30+128)/128);
 assert.equal(v,-(-80-32)/64);
 const grouped=bspFaceIdVertexRanges(Uint32Array.from([4,17,4,0]));
 assert.deepEqual(grouped.get(4),[0,1,2,6,7,8]);
 assert.deepEqual(grouped.get(17),[3,4,5]);
});

test('6D: viewport reuses meshes through UV gestures, while Texture Studio enables scale and rotation',()=>{
 const viewer=readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
 const studio=readFileSync(new URL('../src/components/BspTextureStudio.tsx',import.meta.url),'utf8');
 assert.match(viewer,/BspSurface map=\{renderSurfaceMap\} overrides=\{gesturePreview\?\?surfaceOverrides\}/);
 assert.match(viewer,/const uvTargets=useMemo/);
 assert.match(viewer,/\.needsUpdate=true/);
 assert.match(viewer,/\},\[extendedMap,renderTextureKey\]\)/);
 assert.match(studio,/numeric\(t\.rotation,rotation,setRotation,1\)/);
 assert.doesNotMatch(studio,/numeric\(t\.rotation,rotation,setRotation,1,lit\)/);
});

test('6D: two lightstyles on one face are resampled separately without dropping nonzero style IDs',()=>{
 const raw=fresh(),first=parseBsp(raw).faces.find(f=>f.lightRgb&&f.flags===0);
 const native=readNativeBsp(raw),at=native.lumps[7].offset+first.bspFaceIndex*20;
 const view=new DataView(raw);
 // A synthetic two-style source: the fixture has enough lighting bytes for
 // two layers at its first face offset. Both must survive the write.
 view.setUint8(at+12,0);view.setUint8(at+13,32);view.setUint8(at+14,255);view.setUint8(at+15,255);
 const source=parseBsp(raw),face=faceBy(source,first.bspFaceIndex);
 assert.deepEqual(face.lightStyles,[0,32]);
 const patch=bspApplySurfaceOperation(source,{},[face.bspFaceIndex],op(30,1.2,.8));
 const exportResult=parseBsp(writeBspSurfaceEdits(raw,patch));
 const restored=faceBy(exportResult,face.bspFaceIndex);
 assert.deepEqual(restored.lightStyles,[0,32]);
 assert.equal(restored.lightLayers.length,2);
 assert.ok(restored.lightLayers[0].length>0);
 assert.equal(restored.lightLayers[0].length,restored.lightLayers[1].length);
});

test('6D: multiple faces can be resampled with separate lightofs and without modifying the other face',()=>{
 const raw=fresh(),map=parseBsp(raw),faces=map.faces.filter(f=>f.lightRgb&&f.flags===0).slice(0,2);
 assert.equal(faces.length,2);
 const patch=bspApplySurfaceOperation(map,{},faces.map(f=>f.bspFaceIndex),op(25,1.2,.8));
 const parsed=parseBsp(writeBspSurfaceEdits(raw,patch));
 const a=faceBy(parsed,faces[0].bspFaceIndex),b=faceBy(parsed,faces[1].bspFaceIndex);
 assert.notEqual(a.lightmapOffset,b.lightmapOffset);
 assert.notEqual(a.texinfoIndex,b.texinfoIndex);
 assert.ok(a.lightRgb?.length&&b.lightRgb?.length);
});
