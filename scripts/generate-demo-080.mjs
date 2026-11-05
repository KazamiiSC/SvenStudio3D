import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import ts from 'typescript';
const root=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'sven-demo-080-'));
try{
 const files=['engine/types.ts','engine/geometry.ts','engine/exportMap.ts'];
 for(const f of files){const out=path.join(dir,f.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,ts.transpileModule(fs.readFileSync(path.join(root,'src',f),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)}
 fs.writeFileSync(path.join(dir,'package.json'),'{"type":"commonjs"}');fs.symlinkSync(path.join(root,'node_modules'),path.join(dir,'node_modules'),'dir');
 const {exportMap,validateProject}=createRequire(path.join(dir,'test.cjs'))('./engine/exportMap.js');
 const project=JSON.parse(fs.readFileSync('examples/professional_mapping_080.svenstudio.json','utf8'));
 const problems=validateProject(project);if(problems.length)throw Error(problems.join('; '));
 const map=exportMap(project);fs.writeFileSync('examples/professional_mapping_080.map',map);console.log('PASS v0.8 demo:',project.objects.length,'objects; map',map.length,'bytes');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
