import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('BuildTogether 3.0 shows sync revision, conflicts and a recovery action in its own dialog',()=>{
 const panel=read('src/components/BuildTogether.tsx');
 assert.match(panel,/BuildTogether 3\.\d+/);
 assert.match(panel,/room\.revision/);
 assert.match(panel,/room\.conflictCount/);
 assert.match(panel,/downloadBuildTogetherBackup/);
 assert.match(panel,/Porthole - Local Port Sharing/);
 assert.match(panel,/terrain (?:recovery|streaming) still needs real-world confirmation/);
});

test('BuildTogether 3.0 confines network changes to project metadata and never transmits local SDK assets',()=>{
 const client=read('src/engine/buildTogetherClient.ts');
 const server=read('server/buildTogether.js');
 assert.match(client,/protocol:[34]/);
 assert.match(client,/metaPatch/);
 assert.match(server,/META_FIELDS/);
 assert.match(server,/metaKeyRevision/);
 for(const path of ['sdkPath','compilerPath','wadData','mdlData','fsPath'])assert.doesNotMatch(server.match(/META_FIELDS=new Set\(\[[^\]]+/)?.[0]||'',new RegExp(path));
});
