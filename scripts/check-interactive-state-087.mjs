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
  const {validateProject,validateBrush,exportMap}=require('./src/engine/exportMap.js');
  const box=(pos,size=[128,128,128])=>createBrush('box',pos,size);
  const fresh=(objects)=>useEditor.setState({project:{version:1,target:'svengine',name:'state-tests',objects,world:{classname:'worldspawn'},wadNames:[]},selected:null,selectedIds:[],selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false,history:[],future:[],measurement:{a:null,b:null},measureMode:false,textureDragSnapshot:null,prefabs:[]});
  let tests=0;const check=(name,fn)=>{fn();tests++;console.log('PASS',name)};

  check('Interactive door placement, adjustment and undo',()=>{
    const wall=box([0,0,144],[512,32,288]);fresh([wall]);
    const options={width:96,height:128,depth:24,frame:8,steps:8,cutOnly:false,doorLeaf:false};
    useEditor.setState({mode:'rotate'});
    useEditor.getState().startArchitecturePlacement('door',options);
    assert.equal(useEditor.getState().mode,'select');
    assert.equal(useEditor.getState().architecturePreviousMode,'rotate');
    useEditor.getState().setArchitectureHoverTarget(wall.id);
    assert.equal(useEditor.getState().architectureHoverTarget,wall.id);
    useEditor.getState().placeArchitectureOnWall(wall.id,[95,0,85]);
    let state=useEditor.getState();
    assert.equal(state.architecturePlacement,null);
    assert.equal(state.architectureHoverTarget,null);
    assert.equal(state.mode,'rotate'); // restore transform gizmo
    assert.equal(state.architecturePreviousMode,null);
    assert.equal(state.project.architectureOpenings?.length,1);
    assert.ok(state.project.objects.length>3);
    state.project.objects.forEach(o=>assert.deepEqual(validateBrush(o),[]));
    assert.equal(state.history.length,1);
    state.undo();assert.equal(useEditor.getState().project.objects.length,1);
    useEditor.getState().redo();
    state=useEditor.getState();
    assert.equal(state.project.architectureOpenings?.length,1);
    state.updateSelectedOpening({...options,width:80});
    assert.equal(useEditor.getState().project.architectureOpenings?.[0]?.options.width,80);
    useEditor.getState().undo();
    assert.equal(useEditor.getState().project.architectureOpenings?.[0]?.options.width,96);
  });
  check('Window beside existing door preserves both holes and restores gizmo',()=>{
    const wall=box([0,0,144],[512,32,288]);
    const spawn={id:'spawn',kind:'entity',name:'Spawn',classname:'info_player_start',position:[0,0,48],props:{}};
    fresh([wall,spawn]);
    const options={width:96,height:128,depth:24,frame:8,steps:8,cutOnly:false,doorLeaf:false};
    useEditor.getState().startArchitecturePlacement('door',options);
    useEditor.getState().placeArchitectureOnWall(wall.id,[-95,0,80]);
    let st=useEditor.getState();
    const {transformedVertices}=require('./src/engine/geometry.js');
    const fragment=st.project.objects.find(o=>o.kind==='brush'&&o.name.includes('wall section')&&
      transformedVertices(o).some(p=>p[0]>120)&&transformedVertices(o).some(p=>p[0]<100));
    assert.ok(fragment,'right side of wall should remain after door');
    useEditor.getState().startArchitecturePlacement('window',options);
    useEditor.getState().placeArchitectureOnWall(fragment.id,[120,0,190]);
    st=useEditor.getState();
    assert.equal(st.project.architectureOpenings.length,2);
    assert.notEqual(st.mode,'select'); // gizmo remains available
    st.project.objects.filter(o=>o.kind==='brush').forEach(o=>assert.deepEqual(validateBrush(o),[]));
    assert.deepEqual(validateProject(st.project),[]);
    assert.ok(exportMap(st.project).includes('worldspawn'));
    st.undo();assert.equal(useEditor.getState().project.architectureOpenings.length,1);
  });
  check('Smart Merge, select whole group, unmerge and undo',()=>{
    const a=box([0,0,0],[64,64,64]),b=box([64,0,0],[64,64,64]);fresh([a,b]);
    useEditor.getState().selectObject(a.id,false);useEditor.getState().selectObject(b.id,true);
    useEditor.getState().smartMergeSelected();
    const group=useEditor.getState().project.objects[0].group;
    assert.equal(group,useEditor.getState().project.objects[1].group);
    useEditor.getState().setSelected(null);
    useEditor.getState().selectObject(a.id,false);
    assert.equal(useEditor.getState().selectedIds.length,2);
    useEditor.getState().unmergeSmartSelected();
    assert.ok(useEditor.getState().project.objects.every(o=>!o.group));
    useEditor.getState().undo();assert.equal(useEditor.getState().project.objects[0].group,group);
  });
  check('Merge into single convex brush and brush entity',()=>{
    const a=box([0,0,0],[64,64,64]),b=box([64,0,0],[64,64,64]);fresh([a,b]);
    useEditor.getState().selectObject(a.id,false);useEditor.getState().selectObject(b.id,true);
    useEditor.getState().mergeIntoOneSelected();
    assert.equal(useEditor.getState().project.objects.length,1);
    assert.deepEqual(validateBrush(useEditor.getState().project.objects[0]),[]);
    useEditor.getState().undo();
    useEditor.getState().selectObject(a.id,false);useEditor.getState().selectObject(b.id,true);
    useEditor.getState().createSelectedBrushEntity('func_wall');
    assert.equal(useEditor.getState().project.objects.filter(o=>o.kind==='entity').length,1);
    assert.ok(useEditor.getState().project.objects.filter(o=>o.kind==='brush').every(b=>b.entityId));
    useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.length,2);
  });
  check('Sky enclosure adds one Undo step and replaces old auto brushes',()=>{
    const floor=box([0,0,-16],[512,512,32]);
    const spawn={id:'spawn',kind:'entity',name:'Spawn',classname:'info_player_start',position:[0,0,48],props:{}};
    fresh([floor,spawn]);
    const options={margin:256,thickness:32,grid:16,hideInEditor:true};
    useEditor.getState().generateSkyEnclosure(options);
    assert.equal(useEditor.getState().project.objects.length,8);
    assert.equal(useEditor.getState().history.length,1);
    assert.ok(useEditor.getState().project.objects.slice(2).every(b=>b.faces.every(f=>f.texture==='SKY')));
    useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.length,2);
    useEditor.getState().redo();assert.equal(useEditor.getState().project.objects.length,8);
    useEditor.getState().generateSkyEnclosure({...options,margin:512});
    assert.equal(useEditor.getState().project.objects.length,8);
    assert.equal(useEditor.getState().history.length,2);
    useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.length,8);
  });
  console.log(`PASS editor state: ${tests} checks.`);
}catch(err){console.error('FAIL v0.7 state',err);process.exitCode=1}
finally{delete globalThis.localStorage;fs.rmSync(dst,{recursive:true,force:true})}
