/** HF17 HF1: GPU draw-call batching for opaque MAP brush faces.
 * Purely a viewport representation: editor brushes, Valve 220 UV values,
 * face indices and all collision/picker meshes stay independent and unchanged.
 * Transparent, masked and dynamically transformed materials must NOT enter
 * this path because they require their original per-brush depth ordering.
 */
import * as THREE from 'three';
import type {Brush} from './types';
import {buildMeshGeometry,gameToThree,toRenderQuaternion} from './geometry';

export type BrushBatchInput={brush:Brush;materials:readonly THREE.Material[]};
export type OpaqueDrawBatch={material:THREE.Material;geometry:THREE.BufferGeometry;sourceBrushes:number;triangles:number};
export type BrushDrawBatchResult={batches:OpaqueDrawBatch[];batchedIds:ReadonlySet<string>;
  batchedFaceIndices:ReadonlyMap<string,ReadonlySet<number>>;fullyBatchedIds:ReadonlySet<string>;sourceTriangles:number};

/** Growable Float32 buffer: avoids huge boxed number[] arrays (and their garbage) on big maps (v2.4). */
class FloatBuffer{
  data=new Float32Array(1024);length=0;
  push3(a:number,b:number,c:number){this.ensure(3);this.data[this.length++]=a;this.data[this.length++]=b;this.data[this.length++]=c;}
  push2(a:number,b:number){this.ensure(2);this.data[this.length++]=a;this.data[this.length++]=b;}
  private ensure(n:number){if(this.length+n<=this.data.length)return;const next=new Float32Array(Math.max(this.data.length*2,this.length+n));next.set(this.data.subarray(0,this.length));this.data=next;}
  result(){return this.data.length===this.length?this.data:this.data.slice(0,this.length);}
}
type Bucket={material:THREE.Material;positions:FloatBuffer;uvs:FloatBuffer;normals:FloatBuffer;ids:Set<string>;triangles:number};

export function isOpaqueBatchMaterial(material:THREE.Material|undefined):material is THREE.Material{
  if(!material||!material.visible)return false;
  const candidate=material as THREE.MeshStandardMaterial;
  return !candidate.transparent && candidate.opacity===1 && candidate.depthWrite!==false &&
    !(candidate.alphaTest>0) && candidate.blending===THREE.NormalBlending && material.side===THREE.DoubleSide;
  // (wireframe materials are opaque too, so wireframe mode is batched as well — v2.4)
}

export function canBatchBrush(brush:Brush,materials:readonly THREE.Material[]):boolean{
  if(brush.hidden||brush.entityId||brush.faces.length===0||brush.faces.some(f=>f.bspPrefabInternalCap))return false;
  if(!brush.scale.every(n=>Number.isFinite(n)&&n>.00001)||
    !brush.position.every(Number.isFinite)||!brush.rotation.every(Number.isFinite)||
    brush.vertices.some(vertex=>!vertex.every(Number.isFinite)))return false;
  return brush.faces.every((_,index)=>isOpaqueBatchMaterial(materials[index]));
}

/** A textured brush may combine opaque and special (transparent/masked) faces.
 * The opaque subset can still be batched, but its other faces MUST remain
 * rendered individually. This check intentionally preserves all conservative
 * brush-level exclusions from HF17 HF1.
 */
function canBatchOpaqueSubset(brush:Brush,materials:readonly THREE.Material[]):boolean{
  // v2.4: brush-entity brushes are batched too while editing (they only move in Gameplay Test, where batching is off).
  if(brush.hidden||brush.faces.length===0||brush.faces.some(f=>f.bspPrefabInternalCap))return false;
  if(!brush.scale.every(n=>Number.isFinite(n)&&n>.00001)||
    !brush.position.every(Number.isFinite)||!brush.rotation.every(Number.isFinite)||
    brush.vertices.some(vertex=>!vertex.every(Number.isFinite)))return false;
  return brush.faces.some((_,index)=>isOpaqueBatchMaterial(materials[index]));
}

/** Merge opaque triangles by shared material. Original meshes remain as
 * non-rendered raycast targets, retaining exact faceIndex -> face mapping.
 * The normal matrix preserves lighting on rotated or nonuniformly scaled brushes.
 * Chunks are intentionally bounded to preserve frustum culling and edit latency.
 */
