import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBsp} from '../src/engine/bsp.ts';
import {readNativeBsp,writeNativeBsp,setNativeValue} from '../src/engine/bspNativeEdit.ts';
import {bspEditableTextureName,bspAllowedFaceTextureIndices,bspCanEditSelectedFaces,bspApplySurfaceOperation,bspPreviewSurfaceMap,writeBspSurfaceEdits} from '../src/engine/bspSurfaceEdit.ts';

const file=readFileSync(new URL('./fixtures/maptest1_lighting_v159.bsp',import.meta.url));
const buffer=()=>file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
const operation=(texture=-1,offsetU=0,offsetV=0,rotation=0,scaleU=1,scaleV=1)=>({texture,offsetU,offsetV,rotation,scaleU,scaleV});
const lumps=source=>{const d=new DataView(source);return Array.from({length:15},(_,id)=>({start:d.getInt32(4+id*8,true),length:d.getInt32(8+id*8,true)}))};
const bytes=(b,start,length)=>new Uint8Array(b,start,length);

test('6B: only ordinary, structurally compatible compiled textures can be replacement candidates',()=>{
  const map=parseBsp(buffer());
  assert.ok(bspAllowedFaceTextureIndices(map,[0]).length>=2);
  for(const name of ['sky','aaatrigger','clip','+0RUN','!water','{MASK','-0FOO','origin','hint','scroll123','MISSING_3'])assert.equal(bspEditableTextureName(name),false,name);
  assert.equal(bspEditableTextureName('SV_BRICK01'),true);
  assert.throws(()=>bspApplySurfaceOperation(map,{},[0],operation(999)),/Texture replacement/);
  const copy=structuredClone(map);copy.textures[1].width=256;
  assert.ok(bspAllowedFaceTextureIndices(copy,[0]).includes(1)); // BSP30 miptex sizes are independent of lightmap texels
});

test('6B: real BSP texinfo clone isolates selected face even if source texinfo is shared',()=>{
  const original=buffer(),map=parseBsp(original);
  const target=map.faces.find(f=>f.texinfoIndex===map.faces[0].texinfoIndex&&f.bspFaceIndex!==map.faces[0].bspFaceIndex);
  assert.ok(target,'fixture should include faces sharing texinfo');
  const edited=bspApplySurfaceOperation(map,{},[0],operation(1,16,-16));
  const rebuilt=writeBspSurfaceEdits(original,edited);
  const out=parseBsp(rebuilt),first=out.faces.find(f=>f.bspFaceIndex===0),untouched=out.faces.find(f=>f.bspFaceIndex===target.bspFaceIndex);
  assert.equal(first.texture,1);assert.equal(first.sTexinfo[3],map.faces[0].sTexinfo[3]+16);
  assert.equal(first.tTexinfo[3],map.faces[0].tTexinfo[3]-16);
  assert.notEqual(first.texinfoIndex,untouched.texinfoIndex);
  assert.equal(untouched.texture,target.texture);
  assert.deepEqual(untouched.sTexinfo,target.sTexinfo);
  assert.deepEqual(untouched.tTexinfo,target.tTexinfo);
  assert.deepEqual(Array.from(bytes(original,0,124).slice(0,4)),Array.from(bytes(rebuilt,0,124).slice(0,4)));
  const srcLumps=lumps(original),outLumps=lumps(rebuilt);
  for(let id=0;id<15;id++){
    if(id===6||id===7)continue;
    assert.deepEqual(outLumps[id],srcLumps[id],`header for lump ${id}`);
    assert.deepEqual(bytes(rebuilt,srcLumps[id].start,srcLumps[id].length),bytes(original,srcLumps[id].start,srcLumps[id].length),`untouched lump ${id}`);
  }
  const faces=srcLumps[7];
  for(let face=1;face<faces.length/20;face++){
    assert.deepEqual(bytes(rebuilt,faces.start+face*20,20),bytes(original,faces.start+face*20,20),`untouched BSP face ${face}`);
  }
  assert.deepEqual(first.lightRgb,map.faces[0].lightRgb);
  assert.equal(first.lightWidth,map.faces[0].lightWidth);
  assert.equal(first.lightHeight,map.faces[0].lightHeight);
  assert.deepEqual(bytes(original,0,original.byteLength),new Uint8Array(file),'original source preserved');
});

test('6D: lightmapped surfaces accept bounded rotation, scale and fractional shift with reprojected lightmap samples',()=>{
  const raw=buffer(),map=parseBsp(raw),lit=map.faces.find(f=>f.lightRgb&&bspAllowedFaceTextureIndices(map,[f.bspFaceIndex]).length);
  assert.ok(lit);
  const change=bspApplySurfaceOperation(map,{},[lit.bspFaceIndex],operation(-1,8,3,45,1.25,.75));
  const rebuilt=parseBsp(writeBspSurfaceEdits(raw,change));
  const result=rebuilt.faces.find(f=>f.bspFaceIndex===lit.bspFaceIndex);
  assert.ok(result.lightRgb?.length);
  assert.ok(result.lightmapOffset>=0);
  assert.notEqual(result.lightmapOffset,lit.lightmapOffset);
  assert.notDeepEqual(result.sTexinfo,lit.sTexinfo);
  assert.notDeepEqual(result.tTexinfo,lit.tTexinfo);
  const shift=bspApplySurfaceOperation(map,{},[lit.bspFaceIndex],operation(-1,32,16));
  const afterShift=parseBsp(writeBspSurfaceEdits(raw,shift)).faces.find(f=>f.bspFaceIndex===lit.bspFaceIndex);
  assert.deepEqual(afterShift.lightRgb,lit.lightRgb);
  assert.equal(afterShift.lightmapOffset,lit.lightmapOffset);
});

