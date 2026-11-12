import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildSmartWadBytes,planSmartWadBuild,installSmartWadExternal} from '../server/smartWadBuild.js';
import {referencedTextures,readWorldWadList} from '../server/compileWads.js';
const root=()=>fs.mkdtemp(path.join(os.tmpdir(),'sven-smartwad-hf7-'));
function entry(name,seed=1){
 const w=16,h=16,sizes=[256,64,16,4],length=40+sizes.reduce((a,b)=>a+b,0)+2+768;
 const b=Buffer.alloc(length);b.write(name,0,16,'latin1');b.writeUInt32LE(w,16);b.writeUInt32LE(h,20);
 let at=40;for(let m=0;m<4;m++){b.writeUInt32LE(at,24+m*4);b.fill(seed+m,at,at+sizes[m]);at+=sizes[m]}
 b.writeUInt16LE(256,at);return {name,bytes:b};
}
const source=(textures,wads)=>`{\n"classname" "worldspawn"\n"wad" "${wads.join(';')};"\n${textures.map(t=>`{\n( 0 0 0 ) ( 128 0 0 ) ( 0 128 0 ) ${t} [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1\n}`).join('\n')}\n}`;
function parsed(bytes){
 assert.equal(bytes.toString('ascii',0,4),'WAD3');
 const n=bytes.readInt32LE(4),start=bytes.readInt32LE(8),out=[];
 for(let i=0;i<n;i++){const d=start+i*32,offset=bytes.readInt32LE(d),len=bytes.readInt32LE(d+4);out.push({name:bytes.toString('latin1',d+16,d+32).split('\0')[0],body:bytes.subarray(offset,offset+len)});}
 return out;
}
test('Smart WAD takes only used MIP lumps with exact original palette/mipmaps',async t=>{
 const dir=await root();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const wa=path.join(dir,'one.wad'),wb=path.join(dir,'two.wad');
 await fs.writeFile(wa,buildSmartWadBytes([entry('WALL',7),entry('UNUSED',8)]));
 await fs.writeFile(wb,buildSmartWadBytes([entry('METAL',9)]));
 const map=source(['WALL','METAL'],[wa,wb]);
 const plan=await planSmartWadBuild(map,[wa,wb],{workDir:dir,mapName:'room',mode:'embed'});
 assert.deepEqual(plan.csgArgs,['-wadinclude',plan.basename]);
 assert.equal(plan.sourceCount,2);assert.equal(plan.textureCount,2);
 assert.deepEqual(parsed(plan.buffer).map(x=>x.name),['METAL','WALL']);
 assert.deepEqual([...referencedTextures(plan.map)].sort(),['METAL','WALL']);
 assert.deepEqual(readWorldWadList(plan.map),[plan.file.replaceAll('\\','/')]);
 assert.deepEqual(parsed(plan.buffer).find(x=>x.name==='WALL').body,entry('WALL',7).bytes);
 assert.equal((await fs.readFile(wa)).equals(buildSmartWadBytes([entry('WALL',7),entry('UNUSED',8)])),true);
});
test('GoldSrc +0 animation includes +1 and +A but not unrelated textures',async t=>{
 const dir=await root();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const f=path.join(dir,'animated.wad');await fs.writeFile(f,buildSmartWadBytes([entry('+0SCREEN',1),entry('+1SCREEN',2),entry('+ASCREEN',3),entry('+0OTHER',4)]));
 const plan=await planSmartWadBuild(source(['+0SCREEN'],[f]),[f],{workDir:dir,mapName:'test',mode:'external'});
 assert.deepEqual(parsed(plan.buffer).map(x=>x.name),['+0SCREEN','+1SCREEN','+ASCREEN']);
 assert.equal(plan.extraFrames,2);assert.deepEqual(plan.csgArgs,[]);
});
test('Smart WAD rejects conflicting data for one GoldSrc name rather than selecting silently',async t=>{
 const dir=await root();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const a=path.join(dir,'a.wad'),b=path.join(dir,'b.wad');await fs.writeFile(a,buildSmartWadBytes([entry('SHARED',2)]));await fs.writeFile(b,buildSmartWadBytes([entry('SHARED',3)]));
 await assert.rejects(planSmartWadBuild(source(['SHARED'],[a,b]),[a,b],{workDir:dir,mapName:'x',mode:'embed'}),/collision/i);
});
test('Smart WAD reports missing textures and does not synthesize fake content',async t=>{
 const dir=await root();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const file=path.join(dir,'one.wad');await fs.writeFile(file,buildSmartWadBytes([entry('OTHER',1)]));
 await assert.rejects(planSmartWadBuild(source(['MISSING'],[file]),[file],{workDir:dir,mapName:'x',mode:'embed'}),/missing.*MISSING/i);
});
test('External Smart WAD installs without overwriting existing other textures',async t=>{
 const dir=await root();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const rootGame=path.join(dir,'Sven Co-op'),gameDir=path.join(rootGame,'svencoop');await fs.mkdir(gameDir,{recursive:true});
 const file=path.join(dir,'one.wad');await fs.writeFile(file,buildSmartWadBytes([entry('WALL',1)]));
 const plan=await planSmartWadBuild(source(['WALL'],[file]),[file],{workDir:dir,mapName:'room',mode:'external'});
 const installed=await installSmartWadExternal(plan,gameDir);
 assert.equal(installed,path.join(rootGame,'svencoop_addon',plan.basename));
 assert.deepEqual(await fs.readFile(installed),plan.buffer);
 assert.equal(await installSmartWadExternal(plan,gameDir),installed);
 await fs.writeFile(installed,Buffer.from('unrelated WAD'));
 await assert.rejects(installSmartWadExternal(plan,gameDir),/different content/);
 assert.deepEqual(await fs.readFile(installed),Buffer.from('unrelated WAD'));
});
test('Source textures with full 16-byte names survive without truncated identifiers',async t=>{
 const dir=await root();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const name='ABCDEFGHIJKLMNOP';const f=path.join(dir,'long.wad');await fs.writeFile(f,buildSmartWadBytes([entry(name,5)]));
 const plan=await planSmartWadBuild(source([name],[f]),[f],{workDir:dir,mapName:'room',mode:'external'});
 assert.deepEqual(parsed(plan.buffer).map(e=>e.name),[name]);
});
test('Official bundled WAD can be reduced to one referenced material',async t=>{
 const dir=await root();t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const wad=path.resolve('public/svstudio.wad');
 const plan=await planSmartWadBuild(source(['SV_BRICK01'],[wad]),[wad],{workDir:dir,mapName:'test',mode:'embed'});
 assert.deepEqual(parsed(plan.buffer).map(e=>e.name),['SV_BRICK01']);
 assert.ok(plan.buffer.length<(await fs.stat(wad)).size);
});
