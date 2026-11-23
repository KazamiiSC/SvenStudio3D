import {withSplitParts} from './support/splitParts.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cs16Spawns,cs16Armoury,cs16Hostages,cs16Zone,cs16FacingXY,cs16NormalizeYaw} from '../src/engine/csMapStudio.ts';
import {cs16CreateAt,cs16PreviewOffsets} from '../src/engine/csMapPlacement.ts';
import {cs16Inventory,cs16SelectionIds,cs16MarkerTint,cs16ObjectGroup,inspectCS16Advanced} from '../src/engine/csMapIntegration.ts';
import {useCSMapPlacement} from '../src/csMapPlacementState.ts';
import {useEditor} from '../src/store.ts';
import {exportMap} from '../src/engine/exportMap.ts';
import {inspectMapImport} from '../src/engine/importMap.ts';
const req=(tool,extra={})=>({action:'paint',tool,repeat:false,team:'ct',quantity:3,columns:2,spacing:80,yaw:270,zoneKind:'bomb_a',size:[128,192,96],armoury:'4',weaponCount:2,hostageCount:2,...extra});
const project=()=>({version:1,target:'cs16',name:'CS 1.6 HF32',world:{classname:'worldspawn',mapversion:'220',message:'HF32'},wadNames:[],objects:[]});

test('HF32: GoldSrc yaw preset mapping and wrapping',()=>{
 assert.equal(cs16NormalizeYaw(450),90);assert.equal(cs16NormalizeYaw(-90),270);
 for(const [yaw,want] of [[0,[1,0]],[90,[0,1]],[180,[-1,0]],[270,[0,-1]]]){
  const got=cs16FacingXY(yaw);assert.ok(got.every((v,i)=>Math.abs(v-want[i])<1e-10));
 }
 assert.throws(()=>cs16NormalizeYaw(Number.NaN));
});

test('HF32: spawn/hostage/armoury facing persists in exported Valve 220 MAP',()=>{
 const objects=[...cs16Spawns('ct',2,[384,0,64],80,2,45),...cs16Spawns('t',2,[-384,0,64],80,2,270),
   ...cs16Hostages(2,[0,400,64],72,135),cs16Armoury([0,0,64],'4',2,90),...cs16Zone('bomb_a',[0,0,0],[128,128,96])];
 assert.equal(objects.find(e=>e.kind==='entity'&&e.classname==='info_player_start').props.angles,'0 45 0');
 assert.ok(objects.filter(e=>e.kind==='entity'&&e.classname==='hostage_entity').every(e=>e.props.angles==='0 135 0'));
 assert.equal(objects.find(e=>e.kind==='entity'&&e.classname==='armoury_entity').props.angles,'0 90 0');
 const map=exportMap({...project(),objects});
 const loaded=inspectMapImport(map,'de_hf32.map');assert.equal(loaded.report.skippedBrushes,0);
 for(const [classname,yaw] of [['info_player_start',45],['info_player_deathmatch',270],['hostage_entity',135],['armoury_entity',90]]){
  const loadedEnt=loaded.project.objects.find(e=>e.kind==='entity'&&e.classname===classname);
  assert.ok(loadedEnt,classname);assert.equal(loadedEnt.props.angles,`0 ${yaw} 0`);
 }
});

test('HF32: paint uses yaw for all point objects and preview positions remain aligned',()=>{
 for(const tool of ['spawns','armoury','hostages']){
  const r=req(tool);const origin=[100,200,64];const added=cs16CreateAt(r,origin);
  const positions=cs16PreviewOffsets(r);
  assert.equal(added.length,positions.length);
  for(let i=0;i<added.length;i++){
   assert.deepEqual(added[i].position,positions[i].map((v,j)=>v+origin[j]));
   assert.equal(added[i].props.angles,'0 270 0');
  }
 }
});

