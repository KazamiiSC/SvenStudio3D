import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEFAULT_UNIVERSAL_PLACEMENT,normalizeUniversalPlacement,freeRayPoint,
  computeUniversalPlacement,readUniversalPlacement,saveUniversalPlacement
} from '../src/engine/universalPlacement.ts';
const root=new URL('../src/',import.meta.url);
const read=path=>fs.readFileSync(new URL(path,root),'utf8');
const position=(mode,free,plane=700)=>computeUniversalPlacement(
  normalizeUniversalPlacement({...DEFAULT_UNIVERSAL_PLACEMENT,mode,planeZ:plane}),
  [20,0,40],[55,66,plane],null,16,0,free
);
test('free camera ray has actual depth and is unrelated to world Z plane',()=>{
  const forward=freeRayPoint([0,0,100],[1,0,-1],512);
  assert.ok(forward[0]>350&&forward[2]<-260);
  assert.deepEqual(position('free',forward,2048),forward);
  assert.deepEqual(position('grid',forward,2048),[48,64,2048]);
  assert.deepEqual(position('surface',forward,2048),[16,0,48]);
  const up=freeRayPoint([0,0,0],[0,0,1],256);
  assert.deepEqual(up,[0,0,256]);
  const down=freeRayPoint([0,0,0],[0,0,-1],256);
  assert.deepEqual(down,[0,0,-256]);
});
test('depth is clamped safely and never creates NaN or an infinite placement',()=>{
  assert.equal(normalizeUniversalPlacement({freeDepth:-99}).freeDepth,32);
  assert.equal(normalizeUniversalPlacement({freeDepth:999999}).freeDepth,8192);
  assert.equal(normalizeUniversalPlacement({freeDepth:NaN}).freeDepth,512);
  assert.deepEqual(freeRayPoint([0,0,1],[0,0,0],500),[0,0,1]);
  assert.deepEqual(freeRayPoint([0,0,1],[0,0,1],Infinity),[0,0,513]);
});
test('stage is transient and does not reopen a frozen placement in a fresh browser',()=>{
  const original=globalThis.localStorage;const values=new Map();
  globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};
  try{
    saveUniversalPlacement(normalizeUniversalPlacement({twoStep:true,staged:true,lockPosition:true,position:[1,2,3]}));
    const read=readUniversalPlacement();
    assert.equal(read.twoStep,true);
    assert.equal(read.staged,false);
    assert.equal(read.lockPosition,false);
  }finally{if(original===undefined)delete globalThis.localStorage;else globalThis.localStorage=original;}
});
test('main viewport passes the same free 3D ray position to click and preview',()=>{
  const source=read('components/Viewport.tsx');
  assert.match(source,/freeRayPoint\(threeToGame\(ray\.ray\.origin\),threeToGame\(ray\.ray\.direction\),settings\.freeDepth\)/);
  assert.match(source,/computeUniversalPlacement\(settings,worldPoint,threeToGame\(groundPoint\),objectPoint,step,elevation,freePoint\)/);
  assert.match(source,/function surfaceHit[\s\S]*function placementAt/);
  assert.match(source,/const hit=surfaceHit\(e,camera,scene,canvas,align\)/);
});
test('single UI with 3 modes; WASD input focus is restored after using controls',()=>{
  const panel=read('components/UniversalPlacementPanel.tsx');
  const viewport=read('components/Viewport.tsx');
  assert.match(panel,/universal-placement-three-modes/);
  assert.match(panel,/\['surface','grid','free'\]/);
  assert.doesNotMatch(panel,/<select\b/);
  assert.match(panel,/closest\('button'\);if\(button\)button\.blur\(\)/);
  assert.match(panel,/\(e\.target as HTMLElement\)\.blur\(\)/);
  assert.match(viewport,/input:not\(\[type=range\]\),textarea,select,\[contenteditable\]/);
  assert.match(viewport,/canvas\.addEventListener\('wheel',wheel,\{capture:true,passive:false\}\)/);
  assert.match(viewport,/event\.altKey[\s\S]*prefs\.mode==='free'/);
});
test('two-step placement is cancellable and does not write geometry until confirmation',()=>{
  const viewport=read('components/Viewport.tsx');
  const store=read('store.ts');
  assert.match(viewport,/if\(!settings\.twoStep\|\|state\.drawMode\|\|state\.placementShape\|\|state\.placementPrefabId\)return/);
  assert.match(viewport,/state\.setUniversalPlacement\(\{position:\[\.\.\.hover\],lockPosition:true,staged:true\}\)/);
  assert.match(viewport,/current\.twoStep&&!current\.staged[\s\S]*placeShapeAt/);
  assert.match(viewport,/current\.twoStep&&!current\.staged[\s\S]*placePrefabAt/);
  assert.match(store,/cancelPendingPlacement:[\s\S]*staged:false/);
  assert.match(viewport,/onPointerUpCapture=\{e=>\{[\s\S]*state\.cancelPendingPlacement\(\)/);
  assert.match(viewport,/onPointerMoveCapture=\{e=>/);
});
test('all six locales have instructions for depth and confirmation',()=>{
  const source=read('i18n.ts');
  for(const locale of ['es','ru','ko','zh','pt'])assert.match(source,new RegExp(`Object\\.assign\\(${locale},\\{[^\\n]*"Distance from camera"`));
  assert.match(source,/First click: position · Second click: create/);
});
