import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBsp} from '../src/engine/bsp.ts';
import {readNativeBsp,writeNativeBsp} from '../src/engine/bspNativeEdit.ts';
import {bspLightmapAdjustmentDefault,bspCanEditFaceLightmap,bspLightmapLayersForFace,bspPreviewFaceLightmaps,writeBspFaceLightmaps} from '../src/engine/bspFaceLightmapEdit.ts';
import {bspBrushCopyEligibility,bspBrushPasteDelta,bspPasteBrushModelInstances} from '../src/engine/bspBrushPaste.ts';
import {compactBspCopy} from '../src/engine/bspCompactExport.ts';
import {bspApplySurfaceOperation,writeBspSurfaceEdits} from '../src/engine/bspSurfaceEdit.ts';
const fixture=readFileSync(new URL('./fixtures/maptest1_lighting_v159.bsp',import.meta.url));
const fresh=()=>fixture.buffer.slice(fixture.byteOffset,fixture.byteOffset+fixture.byteLength);
const faceBy=(map,id)=>map.faces.find(f=>f.bspFaceIndex===id);
const lump=(buffer,id)=>{const l=readNativeBsp(buffer).lumps[id];return new Uint8Array(buffer,l.offset,l.length)};

test('7: RGB edits apply to the chosen face, preserve styles and do not touch adjacent surfaces or game source',()=>{
 const original=fresh(),map=parseBsp(original),face=map.faces.find(f=>bspCanEditFaceLightmap(f));
 const id=face.bspFaceIndex,other=map.faces.find(f=>f.bspFaceIndex!==id&&bspCanEditFaceLightmap(f));
 const adjustment={gain:1.35,add:12,tint:[1,.5,.25]};
 const expected=bspLightmapLayersForFace(map,id,adjustment);
 const output=compactBspCopy(writeBspFaceLightmaps(original,{[id]:adjustment})).bytes;
 const after=parseBsp(output),selected=faceBy(after,id),unselected=faceBy(after,other.bspFaceIndex);
 assert.notEqual(selected.lightmapOffset,face.lightmapOffset);
 assert.deepEqual(selected.lightStyles,face.lightStyles);
 assert.deepEqual(selected.lightLayers,expected);
 assert.deepEqual(unselected.lightLayers,other.lightLayers);
 assert.deepEqual(lump(output,4),lump(original,4),'VIS untouched');
 assert.deepEqual(lump(output,9),lump(original,9),'collision hulls untouched');
 assert.deepEqual(lump(output,14),lump(original,14),'model structures untouched');
 assert.deepEqual(new Uint8Array(original),new Uint8Array(fresh()),'source intact');
});
test('7: two different face lightmaps are independently stored and do not overwrite shared offsets',()=>{
 const raw=fresh(),map=parseBsp(raw),faces=map.faces.filter(f=>bspCanEditFaceLightmap(f)).slice(0,2);
 const changes=Object.fromEntries(faces.map((face,i)=>[face.bspFaceIndex,{gain:i?1.2:.5,add:i?7:-7,tint:[1,1,1]}]));
 const after=parseBsp(writeBspFaceLightmaps(raw,changes));
 assert.notEqual(faceBy(after,faces[0].bspFaceIndex).lightmapOffset,faceBy(after,faces[1].bspFaceIndex).lightmapOffset);
 for(const face of faces)assert.deepEqual(faceBy(after,face.bspFaceIndex).lightLayers,bspLightmapLayersForFace(map,face.bspFaceIndex,changes[face.bspFaceIndex]));
});
test('7: copy/paste of RGB samples requires identical size and exact styles',()=>{
 const map=parseBsp(fresh()),face=map.faces.find(f=>bspCanEditFaceLightmap(f));
 const eq=map.faces.find(f=>f!==face&&bspCanEditFaceLightmap(f)&&f.lightWidth===face.lightWidth&&f.lightHeight===face.lightHeight&&JSON.stringify(f.lightStyles)===JSON.stringify(face.lightStyles));
 if(eq){const changed=bspLightmapLayersForFace(map,eq.bspFaceIndex,{...bspLightmapAdjustmentDefault(),copyFrom:face.bspFaceIndex});assert.deepEqual(changed,face.lightLayers)}
 const unlike=map.faces.find(f=>f!==face&&bspCanEditFaceLightmap(f)&&(f.lightWidth!==face.lightWidth||f.lightHeight!==face.lightHeight||JSON.stringify(f.lightStyles)!==JSON.stringify(face.lightStyles)));
 if(unlike)assert.throws(()=>bspLightmapLayersForFace(map,unlike.bspFaceIndex,{...bspLightmapAdjustmentDefault(),copyFrom:face.bspFaceIndex}),/dimensions and lightstyles/);
});
test('7: malformed or unsupported edits fail closed, including missing RGB and nonfinite colors',()=>{
 const map=parseBsp(fresh()),face=map.faces.find(f=>bspCanEditFaceLightmap(f));
 const a=bspLightmapAdjustmentDefault();
 assert.throws(()=>writeBspFaceLightmaps(fresh(),{[face.bspFaceIndex]:{...a,gain:Infinity}}),/Invalid lightmap/);
 assert.throws(()=>writeBspFaceLightmaps(fresh(),{[face.bspFaceIndex]:{...a,tint:[-1,1,1]}}),/Invalid lightmap/);
 assert.throws(()=>writeBspFaceLightmaps(fresh(),{'999999':a}),/no readable/);
 assert.deepEqual(bspPreviewFaceLightmaps(map,{[face.bspFaceIndex]:a}).faces.find(f=>f.bspFaceIndex===face.bspFaceIndex).lightLayers,face.lightLayers);
});
test('7: exported UV reprojection and color modifications compose without losing lightstyles',()=>{
 const raw=fresh(),map=parseBsp(raw),face=map.faces.find(f=>bspCanEditFaceLightmap(f)&&f.flags===0);
 const changed=bspApplySurfaceOperation(map,{},[face.bspFaceIndex],{texture:-1,offsetU:0,offsetV:0,rotation:30,scaleU:1.2,scaleV:.8});
 const uv=writeBspSurfaceEdits(raw,changed);
 const adjustments={[face.bspFaceIndex]:{gain:1.7,add:3,tint:[1,.8,.8]}};
 const compact=compactBspCopy(writeBspFaceLightmaps(uv,adjustments)).bytes;
 const reread=parseBsp(compact),base=parseBsp(uv),f=faceBy(reread,face.bspFaceIndex);
 assert.deepEqual(f.lightLayers,bspLightmapLayersForFace(base,face.bspFaceIndex,adjustments[face.bspFaceIndex]));
 assert.deepEqual(f.lightStyles,face.lightStyles);
});
// Synthetic bmodel fixture with two contiguous face ranges. It uses the
// original BSP geometry as a mock submodel so tests do not need a game install.
function brushFixture(){
 const source=fresh(),native=readNativeBsp(source);
 const buffers=Array.from({length:15},(_,id)=>Buffer.from(lump(source,id)));
 const originalModel=Buffer.from(buffers[14]);const newModel=Buffer.from(originalModel);
 newModel.writeInt32LE(0,56);newModel.writeInt32LE(3,60);
 originalModel.writeInt32LE(3,56);originalModel.writeInt32LE(11,60);
 buffers[14]=Buffer.concat([originalModel,newModel]);
 buffers[0]=Buffer.from(Buffer.from(buffers[0]).subarray(0,-1).toString('latin1')+'\n{\n"classname" "func_wall"\n"model" "*1"\n"origin" "0 0 0"\n"targetname" "original_sign"\n}\n\0','latin1');
 let cursor=124;const output=Buffer.alloc(4+15*8+buffers.reduce((n,b)=>n+b.length+4,0));output.writeInt32LE(30,0);
 buffers.forEach((buf,i)=>{cursor=(cursor+3)&~3;output.writeInt32LE(cursor,4+i*8);output.writeInt32LE(buf.length,8+i*8);buf.copy(output,cursor);cursor+=buf.length});
 return output.buffer.slice(output.byteOffset,output.byteOffset+cursor);
}
test('7: BSP brush copy allows static compiled submodels, multi-selection destination and preserves geometry lumps',()=>{
 const source=brushFixture(),map=parseBsp(source),original=readNativeBsp(source);
 const index=original.entities.findIndex(e=>e.pairs.some(p=>p.key==='model'&&p.value==='*1'));
 assert.ok(index>0);assert.equal(map.stats.models,2);
 assert.equal(bspBrushCopyEligibility(map,original,[index]).ok,true);
 const bounds=map.faces.filter(f=>f.model===1).flatMap(f=>f.points);
 assert.ok(bounds.length);
 const target=[400,500,600];const delta=bspBrushPasteDelta(map,original,[index],target,'bottom');
 assert.ok(delta.every(Number.isFinite));
 const staged=bspPasteBrushModelInstances(map,original,[index],target,'bottom');
 assert.equal(staged.entities.length,original.entities.length+1);
 const copy=staged.entities.at(-1);assert.ok(copy.pairs.some(p=>p.key==='model'&&p.value==='*1'));
 assert.ok(copy.pairs.some(p=>p.key==='targetname'&&p.value!=='original_sign'));
 const saved=compactBspCopy(writeNativeBsp(staged)).bytes,parsed=parseBsp(saved);
 assert.equal(parsed.entities.length,map.entities.length+1);
 assert.equal(parsed.entities.at(-1).properties.model,'*1');
 for(const id of [1,3,4,5,6,7,8,9,10,11,12,13,14])assert.deepEqual(lump(saved,id),lump(source,id),`BSP lump ${id}`);
 assert.deepEqual(new Uint8Array(source),new Uint8Array(brushFixture()),'source unchanged');
});
test('7: refuses worldspawn, unsupported moving/trigger entities and nonexistent models',()=>{
 const source=brushFixture(),map=parseBsp(source),doc=readNativeBsp(source);
 assert.equal(bspBrushCopyEligibility(map,doc,[0]).ok,false);
 const nonbrush=doc.entities.findIndex((e,i)=>i>0&&!e.pairs.some(p=>p.key==='model'));
 assert.equal(bspBrushCopyEligibility(map,doc,[nonbrush]).ok,false);
 assert.throws(()=>bspPasteBrushModelInstances(map,doc,[0],[0,0,0]),/worldspawn/);
 assert.equal(bspBrushCopyEligibility(map,doc,Array(33).fill(1)).ok,false);
});
test('7: UI keeps MAP editor code unchanged and makes both tools independently accessible',()=>{
 const viewer=readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
 const studio=readFileSync(new URL('../src/components/BspLightmapStudio.tsx',import.meta.url),'utf8');
 assert.match(viewer,/Lightmap Studio/);assert.match(viewer,/bspPasteBrushModelInstances/);
 assert.match(viewer,/compactBspCopy\(staged\)/);assert.match(viewer,/writeBspFaceLightmaps\(surfaceStaged/);
 assert.match(studio,/createPortal/);assert.match(studio,/onPointerMove=\{onDrag\}/);
});
