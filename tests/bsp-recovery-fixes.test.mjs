import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
const {extractEmbeddedBspWad,appendRecoveryWadToMap}=require('../src/engine/bspEmbeddedWad.ts');
const {inspectMapImport}=require('../src/engine/importMap.ts');
const {validateBrush}=require('../src/engine/exportMap.ts');
function inputWithEmbeddedTexture(){
  const wad=fs.readFileSync(new URL('../public/svstudio.wad',import.meta.url));
  assert.equal(wad.toString('ascii',0,4),'WAD3');
  const first=wad.readInt32LE(8),recordPos=wad.readInt32LE(first),recordSize=wad.readInt32LE(first+4);
  const mip=wad.subarray(recordPos,recordPos+recordSize);
  const textureLump=Buffer.alloc(8+mip.length);textureLump.writeInt32LE(1,0);textureLump.writeInt32LE(8,4);mip.copy(textureLump,8);
  const bsp=Buffer.alloc(124+textureLump.length);
  bsp.writeInt32LE(30,0);
  for(let i=0;i<15;i++){bsp.writeInt32LE(124,4+i*8);bsp.writeInt32LE(0,8+i*8)}
  bsp.writeInt32LE(textureLump.length,8+2*8);textureLump.copy(bsp,124);
  return {bsp,mip};
}
test('extracts original embedded BSP miptex into a valid companion WAD without re-encoding',()=>{
  const {bsp,mip}=inputWithEmbeddedTexture();
  const out=extractEmbeddedBspWad(bsp.buffer.slice(bsp.byteOffset,bsp.byteOffset+bsp.length),'room.bsp');
  assert.ok(out);assert.equal(out.name,'room_recovered.wad');assert.equal(out.textureNames.length,1);
  const bytes=Buffer.from(out.bytes);
  assert.equal(bytes.toString('ascii',0,4),'WAD3');assert.equal(bytes.readInt32LE(4),1);
  const directory=bytes.readInt32LE(8);assert.equal(bytes.readUInt8(directory+12),0x43);
  const pos=bytes.readInt32LE(directory),size=bytes.readInt32LE(directory+4);
  assert.equal(size,mip.length);assert.deepEqual(bytes.subarray(pos,pos+size),mip);
  assert.deepEqual(bsp.subarray(124+8,124+8+mip.length),mip);
});
test('does not fabricate textures when BSP contains only external names',()=>{
  const {bsp}=inputWithEmbeddedTexture();
  bsp.writeUInt32LE(0,124+8+24);
  const out=extractEmbeddedBspWad(bsp.buffer.slice(bsp.byteOffset,bsp.byteOffset+bsp.length),'room.bsp');
  assert.equal(out,null);
});
test('preserves original WAD references when adding companion WAD, without duplicates',()=>{
  const sample=fs.readFileSync(new URL('../examples/starter_room.map',import.meta.url),'utf8');
  const once=appendRecoveryWadToMap(sample,'room_recovered.wad');
  assert.match(once,/"wad"\s+"[^"]*room_recovered.wad;/);
  assert.equal(appendRecoveryWadToMap(once,'room_recovered.wad'),once);
  assert.match(once,/"classname"\s+"worldspawn"/);
});
test('validates all imported GoldSrc brushes at import time, never leaving a latent invalid solid',()=>{
  for(const example of ['starter_room.map','gameplay_button_relay_door.map','advanced_building_070.map']){
    const source=fs.readFileSync(new URL(`../examples/${example}`,import.meta.url),'utf8');
    const res=inspectMapImport(source,example);
    assert.ok(res.report.importedBrushes>0,example);
    for(const brush of res.project.objects.filter(x=>x.kind==='brush'))assert.deepEqual(validateBrush(brush),[],`${example}: ${brush.name}`);
  }
});
