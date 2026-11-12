import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseBsp} from '../src/engine/bsp.ts';
import {bspSelectSurfaceRegion,bspToggleRegionSelection,BSP_REGION_SELECTION_LIMIT} from '../src/engine/bspRegionSelection.ts';
const face=(id,texture,model,points)=>({bspFaceIndex:id,texture,model,points,normal:[0,0,1],texels:[],flags:0,lightWidth:1,lightHeight:1,lightMin:[0,0]});
const square=(x,y)=>[[x,y,0],[x+2,y,0],[x+2,y+2,0],[x,y+2,0]];
const toy={faces:[
 face(10,1,0,square(0,0)), // connected material island
 face(12,1,0,square(2,0)),
 face(13,2,0,square(4,0)), // connected but a different material
 face(15,1,0,square(50,0)), // same material, disconnected
 face(21,3,1,square(0,10)),
 face(23,4,1,square(2,10)), // same compiled submodel; different material
 face(40,3,2,square(0,20))
]};

test('HF8: one click selects connected same-texture worldspawn surface island, never all matching texture faces',()=>{
 const group=bspSelectSurfaceRegion(toy,10);
 assert.equal(group.kind,'material-island');assert.equal(group.reason,'');assert.deepEqual(group.indices,[10,12]);
 assert.deepEqual(bspSelectSurfaceRegion(toy,15).indices,[15]);
 assert.deepEqual(bspSelectSurfaceRegion(toy,13).indices,[13]);
});
test('HF8: BSP T-junction split edges select the same material island',()=>{
  const map={faces:[
    face(1,7,0,[[0,0,0],[4,0,0],[4,2,0],[0,2,0]]),
    face(2,7,0,[[4,0,0],[5,0,0],[5,1,0],[4,1,0]]),
    face(3,7,0,[[4,1,0],[5,1,0],[5,2,0],[4,2,0]]),
    face(4,7,0,[[4,2,0],[5,2,0],[5,3,0],[4,3,0]])
  ]};
  assert.deepEqual(bspSelectSurfaceRegion(map,1).indices,[1,2,3,4]);
});
test('HF8: compiled *N model is selected whole even across different textures',()=>{
 assert.deepEqual(bspSelectSurfaceRegion(toy,21).indices,[21,23]);
 assert.equal(bspSelectSurfaceRegion(toy,21).kind,'submodel');
 assert.deepEqual(bspSelectSurfaceRegion(toy,40).indices,[40]);
});
test('HF8: limit rejects entire region rather than silently returning incomplete brush',()=>{
 const group=bspSelectSurfaceRegion(toy,10,1);
 assert.deepEqual(group.indices,[]);assert.match(group.reason,/more than 1/);
 const model=bspSelectSurfaceRegion(toy,21,1);assert.deepEqual(model.indices,[]);assert.match(model.reason,/No partial/);
 assert.equal(BSP_REGION_SELECTION_LIMIT,256);
});
test('HF8: additive selection toggles all faces in a group and refuses overflow',()=>{
 assert.deepEqual(bspToggleRegionSelection([40],[10,12],true),[40,10,12]);
 assert.deepEqual(bspToggleRegionSelection([40,10,12],[10,12],true),[40]);
 assert.deepEqual(bspToggleRegionSelection([40,10],[10,12],false),[10,12]);
 assert.equal(bspToggleRegionSelection([40],[10,12],true,2),null);
});
test('HF8: original BSP face indices survive skipped faces and no mutation to map',()=>{
 const bytes=readFileSync(new URL('./fixtures/maptest1_lighting_v159.bsp',import.meta.url));
 const map=parseBsp(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 const first=map.faces.find(f=>f.model===0);assert.ok(first);
 const before=map.faces.map(f=>f.bspFaceIndex);
 const group=bspSelectSurfaceRegion(map,first.bspFaceIndex);
 assert.equal(group.kind,'material-island');
 assert.equal(group.reason,'');assert.ok(group.indices.includes(first.bspFaceIndex));
 assert.deepEqual(map.faces.map(f=>f.bspFaceIndex),before);
});
