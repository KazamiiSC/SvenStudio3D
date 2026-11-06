/** v0.8.9.6 viewport gizmo regressions, without GPU / GoldSrc SDK. */
import ts from 'typescript';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(root,'.gizmo-0896-'));
let checks=0;
const test=(label,fn)=>{fn();checks++;console.log('PASS',label)};
try{
  const compile=['src/engine/controls.ts','src/engine/gizmoPointer.ts','src/engine/types.ts','src/engine/geometry.ts',
    'src/engine/entityAppearance.ts','src/engine/exportMap.ts','src/engine/importMap.ts','src/engine/fgd.ts',
    'src/engine/modeling.ts','src/engine/advancedModeling.ts','src/engine/architecture.ts',
    'src/engine/transformUX.ts','src/engine/smartMerge.ts','src/engine/prefabs.ts','src/engine/gameplay.ts',
    'src/engine/npc.ts','src/engine/sound.ts','src/engine/environment.ts','src/engine/skyEnclosure.ts','src/i18n.ts','src/engine/cinematic.ts','src/engine/customNpc.ts','src/engine/terrain.ts','src/store.ts'];
  for(const file of compile){
    const target=path.join(tmp,file.replace(/\.ts$/,'.js'));
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),
      {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
  }
  fs.writeFileSync(path.join(tmp,'package.json'),JSON.stringify({type:'commonjs'}));
  fs.symlinkSync(path.join(root,'node_modules'),path.join(tmp,'node_modules'),'dir');
  const require=createRequire(path.join(tmp,'test.cjs'));
  const THREE=require('three');
  const {hitTransformPicker}=require('./src/engine/gizmoPointer.js');
  const {readControls}=require('./src/engine/controls.js');
  const {expandPicker}=require('./src/engine/transformUX.js');
  const {TransformControls}=require('three-stdlib');
  const {useEditor}=require('./src/store.js');
  const bounds={left:100,top:200,width:1000,height:1000};
  const camera=new THREE.PerspectiveCamera(60,1,.1,100);
  camera.position.set(0,0,10);camera.lookAt(0,0,0);camera.updateProjectionMatrix();
  const control=new THREE.Group();control.enabled=true;control.dragging=false;control.mode='rotate';
  const picker=new THREE.Group();picker.visible=false;
  const mesh=new THREE.Mesh(new THREE.TorusGeometry(1,.15,8,32),new THREE.MeshBasicMaterial());
  mesh.name='E';picker.add(mesh);control.add(picker);control.gizmo={picker:{rotate:picker}};
  test('invisible rotation picker hits its ring, even on a wall behind it',()=>{
    // Ring radius 1 at depth 10 -> 86.6px in a 1000px-high viewport.
    assert.equal(hitTransformPicker(control,camera,bounds,600+86.6,700),true);
    assert.equal(hitTransformPicker(control,camera,bounds,600,700),false);
  });
  test('outside-viewport coordinates never suppress selection',()=>{
    assert.equal(hitTransformPicker(control,camera,bounds,20,20),false);
    assert.equal(hitTransformPicker(control,camera,bounds,1300,300),false);
  });
  test('dragging reserves pointer events, disabled controls do not',()=>{
    control.dragging=true;assert.equal(hitTransformPicker(control,camera,bounds,120,250),true);
    control.enabled=false;assert.equal(hitTransformPicker(control,camera,bounds,120,250),false);
    control.dragging=false;control.enabled=true;
  });
  test('small gizmo has a wider invisible rotation hitband, updated noncumulatively',()=>{
    const camera2=new THREE.PerspectiveCamera(60,1,.1,1000);
    const obj=new THREE.Group(),scene=new THREE.Scene();
    const handles=new TransformControls(camera2,undefined);
    scene.add(obj,handles);handles.attach(obj);handles.mode='rotate';
    const ring=handles.gizmo.picker.rotate.children.find(mesh=>mesh.name==='E');
    assert.ok(ring);
    const measure=()=>{
      const points=ring.geometry.getAttribute('position');
      let max=0,min=Infinity;
      for(let i=0;i<points.count;i++){
        const r=Math.hypot(points.getX(i),points.getY(i));
        min=Math.min(min,r);max=Math.max(max,r);
      }
      return max-min;
    };
    handles.size=.15;expandPicker(handles);const smallWidth=measure();
    handles.size=1.1;expandPicker(handles);const largeWidth=measure();
    handles.size=.15;expandPicker(handles);const again=measure();
    assert.ok(smallWidth>largeWidth,`small=${smallWidth}, large=${largeWidth}`);
    assert.ok(Math.abs(again-smallWidth)<1e-4,'picker expands repeatedly instead of starting from the original');
    handles.dispose();
  });
  test('saved gizmo size accepts tiny values down to .15',()=>{
    const config={gizmoSize:.2};
    globalThis.localStorage={getItem:k=>k==='svenstudio-controls-v2'?JSON.stringify(config):null,setItem(){},removeItem(){}};
    assert.equal(readControls().gizmoSize,.2);
    assert.equal(readControls().shortcuts.move,'KeyG');
  });
  test('choosing Move/Rotate/Scale exits Measure without clearing selection',()=>{
    useEditor.setState({measureMode:true,mode:'select',selected:'wall',selectedIds:['wall']});
    useEditor.getState().activateGizmoMode('rotate');
    assert.equal(useEditor.getState().measureMode,false);
    assert.equal(useEditor.getState().mode,'rotate');
    assert.deepEqual(useEditor.getState().selectedIds,['wall']);
  });
  test('brush/entity/ground pointerdown checks picker before selection',()=>{
    const source=fs.readFileSync('src/components/Viewport.tsx','utf8');
    assert.ok(source.includes('hitTransformPicker(controls.current,camera'));
    assert.ok(source.includes('if(pointerOnSelectedGizmo(e)){e.stopPropagation();return;}'));
    assert.ok((source.match(/pointerOnSelectedGizmo\(e\)/g)||[]).length>=4);
    assert.ok(source.includes('size={Math.max(0.15,settings.gizmoSize)}'));
    assert.ok(source.includes('size={Math.max(0.15,controlsConfig.gizmoSize)}'));
    assert.ok(!source.includes('Math.max(1.25,settings.gizmoSize)'));
  });
  console.log(`PASS gizmo v0.8.9.6: ${checks} checks`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
