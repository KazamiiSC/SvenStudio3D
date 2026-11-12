import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import ts from 'typescript';
const source=await fs.readFile(new URL('../src/engine/bspNativeEdit.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const {readNativeBsp,writeNativeBsp,nativeChanged,addNativeProperty,removeNativeProperty,setNativeValue,addNativeEntity,removeNativeEntity,nativeClassname}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const text=`{\n"classname" "worldspawn"\n"wad" "C:\\Games\\halflife.wad;"\n"message" "original"\n}\n{\n"classname" "func_door"\n"model" "*1"\n"targetname" "door_01"\n}\n{\n"classname" "info_target"\n"targetname" "first"\n"targetname" "second"\n"origin" "12 20 40"\n}\n`;
function fixture(src=text,version=30,ext=''){
 const raw=Buffer.from(src+'\0','latin1');const extra=Buffer.from(ext);
 const chunks=Array.from({length:15},()=>Buffer.alloc(0));
 chunks[0]=raw;chunks[1]=Buffer.alloc(20,0x1f);chunks[2]=Buffer.from([0,0,0,0]);chunks[8]=Buffer.from([37,139,221,47,147,5,90]);chunks[14]=Buffer.alloc(64);
 const header=Buffer.alloc(124);header.writeInt32LE(version,0);let offset=124;
 for(let i=0;i<15;i++){header.writeInt32LE(offset,4+i*8);header.writeInt32LE(chunks[i].length,8+i*8);offset+=chunks[i].length;}
 const joined=Buffer.concat([header,...chunks,extra]);return joined.buffer.slice(joined.byteOffset,joined.byteOffset+joined.byteLength);
}
function mustThrow(fn,frag){assert.throws(fn,err=>String(err).includes(frag));}
test('standard BSP30 original document is unchanged',()=>{const original=fixture();const d=readNativeBsp(original);assert.equal(d.entities.length,3);assert.equal(nativeClassname(d.entities[0]),'worldspawn');assert.equal(nativeChanged(d),false);assert.deepEqual(Buffer.from(writeNativeBsp(d)),Buffer.from(original))});
test('keyvalue edit preserves all 14 non-entity lumps byte for byte and original prefix except header 0',()=>{
 const original=fixture(),doc=readNativeBsp(original);const edited=setNativeValue(doc,1,2,'door_renamed');const out=writeNativeBsp(edited),verified=readNativeBsp(out);
 assert.equal(verified.entities[1].pairs[2].value,'door_renamed');assert.equal(doc.entities[1].pairs[2].value,'door_01');
 for(let i=1;i<15;i++){const {offset,length}=doc.lumps[i];assert.deepEqual(Buffer.from(out,offset,length),Buffer.from(original,offset,length));assert.deepEqual(verified.lumps[i],doc.lumps[i])}
 assert.deepEqual(Buffer.from(out).subarray(12,original.byteLength),Buffer.from(original).subarray(12));
});
test('duplicates are maintained including both targetname entries',()=>{const doc=readNativeBsp(fixture());const edited=setNativeValue(doc,2,2,'changed');const out=readNativeBsp(writeNativeBsp(edited));assert.deepEqual(out.entities[2].pairs.filter(p=>p.key==='targetname').map(p=>p.value),['first','changed']);});
test('untouched entity raw text retains original wad path and formatting',()=>{const doc=readNativeBsp(fixture());const edited=setNativeValue(doc,2,3,'100 200 300');assert.equal(edited.entities[0].raw,doc.entities[0].raw);assert.equal(readNativeBsp(writeNativeBsp(edited)).entities[0].raw,doc.entities[0].raw)});
test('add property can include duplicate keys, remove one',()=>{const doc=readNativeBsp(fixture());const edited=addNativeProperty(doc,2,'spawnflags','4');assert.equal(readNativeBsp(writeNativeBsp(edited)).entities[2].pairs.at(-1).value,'4');const after=removeNativeProperty(edited,2,edited.entities[2].pairs.length-1);assert.equal(after.entities[2].pairs.length,doc.entities[2].pairs.length);});
test('safe add and remove point entity',()=>{const doc=readNativeBsp(fixture());const newDoc=addNativeEntity(doc,'info_target','1 2 3');assert.equal(newDoc.entities.length,4);assert.equal(readNativeBsp(writeNativeBsp(newDoc)).entities.length,4);assert.equal(removeNativeEntity(newDoc,3).entities.length,3);});
test('refuse edit or delete of brush model entity',()=>{const doc=readNativeBsp(fixture());mustThrow(()=>setNativeValue(doc,1,1,'*77'),'cannot be changed');mustThrow(()=>removeNativeProperty(doc,1,1),'cannot be changed');mustThrow(()=>removeNativeEntity(doc,1),'brush entity');});
test('protect worldspawn and classname',()=>{const doc=readNativeBsp(fixture());mustThrow(()=>setNativeValue(doc,0,0,'info_target'),'worldspawn');mustThrow(()=>removeNativeProperty(doc,0,0),'classname');mustThrow(()=>removeNativeEntity(doc,0),'worldspawn');});
test('ASCII/Latin-1 validation prohibits non-encodable or unsafe injection',()=>{const doc=readNativeBsp(fixture());mustThrow(()=>setNativeValue(doc,2,3,'some\nvalue'),'line breaks');mustThrow(()=>setNativeValue(doc,2,3,'\ud83d\ude00'),'Unicode');mustThrow(()=>addNativeProperty(doc,2,'bad key','foo'),'Property keys');});
test('backslash user edits roundtrip safely',()=>{const doc=readNativeBsp(fixture());const next=setNativeValue(doc,2,3,'models\\abc\\');assert.equal(next.entities[2].pairs[3].value,'models\\abc\\');assert.equal(readNativeBsp(writeNativeBsp(next)).entities[2].pairs[3].value,'models\\abc\\');});
test('BSP29 rejected',()=>mustThrow(()=>readNativeBsp(fixture(text,29)),'BSP v30'));
test('trailing unknown extension data rejected',()=>mustThrow(()=>readNativeBsp(fixture(text,30,'BSPX'+ 'z'.repeat(32))),'trailing extension'));
test('invalid/overlapping lumps rejected',()=>{const b=fixture();const bytes=Buffer.from(b);bytes.writeInt32LE(125,4+8);bytes.writeInt32LE(120,8+8);mustThrow(()=>readNativeBsp(b),'overlap');});
test('entity with unsupported broken syntax rejected without mutating input',()=>{const b=fixture('{\n"classname" "worldspawn"\n"bad" \n}\n');const before=Buffer.from(b).toString('hex');mustThrow(()=>readNativeBsp(b),'expected quote');assert.equal(Buffer.from(b).toString('hex'),before)});

// The patched copy must also load through SvenStudio's existing read-only BSP Viewer parser.
test('patched BSP30 is readable by the original BSP Viewer parser',async()=>{
  const code=await fs.readFile(new URL('../src/engine/bsp.ts',import.meta.url),'utf8');
  const compiled=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
  const {parseBsp}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
  const doc=readNativeBsp(fixture());
  const updated=setNativeValue(doc,2,3,'88 99 110');
  const result=parseBsp(writeNativeBsp(updated),'test_recovery.bsp');
  assert.equal(result.version,30);
  assert.equal(result.entities.find(e=>e.classname==='info_target')?.properties.origin,'88 99 110');
  assert.equal(result.entities.find(e=>e.classname==='func_door')?.properties.model,'*1');
});
