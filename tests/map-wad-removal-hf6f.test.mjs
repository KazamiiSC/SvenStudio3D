import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mapWadUsage,planMapWadRemoval,pruneMapWadReferences} from '../src/engine/mapWadRemoval.ts';

const asset=(wad,name,width=64)=>({wad,name,width,height:width});
const textures=[asset('svstudio.wad','SV_BRICK01'),asset('old.wad','OLD_WALL'),asset('old.wad','SHARED'),asset('new.wad','NEW_WALL'),asset('new.wad','SHARED'),asset('decals.wad','DECAL01')];
const snapshot=(faces=[],wadNames=['svstudio.wad'],world={classname:'worldspawn'})=>({version:1,name:'Test',target:'svengine',world,wadNames,objects:faces.length?[{id:'brush',kind:'brush',faces:faces.map(texture=>({texture})),position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}]:[]});

test('6F: unused WAD is removable while built-in pack is protected',()=>{
 assert.deepEqual(planMapWadRemoval('old.wad',textures,snapshot()),{ok:true,reason:'available',usedTextures:[],textureCount:2,activeProjectRefs:0});
 assert.equal(planMapWadRemoval('svstudio.wad',textures,snapshot()).reason,'built-in');
 assert.equal(planMapWadRemoval('decals.wad',textures,snapshot()).reason,'reserved','Decal Studio is independent');
 assert.equal(planMapWadRemoval('unknown.wad',textures,snapshot()).reason,'missing');
});
test('6F: used project face blocks deleting its active source',()=>{
 const p=snapshot(['OLD_WALL','NEW_WALL'],['old.wad','new.wad']);
 const status=planMapWadRemoval('old.wad',textures,p);
 assert.equal(status.ok,false);assert.deepEqual(status.usedTextures,['old_wall']);
 assert.equal(planMapWadRemoval('new.wad',textures,p).ok,false);
});
test('6F: undo/redo snapshots protect WADs even when current map does not use them',()=>{
 const p=snapshot([],['svstudio.wad']);
 assert.equal(planMapWadRemoval('old.wad',textures,p,[snapshot(['OLD_WALL'],['old.wad'])]).reason,'used');
 assert.equal(planMapWadRemoval('old.wad',textures,p,[],[snapshot(['OLD_WALL'],['old.wad'])]).reason,'used');
});
test('6F: texture-name collisions respect source precedence and keep other WAD working',()=>{
 const p=snapshot(['SHARED'],['new.wad','old.wad']);
 assert.equal(planMapWadRemoval('old.wad',textures,p).ok,true);
 assert.deepEqual(planMapWadRemoval('new.wad',textures,p).usedTextures,['shared']);
 assert.equal(planMapWadRemoval('old.wad',textures,p,[],[],['C:\\Maps\\old.wad','C:\\Maps\\new.wad']).ok,false);
});
test('6F: casing differences in WAD filenames do not bypass protection',()=>{
 const p=snapshot(['old_wall'],['OLD.WAD']);
 assert.equal(planMapWadRemoval('old.WAD',textures,p).ok,false);
 assert.equal(planMapWadRemoval('SVSTUDIO.WAD',textures,p).reason,'built-in');
});
test('6F: WAD removal strips unused MAP references without changing brushes or game paths',()=>{
 const p=snapshot(['NEW_WALL'],['old.wad','new.wad'],{wad:'C:\\Sven\\old.wad;C:\\Sven\\new.wad;',skyname:'desert'});
 const before=JSON.stringify(p.objects);
 const result=pruneMapWadReferences(p,'old.wad');
 assert.deepEqual(result.wadNames,['new.wad']);
 assert.equal(result.world.wad,'C:\\Sven\\new.wad;');
 assert.equal(result.world.skyname,'desert');
 assert.equal(JSON.stringify(p.objects),before);
 assert.equal(p.world.wad,'C:\\Sven\\old.wad;C:\\Sven\\new.wad;');
 assert.equal(pruneMapWadReferences(result,'old.wad'),result);
});
test('6F: keep unrelated worldspawn formatting and WAD order unchanged',()=>{
 const p=snapshot([],['new.wad'],{wad:' C:\\Sven\\new.wad ; ;',message:'test'});
 assert.equal(pruneMapWadReferences(p,'old.wad'),p);
});
test('6F: batch usage equals individual protection and supports large undo history',()=>{
 const p=snapshot(['NEW_WALL'],['new.wad']);
 const history=Array.from({length:70},(_,i)=>snapshot(i%2?['OLD_WALL']:['NEW_WALL'],i%2?['old.wad']:['new.wad']));
 const usage=mapWadUsage(textures,[p,...history]);
 for(const wad of ['old.wad','new.wad','svstudio.wad']){
   const expected=planMapWadRemoval(wad,textures,p,history);
   const cached=planMapWadRemoval(wad,textures,p,history,[],[],usage);
   assert.deepEqual(cached,expected);
 }
});
test('6F: MAP asset library has separate management UI and cannot silently change BSP, Decal or Texture Studio modules',()=>{
 const panels=readFileSync(new URL('../src/components/Panels.tsx',import.meta.url),'utf8');
 const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const store=readFileSync(new URL('../src/store.ts',import.meta.url),'utf8');
 for(const locale of ['es','en','ru','ko','zh','pt'])assert.match(panels,new RegExp(`\\b${locale}:\\{manage:`));
 assert.match(panels,/forgetSavedWadFile\(wad\)/);
 assert.match(panels,/removeTextureWad\(wad\)/);
 assert.match(panels,/disabled=\{!plan\.ok\|\|removingWad!==null\}/);
 assert.match(store,/trackProject===false\?s\.project/);
 assert.match(app,/setTextures\(textures,file\.name,\{trackProject:false\}\)/);
 assert.match(app,/wasWadRemovedInSession\(file\.name\)/);
 assert.ok(!panels.includes('forgetSavedWadFiles('),'no global cache wipe');
 assert.ok(!panels.includes('setDecalAssets('),'no decal asset changes');
});

