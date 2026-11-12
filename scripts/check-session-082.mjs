/** Browser recovery regression tests without Playwright/Windows SDK. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createRequire} from 'node:module';
const root=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-082-'));
try{
  for(const file of ['engine/sessionRecovery.ts','engine/customNpc.ts','engine/projectValidation.ts','engine/cameraRecovery.ts','engine/controls.ts']){
    const target=path.join(temp,file.replace('.ts','.js'));
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,ts.transpileModule(fs.readFileSync(path.join(root,'src',file),'utf8'),{
      compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
    }).outputText);
  }
  const storage=new Map();
  globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  globalThis.indexedDB=undefined; // small project localStorage fallback when IDB is blocked
  const require=createRequire(path.join(temp,'test.cjs'));
  const recovery=require('./engine/sessionRecovery.js');
  const camera=require('./engine/cameraRecovery.js');
  const controls=require('./engine/controls.js');
  const project={version:1,target:'svengine',name:'Mapa enorme',world:{classname:'worldspawn',mapversion:'220'},wadNames:[],objects:[{id:'brush01',kind:'brush',name:'Prueba',primitive:'box',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices:[[0,0,0],[32,0,0],[32,32,0],[0,32,0],[0,0,32],[32,0,32],[32,32,32],[0,32,32]],faces:[{indices:[0,3,2,1],texture:'BRICK'},{indices:[4,5,6,7],texture:'BRICK'},{indices:[0,1,5,4],texture:'BRICK'},{indices:[1,2,6,5],texture:'BRICK'},{indices:[2,3,7,6],texture:'BRICK'},{indices:[3,0,4,7],texture:'BRICK'}]}]};
  const snapshot={version:1,savedAt:Date.now(),project,view:{selected:'brush01',selectedIds:['brush01'],selectedFace:null,geometryMode:'object',resourceView:'entities',snap:16,snapping:true}};
  await recovery.queueRecoveryWrite(snapshot);
  const read=await recovery.readRecoveredSession();
  assert.deepEqual(read,snapshot);
  console.log('PASS recovery preserves editable project, object selection and view configuration');
  storage.set('svenstudio-recovery-fallback-v1',JSON.stringify({...snapshot,project:{...project,target:'source-engine'}}));
  assert.equal(await recovery.readRecoveredSession(),null,'Do not restore a foreign-engine project');
  storage.set('svenstudio-recovery-fallback-v1',JSON.stringify(snapshot));
  const pose={version:1,projection:'orthographic',position:[10,20,30],target:[0,5,0],up:[0,1,0],orthoHeight:240,perspectiveFov:55};
  camera.writeSavedCamera(pose);assert.deepEqual(camera.readSavedCamera(),pose);
  console.log('PASS camera projection, position, target, up and field of view survive browser reopen');
  assert.equal(controls.DEFAULT_CONTROLS.shortcuts.scale,'KeyC');
  assert.equal(controls.shortcutAction(controls.DEFAULT_CONTROLS,'KeyC'),'scale');
  storage.set('svenstudio-controls-v1',JSON.stringify({shortcuts:{scale:'KeyS',move:'Shift+KeyG'},flySpeed:500}));
  const migrated=controls.readControls();
  assert.equal(migrated.shortcuts.scale,'KeyC');assert.equal(migrated.shortcuts.move,'Shift+KeyG');assert.equal(migrated.flySpeed,500);
  assert.equal(controls.readControls().cameraDamping,true);
  controls.saveControls({...migrated,shortcuts:{...migrated.shortcuts,scale:'KeyS'}});
  assert.equal(controls.readControls().shortcuts.scale,'KeyS','Explicitly assigning S in v0.8.2 must remain possible');
  console.log('PASS C is default scale, legacy S migrates to C, existing control preferences remain');
  const src=n=>fs.readFileSync(path.join('src',n),'utf8');
  assert.match(src('main.tsx'),/await restoreOnLaunch\(\)/);
  assert.match(src('main.tsx'),/startRecoveryAutosave\(\)/);
  assert.match(src('engine/sessionManager.ts'),/visibilitychange/);
  assert.match(src('engine/sessionManager.ts'),/pagehide/);
  assert.match(src('engine/sessionRecovery.ts'),/indexedDB\.open/);
  assert.match(src('engine/sessionRecovery.ts'),/store\.put\(old,'backup'\)/);
  console.log('PASS recovery initializes before React and keeps an independent backup slot');
  const i18n=src('i18n.ts');
  for(const term of ['This project was made with the help of ChatGPT.','Sven Co-op game data folder','Help recovery','Advanced camera options']){
    assert.ok(i18n.includes(term));
  }
  assert.doesNotMatch(src('App.tsx'),/help-kz-logo/);
  assert.match(src('App.tsx'),/GPT-6 Astra/);
  assert.match(src('App.tsx'),/cameraDamping/);
  assert.ok(fs.existsSync('public/kz-sheez-logo.png'));
  console.log('PASS text-only credits, help and multilingual camera controls are wired');
}catch(error){console.error('FAIL v0.8.2:',error);process.exitCode=1}
finally{fs.rmSync(temp,{recursive:true,force:true});}
