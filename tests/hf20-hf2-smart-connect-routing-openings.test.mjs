import test from 'node:test';
import assert from 'node:assert/strict';
import {createBrush} from '../src/engine/geometry.ts';
import {exportBrush,validateBrush} from '../src/engine/exportMap.ts';
import {inspectMapImport} from '../src/engine/importMap.ts';
import {validateProjectFile} from '../src/engine/projectValidation.ts';
import {useEditor} from '../src/store.ts';
import {defaultConnectionFace,faceCenter,generateSmartConnection,obstacleBoxes,collidingPath,
 suggestConnectionRoute,planConnectionOpenings,makeConnectionRecord,newConnectionId,connectionCanRegenerate} from '../src/engine/smartConnect.ts';

const tex='SV_BRICK01';
const piecesValid=brushes=>{
 for(const brush of brushes) assert.deepEqual(validateBrush(brush),[]);
 const text=`{\n"classname" "worldspawn"\n${brushes.map(exportBrush).join('\n')}\n}\n`;
 const report=inspectMapImport(text).report;
 assert.equal(report.importedBrushes,brushes.length);
 assert.equal(report.skippedBrushes,0);
};
function fixture(){
 const a=createBrush('box',[0,0,64],[64,64,64],'A');
 const b=createBrush('box',[320,0,64],[96,128,64],'B');
 const wall=createBrush('box',[170,0,64],[24,240,256],'Wall');
 const fa=defaultConnectionFace(a,b),fb=defaultConnectionFace(b,a);
 const points=[faceCenter(a,fa),faceCenter(b,fb)];
 const options={points,quality:4,mode:'angular',clearance:12,texture:tex};
 return {a,b,wall,fa,fb,options};
}
test('HF20 HF2 routes around several independently blocking walls without editing brushes',()=>{
 const {a,b}=fixture();b.position=[700,0,64];
 const walls=[createBrush('box',[250,-25,64],[20,210,240],'Wall 1'),createBrush('box',[450,36,64],[20,200,240],'Wall 2')];
 const boxes=obstacleBoxes([a,b,...walls],a.id,b.id);
 const start=faceCenter(a,defaultConnectionFace(a,b)),end=faceCenter(b,defaultConnectionFace(b,a));
 const before=JSON.stringify(walls);
 const suggestion=suggestConnectionRoute(start,end,[1,0,0],[-1,0,0],boxes,68);
 assert.equal(suggestion.blocked,false,JSON.stringify(suggestion));
 assert.ok(suggestion.points.length>=3);
 assert.deepEqual(collidingPath(suggestion.points,boxes,68),[]);
 assert.equal(JSON.stringify(walls),before);
 assert.ok(suggestion.points.length<=24);
});
test('HF20 HF2 opening previews only cut specifically selected world brushes and MAP round-trip',()=>{
 const {a,b,wall,fa,fb,options}=fixture();const other=createBrush('box',[800,0,64],[48,64,64],'Unaffected');
 const source=JSON.stringify([a,b,wall,other]);
 const preview=generateSmartConnection(a,b,fa,fb,options,[a,b,wall,other]);
 assert.ok(preview.collisions.includes(wall.id));
 const cuts=planConnectionOpenings(preview,[wall]);
 assert.equal(cuts.length,1);
 assert.ok(cuts[0].fragments.length>1);
 piecesValid([...preview.brushes,...cuts[0].fragments]);
 assert.equal(JSON.stringify([a,b,wall,other]),source,'preview must never mutate the map');
 assert.throws(()=>planConnectionOpenings(preview,[{...wall,locked:true}]),/visible, unlocked/);
 assert.throws(()=>planConnectionOpenings(preview,[{...wall,entityId:'door'}]),/world brushes/);
 assert.throws(()=>planConnectionOpenings(preview,[other]),/No real geometric intersection/);
});
test('HF20 HF2 opening and connector commit in one undo; safe regeneration and restoration',()=>{
 const editor=useEditor.getState(),original=structuredClone(editor.project);
 const {a,b,wall,fa,fb,options}=fixture();
 try{
  editor.loadProject({...original,objects:[a,b,wall],smartConnections:[]});
  const preview=generateSmartConnection(a,b,fa,fb,options,[a,b,wall]);
  const cuts=planConnectionOpenings(preview,[wall]);
  const id=newConnectionId();const record=makeConnectionRecord(id,{brushId:a.id,faceIndex:fa},{brushId:b.id,faceIndex:fb},options,preview.brushes,cuts);
  const n=useEditor.getState().history.length;
  useEditor.getState().saveSmartConnection(record,preview.brushes,cuts);
  let now=useEditor.getState();
  assert.equal(now.history.length,n+1);
  assert.ok(!now.project.objects.some(o=>o.id===wall.id));
  assert.equal(now.project.objects.length,2+preview.brushes.length+cuts[0].fragments.length);
  validateProjectFile(structuredClone(now.project));
  assert.ok(connectionCanRegenerate(record,now.project.objects));
  now.undo();
  now=useEditor.getState();assert.ok(now.project.objects.some(o=>o.id===wall.id));
  assert.equal(now.project.smartConnections.length,0);
  now.redo();now=useEditor.getState();assert.ok(connectionCanRegenerate(record,now.project.objects));
  // Turning off openings during regeneration restores the untouched source.
  const newPreview=generateSmartConnection(a,b,fa,fb,options,[a,b,wall]);
  const next=makeConnectionRecord(id,record.from,record.to,options,newPreview.brushes);
  now.saveSmartConnection(next,newPreview.brushes);
  now=useEditor.getState();assert.ok(now.project.objects.some(o=>o.id===wall.id));
  assert.equal(now.project.smartConnections[0].cuts,undefined);
  now.undo();now=useEditor.getState();assert.ok(connectionCanRegenerate(record,now.project.objects));
  const touched=now.project.objects.find(o=>o.id===cuts[0].fragments[0].id);
  now.updateObject(touched.id,{position:[12,0,0]});
  assert.throws(()=>useEditor.getState().saveSmartConnection(next,newPreview.brushes),/modified|changed/);
 }finally{useEditor.getState().loadProject(original)}
});
test('HF20 HF2 opening metadata validation rejects malformed originals and fragment signatures',()=>{
 const {a,b,wall,fa,fb,options}=fixture();
 const preview=generateSmartConnection(a,b,fa,fb,options,[a,b,wall]);
 const cuts=planConnectionOpenings(preview,[wall]);
 const record=makeConnectionRecord(newConnectionId(),{brushId:a.id,faceIndex:fa},{brushId:b.id,faceIndex:fb},options,preview.brushes,cuts);
 const project={version:1,target:'svengine',name:'Openings',objects:[a,b,...preview.brushes,...cuts[0].fragments],world:{classname:'worldspawn'},wadNames:[],smartConnections:[record]};
 validateProjectFile(structuredClone(project));
 assert.throws(()=>validateProjectFile({...project,smartConnections:[{...record,cuts:[{...record.cuts[0],pieces:[{id:10,signature:'bad'}]}]}]}),/Smart Connect opening/);
});
test('HF20 HF2 regenerates an existing perforated connection without losing the original CSG source',()=>{
 const editor=useEditor.getState(),original=structuredClone(editor.project);
 const {a,b,wall,fa,fb,options}=fixture();
 try{
  editor.loadProject({...original,objects:[a,b,wall],smartConnections:[]});
  const first=generateSmartConnection(a,b,fa,fb,options,[a,b,wall]);
  const cuts=planConnectionOpenings(first,[wall]);const id=newConnectionId();
  const record=makeConnectionRecord(id,{brushId:a.id,faceIndex:fa},{brushId:b.id,faceIndex:fb},options,first.brushes,cuts);
  useEditor.getState().saveSmartConnection(record,first.brushes,cuts);
  const again=generateSmartConnection(a,b,fa,fb,options,[a,b,wall]);
  const newCuts=planConnectionOpenings(again,[record.cuts[0].original]);
  const regenerated=makeConnectionRecord(id,record.from,record.to,options,again.brushes,newCuts);
  useEditor.getState().saveSmartConnection(regenerated,again.brushes,newCuts);
  const current=useEditor.getState().project;
  assert.ok(connectionCanRegenerate(regenerated,current.objects));
  assert.equal(current.smartConnections[0].cuts.length,1);
  assert.ok(!current.objects.some(o=>o.id===wall.id));
  assert.equal(current.objects.length,2+again.brushes.length+newCuts[0].fragments.length);
  validateProjectFile(structuredClone(current));
  useEditor.getState().undo();
  assert.ok(connectionCanRegenerate(record,useEditor.getState().project.objects));
 }finally{useEditor.getState().loadProject(original)}
});
