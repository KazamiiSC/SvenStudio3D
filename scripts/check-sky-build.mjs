import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {prepareCompileWads,readWorldWadList,patchWorldWads,referencedTextures} from '../server/compileWads.js';
import {inspectBspFile} from '../server/bspAudit.js';
const root=await fs.mkdtemp(path.join(os.tmpdir(),'svstudio-sky-build-'));
try{
  const game=path.join(root,'svencoop_addon'),compiler=path.join(root,'sdk');
  await fs.mkdir(game,{recursive:true});await fs.mkdir(compiler,{recursive:true});
  const builtin=path.resolve('public','svstudio.wad');
  const example=await fs.readFile(path.resolve('examples/sky_stock_reference_0642.map'),'utf8');
  assert(referencedTextures(example).has('SKY'));
  assert.equal(readWorldWadList(example).length,2);
  const prepared=await prepareCompileWads(example,{gameDir:game,compilerDir:compiler,builtInWad:builtin});
  assert.equal(prepared.wadList.length,2,'does not prepend a second built-in WAD');
  assert.equal(prepared.wadList[0],'halflife.wad');
  assert.equal(prepared.wadList[1],'svstudio.wad');
  assert(prepared.warnings.some(w=>w.includes('SKY')),'diagnoses uninspectable SKY WAD rather than pretending the result renders');
  const duplicate=patchWorldWads(example,['svstudio.wad','SVSTUDIO.WAD','svlumen_64c.wad','svlumen_64c.wad']);
  // Self-contained minimal WAD3 directory: enough for the SKY provider audit.
  const names=[...referencedTextures(example)];
  const skyWad=Buffer.alloc(12+32*names.length);
  skyWad.write('WAD3',0);skyWad.writeInt32LE(names.length,4);skyWad.writeInt32LE(12,8);
  names.forEach((name,index)=>skyWad.write(name,12+32*index+16,'ascii'));
  await fs.writeFile(path.join(game,'svlumen_64c.wad'),skyWad);
  const checked=await prepareCompileWads(duplicate,{gameDir:game,compilerDir:compiler,builtInWad:builtin});
  assert.deepEqual(checked.wadList,['svstudio.wad','svlumen_64c.wad']);
  assert(checked.warnings.some(w=>w.includes('duplicate')));
  assert.equal(checked.skyProviders.length,1);
  const onlyCustom=patchWorldWads(example,['svlumen_64c.wad']);
  const custom=await prepareCompileWads(onlyCustom,{gameDir:game,compilerDir:compiler,builtInWad:builtin});
  assert.equal(custom.wadList.length,1,'no svstudio.wad injection if custom WAD provides its textures');
  assert.equal(custom.skyProviders.length,1);
  // This recorded BSP is user-supplied from the failing screenshot. Structural
  // sky flags do not imply that its skybox is visibly rendered in the game.
  const fixture='/mnt/data/svsky_roof_stock_0641c.bsp';
  try{
    const b=await inspectBspFile(fixture);
    assert.equal(b.version,30);assert.equal(b.skyname,'desert');
    assert.equal(b.skyFaces,16);assert.equal(b.skySpecialFaces,16);assert.equal(b.skyLeaves,3);
    assert.equal(b.lightmappedSkyFaces,0);
  }catch(e){if(e.code!=='ENOENT')throw e}
  console.log('PASS SKY build: WAD priority, dedupe, SKY providers, source preservation, BSP30 texinfo/CONTENTS_SKY inspector.');
}finally{await fs.rm(root,{recursive:true,force:true})}
