import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
require.extensions['.ts']=(mod,path)=>mod._compile(ts.transpileModule(readFileSync(path,'utf8'),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}
}).outputText,path);
const {bspModelEntitySpec,bspValidateModelHull,bspConvertModelEntity,defaultBspModelSettings,bspCanConvertModelEntity}=
  require('../src/engine/bspModelPlacement.ts');
const {readNativeBsp,writeNativeBsp,nativeProperty,addNativeEntity}=
  require('../src/engine/bspNativeEdit.ts');
const {bspSetPointField}=require('../src/engine/bspVisualEntityEdit.ts');

const options=values=>({...defaultBspModelSettings,...values});
const build=(text)=>{
 const lumps=Array.from({length:15},()=>Buffer.alloc(0));
 lumps[0]=Buffer.from(text+'\0','latin1');lumps[2]=Buffer.from([9,5,4,7]);
 lumps[8]=Buffer.from([16,18,20,22]);lumps[14]=Buffer.alloc(20,0x7f);
 const header=Buffer.alloc(124);header.writeInt32LE(30,0);let offset=124;
 for(let i=0;i<15;i++){header.writeInt32LE(offset,4+8*i);header.writeInt32LE(lumps[i].length,8+8*i);offset+=lumps[i].length}
 const data=Buffer.concat([header,...lumps]);return data.buffer.slice(data.byteOffset,data.byteOffset+data.length);
};
const text=`{
"classname" "worldspawn"
}
{
"classname" "item_generic"
"origin" "16 32 48"
"angles" "0 90 0"
"model" "models/gman.mdl"
"solid" "-1"
"movetype" "-1"
"sequencename" "idle"
"targetname" "gman_source"
"target" "open_door"
"custom_key" "keep_me"
}
{
"classname" "func_door"
"model" "*1"
"origin" "64 0 0"
}
{
"classname" "trigger_relay"
"origin" "0 0 64"
}
`;
const source=build(text),open=()=>readNativeBsp(source);
const roundtrip=doc=>readNativeBsp(writeNativeBsp(doc));
const property=(doc,index,key)=>nativeProperty(doc.entities[index],key);
const gman='models/gman.mdl';

