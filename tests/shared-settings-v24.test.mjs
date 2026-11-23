import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {readFileSync} from 'node:fs';
import {planApply,snapshotPreferences,SHARED_PREFERENCE_KEYS} from '../src/engine/sharedSettings.ts';
import {sanitizeSharedSettings,readSharedSettings,writeSharedSettings} from '../server/sharedSettings.js';

const memory=(init={})=>{const m=new Map(Object.entries(init));return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),dump:()=>Object.fromEntries(m)};};
const S='svenstudio-settings',L='svenstudio-locale';

test('first contact only fills what this side is missing (a fresh app adopts, never wipes)',()=>{
  const browser=memory({[S]:'{"gameDir":"C:/Sven"}'});
  const file={revision:100,values:{[S]:'{"gameDir":"OLD"}',[L]:'es'}};
  const plan=planApply(file,browser);
  assert.deepEqual(plan.writes,{[L]:'es'},'existing local build paths are kept');
  assert.equal(plan.revision,null);
});

test('a fresh install with empty build folders adopts the shared ones on first contact',()=>{
  const fresh=memory({[S]:'{"gameProfile":"svengine","gameDir":"","compilerDir":""}'});
  const plan=planApply({revision:5,values:{[S]:'{"gameDir":"C:/Sven","compilerDir":"F:/SDK"}'}},fresh);
  assert.match(plan.writes[S],/C:\/Sven/);
});

test('after first contact the newest revision wins, and nothing is ever deleted',()=>{
  const app=memory({'svenstudio-shared-settings-revision':'50',[S]:'A',[L]:'en'});
  const plan=planApply({revision:80,values:{[S]:'B'}},app);
  assert.deepEqual(plan.writes,{[S]:'B'},'locale not in the file stays as it is');
  assert.equal(plan.revision,80);
  assert.deepEqual(planApply({revision:40,values:{[S]:'C'}},app).writes,{},'older file is ignored');
});

test('snapshots carry only real values from the allow-list (no project data, no backups)',()=>{
  const store=memory({[S]:'x','svenstudio-recovery-backup-v1':'huge','svenstudio-camera-session-v1':'cam'});
  const snap=snapshotPreferences(store);
  assert.deepEqual(Object.keys(snap),[S]);
  assert.ok(!SHARED_PREFERENCE_KEYS.some(k=>/recovery|camera-session|prefabs/.test(k)));
});

test('server: sanitizes keys/values, keeps the newest revision, writes atomically in Documents',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'svenstudio-shared-'));
  try{
    assert.deepEqual(sanitizeSharedSettings({revision:5,values:{[S]:'ok','evil-key':'x',[L]:null,n:3}}).values,{[S]:'ok'});
    assert.throws(()=>sanitizeSharedSettings({revision:0,values:{}}));
    assert.equal((await writeSharedSettings({revision:10,values:{[S]:'v10'}},root)).saved,true);
    const stale=await writeSharedSettings({revision:9,values:{[S]:'v9'}},root);
    assert.equal(stale.saved,false);
    assert.equal((await readSharedSettings(root)).values[S],'v10');
    await fs.writeFile(path.join(root,'settings.json'),'\uFEFF'+JSON.stringify({version:1,revision:20,values:{[S]:'bom'}}));
    assert.equal((await readSharedSettings(root)).values[S],'bom','a BOM from Notepad is tolerated');
  }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('preferences are applied before the editor modules load',()=>{
  const main=readFileSync(new URL('../src/main.tsx',import.meta.url),'utf8');
  assert.match(main,/await applySharedPreferences\(\);\s*const \{bootstrap\}=await import\('\.\/boot'\);/);
  assert.doesNotMatch(main,/from '\.\/store'|from '\.\/App'/,'no static import may create the stores early');
  assert.match(readFileSync(new URL('../src/boot.tsx',import.meta.url),'utf8'),/startSharedPreferencesSync\(\);/);
  assert.match(readFileSync(new URL('../server/index.js',import.meta.url),'utf8'),/app\.put\('\/api\/shared-settings'/);
});
