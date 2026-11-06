import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function loadWithStubs(source,stubs={}){
 const js=ts.transpileModule(readFileSync(path.join(base,source),'utf8'),{
  fileName:source,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
 }).outputText;
 const exports={};new Function('require','exports',js)((id)=>{if(id in stubs)return stubs[id];throw Error(`Unexpected import: ${id}`)},exports);return exports;
}
const marker=loadWithStubs('src/engine/entityAppearance.ts');
const spawn=loadWithStubs('src/engine/spawnPresentation.ts',{'./geometry':{transformedVertices:b=>b.vertices}});
function floorBrush(xy=0,top=0,id='floor'){
 const width=128;
 return {id,kind:'brush',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices:[[-width,-width,top],[width,-width,top],[width,width,top],[-width,width,top]],faces:[{indices:[0,1,2,3]}]};
}
test('smaller marker defaults and five valid render shapes',()=>{
 assert.equal(marker.DEFAULT_ENTITY_APPEARANCE.markerSize,.75);
 assert.deepEqual(marker.ENTITY_MARKER_SHAPES,['box','bubble','capsule','diamond','cone']);
 for(const shape of marker.ENTITY_MARKER_SHAPES)assert.equal(marker.normalizeEntityAppearance({markerShape:shape}).markerShape,shape);
 assert.equal(marker.normalizeEntityAppearance({markerShape:'nonexistent'}).markerShape,'box');
});
test('backwards compatible old settings scale migration',()=>{
 globalThis.localStorage={getItem:()=>JSON.stringify({markerSize:1.35,colors:{spawn:'#123456'}})};
 const loaded=marker.loadEntityAppearance();
 assert.ok(Math.abs(loaded.markerSize-.75)<1e-9);assert.equal(loaded.markerShape,'box');assert.equal(loaded.colors.spawn,'#123456');
});
test('spawn yaw uses angles with legacy angle fallback',()=>{
 assert.equal(spawn.spawnYaw({angles:'0 90 0'}),90);
 assert.equal(spawn.spawnYaw({angle:'180'}),180);
 assert.equal(spawn.spawnYaw({angles:'0 -90 0'}),270);
 assert.equal(spawn.withSpawnYaw({angles:'10 22 30'},270),'10 270 30');
 assert.equal(spawn.withSpawnYaw({},450),'0 90 0');
});
test('spawn floor is computed without moving the entity origin',()=>{
 const spawnPosition=[0,0,48];
 assert.equal(spawn.spawnFloorZ(spawnPosition,[floorBrush(0,0)]),0);
 assert.deepEqual(spawnPosition,[0,0,48]);
});
test('spawn stands on the highest valid supporting floor below it',()=>{
 assert.equal(spawn.spawnFloorZ([0,0,48],[floorBrush(0,0),floorBrush(0,32,'platform')]),32);
 assert.equal(spawn.spawnFloorZ([0,0,48],[floorBrush(0,100)]),12); // fallback 48 - 36
});
test('spawn ignores brush entities, hidden surfaces and distant unsupported terrain',()=>{
 assert.equal(spawn.spawnFloorZ([0,0,48],[{...floorBrush(0,32),entityId:'func-door'}]),12);
 assert.equal(spawn.spawnFloorZ([0,0,48],[{...floorBrush(0,32),hidden:true}]),12);
 assert.equal(spawn.spawnFloorZ([400,400,48],[floorBrush(0,0)]),12);
});
test('HF7 UI integrations keep entity data as-is',()=>{
 const viewport=readFileSync(path.join(base,'src/components/Viewport.tsx'),'utf8');
 const props=readFileSync(path.join(base,'src/components/Panels.tsx'),'utf8');
 const modal=readFileSync(path.join(base,'src/components/EntityAppearanceModal.tsx'),'utf8');
 const app=readFileSync(path.join(base,'src/App.tsx'),'utf8');
 assert.match(viewport,/spawnGrounds\.get\(obj\.id\)/);
 assert.match(viewport,/animate=\{isSpawn\|\|walking/);
 assert.match(viewport,/spawnFloorOffset=\{isSpawn\?groundOffset/);
 assert.match(props,/updateSpawnYaw/);assert.match(props,/className="spawn-facing-editor"/);
 assert.match(modal,/ENTITY_MARKER_SHAPES/);
 assert.match(app,/src="\/kz-sheez-logo\.png"/);
});
