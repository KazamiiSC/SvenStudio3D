import ts from 'typescript';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const folder=await fs.mkdtemp(path.resolve('.doctor-solid-check-'));
try{
 const names=['types','geometry','exportMap','mapDiagnostics'];
 for(const name of names){
  const source=await fs.readFile(path.resolve('src/engine',name+'.ts'),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
   .replace(/from ['"]\.\/(\w+)['"]/g,(all,dep)=>names.includes(dep)?`from './${dep}.mjs'`:all);
  await fs.writeFile(path.join(folder,`${name}.mjs`),code);
 }
 const {createBrush}=await import(pathToFileURL(path.join(folder,'geometry.mjs')).href);
 const {analyzeMap}=await import(pathToFileURL(path.join(folder,'mapDiagnostics.mjs')).href);
 const sky=createBrush('box',[0,0,128],[1200,1200,768],'Massive Sky Cube');
 sky.faces=sky.faces.map(face=>({...face,texture:'SKY'}));
 const spawn={id:'start',kind:'entity',name:'Start',classname:'info_player_start',position:[0,0,48],props:{}};
 const project={version:1,target:'svengine',name:'sky-test',world:{classname:'worldspawn',skyname:'desert'},wadNames:[],objects:[sky,spawn]};
 const issue=analyzeMap(project).issues.find(x=>x.code==='SOLID_SKY_SPACE');
 assert.equal(issue?.objectId,sky.id);
 assert.equal(issue?.params.classname,'info_player_start');
 const moved={...spawn,position:[3000,0,64]};
 assert.equal(analyzeMap({...project,objects:[sky,moved]}).issues.some(x=>x.code==='SOLID_SKY_SPACE'),false);
 const ordinary={...sky,faces:sky.faces.map(face=>({...face,texture:'SV_BRICK01'}))};
 assert.equal(analyzeMap({...project,objects:[ordinary,spawn]}).issues.some(x=>x.code==='SOLID_SKY_SPACE'),false);
 console.log('PASS Map Doctor solid SKY check: detects enclosed spawn, identifies brush, avoids unrelated brushes');
}finally{await fs.rm(folder,{recursive:true,force:true});}
