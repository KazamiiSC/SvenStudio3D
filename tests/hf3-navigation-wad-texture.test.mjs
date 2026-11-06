import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {preferredTextureAssets,wadBasename} from '../src/engine/textureWadSelection.ts';
import {textureCompileWarnings} from '../src/engine/textureCompileDiagnostics.ts';
import {rememberWadFile,loadSavedWadFiles,forgetSavedWadFiles} from '../src/engine/wadPersistence.ts';
const read=(file)=>fs.readFile(new URL('../'+file,import.meta.url),'utf8');
const asset=(name,wad,width=64,height=64)=>({name,wad,width,height,dataUrl:''});

test('WAD priority uses compiler search order rather than import order, including Windows paths',()=>{
 const files=[asset('BUTTON','later.wad',64),asset('BUTTON','early.wad',128),asset('DOOR','door.wad',256)];
 assert.equal(wadBasename('C:\\Sven Co-op\\svencoop\\early.wad'),'early.wad');
 assert.equal(preferredTextureAssets(files,['C:\\Sven Co-op\\early.wad','D:/later.wad']).get('button').width,128);
 assert.equal(preferredTextureAssets(files,['D:/later.wad','C:\\Sven Co-op\\early.wad']).get('button').width,64);
 assert.equal(preferredTextureAssets(files,[],['early.wad','later.wad']).get('button').wad,'early.wad');
 assert.equal(preferredTextureAssets(files,[]).get('button').wad,'early.wad');
});

test('Texture compile diagnostic identifies duplicate texture names and missing WADs without editing brushes',()=>{
 const project={objects:[{kind:'brush',faces:[{texture:'BUTTON'},{texture:'DOOR'}]}]};
 const before=JSON.stringify(project);
 const warnings=textureCompileWarnings(project,[asset('BUTTON','a.wad',128),asset('BUTTON','b.wad',64),asset('DOOR','c.wad',256)],['C:\\Game\\d.wad']);
 assert.ok(warnings.some(text=>text.includes('WAD COLLISION')&&text.includes('button')));
 assert.ok(warnings.some(text=>text.includes('TEXTURE SOURCE')&&text.includes('door')));
 assert.equal(JSON.stringify(project),before);
});

test('WAD cache restores imported bytes between sessions and replaces duplicate names',async()=>{
 const backing=new Map();
 const db={objectStoreNames:{contains:()=>true},createObjectStore:()=>{},transaction:(_name,mode)=>{
  const tx={oncomplete:null,onerror:null,onabort:null,error:null};
  const finish=()=>setTimeout(()=>tx.oncomplete?.(),0);
  const store={
   put:value=>{backing.set(value.key,value);finish();},
   clear:()=>{backing.clear();finish();},
   getAll:()=>{const request={onsuccess:null,onerror:null,result:null};setTimeout(()=>{request.result=[...backing.values()];request.onsuccess?.();finish();},0);return request;}
  };
  tx.objectStore=()=>store;return tx;
 },close:()=>{}};
 const previous=globalThis.indexedDB;
 globalThis.indexedDB={open:()=>{
  const request={result:db,onsuccess:null,onerror:null,onupgradeneeded:null,onblocked:null};
  setTimeout(()=>request.onsuccess?.(),0);return request;
 }};
 try{
  await forgetSavedWadFiles();
  await rememberWadFile(new File([new Uint8Array([1,2,3])],'Custom.wad'));
  const restored=await loadSavedWadFiles();
  assert.equal(restored.length,1);assert.equal(restored[0].name,'Custom.wad');
  assert.deepEqual([...new Uint8Array(await restored[0].arrayBuffer())],[1,2,3]);
  await rememberWadFile(new File([new Uint8Array([4])],'CUSTOM.WAD'));
  assert.equal((await loadSavedWadFiles()).length,1);
  await rememberWadFile(new File([new Uint8Array([7])],'svstudio.wad'));
  assert.equal((await loadSavedWadFiles()).length,1);
  await forgetSavedWadFiles();assert.equal((await loadSavedWadFiles()).length,0);
 }finally{if(previous===undefined)delete globalThis.indexedDB;else globalThis.indexedDB=previous;}
});

test('Right-click hidden brush uses a context-only raycast and reveals only selected brush',async()=>{
 const viewport=await read('src/components/Viewport.tsx'),extras=await read('src/components/ViewportExtras.tsx');
 assert.match(viewport,/userData=\{\{hiddenBrushId:object.id\}\} raycast=\{ghostContextOnlyRaycast\}/);
 assert.match(extras,/if\(contextPickingHidden\)THREE.Mesh.prototype.raycast.call/);
 assert.match(extras,/try\{return ray.intersectObjects\(scene.children,true\);\}finally\{contextPickingHidden=false;\}/);
 assert.match(extras,/item\('Show brush',[\s\S]*?toggleVisibility\(obj.id\)\)/);
});

test('Right mouse camera does not consume brush editing and Q/E use vertical motion',async()=>{
 const viewport=await read('src/components/Viewport.tsx');
 assert.match(viewport,/rightMouseLook\.current/);
 assert.match(viewport,/canCaptureMapCamera\(\{\.\.\.state/);
 assert.match(viewport,/controls\.current\.target\.copy\(camera\.position\)\.addScaledVector\(direction,distance\)/);
 assert.match(viewport,/if\(vertical\)move\.y\+=vertical/);
 assert.match(viewport,/if\(e.code==='KeyE'&&walkSettingsRef.current.interactions\)/);
});
