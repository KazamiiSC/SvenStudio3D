import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {validSharedProject} from '../server/buildTogether.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFileSync(root+p,'utf8');
const base={version:1,name:'cs_test',world:{classname:'worldspawn'},wadNames:[],objects:[{id:'a',kind:'entity',position:[0,0,0]}]};

test('CS 1.6 projects are accepted by every persistence path added before HF28',()=>{
 assert.match(read('src/engine/sessionRecovery.ts'),/s\.project\.target==='svengine'\|\|s\.project\.target==='cs16'/,'autosave/recovery');
 assert.match(read('server/projectHistory.js'),/project\.target==='cs16'/,'Project History');
 assert.match(read('server/buildTogether.js'),/project\.target!=='svengine'&&project\.target!=='cs16'/,'BuildTogether');
});

test('BuildTogether accepts every studio key the client shares',()=>{
 const client=read('src/engine/buildTogetherClient.ts');
 const keys=[...client.match(/const sharedProjectKeys=new Set\(\[([^\]]+)\]\)/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 for(const key of keys.filter(k=>!['version','name','world','wadNames','target'].includes(k))){
  assert.ok(validSharedProject({...base,target:'cs16',[key]:key.endsWith('s')&&!['graphPositions','cinematicPreviewSpeeds','surfaceSounds'].includes(key)?[]:{}}),`server rejects shared key ${key}`);
 }
});
