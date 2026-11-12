import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prepareCompileWads} from '../server/compileWads.js';
import {planSmartWadBuild,buildSmartWadBytes} from '../server/smartWadBuild.js';

function tex(name){const b=Buffer.alloc(40+256+64+16+4+2+768);b.write(name,0,16,'latin1');b.writeUInt32LE(16,16);b.writeUInt32LE(16,20);let pos=40;for(const [i,n] of [256,64,16,4].entries()){b.writeUInt32LE(pos,24+4*i);b.fill(4+i,pos,pos+n);pos+=n;}b.writeUInt16LE(256,pos);return {name,bytes:b}}
const source='{\n"classname" "worldspawn"\n"wad" "prefab_cache.wad;"\n{\n( 0 0 0 ) ( 64 0 0 ) ( 0 64 0 ) COMPUTERA [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1\n}}';

test('browser-cached WAD can satisfy a MAP without a manually installed WAD',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'hf8-wad-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const browser=path.join(root,'browser-wads');await fs.mkdir(browser);
 const wad=path.join(browser,'prefab_cache.wad');await fs.writeFile(wad,buildSmartWadBytes([tex('COMPUTERA'),tex('UNUSED')]));
 const result=await prepareCompileWads(source,{gameDir:root,compilerDir:root,builtInWad:path.resolve('public/svstudio.wad'),configuredWadPaths:[wad]});
 assert.deepEqual(result.missingWads,[]);
 const smart=await planSmartWadBuild(result.map,result.resolvedWadList,{workDir:root,mapName:'newmap',mode:'external'});
 assert.equal(smart.textureCount,1);assert.equal(smart.usedCount,1);
 assert.ok(smart.buffer.length<(await fs.stat(wad)).size);
});