export function buildOpaqueBrushBatches(inputs:readonly BrushBatchInput[],sizes?:ReadonlyMap<string,{width:number;height:number}>):BrushDrawBatchResult{
  const buckets=new Map<THREE.Material,Bucket>();
  const batchedIds=new Set<string>();
  const batchedFaceIndices=new Map<string,ReadonlySet<number>>();
  const fullyBatchedIds=new Set<string>();
  let sourceTriangles=0;
  for(const {brush,materials} of inputs){
    if(!canBatchOpaqueSubset(brush,materials))continue;
    const geometry=buildMeshGeometry(brush,sizes);
    try{
      const position=geometry.getAttribute('position'),uv=geometry.getAttribute('uv'),normal=geometry.getAttribute('normal'),index=geometry.getIndex();
      if(!position||!uv||!normal||!index||geometry.groups.length===0)continue;
      // An invalid single brush must never poison a combined buffer's
      // bounding sphere and accidentally make other brushes disappear.
      if([position,uv,normal].some(attribute=>{
        for(let i=0;i<attribute.count;i++)for(let c=0;c<attribute.itemSize;c++)
          if(!Number.isFinite(attribute.getComponent(i,c)))return true;
        return false;
      }))continue;
      const transform=new THREE.Matrix4().compose(gameToThree(brush.position),toRenderQuaternion(brush.rotation),
        new THREE.Vector3(brush.scale[0],brush.scale[2],brush.scale[1]));
      const normalMatrix=new THREE.Matrix3().getNormalMatrix(transform);
      const p=new THREE.Vector3(),n=new THREE.Vector3();
      const reversed=transform.determinant()<0;
      let triangles=0;
      const batchedFaces=new Set<number>();
      for(const group of geometry.groups){
        const material=materials[group.materialIndex??0];
        if(!isOpaqueBatchMaterial(material))continue;
        let bucket=buckets.get(material);
        if(!bucket){bucket={material,positions:new FloatBuffer(),uvs:new FloatBuffer(),normals:new FloatBuffer(),ids:new Set(),triangles:0};buckets.set(material,bucket);}
        for(let off=group.start;off<group.start+group.count;off+=3){
          if(off+2>=index.count)break;
          // A negative scale reverses winding. Preserve the original DoubleSide
          // face shading by reversing the baked triangle winding too.
          const order=reversed?[0,2,1]:[0,1,2];
          for(const j of order){
            const v=index.getX(off+j);
            p.fromBufferAttribute(position,v).applyMatrix4(transform);
            n.fromBufferAttribute(normal,v).applyMatrix3(normalMatrix).normalize();
            bucket.positions.push3(p.x,p.y,p.z);
            bucket.uvs.push2(uv.getX(v),uv.getY(v));
            bucket.normals.push3(n.x,n.y,n.z);
          }
          bucket.triangles++;triangles++;
        }
        bucket.ids.add(brush.id);
        if(group.count>0)batchedFaces.add(group.materialIndex??0);
      }
      if(triangles>0){
        batchedIds.add(brush.id);
        batchedFaceIndices.set(brush.id,batchedFaces);
        if(brush.faces.every((_,index)=>batchedFaces.has(index)))fullyBatchedIds.add(brush.id);
        sourceTriangles+=triangles;
      }
    }finally{geometry.dispose();}
  }
  const batches:OpaqueDrawBatch[]=[];
  for(const bucket of buckets.values()){
    if(bucket.triangles===0)continue;
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(bucket.positions.result(),3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(bucket.uvs.result(),2));
    geometry.setAttribute('normal',new THREE.BufferAttribute(bucket.normals.result(),3));
    geometry.computeBoundingSphere();
    batches.push({material:bucket.material,geometry,sourceBrushes:bucket.ids.size,triangles:bucket.triangles});
  }
  return {batches,batchedIds,batchedFaceIndices,fullyBatchedIds,sourceTriangles};
}
export function disposeOpaqueBatches(result:BrushDrawBatchResult):void{
  for(const batch of result.batches)batch.geometry.dispose();
  // Shared texture/material cache is managed by the viewport and never disposed here.
}

/** Incremental, order-preserving subdivision. Edits in one group never force
 * the renderer to rebuild other groups of the same large-map brush run. */
export function reuseOpaqueBrushChunks(brushes:readonly Brush[],previous:readonly (readonly Brush[])[]=[],chunkSize=96):Brush[][]{
  const result:Brush[][]=[];
  for(let start=0;start<brushes.length;start+=chunkSize){
    const end=Math.min(start+chunkSize,brushes.length);
    const old=previous[result.length];
    if(old&&old.length===end-start&&old.every((item,i)=>item===brushes[start+i]))result.push(old as Brush[]);
    else result.push(brushes.slice(start,end));
  }
  return result;
}

/** v2.4: spatial chunks. Brushes are grouped by a coarse world cell (so a chunk is compact and frustum
 * culling works) and each cell is split into runs of at most `maxPerChunk`. Chunks whose members did not
 * change keep the previous array, so editing one brush only rebuilds its own chunk. */
export type SpatialBrushChunk={key:string;brushes:Brush[]};
export function spatialBrushChunks(brushes:readonly Brush[],previous:ReadonlyMap<string,Brush[]>=new Map(),cell=2048,maxPerChunk=384):SpatialBrushChunk[]{
  const cells=new Map<string,Brush[]>();
  for(const b of brushes){
    let x=0,y=0,z=0;const n=b.vertices.length||1;
    for(const v of b.vertices){x+=v[0];y+=v[1];z+=v[2];}
    const cx=b.position[0]+x/n*b.scale[0],cy=b.position[1]+y/n*b.scale[1],cz=b.position[2]+z/n*b.scale[2];
    const key=`${Math.floor(cx/cell)},${Math.floor(cy/cell)},${Math.floor(cz/cell)}`;
    (cells.get(key)??cells.set(key,[]).get(key)!).push(b);
  }
  const out:SpatialBrushChunk[]=[];
  for(const [key,list] of [...cells].sort((a,b)=>a[0].localeCompare(b[0]))){
    for(let start=0,part=0;start<list.length;start+=maxPerChunk,part++){
      const slice=list.slice(start,start+maxPerChunk),id=`${key}#${part}`,old=previous.get(id);
      out.push({key:id,brushes:old&&old.length===slice.length&&old.every((item,i)=>item===slice[i])?old:slice});
    }
  }
  return out;
}