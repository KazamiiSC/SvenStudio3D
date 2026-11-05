/** v0.7.0 editor state regression, runnable without Vite/Rollup. */
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=process.cwd(),dst=fs.mkdtempSync(path.join(root,'.advanced-state-'));
try{
  for(const file of [
    'src/engine/types.ts','src/engine/entityAppearance.ts','src/engine/controls.ts',
    'src/engine/geometry.ts','src/engine/exportMap.ts','src/engine/importMap.ts',
    'src/engine/fgd.ts','src/engine/modeling.ts','src/engine/advancedModeling.ts','src/engine/architecture.ts','src/engine/smartMerge.ts',
    'src/engine/prefabs.ts','src/engine/gameplay.ts','src/engine/npc.ts',
    'src/engine/sound.ts','src/i18n.ts','src/engine/environment.ts','src/engine/skyEnclosure.ts','src/store.ts']){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    const output=path.join(dst,file.replace(/\.ts$/,'.js'));
    fs.mkdirSync(path.dirname(output),{recursive:true});
    fs.writeFileSync(output,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
  }
  fs.writeFileSync(path.join(dst,'package.json'),JSON.stringify({type:'commonjs'}));
  fs.symlinkSync(path.join(root,'node_modules'),path.join(dst,'node_modules'),'dir');
  const storage=new Map();globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key)};
  const require=createRequire(path.join(dst,'test.cjs'));
  const {useEditor}=require('./src/store.js');
  const {createBrush}=require('./src/engine/geometry.js');
  const {uniqueBrushEdges}=require('./src/engine/modeling.js');
  const {validateProject,validateBrush}=require('./src/engine/exportMap.js');
  const box=(pos,size=[128,128,128])=>createBrush('box',pos,size);
  const fresh=(objects)=>useEditor.setState({project:{version:1,target:'svengine',name:'state-tests',objects,world:{classname:'worldspawn'},wadNames:[]},selected:null,selectedIds:[],selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false,history:[],future:[],measurement:{a:null,b:null},measureMode:false,textureDragSnapshot:null,prefabs:[]});
  let tests=0;const check=(name,fn)=>{fn();tests++;console.log('PASS',name)};
  check('CSG action, selection state and undo',()=>{
    const a=box([0,0,0]),b=box([64,0,0]);fresh([a,b]);
    useEditor.getState().selectObject(a.id,false);useEditor.getState().selectObject(b.id,true);
    useEditor.getState().booleanSelected('subtract');
    assert.equal(useEditor.getState().project.objects.length,1);
    assert.deepEqual(validateBrush(useEditor.getState().project.objects[0]),[]);
    useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.length,2);
    useEditor.getState().redo();assert.equal(useEditor.getState().project.objects.length,1);
  });
  check('bevel, inset and extrusion UI actions',()=>{
    const a=box([0,0,0]);fresh([a]);
    useEditor.getState().setSelected(a.id);useEditor.getState().setGeometryMode('edge');
    useEditor.getState().selectEditIndices(uniqueBrushEdges(a)[0]);
    useEditor.getState().bevelSelected(8);
    assert.ok(useEditor.getState().project.objects[0].faces.length>6);
    useEditor.getState().undo();
    useEditor.getState().setGeometryMode('face');useEditor.getState().setSelected(a.id,1);
    useEditor.getState().insetSelected(8);
    assert.ok(useEditor.getState().project.objects[0].faces.length>6);
    useEditor.getState().undo();
    useEditor.getState().setGeometryMode('face');useEditor.getState().setSelected(a.id,1);
    useEditor.getState().extrudeSelected(64);
    assert.equal(useEditor.getState().project.objects.length,2);
    useEditor.getState().project.objects.forEach(o=>assert.deepEqual(validateBrush(o),[]));
    useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.length,1);
  });
  check('named groups: select, hide, lock and undo',()=>{
    const a=box([0,0,0]),b=box([256,0,0]);fresh([a,b]);
    useEditor.getState().selectObject(a.id,false);useEditor.getState().selectObject(b.id,true);
    useEditor.getState().groupSelected('Central Hall');
    assert.equal(useEditor.getState().project.objects.every(o=>o.group==='Central Hall'),true);
    useEditor.getState().toggleGroupVisibility('Central Hall');
    assert.equal(useEditor.getState().project.objects.every(o=>o.hidden),true);
    useEditor.getState().toggleGroupLocked('Central Hall');
    assert.equal(useEditor.getState().project.objects.every(o=>o.locked),true);
    useEditor.getState().selectGroup('Central Hall');assert.equal(useEditor.getState().selectedIds.length,2);
    useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.every(o=>!o.locked),true);
  });
  check('prefab library save, insert, delete and persistent JSON',()=>{
    const a=box([0,0,0]);fresh([a]);useEditor.getState().setSelected(a.id);
    useEditor.getState().saveSelectedPrefab('Test Prefab');
    const id=useEditor.getState().prefabs[0].id;
    assert.ok(storage.has('svenstudio-prefabs-v1'));
    useEditor.getState().instantiatePrefab(id,[512,0,0]);
    assert.equal(useEditor.getState().project.objects.length,2);
    assert.notEqual(useEditor.getState().project.objects[0].id,useEditor.getState().project.objects[1].id);
    useEditor.getState().removePrefab(id);assert.equal(useEditor.getState().prefabs.length,0);
  });
  check('UV drag is a single Undo entry and can be cancelled',()=>{
    const a=box([0,0,0]);fresh([a]);
    useEditor.getState().beginTextureDrag(a.id,1);
    useEditor.getState().updateTextureDrag(a.id,1,10,7);
    useEditor.getState().updateTextureDrag(a.id,1,21,-11);
    assert.equal(useEditor.getState().history.length,0);
    useEditor.getState().finishTextureDrag(true);
    assert.equal(useEditor.getState().history.length,1);
    assert.equal(useEditor.getState().project.objects[0].faces[1].uShift,21);
    useEditor.getState().undo();
    assert.equal(useEditor.getState().project.objects[0].faces[1].uShift,undefined);
    useEditor.getState().beginTextureDrag(a.id,1);useEditor.getState().updateTextureDrag(a.id,1,12,5);
    useEditor.getState().finishTextureDrag(false);
    assert.equal(useEditor.getState().project.objects[0].faces[1].uShift,undefined);
  });
  check('distance tool snaps points and resets after second point',()=>{
    fresh([]);useEditor.getState().toggleMeasure();
    useEditor.getState().measurePoint([1,0,0]);
    useEditor.getState().measurePoint([32,16,0]);
    assert.deepEqual(useEditor.getState().measurement,{a:[0,0,0],b:[32,16,0]});
    useEditor.getState().measurePoint([64,0,0]);
    assert.deepEqual(useEditor.getState().measurement,{a:[64,0,0],b:null});
    useEditor.getState().toggleMeasure();assert.equal(useEditor.getState().measureMode,false);
  });
  console.log(`PASS 0.7.0: ${tests} editor-state checks.`);
}catch(err){console.error('FAIL v0.7 state',err);process.exitCode=1}
finally{delete globalThis.localStorage;fs.rmSync(dst,{recursive:true,force:true})}
