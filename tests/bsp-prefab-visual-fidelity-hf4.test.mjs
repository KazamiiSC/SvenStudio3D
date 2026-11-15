import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMeshGeometry,transformedVertices} from '../src/engine/geometry.ts';
import {isBspSurfacePanel,isBspSyntheticClosure} from '../src/engine/bspPrefabSurfaceFlags.ts';
import {repairBspSurfacePanels} from '../src/engine/bspPrefabPanelRepair.ts';
import {createPrefab,placePrefab} from '../src/engine/prefabs.ts';
import {exportBrush,validateBrush} from '../src/engine/exportMap.ts';
import {normalizedUvAt} from '../src/engine/valve220UV.ts';
import {createBrush} from '../src/engine/geometry.ts';

const frontTexture='FIFTIES_DR4';
/** Reproduce an HF2 worldspawn face panel with the original BSP texinfo. */
function legacyPanel(x=0,name='OldDoor panel 1'){
 const rectangle=[[x,0,4],[x+64,0,4],[x+64,0,132],[x,0,132]];
 const normal=[0,-1,0],thickness=2;
 const back=rectangle.map(([vx,vy,vz])=>[vx,vy+thickness,vz]);
 const vertices=[...rectangle,...back];const n=4;
 const origin=[x+32,1,68];
 const axes={texture:frontTexture,uAxis:[1,0,0],vAxis:[0,0,-1],uShift:21.75,vShift:-6.5,uScale:1,vScale:1};
 const makeFace=indices=>({indices,...structuredClone(axes)});
 return {id:`panel-${x}`,kind:'brush',primitive:'poly',name,layer:'Imported BSP',group:'Door',position:origin,rotation:[0,0,0],scale:[1,1,1],vertices:vertices.map(p=>p.map((v,i)=>v-origin[i])),faces:[
   makeFace([0,1,2,3]),makeFace([7,6,5,4]),
   makeFace([0,4,5,1]),makeFace([1,5,6,2]),makeFace([2,6,7,3]),makeFace([3,7,4,0])
 ]};
}
const expectedFront=brush=>{
 const face=brush.faces[0],world=transformedVertices(brush);
 return face.indices.map(i=>[
   normalizedUvAt(world[i],face.uAxis,face.uScale,face.uShift,64),
   1-normalizedUvAt(world[i],face.vAxis,face.vScale,face.vShift,128)
 ]);
};
const geometryUVs=brush=>{
 const geo=buildMeshGeometry(brush,new Map([[frontTexture,{width:64,height:128}]]));
 const uv=geo.getAttribute('uv');const rows=Array.from({length:uv.count},(_,i)=>[uv.getX(i),uv.getY(i)]);
 const groups=geo.groups.map(g=>g.materialIndex);geo.dispose();return {rows,groups};
};
const close=(a,b)=>a.every((v,i)=>Math.abs(v-b[i])<1e-5);

test('HF4: generated back and sides are invisible, source BSP face UV stays byte-for-byte in the brush',()=>{
 const original=legacyPanel();assert.deepEqual(validateBrush(original),[]);
 const before=structuredClone(original.faces[0]);
 const repaired=repairBspSurfacePanels([original])[0];
 assert.deepEqual(repaired.faces[0],before);
 assert.equal(repaired.faces[1].bspPrefabGeneratedBack,true);
 assert.equal(repaired.faces.slice(2).every(f=>f.bspPrefabGeneratedCap),true);
 assert.deepEqual(geometryUVs(repaired).groups,[0]);
 assert.equal(geometryUVs(repaired).rows.length,4);
 assert.ok(geometryUVs(repaired).rows.every((uv,i)=>close(uv,expectedFront(repaired)[i])));
 assert.equal(isBspSurfacePanel(repaired),true);
 assert.equal(isBspSyntheticClosure(repaired,0,repaired.faces[0]),false);
});

test('HF4: HF2 and HF3 already-placed MAP geometry hides synthetic closures without reimport',()=>{
 const hf2=legacyPanel(),hf3=legacyPanel();
 for(const face of hf3.faces.slice(2))face.bspPrefabGeneratedCap=true;
 assert.deepEqual(geometryUVs(hf2).groups,[0]);
 assert.deepEqual(geometryUVs(hf3).groups,[0]);
 for(const brush of [hf2,hf3]){
   const map=exportBrush(brush),lines=map.split('\n').filter(l=>l.trim().startsWith('('));
   assert.equal(lines.length,6);assert.match(lines[0],/FIFTIES_DR4/);
   assert.equal(lines.slice(1).filter(l=>/\sNULL\s/.test(l)).length,5);
   assert.equal(lines.slice(1).filter(l=>/FIFTIES_DR4/.test(l)).length,0);
   assert.deepEqual(validateBrush(brush),[]);
 }
});

test('HF4: placing the old BSP prefab preserves original UV in local texture space on repeated placements',()=>{
 const brush=legacyPanel(),prefab=createPrefab([brush],'Old door');
 prefab.recovery={mode:'surface-shell'}; // as persisted by HF2
 const source=expectedFront(brush),saved=JSON.stringify(prefab);
 for(const at of [[240,120,0],[-256,128,512]]){
   const [placed]=placePrefab(prefab,at);
   assert.deepEqual(geometryUVs(placed).groups,[0]);
   assert.deepEqual(validateBrush(placed),[]);
   assert.ok(expectedFront(placed).every((uv,i)=>close(uv,source[i])));
   assert.match(exportBrush(placed),/FIFTIES_DR4/);
 }
 assert.equal(JSON.stringify(prefab),saved);
});

test('HF4: ordinary MAP brushes and full BSP solids are not stripped of their faces or real textures',()=>{
 const ordinary=createBrush('box',[0,0,0],[64,64,64],frontTexture);
 const full={...ordinary,id:'original-bsp-solid',layer:'Imported BSP',primitive:'poly'};
 for(const brush of [ordinary,full]){
   assert.equal(isBspSurfacePanel(brush),false);
   assert.equal(geometryUVs(brush).groups.length,brush.faces.length);
   assert.ok(!exportBrush(brush).includes(' NULL '));
 }
});

test('HF4: compiled original front UV offsets and axes persist, only closures become NULL',()=>{
 const brush=legacyPanel();const before=structuredClone(brush.faces[0]);
 const output=exportBrush(brush).split('\n').find(line=>/FIFTIES_DR4/.test(line));
 assert.ok(output?.includes('[ 1 0 0 21.75 ] [ 0 0 -1 -6.5 ] 0 1 1'));
 assert.deepEqual(brush.faces[0],before); // read-only recovery, no face material mutation
});
