import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readBspVisExplorer,decodeBspPvs,bspLeafAtPoint,readGoldSrcPrt} from '../src/engine/bspVisExplorer.ts';

function fixture({vis=[0b101,0b111,0,1],badRun=false}={}){
  const lumps=Array.from({length:15},()=>({start:0,size:0}));
  let cursor=124;
  for(const [id,length] of [[1,20],[4,vis.length],[5,24],[10,4*28],[11,0],[14,64]]){
    lumps[id]={start:cursor,size:length};cursor+=length;
  }
  const buffer=new ArrayBuffer(cursor),v=new DataView(buffer);
  v.setInt32(0,30,true);
  lumps.forEach(({start,size},i)=>{v.setInt32(4+i*8,start,true);v.setInt32(8+i*8,size,true)});
  const p=lumps[1].start;
  v.setFloat32(p,1,true);v.setFloat32(p+12,0,true);
  const n=lumps[5].start;
  v.setInt32(n,0,true);v.setInt16(n+4,-2,true);v.setInt16(n+6,-3,true);
  const l=lumps[10].start;
  [-1,0,-1,2].forEach((ofs,i)=>{
    const o=l+i*28;v.setInt32(o,i===0?-2:-1,true);v.setInt32(o+4,ofs,true);
    for(let axis=0;axis<3;axis++){v.setInt16(o+8+axis*2,-64,true);v.setInt16(o+14+axis*2,64,true)}
  });
  new Uint8Array(buffer,lumps[4].start,vis.length).set(vis);
  v.setInt32(lumps[14].start+36,0,true);
  v.setInt32(lumps[14].start+52,3,true);
  return {buffer,lumps,v};
}
test('BSP30 leaves, world hull-0 point traversal, and solid leaf #0',()=>{
  const data=readBspVisExplorer(fixture().buffer);
  assert.equal(data.leaves.length,4);
  assert.equal(data.worldVisLeaves,3);
  assert.equal(bspLeafAtPoint(data,[12,0,0]),1);
  assert.equal(bspLeafAtPoint(data,[-12,0,0]),2);
  assert.equal(bspLeafAtPoint(data,[NaN,0,0]),null);
  assert.equal(decodeBspPvs(data,0).status,'solid');
});
test('PVS bits index non-solid BSP leaves starting at #1, and report unavailable VIS',()=>{
  const data=readBspVisExplorer(fixture().buffer);
  assert.deepEqual(decodeBspPvs(data,1).indices,[1,3]);
  assert.equal(decodeBspPvs(data,1).status,'ok');
  assert.equal(decodeBspPvs(data,2).status,'unavailable');
  assert.deepEqual(decodeBspPvs(data,3).indices,[]);
  assert.equal(decodeBspPvs(data,3).status,'ok');
});
test('PVS never fabricates an all-visible result for damaged data',()=>{
  for(const bytes of [[0],[0,255],[0,0]]){
    const data=readBspVisExplorer(fixture({vis:bytes}).buffer);
    assert.equal(decodeBspPvs(data,1).status,'invalid');
    assert.deepEqual(decodeBspPvs(data,1).indices,[]);
  }
});
test('World VIS count excludes extra submodel leaves (no false PVS indices)',()=>{
  const item=fixture();item.v.setInt32(item.lumps[14].start+52,2,true);
  const data=readBspVisExplorer(item.buffer);
  assert.equal(decodeBspPvs(data,1).status,'ok');
  assert.deepEqual(decodeBspPvs(data,1).indices,[1]);
  assert.equal(decodeBspPvs(data,3).status,'unavailable');
});
test('Invalid lumps, node cycles and marksurface overflow fail closed',()=>{
  const {buffer,lumps,v}=fixture();
  v.setUint16(lumps[10].start+28+20,1,true);
  assert.throws(()=>readBspVisExplorer(buffer),/marksurface/);
  const x=fixture();
  x.v.setInt16(x.lumps[5].start+4,0,true);
  assert.equal(bspLeafAtPoint(readBspVisExplorer(x.buffer),[5,0,0]),null);
  const y=fixture();y.v.setInt32(4+10*8,999999,true);
  assert.throws(()=>readBspVisExplorer(y.buffer),/lump/);
});
test('PRT1 portal polygons are parsed without treating portal IDs as BSP leaf IDs',()=>{
  const input='PRT1\n2\n1\n4 0 1 (0 0 0) (128 0 0) (128 128 0) (0 128 0)\n';
  const data=readGoldSrcPrt(input);
  assert.equal(data.leaves,2);
  assert.equal(data.portals[0].points.length,4);
  assert.deepEqual(data.portals[0].points[2],[128,128,0]);
  assert.throws(()=>readGoldSrcPrt(input.replace('4 0 1','4 0 2')),/Invalid PRT1/);
  assert.throws(()=>readGoldSrcPrt(input.replace('128 128 0','Infinity 128 0')),/Invalid portal coordinate/);
  assert.throws(()=>readGoldSrcPrt('PRT1\n2\n1\n'),/portal count/);
});
test('Real GoldSrc BSP30 regression fixture decodes actual compiled PVS',()=>{
  const bytes=fs.readFileSync(new URL('./fixtures/maptest1_lighting_v159.bsp',import.meta.url));
  const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const data=readBspVisExplorer(buffer);
  assert.equal(data.worldVisLeaves,5);
  assert.equal(data.leaves.length,6);
  assert.equal(data.visBytes.length,5);
  assert.deepEqual(decodeBspPvs(data,1).indices,[1,2,3,4,5]);
});
test('HF11 visibility remains separate from BSP writes/compilers',()=>{
  const ui=fs.readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
  assert.match(ui,/BspVisOverlay/);
  assert.match(ui,/readBspVisExplorer\(source\)/);
  assert.match(ui,/readGoldSrcPrt/);
  assert.match(ui,/VIS & Portal Explorer/);
  const engine=fs.readFileSync(new URL('../src/engine/bspVisExplorer.ts',import.meta.url),'utf8');
  assert.doesNotMatch(engine,/writeNativeBsp|writeFile|fetch\(/);
});
