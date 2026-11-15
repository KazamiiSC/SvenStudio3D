import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {useEditor} from '../src/store.ts';
import {createBrush} from '../src/engine/geometry.ts';
import {canShiftSelectMapObjects,firstSelectableMapHit} from '../src/engine/mapShiftSelection.ts';
const source=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('HF20 HF1 Shift additive selection toggles 2+ MAP brushes without changing project geometry',()=>{
 const state=useEditor.getState(),original=structuredClone(state.project);
 const a=createBrush('box',[0,0,64],[64,64,64]);
 const b=createBrush('box',[220,0,64],[64,64,64]);
 const c=createBrush('box',[440,0,64],[64,64,64]);
 const prev={selected:state.selected,selectedIds:state.selectedIds,selectedFace:state.selectedFace,geometryMode:state.geometryMode,faceMode:state.faceMode};
 try{
  useEditor.setState(s=>({project:{...s.project,objects:[a,b,c]},selected:null,selectedIds:[],geometryMode:'object',faceMode:false}));
  const store=useEditor.getState();
  store.selectObject(a.id,false);
  store.selectObject(b.id,true);
  assert.deepEqual(useEditor.getState().selectedIds,[a.id,b.id]);
  store.selectObject(c.id,true);
  assert.deepEqual(useEditor.getState().selectedIds,[a.id,b.id,c.id]);
  store.selectObject(b.id,true);
  assert.deepEqual(useEditor.getState().selectedIds,[a.id,c.id]);
  store.selectObject(a.id,false);
  assert.deepEqual(useEditor.getState().selectedIds,[a.id,c.id],'clicking selected member preserves multi-selection for the gizmo');
  store.selectObject(b.id,false);
  assert.deepEqual(useEditor.getState().selectedIds,[b.id]);
  assert.deepEqual(useEditor.getState().project.objects,[a,b,c]);
 }finally{useEditor.setState({...prev,project:original});}
});

test('HF20 HF1 picker selects nearest valid object; supports marker ancestors, ignores locked/hidden',()=>{
 const hits=[{object:{userData:{},visible:true,parent:{userData:{brushId:'lock'},visible:true}}},
  {object:{userData:{entityPickerId:'hidden'},visible:true}},
  {object:{userData:{brushId:'near'},visible:true}},
  {object:{userData:{brushId:'far'},visible:true}}];
 assert.equal(firstSelectableMapHit(hits,[{id:'lock',locked:true},{id:'hidden',hidden:true},{id:'near'},{id:'far'}]),'near');
 assert.equal(firstSelectableMapHit([{object:{userData:{brushId:'a'},visible:false}}],[{id:'a'}]),null);
 assert.equal(firstSelectableMapHit([],[{id:'a'}]),null);
});

test('HF20 HF1 Shift additive capture runs only in MAP object mode without active placement/UV',()=>{
 const state={geometryMode:'object',faceMode:false,walkMode:false,drawMode:false,measureMode:false,modalTransform:null,placementShape:null,placementPrefabId:null,activeDecal:null,texturePickerActive:false,audioPlacement:null,environmentPlacement:null,architecturePlacement:null,pendingNpcClass:null};
 assert.equal(canShiftSelectMapObjects(state,0,true),true);
 assert.equal(canShiftSelectMapObjects(state,0,false),false);
 assert.equal(canShiftSelectMapObjects(state,2,true),false);
 for(const change of [{geometryMode:'face'},{faceMode:true},{drawMode:true},{measureMode:true},{walkMode:true},{modalTransform:{}},{placementPrefabId:'x'},{activeDecal:'x'},{texturePickerActive:true},{architecturePlacement:{}}])
  assert.equal(canShiftSelectMapObjects({...state,...change},0,true),false,JSON.stringify(change));
});

test('HF20 HF1 viewport installs early Shift bridge and leaves Shift-click blank ground selected',()=>{
 const viewport=source('src/components/Viewport.tsx');
 assert.match(viewport,/function ShiftObjectSelectionBridge\(/);
 assert.match(viewport,/canvas\.addEventListener\('pointerdown',down,true\)/);
 assert.match(viewport,/state\.selectObject\(id,true\)/);
 assert.match(viewport,/if\(e\.shiftKey\|\|e\.ctrlKey\|\|e\.metaKey\)return;\s*setSelected\(null\)/);
 assert.match(viewport,/<ShiftObjectSelectionBridge\/>/);
});

test('HF20 HF1 Smart Connect allows viewport picking while its modal is hidden',()=>{
 const panel=source('src/components/SmartConnectPanel.tsx');
 assert.match(panel,/if\(picking\)return <div className="sc-picking-dock"/);
 assert.match(panel,/editor\.setGeometryMode\('object'\)/);
 assert.match(panel,/pickedBrushes\.length!==2/);
 assert.match(panel,/setFromId\(a\.id\);setToId\(b\.id\)/);
 assert.match(panel,/\{!activeRecord&&<div className="sc-pick-strip"/);
});
