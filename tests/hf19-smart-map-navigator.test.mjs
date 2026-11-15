import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildNavigatorIndex,findNavigatorEntries,MAX_NAVIGATOR_RESULTS} from '../src/engine/mapNavigator.ts';
import {useEditor} from '../src/store.ts';
import {translate} from '../src/i18n.ts';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const entities=[
 {id:'door01',kind:'entity',name:'Door',classname:'func_door',props:{targetname:'lab_door',target:'switch_a'},position:[80,0,0],layer:'Lab'},
 {id:'npc01',kind:'entity',name:'Scientist',classname:'monster_scientist',props:{targetname:'scientist_1',model:'models/scientist.mdl'},position:[4,0,0]},
 {id:'hidden',kind:'entity',name:'Hidden',classname:'info_target',props:{},position:[0,0,0],hidden:true}
];
const brushes=[{id:'wall01',kind:'brush',name:'Main wall',primitive:'box',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices:[[0,0,0]],faces:[{indices:[0],texture:'METALWALL'}],layer:'Lab',group:'Interior'}];
const objects=[...entities,...brushes];

test('HF19 read-only index supports class, target, texture, layer and multi-term search',()=>{
 const before=JSON.stringify(objects),index=buildNavigatorIndex(objects);
 assert.deepEqual(findNavigatorEntries(index,'class:func_door').items.map(o=>o.id),['door01']);
 assert.deepEqual(findNavigatorEntries(index,'target:lab_door').items.map(o=>o.id),['door01']);
 assert.deepEqual(findNavigatorEntries(index,'texture:metalwall', 'brush').items.map(o=>o.id),['wall01']);
 assert.deepEqual(findNavigatorEntries(index,'layer:lab door').items.map(o=>o.id),['door01']);
 assert.deepEqual(findNavigatorEntries(index,'modelS/scientist.mdl').items.map(o=>o.id),['npc01']);
 assert.deepEqual(findNavigatorEntries(index,'class:monster_scientist','brush').items,[]);
 assert.equal(JSON.stringify(objects),before);
});
test('HF19 results are capped for large maps without losing total count',()=>{
 const big=Array.from({length:2000},(_,i)=>({...brushes[0],id:'b'+i,name:'wall_'+i}));
 const index=buildNavigatorIndex(big);
 const results=findNavigatorEntries(index,'wall','all');
 assert.equal(results.count,2000);
 assert.equal(results.items.length,MAX_NAVIGATOR_RESULTS);
 assert.equal(results.items[0].id,'b0');
 assert.equal(results.items.at(-1).id,'b79');
});
test('HF19 focus selects exact object, requests camera frame and never modifies project or history',()=>{
 const state=useEditor.getState();
 const project=state.project,original=JSON.stringify(project),history=state.history;
 const id=project.objects.find(o=>!o.hidden)?.id;
 assert.ok(id);
 const previousSerial=state.cameraCommand?.serial||0;
 assert.equal(state.focusNavigatorObject(id),true);
 const next=useEditor.getState();
 assert.equal(next.selected,id);assert.deepEqual(next.selectedIds,[id]);
 assert.equal(next.navigatorFocusedId,id);
 assert.equal(next.cameraCommand.action,'frame');
 assert.equal(next.cameraCommand.serial,previousSerial+1);
 assert.equal(JSON.stringify(next.project),original);assert.strictEqual(next.history,history);
 next.setSelected(null);
 assert.equal(useEditor.getState().navigatorFocusedId,null);
});
test('HF19 missing or hidden objects are never focused and must not clear selection',()=>{
 const s=useEditor.getState();
 const previous=s.selected;
 assert.equal(s.focusNavigatorObject('missing-id'),false);
 assert.equal(useEditor.getState().selected,previous);
 const copy=structuredClone(s.project);
 copy.objects.push({...entities[2]});
 s.loadProject(copy);
 assert.equal(useEditor.getState().focusNavigatorObject('hidden'),false);
 assert.equal(useEditor.getState().navigatorFocusedId,null);
 s.loadProject(s.project);
});
test('HF19 navigator panel integrates with Explorer and the focus outline cannot intercept clicks',()=>{
 const explorer=file('src/components/ExplorerOrganized.tsx');
 const component=file('src/components/SmartMapNavigator.tsx');
 const viewport=file('src/components/Viewport.tsx');
 assert.match(explorer,/<SmartMapNavigator\/>/);
 assert.match(component,/focus\(entry\.id\)/);
 assert.match(component,/focus\(selectedEntry\.id\)/);
 assert.match(viewport,/<NavigatorFocusOutline\/>/);
 assert.match(viewport,/raycast=\{\(\)=>null\}/);
 assert.doesNotMatch(component,/(updateObject|mutate\(|exportMap\(|compileMap\()/);
});
test('HF19 labels translated in six languages',()=>{
 for(const lang of ['es','en','ru','ko','zh','pt']){
  for(const key of ['Smart Map Navigator','Focus selection in 3D','Center camera and highlight selected object','Search map objects']){
   const result=translate(lang,key);
   assert.ok(result&&typeof result==='string');
   if(lang!=='en')assert.notEqual(result,key);
  }
 }
});
