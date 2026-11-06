const fs=require('node:fs'),Module=require('node:module'),ts=require('typescript'),assert=require('node:assert/strict');
require.extensions['.ts']=(mod,filename)=>{
 const compiled=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJS},fileName:filename}).outputText;
 mod._compile(compiled,filename);
};
const {useEditor,demoProject}=require('../src/store.ts');
const {defaultTerrain}=require('../src/engine/terrain.ts');
let passed=0;
function test(name,fn){try{fn();console.log('PASS',name);passed++;}catch(e){console.error('FAIL',name,e);process.exitCode=1;}}
const reset=()=>{useEditor.getState().setCompileBusy(false);useEditor.getState().loadProject(demoProject());};
test('Arming and canceling 3D terrain placement cannot mutate the project',()=>{
 reset();const base=JSON.stringify(useEditor.getState().project),draft=defaultTerrain();
 useEditor.getState().startTerrainPlacement({kind:'terrain',draft});
 assert.ok(useEditor.getState().terrainPlacement);
 assert.equal(JSON.stringify(useEditor.getState().project),base);
 useEditor.getState().startTerrainPlacement(null);
 assert.equal(JSON.stringify(useEditor.getState().project),base);
});
test('Clicked terrain is centered on chosen nonzero XYZ and undo restores project',()=>{
 reset();const before=useEditor.getState().project.objects.length,draft=defaultTerrain();
 useEditor.getState().startTerrainPlacement({kind:'terrain',draft});
 useEditor.getState().placePendingTerrain([768,512,32]);
 const s=useEditor.getState();
 assert.equal(s.terrainPlacement,null);
 assert.equal(s.project.objects.length,before+128);
 assert.deepEqual(s.project.terrainGroups[0].origin,[768,512,32]);
 assert.equal(s.project.terrainGroups[0].texture,draft.texture);
 s.undo();assert.equal(useEditor.getState().project.objects.length,before);
});
test('Clicked rock placement respects seed, texture and chosen position and supports Undo',()=>{
 reset();const before=useEditor.getState().project.objects.length;
 const draft={...defaultTerrain(),texture:'SV_CONCRET'};
 useEditor.getState().startTerrainPlacement({kind:'rocks',draft,rocks:{count:4,radius:96,height:64,seed:11}});
 useEditor.getState().placePendingTerrain([1024,256,24]);
 const s=useEditor.getState();const rocks=s.project.objects.slice(before);
 assert.equal(rocks.length,4);
 assert.ok(rocks.every(o=>o.kind==='brush'&&o.faces.every(f=>f.texture==='SV_CONCRET')));
 assert.ok(rocks.every(o=>o.kind==='brush'&&o.position[0]>800&&o.position[1]>100));
 s.undo();assert.equal(useEditor.getState().project.objects.length,before);
});
test('Busy compiling cannot apply armed terrain placement',()=>{
 reset();const project=JSON.stringify(useEditor.getState().project);
 useEditor.getState().startTerrainPlacement({kind:'terrain',draft:defaultTerrain()});
 useEditor.getState().setCompileBusy(true);
 useEditor.getState().placePendingTerrain([256,256,0]);
 assert.equal(JSON.stringify(useEditor.getState().project),project);
 useEditor.getState().setCompileBusy(false);useEditor.getState().startTerrainPlacement(null);
});
test('New project, open project and other placement modes discard stale pending terrain',()=>{
 reset();useEditor.getState().startTerrainPlacement({kind:'terrain',draft:defaultTerrain()});
 useEditor.getState().setPlacementShape('box');assert.equal(useEditor.getState().terrainPlacement,null);
 useEditor.getState().startTerrainPlacement({kind:'terrain',draft:defaultTerrain()});
 useEditor.getState().newProject();assert.equal(useEditor.getState().terrainPlacement,null);
 useEditor.getState().startTerrainPlacement({kind:'terrain',draft:defaultTerrain()});
 useEditor.getState().loadProject(demoProject());assert.equal(useEditor.getState().terrainPlacement,null);
});
test('Texture picker uses stored WAD assets and starter textures; no new MAP format required',()=>{
 const source=fs.readFileSync(require('node:path').join(__dirname,'../src/components/TerrainShapeStudio.tsx'),'utf8');
 assert.match(source,/textureAssets=useEditor\(s=>s\.textureAssets\)/);
 assert.match(source,/parseWad\(file\)/);
 assert.match(source,/Float32BufferAttribute\(uvs,2\)/);
 assert.match(source,/meshStandardMaterial map=\{texture\|\|undefined\}/);
 assert.match(source,/Place by clicking map/);
});
console.log(`Terrain Preview 2 tests ${passed}/6 ${process.exitCode?'FAIL':'PASS'}`);
