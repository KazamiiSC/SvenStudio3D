import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
require.extensions['.ts']=(mod,path)=>mod._compile(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText,path);
const {bspRecommendedNpcClass,bspModelEntitySpec,defaultBspModelSettings}=require('../src/engine/bspModelPlacement.ts');
const {parseFgd}=require('../src/engine/fgd.ts');
const {bspDeletePoint}=require('../src/engine/bspVisualEntityEdit.ts');
const {readNativeBsp,writeNativeBsp}=require('../src/engine/bspNativeEdit.ts');
const {bspToggleSelection}=require('../src/engine/bspSelection.ts');
const ui=readFileSync(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
const assets=readFileSync(new URL('../src/components/BspViewerAssets.tsx',import.meta.url),'utf8');
const library=readFileSync(new URL('../src/components/BspModelLibrary.tsx',import.meta.url),'utf8');
const pack=text=>{
 const lumps=Array.from({length:15},()=>Buffer.alloc(0));lumps[0]=Buffer.from(text+'\0','latin1');lumps[2]=Buffer.from([9,5,4,7]);
 const header=Buffer.alloc(124);header.writeInt32LE(30,0);let offset=124;
 for(let i=0;i<15;i++){header.writeInt32LE(offset,4+8*i);header.writeInt32LE(lumps[i].length,8+8*i);offset+=lumps[i].length}
 const data=Buffer.concat([header,...lumps]);return data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
};
const src=pack(`{
"classname" "worldspawn"
}
{
"classname" "monster_generic"
"origin" "0 0 4"
"model" "models/agrunt.mdl"
}
{
"classname" "monster_generic"
"origin" "10 0 4"
"model" "models/agrunt.mdl"
}
{
"classname" "func_door"
"model" "*1"
}`);
test('known combat NPC model suggests a native class only if loaded by FGD',()=>{
 assert.equal(bspRecommendedNpcClass('models/agrunt.mdl',['monster_generic','monster_alien_grunt']),'monster_alien_grunt');
 assert.equal(bspRecommendedNpcClass('models/agrunt.mdl',['monster_generic']),null);
 assert.equal(bspRecommendedNpcClass('models/hgrunt.mdl',['monster_human_grunt']),'monster_human_grunt');
 assert.equal(bspRecommendedNpcClass('models/my_custom.mdl',['monster_generic']),null);
 const opt={...defaultBspModelSettings,mode:'npc',npcClassname:'monster_alien_grunt',health:'300'};
 const out=bspModelEntitySpec('models/agrunt.mdl',opt,['monster_alien_grunt']);
 assert.equal(out.classname,'monster_alien_grunt');assert.equal(out.properties.health,'300');
});
test('FGD imports resolve cross-file base flags and choices without changing engine entity data',()=>{
 const first=`@BaseClass = MonsterBase [\n spawnflags(flags) : "Flags" = [\n 1 : "Start asleep" : 1\n 4 : "Scripted"\n ]\n]`;
 const second=`@PointClass base(MonsterBase) studio("models/agrunt.mdl") = monster_alien_grunt : "Alien grunt" [\n health(integer) : "Health" : 300\n attack_range(choices) : "Attack range" : 0 = [\n 0 : "Normal"\n 1 : "Far"\n ]\n]`;
 const cls=parseFgd(first+'\n'+second).find(c=>c.name==='monster_alien_grunt');
 assert.ok(cls);assert.equal(cls.props.spawnflags.options.length,2);assert.equal(cls.props.spawnflags.defaultValue,'1');
 assert.equal(cls.props.attack_range.options.length,2);assert.equal(cls.props.health.defaultValue,'300');
});
test('multi-selection Delete removes only point entities in descending index order and preserves original lumps',()=>{
 const doc=readNativeBsp(src);let selected={primary:null,additional:[]};selected=bspToggleSelection(selected,1,false);selected=bspToggleSelection(selected,2,true);
 assert.deepEqual([selected.primary,...selected.additional],[1,2]);
 const desc=[selected.primary,...selected.additional].sort((a,b)=>b-a);
 const edited=desc.reduce((current,index)=>bspDeletePoint(current,index),doc);
 const output=readNativeBsp(writeNativeBsp(edited));
 assert.equal(output.entities.length,2);assert.equal(output.entities[1].pairs[0].value,'func_door');
 const lumpBytes=doc=>[...new Uint8Array(doc.source,doc.lumps[2].offset,doc.lumps[2].length)];
 assert.deepEqual(lumpBytes(output),lumpBytes(doc));assert.deepEqual(lumpBytes(output),[9,5,4,7]);
 assert.equal(readNativeBsp(src).entities.length,4);
 assert.throws(()=>bspDeletePoint(doc,3),/Only point entities/);
});
test('viewport registers right-click entity menu, surface/empty deselection, Escape and Delete input guard',()=>{
 assert.match(ui,/onContextMenu=\{event=>\{event\.stopPropagation\(\);event\.nativeEvent\.preventDefault\(\)/);
 assert.match(assets,/onContextEntity\?\:\(index:number,x:number,y:number\)=>void/);
 assert.match(ui,/event\.code==='Delete'/);
 assert.match(ui,/descending\.reduce\(\(next,index\)=>bspDeletePoint\(next,index\),current\)/);
 assert.match(ui,/onEmptyClick=\{entityEdit&&!fly\?cancelToolOrSelection/);
 assert.match(ui,/onPointerMissed=\{event=>/);
 assert.match(ui,/setExtraSelected\(\[\]\);setMultiSelectMode\(false\)/);
 assert.match(ui,/onPointerDownCapture=\{event=>/);
 assert.match(ui,/contextStart\.current/);
});
test('FGD attribute/flags/raw tabs and temporary import work as presentation only',()=>{
 assert.match(ui,/setExtraFgdFiles\(merged\)/);assert.match(ui,/parseFgd\(extraFgdFiles/);
 assert.match(ui,/propertiesTab==='attributes'/);assert.match(ui,/propertiesTab==='flags'/);assert.match(ui,/propertiesTab==='raw'/);
 assert.match(ui,/bspFlagValue\(current,bit,e\.target\.checked\)/);
 assert.match(library,/bspRecommendedNpcClass\(item\.path,allowedNpcClassnames\)/);
 assert.match(library,/monster_generic is scripted and does not automatically fight/);
});
