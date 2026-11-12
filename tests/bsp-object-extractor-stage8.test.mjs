import test from 'node:test';
import assert from 'node:assert/strict';
import {extractBspObjectPrefab,decodePrefabWad,validateBspObjectPrefab,isPrefabRenderableTexture} from '../src/engine/bspObjectExtractor.ts';
import {placePrefab} from '../src/engine/prefabs.ts';
import {exportBrush,validateBrush} from '../src/engine/exportMap.ts';
import {findMipTextureInWads} from '../src/engine/bspWadMipTexture.ts';

const name='TESTBRICK';
function mip(){
 const size=16*16,raw=new Uint8Array(40+256+64+16+4+2+256*3),v=new DataView(raw.buffer);
 for(let i=0;i<name.length;i++)raw[i]=name.charCodeAt(i);
 v.setUint32(16,16,true);v.setUint32(20,16,true);
 let at=40;for(const [i,n] of [256,64,16,4].entries()){v.setUint32(24+i*4,at,true);raw.fill(i*13,at,at+n);at+=n}
 v.setUint16(at,256,true);for(let i=0;i<256;i++){raw[at+2+i*3]=i;raw[at+3+i*3]=255-i;raw[at+4+i*3]=i/2}
 return raw;
}
function bspSource(){
 const raw=mip(),offset=132,len=8+raw.length,bytes=new Uint8Array(offset+len),v=new DataView(bytes.buffer);
 v.setInt32(0,30,true);v.setInt32(4+2*8,offset,true);v.setInt32(8+2*8,len,true);
 v.setInt32(offset,1,true);v.setInt32(offset+4,8,true);bytes.set(raw,offset+8);return bytes.buffer;
}
function world(){
 const v=[[0,0,0],[64,0,0],[64,64,0],[0,64,0],[0,0,64],[64,0,64],[64,64,64],[0,64,64]];
 const polygons=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
 const faces=polygons.map((ids,id)=>{
  const s=id===3||id===5?[0,1,0,12]:[1,0,0,12],t=id<2?[0,1,0,24]:[0,0,-1,24];
  return {model:0,bspFaceIndex:id,points:ids.map(i=>v[i]),normal:[0,0,1],texture:0,flags:0,sTexinfo:s,tTexinfo:t,texels:[],lightWidth:0,lightHeight:0,lightMin:[0,0]};
 });
 return {name:'box.bsp',version:30,faces,textures:[{name,width:16,height:16,external:false}],entities:[],wadNames:[],skyname:'',warnings:[],stats:{faces:6,vertices:8,models:1,leaves:0,entities:0,lightmappedFaces:0,embeddedTextures:1},bounds:{min:[0,0,0],max:[64,64,64]}};
}
test('closed convex BSP cube -> real editable brush -> WAD3 with identical indices and palette',()=>{
 const result=extractBspObjectPrefab(world(),bspSource(),[0,1,2,3,4,5],'My Desk');
 assert.equal(result.format,'svenstudio-bsp-object');assert.equal(result.objects.length,1);
 const brush=result.objects[0];assert.equal(brush.faces.length,6);
 assert.deepEqual(validateBrush(brush),[]);
 assert.match(exportBrush(brush),/TESTBRICK/);
 assert.equal(brush.faces[0].uShift,12);assert.equal(brush.faces[0].vShift,24);
 const wad=decodePrefabWad(result.wad.base64);
 assert.deepEqual(findMipTextureInWads([wad],name,16,16)?.raw,mip());
 assert.equal(validateBspObjectPrefab(JSON.parse(JSON.stringify(result))).objects.length,1);
 const placed=placePrefab(result,[512,128,64]);
 assert.equal(placed.length,1);assert.deepEqual(validateBrush(placed[0]),[]);
 assert.notEqual(placed[0].id,brush.id);
});
test('missing side rejected; original BSP source never modified',()=>{
 const source=bspSource(),snapshot=new Uint8Array(source).slice();
 assert.throws(()=>extractBspObjectPrefab(world(),source,[0,1,2,3,4],'Broken'),/closed|Incomplete|valid|enclose|manifold/);
 assert.deepEqual(new Uint8Array(source),snapshot);
});
test('source texture absent -> refuse instead of inventing WAD data',()=>{
 const m=world();m.textures[0].name='MISSING_WAD';
 assert.throws(()=>extractBspObjectPrefab(m,bspSource(),[0,1,2,3,4,5],'Missing'),/original WAD3 bytes/);
});
test('selected duplicate face IDs rejected',()=>{
 assert.throws(()=>extractBspObjectPrefab(world(),bspSource(),[0,1,2,3,4,4],'Dups'),/distinct/);
});
test('broken WAD archive rejected on prefab import',()=>{
 const result=extractBspObjectPrefab(world(),bspSource(),[0,1,2,3,4,5],'Cube');
 const fake={...result,wad:{...result.wad,base64:'!!!'}};
 assert.throws(()=>validateBspObjectPrefab(fake),/Invalid|WAD/);
});
test('material mismatch across coplanar selected face is not silently flattened',()=>{
 const m=world();m.faces.push({...m.faces[0],bspFaceIndex:6,texture:1});m.textures.push({name:'ALT',width:16,height:16,external:true});
 assert.throws(()=>extractBspObjectPrefab(m,bspSource(),[0,1,2,3,4,5,6],'Mixed'),/multiple textures|UV/);
});
test('two separate BSP cubes become two independent MAP brushes without deleting source',()=>{
 const first=world(),other=world();
 const shifted=other.faces.map((face,i)=>({...face,bspFaceIndex:i+6,points:face.points.map(p=>[p[0]+192,p[1],p[2]])}));
 first.faces.push(...shifted);
 const result=extractBspObjectPrefab(first,bspSource(),Array.from({length:12},(_,i)=>i),'Boxes');
 assert.equal(result.objects.length,2);
 for(const brush of result.objects)assert.deepEqual(validateBrush(brush),[]);
 const positions=result.objects.map(o=>o.position[0]).sort((a,b)=>a-b);
 assert.deepEqual(positions,[32,224]);
});
test('original texture WAD3 is accepted by the existing WAD reader',async()=>{
 const {parseWad}=await import('../src/engine/wad.ts');
 const result=extractBspObjectPrefab(world(),bspSource(),[0,1,2,3,4,5],'Cube');
 const file=new File([decodePrefabWad(result.wad.base64)],result.wad.filename);
 const textures=await parseWad(file,{remember:false});
 assert.equal(textures.length,1);assert.equal(textures[0].name,name);
 assert.deepEqual([textures[0].width,textures[0].height],[16,16]);
});
test('MAP placement preserves UV pixel coordinates through world translation',()=>{
 const obj=extractBspObjectPrefab(world(),bspSource(),[0,1,2,3,4,5],'Cube');
 const before=obj.objects[0];
 const after=placePrefab(obj,[800,256,64])[0];
 const f=before.faces[0],g=after.faces[0];
 const at=i=>before.vertices[i].map((n,axis)=>n+before.position[axis]);
 const to=i=>after.vertices[i].map((n,axis)=>n+after.position[axis]);
 for(const j of f.indices){
  const original=at(j),moved=to(j);
  assert.ok(Math.abs(original.reduce((s,v,i)=>s+v*f.uAxis[i],f.uShift)-moved.reduce((s,v,i)=>s+v*g.uAxis[i],g.uShift))<.001);
 }
});
test('extracted brush exports to Valve 220 MAP and survives MAP reimport',async()=>{
 const {exportMap}=await import('../src/engine/exportMap.ts');
 const {inspectMapImport}=await import('../src/engine/importMap.ts');
 const prefab=extractBspObjectPrefab(world(),bspSource(),[0,1,2,3,4,5],'Cube');
 const objects=placePrefab(prefab,[512,256,64]);
 const exported=exportMap({version:1,name:'bsp-extracted-objects',objects,world:{},wadNames:[prefab.wad.filename]});
 assert.match(exported,/TESTBRICK/);
 assert.match(exported,/\[ .* \] \[ .* \]/);
 const imported=inspectMapImport(exported,'bsp-extracted-objects.map');
 assert.equal(imported.report.skippedBrushes,0);
 assert.equal(imported.report.importedBrushes,1);
});


