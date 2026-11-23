import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile,symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {documentsRoot,studioDirectory,studioFolders,validStudioFilename,saveStudioFile,listStudioFiles,readStudioFile} from '../server/studioDocuments.js';

const src=async file=>readFile(new URL('../'+file,import.meta.url),'utf8');

test('Documents root is per-user and accepts redirected Documents',()=>{
 assert.equal(documentsRoot({home:'/users/demo'}),path.join('/users/demo','Documents','SvenStudio3D')); // platform separator
 assert.equal(documentsRoot({documents:'/OneDrive/Documentos'}),path.join('/OneDrive/Documentos','SvenStudio3D'));
});
test('Organized directories and safe versioned document saves',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'sven-hf6-docs-'));
 try{
  const original=await saveStudioFile({category:'projects',filename:'my_map.svenstudio.json',bytes:Buffer.from('{"a":1}')},{root});
  const newVersion=await saveStudioFile({category:'projects',filename:'my_map.svenstudio.json',bytes:Buffer.from('{"a":2}')},{root});
  assert.equal(original.filename,'my_map.svenstudio.json');
  assert.equal(newVersion.filename,'my_map_2.svenstudio.json');
  assert.notEqual(original.path,newVersion.path);
  assert.deepEqual(await readStudioFile('projects','my_map.svenstudio.json',{root}),Buffer.from('{"a":1}'));
  assert.deepEqual(await readStudioFile('projects','my_map_2.svenstudio.json',{root}),Buffer.from('{"a":2}'));
  assert.equal((await listStudioFiles('projects',{root})).length,2);
  for(const [category,file] of [['prefabs','door.svprefab'],['maps','level.map'],['exports','door.wad']]){
   const result=await saveStudioFile({category,filename:file,bytes:Buffer.from('data')},{root});
   assert.equal(path.dirname(result.path),path.join(root,{prefabs:'Prefabs',maps:'Maps',exports:'Exports'}[category]));
  }
  assert.equal(await studioDirectory('builds',true,root),path.join(root,'Builds'));
 }finally{await rm(root,{recursive:true,force:true})}
});
test('Reject traversal, invalid extensions, excessive data and symlink redirection',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'sven-hf6-safe-'));
 const external=await mkdtemp(path.join(os.tmpdir(),'sven-hf6-foreign-'));
 try{
  for(const bad of ['../outside.map','C:\\oops.map','..\\outside.map','test.exe','a..b.map','.map','some/name.map']){
   assert.equal(validStudioFilename('maps',bad),false,bad);
   await assert.rejects(saveStudioFile({category:'maps',filename:bad,bytes:Buffer.from('hi')},{root}));
  }
  await assert.rejects(saveStudioFile({category:'unknown',filename:'a.map',bytes:Buffer.from('hello')},{root}));
  await assert.rejects(saveStudioFile({category:'maps',filename:'a.map',bytes:Buffer.alloc(0)},{root}));
  await symlink(external,path.join(root,'Maps'),'junction'); // junctions are reparse points too and need no admin rights
  await assert.rejects(saveStudioFile({category:'maps',filename:'a.map',bytes:Buffer.from('hello')},{root}),/Unsafe/);
  await assert.rejects(readStudioFile('maps','a.map',{root}),/Unsafe/);
 }finally{await Promise.all([rm(root,{recursive:true,force:true}),rm(external,{recursive:true,force:true})])}
});
test('CLEAN is one literal label in all six languages',async()=>{
 const app=await src('src/App.tsx'),reset=await src('src/components/StudioResetDialog.tsx');
 assert.match(app,/CLEAN<\/MenuButton>/);
 assert.equal((reset.match(/title:'CLEAN · SvenStudio 3D'/g)||[]).length,6);
 assert.equal((reset.match(/action:'CLEAN'/g)||[]).length,6);
 assert.match(reset,/typed!=='CLEAN'/);
});
test('New project resets project-specific settings but keeps installed SDK directories',async()=>{
 const store=await src('src/store.ts');
 assert.match(store,/newProject:\(\)=>set\(s=>\{/);
 for(const marker of ["mapName:''","wadPaths:''","smartWadName:''","resourceRoots:[]","distributionDir:''","project:s.settings.gameProfile==='cs16'?{...emptyProject(),target:'cs16'}:demoProject()","textureAssets:s.textureAssets.filter(t=>/svstudio\\.wad$/i.test(t.wad))"]){assert.ok(store.includes(marker),marker)}
 assert.match(store,/const settings=\{\.\.\.s.settings/);
 const app=await src('src/App.tsx');
 assert.match(app,/newProject\(\);setLastCompiled\(null\)/);
});
test('Native Windows browser and per-user build path are wired',async()=>{
 const picker=await src('src/components/LocalFolderPicker.tsx');
 const server=await src('server/index.js');
 const builder=await src('server/isolatedBuild.js');
 assert.match(picker,/\/api\/setup\/native-folder/);
 assert.match(server,/pickWindowsFolder/);
 assert.match(builder,/studioDirectory\('builds',true\)/);
 assert.match(server,/distributionDir\|\|await studioDirectory\('builds',true\)/);
});
