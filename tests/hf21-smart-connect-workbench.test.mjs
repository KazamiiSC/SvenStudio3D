import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBrush} from '../src/engine/geometry.ts';
import {validateProjectFile} from '../src/engine/projectValidation.ts';
import {makeConnectionRecord,newConnectionId} from '../src/engine/smartConnect.ts';
import {exportBrush,validateBrush} from '../src/engine/exportMap.ts';
import {inspectMapImport} from '../src/engine/importMap.ts';
import {defaultConnectionFace,faceCenter,generateSmartConnection,obstacleBoxes,suggestConnectionAlternatives,connectionTransitionWeight} from '../src/engine/smartConnect.ts';
import {createSmartConnectHistory,recordSmartConnectChange,undoSmartConnectChange,redoSmartConnectChange} from '../src/engine/smartConnectHistory.ts';
const sample=()=>({fromId:'a',toId:'b',fromFace:1,toFace:2,options:{points:[[0,0,0],[90,0,0]],quality:4,mode:'angular',texture:'SV_BRICK01',clearance:16},selectedPoint:1,allowCollisions:false,cutIds:[],routeFeedback:''});
test('HF21 scoped undo/redo preserves deep waypoints, openings, alternate routing and settings without changing source',()=>{
 const orig=sample(),before=structuredClone(orig);
 let h=createSmartConnectHistory();h=recordSmartConnectChange(h,orig);
 const after={...orig,options:{...orig.options,quality:8,transition:'ease',points:[[0,0,0],[40,20,0],[90,0,0]]},cutIds:['wall'],routeFeedback:'Proposed route'};
 const undo=undoSmartConnectChange(h,after);assert.ok(undo);assert.deepEqual(undo.draft,orig);
 // Mutating a returned draft may never modify saved history.
 undo.draft.options.points[0][0]=42;
 const redo=redoSmartConnectChange(undo.history,orig);assert.ok(redo);assert.deepEqual(redo.draft,after);
 const newHistory=recordSmartConnectChange(undo.history,orig);
 assert.equal(newHistory.future.length,0,'a new edit clears redo');
 assert.deepEqual(orig,before,'history must not mutate the source object');
});
test('HF21 history is bounded and reverse restores earlier steps',()=>{
 let h=createSmartConnectHistory(),draft=sample();
 for(let i=0;i<72;i++){h=recordSmartConnectChange(h,draft);draft={...draft,options:{...draft.options,clearance:i}};}
 assert.equal(h.past.length,60);
 const undone=undoSmartConnectChange(h,draft);assert.ok(undone);
 assert.equal(undone.draft.options.clearance,70);
});
test('HF21 geometry transition weights are bounded and preserve endpoints',()=>{
 for(const style of ['linear','ease','hold-start','hold-end']){
  assert.equal(connectionTransitionWeight(0,style),0);
  assert.equal(connectionTransitionWeight(1,style),1);
  for(const t of [-5,.12,.38,.5,.67,.95,2])assert.ok(connectionTransitionWeight(t,style)>=0&&connectionTransitionWeight(t,style)<=1);
 }
 assert.notEqual(connectionTransitionWeight(.25,'ease'),connectionTransitionWeight(.25,'linear'));
});
test('HF21 route alternatives consider multiple obstacle strategies without modifying walls',()=>{
 const a=createBrush('box',[0,0,64],[64,64,64],'Source');
 const b=createBrush('box',[600,0,64],[96,96,64],'Destination');
 const walls=[createBrush('box',[210,-10,64],[24,180,200],'Wall 1'),createBrush('box',[390,20,64],[24,180,200],'Wall 2')];
 const source=JSON.stringify([a,b,...walls]);
 const af=defaultConnectionFace(a,b),bf=defaultConnectionFace(b,a),start=faceCenter(a,af),end=faceCenter(b,bf);
 const obstacles=obstacleBoxes([a,b,...walls],a.id,b.id);
 const routes=suggestConnectionAlternatives(start,end,[1,0,0],[-1,0,0],obstacles,45);
 assert.ok(routes.length>0);assert.ok(routes.length<=6);
 for(const route of routes){
  assert.ok(route.points.length>=2&&route.points.length<=24);
  assert.ok(route.points.every(point=>point.every(Number.isFinite)));
  assert.ok(route.length>0);assert.ok(Number.isInteger(route.collisions));
 }
 const previews=[];
 for(const route of routes){
  try{previews.push(generateSmartConnection(a,b,af,bf,{points:route.points,quality:4,mode:'angular',texture:'SV_BRICK01',clearance:12,transition:'ease'},[a,b,...walls]));}catch{}
 }
 assert.ok(previews.length,'at least one preview must be exportable');
 const best=[...previews].sort((x,y)=>x.collisions.length-y.collisions.length)[0];
 for(const brush of best.brushes)assert.deepEqual(validateBrush(brush),[]);
 const roundtrip=inspectMapImport(`{\n"classname" "worldspawn"\n${best.brushes.map(exportBrush).join('\n')}\n}\n`);
 assert.equal(roundtrip.report.importedBrushes,best.brushes.length);
 assert.equal(roundtrip.report.skippedBrushes,0);
 assert.equal(JSON.stringify([a,b,...walls]),source);
});
test('HF21 profile transition metadata validates while unknown values are rejected',()=>{
 const a=createBrush('box',[0,0,64],[64,64,64],'a'),b=createBrush('box',[320,0,64],[64,96,64],'b');
 const fa=defaultConnectionFace(a,b),fb=defaultConnectionFace(b,a);
 const options={points:[faceCenter(a,fa),faceCenter(b,fb)],quality:4,mode:'angular',texture:'SV_BRICK01',clearance:16,transition:'ease'};
 const preview=generateSmartConnection(a,b,fa,fb,options,[a,b]);
 const record=makeConnectionRecord(newConnectionId(),{brushId:a.id,faceIndex:fa},{brushId:b.id,faceIndex:fb},options,preview.brushes);
 const project={version:1,target:'svengine',name:'HF21',objects:[a,b,...preview.brushes],world:{classname:'worldspawn'},wadNames:[],smartConnections:[record]};
 validateProjectFile(structuredClone(project));
 assert.throws(()=>validateProjectFile({...project,smartConnections:[{...record,options:{...options,transition:'invalid'}}]}),/Smart Connect record/);
});
test('HF21 interface includes 3D handles, 2D previews, obstacle choosing and keyboard undo/redo with visible controls',()=>{
 const jsx=readFileSync(new URL('../src/components/SmartConnectPanel.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/components/smartConnect.css',import.meta.url),'utf8');
 for(const code of ['Waypoint3D','onBeginMove','onObstacleClick','PlanView','sc-route-panel','undoEdit','redoEdit',"event.code!=='KeyZ'",'event.code===\'KeyY\'','setPointerCapture','sc-opening-controls','sc-history'])assert.ok(jsx.includes(code),code);
 for(const selector of ['.sc-options>*{flex:0 0 auto}', '.sc-opening-controls{flex-shrink:0', '.sc-route-panel{','.sc-title .sc-history'])assert.ok(css.includes(selector),selector);
});
