import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {constrainDecalToBrush} from '../src/engine/decalSurface.ts';
import {inferOpaqueDecalBackdrop} from '../src/engine/decalAlpha.ts';
const read=f=>readFileSync(new URL(`../${f}`,import.meta.url),'utf8');
const cube=(rotation=[0,0,0])=>({id:'wall',kind:'brush',name:'wall',primitive:'box',position:[0,0,0],rotation,scale:[1,1,1],vertices:[[-10,-10,-10],[10,-10,-10],[10,10,-10],[-10,10,-10],[-10,-10,10],[10,-10,10],[10,10,10],[-10,10,10]],faces:[{indices:[0,3,2,1],texture:'T'},{indices:[4,5,6,7],texture:'T'},{indices:[0,1,5,4],texture:'T'},{indices:[3,7,6,2],texture:'T'},{indices:[0,4,7,3],texture:'T'},{indices:[1,2,6,5],texture:'T'}]});
test('HF1: dragging a decal along a wall preserves its native 0.8 unit offset',()=>{
 assert.deepEqual(constrainDecalToBrush(cube(),[0,0,1],[0,0,10.8],[4,5,80]),[4,5,10.8]);
});
test('HF1: never allows a decal beyond the original wall face',()=>{
 assert.deepEqual(constrainDecalToBrush(cube(),[0,0,1],[0,0,10.8],[35,-6,10.8]),[10,-6,10.8]);
});
test('HF1: supports rotated walls and keeps position on the proper face',()=>{
 const brush=cube([0,45,0]),n=[Math.SQRT1_2,0,Math.SQRT1_2];
 const old=n.map(v=>v*10.8),candidate=[4,3,8];
 const positioned=constrainDecalToBrush(brush,n,old,candidate);
 assert.ok(positioned);
 assert.ok(Math.abs(positioned[0]*n[0]+positioned[2]*n[2]-10.8)<1e-4);
 assert.ok(Math.abs(positioned[1]-3)<1e-4);
});
test('HF1: refuses non-finite positions and missing support faces',()=>{
 assert.equal(constrainDecalToBrush(cube(),[0,0,1],[0,0,10.8],[NaN,0,3]),null);
 assert.equal(constrainDecalToBrush(cube(),[0,0,1],[0,0,40],[1,2,3]),null);
});
test('HF1: border flood removes only connected opaque WAD backgrounds',()=>{
 const w=8,h=8,pixels=new Uint8Array(w*h).fill(1),palette=new Uint8Array(768);
 palette[3]=250;palette[4]=250;palette[5]=249;
 for(let y=2;y<6;y++)for(let x=2;x<6;x++)pixels[y*w+x]=2;
 pixels[3*w+3]=1; // enclosed white detail is kept
 const mask=inferOpaqueDecalBackdrop(pixels,w,h,palette);
 assert.ok(mask);assert.equal(mask[0],1);assert.equal(mask[3*w+3],0);assert.equal(mask[3*w+2],0);
 palette[3]=30;palette[4]=30;palette[5]=30;
 assert.equal(inferOpaqueDecalBackdrop(pixels,w,h,palette),null);
});
test('HF1: drag commits only once; MAP still uses native infodecal without angles',()=>{
 const v=read('src/components/Viewport.tsx'),s=read('src/store.ts'),m=read('src/engine/exportMap.ts');
 assert.match(v,/onPointerMove:during/);assert.match(v,/d\.changed&&d\.latest\)move\(object\.id,d\.latest\)/);
 assert.match(s,/moveDecalOnSurface:\(id,position\)=>set/);
 assert.match(s,/constrainDecalToBrush/);
 assert.doesNotMatch(m,/decalRotation|decalScale/);
});
