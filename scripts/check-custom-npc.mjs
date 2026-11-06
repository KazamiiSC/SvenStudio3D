/** Custom NPC importer — additive map-script packaging, project persistence, MAP regression. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const root=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-custom-npc-'));
let passed=0;const test=(label,fn)=>{fn();passed++;console.log('PASS '+label)};
try{
  const sources=['src/engine/customNpc.ts','src/engine/types.ts','src/engine/fgd.ts','src/engine/terrain.ts','src/engine/projectValidation.ts','src/engine/exportMap.ts'];
  for(const file of sources){const out=path.join(temp,file.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)}
  const req=createRequire(path.join(temp,'entry.cjs'));
  const npc=req('./src/engine/customNpc.js'),{validateProjectFile}=req('./src/engine/projectValidation.js');
  const sample={classname:'monster_gorilla',description:'Scripted gorilla',modelPath:'models/custom/gorilla.mdl',entryScript:'custom/gorilla.as',registerFunction:'RegisterGorilla',scripts:[{path:'custom/gorilla.as',source:'class CGorilla {}\nvoid RegisterGorilla() { g_CustomEntityFuncs.RegisterCustomEntity("CGorilla", "monster_gorilla"); }'}]};
  test('Detect literal custom monster classname and registration function',()=>{
    assert.deepEqual(npc.registeredCustomClassnames(sample.scripts),['monster_gorilla']);assert.ok(npc.possibleRegistrationFunctions(sample.scripts[0].source).includes('RegisterGorilla'));
    assert.deepEqual(npc.validateCustomNpc(sample),[]);
  });
  test('Generate bootstrapping MapInit without mutating user script',()=>{
    const before=structuredClone(sample);const result=npc.customNpcFiles(sample,'my_map');assert.deepEqual(sample,before);
    assert.equal(result.mapScript,'custom/svenstudio_monster_gorilla_bootstrap');
    const wrapped=new TextDecoder().decode(result.files.find(x=>x.path.endsWith('bootstrap.as')).bytes);
    assert.match(wrapped,/#include "gorilla"/);assert.match(wrapped,/RegisterGorilla\(\);/);
    assert.ok(result.files.some(x=>x.path==='scripts/maps/custom/gorilla.as'));
    assert.ok(result.files.some(x=>x.path==='maps/my_map.cfg.ADD_THIS_LINE.txt'));
    assert.ok(result.files.every(x=>x.path!=='maps/my_map.cfg'));
  });
  test('Existing entry MapInit remains unchanged; no duplicate generated MapInit',()=>{
    const withInit={...sample,registerFunction:'',scripts:[{path:sample.entryScript,source:'void MapInit() { RegisterGorilla(); }'}]};
    const res=npc.customNpcFiles(withInit,'map2');assert.equal(res.mapScript,'custom/gorilla');assert.ok(!res.files.some(x=>x.path.endsWith('bootstrap.as')));
  });
  test('File paths reject traversal and unsafe directories',()=>{
    for(const path of ['../../escape.as','models/../evil.mdl','a//b.as','C:/evil.as'])assert.throws(()=>npc.cleanPackagePath(path));
    assert.equal(npc.assetRelativePath('Mod/models/custom/gorilla.mdl'),'models/custom/gorilla.mdl');
    assert.throws(()=>npc.assetRelativePath('system/virus.exe'));
    assert.equal(npc.scriptRelativePath('MyMod/scripts/maps/gorilla/main.as'),'gorilla/main.as');
  });
  test('Native ZIP headers, uniqueness and optional binary resource preservation',()=>{
    const res=npc.customNpcFiles(sample,'map3',[{path:'models/custom/gorilla.mdl',bytes:Uint8Array.from([0,1,2,3,255])}]);
    const mdl=res.files.find(x=>x.path==='models/custom/gorilla.mdl');assert.deepEqual([...mdl.bytes],[0,1,2,3,255]);
    assert.throws(()=>npc.customNpcFiles(sample,'map3',[{path:'scripts/maps/custom/gorilla.as',bytes:new Uint8Array(2)}]));
    const zip=npc.makeZip(res.files);assert.ok(zip.size>50);assert.equal(zip.type,'application/zip');
  });
  test('Project v1 validates embedded NPC metadata without changing existing objects',()=>{
    const original={version:1,target:'svengine',name:'Test',world:{classname:'worldspawn'},wadNames:[],objects:[{id:'npc1',kind:'entity',name:'monster_gorilla',classname:'monster_gorilla',position:[0,0,32],props:{targetname:'gorilla'}}]};
    const old=validateProjectFile(original);const withCustom=validateProjectFile({...original,customNpcs:[sample]});
    assert.deepEqual(withCustom.objects,old.objects);assert.equal(withCustom.customNpcs[0].classname,'monster_gorilla');
    assert.throws(()=>validateProjectFile({...original,customNpcs:[sample,sample]}));
  });
  test('Custom class converts to FGD point entity without renaming classname',()=>{
    const fgd=npc.customNpcToFgd(sample);assert.equal(fgd.name,sample.classname);assert.equal(fgd.type,'point');assert.equal(fgd.studio,sample.modelPath);assert.equal(fgd.props.model,undefined,'model path must not be forced into AngelScript keyvalues');
  });
  console.log(`Custom NPC import: ${passed}/${passed} checks passed.`);
}finally{fs.rmSync(temp,{recursive:true,force:true})}