test('HF32: R rotation in placement updates preview without changing map and respects profile',()=>{
 const before={editor:useEditor.getState(),placement:useCSMapPlacement.getState()};
 try{
  useEditor.setState({project:project(),history:[],future:[],settings:{...before.editor.settings,gameProfile:'cs16'},walkMode:false});
  const placement=useCSMapPlacement.getState();placement.arm(req('spawns',{yaw:350}));
  placement.rotate(45);assert.equal(useCSMapPlacement.getState().request.yaw,35);
  placement.rotate(15);assert.equal(useCSMapPlacement.getState().request.yaw,50);
  assert.equal(useEditor.getState().project.objects.length,0);assert.equal(useEditor.getState().history.length,0);
  placement.commit([128,0,64]);assert.equal(useEditor.getState().history.length,1);
  assert.ok(useEditor.getState().project.objects.every(e=>e.props.angles==='0 50 0'));
  useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.length,0);
  placement.arm(req('zone'));placement.rotate(90);assert.equal(useCSMapPlacement.getState().request.yaw,270);
 }finally{useCSMapPlacement.getState().cancel();useEditor.setState(before.editor);useCSMapPlacement.setState({picked:before.placement.picked,feedback:before.placement.feedback})}
});

test('HF32: inventory groups correctly select native entity and linked brush together',()=>{
 const objects=[...cs16Spawns('ct',2,[300,0,64]),...cs16Spawns('t',1,[-300,0,64]),...cs16Zone('bomb_a',[0,0,0],[128,128,96]),...cs16Zone('buy_t',[0,300,0],[128,128,96]),...cs16Hostages(1,[0,-320,64]),cs16Armoury([0,-120,64],'4',2)];
 const inv=cs16Inventory(objects);assert.equal(inv.length,7);
 const bomb=inv.find(o=>o.group==='bomb');assert.ok(bomb);assert.equal(bomb.brushIds.length,1);
 const ids=cs16SelectionIds(inv,'single',bomb.id);assert.deepEqual(new Set(ids),new Set([bomb.id,bomb.brushIds[0]]));
 assert.equal(cs16SelectionIds(inv,'ct').length,2);assert.equal(cs16SelectionIds(inv,'t').length,1);
 assert.equal(cs16ObjectGroup(objects.find(o=>o.kind==='entity'&&o.classname==='armoury_entity')),'weapon');
 assert.equal(cs16MarkerTint(objects.find(o=>o.kind==='entity'&&o.classname==='func_buyzone')),'#ff796b');
 assert.ok(!inspectCS16Advanced(objects).some(w=>w.code==='ZONE_NO_BRUSH'));
});

test('HF32: native multi-selection and focus do not modify project history',()=>{
 const editor=useEditor.getState();
 const original={project:editor.project,history:editor.history,selected:editor.selected,selectedIds:editor.selectedIds,cameraCommand:editor.cameraCommand,settings:editor.settings};
 try{
  const objects=[...cs16Spawns('ct',2,[256,0,64]),...cs16Zone('buy_ct',[0,0,0],[128,128,96])];
  useEditor.setState({project:{...project(),objects},history:[],settings:{...original.settings,gameProfile:'cs16'}});
  const inv=cs16Inventory(objects);const selectedIds=cs16SelectionIds(inv,'buy');
  useEditor.getState().selectObjectIds(selectedIds,true);
  assert.equal(useEditor.getState().selectedIds.length,2);assert.equal(useEditor.getState().history.length,0);
  assert.equal(useEditor.getState().cameraCommand?.action,'frame');
 }finally{useEditor.setState(original)}
});

test('HF32: interface exposes six translated facing controls, 3D arrows, management without a second transform engine',async()=>{
 const ui=await readFile('src/components/CSMapStudio.tsx','utf8');
 const view=withSplitParts(await readFile('src/components/Viewport.tsx','utf8'),'Viewport');
 const css=await readFile('src/components/csMapStudio.css','utf8');
 assert.match(ui,/HF32_FACING/);assert.match(ui,/cs32-facing-compass/);assert.match(ui,/section==='manage'/);
 for(const l of ['es','en','ru','ko','zh','pt'])assert.match(ui,new RegExp(`\\b${l}:\\{title:`));
 assert.match(view,/function CSMapMarkers/);assert.match(view,/<CSMapMarkers\/>/);assert.match(view,/request\.yaw/);
 assert.match(view,/\.rotate\(e\.shiftKey\?15:45\)/);assert.match(css,/repeat\(5,minmax/);
});
