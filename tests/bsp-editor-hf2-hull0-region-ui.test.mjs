import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bspHull0SelectionPlan} from '../src/engine/bspHull0Selection.ts';
import {bspSelectSurfaceRegion} from '../src/engine/bspRegionSelection.ts';

const faces=[
  {bspFaceIndex:20,model:0,texture:1,points:[[0,0,0],[2,0,0],[2,2,0],[0,2,0]]},
  ...Array.from({length:6},(_,i)=>({bspFaceIndex:40+i,model:1,texture:i%2,points:[[i,0,0],[i+1,0,0],[i+1,1,0],[i,1,0]]})),
  ...Array.from({length:4},(_,i)=>({bspFaceIndex:60+i,model:2,texture:0,points:[[i,0,0],[i+1,0,0],[i+1,1,0],[i,1,0]]})),
];
const map={faces};

test('HF2: a worldspawn door cannot be mistaken for a separate Hull 0 submodel',()=>{
  assert.deepEqual(bspHull0SelectionPlan(map,[20]),{kind:'worldspawn',faceIds:[]});
  assert.equal(bspHull0SelectionPlan(map,[20,40]).kind,'mixed');
  assert.equal(bspHull0SelectionPlan(map,[]).kind,'empty');
});
test('HF2: a partial *N selection safely expands to the whole model but not neighboring models',()=>{
  const selection=bspHull0SelectionPlan(map,[40]);
  assert.equal(selection.kind,'expand');
  assert.equal(selection.modelIndex,1);
  assert.equal(selection.selectedCount,1);
  assert.equal(selection.totalFaces,6);
  assert.deepEqual(selection.faceIds,[40,41,42,43,44,45]);
  const ready=bspHull0SelectionPlan(map,selection.faceIds);
  assert.equal(ready.kind,'ready');
  assert.deepEqual(ready.faceIds,selection.faceIds);
  assert.deepEqual(bspHull0SelectionPlan(map,[60,61,62,63]).faceIds,[60,61,62,63]);
});
test('HF2: invalid, duplicate, undersized and over-limit selections do not authorize Hull 0',()=>{
  assert.equal(bspHull0SelectionPlan(map,[999]).kind,'missing');
  assert.equal(bspHull0SelectionPlan(map,[40,40]).kind,'missing');
  assert.equal(bspHull0SelectionPlan({faces:[{bspFaceIndex:1,model:3}]},[1]).kind,'too-few');
  const large={faces:Array.from({length:257},(_,i)=>({bspFaceIndex:i,model:7}))};
  assert.equal(bspHull0SelectionPlan(large,[0]).kind,'too-many');
});
test('HF2: Regions selects whole *N models without entering texture editing mode',()=>{
  const selected=bspSelectSurfaceRegion(map,40);
  assert.equal(selected.kind,'submodel');
  assert.deepEqual(selected.indices,[40,41,42,43,44,45]);
  const file=readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
  for(const name of ['BspTextureStudio','BspLightmapStudio']){
    assert.match(file,new RegExp("\\{entityEdit&&surfaceMode==='faces'&&<"+name));
  }
  assert.match(file,/BspTextureStudio visible=\{facePickMode==='face'&&bspStudioOpen\}/);
  assert.match(file,/BspLightmapStudio[^>]+visible=\{facePickMode==='face'&&lightmapStudioOpen\}/);
  assert.match(file,/BspTextureUVWidget visible=\{entityEdit&&surfaceMode==='faces'&&facePickMode==='face'/);
  assert.match(file,/onAltUvStart=\{entityEdit&&!fly&&surfaceMode==='faces'&&facePickMode==='face'/);
  assert.match(file,/\{facePickMode==='face'&&<div className="bsp-face-editor">/);
  assert.match(file,/disabled=\{!source\|\|objectExtractBusy\|\|!hull0Enabled\} onClick=\{recoverHull0\}/);
  assert.match(file,/extractSelectedObject\('hull0-solid',hull0Plan\.faceIds\)/);
  assert.match(file,/\{entityEdit&&surfaceMode==='faces'&&<section className="bsp-face-inspector"/);
});
