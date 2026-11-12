import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
require.extensions['.ts']=(mod,filename)=>mod._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,filename);
const {readNativeBsp,writeNativeBsp,nativeProperty,nativeChanged,addNativeProperty}=require('../src/engine/bspNativeEdit.ts');
const {bspPointEditable,bspMovePoint,bspRotatePointYaw,bspDuplicatePoint,bspDeletePoint,bspPreviewEntities,bspPreviewMap,bspEditVector,bspSetPointField}=require('../src/engine/bspVisualEntityEdit.ts');
const text=`{
"classname" "worldspawn"
"message" "compiled map"
}
{
"classname" "func_door"
"model" "*1"
"origin" "5 5 5"
"targetname" "main_door"
}
{
"classname" "monster_zombie"
"origin" "128 64 16"
"angles" "10 90 -3"
"targetname" "zombie_A"
"spawnflags" "4"
}
{
"classname" "ambient_generic"
"origin" "1 2 3"
"message" "ambience/drip.wav"
}
`;
function fixture(src=text){
 const chunks=Array.from({length:15},()=>Buffer.alloc(0));
 chunks[0]=Buffer.from(src+'\0','latin1');chunks[3]=Buffer.alloc(12,0x42);chunks[8]=Buffer.from([1,2,4,7]);chunks[14]=Buffer.alloc(64);
 const header=Buffer.alloc(124);header.writeInt32LE(30,0);let offset=124;
 for(let i=0;i<15;i++){header.writeInt32LE(offset,4+i*8);header.writeInt32LE(chunks[i].length,8+i*8);offset+=chunks[i].length;}
 const all=Buffer.concat([header,...chunks]);return all.buffer.slice(all.byteOffset,all.byteOffset+all.byteLength);
}
const make=()=>readNativeBsp(fixture());
const read=doc=>readNativeBsp(writeNativeBsp(doc));
test('selective point entities exclude worldspawn and compiled brush submodels',()=>{
 const doc=make();assert.equal(bspPointEditable(doc.entities[0],0),false);
 assert.equal(bspPointEditable(doc.entities[1],1),false);
 assert.equal(bspPointEditable(doc.entities[2],2),true);
 assert.equal(bspPointEditable(doc.entities[3],3),true);
});
test('moving a zombie changes only origin while preserving other properties and source',()=>{
 const original=make();const next=read(bspMovePoint(original,2,[130.125,70,-22]));
 assert.equal(nativeProperty(next.entities[2],'origin'),'130.125 70 -22');
 assert.equal(nativeProperty(next.entities[2],'angles'),'10 90 -3');
 assert.equal(nativeProperty(next.entities[1],'model'),'*1');
 assert.equal(nativeProperty(original.entities[2],'origin'),'128 64 16');
 assert.equal(nativeChanged(original),false);
});
test('rotating point entity changes only yaw and preserves pitch/roll',()=>{
 const updated=read(bspRotatePointYaw(make(),2,180));
 assert.equal(nativeProperty(updated.entities[2],'angles'),'10 180 -3');
 assert.equal(nativeProperty(updated.entities[2],'origin'),'128 64 16');
 const added=read(bspRotatePointYaw(make(),3,30));
 assert.equal(nativeProperty(added.entities[3],'angle'),'30');
});
test('duplicate retains entity keyvalues, offsets origin and changes duplicate targetname',()=>{
 const doc=make();const changed=read(bspDuplicatePoint(doc,2));
 assert.equal(changed.entities.length,5);
 assert.equal(nativeProperty(changed.entities[4],'classname'),'monster_zombie');
 assert.equal(nativeProperty(changed.entities[4],'targetname'),'zombie_A_copy');
 assert.equal(nativeProperty(changed.entities[4],'spawnflags'),'4');
 assert.equal(nativeProperty(changed.entities[4],'origin'),'160 64 16');
 assert.equal(nativeProperty(changed.entities[2],'targetname'),'zombie_A');
});
test('delete point entity does not touch compiled world entity or model references',()=>{
 const changed=read(bspDeletePoint(make(),3));
 assert.equal(changed.entities.length,3);
 assert.equal(nativeProperty(changed.entities[1],'model'),'*1');
 assert.throws(()=>bspDeletePoint(make(),1),/Only point entities/);
 assert.throws(()=>bspDuplicatePoint(make(),1),/Only point entities/);
 assert.throws(()=>bspMovePoint(make(),1,[0,0,0]),/cannot be transformed/);
});
test('validate numeric position and reject nonfinite values or forged brush model references',()=>{
 assert.deepEqual(bspEditVector('1.5 0 -9'),[1.5,0,-9]);
 for(const value of ['NaN 1 2','1 2','1 2 Infinity','900000 1 0'])assert.throws(()=>bspEditVector(value));
 assert.throws(()=>bspSetPointField(make(),2,'model','*12'),/compiled brush model/);
 assert.throws(()=>bspSetPointField(make(),2,'angles','bad'),/Angles/);
});
test('render overlay reflects changed entity locations without changing the underlying face map',()=>{
 const original=make(),changed=bspMovePoint(original,2,[1,5,9]);
 const stub={name:'test.bsp',entities:[],faces:[{original:true}],stats:{entities:4,faces:1}};
 const preview=bspPreviewMap(stub,changed);
 assert.deepEqual(preview.entities[2].origin,[1,5,9]);
 assert.equal(preview.entities[3].properties.message,'ambience/drip.wav');
 assert.equal(preview.faces,stub.faces);
 assert.equal(preview.stats.entities,4);
 assert.equal(bspPreviewEntities(original)[2].properties.origin,'128 64 16');
});
test('all compiled non-entity BSP lumps stay byte-for-byte identical after multiple visual edits',()=>{
 const source=fixture(),orig=readNativeBsp(source);
 let doc=bspMovePoint(orig,2,[400,500,600]);
 doc=bspRotatePointYaw(doc,2,35);
 doc=bspDuplicatePoint(doc,2);
 doc=bspDeletePoint(doc,3);
 const output=writeNativeBsp(doc),verified=readNativeBsp(output);
 assert.equal(verified.entities.length,4);
 for(let i=1;i<15;i++){
   assert.deepEqual(verified.lumps[i],orig.lumps[i]);
   const {offset,length}=orig.lumps[i];
   assert.deepEqual(Buffer.from(output,offset,length),Buffer.from(source,offset,length));
 }
 assert.equal(nativeProperty(orig.entities[2],'origin'),'128 64 16');
});
test('viewport mode controls and original recovery remain separate',()=>{
 const viewer=fs.readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
 assert.match(viewer,/BspPointGizmo/);
 assert.match(viewer,/bspMovePoint/);
 assert.match(viewer,/bspRotatePointYaw/);
 assert.match(viewer,/writeNativeBsp\(doc\)/);
 assert.match(viewer,/entityEdit&&doc\?bspPreviewMap\(map,doc\):map/);
 assert.match(viewer,/disabled=\{!source\|\|entityEdit\}/);
});

test('editing duplicate keyvalues targets the intended occurrence; viewport uses the last rendered origin',()=>{
 const doc=addNativeProperty(make(),2,'origin','5 6 7');
 const moved=read(bspMovePoint(doc,2,[12,13,14]));
 assert.deepEqual(moved.entities[2].pairs.filter(p=>p.key==='origin').map(p=>p.value),['128 64 16','12 13 14']);
 assert.deepEqual(bspPreviewEntities(moved)[2].origin,[12,13,14]);
 const changed=read(bspSetPointField(doc,2,'origin','9 8 7',1));
 assert.equal(changed.entities[2].pairs[1].value,'9 8 7');
 assert.equal(changed.entities[2].pairs.at(-1).value,'5 6 7');
});
