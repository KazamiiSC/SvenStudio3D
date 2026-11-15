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

type Bucket={material:THREE.Material;positions:number[];uvs:number[];normals:number[];ids:Set<string>;triangles:number};

export function isOpaqueBatchMaterial(material:THREE.Material|undefined):material is THREE.Material{
  if(!material||!material.visible)return false;
  const candidate=material as THREE.MeshStandardMaterial;
  return !candidate.transparent && candidate.opacity===1 && candidate.depthWrite!==false &&
    !(candidate.alphaTest>0) && candidate.blending===THREE.NormalBlending && material.side===THREE.DoubleSide;
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
  if(brush.hidden||brush.entityId||brush.faces.length===0||brush.faces.some(f=>f.bspPrefabInternalCap))return false;
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
        if(!bucket){bucket={material,positions:[],uvs:[],normals:[],ids:new Set(),triangles:0};buckets.set(material,bucket);}
        for(let off=group.start;off<group.start+group.count;off+=3){
          if(off+2>=index.count)break;
          // A negative scale reverses winding. Preserve the original DoubleSide
          // face shading by reversing the baked triangle winding too.
          const order=reversed?[0,2,1]:[0,1,2];
          for(const j of order){
            const v=index.getX(off+j);
            p.fromBufferAttribute(position,v).applyMatrix4(transform);
            n.fromBufferAttribute(normal,v).applyMatrix3(normalMatrix).normalize();
            bucket.positions.push(p.x,p.y,p.z);
            bucket.uvs.push(uv.getX(v),uv.getY(v));
            bucket.normals.push(n.x,n.y,n.z);
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
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(bucket.positions,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(bucket.uvs,2));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(bucket.normals,3));
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
