import test from 'node:test';
import assert from 'node:assert/strict';
import {bspRingBearing,bspRingDragAngle} from '../src/engine/bspRotationRing.ts';
const near=(actual,wanted)=>assert.ok(Math.abs(actual-wanted)<1e-9,`${actual} != ${wanted}`);
test('world-facing bearings use correct axes around entity origin',()=>{
 near(bspRingBearing(0,10,0,0),0);
 near(bspRingBearing(10,0,0,0),Math.PI/2);
 near(bspRingBearing(10,-7,10,-9),0);
});
test('rotation crosses the +180/-180 discontinuity without a limb-jump-style snap',()=>{
 const start=179*Math.PI/180,end=-179*Math.PI/180;
 near(bspRingDragAngle(0,start,end),2*Math.PI/180);
 near(bspRingDragAngle(0,end,start),-2*Math.PI/180);
});
test('multiple pointer segments accumulate >360° without losing rotations',()=>{
 const bearings=[0,Math.PI/2,Math.PI,3*Math.PI/2,2*Math.PI,5*Math.PI/2];
 let yaw=0;
 for(let i=1;i<bearings.length;i++)yaw=bspRingDragAngle(yaw,bearings[i-1],bearings[i]);
 near(yaw,5*Math.PI/2);
});
