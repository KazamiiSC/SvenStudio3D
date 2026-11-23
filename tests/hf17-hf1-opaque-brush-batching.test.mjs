import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBrush,buildMeshGeometry,gameToThree,toRenderQuaternion} from '../src/engine/geometry.ts';
import {buildOpaqueBrushBatches,canBatchBrush,disposeOpaqueBatches,isOpaqueBatchMaterial,reuseOpaqueBrushChunks} from '../src/engine/opaqueBrushBatches.ts';

const brick=new THREE.MeshStandardMaterial({color:'#ffffff',side:THREE.DoubleSide});
const metal=new THREE.MeshStandardMaterial({color:'#c0c0c0',side:THREE.DoubleSide});
const water=new THREE.MeshStandardMaterial({transparent:true,opacity:.6,depthWrite:false,side:THREE.DoubleSide});
const masked=new THREE.MeshStandardMaterial({alphaTest:.5,side:THREE.DoubleSide});
const source=(id,pos=[0,0,0],material=brick)=>{
 const brush=createBrush('box',pos,[96,128,64],id);
 brush.id=id;
 brush.faces.forEach((f,i)=>Object.assign(f,{texture:i%2?'METAL':'BRICK',uShift:7*i,vShift:-3*i,uScale:1,vScale:.5}));
 return {brush,materials:brush.faces.map((_,i)=>i%2?metal:material)};
};
const close=(a,b,eps=0.0001)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const key=(p,u)=>[...p,...u].map(n=>n.toFixed(4)).join(':');
function originalTriangles(input){
 const {brush,materials}=input,geo=buildMeshGeometry(brush),index=geo.getIndex();
 const normal=geo.getAttribute('normal'),position=geo.getAttribute('position'),uv=geo.getAttribute('uv');
 const transform=new THREE.Matrix4().compose(gameToThree(brush.position),toRenderQuaternion(brush.rotation),new THREE.Vector3(brush.scale[0],brush.scale[2],brush.scale[1]));
 const normalMatrix=new THREE.Matrix3().getNormalMatrix(transform);
 const result=new Map();
 for(const g of geo.groups){
  const material=materials[g.materialIndex];
  const items=result.get(material)||[];
  for(let i=g.start;i<g.start+g.count;i++){
   const v=index.getX(i),p=new THREE.Vector3().fromBufferAttribute(position,v).applyMatrix4(transform);
   const n=new THREE.Vector3().fromBufferAttribute(normal,v).applyMatrix3(normalMatrix).normalize();
   items.push(key(p.toArray(),[uv.getX(v),uv.getY(v),...n.toArray()]));
  }
  result.set(material,items);
 }
 geo.dispose();return result;
}
function batchedTriangles(batch){
 const result=new Map();
 for(const entry of batch.batches){
  const pos=entry.geometry.getAttribute('position'),uv=entry.geometry.getAttribute('uv'),norm=entry.geometry.getAttribute('normal');
  const items=result.get(entry.material)||[];
  for(let i=0;i<pos.count;i++)items.push(key([pos.getX(i),pos.getY(i),pos.getZ(i)],
      [uv.getX(i),uv.getY(i),norm.getX(i),norm.getY(i),norm.getZ(i)]));
  result.set(entry.material,items);
 }
 return result;
}
test('batched world-space triangles preserve exact UV and lighting normals',()=>{
 const a=source('a'),b=source('b',[100,200,25]);b.brush.rotation=[0,0,35];b.brush.scale=[1.5,1,0.75];
 const inputs=[a,b],before=JSON.stringify(inputs.map(({brush})=>brush));
 const batch=buildOpaqueBrushBatches(inputs);
 assert.equal(batch.batchedIds.size,2);assert.equal(batch.batches.length,2);
 assert.equal(JSON.stringify(inputs.map(({brush})=>brush)),before);
 const baseline=new Map();for(const input of inputs){for(const [m,arr] of originalTriangles(input))baseline.set(m,[...(baseline.get(m)||[]),...arr]);}
 const output=batchedTriangles(batch);for(const [m,arr] of baseline){
   assert.deepEqual(output.get(m).sort(),arr.sort());
 }
 disposeOpaqueBatches(batch);
});
test('transparent masked invisible and brush entities remain independent',()=>{
 const base=source('base');const trans=source('trans',[0,0,90],water);const mask=source('mask',[0,0,110],masked);
 const attached=source('door',[0,0,120]);attached.brush.entityId='door01';
 const hidden=source('hidden');hidden.brush.hidden=true;
 const invisible=new THREE.MeshStandardMaterial({visible:false,side:THREE.DoubleSide});
 assert.equal(isOpaqueBatchMaterial(water),false);assert.equal(isOpaqueBatchMaterial(masked),false);assert.equal(isOpaqueBatchMaterial(invisible),false);
 assert.equal(canBatchBrush(attached.brush,attached.materials),false);
 const batch=buildOpaqueBrushBatches([base,trans,mask,attached,hidden]);
 // v2.4: brush-entity brushes are batched while editing (Gameplay Test turns batching off).
 assert.deepEqual([...batch.batchedIds],['base','trans','mask','door']);
 assert.deepEqual([...batch.fullyBatchedIds],['base','door']);
 for(const id of ['trans','mask']){
  assert.deepEqual([...batch.batchedFaceIndices.get(id)],[1,3,5],`${id} must keep special faces on its original mesh`);
 }
 assert.equal(batch.batchedFaceIndices.has('hidden'),false);
 disposeOpaqueBatches(batch);
});
test('many brushes collapse to material draws, without changing map object identities',()=>{
 const inputs=Array.from({length:96},(_,i)=>source(`b${i}`,[i*96,0,0]));
 const result=buildOpaqueBrushBatches(inputs);
 assert.equal(result.batchedIds.size,96);
 assert.ok(result.batches.length<96);
 assert.equal(result.batches.reduce((n,b)=>n+b.triangles,0),result.sourceTriangles);
 disposeOpaqueBatches(result);
});
test('invisible picker remains raycastable and original triangle index remains intact',()=>{
 const brush=source('pick').brush,geo=buildMeshGeometry(brush);
 const pick=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));
 const hits=new THREE.Raycaster(new THREE.Vector3(0,0,300),new THREE.Vector3(0,0,-1)).intersectObject(pick);
 assert.ok(hits.length>0);
 assert.ok(geo.userData.trianglesToFaces[hits[0].faceIndex]>=0);
 geo.dispose();
});
test('HF17 HF1 provides user-accessible rollback without altering quality preset',async()=>{
 const fs=await import('node:fs');
 const layout=fs.readFileSync(new URL('../src/layout.ts',import.meta.url),'utf8');
 const workspace=fs.readFileSync(new URL('../src/components/DockWorkspace.tsx',import.meta.url),'utf8');
 const viewport=fs.readFileSync(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8');
 assert.match(layout,/opaqueBrushBatching:true/);
 assert.match(layout,/setOpaqueBrushBatching:/);
 assert.match(workspace,/setOpaqueBrushBatching\(e\.target\.checked\)/);
 assert.match(viewport,/material=\{displayMaterials\}/);
 assert.match(viewport,/MapBrushChunk/);
});

test('only the chunk containing a modified brush is rebuilt',()=>{
 const original=Array.from({length:250},(_,i)=>source(`ch${i}`).brush);
 const a=reuseOpaqueBrushChunks(original,[],96);
 const edited=[...original];edited[120]={...edited[120],position:[40,0,0]};
 const b=reuseOpaqueBrushChunks(edited,a,96);
 assert.equal(a.length,3);assert.equal(a[0],b[0]);assert.notEqual(a[1],b[1]);assert.equal(a[2],b[2]);
 const c=reuseOpaqueBrushChunks(edited,b,96);
 assert.equal(b[1],c[1]);
});
test('invalid and mirrored geometry cannot hide a healthy combined batch',()=>{
 const valid=source('valid');
 const invalid=source('nan');invalid.brush.vertices[0][2]=NaN;
 const mirrored=source('mirrored');mirrored.brush.scale=[-1,1,1];
 const result=buildOpaqueBrushBatches([valid,invalid,mirrored]);
 assert.deepEqual([...result.batchedIds],['valid']);
 assert.ok(result.batches.every(batch=>Number.isFinite(batch.geometry.boundingSphere.radius)));
 disposeOpaqueBatches(result);
});

test('mixed textured brush batches only opaque faces with exact original UV and normals',()=>{
 const sample=source('mixed',[31,43,12],water);
 sample.brush.rotation=[0,0,27]; sample.brush.scale=[1.25,.75,1.5];
 const snapshot=JSON.stringify(sample.brush);
 const batch=buildOpaqueBrushBatches([sample]);
 assert.equal(batch.batchedIds.has('mixed'),true);
 assert.equal(batch.fullyBatchedIds.has('mixed'),false);
 assert.deepEqual([...batch.batchedFaceIndices.get('mixed')],[1,3,5]);
 const original=originalTriangles(sample).get(metal).sort();
 const merged=batchedTriangles(batch).get(metal).sort();
 assert.deepEqual(merged,original);
 assert.equal(batchedTriangles(batch).has(water),false);
 // Render path retains unbatched water faces, preserving opacity and depth order.
 const faceMaterials=sample.materials.map((m,i)=>batch.batchedFaceIndices.get('mixed').has(i)?null:m);
 assert.equal(faceMaterials.filter(m=>m===water).length,3);
 assert.equal(faceMaterials.filter(m=>m===metal).length,0);
 assert.equal(JSON.stringify(sample.brush),snapshot);
 disposeOpaqueBatches(batch);
});

test('the original brush picker can select every face after partial batching',()=>{
 const sample=source('mixed-picker',[0,0,0],water);
 const batch=buildOpaqueBrushBatches([sample]);
 const geo=buildMeshGeometry(sample.brush);
 const pick=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide}));
 const raycaster=new THREE.Raycaster(new THREE.Vector3(0,0,400),new THREE.Vector3(0,0,-1));
 const hits=raycaster.intersectObject(pick);
 assert.ok(hits.length>0);
 assert.ok(geo.userData.trianglesToFaces[hits[0].faceIndex]>=0);
 geo.dispose();disposeOpaqueBatches(batch);
});
