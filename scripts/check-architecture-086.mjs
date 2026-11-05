import ts from 'typescript';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const dir=await fs.mkdtemp(path.resolve('.architecture-check-'));
try {
  const names=['types','geometry','exportMap','importMap','modeling','advancedModeling','architecture'];
  for(const name of names){
    const source=await fs.readFile(path.resolve('src/engine',name+'.ts'),'utf8');
    const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
      .replace(/from ['"]\.\/(\w+)['"]/g,(all,dep)=>names.includes(dep)?`from './${dep}.mjs'`:all);
    await fs.writeFile(path.join(dir,name+'.mjs'),code);
  }
  const {createArchitecture,defaultArchitecture}=await import(pathToFileURL(path.join(dir,'architecture.mjs')).href);
  const {validateProject,exportMap}=await import(pathToFileURL(path.join(dir,'exportMap.mjs')).href);
  const {importMap}=await import(pathToFileURL(path.join(dir,'importMap.mjs')).href);
  const wall={id:'wall01',kind:'brush',name:'Wall',primitive:'box',position:[0,0,144],rotation:[0,0,0],scale:[1,1,1],layer:'Geometry',vertices:[[-256,-16,-144],[256,-16,-144],[256,16,-144],[-256,16,-144],[-256,-16,144],[256,-16,144],[256,16,144],[-256,16,144]],faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(indices=>({indices,texture:'BRICK'}))};
  const spawn={id:'spawn',kind:'entity',name:'Player Start',classname:'info_player_start',position:[1000,1000,100],props:{}};
  for(const kind of ['door','window']){
    const r=createArchitecture(kind,defaultArchitecture,wall,'BRICK');
    assert.equal(r.removeId,'wall01');assert.ok(r.objects.length>=6);
    assert.ok(r.objects.every(b=>b.kind==='brush'&&b.faces.length>=4));
    const project={version:1,target:'svengine',name:'architecture_test',objects:[...r.objects,spawn],world:{classname:'worldspawn',mapversion:'220'},wadNames:[]};
    assert.deepEqual(validateProject(project),[]);
    const map=exportMap(project);
    assert.deepEqual(validateProject(importMap(map,'architecture_test.map')),[]);
    console.log(kind,r.objects.length,'convex brush pieces');
  }
  for(const kind of ['frame','arch','stairs','ramp','column','room']){
    const r=createArchitecture(kind,defaultArchitecture,null,'BRICK');
    assert.ok(r.objects.length);
    const project={version:1,target:'svengine',name:'architecture_test',objects:[...r.objects,spawn],world:{classname:'worldspawn',mapversion:'220'},wadNames:[]};
    assert.deepEqual(validateProject(project),[]);
    assert.deepEqual(validateProject(importMap(exportMap(project),'architecture_test.map')),[]);
    console.log(kind,r.objects.length,'brushes');
  }
  assert.throws(()=>createArchitecture('door',{...defaultArchitecture,width:800},wall));
  assert.throws(()=>createArchitecture('window',defaultArchitecture,{...wall,rotation:[0,0,45]}));
  console.log('Quick Architecture 10/10 checks passed');
}finally{await fs.rm(dir,{recursive:true,force:true})}