test('6F: IndexedDB deletes only the chosen WAD and never restores it on reload',async()=>{
 const saved=globalThis.indexedDB;
 const records=new Map();
 const db={objectStoreNames:{contains:name=>name==='wad-files'},close(){},transaction(_name,_mode){
   const tx={oncomplete:null,onerror:null,onabort:null,error:null,objectStore(){return {
     put(value){records.set(value.key,value);queueMicrotask(()=>tx.oncomplete?.());},
     delete(key){records.delete(key);queueMicrotask(()=>tx.oncomplete?.());},
     clear(){records.clear();queueMicrotask(()=>tx.oncomplete?.());},
     getAll(){const req={onsuccess:null,onerror:null,result:null,error:null};queueMicrotask(()=>{req.result=[...records.values()];req.onsuccess?.();tx.oncomplete?.();});return req;},
   };}};return tx;
 }};
 globalThis.indexedDB={open(){const req={result:db,onsuccess:null,onupgradeneeded:null,onerror:null};queueMicrotask(()=>req.onsuccess?.());return req;}};
 try{
   const {rememberWadFile,loadSavedWadFiles,forgetSavedWadFile,wasWadRemovedInSession}=await import('../src/engine/wadPersistence.ts');
   await rememberWadFile(new File([new Blob(['old data'])],'old.wad'));
   await rememberWadFile(new File([new Blob(['important'])],'new.wad'));
   await rememberWadFile(new File([new Blob(['decals'])],'decals.wad'));
   assert.deepEqual((await loadSavedWadFiles()).map(f=>f.name).sort(),['decals.wad','new.wad','old.wad']);
   await forgetSavedWadFile('OLD.WAD');
   assert.equal(wasWadRemovedInSession('old.wad'),true);
   assert.deepEqual((await loadSavedWadFiles()).map(f=>f.name).sort(),['decals.wad','new.wad']);
   await assert.rejects(forgetSavedWadFile('svstudio.wad'),/protected/i);
   await assert.rejects(forgetSavedWadFile('decals.wad'),/protected/i);
   assert.equal(records.has('new.wad'),true);
   await rememberWadFile(new File([new Blob(['imported again'])],'old.wad'));
   assert.equal(wasWadRemovedInSession('old.wad'),false);
   assert.equal(records.has('old.wad'),true);
 }finally{globalThis.indexedDB=saved;}
});
