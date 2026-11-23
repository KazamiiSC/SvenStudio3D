import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {cs16AnchorAtSurface,cs16CreateAt,cs16PreviewOffsets} from '../src/engine/csMapPlacement.ts';
import {useCSMapPlacement} from '../src/csMapPlacementState.ts';
import {useEditor} from '../src/store.ts';
import {exportMap} from '../src/engine/exportMap.ts';
import {inspectMapImport} from '../src/engine/importMap.ts';

const req=(tool,action='paint',extra={})=>({
 action,tool,repeat:false,team:'ct',quantity:4,columns:2,spacing:80,yaw:180,
 zoneKind:'bomb_a',size:[256,192,96],armoury:'4',weaponCount:2,hostageCount:3,...extra
});
const project=()=>({version:1,target:'cs16',name:'HF31',world:{classname:'worldspawn',mapversion:'220',message:'HF31'},wadNames:[],objects:[]});

test('HF31: click anchoring uses GoldSrc Z and rejects walls and ceilings',()=>{
 assert.deepEqual(cs16AnchorAtSurface([131,-30,128],[0,0,1],'spawns',16),[128,-32,164]);
 assert.deepEqual(cs16AnchorAtSurface([131,-30,128],[0,0,1],'zone',16),[128,-32,128]);
 assert.deepEqual(cs16AnchorAtSurface([131,-30,128],[0,0,1],'hostages',16),[128,-32,164]);
 assert.deepEqual(cs16AnchorAtSurface([131,-30,128],[0,0,1],'armoury',16),[128,-32,148]);
 assert.equal(cs16AnchorAtSurface([0,0,0],[1,0,0],'zone',16),null);
 assert.equal(cs16AnchorAtSurface([0,0,0],[0,0,-1],'spawns',16),null);
 assert.equal(cs16AnchorAtSurface([NaN,0,0],[0,0,1],'zone',16),null);
});

test('HF31: ghost preview grid matches exact spawn generation offsets',()=>{
 const r=req('spawns','paint',{quantity:7,columns:3,spacing:80});
 const origin=[128,256,64];
 const spawned=cs16CreateAt(r,origin),offsets=cs16PreviewOffsets(r);
 assert.equal(spawned.length,offsets.length);
 for(let i=0;i<spawned.length;i++)assert.deepEqual(spawned[i].position,offsets[i].map((v,j)=>v+origin[j]));
 assert.equal(cs16PreviewOffsets(req('zone')).length,1);
});

test('HF31: picking coordinates never modifies the map or history',()=>{
 const original={project:structuredClone(useEditor.getState().project),history:useEditor.getState().history,future:useEditor.getState().future,
  settings:useEditor.getState().settings,walkMode:useEditor.getState().walkMode};
 const before=useCSMapPlacement.getState();
 try{
  useEditor.setState({project:project(),history:[],future:[],walkMode:false,settings:{...original.settings,gameProfile:'cs16'}});
  const s=useCSMapPlacement.getState();s.arm(req('zone','pick'));s.hoverAt([128,64,20]);
  assert.equal(useEditor.getState().project.objects.length,0);
  assert.equal(useEditor.getState().history.length,0);
  s.commit([128,64,20]);
  assert.deepEqual(useCSMapPlacement.getState().picked.at,[128,64,20]);
  assert.equal(useCSMapPlacement.getState().request,null);
  assert.equal(useEditor.getState().history.length,0);
 }finally{
  useCSMapPlacement.getState().cancel();useCSMapPlacement.setState({picked:before.picked,feedback:null});useEditor.setState(original);
 }
});

test('HF31: direct surface click creates one undoable zone and exports Valve 220',()=>{
 const state=useEditor.getState();
 const original={project:structuredClone(state.project),history:state.history,future:state.future,settings:state.settings,walkMode:state.walkMode};
 try{
  useEditor.setState({project:project(),history:[],future:[],walkMode:false,settings:{...original.settings,gameProfile:'cs16'}});
  const picker=useCSMapPlacement.getState();picker.arm(req('zone'));
  assert.equal(useEditor.getState().history.length,0);
  picker.commit([256,128,64]);
  assert.equal(useEditor.getState().project.objects.length,2);
  assert.equal(useEditor.getState().history.length,1);
  assert.equal(useCSMapPlacement.getState().request,null);
  const text=exportMap(useEditor.getState().project);
  const imported=inspectMapImport(text,'de_hf31.map');
  assert.equal(imported.report.skippedBrushes,0);
  assert.ok(imported.project.objects.some(o=>o.kind==='entity'&&o.classname==='func_bomb_target'));
  useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.length,0);
  useEditor.getState().redo();assert.equal(useEditor.getState().project.objects.length,2);
 }finally{useCSMapPlacement.getState().cancel();useEditor.setState(original)}
});

test('HF31: repeat placement and profile isolation',()=>{
 const state=useEditor.getState();
 const original={project:structuredClone(state.project),history:state.history,future:state.future,settings:state.settings,walkMode:state.walkMode};
 try{
  useEditor.setState({project:project(),history:[],future:[],walkMode:false,settings:{...original.settings,gameProfile:'cs16'}});
  const picker=useCSMapPlacement.getState();picker.arm(req('spawns','paint',{repeat:true}));
  picker.commit([500,0,64]);picker.commit([-500,0,64]);
  assert.equal(useEditor.getState().project.objects.length,8);
  assert.equal(useEditor.getState().history.length,2);
  assert.ok(useCSMapPlacement.getState().request);
  picker.cancel();assert.equal(useCSMapPlacement.getState().request,null);
  useEditor.setState({settings:{...original.settings,gameProfile:'svengine'}});
  picker.arm(req('zone'));picker.commit([0,0,0]);
  assert.equal(useEditor.getState().project.objects.length,8);
  assert.equal(useCSMapPlacement.getState().request,null);
 }finally{useCSMapPlacement.getState().cancel();useEditor.setState(original)}
});

test('HF31: floating panel leaves viewport clickable and six languages retain UI labels',async()=>{
 const ui=await readFile('src/components/CSMapStudio.tsx','utf8');
 const css=await readFile('src/components/csMapStudio.css','utf8');
 const viewport=await readFile('src/components/Viewport.tsx','utf8');
 assert.match(ui,/aria-modal="false"/);
 assert.match(css,/pointer-events:none/);
 assert.match(css,/pointer-events:auto/);
 assert.match(ui,/startPlacement\('pick'\)/);
 assert.match(ui,/startPlacement\('paint'\)/);
 assert.match(ui,/cs31-team-pick/);
 assert.match(viewport,/<CSMapClickPlacement\/>/);
 assert.match(viewport,/addEventListener\('pointerdown',down,true\)/);
 for(const language of ['es','en','ru','ko','zh','pt'])assert.match(ui,new RegExp('\\b'+language+':\\{position:'));
});
