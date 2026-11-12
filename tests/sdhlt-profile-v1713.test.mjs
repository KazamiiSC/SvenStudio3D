import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {resolveCompilerProfile} from '../server/sdhltCompiler.js';

test('SC remains the default and has no SDHLT RAD flags',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sdhlt-test-sc-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const st of ['CSG','BSP','VIS','RAD'])fs.writeFileSync(path.join(dir,`SC-${st}_x64.exe`),'');
 const profile=resolveCompilerProfile({compilerDir:dir});
 assert.equal(profile.engine,'sc');assert.deepEqual(profile.radArgs,[]);assert.equal(profile.executablePaths.length,4);
});
test('SDHLT x64 tools and only SDHLT options are resolved',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sdhlt-test-sd-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const st of ['CSG','BSP','VIS','RAD'])fs.writeFileSync(path.join(dir,`sdHL${st}_x64.exe`),'');
 const profile=resolveCompilerProfile({compilerEngine:'sdhlt',sdhltDir:dir,sdhltAO:true,sdhltPCF:'2'});
 assert.deepEqual(profile.radArgs,['-ao','-pcf','2']);assert.equal(profile.requiredWad,path.join(dir,'sdhlt.wad'));
});
test('unknown engines and unapproved flags are rejected',()=>{
 assert.throws(()=>resolveCompilerProfile({compilerEngine:'arbitrary',compilerDir:'/tmp'}),/Unknown/);
 assert.throws(()=>resolveCompilerProfile({compilerEngine:'sdhlt',sdhltDir:'/tmp',sdhltPCF:'-exec'}),/Invalid SDHLT PCF/);
});
test('incomplete SDHLT distribution gives an actionable error',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sdhlt-test-missing-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 assert.throws(()=>resolveCompilerProfile({compilerEngine:'sdhlt',sdhltDir:dir}),/compiler missing: CSG/);
});
