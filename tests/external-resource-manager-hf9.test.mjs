import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {inspectMapPackage,createMapPackage} from '../server/mapPackager.js';
import {writeDistribution} from '../server/compiledDistribution.js';
import {validateExternalRoots,locateExternalResource,externalWadSearchFolders} from '../server/externalResources.js';
import {buildSmartWadBytes,planSmartWadBuild} from '../server/smartWadBuild.js';
import {prepareCompileWads} from '../server/compileWads.js';

async function fixture(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'sven-hf9-external-'));
 const gameDir=path.join(root,'Sven Co-op','svencoop'),addon=path.join(root,'Sven Co-op','svencoop_addon'),project=path.join(root,'Map downloaded','maps'),output=path.join(root,'Exports');
 await fs.mkdir(path.join(gameDir,'maps'),{recursive:true});await fs.mkdir(addon,{recursive:true});await fs.mkdir(project,{recursive:true});await fs.mkdir(output);
 const text=Buffer.from('{"classname" "worldspawn"}\n{"classname" "env_model" "model" "models/rooftop_night/sky_dome0.mdl"}\n{"classname" "ambient_generic" "message" "rooftop_night/space.wav"}\n\0');
 const bsp=Buffer.alloc(124+text.length+4);bsp.writeInt32LE(30,0);bsp.writeInt32LE(124,4);bsp.writeInt32LE(text.length,8);text.copy(bsp,124);bsp.writeInt32LE(124+text.length,20);bsp.writeInt32LE(4,24);
 await fs.writeFile(path.join(gameDir,'maps','roof.bsp'),bsp);
 const write=async(rel,data)=>{const file=path.join(project,rel);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,data);return file};
 await write('models/sky/sky_dome0.mdl',Buffer.from('STUDIO-3D-FAKE'));
 await write('sound/rooftop_night/space.wav',Buffer.from('RIFFgood-data'));
 return {root,gameDir,addon,project,output,write};
}
function mip(name,seed){const w=16,h=16,sizes=[256,64,16,4],b=Buffer.alloc(40+340+2+768);b.write(name,0,16,'latin1');b.writeUInt32LE(w,16);b.writeUInt32LE(h,20);let p=40;for(let i=0;i<4;i++){b.writeUInt32LE(p,24+i*4);b.fill(seed+i,p,p+sizes[i]);p+=sizes[i]}b.writeUInt16LE(256,p);return {name,bytes:b}}
const map=(names,wads)=>`{\n"classname" "worldspawn"\n"wad" "${wads.join(';')};"\n${names.map(t=>`{\n( 0 0 0 ) ( 128 0 0 ) ( 0 128 0 ) ${t} [ 1 0 0 0 ] [ 0 -1 0 0 ] 0 1 1\n}`).join('\n')}\n}`;

