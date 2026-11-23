import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHistorySnapshot,listHistory,readHistorySnapshot,historyDirectory} from '../server/projectHistory.js';
const sample=(name='demo',n=1)=>({version:1,target:'svengine',name,
 objects:Array.from({length:n},(_,i)=>({id:`b-${i}`,kind:'brush',name:`brush${i}`,primitive:'box',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices:[],faces:[]})),
 world:{skyname:'desert'},wadNames:['halflife.wad']});
async function sandbox(fn){const root=await fs.mkdtemp(path.join(os.tmpdir(),'sven-hf14-'));try{await fn(root)}finally{await fs.rm(root,{recursive:true,force:true})}}

test('manual snapshots are immutable, listable, and restore the exact project',async()=>sandbox(async root=>{
 const project=sample('room',3);const created=await createHistorySnapshot({project,kind:'manual',label:'Before stairs'},{root});
 assert.equal(created.saved,true);assert.equal(created.entry.objects,3);
 const folder=await historyDirectory({root});
 assert.equal((await fs.readdir(folder)).length,2);
 const entries=await listHistory({root});assert.equal(entries[0].label,'Before stairs');
 const restored=await readHistorySnapshot(created.entry.id,{root});assert.deepEqual(restored.project,project);
 const second=await createHistorySnapshot({project,kind:'manual',label:'Second save'},{root});
 assert.notEqual(second.entry.id,created.entry.id);
 assert.deepEqual((await readHistorySnapshot(created.entry.id,{root})).project,project);
}));

test('automatic unchanged checkpoints are deduplicated, changed ones are preserved',async()=>sandbox(async root=>{
 const first=await createHistorySnapshot({project:sample('level',2),kind:'auto'},{root});
 const second=await createHistorySnapshot({project:sample('level',2),kind:'auto'},{root});
 assert.equal(first.saved,true);assert.equal(second.deduplicated,true);
 assert.equal((await listHistory({root})).length,1);
 await createHistorySnapshot({project:sample('level',3),kind:'auto'},{root});
 assert.equal((await listHistory({root})).length,2);
}));

test('automatic retention preserves manual and before-restore checkpoints',async()=>sandbox(async root=>{
 const original=await createHistorySnapshot({project:sample('retention',1),kind:'manual'},{root});
 const safety=await createHistorySnapshot({project:sample('retention',2),kind:'safety'},{root});
 for(let i=0;i<23;i++)await createHistorySnapshot({project:sample('retention',i+3),kind:'auto'},{root});
 const list=await listHistory({root});
 assert.equal(list.filter(e=>e.kind==='auto').length,20);
 assert.equal(list.filter(e=>e.kind==='manual').length,1);
 assert.equal(list.filter(e=>e.kind==='safety').length,1);
 assert.deepEqual((await readHistorySnapshot(original.entry.id,{root})).project,sample('retention',1));
 assert.deepEqual((await readHistorySnapshot(safety.entry.id,{root})).project,sample('retention',2));
}));

test('reject invalid checkpoint metadata, project data, traversal IDs, and corrupt archives',async()=>sandbox(async root=>{
 await assert.rejects(()=>createHistorySnapshot({project:{invalid:true}},{root}),/Invalid project/);
 await assert.rejects(()=>createHistorySnapshot({project:sample(),kind:'delete'},{root}),/Invalid checkpoint type/);
 await assert.rejects(()=>createHistorySnapshot({project:sample(),label:'bad\nname'},{root}),/Invalid checkpoint label/);
 await assert.rejects(()=>readHistorySnapshot('../../Windows/system32',{root}),/Invalid checkpoint identifier/);
 const item=await createHistorySnapshot({project:sample(),kind:'manual'},{root});
 const folder=await historyDirectory({root});
 await fs.writeFile(path.join(folder,`${item.entry.id}.svhistory.gz`),Buffer.from('corrupt data'));
 await assert.rejects(()=>readHistorySnapshot(item.entry.id,{root}));
}));

test('refuse symlink History directory; never write through a redirected folder',async()=>sandbox(async root=>{
 await fs.mkdir(path.join(root,'Projects'),{recursive:true});
 const external=await fs.mkdtemp(path.join(os.tmpdir(),'sven-hf14-outside-'));
 try{
  await fs.symlink(external,path.join(root,'Projects','History'),'junction'); // junctions are reparse points too and need no admin rights
  await assert.rejects(()=>createHistorySnapshot({project:sample()},{root}),/Unsafe History/);
  assert.deepEqual(await fs.readdir(external),[]);
 }finally{await fs.rm(external,{recursive:true,force:true})}
}));

test('project history feature is integrated without replacing browser autosave',async()=>{
 const base=new URL('../src/',import.meta.url);
 // v2.4: main.tsx applies shared preferences, then loads boot.tsx (the former start-up code).
  const main=(await fs.readFile(new URL('main.tsx',base),'utf8'))+(await fs.readFile(new URL('boot.tsx',base),'utf8'));
 const app=await fs.readFile(new URL('App.tsx',base),'utf8');
 const session=await fs.readFile(new URL('engine/sessionManager.ts',base),'utf8');
 assert.match(main,/startRecoveryAutosave\(\)/);
 assert.match(main,/startProjectHistoryAutosave\(\)/);
 assert.match(app,/setDialog\('history'\)/);
 assert.match(app,/ProjectHistoryModal/);
 assert.match(session,/queueRecoveryBackup/);
 const dialog=await fs.readFile(new URL('components/ProjectHistoryModal.tsx',base),'utf8');
 assert.ok(dialog.indexOf('saveHistoryCheckpoint(useEditor.getState().project,\'safety\'')<dialog.indexOf('onRestore(saved.project)'));
 assert.ok(dialog.indexOf('checkpointBeforeImport()')<dialog.indexOf('onRestore(saved.project)'));
});
