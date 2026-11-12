import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
require.extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,file);
const {bspResolvedModelPath,bspModelPlacements}=require('../src/engine/bspViewerAssets.ts');
const {readNativeBsp,writeNativeBsp,addNativeEntity,nativeProperty}=require('../src/engine/bspNativeEdit.ts');
const {bspSetPointField,bspPreviewMap}=require('../src/engine/bspVisualEntityEdit.ts');
const entity=(classname,origin=[12,24,36],model='')=>({classname,origin,properties:{classname,origin:origin.join(' '),...(model?{model}:{})}});
const source=(txt)=>{
 const chunks=Array.from({length:15},()=>Buffer.alloc(0));chunks[0]=Buffer.from(txt+'\0','latin1');chunks[3]=Buffer.alloc(12,0x45);chunks[8]=Buffer.from([5,3,9,1]);
 const header=Buffer.alloc(124);header.writeInt32LE(30,0);let offset=124;
 chunks.forEach((data,i)=>{header.writeInt32LE(offset,4+i*8);header.writeInt32LE(data.length,8+i*8);offset+=data.length});
 const all=Buffer.concat([header,...chunks]);return all.buffer.slice(all.byteOffset,all.byteOffset+all.byteLength);
};
test('implicit NPC model resolves from FGD studio or stock model path',()=>{
 assert.equal(bspResolvedModelPath(entity('monster_gman')), 'models/gman.mdl');
 assert.equal(bspResolvedModelPath(entity('monster_zombie'),{'monster_zombie':'models/custom/zombie.mdl'}),'models/custom/zombie.mdl');
 assert.equal(bspResolvedModelPath(entity('monster_zombie',[0,0,0],'models/override.mdl')),'models/override.mdl');
 assert.equal(bspResolvedModelPath(entity('monster_gman',[0,0,0],'*1')),null);
 assert.equal(bspResolvedModelPath(entity('monster_unknown')),null);
 assert.equal(bspResolvedModelPath(entity('monster_zombie'),{'monster_zombie':'models/../hack.mdl'}), 'models/zombie.mdl');
});
test('scene model placements include implicit NPCs and prioritize selected indices',()=>{
 const entities=Array.from({length:90},(_,i)=>entity('monster_zombie',[i,20,30]));
 entities[75]=entity('monster_gman',[400,500,600]);
 const placed=bspModelPlacements(entities,18,2,{},75);
 assert.equal(placed.length,18);
 assert.equal(placed[0].index,75);
 assert.equal(placed[0].path,'models/gman.mdl');
 assert.deepEqual(placed[0].origin,[400,500,600]);
 assert.equal(new Set(placed.map(p=>p.path)).size,2);
});
test('surface placement creates an entity at selected XYZ with model keyvalue; geometry lumps preserved',()=>{
 const original=source('{\n"classname" "worldspawn"\n}\n');
 const parsed=readNativeBsp(original);
 const placed=addNativeEntity(parsed,'item_generic','128.5 64 -16');
 const withModel=bspSetPointField(placed,1,'model','models/gman.mdl');
 const result=writeNativeBsp(withModel),verified=readNativeBsp(result);
 assert.equal(nativeProperty(verified.entities[1],'origin'),'128.5 64 -16');
 assert.equal(nativeProperty(verified.entities[1],'model'),'models/gman.mdl');
 assert.equal(nativeProperty(parsed.entities[0],'classname'),'worldspawn');
 assert.deepEqual(Buffer.from(result,verified.lumps[8].offset,verified.lumps[8].length),Buffer.from(original,parsed.lumps[8].offset,parsed.lumps[8].length));
 const view=bspPreviewMap({entities:[],faces:[7],stats:{entities:0}},verified);
 assert.deepEqual(view.entities[1].origin,[128.5,64,-16]);
 assert.deepEqual(view.faces,[7]);
});
test('BSP UI exposes dedicated top editor tab, compact menus, model library, and surface placement',()=>{
 const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
 const viewer=fs.readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
 const library=fs.readFileSync(new URL('../src/components/BspModelLibrary.tsx',import.meta.url),'utf8');
 assert.match(app,/bsp-editor-global-tab/);assert.match(app,/editingRequested=\{bspEditorActive\}/);
 assert.match(viewer,/bsp-toolbar-compact/);assert.match(viewer,/bsp-toolbar-popover/);assert.match(viewer,/BspModelLibrary/);
 assert.match(viewer,/onPlace=\{brushPaste&&!fly\?pasteBrushAt:placement&&!fly\?placePointAt:undefined\}/); // preserves point placement while enabling brush-target placement
 assert.match(viewer,/setPlacement\(\{classname,model,spec\}\)/); // model behavior presets are retained until surface click
 assert.match(viewer,/onClick=\{\(\)=>startPlacement\(newEntityClass\)\}/);
 assert.match(library,/\/api\/assets\/models/);assert.match(library,/ModelPreviewModal/);
 assert.match(library,/onPlace\(modelSpec.spec\)/); // explicitly validated native behavior replaces item_generic-only placement
});
