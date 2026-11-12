/** Regression: 2.1 originally refused a valid -0babtech7 texture even when
 * halflife.wad was used to compile both MAPs. A WAD selected for the binary
 * transfer must now be read and the texture embedded in a NEW BSP copy. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const root=new URL('../',import.meta.url);
const compile=name=>ts.transpileModule(readFileSync(new URL(name,root),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const uri=js=>'data:text/javascript;base64,'+Buffer.from(js).toString('base64');
const nativeUri=uri(compile('src/engine/bspNativeEdit.ts'));
const bspUri=uri(compile('src/engine/bsp.ts'));
const wadUri=uri(compile('src/engine/bspWadMipTexture.ts'));
const transferUri=uri(compile('src/engine/bspSubmodelTransfer.ts')
 .replace(/from ['"]\.\/bspNativeEdit['"]/,`from '${nativeUri}'`)
 .replace(/from ['"]\.\/bsp['"]/,`from '${bspUri}'`)
 .replace(/from ['"]\.\/bspWadMipTexture['"]/,`from '${wadUri}'`));
const {readNativeBsp}=await import(nativeUri);
const {parseBsp}=await import(bspUri);
const {findMipTextureInWads}=await import(wadUri);
const {transferBspSubmodel}=await import(transferUri);
const fixture=readFileSync(new URL('tests/fixtures/maptest1_lighting_v159.bsp',root));
const toAB=b=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);
function chunks(bytes){const v=new DataView(bytes);return Array.from({length:15},(_,i)=>Buffer.from(bytes,v.getInt32(4+8*i,true),v.getInt32(8+8*i,true)));}
function repack(original,changes){
 const all=chunks(toAB(original)).map((b,i)=>changes[i]??b);
 const header=Buffer.alloc(124);header.writeInt32LE(30,0);let total=124;
 for(let i=0;i<15;i++){total=(total+3)&~3;header.writeInt32LE(total,4+i*8);header.writeInt32LE(all[i].length,8+i*8);total+=all[i].length}
 const result=Buffer.alloc(total);header.copy(result);
 for(let i=0;i<15;i++)all[i].copy(result,header.readInt32LE(4+8*i));
 return result;
}
function makeSource(name='-0babtech7'){
 const parts=chunks(toAB(fixture));
 const entry=Buffer.from(parts[2]),start=entry.readInt32LE(4);
 entry.fill(0,start,start+16);entry.write(name,start,'latin1');
 const entity=Buffer.concat([parts[0].subarray(0,parts[0].indexOf(0)),Buffer.from('\n{\n"classname" "func_door"\n"model" "*1"\n"targetname" "unique_wad_door"\n}\n\0')]);
 const model=Buffer.from(parts[14].subarray(0,64));model.writeInt32LE(0,52);
 const source=repack(fixture,{0:entity,2:entry,14:Buffer.concat([parts[14],model])});
 return {source,name,w:entry.readUInt32LE(start+16),h:entry.readUInt32LE(start+20)};
}
function makeWad(name,width,height,{changePalette=false}={}){
 const sizes=[width*height,width*height/4,width*height/16,width*height/64];
 const offsets=[40];for(let i=1;i<4;i++)offsets.push(offsets[i-1]+sizes[i-1]);
 const paletteAt=offsets[3]+sizes[3],entry=Buffer.alloc(paletteAt+2+768);
 entry.write(name,0,'latin1');entry.writeUInt32LE(width,16);entry.writeUInt32LE(height,20);
 for(let i=0;i<4;i++)entry.writeUInt32LE(offsets[i],24+4*i);
 for(let i=0;i<4;i++)entry.fill(i+7,offsets[i],offsets[i]+sizes[i]);
 entry.writeUInt16LE(256,paletteAt);
 for(let i=0;i<256;i++){
  entry[paletteAt+2+i*3]=changePalette?255-i:i;
  entry[paletteAt+3+i*3]=i;entry[paletteAt+4+i*3]=i;
 }
 const wad=Buffer.alloc(12+entry.length+32),dir=12+entry.length;
 wad.write('WAD3',0);wad.writeInt32LE(1,4);wad.writeInt32LE(dir,8);
 entry.copy(wad,12);
 wad.writeInt32LE(12,dir);wad.writeInt32LE(entry.length,dir+4);wad.writeInt32LE(entry.length,dir+8);wad[dir+12]=0x43;
 wad.write(name,dir+16,'latin1');
 return wad;
}
function prepared(){const {source,name,w,h}=makeSource();return {source,name,w,h,wad:makeWad(name,w,h)};}
function transfer(source,wads){const doc=readNativeBsp(toAB(source));return transferBspSubmodel(readNativeBsp(toAB(fixture)),doc,doc.entities.length-1,{wadFiles:wads});}

test('missing BSP external texture is resolved and embedded exactly using supplied WAD3, without modifying either BSP',()=>{
 const {source,name,w,h,wad}=prepared(),before=Buffer.from(source),beforeDest=Buffer.from(fixture);
 assert.throws(()=>transfer(source,[]),/External texture -0babtech7 is not present/);
 const result=transfer(source,[wad]);
 assert.equal(result.report.wadTextures,1);assert.equal(result.report.addedTextures,1);
 const parsed=readNativeBsp(result.bytes),display=parseBsp(result.bytes);
 assert.equal(parsed.entities.at(-1).pairs.find(p=>p.key==='model').value,'*1');
 assert.ok(display.textures.some(t=>t.name===name&&!t.external));
 assert.equal(display.stats.models,2);
 const tex=chunks(result.bytes)[2],last=tex.readInt32LE(0)-1;
 const rel=tex.readInt32LE(4+last*4),found=tex.subarray(rel);
 assert.equal(found.toString('latin1',0,name.length),name);
 assert.equal(found.readUInt32LE(16),w);assert.equal(found.readUInt32LE(20),h);
 const originalWadTexture=findMipTextureInWads([wad],name,w,h);
 assert.deepEqual(found.subarray(0,originalWadTexture.raw.length),originalWadTexture.raw);
 assert.deepEqual(Buffer.from(source),before);assert.deepEqual(Buffer.from(fixture),beforeDest);
 assert.deepEqual(chunks(result.bytes)[4],chunks(toAB(fixture))[4]); // World VIS unchanged.
});
test('reject selected WAD which does not include the missing external texture',()=>{
 const {source,w,h}=prepared();const other=makeWad('SOME_OTHER',w,h);
 assert.throws(()=>transfer(source,[other]),/External texture -0babtech7 is not present/);
});
test('refuse WAD miptex with incompatible dimensions, truncated palette or compressed content',()=>{
 const {source,name,w,h,wad}=prepared();
 const wrong=makeWad(name,w/2,h/2);
 assert.throws(()=>transfer(source,[wrong]),/incompatible dimensions/);
 const short=Buffer.from(wad),dir=short.readInt32LE(8);
 short.writeInt32LE(short.readInt32LE(dir+4)-300,dir+4);
 short.writeInt32LE(short.readInt32LE(dir+8)-300,dir+8);
 assert.throws(()=>transfer(source,[short]),/palette/);
 const compressed=Buffer.from(wad);compressed[dir+13]=1;
 assert.throws(()=>transfer(source,[compressed]),/uncompressed WAD3 miptexture/);
});
test('reject ambiguous same-name images across two WAD3s instead of selecting arbitrarily',()=>{
 const {source,name,w,h,wad}=prepared();const mismatch=makeWad(name,w,h,{changePalette:true});
 assert.throws(()=>transfer(source,[wad,mismatch]),/Ambiguous texture/);
});
test('invalid or excessively large WAD3 selection cannot create a BSP',()=>{
 const {source,wad}=prepared();
 assert.throws(()=>transfer(source,[new Uint8Array([1,2,3])]),/WAD3 file/);
 assert.throws(()=>transfer(source,Array.from({length:9},()=>wad)),/at most 8 WAD3/);
});
test('UI contains explicit source WAD picker and six language translations',()=>{
 const ui=readFileSync(new URL('src/components/BspRecoveryStudio.tsx',root),'utf8');
 const i18n=readFileSync(new URL('src/i18n.ts',root),'utf8');
 assert.match(ui,/binaryWads/);assert.match(ui,/type="file" accept="\.wad" multiple/);
 assert.match(ui,/Textures resolved from WAD3/);
 for(const locale of ['es','en','ru','ko','zh','pt'])assert.match(i18n,new RegExp(`Object\\.assign\\(${locale},\\{[^\\n]*WAD3 files for missing external textures`));
});

test('regression v2.1.2: missing WAD texture and an unlit face with unused lightofs resolve in the same transfer',()=>{
 const {source,wad,name}=prepared(),parts=chunks(toAB(source)),faces=Buffer.from(parts[7]);
 faces.fill(255,12,16);faces.writeInt32LE(0,16);
 const modified=repack(source,{7:faces});
 const {bytes,report}=transfer(modified,[wad]);
 assert.equal(report.wadTextures,1);
 assert.equal(report.unlitOffsetCorrections,1);
 const firstNewFace=chunks(toAB(fixture))[7].length/20;
 assert.equal(chunks(bytes)[7].readInt32LE(firstNewFace*20+16),-1);
 assert.ok(parseBsp(bytes).textures.some(texture=>texture.name===name&&!texture.external));
 assert.deepEqual(chunks(bytes)[4],chunks(toAB(fixture))[4]);
});

test('UI diagnostics for normalized no-lightmap faces and malformed styles are localized in six languages',()=>{
 const ui=readFileSync(new URL('src/components/BspRecoveryStudio.tsx',root),'utf8');
 const i18n=readFileSync(new URL('src/i18n.ts',root),'utf8');
 for(const key of ['Invalid BSP lightstyles on source face','Unlit faces with unused lighting offsets normalized','Non-contiguous lightstyles cannot be transferred safely.']){
  assert.ok(ui.includes(`t('${key}')`),`Missing UI key ${key}`);
  for(const locale of ['es','en','ru','ko','zh','pt'])
   assert.match(i18n,new RegExp(`Object\\.assign\\(${locale}, \\{[^}]*${key.replaceAll(/[.*+?^${}()|[\]\\]/g,'\\$&')}`, 's'));
 }
});
