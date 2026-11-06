/** Integration test for custom classes that don't start monster_. */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import ts from 'typescript';
import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const root=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-custom-npc-state-'));
try{
 const files=['src/engine/types.ts','src/engine/customNpc.ts','src/engine/entityAppearance.ts','src/engine/controls.ts','src/engine/geometry.ts','src/engine/exportMap.ts','src/engine/importMap.ts','src/engine/projectValidation.ts','src/engine/fgd.ts','src/engine/modeling.ts','src/engine/advancedModeling.ts','src/engine/prefabs.ts','src/engine/gameplay.ts','src/engine/npc.ts','src/engine/sound.ts','src/i18n.ts','src/engine/environment.ts','src/engine/skyEnclosure.ts','src/engine/architecture.ts','src/engine/smartMerge.ts','src/engine/cinematic.ts','src/engine/terrain.ts','src/store.ts'];
 for(const file of files){const out=path.join(temp,file.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)}
 fs.writeFileSync(path.join(temp,'package.json'),'{"type":"commonjs"}');fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'));
 const req=createRequire(path.join(temp,'main.cjs'));
 const {useEditor,demoProject}=req('./src/store.js');const {customNpcToFgd}=req('./src/engine/customNpc.js');const {exportMap}=req('./src/engine/exportMap.js');const {validateProjectFile}=req('./src/engine/projectValidation.js');
 const def={classname:'custom_gorilla',description:'Gorilla',modelPath:'models/custom/gorilla.mdl',entryScript:'mods/gorilla.as',registerFunction:'RegisterGorilla',scripts:[{path:'mods/gorilla.as',source:'void RegisterGorilla() { g_CustomEntityFuncs.RegisterCustomEntity("Gorilla", "custom_gorilla"); }'}]};
 useEditor.setState({project:demoProject(),history:[],future:[],fgdClasses:[]});
 const initial=exportMap(useEditor.getState().project);
 useEditor.getState().registerCustomNpc(def);
 assert.equal(useEditor.getState().project.customNpcs[0].classname,'custom_gorilla');
 assert.equal(exportMap(useEditor.getState().project),initial,'registering definition should not alter MAP');
 useEditor.getState().startNpcPlacement('custom_gorilla');useEditor.getState().placePendingNpc([55,66,77]);
 assert.ok(useEditor.getState().project.objects.some(e=>e.kind==='entity'&&e.classname==='custom_gorilla'));
 const project=structuredClone(useEditor.getState().project);assert.deepEqual(validateProjectFile(project).customNpcs[0],def);
 const map=exportMap(project);assert.match(map,/"classname" "custom_gorilla"/);
 useEditor.getState().setFgd([]);assert.equal(useEditor.getState().project.customNpcs.length,1);
 useEditor.getState().loadProject(project);assert.equal(useEditor.getState().project.customNpcs.length,1);
 useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.filter(o=>o.kind==='entity'&&o.classname==='custom_gorilla').length,1);
 const fgd=customNpcToFgd(def);assert.equal(fgd.type,'point');assert.equal(fgd.name,'custom_gorilla');
 useEditor.getState().removeCustomNpc('custom_gorilla');assert.ok(!useEditor.getState().project.customNpcs.length);
 assert.ok(useEditor.getState().project.objects.some(e=>e.kind==='entity'&&e.classname==='custom_gorilla'),'removing library item must preserve placed entity');
 useEditor.getState().undo();assert.equal(useEditor.getState().project.customNpcs[0].classname,'custom_gorilla');
 console.log('PASS Custom NPC state: import, non-monster classname placement, persisted metadata, MAP export, Undo, FGD reload and non-destructive removal.');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
