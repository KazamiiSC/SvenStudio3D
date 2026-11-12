import test from 'node:test';
import assert from 'node:assert/strict';
import {bspRotationArcTriangles,BSP_RING_VISUAL,bspRingBearing,bspRingDragAngle} from '../src/engine/bspRotationRing.ts';

test('compact rotation design stays smaller than HF8, but has a broad pickable annulus',()=>{
  assert.ok(BSP_RING_VISUAL.outerRadius<=26);
  assert.ok(BSP_RING_VISUAL.outerRadius<48); // old HF8 outer radius
  assert.ok(BSP_RING_VISUAL.grabInnerRadius<BSP_RING_VISUAL.innerRadius);
  assert.ok(BSP_RING_VISUAL.grabOuterRadius>BSP_RING_VISUAL.outerRadius);
  assert.ok(BSP_RING_VISUAL.grabOuterRadius-BSP_RING_VISUAL.grabInnerRadius>=20);
  assert.ok(BSP_RING_VISUAL.gapDegrees>0);
});

test('twin curved arrows form valid triangles, limited to a small character-sized radius',()=>{
  const positions=bspRotationArcTriangles();
  const expected=2*BSP_RING_VISUAL.segmentsPerArc*2*3*3;
  assert.equal(positions.length,expected);
  assert.ok(positions.every(n=>Number.isFinite(n)));
  const radii=[];
  for(let i=0;i<positions.length;i+=3){
    assert.equal(positions[i+2],0);
    const radius=Math.hypot(positions[i],positions[i+1]);
    assert.ok(radius<=28 && radius>=17,`unexpected ${radius}`);
    radii.push(radius);
  }
  // Both arrowheads end in a tapered tip at the middle radius.
  const verticesPerArc=BSP_RING_VISUAL.segmentsPerArc*6;
  for(const base of [0,verticesPerArc]){
    assert.ok(Math.abs(radii[base+verticesPerArc-1]-23)<1e-4);
    assert.ok(Math.abs(radii[base+verticesPerArc-2]-23)<1e-4);
  }
});

test('drag math retains relative yaw rather than using displayed arcs as NPC forward',()=>{
  const from=bspRingBearing(1,0,0,0),to=bspRingBearing(0,-1,0,0);
  const next=bspRingDragAngle(Math.PI/3,from,to);
  assert.ok(Math.abs(next-5*Math.PI/6)<1e-8);
});