test('valid GoldSrc T-junction polygon with first three points collinear is not falsely degenerate',()=>{
 const m=world();
 // BSP compilers insert extra points along an existing edge. These first
 // three vertices are collinear, but the full face still encloses 4096 u².
 const polygon=m.faces[0].points;
 const a=polygon[0],b=polygon[1];
 m.faces[0].points=[a,
  a.map((v,i)=>v+(b[i]-v)/3),
  a.map((v,i)=>v+2*(b[i]-v)/3),
  ...polygon.slice(1)];
 const result=extractBspObjectPrefab(m,bspSource(),[0,1,2,3,4,5],'T-Junction');
 assert.equal(result.objects.length,1);
 assert.deepEqual(validateBrush(result.objects[0]),[]);
});

test('truly zero-area face is rejected with the original BSP face index',()=>{
 const m=world();
 m.faces[0].points=[[0,0,0],[16,0,0],[32,0,0],[48,0,0]];
 assert.throws(()=>extractBspObjectPrefab(m,bspSource(),[0,1,2,3,4,5],'Bad'),/BSP face #0 has zero area/);
});

test('8A HF2: incomplete/nonconvex BSP selection still fails exact mode, but explicit surface panels export valid editable MAP brushes',async()=>{
 const m=world(),ids=[0,1,2,3,4];
 assert.throws(()=>extractBspObjectPrefab(m,bspSource(),ids,'Computer'),/closed|Incomplete|valid|enclose/);
 const prefab=extractBspObjectPrefab(m,bspSource(),ids,'Computer',[],{mode:'surface-shell'});
 assert.equal(prefab.recovery.mode,'surface-shell');
 assert.equal(prefab.objects.length,5);
 assert.deepEqual(prefab.faceIds,ids);
 for(const brush of prefab.objects){
   assert.deepEqual(validateBrush(brush),[]);
   assert.match(exportBrush(brush),/TESTBRICK/);
 }
 const wad=decodePrefabWad(prefab.wad.base64);
 assert.deepEqual(findMipTextureInWads([wad],name,16,16)?.raw,mip());
 assert.equal(validateBspObjectPrefab(JSON.parse(JSON.stringify(prefab))).objects.length,5);
 const {exportMap}=await import('../src/engine/exportMap.ts');
 const {inspectMapImport}=await import('../src/engine/importMap.ts');
 const objects=placePrefab(prefab,[512,64,80]);
 const map=exportMap({version:1,name:'panel-recovery',objects,world:{},wadNames:[prefab.wad.filename]});
 assert.equal(inspectMapImport(map,'panel-recovery.map').report.skippedBrushes,0);
});

test('8A HF2: T-junction, concave polygon, model *111 and missing originals produce thin, validated panels',()=>{
 const m=world(),f=m.faces[0];
 f.model=111;
 f.points=[[0,0,0],[64,0,0],[64,24,0],[24,24,0],[24,64,0],[0,64,0]];
 const prefab=extractBspObjectPrefab(m,bspSource(),[0],'Laptop',[],{mode:'surface-shell',thickness:2});
 assert.equal(prefab.recovery.mode,'surface-shell');
 assert.ok(prefab.objects.length>=2);
 for(const brush of prefab.objects)assert.deepEqual(validateBrush(brush),[]);
 const invalid=world();invalid.faces[0].points=[[0,0,0],[16,0,0],[32,0,0],[48,0,0]];
 assert.throws(()=>extractBspObjectPrefab(invalid,bspSource(),[0],'Bad',[],{mode:'surface-shell'}),/zero area/);
});

test('8A HF2: surface shell keeps collinear T-junction and rejects invalid thickness or oversized sets',()=>{
 const m=world(),f=m.faces[0],a=f.points[0],b=f.points[1];
 f.points=[a,a.map((v,i)=>v+(b[i]-v)/2),...f.points.slice(1)];
 const prefab=extractBspObjectPrefab(m,bspSource(),[0],'Laptop',[],{mode:'surface-shell'});
 assert.equal(prefab.objects.length,1);assert.deepEqual(validateBrush(prefab.objects[0]),[]);
 assert.throws(()=>extractBspObjectPrefab(m,bspSource(),[0],'Bad',[],{mode:'surface-shell',thickness:0.01}),/thickness/);
 const hacked=structuredClone(prefab);hacked.recovery.panels=99;
 assert.throws(()=>validateBspObjectPrefab(hacked),/recovery metadata/);
});

test('8A HF3: a valid BSP face with nearly-collinear first three vertices exports as a MAP panel',()=>{
 const m=world();
 // Tiny turn: first-three cross product magnitude 0.004 (< MAP validator 0.01)
 // but the whole convex polygon has large positive area. HF2 could reject it.
 m.faces[0].points=[[0,0,0],[2,0,0],[4,.002,0],[64,64,0],[0,64,0]];
 const prefab=extractBspObjectPrefab(m,bspSource(),[0],'Chair',[],{mode:'surface-shell'});
 assert.equal(prefab.recovery.skippedFaces.length,0);
 assert.equal(prefab.objects.length,1);
 assert.deepEqual(validateBrush(prefab.objects[0]),[]);
 assert.match(exportBrush(prefab.objects[0]),/TESTBRICK/);
});

test('8A HF3: one degenerate micro-face does not block other chair panels; omitted BSP ID recorded',()=>{
 const m=world();
 m.faces.push({...m.faces[0],bspFaceIndex:17625,points:[[0,0,0],[4,0,0],[8,0,0]]});
 const prefab=extractBspObjectPrefab(m,bspSource(),[0,17625],'Chair',[],{mode:'surface-shell'});
 assert.equal(prefab.objects.length,1);
 assert.deepEqual(prefab.faceIds,[0,17625]);
 assert.equal(prefab.recovery.skippedFaces.length,1);
 assert.equal(prefab.recovery.skippedFaces[0].faceId,17625);
 assert.match(prefab.recovery.skippedFaces[0].reason,/zero area/);
 assert.equal(validateBspObjectPrefab(JSON.parse(JSON.stringify(prefab))).recovery.skippedFaces.length,1);
 const malformed=structuredClone(prefab);
 malformed.recovery.skippedFaces[0].faceId=99;
 assert.throws(()=>validateBspObjectPrefab(malformed),/Invalid skipped BSP faces/);
});

test('8A HF3: every invalid face rejected instead of emitting an empty prefab',()=>{
 const m=world();m.faces[0].points=[[0,0,0],[3,0,0],[6,0,0]];
 assert.throws(()=>extractBspObjectPrefab(m,bspSource(),[0],'No panels',[],{mode:'surface-shell'}),/No exportable panels remain.*BSP face #0/);
});

function namedMip(name){
 const bytes=mip();bytes.fill(0,0,16);
 for(let i=0;i<name.length;i++)bytes[i]=name.charCodeAt(i);
 return bytes;
}
function sampleWad(names){
 const raws=names.map(namedMip);
 const end=12+raws.reduce((n,v)=>n+v.length,0),bytes=new Uint8Array(end+names.length*32),v=new DataView(bytes.buffer);
 bytes.set([87,65,68,51]);v.setInt32(4,names.length,true);v.setInt32(8,end,true);
 let p=12;
 for(let i=0;i<raws.length;i++){
   bytes.set(raws[i],p);const entry=end+i*32;
   v.setInt32(entry,p,true);v.setInt32(entry+4,raws[i].length,true);v.setInt32(entry+8,raws[i].length,true);bytes[entry+12]=0x43;
   for(let j=0;j<names[i].length;j++)bytes[entry+16+j]=names[i].charCodeAt(j);
   p+=raws[i].length;
 }
 return bytes;
}
test('HF4: masked, animated and random GoldSrc prefixes are visible materials, tool textures are not',()=>{
 for(const name of ['{SCREEN','+0SCREEN','+ASCREEN','-0DESK','~DETAIL','TESTBRICK'])assert.equal(isPrefabRenderableTexture(name),true,name);
 for(const name of ['NULL','SKIP','ORIGIN','HINT','CLIP','AAATRIGGER','SKY','!WATER','TOO_LONG_TEXTURE_NAME','bad name'])assert.equal(isPrefabRenderableTexture(name),false,name);
});
test('HF4: all 17 selected monitor faces with a masked texture yield 17 panels, without leaving only its sticky note',async()=>{
 const map=world();const masked='{MONITOR';map.textures[0]={name:masked,width:16,height:16,external:true};
 map.faces=[...Array.from({length:17},(_,i)=>({...map.faces[0],bspFaceIndex:24000+i,model:111,points:map.faces[0].points.map(p=>[p[0]+i*128,p[1],p[2]])}))];
 const prefab=extractBspObjectPrefab(map,bspSource(),map.faces.map(f=>f.bspFaceIndex),'Monitor',[sampleWad([masked])],{mode:'surface-shell'});
 assert.equal(prefab.objects.length,17);assert.equal(prefab.recovery.skippedFaces.length,0);
 assert.ok(prefab.objects.every(brush=>brush.faces.every(face=>face.texture===masked)));
 assert.deepEqual(findMipTextureInWads([decodePrefabWad(prefab.wad.base64)],masked,16,16)?.raw,namedMip(masked));
 const {exportMap}=await import('../src/engine/exportMap.ts');
 const {inspectMapImport}=await import('../src/engine/importMap.ts');
 const output=exportMap({version:1,name:'monitor',objects:placePrefab(prefab,[0,0,0]),world:{},wadNames:[prefab.wad.filename]});
 assert.equal(inspectMapImport(output,'monitor.map').report.importedBrushes,17);
});
test('HF4: + animated texture keeps referenced frames with identical original mipmaps',()=>{
 const m=world();m.textures=[{name:'+0SCREEN',width:16,height:16,external:true},{name:'+1SCREEN',width:16,height:16,external:true}];
 const wad=sampleWad(['+0SCREEN','+1SCREEN']);
 const prefab=extractBspObjectPrefab(m,bspSource(),[0], 'Screen',[wad],{mode:'surface-shell'});
 assert.equal(prefab.recovery.skippedFaces.length,0);
 const output=decodePrefabWad(prefab.wad.base64);
 assert.deepEqual(findMipTextureInWads([output],'+0SCREEN',16,16)?.raw,namedMip('+0SCREEN'));
 assert.deepEqual(findMipTextureInWads([output],'+1SCREEN',16,16)?.raw,namedMip('+1SCREEN'));
});
test('HF4: tool NULL still skipped with its name, no fake visible panels',()=>{
 const m=world();m.textures[0].name='NULL';
 assert.throws(()=>extractBspObjectPrefab(m,bspSource(),[0],'Bad',[],{mode:'surface-shell'}),/NULL/);
});

test('HF4: recovered visible panel points toward original BSP face normal',()=>{
 const m=world();m.faces[0].normal=[0,0,1];
 // Deliberately reverse the original surface winding.
 m.faces[0].points=m.faces[0].points.toReversed();
 const prefab=extractBspObjectPrefab(m,bspSource(),[0],'Front',[],{mode:'surface-shell'});
 const brush=prefab.objects[0],ids=brush.faces[0].indices;
 const [a,b,c]=ids.slice(0,3).map(i=>brush.vertices[i]);
 const ab=b.map((v,i)=>v-a[i]),ac=c.map((v,i)=>v-a[i]);
 const z=ab[0]*ac[1]-ab[1]*ac[0];
 assert.ok(z>0,'panel facing matches BSP normal +Z');
 assert.deepEqual(validateBrush(brush),[]);
});
