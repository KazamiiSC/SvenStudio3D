/** v0.8.9.4: regression for BSPs referencing more than the original 128 WAD textures.
 * Uses generated WAD3 data, verifies the server safety limits, and exercises the
 * same multi-request client coordinator that BspViewer uses. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import {findBspWadTextures} from '../server/bspWadAssets.js';

const textureNames=Array.from({length:215},(_,i)=>`TEX_${String(i).padStart(3,'0')}`);
function makeTexture(name){
  const w=16,h=16,mips=[256,64,16,4];
  const buffer=Buffer.alloc(40+mips.reduce((a,b)=>a+b,0)+2+6);
  buffer.write(name,0,'latin1');buffer.writeUInt32LE(w,16);buffer.writeUInt32LE(h,20);
  let offset=40;
  for(let i=0;i<4;i++){buffer.writeUInt32LE(offset,24+4*i);buffer.fill(1,offset,offset+mips[i]);offset+=mips[i]}
  buffer.writeUInt16LE(2,offset);offset+=2;
  Buffer.from([0,0,0,240,120,64]).copy(buffer,offset);
  return buffer;
}
function makeWad(names){
  const entries=names.map(name=>({name,data:makeTexture(name)}));
  const dataEnd=12+entries.reduce((n,item)=>n+item.data.length,0);
  const buffer=Buffer.alloc(dataEnd+entries.length*32);
  buffer.write('WAD3',0);buffer.writeInt32LE(entries.length,4);buffer.writeInt32LE(dataEnd,8);
  let offset=12;
  for(let i=0;i<entries.length;i++){
    const entry=entries[i],at=dataEnd+i*32;
    entry.data.copy(buffer,offset);buffer.writeInt32LE(offset,at);buffer.writeInt32LE(entry.data.length,at+4);
    buffer.writeInt32LE(entry.data.length,at+8);buffer[at+12]=0x43;buffer.write(entry.name,at+16,'latin1');offset+=entry.data.length;
  }
  return buffer;
}
const src=await readFile(new URL('../src/engine/bspAutoWad.ts',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {fetchBspAutoWads,bspWadBatches}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
assert.deepEqual(bspWadBatches(textureNames).map(batch=>batch.length),[64,64,64,23]);
assert.equal(bspWadBatches(['ABC','ABC','DEF']).flat().length,2);
const root=await mkdtemp(path.join(tmpdir(),'sven-wad-0894-'));
try{
  const gameDir=path.join(root,'svencoop');await mkdir(gameDir);
  await writeFile(path.join(gameDir,'halflife.wad'),makeWad(textureNames));
  const oldSingleCall=await findBspWadTextures({gameDir,wadNames:['halflife.wad'],textureNames});
  assert.equal(oldSingleCall.textures.length,128,'Server must enforce its per-request guard');
  assert.equal(oldSingleCall.truncated,true);
  let calls=0;const progress=[];
  const fakeFetch=async(_url,options)=>{
    calls++;
    const request=JSON.parse(options.body);
    assert(request.textureNames.length<=64,'Client must send bounded pages');
    const payload=await findBspWadTextures(request);
    return {ok:true,json:async()=>payload};
  };
  const result=await fetchBspAutoWads(gameDir,['halflife.wad'],textureNames,new AbortController().signal,
    p=>progress.push({n:p.textures.length,b:p.batchesCompleted,total:p.batchesTotal}),fakeFetch);
  assert.equal(calls,4);
  assert.equal(result.textures.length,215,'Must load textures beyond index 128');
  assert.equal(new Set(result.textures.map(t=>t.name.toLowerCase())).size,215);
  assert.deepEqual(result.missing,[]);
  assert.equal(result.limited,false,'Resolved searches must not claim a safety limit');
  assert.deepEqual(progress.map(p=>p.n),[64,128,192,215]);
  assert.equal(progress.at(-1).total,4);
  assert.equal(result.scanned,4);
  // Real unresolved textures should show missing instead of a false safety-limit warning.
  const unresolved=await findBspWadTextures({gameDir,textureNames:['ABSENT']});
  assert.deepEqual(unresolved.missing,['absent']);
  assert.equal(unresolved.truncated,false);
  const aborted=new AbortController();aborted.abort();
  await assert.rejects(()=>fetchBspAutoWads(gameDir,[],textureNames,aborted.signal,undefined,fakeFetch),{name:'AbortError'});
  console.log('PASS BSP v0.8.9.4: 215 WAD textures loaded in 4 batches, accurate limits, progress, cancellation and no duplicate names.');
}finally{await rm(root,{recursive:true,force:true})}
