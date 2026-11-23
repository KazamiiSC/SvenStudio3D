import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
 cs16Spawns,cs16Zone,cs16Hostages,cs16Armoury,cs16ModeFromMapName,
 cs16CanApply,cs16ApplyBatch,inspectCS16Layout
} from '../src/engine/csMapStudio.ts';
import {exportMap,validateProject} from '../src/engine/exportMap.ts';
import {inspectMapImport} from '../src/engine/importMap.ts';
const project=()=>({version:1,target:'cs16',name:'HF30 Test',world:{classname:'worldspawn',mapversion:'220',message:'HF30 Test'},wadNames:[],objects:[]});

test('HF30: spawn grids have correct classes, yaw, separation and no shared coordinates',()=>{
 const ct=cs16Spawns('ct',16,[512,256,64],80,4,180),t=cs16Spawns('t',16,[-512,-256,64],80,4,0);
 assert.equal(ct.length,16);assert.equal(t.length,16);
 assert.ok(ct.every(e=>e.classname==='info_player_start'&&e.props.angles==='0 180 0'));
 assert.ok(t.every(e=>e.classname==='info_player_deathmatch'&&e.props.angles==='0 0 0'));
 const xy=new Set([...ct,...t].map(e=>e.position.join(',')));assert.equal(xy.size,32);
 for(const a of ct)for(const b of ct)if(a!==b)assert.ok(Math.hypot(a.position[0]-b.position[0],a.position[1]-b.position[1])>=64);
 assert.equal(inspectCS16Layout({...project(),objects:[...ct,...t]},'aim').length,0);
});
test('HF30: brush objectives are linked, textured with AAATRIGGER and use native team keys',()=>{
 for(const [kind,classname,team] of [['bomb_a','func_bomb_target',undefined],['bomb_b','func_bomb_target',undefined],['buy_ct','func_buyzone','2'],['buy_t','func_buyzone','1'],['rescue','func_hostage_rescue',undefined]]){
  const [brush,entity]=cs16Zone(kind,[0,0,0],[256,256,96]);
  assert.equal(entity.classname,classname);assert.equal(brush.entityId,entity.id);
  assert.equal(entity.props.team,team);assert.equal(brush.faces.length,6);
  assert.ok(brush.faces.every(f=>f.texture==='AAATRIGGER'));
  assert.deepEqual(brush.position,[0,0,48]);
 }
});
test('HF30: exported CS map preserves solid objective links, player teams and CS equipment',()=>{
 const p=project();
 const objects=[...cs16Spawns('ct',4,[600,0,64]),...cs16Spawns('t',4,[-600,0,64]),...cs16Zone('bomb_a',[100,0,0],[256,256,96]),...cs16Zone('bomb_b',[-100,0,0],[256,256,96]),...cs16Zone('buy_t',[-600,0,0],[256,256,96]),...cs16Zone('buy_ct',[600,0,0],[256,256,96]),cs16Armoury([0,0,72],'4',2)];
 p.objects=cs16ApplyBatch(p.objects,objects);
 assert.deepEqual(validateProject(p),[]);
 assert.equal(inspectCS16Layout(p,'de').length,0);
 const serialized=exportMap(p);assert.match(serialized,/AAATRIGGER/);assert.match(serialized,/"team" "2"/);
 const imported=inspectMapImport(serialized,'de_hf30.map');assert.equal(imported.report.skippedBrushes,0);
 const ents=imported.project.objects.filter(o=>o.kind==='entity');
 for(const classname of ['info_player_start','info_player_deathmatch','func_bomb_target','func_buyzone','armoury_entity'])assert.ok(ents.some(e=>e.classname===classname),classname);
 assert.equal(ents.filter(e=>e.classname==='info_player_start').length,4);
 assert.equal(ents.filter(e=>e.classname==='func_buyzone').length,2);
 assert.ok(ents.some(e=>e.classname==='armoury_entity'&&e.props.item==='4'));
});
test('HF30: hostage objective setup and advisory diagnostics',()=>{
 const p=project();
 p.objects=[...cs16Spawns('ct',1,[512,0,64]),...cs16Spawns('t',1,[-512,0,64])];
 assert.ok(inspectCS16Layout(p,'cs').some(w=>w.code==='CS_HOSTAGES'));
 assert.ok(inspectCS16Layout(p,'cs').some(w=>w.code==='CS_RESCUE'));
 p.objects=[...p.objects,...cs16Hostages(4,[0,256,64]),...cs16Zone('rescue',[512,0,0],[256,256,96])];
 assert.ok(!inspectCS16Layout(p,'cs').some(w=>w.code==='CS_HOSTAGES'||w.code==='CS_RESCUE'));
});
test('HF30: overlap checks detect bad spawn placement and engine prevents invalid groups',()=>{
 const p=project();p.objects=[...cs16Spawns('ct',2,[0,0,64]),...cs16Spawns('t',2,[0,0,64])];
 assert.ok(inspectCS16Layout(p,'fy').some(w=>w.code==='OPPOSING_SPAWNS'));
 assert.throws(()=>cs16Spawns('ct',33,[0,0,64]));assert.throws(()=>cs16Spawns('t',2,[0,0,64],16));
 assert.throws(()=>cs16Zone('bomb_a',[0,0,0],[0,256,96]));
 assert.throws(()=>cs16Armoury([0,0,64],'999',1));
 assert.throws(()=>cs16ApplyBatch([],[{id:'b',kind:'brush',entityId:'missing'}]));
 assert.deepEqual(cs16Hostages(2,[0,0,64]).map(e=>e.classname),['hostage_entity','hostage_entity']);
});
test('HF30: UI appears in CS Map/Studios menus and is isolated from Sven and BSP editing',async()=>{
 const app=await readFile('src/App.tsx','utf8');const ui=await readFile('src/components/CSMapStudio.tsx','utf8');
 assert.match(app,/isCS16&&<button role="menuitem" onClick=\{\(\)=>\{setDialog\('csMap'\)/);
 assert.match(app,/dialog==='csMap'&&<CSMapStudio/);
 assert.match(ui,/cs16CanApply\(settings\.gameProfile,bspMode,walkMode\)/);
 assert.equal(cs16CanApply('svengine',false,false),false);
 assert.equal(cs16CanApply('cs16',true,false),false);
 assert.equal(cs16CanApply('cs16',false,true),false);
 assert.equal(cs16CanApply('cs16',false,false),true);
 for(const m of ['de','cs','fy','aim'])assert.equal(cs16ModeFromMapName(`${m}_test`),m);
 assert.equal(cs16ModeFromMapName('custom_map'),'de');
 for(const language of ['es','en','ru','ko','zh','pt'])assert.match(ui,new RegExp('\\b'+language+':\\{title:'));
});

test('HF30: adding a zone is one undo step; leaving Sven project intact',async()=>{
 const {useEditor}=await import('../src/store.ts');
 const state=useEditor.getState();
 const original={project:structuredClone(state.project),history:state.history,future:state.future,selected:state.selected,selectedIds:state.selectedIds,selectedFace:state.selectedFace};
 try{
  useEditor.setState({project:project(),history:[],future:[],selected:null,selectedIds:[],selectedFace:null});
  useEditor.getState().addObjects(cs16Zone('buy_ct',[128,0,0],[256,256,96]));
  assert.equal(useEditor.getState().project.objects.length,2);
  assert.equal(useEditor.getState().history.length,1);
  useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.length,0);
  useEditor.getState().redo();assert.equal(useEditor.getState().project.objects.length,2);
 }finally{useEditor.setState(original)}
});
