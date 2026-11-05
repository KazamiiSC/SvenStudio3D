/** Store-level guard tests: Player Walk never edits brushes or the export map. */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createRequire} from 'node:module';
const root=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-walk-state-'));
try{
  for(const file of [
    'src/engine/types.ts','src/engine/entityAppearance.ts','src/engine/controls.ts',
    'src/engine/geometry.ts','src/engine/exportMap.ts','src/engine/importMap.ts',
    'src/engine/fgd.ts','src/engine/modeling.ts','src/engine/advancedModeling.ts',
    'src/engine/architecture.ts','src/engine/smartMerge.ts','src/engine/prefabs.ts',
    'src/engine/gameplay.ts','src/engine/npc.ts','src/engine/sound.ts',
    'src/engine/environment.ts','src/engine/skyEnclosure.ts','src/i18n.ts','src/store.ts'
  ]){
    const source=fs.readFileSync(path.join(root,file),'utf8');
    const target=path.join(temp,file.replace(/\.ts$/,'.js'));
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
  }
  fs.writeFileSync(path.join(temp,'package.json'),JSON.stringify({type:'commonjs'}));
  fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
  const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k)};
  const require=createRequire(path.join(temp,'entry.cjs'));
  const {useEditor}=require('./src/store.js');
  const {exportMap}=require('./src/engine/exportMap.js');
  const store=useEditor.getState();
  const original=exportMap(store.project);
  assert.equal(store.walkMode,false,'Walk is off initially');
  store.toggleWalk();
  assert.equal(useEditor.getState().walkMode,true);
  assert.equal(useEditor.getState().flyMode,false);
  assert.equal(exportMap(useEditor.getState().project),original,'Walk must not mutate .map');
  useEditor.getState().toggleFly();
  assert.equal(useEditor.getState().walkMode,false,'Fly and Walk are exclusive');
  assert.equal(useEditor.getState().flyMode,true);
  useEditor.getState().setWalk(true);
  assert.equal(useEditor.getState().flyMode,false,'Walk turns off Fly');
  useEditor.getState().setWalk(false);
  assert.equal(exportMap(useEditor.getState().project),original);
  useEditor.getState().setWalk(true);
  useEditor.getState().activateGizmoMode('translate');
  assert.equal(useEditor.getState().walkMode,false,'Entering gizmo editing safely ends Walk session');
  useEditor.getState().setWalk(false);
  useEditor.getState().setMode('select');
  useEditor.getState().setWalk(true);
  const project=structuredClone(useEditor.getState().project);
  useEditor.getState().loadProject(project);
  assert.equal(useEditor.getState().walkMode,false,'Project loading ends Walk safely');
  console.log('PASS Player Walk state: independent from Fly, map unchanged, exit and project load.');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
