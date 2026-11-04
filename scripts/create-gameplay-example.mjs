// Run: node scripts/create-gameplay-example.mjs
// Generate an editable example project and valid Valve 220 source map.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(),temp=fs.mkdtempSync(path.join(root,'.example-'));
try{
 for(const file of ['src/engine/types.ts','src/engine/entityAppearance.ts','src/engine/controls.ts','src/engine/geometry.ts','src/engine/exportMap.ts','src/engine/importMap.ts','src/engine/fgd.ts','src/engine/modeling.ts','src/engine/advancedModeling.ts','src/engine/prefabs.ts','src/engine/gameplay.ts','src/engine/npc.ts','src/i18n.ts','src/engine/environment.ts','src/store.ts']){
  const out=path.join(temp,file.replace(/\.ts$/,'.js'));
  fs.mkdirSync(path.dirname(out),{recursive:true});
  const js=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  fs.writeFileSync(out,js);
 }
 fs.writeFileSync(path.join(temp,'package.json'),' {"type":"commonjs"}\n');
 const require=createRequire(path.join(temp,'script.cjs'));
 const store=require('./src/store.js'),exportMap=require('./src/engine/exportMap.js');
 store.useEditor.getState().addGameplayDemo();
 const project={...store.useEditor.getState().project,name:'Gameplay Demo - Button Relay Door'};
 const issues=exportMap.validateProject(project);
 if(issues.length)throw Error(issues.join('\n'));
 fs.writeFileSync(path.join(root,'examples','gameplay_button_relay_door.svenstudio.json'),JSON.stringify(project,null,2));
 fs.writeFileSync(path.join(root,'examples','gameplay_button_relay_door.map'),exportMap.exportMap(project));
 console.log('PASS: generated editable Gameplay Studio example and Valve 220 .MAP');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
