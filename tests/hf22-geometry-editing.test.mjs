import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {selectedGeometryIndices,selectedGeometryEdges,edgeSelectionVertices,geometrySelectionCentroid,sanitizeGeometryDelta} from '../src/engine/geometryEditSelection.ts';
import {createBrush} from '../src/engine/geometry.ts';
import {validateBrush,exportMap} from '../src/engine/exportMap.ts';
import {inspectMapImport} from '../src/engine/importMap.ts';
import {useEditor} from '../src/store.ts';

const source=name=>readFileSync(new URL(`../src/${name}`,import.meta.url),'utf8');
const checkRoundtrip=brushes=>{
 for(const b of brushes)assert.deepEqual(validateBrush(b),[],`Brush ${b.name}`);
 const state=useEditor.getState();
 const map=exportMap({...state.project,objects:[...brushes]});
 const read=inspectMapImport(map,'hf22-geometry-test.map');
 assert.equal(read.report.skippedBrushes,0);
 assert.equal(read.project.objects.filter(o=>o.kind==='brush').length,brushes.length);
};
const withSingleBrush=(brush,fn)=>{
 const state=useEditor.getState();
 const original={project:structuredClone(state.project),selected:state.selected,selectedIds:state.selectedIds,geometryMode:state.geometryMode,faceMode:state.faceMode,history:state.history,future:state.future,editIndices:state.editIndices,editEdgePairs:state.editEdgePairs,selectedFace:state.selectedFace,textureFaceSelection:state.textureFaceSelection};
 try{
  useEditor.setState(s=>({...s,project:{...s.project,objects:[brush]},selected:brush.id,selectedIds:[brush.id],history:[],future:[],geometryMode:'vertex',faceMode:false,selectedFace:null,editIndices:[],textureFaceSelection:[]}));
  fn(useEditor.getState());
 }finally{useEditor.setState(original)}
};

