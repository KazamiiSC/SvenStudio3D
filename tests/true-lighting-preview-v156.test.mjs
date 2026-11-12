import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLightingPreviewRecord,lightingPreviewAvailable,isLightingPreviewId,isPreviewCompile,LIGHTING_PREVIEW_TTL_MS} from '../server/lightingPreviewBuild.js';
import {bspLightstyleWeight,composeBspFaceLighting,bspLightstyleStats} from '../src/engine/bspLighting.ts';
import {parseBsp} from '../src/engine/bsp.ts';

const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('temporary preview record is unguessable, expires, rejects invalid/oversized binary',()=>{
  const record=createLightingPreviewRecord('/tmp/builds/scene.bsp',124,1_000);
  assert.equal(isLightingPreviewId(record.id),true);
  assert.equal(lightingPreviewAvailable(record,record.id,1_000+LIGHTING_PREVIEW_TTL_MS-1),true);
  assert.equal(lightingPreviewAvailable(record,record.id,1_000+LIGHTING_PREVIEW_TTL_MS),false);
  assert.equal(lightingPreviewAvailable(record,'../../etc/passwd',1_000),false);
  assert.equal(lightingPreviewAvailable(record,'1234',1_000),false);
  assert.equal(isPreviewCompile(true),true);
  assert.equal(isPreviewCompile('true'),false);
  assert.throws(()=>createLightingPreviewRecord('/tmp/scene.txt',124));
  assert.throws(()=>createLightingPreviewRecord('/tmp/scene.bsp',300*1024*1024));
});

test('lightstyles combine the actual BSP RGB layers and preserve static styles',()=>{
  const face={lightStyles:[0,32],lightLayers:[Uint8Array.of(80,90,100),Uint8Array.of(30,40,50)]};
  const entity={classname:'light',properties:{style:'32',pattern:'am'}};
  assert.deepEqual([...composeBspFaceLighting(face,[entity],0)],[80,90,100]);
  assert.deepEqual([...composeBspFaceLighting(face,[entity],1)],[110,130,150]);
  assert.equal(bspLightstyleWeight(0,25),1);
  assert.equal(bspLightstyleWeight(32,1,[entity]),1);
  assert.equal(bspLightstyleWeight(32,0,[entity]),0);
  assert.equal(bspLightstyleWeight(32,1,[{classname:'light',properties:{style:'32',spawnflags:'1'}}]),0);
  assert.deepEqual(bspLightstyleStats([face,{lightStyles:[0],lightLayers:[Uint8Array.of(1)]}]),{multiStyleFaces:1,animatedFaces:1,styles:[32]});
});

/** One real BSP30 face with a 2x2 luxel grid, a static and a named style. */
function mockBsp(){
  const lumps=Array.from({length:15},()=>new Uint8Array());
  const encoded=new TextEncoder();
  const chunks=(bytes,mutate)=>{const buf=new ArrayBuffer(bytes),d=new DataView(buf);mutate(d);return new Uint8Array(buf)};
  lumps[0]=encoded.encode('{\n"classname" "worldspawn"\n}\n{\n"classname" "light"\n"style" "32"\n"pattern" "am"\n}\n\0');
  lumps[1]=chunks(20,d=>{d.setFloat32(8,1,true)});
  lumps[2]=chunks(48,d=>{d.setInt32(0,1,true);d.setInt32(4,8,true);const name=encoded.encode('SV_TEST');new Uint8Array(d.buffer,8,name.length).set(name);d.setUint32(24,16,true);d.setUint32(28,16,true)});
  lumps[3]=chunks(36,d=>{d.setFloat32(12,16,true);d.setFloat32(28,16,true)});
  lumps[6]=chunks(40,d=>{d.setFloat32(0,1,true);d.setFloat32(20,1,true)});
  lumps[7]=chunks(20,d=>{d.setUint16(8,3,true);d.setUint8(12,0);d.setUint8(13,32);d.setUint8(14,255);d.setUint8(15,255)});
  lumps[8]=new Uint8Array([...new Array(12).fill(80),...new Array(12).fill(25)]);
  lumps[12]=chunks(12,d=>{d.setUint16(0,0,true);d.setUint16(2,1,true);d.setUint16(4,1,true);d.setUint16(6,2,true);d.setUint16(8,2,true);d.setUint16(10,0,true)});
  lumps[13]=chunks(12,d=>{d.setInt32(0,0,true);d.setInt32(4,1,true);d.setInt32(8,2,true)});
  lumps[14]=chunks(64,d=>d.setInt32(60,1,true));
  let total=124;for(const l of lumps)total+=l.length;
  const bytes=new ArrayBuffer(total),dv=new DataView(bytes),out=new Uint8Array(bytes);dv.setInt32(0,30,true);
  let off=124;for(let i=0;i<15;i++){dv.setInt32(4+i*8,off,true);dv.setInt32(8+i*8,lumps[i].length,true);out.set(lumps[i],off);off+=lumps[i].length}
  return bytes;
}

test('BSP30 decoder preserves both SC-RAD lightstyle layers without writing MAP',()=>{
  const map=parseBsp(mockBsp(),'styles.bsp');
  assert.equal(map.faces.length,1);assert.equal(map.stats.lightmappedFaces,1);
  assert.deepEqual(map.faces[0].lightStyles,[0,32]);
  assert.equal(map.faces[0].lightLayers.length,2);
  assert.equal(map.faces[0].lightRgb[0],80);
  assert.equal(composeBspFaceLighting(map.faces[0],map.entities,0)[0],80);
  assert.equal(composeBspFaceLighting(map.faces[0],map.entities,1)[0],105);
});

test('preview uses the existing compilers but never copies its BSP into svencoop/maps',()=>{
  const server=read('server/index.js');
  assert.match(server,/if\(previewOnly\)\{[\s\S]*?createLightingPreviewRecord/);
  assert.match(server,/if\(previewOnly\)\{[\s\S]*?return;[\s\S]*?const mapsDir=path\.join\(gameDir,'maps'\)/);
  assert.match(server,/lightingPreviewAvailable\(lastLightingPreview,id\)/);
  const app=read('src/App.tsx');
  assert.match(app,/previewOnly:mode==='preview'/);
  assert.match(app,/setTruePreviewSnapshot\(project\)/);
  assert.match(app,/onClick=\{\(\)=>void compile\('game'\)\}/);
  assert.match(read('src/components/TrueLightingPreview.tsx'),/stale.*MAP changed/s);
  assert.match(read('src/components/BspViewer.tsx'),/baked&&bakedTexture\?new THREE\.ShaderMaterial/);
});
