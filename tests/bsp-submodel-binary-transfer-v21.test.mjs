import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const root=new URL('../',import.meta.url);
const text=name=>readFileSync(new URL(name,root),'utf8');
const compile=name=>ts.transpileModule(text(name),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const uri=js=>'data:text/javascript;base64,'+Buffer.from(js).toString('base64');
const nativeUri=uri(compile('src/engine/bspNativeEdit.ts'));
const bspUri=uri(compile('src/engine/bsp.ts'));
const wadMipUri=uri(compile('src/engine/bspWadMipTexture.ts'));
const transferJs=compile('src/engine/bspSubmodelTransfer.ts')
 .replace(/from ['"]\.\/bspNativeEdit['"]/,`from '${nativeUri}'`)
 .replace(/from ['"]\.\/bsp['"]/,`from '${bspUri}'`)
 .replace(/from ['"]\.\/bspWadMipTexture['"]/,`from '${wadMipUri}'`);
const {readNativeBsp}=await import(nativeUri);
const {parseBsp}=await import(bspUri);
const {listBspBrushModels,transferBspSubmodel}=await import(uri(transferJs));
const fixture=readFileSync(new URL('tests/fixtures/maptest1_lighting_v159.bsp',root));
const toAB=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
function chunks(buffer){const v=new DataView(buffer);return Array.from({length:15},(_,i)=>{
 const offset=v.getInt32(4+8*i,true),length=v.getInt32(8+8*i,true);return Buffer.from(buffer,offset,length);
})}
function repack(base,mods={}){
 const all=chunks(toAB(base)).map((chunk,i)=>mods[i]??chunk);
 const header=Buffer.alloc(124);header.writeInt32LE(30,0);let p=124;
 for(let i=0;i<15;i++){
  p=(p+3)&~3;header.writeInt32LE(p,4+8*i);header.writeInt32LE(all[i].length,8+8*i);p+=all[i].length;
 }
 const out=Buffer.alloc(p);header.copy(out);
 for(let i=0;i<15;i++){const at=header.readInt32LE(4+8*i);all[i].copy(out,at)}
 return out;
}
function createModelSource(){
 // Reuse real 2026 compiled ZHLT BSP faces, collision hulls, nodes, RGB lighting
 // and external WAD textures. A second model references the real compiled tree
 // to create a deterministic brush-model transfer test without requiring Windows.
 const original=chunks(toAB(fixture));
 const entity=Buffer.concat([original[0].subarray(0,original[0].indexOf(0)),Buffer.from('\n{\n"classname" "func_door"\n"model" "*1"\n"targetname" "door_from_source"\n}\n\0')]);
 const model=Buffer.from(original[14].subarray(0,64));model.writeInt32LE(0,52);
 return repack(fixture,{0:entity,14:Buffer.concat([original[14],model])});
}
const source=createModelSource();
test('real compiled BSP30 fixture exposes candidate brush model and transfers all referenced hulls',()=>{
 const destDoc=readNativeBsp(toAB(fixture)),sourceDoc=readNativeBsp(toAB(source));
 assert.equal(listBspBrushModels(sourceDoc).length,1);
 const oldDest=Buffer.from(fixture),oldSource=Buffer.from(source);
 const {bytes,report}=transferBspSubmodel(destDoc,sourceDoc,listBspBrushModels(sourceDoc)[0].entityIndex);
 assert.equal(report.sourceModel,1);assert.equal(report.destModel,1);
 assert.ok(report.faces>0);assert.ok(report.nodes>0);assert.ok(report.clipnodes>0);assert.ok(report.lightmapBytes>0);
 const parsed=readNativeBsp(bytes),view=parseBsp(bytes,'validation.bsp');
 assert.equal(parsed.entities.at(-1).pairs.find(p=>p.key==='model').value,'*1');
 assert.equal(view.stats.models,2);assert.equal(view.faces.filter(f=>f.model===1).length,report.faces);
 assert.equal(view.entities.at(-1).classname,'func_door');
 // Source and destination are immutable: in particular the source compiled BSP stays valid.
 assert.deepEqual(Buffer.from(source),oldSource);assert.deepEqual(Buffer.from(fixture),oldDest);
 // Output keeps the destination's complete world VIS intact and independent.
 assert.deepEqual(chunks(bytes)[4],chunks(toAB(fixture))[4]);
 // Every existing destination record remains byte-identical at each lump prefix;
 // only the appended submodel's referenced records are new.
 for(const id of [1,2,3,5,6,7,8,9,10,11,12,13,14]){
  const before=chunks(toAB(fixture))[id],after=chunks(bytes)[id];
  assert.deepEqual(after.subarray(0,before.length),before,`destination lump ${id} prefix changed`);
 }
});
test('transfer can target an already edited entity-lump document without losing changes',async()=>{
 const {setNativeValue}=await import(nativeUri);
 const dest=readNativeBsp(toAB(fixture)),sourceDoc=readNativeBsp(toAB(source));
 const index=dest.entities.findIndex(e=>e.pairs.some(p=>p.key==='classname'&&p.value==='info_player_start'));
 const pair=dest.entities[index].pairs.findIndex(p=>p.key==='origin');
 const changed=setNativeValue(dest,index,pair,'20 50 100');
 const {bytes}=transferBspSubmodel(changed,sourceDoc,sourceDoc.entities.length-1);
 const parsed=readNativeBsp(bytes);
 assert.equal(parsed.entities[index].pairs.find(p=>p.key==='origin').value,'20 50 100');
});
test('embedded source texture is appended with a reindexed texinfo, not lost',()=>{
 const parts=chunks(toAB(source));const originalTex=parts[2],oldCount=originalTex.readInt32LE(0);
 assert.equal(oldCount,3);
 const entry=Buffer.alloc(1150);entry.write('KZ_TEST_EMBED',0,'ascii');entry.writeUInt32LE(16,16);entry.writeUInt32LE(16,20);
 for(const [i,off] of [40,296,360,376].entries())entry.writeUInt32LE(off,24+4*i);
 entry.fill(15,40,296);entry.fill(15,296,360);entry.fill(15,360,376);entry.fill(15,376,380);
 entry.writeUInt16LE(256,380);for(let i=0;i<256;i++){entry[382+i*3]=i;entry[383+i*3]=i;entry[384+i*3]=i}
 const tex=Buffer.alloc(20+3*40+entry.length);tex.writeInt32LE(4,0);
 for(let i=0;i<3;i++){
  const offset=20+i*40;tex.writeInt32LE(offset,4+4*i);
  originalTex.copy(tex,offset,originalTex.readInt32LE(4+i*4),originalTex.readInt32LE(4+i*4)+40);
 }
 tex.writeInt32LE(140,16);entry.copy(tex,140);
 const infos=Buffer.from(parts[6]);infos.writeInt32LE(3,32);
 const modified=repack(source,{2:tex,6:infos});
 const {bytes,report}=transferBspSubmodel(readNativeBsp(toAB(fixture)),readNativeBsp(toAB(modified)),sourceEntityIndex());
 assert.equal(report.addedTextures,1);
 const parsed=parseBsp(bytes);assert.ok(parsed.textures.some(t=>t.name==='KZ_TEST_EMBED'&&!t.external));
});
test('reject mismatched external texture names rather than creating missing WAD dependencies',()=>{
 const parts=chunks(toAB(source)),tex=Buffer.from(parts[2]);
 tex.write('UNAVAILABLE',tex.readInt32LE(4),'latin1');
 const altered=repack(source,{2:tex});
 assert.throws(()=>transferBspSubmodel(readNativeBsp(toAB(fixture)),readNativeBsp(toAB(altered)),sourceEntityIndex()),/External texture .* not present/);
});
test('reject invalid model hull root and lightmap offsets without writing an output',()=>{
 const parts=chunks(toAB(source)),models=Buffer.from(parts[14]);
 models.writeInt32LE(99999,64+36);
 assert.throws(()=>transferBspSubmodel(readNativeBsp(toAB(fixture)),readNativeBsp(toAB(repack(source,{14:models}))),sourceEntityIndex()),/Invalid reference/);
 const faces=Buffer.from(parts[7]);faces.writeInt32LE(2147483647,16);
 assert.throws(()=>transferBspSubmodel(readNativeBsp(toAB(fixture)),readNativeBsp(toAB(repack(source,{7:faces}))),sourceEntityIndex()),/Truncated face lightmap/);
});
test('reject targetname collision and refuse worldspawn',()=>{
 const dParts=chunks(toAB(fixture));const entity=Buffer.concat([dParts[0].subarray(0,dParts[0].indexOf(0)),Buffer.from('\n{\n"classname" "info_target"\n"targetname" "door_from_source"\n}\n\0')]);
 const dest=readNativeBsp(toAB(repack(fixture,{0:entity}))),src=readNativeBsp(toAB(source));
 assert.throws(()=>transferBspSubmodel(dest,src,sourceEntityIndex()),/Duplicate targetname/);
 assert.throws(()=>transferBspSubmodel(dest,src,0),/Select a source brush-model entity/);
});
function sourceEntityIndex(){return readNativeBsp(toAB(source)).entities.length-1}
test('UI remains in three tabs; binary mode is distinct, reviewed and confirmed before download',()=>{
 const ui=text('src/components/BspRecoveryStudio.tsx');
 assert.match(ui,/recoveryTab==='entities'/);assert.match(ui,/recoveryTab==='compose'/);assert.match(ui,/recoveryTab==='convert'/);
 assert.match(ui,/transferBspSubmodel/);assert.match(ui,/binaryConfirmed/);assert.match(ui,/Download verified BSP copy/);
 assert.match(ui,/createConfirmedPartialMap/);assert.match(ui,/composeRecoveredBspGeometry/);
});

test('regression: unlit face with styles [255,255,255,255] and non-negative stale lightofs transfers safely',()=>{
 const parts=chunks(toAB(source)),faces=Buffer.from(parts[7]);
 // Reproduces a BSP that advertises a stale offset although the face has no
 // active lightstyle. This offset must not be copied into the new BSP.
 faces.fill(255,12,16);
 faces.writeInt32LE(2_147_483_647,16);
 const modified=repack(source,{7:faces});
 const previousFaces=chunks(toAB(fixture))[7].length/20;
 const {bytes,report}=transferBspSubmodel(readNativeBsp(toAB(fixture)),readNativeBsp(toAB(modified)),sourceEntityIndex());
 const outputFaces=chunks(bytes)[7];
 assert.equal(outputFaces.readInt32LE(previousFaces*20+16),-1);
 assert.deepEqual([...outputFaces.subarray(previousFaces*20+12,previousFaces*20+16)],[255,255,255,255]);
 assert.equal(report.unlitOffsetCorrections,1);
 assert.ok(report.lightmapBytes>0, 'other lit faces still retain their sampled lighting');
 assert.equal(parseBsp(bytes).faces.filter(f=>f.model===1).length,report.faces);
 assert.deepEqual(chunks(bytes)[4],chunks(toAB(fixture))[4], 'destination world VIS untouched');
});

test('regression: fully unlit brush model does not need a source lightmap lump',()=>{
 const parts=chunks(toAB(source)),faces=Buffer.from(parts[7]);
 for(let i=0;i<faces.length/20;i++){
  faces.fill(255,i*20+12,i*20+16);
  faces.writeInt32LE(i%2===0?0:-1,i*20+16);
 }
 const modified=repack(source,{7:faces,8:Buffer.alloc(0)});
 const {bytes,report}=transferBspSubmodel(readNativeBsp(toAB(fixture)),readNativeBsp(toAB(modified)),sourceEntityIndex());
 assert.equal(report.lightmapBytes,0);
 assert.equal(report.unlitOffsetCorrections,Math.ceil(faces.length/20/2));
 const out=chunks(bytes)[7],first=chunks(toAB(fixture))[7].length/20;
 for(let i=0;i<faces.length/20;i++){
  assert.equal(out.readInt32LE((first+i)*20+16),-1);
 }
});

test('regression: malformed lightstyles with a nonempty style after sentinel must still fail closed',()=>{
 const parts=chunks(toAB(source)),faces=Buffer.from(parts[7]);
 for(const [i,style] of [0,255,32,255].entries())faces[12+i]=style;
 const modified=repack(source,{7:faces});
 assert.throws(()=>transferBspSubmodel(readNativeBsp(toAB(fixture)),readNativeBsp(toAB(modified)),sourceEntityIndex()),/Invalid face lightstyle sequence at face #0: \[0,255,32,255\]/);
});
