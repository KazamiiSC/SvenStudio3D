/** v0.8.9.5 transform UX regression (no browser or Sven Co-op install). */
import ts from 'typescript';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(root,'.transform-0895-'));
let count=0;
function test(name,callback){callback();count++;console.log('PASS',name)}
try{
  const files=['src/engine/types.ts','src/engine/geometry.ts','src/engine/transformUX.ts',
    'src/engine/entityAppearance.ts','src/engine/controls.ts','src/engine/exportMap.ts','src/engine/importMap.ts',
    'src/engine/fgd.ts','src/engine/modeling.ts','src/engine/advancedModeling.ts','src/engine/architecture.ts',
    'src/engine/smartMerge.ts','src/engine/prefabs.ts','src/engine/gameplay.ts','src/engine/npc.ts',
    'src/engine/sound.ts','src/engine/environment.ts','src/engine/skyEnclosure.ts','src/i18n.ts','src/store.ts'];
  for(const file of files){
    const output=path.join(tmp,file.replace(/\.ts$/,'.js'));
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),
      {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
  }
  fs.writeFileSync(path.join(tmp,'package.json'),JSON.stringify({type:'commonjs'}));
  fs.symlinkSync(path.join(root,'node_modules'),path.join(tmp,'node_modules'),'dir');
  const storage=new Map();
  globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
  const require=createRequire(path.join(tmp,'test.cjs'));
  const THREE=require('three');
  const {useEditor}=require('./src/store.js');
  const {createBrush,toRenderQuaternion,transformedVertices}=require('./src/engine/geometry.js');
  const {anchorPosition,anchoredPose,snapBrushScaleFactors,GRID_STEPS}=require('./src/engine/transformUX.js');
  const near=(a,b,eps=.00001)=>assert.ok(Math.abs(a-b)<eps,`${a} differs from ${b}`);
  test('Z− anchor preserves the bottom for stretch to +Z',()=>{
    const box=createBrush('box',[0,0,136],[32,544,288]);
    const pivot=anchorPosition(box,'zmin'),position=anchoredPose(new THREE.Vector3(0,136,0),toRenderQuaternion(box.rotation),pivot,new THREE.Vector3(1,1.5,1));
    near(pivot.y,-8);near(position.y,208);
    near(position.y-144*1.5,pivot.y);
  });
  test('Z+ anchor preserves the top for stretch down',()=>{
    const box=createBrush('box',[0,0,136],[32,544,288]);
    const pivot=anchorPosition(box,'zmax'),position=anchoredPose(new THREE.Vector3(0,136,0),toRenderQuaternion(box.rotation),pivot,new THREE.Vector3(1,1.5,1));
    near(pivot.y,280);near(position.y,64);
    near(position.y+144*1.5,pivot.y);
  });
  test('X−/X+ anchors stretch only from the opposite side',()=>{
    const box=createBrush('box',[100,0,100],[80,48,128]);
    const left=anchorPosition(box,'xmin'),right=anchorPosition(box,'xmax');
    near(left.x,60);near(right.x,140);
    const expanded=anchoredPose(new THREE.Vector3(100,100,0),new THREE.Quaternion(),left,new THREE.Vector3(2,1,1));
    near(expanded.x,140);near(expanded.x-80,left.x);
  });
  test('rotated brush retains its local anchor under scale',()=>{
    const box=createBrush('box',[50,80,144],[80,32,288]);box.rotation=[0,0,35];
    const anchor=anchorPosition(box,'zmin'),base=new THREE.Vector3(50,144,80),q=toRenderQuaternion(box.rotation);
    const position=anchoredPose(base,q,anchor,new THREE.Vector3(1,1.5,1));
    const pointOffset=anchor.clone().sub(base).applyQuaternion(q.clone().invert());
    const after=position.clone().add(pointOffset.multiply(new THREE.Vector3(1,1.5,1)).applyQuaternion(q));
    near(after.distanceTo(anchor),0);
  });
  test('snap factor aligns the stretched dimension to grid',()=>{
    const box=createBrush('box',[0,0,64],[32,64,128]);
    const f=snapBrushScaleFactors(box,new THREE.Vector3(1,1,1),new THREE.Vector3(1,1.29,1),16);
    near(128*f.y,160);
    assert.ok(GRID_STEPS.includes(16));
  });
  test('transform commits one undoable state update',()=>{
    const box=createBrush('box',[0,0,136],[32,544,288]);
    useEditor.setState({project:{version:1,target:'svengine',name:'transform test',objects:[box],world:{classname:'worldspawn'},wadNames:[]},selected:box.id,selectedIds:[box.id],history:[],future:[]});
    useEditor.getState().transformSelection({[box.id]:{position:[0,0,208],scale:[1,1,1.5],rotation:[0,0,0]}});
    let s=useEditor.getState();near(s.project.objects[0].position[2],208);assert.equal(s.history.length,1);
    s.undo();s=useEditor.getState();near(s.project.objects[0].position[2],136);s.redo();near(useEditor.getState().project.objects[0].position[2],208);
  });
  test('viewport uses one gizmo and synchronous modal confirmation',()=>{
    const source=fs.readFileSync(path.join(root,'src/components/Viewport.tsx'),'utf8');
    assert.ok(source.includes('function SelectionTransformControls()'));
    assert.equal(source.match(/<SelectionTransformControls\s*\/>/g)?.length,1);
    assert.ok(source.includes('const unsubscribe=useEditor.subscribe'));
    assert.ok(source.includes('if(!committed){'));
    assert.ok(source.includes('expandPicker(controls.current)'));
    assert.ok(source.includes('Math.round(moved[i]/snap)*snap'));
    assert.ok(source.includes('showGrid,\'')||source.includes('showGrid=useEditor'));
  });
  console.log(`PASS v0.8.9.5: ${count} transform/grid checks`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