test('decoration uses nonblocking item_generic with stable model and supports optional idle',()=>{
 const spec=bspModelEntitySpec(gman,options({mode:'decoration',sequenceName:'idle',scale:'1.5'}));
 assert.equal(spec.classname,'item_generic');
 assert.equal(spec.properties.solid,'-1');assert.equal(spec.properties.movetype,'-1');
 assert.equal(spec.properties.sequencename,'idle');assert.equal(spec.properties.scale,'1.5');
 assert.equal(spec.properties.model,gman);
 assert.equal(spec.properties.health,undefined);
});
test('solid model specifies hull for blocking player collisions, but remains item_generic',()=>{
 const spec=bspModelEntitySpec(gman,options({mode:'solid',minHull:'-20 -20 0',maxHull:'20 20 74'}));
 assert.equal(spec.classname,'item_generic');assert.equal(spec.properties.solid,'2');
 assert.equal(spec.properties.minhullsize,'-20 -20 0');assert.equal(spec.properties.maxhullsize,'20 20 74');
 assert.equal(bspValidateModelHull('-20 -20 0','20 20 74').max,'20 20 74');
 for(const pair of [['0 0 0','0 20 30'],['1 2 3','1 2 4'],['0 0 0','0 0 0'],['-1 bad 0','10 20 50']])
   assert.throws(()=>bspValidateModelHull(...pair));
});
test('NPC collision hull is optional and validated before native BSP export',()=>{
 const spec=bspModelEntitySpec(gman,options({mode:'npc',customNpcHull:true,minHull:'-16 -16 0',maxHull:'16 16 72'}));
 assert.equal(spec.properties.minhullsize,'-16 -16 0');
 assert.equal(spec.properties.maxhullsize,'16 16 72');
 const normal=bspModelEntitySpec(gman,options({mode:'npc'}));
 assert.equal(normal.properties.minhullsize,undefined);
 assert.throws(()=>bspModelEntitySpec(gman,options({mode:'npc',customNpcHull:true,maxHull:'0 0 0'})));
});
test('cycler is bullet-hit model preview and is not monster AI',()=>{
 const spec=bspModelEntitySpec(gman,options({mode:'cycler'}));
 assert.equal(spec.classname,'cycler');assert.equal(spec.properties.model,gman);
 assert.equal(spec.properties.health,undefined);assert.equal(spec.properties.solid,undefined);
});
test('native NPC presets use requested class, health, ally, roaming, spawnflags and optional weapons',()=>{
 const spec=bspModelEntitySpec('models/hgrunt.mdl',options({mode:'npc',npcClassname:'monster_human_grunt',
   health:'175',ally:true,roaming:'2',weapons:'8',spawnflags:'128',displayname:'Guardian',disableAI:false}),['monster_generic','monster_human_grunt']);
 assert.equal(spec.classname,'monster_human_grunt');assert.equal(spec.properties.health,'175');
 assert.equal(spec.properties.weapons,'8');assert.equal(spec.properties.spawnflags,'128');
 assert.equal(spec.properties.is_player_ally,'1');assert.equal(spec.properties.freeroam,'2');
 assert.equal(spec.properties.displayname,'Guardian');assert.equal(spec.properties.disableai,undefined);
});
test('NPC engine class must be explicitly allowed; weapon loadout never applies to G-Man',()=>{
 assert.throws(()=>bspModelEntitySpec(gman,options({mode:'npc',npcClassname:'trigger_relay'}),['monster_generic']),/monster class/);
 assert.throws(()=>bspModelEntitySpec(gman,options({mode:'npc',npcClassname:'monster_zombie'}),['monster_generic']),/monster class/);
 const spec=bspModelEntitySpec(gman,options({mode:'npc',npcClassname:'monster_generic',weapons:'128',disableAI:true}),['monster_generic']);
 assert.equal(spec.properties.weapons,undefined);assert.equal(spec.properties.disableai,'1');
});
test('invalid path traversal, hull, numeric values and property injection are rejected',()=>{
 const cases=[
  ()=>bspModelEntitySpec('models/../../bad.mdl',options({mode:'solid'})),
  ()=>bspModelEntitySpec('assets/gman.mdl',options({mode:'solid'})),
  ()=>bspModelEntitySpec(gman,options({mode:'solid',maxHull:'16 16 0'})),
  ()=>bspModelEntitySpec(gman,options({mode:'npc',health:'Infinity'})),
  ()=>bspModelEntitySpec(gman,options({mode:'npc',spawnflags:'-1'})),
  ()=>bspModelEntitySpec(gman,options({mode:'solid',scale:'100'})),
  ()=>bspModelEntitySpec(gman,options({mode:'npc',targetname:'oops"\nmalformed'}))
 ];for(const check of cases)assert.throws(check);
});
test('G-Man item_generic converts to native NPC model entity preserving position, orientation and links',()=>{
 const before=open();const spec=bspModelEntitySpec(gman,options({mode:'npc',npcClassname:'monster_generic',health:'100',ally:false}));
 const changed=bspConvertModelEntity(before,1,spec);
 const saved=roundtrip(changed);
 assert.equal(property(saved,1,'classname'),'monster_generic');assert.equal(property(saved,1,'health'),'100');
 assert.equal(property(saved,1,'origin'),'16 32 48');assert.equal(property(saved,1,'angles'),'0 90 0');
 assert.equal(property(saved,1,'targetname'),'gman_source');assert.equal(property(saved,1,'target'),'open_door');
 assert.equal(property(saved,1,'custom_key'),'keep_me');assert.equal(property(saved,1,'solid'),'');
 assert.equal(property(saved,1,'sequencename'),'');
 assert.equal(property(before,1,'classname'),'item_generic');
});
test('converted entity can be changed to solid item_generic, preserving origin and targetname',()=>{
 let doc=bspConvertModelEntity(open(),1,bspModelEntitySpec(gman,options({mode:'npc'})));
 doc=bspConvertModelEntity(doc,1,bspModelEntitySpec(gman,options({mode:'solid',maxHull:'24 24 80'})));
 const saved=roundtrip(doc);
 assert.equal(property(saved,1,'classname'),'item_generic');
 assert.equal(property(saved,1,'solid'),'2');assert.equal(property(saved,1,'maxhullsize'),'24 24 80');
 assert.equal(property(saved,1,'origin'),'16 32 48');assert.equal(property(saved,1,'targetname'),'gman_source');
 assert.equal(saved.entities[1].pairs.filter(p=>p.key==='model').length,1);
});
test('worldspawn, compiled brush entity and triggers cannot be converted to models',()=>{
 const doc=open(),spec=bspModelEntitySpec(gman,options({mode:'npc'}));
 for(const index of [0,2,3])assert.throws(()=>bspConvertModelEntity(doc,index,spec));
 assert.equal(bspCanConvertModelEntity('trigger_relay'),false);
 assert.equal(bspCanConvertModelEntity('item_generic'),true);
});
test('fresh placements write class/model/hull as entity lump without modifying compiled lumps',()=>{
 let doc=open();const spec=bspModelEntitySpec(gman,options({mode:'solid',minHull:'-16 -16 0',maxHull:'16 16 72'}));
 const index=doc.entities.length;doc=addNativeEntity(doc,spec.classname,'256 0 4');
 for(const [key,value] of Object.entries(spec.properties))doc=bspSetPointField(doc,index,key,value);
 const out=writeNativeBsp(doc),saved=readNativeBsp(out);
 assert.equal(saved.entities.length,5);assert.equal(property(saved,4,'solid'),'2');
 assert.equal(property(saved,4,'maxhullsize'),'16 16 72');
 for(let i=1;i<15;i++){
  assert.deepEqual(saved.lumps[i],open().lumps[i]);
  const lump=saved.lumps[i];assert.deepEqual(Buffer.from(source,lump.offset,lump.length),Buffer.from(out,lump.offset,lump.length));
 }
});
test('UI uses configured entity presets, conversion, six languages and responsive library layout',()=>{
 const viewer=readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
 const library=readFileSync(new URL('../src/components/BspModelLibrary.tsx',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 const i18n=readFileSync(new URL('../src/i18n.ts',import.meta.url),'utf8');
 assert.match(viewer,/placement\.spec\.properties/);
 assert.match(viewer,/onConvert=\{spec=>/);
 assert.match(library,/bspModelEntitySpec/);assert.match(library,/Place configured model in 3D/);
 assert.match(library,/Convert selected model entity/);
 assert.match(css,/\.bsp-model-mode-switch/);assert.match(css,/@media\(max-width:560px\)/);
 for(const lang of ['es','en','ru','ko','zh','pt'])assert.match(i18n,new RegExp(`Object\\.assign\\(${lang},\\{[\\s\\S]*?'Placement behavior'`));
});
