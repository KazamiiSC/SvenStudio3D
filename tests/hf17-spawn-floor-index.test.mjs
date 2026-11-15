import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnFloorZ,createSpawnFloorIndex} from '../src/engine/spawnPresentation.ts';
import {createBrush} from '../src/engine/geometry.ts';
function collection(n){
 const result=[];
 for(let i=0;i<n;i++){
   const x=((i*137)%39-19)*90,y=((i*61)%33-16)*70,z=(i%7)*24;
   const b=createBrush(i%9===0?'wedge':'box',[x,y,z],[48+i%5*9,64+i%7*8,16+i%3*13]);
   b.rotation=[i%11===0?5:0,0,i%7===0?i%3*15:0];
   b.hidden=i%47===0;
   if(i%31===0)b.entityId='func_door';
   result.push(b);
 }
 return result;
}
test('HF17 indexed floor markers match original triangle ray hits on rotated and hidden brushes',()=>{
 const brushes=collection(400);
 const frozen=JSON.stringify(brushes);
 const indexed=createSpawnFloorIndex(brushes);
 for(let i=0;i<160;i++){
   const spawn=[((i*113)%41-20)*95,((i*73)%35-17)*64,20+(i%14)*34];
   const expected=spawnFloorZ(spawn,brushes);
   const actual=indexed(spawn);
   assert.ok(Math.abs(expected-actual)<1e-6,`floor for ${spawn}: ${expected} vs ${actual}`);
 }
 assert.equal(JSON.stringify(brushes),frozen,'geometry and MAP objects remain unchanged');
});
test('HF17 floor index preserves caller fallback, tallest supporting surface and no-floor behavior',()=>{
 const floor=createBrush('box',[0,0,-8],[128,128,16]);
 const platform=createBrush('box',[0,0,24],[64,64,16]);
 const idx=createSpawnFloorIndex([floor,platform]);
 for(const spawn of [[0,0,48],[0,0,20],[400,0,48],[35,0,48]]){
   for(const fallback of [36,48,0])assert.equal(idx(spawn,fallback),spawnFloorZ(spawn,[floor,platform],fallback));
 }
});
