import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {prepareCompileWads,readWorldWadList} from '../server/compileWads.js';

const sample = `{
"classname" "worldspawn"
"wad" "halflife.wad;custom.wad;"
{
( 0 0 0 ) ( 64 0 0 ) ( 0 64 0 ) FOO [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1
}
}`;
function wad(names){const b=Buffer.alloc(12+names.length*32);b.write('WAD3',0);b.writeInt32LE(names.length,4);b.writeInt32LE(12,8);names.forEach((n,i)=>b.write(n,12+32*i+16,'ascii'));return b}

test('Resolves a bare worldspawn WAD against svencoop game overlays without mutating original', async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'svstudio-wad-hf4-'));
 try{
  const game=path.join(root,'svencoop'),addon=path.join(root,'svencoop_addon'),sdk=path.join(root,'sdk');
  await Promise.all([game,addon,sdk].map(p=>fs.mkdir(p,{recursive:true})));
  await fs.writeFile(path.join(game,'halflife.wad'),wad(['FOO']));
  await fs.writeFile(path.join(addon,'custom.wad'),wad(['BAR']));
  const a=await prepareCompileWads(sample,{gameDir:game,compilerDir:sdk,builtInWad:path.join(root,'missing.wad')});
  assert.deepEqual(a.missingWads,[]);assert.deepEqual(a.wadList,['halflife.wad','custom.wad']);
  assert.deepEqual(a.resolvedWadList,[path.join(game,'halflife.wad'),path.join(addon,'custom.wad')]);
  assert.deepEqual(readWorldWadList(a.map).map(x=>path.basename(x)),['halflife.wad','custom.wad']);
  assert.match(a.map,new RegExp(game.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')));
  assert.equal(readWorldWadList(sample)[0],'halflife.wad','original MAP stays unchanged');
  const b=await prepareCompileWads(sample,{gameDir:root,compilerDir:sdk,builtInWad:path.join(root,'missing.wad')});
  assert.deepEqual(b.missingWads,[],'Sven Co-op installation root also works');
  await fs.unlink(path.join(addon,'custom.wad'));
  const c=await prepareCompileWads(sample,{gameDir:game,compilerDir:sdk,builtInWad:path.join(root,'missing.wad')});
  assert.deepEqual(c.missingWads,['custom.wad']);
 }finally{await fs.rm(root,{recursive:true,force:true})}
});
