// Generate an editable Svengine environment demonstration and its Valve 220 .map.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import ts from 'typescript';
import {createRequire} from 'node:module';import assert from 'node:assert/strict';
const root=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'svstudio-environment-example-'));
try {
 const files=['src/engine/types.ts','src/engine/geometry.ts','src/engine/exportMap.ts','src/engine/importMap.ts','src/engine/environment.ts'];
 for(const f of files){const output=path.join(temp,f.replace('.ts','.js'));fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,ts.transpileModule(fs.readFileSync(path.join(root,f),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)}
 fs.writeFileSync(path.join(temp,'package.json'),'{'+'"type":"commonjs"'+'}');fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'));
 const require=createRequire(path.join(temp,'generator.cjs'));const {makeEnvironment,validateEnvironment}=require('./src/engine/environment.js');
 const {exportMap,validateProject}=require('./src/engine/exportMap.js');const {importMap}=require('./src/engine/importMap.js');
 const project=JSON.parse(fs.readFileSync(path.join(root,'examples','starter_room.svenstudio.json'),'utf8'));
 project.target='svengine';project.name='Svengine Lighting & Environment Demo';
 const warm=makeEnvironment('light_spot',[-128,64,208],{_light:'255 184 109 440',_cone:'25',_cone2:'54',pitch:'-55',angles:'0 25 0'});
 const fog=makeEnvironment('env_fog',[0,0,96],{rendercolor:'105 123 172',iuser2:'128',iuser3:'1800',spawnflags:'0'});
 const sky=makeEnvironment('trigger_changesky',[128,96,64],{skyname:'desert',targetname:'sky_demo_switch'});
 project.objects.push(warm,fog,sky);
 assert.deepEqual(validateEnvironment(project.objects),[]);assert.deepEqual(validateProject(project),[]);
 const map=exportMap(project);const imported=importMap(map);
 assert.equal(imported.objects.filter(o=>o.kind==='entity'&&['light_spot','env_fog','trigger_changesky'].includes(o.classname)).length,3);
 fs.writeFileSync(path.join(root,'examples','lighting_environment_demo.svenstudio.json'),JSON.stringify(project,null,2));
 fs.writeFileSync(path.join(root,'examples','lighting_environment_demo.map'),'// SvenStudio 3D v0.6.4 Lighting Environment Demo\n'+map);
 console.log('PASS: environment demo project + Svengine MAP exported and reimported.');
}finally {fs.rmSync(temp,{recursive:true,force:true})}
