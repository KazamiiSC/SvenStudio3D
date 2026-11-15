import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {extractBspObjectPrefab,decodePrefabWad,validateBspObjectPrefab} from '../src/engine/bspObjectExtractor.ts';
import {placePrefab} from '../src/engine/prefabs.ts';
import {validateBrush,exportMap} from '../src/engine/exportMap.ts';
import {inspectMapImport} from '../src/engine/importMap.ts';
import {findMipTextureInWads} from '../src/engine/bspWadMipTexture.ts';
import {findBspWadTextures} from '../server/bspWadAssets.js';
import {fetchBspPrefabMipTextures} from '../src/engine/bspAutoWad.ts';

const texName='DOORPANEL';
function mip(){
 const size=16*16,raw=new Uint8Array(40+256+64+16+4+2+256*3),v=new DataView(raw.buffer);
 raw.set(new TextEncoder().encode(texName));v.setUint32(16,16,true);v.setUint32(20,16,true);
 let at=40;for(const [i,n] of [256,64,16,4].entries()){v.setUint32(24+i*4,at,true);raw.fill(37+i*23,at,at+n);at+=n}
 v.setUint16(at,256,true);for(let i=0;i<256;i++){raw[at+2+i*3]=i;raw[at+3+i*3]=255-i;raw[at+4+i*3]=255}
 return raw;
}
function embeddedBsp(){
 const raw=mip(),offset=132,len=8+raw.length,bytes=new Uint8Array(offset+len),v=new DataView(bytes.buffer);
 v.setInt32(0,30,true);v.setInt32(4+2*8,offset,true);v.setInt32(8+2*8,len,true);
 v.setInt32(offset,1,true);v.setInt32(offset+4,8,true);bytes.set(raw,offset+8);return bytes.buffer;
}
function face(id,points){return {bspFaceIndex:id,model:0,texture:0,flags:0,points,normal:[0,0,1],sTexinfo:[1,0,0,8],tTexinfo:[0,0,-1,12],texels:[],lightWidth:0,lightHeight:0,lightMin:[0,0]}}
function doorIsland(n=16){
 const faces=[];const dim=Math.sqrt(n);
 for(let y=0;y<dim;y++)for(let x=0;x<dim;x++){
  const minX=x*16,minY=y*16;
  faces.push(face(faces.length,[[minX,minY,0],[minX+16,minY,0],[minX+16,minY+16,0],[minX,minY+16,0]]));
 }
 return {name:'door.bsp',version:30,faces,textures:[{name:texName,width:16,height:16,external:false}],entities:[],wadNames:[],skyname:'',warnings:[],stats:{faces:n,vertices:32,models:1,leaves:0,entities:0,lightmappedFaces:0,embeddedTextures:1},bounds:{min:[0,0,0],max:[64,64,16]}};
}
function solidCube(){
 const v=[[0,0,0],[64,0,0],[64,64,0],[0,64,0],[0,0,64],[64,0,64],[64,64,64],[0,64,64]];
 const polys=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
 const map=doorIsland(16);
 map.faces=polys.map((ids,i)=>({...face(i,ids.map(j=>v[j])),normal: i===0?[0,0,-1]:i===1?[0,0,1]:[1,0,0]}));return map;
}
function wad(){
 const raw=mip(),buf=Buffer.alloc(12+raw.length+32);const dir=12+raw.length;
 buf.write('WAD3');buf.writeInt32LE(1,4);buf.writeInt32LE(dir,8);Buffer.from(raw).copy(buf,12);
 buf.writeInt32LE(12,dir);buf.writeInt32LE(raw.length,dir+4);buf.writeInt32LE(raw.length,dir+8);
 buf[dir+12]=0x43;buf.write(texName,dir+16,'ascii');return buf;
}
test('v2.0: one-click smart save falls back to 16 visible door polygons without requiring a closed worldspawn brush',()=>{
 const m=doorIsland(),source=embeddedBsp(),snapshot=new Uint8Array(source).slice(),ids=m.faces.map(f=>f.bspFaceIndex);
 assert.throws(()=>extractBspObjectPrefab(m,source,ids,'Door'),/closed|valid|enclose|faces|sides|bounded/);
 const prefab=extractBspObjectPrefab(m,source,ids,'Door',[],{mode:'auto'});
 assert.equal(prefab.recovery.mode,'surface-shell');assert.equal(prefab.recovery.panels,16);
 assert.deepEqual(prefab.recovery.skippedFaces,[]);assert.equal(prefab.objects.length,16);
 assert.ok(prefab.objects.every(b=>validateBrush(b).length===0));
 assert.deepEqual(new Uint8Array(source),snapshot);
 const round=validateBspObjectPrefab(JSON.parse(JSON.stringify(prefab)));
 assert.equal(round.objects.length,16);
 const placement=placePrefab(prefab,[256,256,128]);
 assert.equal(placement.length,16);
 const report=inspectMapImport(exportMap({name:'door-map',version:1,objects:placement,world:{},wadNames:[prefab.wad.filename]}),'door.map').report;
 assert.equal(report.importedBrushes,16);assert.equal(report.skippedBrushes,0);
 assert.deepEqual(findMipTextureInWads([decodePrefabWad(prefab.wad.base64)],texName,16,16)?.raw,mip());
});
test('v2.0: smart save keeps closed convex volumes as full solids; a single worldspawn face becomes one panel',()=>{
 const source=embeddedBsp(),closed=extractBspObjectPrefab(solidCube(),source,[0,1,2,3,4,5],'Cube',[],{mode:'auto'});
 assert.equal(closed.recovery,undefined);assert.equal(closed.objects.length,1);
 assert.deepEqual(validateBrush(closed.objects[0]),[]);
 const single=extractBspObjectPrefab(doorIsland(),source,[9],'Panel',[],{mode:'auto'});
 assert.equal(single.recovery.mode,'surface-shell');assert.equal(single.objects.length,1);
});
test('v2.0: smart save documents skipped malformed door faces and retains valid ones',()=>{
 const m=doorIsland();m.faces[5].points=[[16,16,0],[17,17,0],[18,18,0]];
 const prefab=extractBspObjectPrefab(m,embeddedBsp(),m.faces.map(f=>f.bspFaceIndex),'Door',[],{mode:'auto'});
 assert.equal(prefab.recovery.mode,'surface-shell');assert.equal(prefab.recovery.panels,15);
 assert.equal(prefab.recovery.skippedFaces[0].faceId,5);
});
test('v2.0: original external WAD mipmaps can be recovered read-only by the existing server auto-discovery',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sven-prefab-test-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const wadFolder=path.join(root,'svencoop','textures');await fs.mkdir(wadFolder,{recursive:true});
 const file=path.join(wadFolder,'doors.wad'),original=wad();await fs.writeFile(file,original);
 const response=await findBspWadTextures({gameDir:path.join(root,'svencoop'),wadNames:['doors.wad'],textureNames:[texName],includeMipRaw:true});
 assert.equal(response.textures.length,1);
 assert.equal(response.textures[0].raw,Buffer.from(mip()).toString('base64'));
 assert.equal(response.textures[0].indices,undefined);
 const legacy=await findBspWadTextures({gameDir:path.join(root,'svencoop'),wadNames:['doors.wad'],textureNames:[texName]});
 assert.ok(legacy.textures[0].indices);assert.equal(legacy.textures[0].raw,undefined);
 const fakeFetch=async(_url,init)=>({ok:true,json:async()=>response});
 const recovered=await fetchBspPrefabMipTextures('/game',['doors.wad'],[texName],fakeFetch);
 assert.deepEqual(recovered[0].raw,mip());
 const m=doorIsland();m.textures[0].external=true;
 const bytes=new ArrayBuffer(124);new DataView(bytes).setInt32(0,30,true);
 assert.throws(()=>extractBspObjectPrefab(m,bytes,[0],'Door',[],{mode:'auto'}),/original WAD3 bytes/);
 const saved=extractBspObjectPrefab(m,bytes,[0],'Door',[],{mode:'auto',resolvedMipTextures:recovered});
 assert.equal(saved.objects.length,1);assert.equal(saved.recovery.mode,'surface-shell');
 assert.equal(validateBspObjectPrefab(saved).objects.length,1);
 assert.deepEqual(await fs.readFile(file),original);
});