test('HF22 selection toggles vertices in additive and replacement modes',()=>{
 assert.deepEqual(selectedGeometryIndices([],[0],false),[0]);
 assert.deepEqual(selectedGeometryIndices([0],[3],true),[0,3]);
 assert.deepEqual(selectedGeometryIndices([0,3],[0],true),[3]);
 assert.deepEqual(selectedGeometryIndices([0,3],[0],false),[0]);
 assert.deepEqual(selectedGeometryIndices([0,3],[0,3],true),[]);
 assert.deepEqual(selectedGeometryIndices([0,2],[2,4],true),[0,2,4]);
 assert.deepEqual(selectedGeometryIndices([3],[3,3,-1,1.5],false),[3]);
});
test('HF22 edge selection preserves shared vertices and toggles only the chosen edge',()=>{
 let edges=selectedGeometryEdges([],[0,1],false);
 edges=selectedGeometryEdges(edges,[1,2],true);
 assert.deepEqual(edgeSelectionVertices(edges),[0,1,2]);
 edges=selectedGeometryEdges(edges,[0,1],true);
 assert.deepEqual(edges,[[1,2]]);
 assert.deepEqual(edgeSelectionVertices(edges),[1,2]);
 withSingleBrush(createBrush('box',[0,0,64],[128,128,128]),editor=>{
  editor.setGeometryMode('edge');
  editor.selectEditIndices([0,1]);editor.selectEditIndices([1,2],true);
  assert.deepEqual(useEditor.getState().editIndices,[0,1,2]);
  assert.deepEqual(useEditor.getState().editEdgePairs,[[0,1],[1,2]]);
  editor.selectEditIndices([0,1],true);
  assert.deepEqual(useEditor.getState().editIndices,[1,2]);
  assert.deepEqual(useEditor.getState().editEdgePairs,[[1,2]]);
  editor.setGeometryMode('object');
  assert.deepEqual(useEditor.getState().editEdgePairs,[]);
 });
});
test('HF22 centers the gizmo on all selected vertices and rejects bad inputs',()=>{
 assert.deepEqual(geometrySelectionCentroid([[0,0,0],[10,0,0],[10,10,10]],[0,2,2]),[5,5,5]);
 assert.equal(geometrySelectionCentroid([[0,0,0]],[]),null);
 assert.deepEqual(sanitizeGeometryDelta([7.8,-7.8,0],4),[8,-8,0]);
 assert.throws(()=>sanitizeGeometryDelta([NaN,0,0]));
 assert.throws(()=>sanitizeGeometryDelta([0,Infinity,0]));
 assert.throws(()=>sanitizeGeometryDelta([131073,0,0]));
 assert.throws(()=>sanitizeGeometryDelta([1,1,1],-1));
});
test('HF22 store selection supports Shift/Ctrl multi-vertex movement and single-step undo/redo',()=>{
 withSingleBrush(createBrush('box',[0,0,64],[128,128,128],'HF22 box'),editor=>{
  editor.selectEditIndices([6]);editor.selectEditIndices([7],true);
  assert.deepEqual(useEditor.getState().editIndices,[6,7]);
  editor.editVertices(useEditor.getState().selected,[6,7],[0,0,18]);
  let s=useEditor.getState();assert.equal(s.history.length,1);
  assert.deepEqual(validateBrush(s.project.objects[0]),[]);
  checkRoundtrip([s.project.objects[0]]);
  const after=JSON.stringify(s.project.objects[0].vertices);
  s.undo();s=useEditor.getState();assert.equal(s.project.objects[0].vertices[6][2],64);
  s.redo();assert.equal(JSON.stringify(useEditor.getState().project.objects[0].vertices),after);
 });
});
test('HF22 face offset modifies one existing convex brush without creating new solids',()=>{
 withSingleBrush(createBrush('box',[0,0,64],[128,128,128],'HF22 face'),editor=>{
  editor.setGeometryMode('face');
  const before=useEditor.getState().project.objects[0];
  const index=1;const ids=before.faces[index].indices;
  useEditor.setState({selectedFace:index,textureFaceSelection:[{id:before.id,face:index}]});
  editor.editVertices(before.id,ids,[0,0,16]);
  const s=useEditor.getState();
  assert.equal(s.project.objects.length,1);
  assert.equal(s.selectedFace,null,'convex rebuild invalidates selected face index');
  assert.deepEqual(validateBrush(s.project.objects[0]),[]);
  assert.notDeepEqual(s.project.objects[0].vertices,before.vertices);
  checkRoundtrip([s.project.objects[0]]);
  s.undo();assert.deepEqual(useEditor.getState().project.objects[0].vertices,before.vertices);
 });
});
test('HF22 rotated and non-uniformly scaled brushes remain exportable',()=>{
 const brush=createBrush('box',[123,-77,256],[128,96,64],'Rotated HF22');
 brush.rotation=[0,0,35];brush.scale=[1.25,.8,1.2];
 withSingleBrush(brush,editor=>{
  editor.selectEditIndices([4,5]);
  editor.editVertices(brush.id,[4,5],[0,0,8]);
  const changed=useEditor.getState().project.objects[0];
  assert.deepEqual(validateBrush(changed),[]);
  checkRoundtrip([changed]);
  assert.deepEqual(brush.vertices[4],[-64,-48,32], 'source remains unchanged');
 });
});
test('HF22 invalid geometry is rejected atomically, without adding history',()=>{
 withSingleBrush(createBrush('box',[0,0,64],[128,128,128],'HF22 reject'),editor=>{
  const original=JSON.stringify(useEditor.getState().project);
  assert.throws(()=>editor.editVertices(editor.selected,[6],[-64,-64,-64]));
  assert.equal(JSON.stringify(useEditor.getState().project),original);
  assert.equal(useEditor.getState().history.length,0);
 });
});
test('HF22 retains Workshop/CSG and Texture Studio while integrating UI into existing panels',()=>{
 const view=source('components/Viewport.tsx');const inspector=source('components/Panels.tsx');const rail=source('components/QuickToolRail.tsx');
 assert.match(view,/function GeometryEditHandles/);assert.match(view,/geometrySelectionCentroid/);
 assert.match(view,/kind==='face'&&origin/);assert.match(view,/selectedGizmoPointerHit=hit/);assert.match(view,/selectIndices\(h\.indices,e\.shiftKey\|\|e\.ctrlKey\|\|e\.metaKey\)/);
 assert.match(view,/if\(!alreadyEditingFace\)ed\(\)\.setTextureStudioOpen\(true\)/);
 assert.match(inspector,/hf22-geometry-workspace/);assert.match(inspector,/Apply movement/);
 assert.match(rail,/Brush Workshop/);assert.match(rail,/World Builder · Curves/);
 assert.match(rail,/booleanSelected/);assert.match(rail,/Open Properties panel/);
 assert.doesNotMatch(source('App.tsx'),/HF22StandaloneStudio|HF22VertexStudio/);
});