test('6B: export detects tampered or malformed face indexes and refuses unvalidated material',()=>{
  const src=buffer(),map=parseBsp(src),patch=bspApplySurfaceOperation(map,{},[0],operation(-1,16));
  const modified=structuredClone(patch);modified[0].texture=99;
  assert.throws(()=>writeBspSurfaceEdits(src,modified),/special|unsupported/i);
  const outOfRange={[99999]:patch[0]};
  assert.throws(()=>writeBspSurfaceEdits(src,outOfRange),/outside|unavailable/i);
  assert.throws(()=>bspApplySurfaceOperation(map,{},[0,0],operation(-1,16)),/unique/i);
  assert.throws(()=>bspApplySurfaceOperation(map,{},[0],operation(-1,0,0,0,0.02,1)),/safe limits/i);
});

test('6B: multiple operations are undo-ready immutable snapshots and preview uses saved texels',()=>{
  const map=parseBsp(buffer());const before={};
  const first=bspApplySurfaceOperation(map,before,[0],operation(-1,16));
  const second=bspApplySurfaceOperation(map,first,[0],operation(-1,16));
  assert.deepEqual(before,{});assert.equal(first[0].s[3],16);assert.equal(second[0].s[3],32);
  const preview=bspPreviewSurfaceMap(map,second);
  assert.equal(preview.faces[0].texels[0][0],map.faces[0].texels[0][0]+32);
  assert.notEqual(preview,map);assert.notEqual(preview.faces[0],map.faces[0]);
  assert.equal(bspPreviewSurfaceMap(map,{}),map);
  assert.deepEqual(bspApplySurfaceOperation(map,second,[0],operation(-1,-32)),{});
});

test('6B: UV-only multi-selection supports faces with different texture dimensions without forced replacement',()=>{
  const source=buffer(),map=parseBsp(source);
  const first=map.faces[0],second=map.faces.find(f=>f.texture!==map.faces[0].texture);
  const independent=structuredClone(map);
  independent.textures[second.texture].width=256;
  assert.equal(bspCanEditSelectedFaces(independent,[first.bspFaceIndex,second.bspFaceIndex]),true);
  assert.ok(bspAllowedFaceTextureIndices(independent,[first.bspFaceIndex,second.bspFaceIndex]).length>0);
  const edited=bspApplySurfaceOperation(independent,{},[first.bspFaceIndex,second.bspFaceIndex],operation(-1,16));
  assert.equal(Object.keys(edited).length,2);
});

test('6B: unlit face supports rotation and scale after binary export/reparse',()=>{
  const raw=buffer(),native=readNativeBsp(raw),map=parseBsp(raw);
  const face=map.faces.find(f=>bspAllowedFaceTextureIndices(map,[f.bspFaceIndex]).length>0);
  const dv=new DataView(raw);dv.setInt32(native.lumps[7].offset+face.bspFaceIndex*20+16,-1,true);
  const unlit=parseBsp(raw),edited=bspApplySurfaceOperation(unlit,{},[face.bspFaceIndex],operation(-1,3,-7,45,2,.5));
  const out=parseBsp(writeBspSurfaceEdits(raw,edited));
  const target=out.faces.find(f=>f.bspFaceIndex===face.bspFaceIndex);
  assert.notDeepEqual(target.sTexinfo,face.sTexinfo);assert.notDeepEqual(target.tTexinfo,face.tTexinfo);
  assert.equal(target.lightmapOffset,-1);
  assert.deepEqual(Array.from(target.lightStyles),Array.from(face.lightStyles));
});

test('6B: malformed face layout fails closed before writing any texture data',()=>{
  const raw=buffer(),map=parseBsp(raw),patch=bspApplySurfaceOperation(map,{},[0],operation(-1,16));
  const doc=readNativeBsp(raw);new DataView(raw).setUint16(doc.lumps[7].offset+8,2,true);
  assert.throws(()=>writeBspSurfaceEdits(raw,patch),/Malformed BSP faces/);
});

test('6B: binary face changes and entity keyvalue edits coexist in one export',()=>{
  const src=buffer(),doc=readNativeBsp(src);
  const index=doc.entities.findIndex((e,i)=>i>0&&e.pairs.some(p=>p.key==='origin'));
  assert.ok(index>0);
  const pair=doc.entities[index].pairs.findIndex(p=>p.key==='origin');
  const entities=writeNativeBsp(setNativeValue(doc,index,pair,'128 256 384'));
  const map=parseBsp(src),patch=bspApplySurfaceOperation(map,{},[0],operation(1,16));
  const result=writeBspSurfaceEdits(entities,patch);
  assert.equal(parseBsp(result).entities[index].properties.origin,'128 256 384');
  assert.equal(parseBsp(result).faces[0].texture,1);
  readNativeBsp(result);
});

test('6B: source integration provides controls, undo/redo and binary export',()=>{
  const source=readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
  assert.match(source,/bspApplySurfaceOperation\(extendedMap,surfaceHistory\.present,selectedFaces/);
  assert.match(source,/writeBspWadSurfaceCopy\(entitiesBytes,surfaceOverrides/);
  assert.match(source,/bspPreviewSurfaceMap\(extendedMap,gesturePreview\?\?surfaceOverrides\)/);
  assert.match(source,/undoSurfaceEdit/);assert.match(source,/redoSurfaceEdit/);
  assert.match(source,/BspSurface map=\{renderSurfaceMap\} overrides=\{gesturePreview\?\?surfaceOverrides\}/);
});
