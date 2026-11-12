import test from 'node:test';
import assert from 'node:assert/strict';
import {isPrefabFile,prefabFileName,parseStudioPrefab,scanPrefabFolder,writePrefabToFolder,ensurePrefabFolderPermission} from '../src/engine/prefabStudioFolder.ts';
import {createPrefab} from '../src/engine/prefabs.ts';
import {createBrush} from '../src/engine/geometry.ts';

const make=()=>createPrefab([createBrush('box',[0,0,0],[64,64,64])],'Office Chair');
class MockFolder{
  constructor(files={}){this.name='Prefabs';this.files=new Map(Object.entries(files));this.kind='directory';this.permissions='granted'}
  async queryPermission(){return this.permissions}
  async requestPermission(){this.permissions='granted';return 'granted'}
  async *values(){for(const name of this.files.keys())yield {kind:'file',name,getFile:async()=>new File([this.files.get(name)],name)}}
  async getFileHandle(name,{create}={}){
    if(!create&&!this.files.has(name))throw Error('not found');
    return {kind:'file',name,createWritable:async()=>({
      write:async text=>{this.next=text},
      close:async()=>{this.files.set(name,this.next)},
      abort:async()=>{this.next=null}
    })}
  }
}
test('legacy and BSP prefabs share one safe catalog parser',()=>{
  const prefab=make(),decoded=parseStudioPrefab(JSON.stringify(prefab));
  assert.equal(decoded.name,'Office Chair');assert.equal(decoded.objects.length,1);
  assert.throws(()=>parseStudioPrefab('{'),/JSON/);
  assert.throws(()=>parseStudioPrefab(JSON.stringify({...prefab,version:100})),/Invalid/);
});
test('folder recognizes only prefab extensions and safe filenames',()=>{
 assert.equal(isPrefabFile('chair.svprefab'),true);
 assert.equal(isPrefabFile('table.svprefab.json'),true);
 for(const name of ['readme.json','assets.wad','../chair.svprefab','chair.svprefab.exe'])assert.equal(isPrefabFile(name),false);
 assert.equal(prefabFileName('Chair / Coffee'),'Chair___Coffee.svprefab');
});
test('folder scan discovers valid prefabs and reports invalid ones without modifying files',async()=>{
 const good=JSON.stringify(make()),bad='THIS IS NOT JSON';
 const folder=new MockFolder({'chair.svprefab':good,'bad.svprefab':bad,'notes.txt':'private notes'});
 const before=new Map(folder.files);const scan=await scanPrefabFolder(folder);
 assert.equal(scan.entries.length,1);assert.equal(scan.entries[0].prefab.name,'Office Chair');
 assert.equal(scan.skipped.length,1);assert.match(scan.skipped[0],/bad.svprefab/);
 assert.deepEqual(folder.files,before);
});
test('saving to folder never overwrites existing prefab names',async()=>{
 const folder=new MockFolder({'Office_Chair.svprefab':'untouched'});
 const filename=await writePrefabToFolder(folder,make());
 assert.equal(filename,'Office_Chair_2.svprefab');
 assert.equal(folder.files.get('Office_Chair.svprefab'),'untouched');
 assert.equal(parseStudioPrefab(folder.files.get(filename)).name,'Office Chair');
 const result=await scanPrefabFolder(folder);
 assert.equal(result.entries.length,1);assert.equal(result.skipped.length,1);
});
test('folder authorization is not prompted unless initiated by user',async()=>{
 const folder=new MockFolder();folder.permissions='prompt';
 assert.equal(await ensurePrefabFolderPermission(folder,false,false),false);
 assert.equal(folder.permissions,'prompt');
 assert.equal(await ensurePrefabFolderPermission(folder,true,true),true);
 assert.equal(folder.permissions,'granted');
});
test('unsafe prefab is rejected before creating output file',async()=>{
 const folder=new MockFolder();
 await assert.rejects(()=>writePrefabToFolder(folder,{name:'BAD'}),/Invalid/);
 assert.equal(folder.files.size,0);
});
