import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBrush} from '../src/engine/geometry.ts';
import {exportBrush,validateBrush} from '../src/engine/exportMap.ts';
import {inspectMapImport} from '../src/engine/importMap.ts';
import {validateProjectFile} from '../src/engine/projectValidation.ts';
import {useEditor} from '../src/store.ts';
import {
  defaultConnectionFace,faceCenter,generateSmartConnection,obstacleBoxes,
  suggestConnectionRoute,connectionCanRegenerate,connectionSignature,makeConnectionRecord,newConnectionId
} from '../src/engine/smartConnect.ts';

const tex='SV_BRICK01';
const make=(from,to,partial={})=>{
 const af=defaultConnectionFace(from,to),bf=defaultConnectionFace(to,from);
 const options={points:[faceCenter(from,af),faceCenter(to,bf)],quality:4,mode:'angular',clearance:0,texture:tex,...partial};
 return {af,bf,options,preview:generateSmartConnection(from,to,af,bf,options,[from,to])};
};
const base=()=>[createBrush('box',[0,0,64],[64,64,64],'Source'),createBrush('box',[320,0,64],[96,128,64],'Target')];
const roundtrip=(brushes)=>{
 const map=`{\n"classname" "worldspawn"\n${brushes.map(exportBrush).join('\n')}\n}\n`;
 const imported=inspectMapImport(map);
 assert.equal(imported.report.importedBrushes,brushes.length);
 assert.equal(imported.report.skippedBrushes,0);
};
test('HF20 creates real, valid MAP brushes from two different box faces',()=>{
 const [a,b]=base();const before=JSON.stringify([a,b]);const {preview}=make(a,b);
 assert.ok(preview.brushes.length>=1);
 for(const brush of preview.brushes)assert.deepEqual(validateBrush(brush),[]);
 roundtrip(preview.brushes);
 assert.equal(JSON.stringify([a,b]),before,'sources must remain unchanged');
});
test('HF20 quality supports 4, 8, 12 divisions without missing original corners',()=>{
 const [a,b]=base();
 for(const quality of [4,8,12]){const {preview}=make(a,b,{quality});roundtrip(preview.brushes);}
});
test('HF20 handles nonmatching cross-sections: cylinder, wedge and polyhedral profiles',()=>{
 for(const fromType of ['cylinder','wedge','cone','pyramid','icosphere']){
  const a=createBrush(fromType,[0,0,64],[56,72,80]);
  const b=createBrush('box',[360,55,96],[96,110,64]);
  const {preview}=make(a,b,{quality:8});
  assert.ok(preview.brushes.length>0,fromType);
  roundtrip(preview.brushes);
 }
});
test('HF20 builds editable angular and smooth routes with shared station boundaries',()=>{
 const [a,b]=base();const {af,bf}=make(a,b);
 const points=[faceCenter(a,af),[130,100,84],faceCenter(b,bf)];
 for(const mode of ['angular','smooth']){
  const {preview}=make(a,b,{points,mode,quality:8});
  assert.ok(preview.brushes.length>=2);
  assert.ok(preview.stations.length>=3);
  roundtrip(preview.brushes);
 }
});
test('HF20 automatic route can go around an intervening wall',()=>{
 const [a,b]=base();const wall=createBrush('box',[170,0,64],[24,240,256],'Wall');
 const {af,bf}=make(a,b);
 const start=faceCenter(a,af),end=faceCenter(b,bf);
 const obstacles=obstacleBoxes([a,b,wall],a.id,b.id);
 const direct=generateSmartConnection(a,b,af,bf,{points:[start,end],quality:4,mode:'angular',clearance:12,texture:tex},[a,b,wall]);
 assert.ok(direct.collisions.includes(wall.id));
 const suggestion=suggestConnectionRoute(start,end,[1,0,0],[-1,0,0],obstacles,68);
 assert.equal(suggestion.blocked,false);
 assert.ok(suggestion.points.length>=3);
 const result=generateSmartConnection(a,b,af,bf,{points:suggestion.points,quality:4,mode:'angular',clearance:12,texture:tex},[a,b,wall]);
 assert.deepEqual(result.collisions,[]);
 roundtrip(result.brushes);
});
test('HF20 ignores hidden obstacles and refuses locked or hidden endpoints',()=>{
 const [a,b]=base(),wall=createBrush('box',[170,0,64],[24,240,256]);
 wall.hidden=true;
 assert.deepEqual(obstacleBoxes([a,b,wall],a.id,b.id),[]);
 a.locked=true;assert.throws(()=>make(a,b),/visible, unlocked/);
 a.locked=false;b.hidden=true;assert.throws(()=>make(a,b),/visible, unlocked/);
});
test('HF20 invalid inputs are blocked without touching source brushes',()=>{
 const [a,b]=base(),{af,bf,options}=make(a,b);const before=JSON.stringify([a,b]);
 for(const broken of [{...options,points:[options.points[0],options.points[0],options.points[1]]},{...options,texture:'INVALID TEXTURE'},{...options,quality:64},{...options,points:[[Infinity,0,0],options.points[1]]}])
  assert.throws(()=>generateSmartConnection(a,b,af,bf,broken,[a,b]));
 assert.equal(JSON.stringify([a,b]),before);
});
test('HF20 persistent records protect manually changed generated brushes',()=>{
 const [a,b]=base(),{af,bf,options,preview}=make(a,b);const id=newConnectionId();
 const record=makeConnectionRecord(id,{brushId:a.id,faceIndex:af},{brushId:b.id,faceIndex:bf},options,preview.brushes);
 assert.ok(connectionCanRegenerate(record,[a,b,...preview.brushes]));
 const modified={...preview.brushes[0],position:[1,0,0]};
 assert.notEqual(connectionSignature(modified),record.signatures[0]);
 assert.equal(connectionCanRegenerate(record,[a,b,modified]),false);
 assert.equal(connectionCanRegenerate(record,[a,b]),false);
});
test('HF20 creating/regenerating uses a single Undo and retains old brushes when guarded',()=>{
 const editor=useEditor.getState(),original=structuredClone(editor.project);
 const [a,b]=base();try{
  editor.loadProject({...original,objects:[a,b],smartConnections:[]});
  const {af,bf,options,preview}=make(a,b);const id=newConnectionId();
  const record=makeConnectionRecord(id,{brushId:a.id,faceIndex:af},{brushId:b.id,faceIndex:bf},options,preview.brushes);
  const historyBefore=useEditor.getState().history.length;
  useEditor.getState().saveSmartConnection(record,preview.brushes);
  const saved=useEditor.getState();
  assert.equal(saved.project.smartConnections.length,1);
  assert.equal(saved.history.length,historyBefore+1);
  assert.equal(saved.project.objects.length,2+preview.brushes.length);
  saved.undo();
  assert.equal(useEditor.getState().project.objects.length,2);
  assert.equal((useEditor.getState().project.smartConnections??[]).length,0);
  useEditor.getState().redo();
  assert.equal(useEditor.getState().project.smartConnections.length,1);
  const regenerated=make(a,b,{points:[options.points[0],[160,60,64],options.points[1]]});
  const reRecord=makeConnectionRecord(id,record.from,record.to,regenerated.options,regenerated.preview.brushes);
  useEditor.getState().saveSmartConnection(reRecord,regenerated.preview.brushes);
  assert.equal(useEditor.getState().project.objects.length,2+regenerated.preview.brushes.length);
  // A manual face texture change must block destructive regeneration.
  const changed=useEditor.getState().project.objects.find(o=>o.id===reRecord.brushIds[0]);
  useEditor.getState().updateObject(changed.id,{position:[10,10,10]});
  assert.throws(()=>useEditor.getState().saveSmartConnection(reRecord,regenerated.preview.brushes),/modified/);
 }finally{useEditor.getState().loadProject(original);}
});
test('HF20 connection metadata survives project validation and does not pollute Valve 220 export',()=>{
 const [a,b]=base(),{af,bf,options,preview}=make(a,b);const id=newConnectionId();
 const record=makeConnectionRecord(id,{brushId:a.id,faceIndex:af},{brushId:b.id,faceIndex:bf},options,preview.brushes);
 const project={version:1,target:'svengine',name:'HF20 test',objects:[a,b,...preview.brushes],world:{classname:'worldspawn'},wadNames:[],smartConnections:[record]};
 const checked=validateProjectFile(structuredClone(project));
 assert.equal(checked.smartConnections[0].id,id);
 assert.throws(()=>validateProjectFile({...project,smartConnections:[{...record,brushIds:['other',...record.brushIds],signatures:record.signatures}]}),/Smart Connect/);
 roundtrip(preview.brushes);
});
test('HF20 stress: 150 deterministic mixed forms/rotations keep all generated solids valid',()=>{
 const types=['box','wedge','cylinder','cone','pyramid','icosphere'];
 for(let k=0;k<150;k++){
  const a=createBrush(types[k%6],[0,0,0],[40+(k%7)*10,64+(k%5)*13,80+(k%4)*14]);a.rotation=[(k%4)*10,(k%5)*9,(k%6)*5];
  const b=createBrush(types[(k*5+1)%6],[220+(k%8)*19,(k%7)*25,70+(k%4)*35],[60+(k%4)*20,80+(k%3)*17,90+(k%5)*12]);b.rotation=[(k%5)*8,(k%4)*11,(k%6)*13];
  const af=defaultConnectionFace(a,b),bf=defaultConnectionFace(b,a),a0=faceCenter(a,af),b0=faceCenter(b,bf);
  const points=k%3===0?[a0,[100,60+(k%7)*20,80+(k%5)*10],b0]:[a0,b0];
  const result=generateSmartConnection(a,b,af,bf,{points,quality:k%2===0?8:4,mode:k%3===0?'smooth':'angular',clearance:0,texture:tex},[a,b]);
  assert.ok(result.brushes.length>0);
  result.brushes.forEach(brush=>assert.deepEqual(validateBrush(brush),[]));
 }
});
test('HF20 UI has both 2D editing planes, isolated 3D preview, safe commit and six locale labels',()=>{
 const ui=readFileSync(new URL('../src/components/SmartConnectPanel.tsx',import.meta.url),'utf8');
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 for(const l of ['es','en','ru','ko','zh','pt'])assert.match(ui,new RegExp('\\b'+l+':\\{title:'));
 for(const token of ['view="xy"','view="xz"','<Preview3D','onStartDrag=','onFaceClick','obstacles={obstacles}','saveSmartConnection','connectionCanRegenerate'])assert.ok(ui.includes(token),token);
 assert.match(app,/dialog==='smartConnect'/);
 assert.match(app,/setDialog\('smartConnect'\)/);
 assert.ok(!ui.includes('createBrush(\'pipe\''));
});
