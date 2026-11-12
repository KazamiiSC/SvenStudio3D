import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {
  DEFAULT_UNIVERSAL_PLACEMENT,normalizeUniversalPlacement,computeUniversalPlacement,
  closestPlacementVertex,closestPlacementEdge,clampPlacement,readUniversalPlacement,saveUniversalPlacement
} from '../src/engine/universalPlacement.ts';
const require=createRequire(import.meta.url);
const ts=require('typescript');
const settings=(updates={})=>normalizeUniversalPlacement({...DEFAULT_UNIVERSAL_PLACEMENT,...updates});
const calculate=(config,hit=[96,80,150],floor=[98,79,32],vertex=null,step=1,elevation=0)=>computeUniversalPlacement(settings(config),hit,floor,vertex,step,elevation);

test('safe default and invalid settings sanitize without leaking NaN to placement',()=>{
 assert.equal(readUniversalPlacement().mode,'surface');
 const item=normalizeUniversalPlacement({mode:'malicious',planeZ:Infinity,offsetZ:-999999,position:[1,NaN,300000],objectSnapRadius:-12});
 assert.equal(item.mode,'surface');assert.equal(item.planeZ,0);assert.equal(item.offsetZ,-32768);
 assert.deepEqual(item.position,[1,0,32768]);assert.equal(item.objectSnapRadius,1);
 assert.equal(clampPlacement(-Infinity),0);
});
test('surface placement preserves physical brush point and snapping',()=>{
 assert.deepEqual(calculate({},[100.2,80.8,55.4],[5,3,0],null,8),[104,80,56]);
});
test('workplane and free mode ignore other solid geometry and choose exact workplane height',()=>{
 assert.deepEqual(calculate({mode:'grid',planeZ:-256},[50,60,900],[40.9,99.1,-256],null,8),[40,96,-256]);
 assert.deepEqual(calculate({mode:'free',planeZ:768},[12,20,200],[64,32,768]),[64,32,768]);
 assert.deepEqual(calculate({mode:'free',planeZ:101.25},[100,200,300],[19.75,-21.25,101.25],null,16),[19.75,-21.25,101.25]);
 assert.deepEqual(calculate({mode:'grid',planeZ:101.25},[100,200,300],[19.75,-21.25,101.25],null,16),[16,-16,101.25]);
});
test('relative mode adds user Z offset and per-tool native elevation',()=>{
 assert.deepEqual(calculate({mode:'relative',offsetZ:-96},[100,200,300],null,null,8,24),[104,200,232]);
 assert.deepEqual(calculate({mode:'surface'},[0,0,300],null,null,16,8),[0,0,304]);
});
test('object mode takes snapped vertex if present, otherwise keeps ordinary face hit',()=>{
 assert.deepEqual(calculate({mode:'object'},[10,20,30],[0,0,0],[12,24,32]),[12,24,32]);
 assert.deepEqual(calculate({mode:'object'},[10,20,30],[0,0,0]),[10,20,30]);
 assert.deepEqual(calculate({mode:'object'},[10,20,30],[0,0,0],[12.75,24.25,31.5],16),[12.75,24.25,31.5]);
});
test('manual XYZ lock is exact, even with snapping enabled and no visible surface',()=>{
 assert.deepEqual(calculate({lockPosition:true,position:[11.25,-2048,777]},null,null,null,64),[11.25,-2048,777]);
});
test('empty space falls back to user-selected workplane rather than forcing Z=0',()=>{
 assert.deepEqual(calculate({mode:'surface',planeZ:512},null,[12,34,512]),[12,34,512]);
 assert.equal(calculate({mode:'surface'},null,null),null);
});
test('vertex snapping uses nearest vertex inside radius without mutating source',()=>{
 const vertices=[[10,10,20],[0,0,0],[5,8,9]];
 assert.deepEqual(closestPlacementVertex([8,9,19],vertices,12),[10,10,20]);
 assert.deepEqual(closestPlacementVertex([100,100,100],vertices,12),null);
 assert.deepEqual(vertices,[[10,10,20],[0,0,0],[5,8,9]]);
});
test('object snapping uses original polygon edges and not interior triangle diagonals',()=>{
 const square=[[0,0,0],[100,0,0],[100,100,0],[0,100,0]];
 assert.deepEqual(closestPlacementEdge([48,3,0],square,8),[48,0,0]);
 assert.deepEqual(closestPlacementEdge([50,50,0],square,8),null);
 assert.deepEqual(closestPlacementEdge([99,99,0],square,8),[100,99,0]);
});
test('settings are persisted only as UI preferences and recover from corrupted data',()=>{
 const initial=globalThis.localStorage;
 const data=new Map();globalThis.localStorage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};
 try{
   saveUniversalPlacement(settings({mode:'free',planeZ:1024}));
   assert.deepEqual(readUniversalPlacement().mode,'free');assert.equal(readUniversalPlacement().planeZ,1024);
   data.set('svenstudio:universal-placement-v194','broken');
   assert.equal(readUniversalPlacement().mode,'surface');
 }finally{if(initial===undefined)delete globalThis.localStorage;else globalThis.localStorage=initial}
});
test('shared resolver is used by all compatible click-to-place tools',()=>{
 const vp=fs.readFileSync(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8');
 for(const name of ['PrimitivePlacement','PrefabClickPlacement','EnvironmentPlacement','BlueprintClickPlacement','TerrainClickPlacement','NpcClickPlacement','AudioClickPlacement','CinematicClickPlacement']){
   assert.match(vp,new RegExp(`function ${name}\\(\\)[\\s\\S]*?(?=\\nfunction |\\n/\\*\\*)`),`missing ${name}`);
 }
 for(const fn of ['TerrainClickPlacement','NpcClickPlacement','AudioClickPlacement','CinematicClickPlacement','TextureDropHandler']){
   const begin=vp.indexOf(`function ${fn}()`),end=vp.indexOf('\nfunction ',begin+9);
   assert.ok(vp.slice(begin,end>begin?end:undefined).includes('surfaceHit('),`${fn} bypasses shared placement`);
 }
 assert.match(vp,/function surfaceHit\([\s\S]*?computeUniversalPlacement/);
 assert.match(vp,/<UniversalPlacementGuide\/>/);
 assert.match(vp,/<UniversalPlacementPanel\/>/);
 assert.match(vp,/function DrawBrushPlane\([\s\S]*?workplaneZ/);
});
test('viewport and new UI parse cleanly as TSX and preserve constrained wall openings',()=>{
 for(const file of ['Viewport.tsx','UniversalPlacementPanel.tsx']){
   const source=fs.readFileSync(new URL(`../src/components/${file}`,import.meta.url),'utf8');
   const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
   assert.equal(ast.parseDiagnostics.length,0,`${file}: ${ast.parseDiagnostics.map(x=>x.messageText).join('; ')}`);
 }
 const source=fs.readFileSync(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8');
 assert.match(source,/function Wall|function BrushVisual/);
 assert.match(source,/architecturePlacement/);
});
