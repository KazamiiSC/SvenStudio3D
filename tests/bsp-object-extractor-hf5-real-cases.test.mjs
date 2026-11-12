import test from 'node:test';
import assert from 'node:assert/strict';
import {extractBspObjectPrefab,validateBspObjectPrefab,decodePrefabWad} from '../src/engine/bspObjectExtractor.ts';
import {exportMap} from '../src/engine/exportMap.ts';
import {inspectMapImport} from '../src/engine/importMap.ts';
import {findMipTextureInWads} from '../src/engine/bspWadMipTexture.ts';
const texName='TEST_BRICK';
function miniSource(){
 const raw=new Uint8Array(40+256+64+16+4+2+256*3),r=new DataView(raw.buffer);
 for(let i=0;i<texName.length;i++)raw[i]=texName.charCodeAt(i);
 r.setUint32(16,16,true);r.setUint32(20,16,true);
 let off=40;for(const [i,n] of [256,64,16,4].entries()){r.setUint32(24+i*4,off,true);raw.fill(3+i,off,off+n);off+=n}
 r.setUint16(off,256,true);for(let i=0;i<256;i++){raw[off+2+i*3]=i;raw[off+3+i*3]=255-i;raw[off+4+i*3]=i}
 const lumps=[new Uint8Array(0),new Uint8Array(20),new Uint8Array(8+raw.length),new Uint8Array(0),new Uint8Array(0),new Uint8Array(24),new Uint8Array(0),new Uint8Array(0),new Uint8Array(0),new Uint8Array(0),new Uint8Array(56),new Uint8Array(0),new Uint8Array(0),new Uint8Array(0),new Uint8Array(128)];
 // node0 splits x=0, the positive half is solid leaf0, negative is empty leaf1
 new DataView(lumps[1].buffer).setFloat32(0,1,true);
 const texture=new DataView(lumps[2].buffer);texture.setInt32(0,1,true);texture.setInt32(4,8,true);lumps[2].set(raw,8);
 const node=new DataView(lumps[5].buffer);node.setInt32(0,0,true);node.setInt16(4,-1,true);node.setInt16(6,-2,true);
 new DataView(lumps[10].buffer).setInt32(0,-2,true);new DataView(lumps[10].buffer).setInt32(28,-1,true);
 const model=new DataView(lumps[14].buffer),at=64;
 for(const [i,value] of [-16,-16,-16,16,16,16,0,0,0].entries())model.setFloat32(at+i*4,value,true);
 model.setInt32(at+36,0,true);model.setInt32(at+40,-1,true);model.setInt32(at+44,-1,true);model.setInt32(at+48,-1,true);
 model.setInt32(at+56,0,true);model.setInt32(at+60,6,true);
 const total=124+lumps.reduce((sum,l)=>sum+l.length,0),buffer=new ArrayBuffer(total),out=new Uint8Array(buffer),dv=new DataView(buffer);
 dv.setInt32(0,30,true);let pos=124;
 for(const [i,l] of lumps.entries()){dv.setInt32(4+i*8,pos,true);dv.setInt32(8+i*8,l.length,true);out.set(l,pos);pos+=l.length}
 return buffer;
}
function fakeMap(){
 const bounds=[[0,-16,-16],[16,-16,-16],[16,16,-16],[0,16,-16],[0,-16,16],[16,-16,16],[16,16,16],[0,16,16]],
  polygons=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
 const faces=polygons.map((ids,i)=>({model:1,bspFaceIndex:i,points:ids.map(j=>bounds[j]),normal:i===0?[0,0,-1]:i===1?[0,0,1]:i===2?[0,-1,0]:i===3?[1,0,0]:i===4?[0,1,0]:[-1,0,0],flags:0,texture:0,sTexinfo:[1,0,0,0],tTexinfo:[0,1,0,0],texels:[],lightWidth:0,lightHeight:0,lightMin:[0,0]}));
 return {version:30,name:'fixture.bsp',faces,textures:[{name:texName,width:16,height:16,external:false}]};
}
test('HF5 reconstructs solid hull0 cell from a real-format model *1 tree, preserving WAD3 and MAP import',()=>{
 const source=miniSource(),before=new Uint8Array(source).slice(),p=extractBspObjectPrefab(fakeMap(),source,[0,1,2,3,4,5],'Object',[],{mode:'hull0-solid'});
 assert.equal(p.recovery.mode,'hull0-solid');assert.equal(p.recovery.modelIndex,1);assert.equal(p.recovery.solids,1);assert.equal(p.objects.length,1);
 assert.equal(validateBspObjectPrefab(JSON.parse(JSON.stringify(p))).objects.length,1);
 const archive=decodePrefabWad(p.wad.base64);assert.equal(findMipTextureInWads([archive],texName,16,16)?.name,texName);
 const report=inspectMapImport(exportMap({name:'test',version:1,objects:p.objects,world:{},wadNames:[p.wad.filename]}),'test.map').report;
 assert.equal(report.importedBrushes,1);assert.equal(report.skippedBrushes,0);
 assert.deepEqual(new Uint8Array(source),before);
});
test('HF5 refuses worldspawn, incomplete *N, malformed cyclic trees and illegal metadata',()=>{
 const m=fakeMap(),b=miniSource();
 assert.throws(()=>extractBspObjectPrefab(m,b,[0,1,2,3,4],'Incomplete',[],{mode:'hull0-solid'}),/entire/);
 const world=fakeMap();world.faces.forEach(f=>f.model=0);
 assert.throws(()=>extractBspObjectPrefab(world,b,[0,1,2,3,4,5],'World',[],{mode:'hull0-solid'}),/worldspawn/);
 const bad=b.slice(0),v=new DataView(bad),at=v.getInt32(4+5*8,true);v.setInt16(at+4,0,true);
 assert.throws(()=>extractBspObjectPrefab(m,bad,[0,1,2,3,4,5],'Cycle',[],{mode:'hull0-solid'}),/cyclic/);
 const good=extractBspObjectPrefab(m,b,[0,1,2,3,4,5],'Object',[],{mode:'hull0-solid'});
 assert.throws(()=>validateBspObjectPrefab({...good,recovery:{...good.recovery,solids:99}}),/metadata/);
});
test('HF5 near-collinear BSP face roundtrips to MAP as a valid panel',()=>{
 const m=fakeMap();m.faces=[{...m.faces[0],model:1,bspFaceIndex:0,points:[[-45.666667938,-1009,-58],[-44.5,-1012,-51],[-46,-1012,-60],[-46,-1008.1428833,-60]],normal:[.9863939,0,-.164399]}];
 const p=extractBspObjectPrefab(m,miniSource(),[0],'Skewed panel',[],{mode:'surface-shell'});
 const report=inspectMapImport(exportMap({name:'test',version:1,objects:p.objects,world:{},wadNames:[p.wad.filename]}),'test.map').report;
 assert.equal(report.importedBrushes,1);assert.equal(report.skippedBrushes,0);
});
