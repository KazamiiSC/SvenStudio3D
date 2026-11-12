const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const src=path.resolve(__dirname,'../src');
const read=rel=>fs.readFileSync(path.join(src,rel),'utf8');
test('curves entry points open a World Builder tab instead of another studio',()=>{
 const app=read('App.tsx'),world=read('components/TerrainShapeStudio.tsx');
 assert.doesNotMatch(app,/dialog==='curves'/);
 assert.match(app,/setWorldBuilderStart\(id==='curves'\?'curves':'terrain'\)/);
 assert.match(app,/TerrainShapeStudio initialTab=\{worldBuilderStart\}/);
 assert.match(world,/tab==='curves'\?<CurvedGeometryPanel embedded/);
 assert.match(world,/Curves & Repetitions/);
 assert.match(read('components/QuickToolRail.tsx'),/World Builder · Curves/);
 assert.match(read('components/ViewportExtras.tsx'),/World Builder · Curves/);
});
test('existing curves are still editable; new curved paths use one route generator',()=>{
 const panel=read('components/CurvedGeometryPanel.tsx');
 assert.match(panel,/existing\?'ramp':'array'/);
 assert.match(panel,/existing&&<button/);
 assert.match(panel,/update\(existing.id,settings\)/);
 assert.match(panel,/detach\(existing.id\)/);
 assert.match(panel,/buildCurvedRamp\(settings\)/);
 assert.match(read('components/TerrainShapeStudio.tsx'),/pathKind==='cave'/);
 assert.match(read('engine/pathStructures.ts'),/PathStructureKind='road'\|'walkway'/);
});
test('reusing a route does not replace the original or copy gameplay train identifiers',()=>{
 const world=read('components/TerrainShapeStudio.tsx');
 const code=world.slice(world.indexOf('const copySavedRoute='),world.indexOf('const loadPath=',world.indexOf('const copySavedRoute=')));
 assert.match(code,/setEditingPathId\(null\)/);
 assert.match(code,/setRailwayEnabled\(false\)/);
 assert.match(code,/setRailway\(defaultRailwaySettings\(\)\)/);
 assert.match(code,/setPathSurfacePortals\(false\)/);
 assert.doesNotMatch(code,/updatePathStructure\(/);
 assert.doesNotMatch(code,/applySmartWorld\(/);
 assert.match(world,/onClick=\{copySavedRoute\}/);
});
test('World Builder curve layout is scoped and usable in compact screens',()=>{
 const css=read('style.css');
 assert.match(css,/\.world-builder-shell \.wb-curve-embedded/);
 assert.match(css,/@media \(max-width:1024px\).*wb-curve-embedded/);
 assert.match(css,/\.world-builder-shell \.wb-route-copy\{[^}]*min-height:44px/);
});
test('Studio, Workshop, composite and path project data remain separate',()=>{
 const app=read('App.tsx'),types=read('engine/types.ts'),store=read('store.ts');
 assert.match(app,/dialog==='workshop'&&<BrushWorkshop/);
 for(const k of ['curveAssemblies','brushComposites','terrainGroups','pathGroups'])assert.match(types,new RegExp(k));
 for(const k of ['radialArraySelected','createCurvedRamp','updateCurvedRamp','fuseSelection','separateSelectedComposite'])assert.match(store,new RegExp(k));
});
