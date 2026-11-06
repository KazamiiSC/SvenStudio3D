import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import ts from 'typescript';
import {readShapeDimensions,rememberShapeDimensions} from '../src/engine/shapeDimensions.ts';
import {unitsPerScreenPixel,preciseFaceDistance,FACE_GIZMO_TIP_PIXELS,FACE_GIZMO_HIT_PIXELS} from '../src/engine/gizmoScale.ts';
const text=file=>fs.readFileSync(new URL(`../${file}`,import.meta.url),'utf8');
const store=text('src/store.ts'),shape=text('src/components/ShapePalette.tsx'),view=text('src/components/Viewport.tsx');
const inputs=['src/store.ts','src/components/Viewport.tsx','src/components/ShapePalette.tsx','src/components/ViewportExtras.tsx','src/engine/shapeDimensions.ts','src/engine/gizmoScale.ts','src/i18n.ts','src/App.tsx'];
test('all changed TS/TSX modules parse without syntax errors',()=>{
 for(const name of inputs){const tree=ts.createSourceFile(name,text(name),ts.ScriptTarget.Latest,true,name.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
   assert.equal(tree.parseDiagnostics.length,0,`${name}: ${tree.parseDiagnostics.map(d=>d.messageText).join('; ')}`);
 }
});
const requireHash=(data)=>crypto.createHash('sha256').update(data).digest('hex');
test('original Valve 220 exporter, BSP viewer and backend remain unchanged',()=>{
 assert.match(text('src/engine/exportMap.ts'),/safeFaceTextureAxes\(vertices,face\)/, 'Valve 220 export applies texture basis safety without changing geometry');
 assert.equal(requireHash(text('src/components/BspViewer.tsx')),'161bfa4aa59ca07ee8015222cae7e71355b2025240ed8fba02bbe74909f48919','src/components/BspViewer.tsx');
 assert.equal(requireHash(text('server/index.js')),'4d1de7967aec89380064fb0022891043f5268124b27a4813e44b10141641752d','server/index.js');
});
test('shape dimensions are remembered independently per primitive and validated',()=>{
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 assert.equal(readShapeDimensions('box'),null);
 rememberShapeDimensions('box',[8,4,2]);rememberShapeDimensions('doorframe',[96,24,128]);
 assert.deepEqual(readShapeDimensions('box'),[8,4,2]);assert.deepEqual(readShapeDimensions('doorframe'),[96,24,128]);
 rememberShapeDimensions('box',[NaN,4,2]);assert.deepEqual(readShapeDimensions('box'),[8,4,2]);
 rememberShapeDimensions('box',[32768,4,2]);assert.deepEqual(readShapeDimensions('box'),[8,4,2]);
 data.set('svenstudio:shape-dimensions-v14','{invalid');assert.equal(readShapeDimensions('box'),null);
});
test('project storage/export does not contain UI-only prefab placement state',()=>{
 assert.match(store,/placementPrefabId:null/);assert.match(store,/placePrefabAt:\(position,autoYaw=0\)=>set/);
 assert.match(store,/createPrefab\(s\.project\.objects\.filter/);
 assert.match(store,/placePrefab\(prefab,at,s\.placementAxis,s\.placementAngle,autoYaw\)/);
 assert.match(store,/\.\.\.mutate\(s,\[\.\.\.s\.project\.objects,\.\.\.copies\]\)/);
 assert.match(store,/selectedIds:copies\.map\(o=>o\.id\)/);
});
test('palette closes on selecting shape, exposes saved groups and viewport mouse placement',()=>{
 assert.match(shape,/if\(selected===kind\)\{setShape\(null\);setOpen\(false\)/);
 assert.match(shape,/if\(dimensionsEdited\)setSize\(staged\)/);
 assert.match(shape,/setPlacementPrefab\(pendingPrefab===id\?null:id\);setOpen\(false\)/);
 assert.match(shape,/saveSelection\(name\.trim\(\)\)/);
 assert.match(shape,/category==='prefabs'/);
 assert.match(view,/function PrefabClickPlacement/);
 assert.match(view,/placePrefabAt\(result\.anchor,result\.autoYaw\)/);
 assert.match(view,/e\.key==='Escape'/);
 assert.match(view,/function PrimitivePlacement/);
});
test('face arrows are sized in screen pixels for tiny and large brushes',()=>{
 assert.equal(FACE_GIZMO_TIP_PIXELS,29);assert.ok(FACE_GIZMO_HIT_PIXELS>=12);
 const near=unitsPerScreenPixel({orthographic:false,cameraDepth:50,fovDegrees:60,orthoHeight:1,zoom:1,viewportHeight:900});
 const far=unitsPerScreenPixel({orthographic:false,cameraDepth:5000,fovDegrees:60,orthoHeight:1,zoom:1,viewportHeight:900});
 assert.ok(far/near>99.9);assert.ok(far/near<100.1);
 const orth=unitsPerScreenPixel({orthographic:true,cameraDepth:500,fovDegrees:60,orthoHeight:900,zoom:2,viewportHeight:900});
 assert.equal(orth,.5);
 assert.match(view,/group\.scale\.setScalar\(size\)/);
 assert.match(view,/FACE_GIZMO_TIP_PIXELS\*pixelWorld/);
});
test('fine scaling bypasses grid snap while normal drag snaps',()=>{
 assert.equal(preciseFaceDistance(3.1,4,true,false),4);
 assert.equal(preciseFaceDistance(3.1,4,true,true),.775);
 assert.equal(preciseFaceDistance(-7.9,4,true,false),-8);
 assert.equal(preciseFaceDistance(3.1,4,false,false),3.1);
 assert.match(view,/onPointerCancel/);
 assert.match(view,/transformSelection\(\{\[brush\.id\]:next\}\)/);
 assert.match(view,/function PreciseScalePanel/);
});
test('all six locales include new construction controls',()=>{
 const i18n=text('src/i18n.ts');
 for(const loc of ['es','ru','ko','zh','pt'])assert.match(i18n,new RegExp(`Object\\.assign\\(${loc},\\{[\\s\\S]*?'Reusable constructions'`));
 assert.match(text('src/App.tsx'),/v1\.4\.0/);
});
