import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);
const {readNativeBsp,writeNativeBsp,nativeProperty}=require('../src/engine/bspNativeEdit.ts');
const {bspPreviewEntities}=require('../src/engine/bspVisualEntityEdit.ts');
const {bspConnectEntities,bspEntityConnections,bspConnectionPositions,bspSetMultiplePointFields,bspTranslatePoints,bspFlagValue}=require('../src/engine/bspEntityWorkflow.ts');
const sourceText=`{
"classname" "worldspawn"
}
{
"classname" "func_door"
"model" "*1"
"origin" "100 0 0"
}
{
"classname" "monster_zombie"
"origin" "10 0 10"
"spawnflags" "8"
}
{
"classname" "monster_barney"
"origin" "20 0 10"
"spawnflags" "16"
}
{
"classname" "trigger_relay"
"origin" "30 0 10"
"target" "missing"
}
`;
function bsp(text=sourceText){
 const lumps=Array.from({length:15},()=>Buffer.alloc(0));lumps[0]=Buffer.from(text+'\0','latin1');lumps[2]=Buffer.from([44,22,18]);lumps[8]=Buffer.from([2,3,4,5]);lumps[14]=Buffer.alloc(48,0xee);
 const header=Buffer.alloc(124);header.writeInt32LE(30,0);let offset=124;
 for(let i=0;i<15;i++){header.writeInt32LE(offset,4+i*8);header.writeInt32LE(lumps[i].length,8+i*8);offset+=lumps[i].length;}
 const bytes=Buffer.concat([header,...lumps]);return bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length);
}
const open=()=>readNativeBsp(bsp());
const roundTrip=doc=>readNativeBsp(writeNativeBsp(doc));
test('creates a unique targetname on an unnamed brush destination without moving its model',()=>{
 const before=open(),modified=roundTrip(bspConnectEntities(before,2,1));
 const name=nativeProperty(modified.entities[1],'targetname');
 assert.match(name,/func_door_bsp1/);assert.equal(nativeProperty(modified.entities[2],'target'),name);
 assert.equal(nativeProperty(modified.entities[1],'model'),'*1');assert.equal(nativeProperty(before.entities[1],'targetname'),'');
});
test('existing shared targetname preserved and all connections resolved',()=>{
 let doc=open();doc=bspConnectEntities(doc,2,1,'trigger_target');const saved=nativeProperty(doc.entities[1],'targetname');
 doc=bspConnectEntities(doc,3,1,'killtarget');
 assert.equal(nativeProperty(doc.entities[1],'targetname'),saved);
 const graph=bspEntityConnections(bspPreviewEntities(doc));
 assert.deepEqual(graph.connections.map(c=>[c.from,c.to,c.key]),[[2,1,'trigger_target'],[3,1,'killtarget']]);
 assert.deepEqual(graph.unresolved.map(x=>x.name),['missing']);
});
test('case insensitive target matching, multiple same-name destinations and limited geometry',()=>{
 let doc=open();doc=bspConnectEntities(doc,2,3);
 const name=nativeProperty(doc.entities[3],'targetname');
 doc=bspConnectEntities(doc,4,3);
 const source=bspPreviewEntities(doc);
 const graph=bspEntityConnections(source,[2]);
 assert.equal(graph.connections.length,1);
 assert.equal(graph.connections[0].name,name);
 assert.equal(bspConnectionPositions(source,graph.connections).length,1);
});
test('group moving changes origins of points only and keeps their relative spacing',()=>{
 const before=open(),after=roundTrip(bspTranslatePoints(before,[2,3],[64,-32,16]));
 assert.equal(nativeProperty(after.entities[2],'origin'),'74 -32 26');
 assert.equal(nativeProperty(after.entities[3],'origin'),'84 -32 26');
 assert.equal(nativeProperty(after.entities[1],'origin'),'100 0 0');
 assert.equal(nativeProperty(before.entities[2],'origin'),'10 0 10');
});
test('group move and batch editing reject brush entities atomically',()=>{
 const before=open();assert.throws(()=>bspTranslatePoints(before,[2,1],[12,0,0]),/Select 1/);
 assert.throws(()=>bspSetMultiplePointFields(before,[2,1],'health','50'),/Select 1/);
 assert.throws(()=>bspSetMultiplePointFields(before,[2,3],'origin','0 0 0'),/Bulk editing/);
 assert.equal(nativeProperty(before.entities[2],'origin'),'10 0 10');
});
test('batch property updates make one native document and preserve unrelated values',()=>{
 const changed=roundTrip(bspSetMultiplePointFields(open(),[2,3,2],'health','125'));
 assert.equal(nativeProperty(changed.entities[2],'health'),'125');assert.equal(nativeProperty(changed.entities[3],'health'),'125');
 assert.equal(nativeProperty(changed.entities[2],'spawnflags'),'8');
 assert.equal(nativeProperty(changed.entities[4],'health'),'');
});
test('spawnflag checkbox preserves unknown bits and validates input',()=>{
 assert.equal(bspFlagValue('128',2,true),'130');assert.equal(bspFlagValue('130',2,false),'128');
 assert.equal(bspFlagValue('2147483648',1,true),'2147483649');
 assert.equal(bspFlagValue('-2147483648',1,true),'-2147483647');
 assert.equal(bspFlagValue('0',2147483648,true),'2147483648');
 assert.throws(()=>bspFlagValue('bad',1,true),/Spawnflags/);
 assert.throws(()=>bspFlagValue('128',3,true),/Invalid FGD/);
});
test('the resulting BSP only changes the entities lump; original geometry lumps remain byte identical',()=>{
 const original=bsp();const before=readNativeBsp(original);
 let changed=bspConnectEntities(before,2,1);
 changed=bspSetMultiplePointFields(changed,[2,3],'spawnflags','32');
 changed=bspTranslatePoints(changed,[2,3],[0,0,48]);
 const output=writeNativeBsp(changed),verified=readNativeBsp(output);
 assert.equal(verified.entities.length,before.entities.length);
 for(let i=1;i<15;i++){
   assert.deepEqual(verified.lumps[i],before.lumps[i]);
   const lump=before.lumps[i];assert.deepEqual(Buffer.from(output,lump.offset,lump.length),Buffer.from(original,lump.offset,lump.length));
 }
});
test('the editor exposes links, FGD flags, batch edit and safe export alongside the camera panels',()=>{
 const src=fs.readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
 for(const token of ['BspConnectionLines','bspConnectEntities','bspTranslatePoints','bspSetMultiplePointFields','bspFlagValue','FGD options and spawnflags','BspNavigation','bsp-panel-splitter','writeNativeBsp(doc)'])assert.ok(src.includes(token),`Missing ${token}`);
});
test('empty targetname is replaced, not duplicated, even on a compiled brush destination',()=>{
 const original=open();
 const {addNativeProperty}=require('../src/engine/bspNativeEdit.ts');
 const doc=addNativeProperty(original,1,'targetname','');
 const changed=roundTrip(bspConnectEntities(doc,2,1));
 assert.deepEqual(changed.entities[1].pairs.filter(p=>p.key==='targetname').map(p=>p.value),['func_door_bsp1']);
});
