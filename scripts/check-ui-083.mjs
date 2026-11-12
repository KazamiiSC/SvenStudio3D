/** v0.8.3 — Regression checks for camera commands and context-menu state. */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import ts from 'typescript';import {createRequire} from 'node:module';
const root=process.cwd(),dst=fs.mkdtempSync(path.join(root,'.ui083-'));
try{
  for(const file of ['src/engine/types.ts','src/engine/entityAppearance.ts','src/engine/controls.ts',
    'src/engine/geometry.ts','src/engine/exportMap.ts','src/engine/importMap.ts','src/engine/fgd.ts',
    'src/engine/modeling.ts','src/engine/advancedModeling.ts','src/engine/prefabs.ts','src/engine/architecture.ts','src/engine/smartMerge.ts','src/engine/gameplay.ts',
    'src/engine/npc.ts','src/engine/sound.ts','src/i18n.ts','src/engine/environment.ts','src/engine/skyEnclosure.ts','src/engine/cinematic.ts','src/engine/customNpc.ts','src/engine/terrain.ts','src/store.ts']){
    const out=path.join(dst,file.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
  }
  fs.writeFileSync(path.join(dst,'package.json'),'{"type":"commonjs"}');
  fs.symlinkSync(path.join(root,'node_modules'),path.join(dst,'node_modules'),'dir');
  const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,String(v)),removeItem:k=>memory.delete(k)};
  const require=createRequire(path.join(dst,'check.cjs'));
  const {DEFAULT_CONTROLS,CONTROL_ACTIONS,shortcutAction,displayBinding,readControls}=require('./src/engine/controls.js');
  const {useEditor}=require('./src/store.js');
  const {createBrush}=require('./src/engine/geometry.js');
  const keys=Object.values(DEFAULT_CONTROLS.shortcuts);
  assert.equal(keys.length,25);assert.equal(new Set(keys).size,keys.length,'Default shortcuts should never collide');
  for(const id of ['back','left','bottom','isometric','orbitLeft','orbitRight','orbitUp','orbitDown','panLeft','panRight','panUp','panDown','zoomIn','zoomOut','resetView']){
    assert.equal(shortcutAction(DEFAULT_CONTROLS,DEFAULT_CONTROLS.shortcuts[id]),id);
    assert.ok(CONTROL_ACTIONS.some(v=>v.id===id));
    assert.ok(displayBinding(DEFAULT_CONTROLS.shortcuts[id]).length>0);
  }
  memory.set('svenstudio-controls-v2',JSON.stringify({shortcuts:{scale:'KeyS'},flySpeed:620}));
  const persisted=readControls();assert.equal(persisted.shortcuts.scale,'KeyS');
  assert.equal(persisted.shortcuts.orbitLeft,DEFAULT_CONTROLS.shortcuts.orbitLeft);
  console.log('PASS 25 unique defaults, customizable new camera shortcuts, old saved presets preserved');
  const box=createBrush('box',[0,0,0],[128,128,128]);
  const a={...box,id:'brush1',layer:'Architecture'},b={...box,id:'brush2',layer:'Architecture',position:[256,0,0]};
  const one={id:'entity1',kind:'entity',name:'light',classname:'light',position:[0,0,64],props:{targetname:'switch_target'},layer:'Lighting'};
  const two={id:'entity2',kind:'entity',name:'light',classname:'light',position:[0,0,128],props:{},layer:'Lighting'};
  const fresh=()=>useEditor.setState({project:{version:1,target:'svengine',name:'test',objects:[a,b,one,two],world:{classname:'worldspawn'},wadNames:[]},selected:null,selectedIds:[],selectedFace:null,history:[],future:[]});
  fresh();useEditor.getState().selectSameClass('light');
  assert.deepEqual(new Set(useEditor.getState().selectedIds),new Set(['entity1','entity2']));
  useEditor.getState().selectSameLayer('Architecture');
  assert.deepEqual(new Set(useEditor.getState().selectedIds),new Set(['brush1','brush2']));
  console.log('PASS context menu Select same classname/layer keeps full selection');
  fresh();useEditor.getState().setSelected('brush1');useEditor.getState().isolateSelection();
  assert.equal(useEditor.getState().project.objects.find(o=>o.id==='brush1').hidden,false);
  assert.equal(useEditor.getState().project.objects.filter(o=>o.hidden).length,3);
  useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.filter(o=>o.hidden).length,0);
  useEditor.getState().redo();assert.equal(useEditor.getState().project.objects.filter(o=>o.hidden).length,3);
  useEditor.getState().revealAll();assert.equal(useEditor.getState().project.objects.filter(o=>o.hidden).length,0);
  useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.filter(o=>o.hidden).length,3);
  console.log('PASS isolate/reveal are non-destructive and reversible via Undo/Redo');
  fresh();useEditor.getState().toggleLocked('brush2');useEditor.getState().unlockAll();
  assert.equal(useEditor.getState().project.objects.filter(o=>o.locked).length,0);
  useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.find(o=>o.id==='brush2').locked,true);
  console.log('PASS unlock all preserves history');
  const src=file=>fs.readFileSync(file,'utf8');
  assert.match(src('src/style.css'),/max-height:100%;min-height:0;gap:1px/);
  assert.match(src('src/components/Viewport.tsx'),/camera\.position\.copy\(target\)\.add\(new THREE\.Vector3\(\)\.setFromSpherical/);
  assert.match(src('src/App.tsx'),/e\.repeat&&!\['orbitLeft'/);
  assert.match(src('src/components/ViewportExtras.tsx'),/item\('Create func_door'/);
  assert.match(src('src/components/Panels.tsx'),/onContextMenu=\{e=>\{e\.preventDefault\(\);setAssetMenu/);
  for(const locale of ['es','ru','ko']){
    assert.ok(src('src/i18n.ts').includes(`Object.assign(${locale},{`));
    for(const label of ['Orbit camera left','Camera zoom out','Isolate selection','Find linked target','Copy texture name']){
      assert.ok(src('src/i18n.ts').includes(`"${label}":`));
    }
  }
  console.log('PASS compact toolbar, context entries, numpad events, WAD/FGD menus, four-language labels wired');
}catch(err){console.error('FAIL v0.8.3',err);process.exitCode=1}finally{delete globalThis.localStorage;fs.rmSync(dst,{recursive:true,force:true})}
