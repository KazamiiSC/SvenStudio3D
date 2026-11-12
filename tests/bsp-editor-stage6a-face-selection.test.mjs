import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBsp} from '../src/engine/bsp.ts';
import {bspOriginalFaceIndex,bspTriangleFacePick,bspToggleFaceSelection,bspFaceDiagnostic} from '../src/engine/bspFaceSelection.ts';

const fixture=readFileSync(new URL('./fixtures/maptest1_lighting_v159.bsp',import.meta.url));
const view=bytes=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);

test('stage 6A: nonindexed triangle index resolves original BSP face, not batch number',()=>{
  assert.equal(bspTriangleFacePick([8,8,92,92,92,147],0),8);
  assert.equal(bspTriangleFacePick([8,8,92,92,92,147],4),92);
  assert.equal(bspTriangleFacePick([8,8,92,92,92,147],5),147);
  for(const index of [-1,1.25,Number.NaN,undefined,null,6])assert.equal(bspTriangleFacePick([8,92],index),null);
  assert.equal(bspTriangleFacePick([-1],0),null);
});

test('stage 6A: multiselect and single selection do not accidentally change other faces',()=>{
  assert.deepEqual(bspToggleFaceSelection([],12,false),[12]);
  assert.deepEqual(bspToggleFaceSelection([12],9,true),[12,9]);
  assert.deepEqual(bspToggleFaceSelection([12,9],12,true),[9]);
  assert.deepEqual(bspToggleFaceSelection([12,9],35,false),[35]);
  assert.deepEqual(bspToggleFaceSelection([9],-1,true),[9]);
  assert.deepEqual(bspToggleFaceSelection([1,2,3],4,true,3),[2,3,4]);
});

test('stage 6A: faces carry actual indices for face, texinfo, plane, light offset from BSP lumps',()=>{
  const buffer=view(fixture),map=parseBsp(buffer,'lightmap_fixture.bsp');
  const raw=new DataView(buffer),faceOffset=raw.getInt32(4+7*8,true),faceSize=raw.getInt32(8+7*8,true);
  assert.ok(map.faces.length>0);
  assert.ok(map.faces.length<=faceSize/20);
  for(const [position,face] of map.faces.entries()){
    const index=bspOriginalFaceIndex(face,position),start=faceOffset+index*20;
    assert.ok(Number.isInteger(index)&&index>=0&&index<faceSize/20);
    assert.equal(face.bspFaceIndex,index);
    assert.equal(face.texinfoIndex,raw.getUint16(start+10,true));
    assert.equal(face.planeIndex,raw.getUint16(start,true));
    assert.equal(face.planeSide,raw.getUint16(start+2,true));
    assert.equal(face.lightmapOffset,raw.getInt32(start+16,true));
    const info=bspFaceDiagnostic(map,index);
    assert.equal(info?.textureIndex,face.texture);
    assert.equal(info?.model,face.model);
    assert.equal(info?.vertices,face.points.length);
    assert.equal(info?.index,index);
    assert.equal(info?.texinfoIndex,face.texinfoIndex);
    assert.equal(info?.sharedTexinfoFaces,map.faces.filter(f=>f.texinfoIndex===face.texinfoIndex).length);
  }
});

test('stage 6A: source face indices survive malformed face omission and never silently renumber',()=>{
  const bytes=new Uint8Array(view(fixture));
  const raw=new DataView(bytes.buffer),faceStart=raw.getInt32(4+7*8,true);
  const faceCount=raw.getInt32(8+7*8,true)/20;
  assert.ok(faceCount>1);
  // Make the first raw BSP face have an invalid number of edges.
  raw.setUint16(faceStart+8,2,true);
  const map=parseBsp(bytes.buffer,'malformed_face_fixture.bsp');
  assert.ok(map.warnings.some(w=>w.includes('malformed faces')));
  assert.ok(map.faces.every((f,i)=>bspOriginalFaceIndex(f,i)>0));
  const first=map.faces[0];
  assert.ok(first);
  assert.ok(first.bspFaceIndex>0);
  assert.equal(bspFaceDiagnostic(map,0),null);
  assert.equal(bspFaceDiagnostic(map,first.bspFaceIndex)?.index,first.bspFaceIndex);
});

test('stage 6A: diagnostic only — no source file changes or fake serialized UV edits',()=>{
  const buffer=view(fixture),before=Buffer.from(buffer).toString('hex');
  const map=parseBsp(buffer,'fixture.bsp');
  const selected=map.faces[0];
  const diagnostic=bspFaceDiagnostic(map,selected.bspFaceIndex);
  assert.ok(diagnostic);
  assert.ok(Number.isFinite(diagnostic.uvBounds[0]));
  assert.equal(Buffer.from(buffer).toString('hex'),before);
});

test('stage 6A: selection integrated in original BSP geometry render and is explicitly read only',()=>{
  const source=readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
  const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
  assert.match(source,/part\.triangleFaceIds\.push\(bspOriginalFaceIndex\(face,index\)\)/);
  assert.match(source,/bspTriangleFacePick\(c\.triangleFaceIds,e\.faceIndex\)/);
  assert.match(source,/onFaceClick=\{entityEdit&&!fly&&surfaceMode==='faces'/);
  assert.match(source,/surfaceMode==='entities'&&showEntities/);
  assert.match(source,/surfaceMode==='entities'&&entityEdit&&!placement&&!fly&&showEntities&&groupMoveAllowed/);
  assert.match(source,/bspApplySurfaceOperation/); // Stage 6B retains the original face inspector with safe edits.
  assert.match(css,/\.bsp-face-inspector/);
});