test('HF9: validates selected folders, rejects drives and missing folders',async t=>{
 const f=await fixture();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 assert.deepEqual(await validateExternalRoots([f.project,f.project]),[await fs.realpath(f.project)]);
 await assert.rejects(validateExternalRoots([path.parse(f.root).root]),/entire drive/);
 await assert.rejects(validateExternalRoots([path.join(f.root,'missing')]),/not found/);
 await assert.rejects(validateExternalRoots(Array(9).fill(f.project)),/up to 8/);
});
test('HF9: misnested model is found by unique name, then packaged at referenced game-relative path',async t=>{
 const f=await fixture();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 const roots=[f.project];const out=await inspectMapPackage({gameDir:f.gameDir,mapName:'roof',resourceRoots:roots});
 assert.equal(out.missing,0,JSON.stringify(out.entries.filter(x=>x.status!=='ready')));
 assert.ok(out.warnings.some(w=>/sky_dome0\.mdl found at/.test(w)));
 const packed=await createMapPackage({gameDir:f.gameDir,mapName:'roof',resourceRoots:roots,returnFiles:true});
 const model=packed.files.find(x=>x.path==='models/rooftop_night/sky_dome0.mdl');
 assert.deepEqual(model?.bytes,Buffer.from('STUDIO-3D-FAKE'));
 assert.ok(packed.files.some(x=>x.path==='sound/rooftop_night/space.wav'));
 const result=await writeDistribution({gameDir:f.gameDir,mapName:'roof',destinationDir:f.output,resourceRoots:roots});
 assert.deepEqual(await fs.readFile(path.join(result.destination,'models/rooftop_night/sky_dome0.mdl')),Buffer.from('STUDIO-3D-FAKE'));
 assert.ok((await fs.readFile(path.join(result.destination,'maps/roof.res'),'utf8')).includes('models/rooftop_night/sky_dome0.mdl'));
 assert.ok((await fs.stat(path.join(f.project,'models/sky/sky_dome0.mdl'))).isFile());
});
test('HF9: differing candidates of the same model do not silently choose a wrong one',async t=>{
 const f=await fixture();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 const other=path.join(f.root,'another');await fs.mkdir(path.join(other,'models'),{recursive:true});await fs.writeFile(path.join(other,'models/sky_dome0.mdl'),Buffer.from('UNRELATED'));
 const found=await locateExternalResource([f.project,other],'models/rooftop_night/sky_dome0.mdl');assert.match(found.conflict,/ambiguous/i);
 const inv=await inspectMapPackage({gameDir:f.gameDir,mapName:'roof',resourceRoots:[f.project,other]});
 assert.ok(inv.entries.some(e=>e.status==='conflict'&&e.path==='models/rooftop_night/sky_dome0.mdl'));
 await assert.rejects(createMapPackage({gameDir:f.gameDir,mapName:'roof',resourceRoots:[f.project,other]}),/resources missing/i);
});
test('HF9: explicitly selected installation copies external assets into addon without overwrite',async t=>{
 const f=await fixture();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 const input={gameDir:f.gameDir,mapName:'roof',destinationDir:f.gameDir,format:'install',resourceRoots:[f.project]};
 const installed=await writeDistribution(input);assert.equal(installed.missing,0);
 const target=path.join(f.addon,'models/rooftop_night/sky_dome0.mdl');
 assert.deepEqual(await fs.readFile(target),Buffer.from('STUDIO-3D-FAKE'));
 await writeDistribution(input); // identical files are safe
 await fs.writeFile(target,'different game file');
 await assert.rejects(writeDistribution(input),/different file already exists|resources missing/);
 assert.equal(await fs.readFile(target,'utf8'),'different game file');
});
test('HF9: special compiler CLIP/NULL collisions use zhlt.wad; ordinary conflicts still rejected',async t=>{
 const f=await fixture();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 const a=await f.write('rooftop.wad',buildSmartWadBytes([mip('CLIP',5),mip('NULL',5),mip('WALL',1)]));
 const tool=await f.write('zhlt.wad',buildSmartWadBytes([mip('CLIP',9),mip('NULL',9)]));
 const plan=await planSmartWadBuild(map(['CLIP','NULL','WALL'],[a,tool]),[a,tool],{workDir:f.root,mapName:'roof',mode:'external'});
 assert.deepEqual(plan.toolResolved.sort(),['CLIP','NULL']);
 const directory=plan.buffer.readInt32LE(8),entries=new Map();for(let i=0;i<plan.buffer.readInt32LE(4);i++){let d=directory+i*32;entries.set(plan.buffer.toString('latin1',d+16,d+32).split('\0')[0],plan.buffer.subarray(plan.buffer.readInt32LE(d),plan.buffer.readInt32LE(d)+plan.buffer.readInt32LE(d+4)))}
 assert.deepEqual(entries.get('CLIP'),mip('CLIP',9).bytes);assert.deepEqual(entries.get('NULL'),mip('NULL',9).bytes);
 const b=await f.write('another.wad',buildSmartWadBytes([mip('WALL',4)]));
 await assert.rejects(planSmartWadBuild(map(['WALL'],[a,b]),[a,b],{workDir:f.root,mapName:'roof',mode:'embed'}),/collision/);
});
test('HF9: external directories allow old map WAD references to resolve without installing WAD into game',async t=>{
 const f=await fixture();t.after(()=>fs.rm(f.root,{recursive:true,force:true}));
 const wad=await f.write('maps/rooftop_night.wad',buildSmartWadBytes([mip('BRICK',5)]));
 const dirs=externalWadSearchFolders([f.project]);
 const source=map(['BRICK'],['rooftop_night.wad']);
 const resolved=await prepareCompileWads(source,{gameDir:f.gameDir,compilerDir:f.root,builtInWad:'/nonexistent.wad',configuredWadPaths:dirs});
 assert.equal(resolved.missingWads.length,0);assert.deepEqual(resolved.resolvedWadList,[wad]);
});
