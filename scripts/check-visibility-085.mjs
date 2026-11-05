/** Independent visibility and compile UI regression checks (without Vite). */
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import ts from 'typescript';import {createRequire} from 'node:module';
const root=process.cwd(),dst=fs.mkdtempSync(path.join(root,'.visibility085-'));
try{
  for(const file of ['src/engine/types.ts','src/engine/entityAppearance.ts','src/engine/controls.ts','src/engine/geometry.ts','src/engine/exportMap.ts','src/engine/importMap.ts','src/engine/fgd.ts','src/engine/modeling.ts','src/engine/advancedModeling.ts','src/engine/architecture.ts','src/engine/smartMerge.ts','src/engine/prefabs.ts','src/engine/gameplay.ts','src/engine/npc.ts','src/engine/sound.ts','src/engine/environment.ts','src/engine/skyEnclosure.ts','src/i18n.ts','src/store.ts']){
    const out=path.join(dst,file.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
  }
  fs.writeFileSync(path.join(dst,'package.json'),'{'+'"type":"commonjs"'+'}');fs.symlinkSync(path.join(root,'node_modules'),path.join(dst,'node_modules'),'dir');
  const kv=new Map();globalThis.localStorage={getItem:k=>kv.get(k)||null,setItem:(k,v)=>kv.set(k,String(v))};
  const require=createRequire(path.join(dst,'check.cjs'));
  const {useEditor}=require('./src/store.js');const {createBrush}=require('./src/engine/geometry.js');const {exportMap}=require('./src/engine/exportMap.js');
  const a=createBrush('box',[0,0,0],[128,128,128]);const b=createBrush('box',[256,0,0],[128,128,128]);b.hidden=true;
  useEditor.getState().loadProject({version:1,target:'svengine',name:'Test',world:{classname:'worldspawn',mapversion:'220'},wadNames:[],objects:[a,b]});
  const before=exportMap(useEditor.getState().project,[]);useEditor.getState().toggleGhostHidden();assert.equal(useEditor.getState().ghostHidden,true);assert.equal(exportMap(useEditor.getState().project,[]),before);
  useEditor.getState().toggleVisibility(b.id);assert.equal(useEditor.getState().project.objects.find(o=>o.id===b.id).hidden,false);useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.find(o=>o.id===b.id).hidden,true);
  useEditor.getState().setSelected(a.id);useEditor.getState().toggleTemporaryIsolation();assert.equal(useEditor.getState().project.objects.find(o=>o.id===b.id).hidden,true);useEditor.getState().toggleTemporaryIsolation();assert.equal(useEditor.getState().project.objects.find(o=>o.id===b.id).hidden,true);
  useEditor.getState().hideSelection();assert.equal(useEditor.getState().project.objects.every(o=>o.hidden),true);useEditor.getState().revealAll();assert.equal(useEditor.getState().project.objects.some(o=>o.hidden),false);
  const src=f=>fs.readFileSync(f,'utf8');assert.match(src('src/App.tsx'),/setDialog\('output'\);setCompileBusy\(true\)/);assert.match(src('src/components/DockWorkspace.tsx'),/id!=='console'/);assert.match(src('src/components/Viewport.tsx'),/GhostBrush/);
  for(const lang of ['es','ru','ko'])assert.match(src('src/i18n.ts'),new RegExp(`Object.assign\\(${lang},\\{[\\s\\S]*?'Visibility manager'`));
  console.log('PASS visibility, ghost no-export, isolation restore, undo, output dialog and languages');
}catch(err){console.error(err);process.exitCode=1}finally{fs.rmSync(dst,{recursive:true,force:true});delete globalThis.localStorage}
