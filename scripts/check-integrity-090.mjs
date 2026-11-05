/** Pre-1.0 safety gate: imported MAP/JSON must not silently drop objects. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import ts from 'typescript';
const root=process.cwd(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-integrity-090-'));
try{
  fs.mkdirSync(path.join(tmp,'engine'),{recursive:true});
  fs.symlinkSync(path.join(root,'node_modules'),path.join(tmp,'node_modules'),'dir');
  for(const name of ['types','geometry','importMap','projectValidation','paths','sessionRecovery']){
    const source=fs.readFileSync(path.join(root,'src/engine',name+'.ts'),'utf8');
    fs.writeFileSync(path.join(tmp,'engine',name+'.js'),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText);
  }
  const req=createRequire(path.join(tmp,'test.cjs'));
  const {inspectMapImport,importMap}=req('./engine/importMap.js');
  const {validateProjectFile}=req('./engine/projectValidation.js');
  const {readProject}=req('./engine/paths.js');
  const recovery=req('./engine/sessionRecovery.js');
  const files=fs.readdirSync(path.join(root,'examples')).filter(name=>/\.map$/i.test(name));
  let loaded=0;
  for(const name of files){
    const text=fs.readFileSync(path.join(root,'examples',name),'utf8');
    const result=inspectMapImport(text,name);
    assert.equal(result.report.skippedBrushes,0,`${name} should not lose geometry`);
    assert.equal(result.report.importedBrushes,result.report.totalBrushes);
    const project=validateProjectFile(importMap(text,name));
    assert.ok(project.objects.length>=result.report.totalBrushes);
    loaded++;
  }
  const projectFiles=fs.readdirSync(path.join(root,'examples')).filter(name=>name.endsWith('.svenstudio.json'));
  for(const filename of projectFiles){
    const parsed=JSON.parse(fs.readFileSync(path.join(root,'examples',filename),'utf8'));
    validateProjectFile(parsed);
  }
  // Corrupt one plane in the known-good starter room. The public importer must throw.
  const good=fs.readFileSync(path.join(root,'examples','starter_room.map'),'utf8');
  const corrupted=good.replace(/\(\s*-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s*\)/,'( broken plane )');
  assert.notEqual(corrupted,good,'the fixture must contain a MAP plane');
  const inspection=inspectMapImport(corrupted,'broken.map');
  assert.ok(inspection.report.skippedBrushes>=1,'a malformed plane must not silently disappear');
  assert.ok(inspection.report.skippedLocations.length>=1);
  assert.throws(()=>importMap(corrupted,'broken.map'),/incomplete/);
  assert.throws(()=>importMap(good.slice(0,-5),'truncated.map'),/Incomplete MAP/);
  const baseline=validateProjectFile(importMap(good,'starter_room.map'));
  assert.throws(()=>validateProjectFile({...baseline,objects:[{kind:'brush'}]}),/Invalid project/);
  assert.throws(()=>validateProjectFile({...baseline,objects:[{...baseline.objects[0],position:[NaN,0,0]}]}),/Invalid project/);
  assert.throws(()=>validateProjectFile({...baseline,objects:[...baseline.objects,baseline.objects[0]]}),/duplicate object ID/);
  assert.throws(()=>validateProjectFile({...baseline,target:'source-engine'}),/only Sven Co-op/);
  assert.throws(()=>validateProjectFile({...baseline,objects:[{...baseline.objects.find(o=>o.kind==='brush'),faces:[{indices:[0,0,900],texture:'BAD'}]}]}),/Invalid project/);
  assert.equal((await readProject({size:1024,text:async()=>JSON.stringify(baseline)})).objects.length,baseline.objects.length);
  await assert.rejects(()=>readProject({size:1024,text:async()=>'{invalid JSON'}),/JSON is not valid/);
  await assert.rejects(()=>readProject({size:64*1024*1024+1,text:async()=>''}),/64 MB/);
  // Checkpoint fallback if IndexedDB is restricted; the previous project stays readable.
  const store=new Map();globalThis.indexedDB=undefined;
  globalThis.localStorage={getItem:key=>store.get(key)??null,setItem:(key,val)=>store.set(key,val),removeItem:key=>store.delete(key)};
  const snapshot={version:1,savedAt:Date.now(),project:baseline,view:{selected:null,selectedIds:[],selectedFace:null,geometryMode:'object',resourceView:'objects',snap:16,snapping:true}};
  await recovery.queueRecoveryBackup(snapshot);
  assert.deepEqual(await recovery.readRecoveryBackup(),snapshot);
  assert.equal(await recovery.readRecoveredSession(),null,'checkpoint should not replace autosaved latest');
  console.log(`PASS v0.9.0 integrity: ${loaded} MAP fixtures + ${projectFiles.length} project fixtures, malformed brush rejection, JSON validation, explicit recovery backup`);
}finally{fs.rmSync(tmp,{recursive:true,force:true});}
