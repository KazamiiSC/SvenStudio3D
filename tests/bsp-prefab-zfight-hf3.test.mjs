import test from 'node:test';
import assert from 'node:assert/strict';
import {repairBspSurfacePanels,deduplicateBspSurfacePanels} from '../src/engine/bspPrefabPanelRepair.ts';
import {extractBspObjectPrefab} from '../src/engine/bspObjectExtractor.ts';
import {buildMeshGeometry,transformedVertices} from '../src/engine/geometry.ts';
import {placePrefab,validatePrefab} from '../src/engine/prefabs.ts';
import {validateBrush,exportBrush} from '../src/engine/exportMap.ts';

const name='DOORFRONT';
function embedded(){
 const width=16,height=16,mipSizes=[256,64,16,4];
 const raw=new Uint8Array(40+340+2+768),v=new DataView(raw.buffer);
 raw.set(new TextEncoder().encode(name));v.setUint32(16,width,true);v.setUint32(20,height,true);
 let off=40;for(const [i,size] of mipSizes.entries()){v.setUint32(24+i*4,off,true);raw.fill(75+i,off,off+size);off+=size}
 v.setUint16(off,256,true);for(let i=0;i<256;i++)for(let j=0;j<3;j++)raw[off+2+i*3+j]=i;
 const p=132,src=new Uint8Array(p+8+raw.length),view=new DataView(src.buffer);
 view.setInt32(0,30,true);view.setInt32(20,p,true);view.setInt32(24,8+raw.length,true);
 view.setInt32(p,1,true);view.setInt32(p+4,8,true);src.set(raw,p+8);return src.buffer;
}
function face(points,id){return {bspFaceIndex:id,model:0,texture:0,flags:0,points,normal:[0,0,1],sTexinfo:[1,0,0,0],tTexinfo:[0,1,0,0],texels:[],lightWidth:0,lightHeight:0,lightMin:[0,0]}}
const grid=(cols,rows)=>{
 const faces=Array.from({length:cols*rows},(_,i)=>{
  const x=i%cols,y=Math.floor(i/cols),x0=16*x,y0=16*y;
  return face([[x0,y0,0],[x0+16,y0,0],[x0+16,y0+16,0],[x0,y0+16,0]],i);
 });
 return {version:30,name:'door.bsp',faces,textures:[{name,width:16,height:16,external:false}],entities:[],wadNames:[],skyname:'',warnings:[],stats:{faces:faces.length,vertices:16,models:1,leaves:0,entities:0,lightmappedFaces:0,embeddedTextures:1},bounds:{min:[0,0,0],max:[cols*16,rows*16,16]}};
};
function internalCount(brushes){return brushes.reduce((count,brush)=>count+brush.faces.filter(f=>f.bspPrefabInternalCap).length,0)}

test('HF4: four adjacent door faces show only real BSP polygons and retain every MAP brush plane',()=>{
 const map=grid(2,2),source=embedded();
 const prefab=extractBspObjectPrefab(map,source,[0,1,2,3],'Door',[],{mode:'surface-shell'});
 assert.equal(prefab.recovery.mode,'surface-shell');assert.equal(prefab.objects.length,4);
 assert.equal(internalCount(prefab.objects),8); // four shared seams, 2 caps each
 for(const brush of prefab.objects){
  assert.deepEqual(validateBrush(brush),[]);
  assert.equal(brush.faces.filter(f=>f.bspPrefabGeneratedCap).length,4);
  assert.equal(brush.faces.length,6);
  assert.match(exportBrush(brush),/DOORFRONT/);
  const geom=buildMeshGeometry(brush,new Map([[name,{width:16,height:16}]]));
  const visibleFaces=[0]; // all fabricated closures are invisible in HF4
  assert.deepEqual(geom.groups.map(group=>group.materialIndex),visibleFaces);
  assert.equal(geom.userData.trianglesToFaces.length,geom.index.count/3);
  assert.equal(geom.groups.reduce((s,g)=>s+g.count,0),geom.index.count);
  geom.dispose();
 }
 assert.equal(new Uint8Array(source)[0],30);
});

test('HF3: T-junction between one long cap and two shorter neighbors is fully hidden, but outer perimeter remains visible',()=>{
 const m=grid(1,3);
 m.faces=[
  face([[0,0,0],[16,0,0],[16,32,0],[0,32,0]],0),
  face([[16,0,0],[32,0,0],[32,16,0],[16,16,0]],1),
  face([[16,16,0],[32,16,0],[32,32,0],[16,32,0]],2),
 ];
 const prefab=extractBspObjectPrefab(m,embedded(),[0,1,2],'Tjunction',[],{mode:'surface-shell'});
 assert.equal(prefab.objects.length,3);assert.equal(internalCount(prefab.objects),5);
 assert.ok(prefab.objects.every(b=>validateBrush(b).length===0));
});

test('HF3: old HF2 prefab upgrades automatically on placement, including cap UVs, while original saved file remains untouched',()=>{
 const m=grid(2,1),prefab=extractBspObjectPrefab(m,embedded(),[0,1],'OldDoor',[],{mode:'surface-shell'});
 const old=structuredClone(prefab);
 for(const brush of old.objects)for(const f of brush.faces.slice(2)){
  delete f.bspPrefabInternalCap;delete f.bspPrefabGeneratedCap;
  f.uAxis=[...brush.faces[0].uAxis];f.vAxis=[...brush.faces[0].vAxis];
 }
 const original=JSON.stringify(old);
 const placed=placePrefab(old,[500,600,100]);
 assert.equal(placed.length,2);assert.equal(internalCount(placed),2);
 assert.ok(placed.some(b=>b.faces.slice(2).some(f=>f.bspPrefabGeneratedCap&&f.vAxis?.[2]===-1)));
 assert.ok(placed.every(b=>validateBrush(b).length===0));
 assert.equal(JSON.stringify(old),original);
});

test('HF4: a solo panel still has four solid boundary caps but only source front is textured',()=>{
 const prefab=extractBspObjectPrefab(grid(1,1),embedded(),[0],'SoloDoor',[],{mode:'surface-shell'});
 assert.equal(internalCount(prefab.objects),0);
 assert.equal(prefab.objects[0].faces.filter(f=>f.bspPrefabGeneratedCap).length,4);
 assert.deepEqual(validateBrush(prefab.objects[0]),[]);
 assert.doesNotThrow(()=>validatePrefab(prefab));
 const before=prefab.objects[0];const after=repairBspSurfacePanels([before])[0];
 assert.equal(internalCount([after]),0);
 assert.equal(after.faces[2].uAxis.join(','),before.faces[2].uAxis.join(','));
});

test('HF3: exactly duplicated front polygons are removed, different materials are not',()=>{
 const prefab=extractBspObjectPrefab(grid(1,1),embedded(),[0],'Dup',[],{mode:'surface-shell'});
 const a=prefab.objects[0],b=structuredClone(a);b.id='copy';
 assert.equal(deduplicateBspSurfacePanels([a,b]).length,1);
 b.faces[0].texture='OTHERWAD';assert.equal(deduplicateBspSurfacePanels([a,b]).length,2);
});
