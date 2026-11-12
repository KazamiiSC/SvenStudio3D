import ts from 'typescript';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const dir=await fs.mkdtemp(path.resolve('.interactive-087-'));
try{
 const names=['types','geometry','exportMap','importMap','modeling','advancedModeling','architecture','smartMerge'];
 for(const name of names){
  const source=await fs.readFile(path.resolve('src/engine',name+'.ts'),'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
   .replace(/from ['"]\.\/(\w+)['"]/g,(all,dep)=>names.includes(dep)?`from './${dep}.mjs'`:all);
  await fs.writeFile(path.join(dir,name+'.mjs'),code);
 }
 const mod=async name=>import(pathToFileURL(path.join(dir,name+'.mjs')).href);
 const {createBrush}=await mod('geometry');
 const {createArchitecture,defaultArchitecture}=await mod('architecture');
 const {mergeIntoConvexBrush}=await mod('smartMerge');
 const {validateProject,exportMap}=await mod('exportMap');
 const {importMap}=await mod('importMap');
 const spawn={id:'spawn',kind:'entity',name:'Spawn',classname:'info_player_start',position:[0,0,0],props:{}};
 const wall=createBrush('box',[0,0,144],[512,32,288],'Wall');
 for(const [kind,center] of [['door',[112,0,90]],['window',[-112,0,185]]]){
  const result=createArchitecture(kind,defaultArchitecture,wall,'BRICK',{center});
  assert.equal(result.removeId,wall.id);
  assert.ok(result.objects.length>=6);
  const project={version:1,target:'svengine',name:'placement',objects:[...result.objects,spawn],world:{classname:'worldspawn',mapversion:'220'},wadNames:[]};
  assert.deepEqual(validateProject(project),[]);
  assert.deepEqual(validateProject(importMap(exportMap(project),'placement.map')),[]);
  assert.throws(()=>createArchitecture(kind,defaultArchitecture,wall,'BRICK',{center:[254,0,145]}));
  console.log('PASS',kind,'off-center cut and reject outside wall');
 }
 const a=createBrush('box',[0,0,0],[64,64,64],'A');
 const b=createBrush('box',[64,0,0],[64,64,64],'B');
 const merged=mergeIntoConvexBrush([a,b]);
 assert.deepEqual(validateProject({version:1,name:'merge',objects:[merged,spawn],world:{classname:'worldspawn',mapversion:'220'},wadNames:[]}),[]);
 const c=createBrush('box',[64,32,0],[64,64,64],'C');
 assert.throws(()=>mergeIntoConvexBrush([a,c]),/concave|disconnected/i);
 const d=createBrush('box',[300,0,0],[64,64,64],'D');
 assert.throws(()=>mergeIntoConvexBrush([a,d]),/concave|disconnected/i);
 console.log('PASS merge adjacent convex blocks; reject concave and disconnected');
}finally{await fs.rm(dir,{recursive:true,force:true})}
