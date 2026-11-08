/** Editor-only viewport transform helpers. Never change Valve 220 geometry.
 * Anchors are brush-local faces: they work for translated and rotated brushes.
 */
import * as THREE from 'three';
import type {Brush,MapObject,Vec3} from './types';
import {gameToThree,toRenderQuaternion,transformedVertices} from './geometry';

export type ScaleAnchor='center'|'xmin'|'xmax'|'ymin'|'ymax'|'zmin'|'zmax';
export const SCALE_ANCHORS:ReadonlyArray<ScaleAnchor>=['center','xmin','xmax','ymin','ymax','zmin','zmax'];
import {GRID_STEPS,normalizeGridStep} from './gridPrecision';
export {GRID_STEPS};
export function validGridStep(v:number){return normalizeGridStep(v)}
export function snapDelta(v:number,step:number){return Math.round(v/validGridStep(step))*validGridStep(step)}
/** Use visible geometry, not the brush transform origin, as the viewport
 * pivot. Legacy CSG/window fragments can have position=[0,0,0] with all their
 * vertices stored in absolute map coordinates. This also repairs the gizmo for
 * existing saved projects without rewriting their MAP/JSON data. */
export function selectionPivot(object:MapObject):THREE.Vector3{
  // Keep authored pivots for primitives such as arch segments, whose shared
  // center may be intentionally outside their individual geometry. The CSG
  // result is a poly brush, where the geometric center is the safe selection
  // pivot and fixes older absolute-vertex fragments.
  if(object.kind!=='brush'||object.primitive!=='poly'||!object.vertices.length)return gameToThree(object.position);
  const points=transformedVertices(object);
  const mid=[0,1,2].map(axis=>{
    const coordinates=points.map(point=>point[axis]);
    return (Math.min(...coordinates)+Math.max(...coordinates))/2;
  }) as Vec3;
  return gameToThree(mid);
}
export function anchorPosition(brush:Brush,anchor:ScaleAnchor):THREE.Vector3{
  const origin=gameToThree(brush.position);
  if(!brush.vertices.length)return origin;
  if(anchor==='center')return selectionPivot(brush);
  const axis=anchor[0]==='x'?0:anchor[0]==='y'?1:2;
  const sign=anchor.endsWith('min')?-1:1;
  const mins=[0,1,2].map(i=>Math.min(...brush.vertices.map(v=>v[i])));
  const maxes=[0,1,2].map(i=>Math.max(...brush.vertices.map(v=>v[i])));
  const local:Vec3=[(mins[0]+maxes[0])/2,(mins[1]+maxes[1])/2,(mins[2]+maxes[2])/2];
  local[axis]=sign<0?mins[axis]:maxes[axis];
  const offset=gameToThree([local[0]*brush.scale[0],local[1]*brush.scale[1],local[2]*brush.scale[2]]);
  return origin.add(offset.applyQuaternion(toRenderQuaternion(brush.rotation)));
}
/** Keep a chosen brush face fixed while scaling in its local coordinate frame. */
export function anchoredPose(originalPosition:THREE.Vector3,quaternion:THREE.Quaternion,pivot:THREE.Vector3,factors:THREE.Vector3):THREE.Vector3{
  const local=originalPosition.clone().sub(pivot).applyQuaternion(quaternion.clone().invert());
  local.multiply(factors).applyQuaternion(quaternion);
  return pivot.clone().add(local);
}
/** Enlarges invisible TransformControls hit targets without changing visible
 * handles. For a tiny on-screen gizmo the pick thickness must not vanish.
 * Rebuild from the original geometry on size changes (never inflate repeatedly).
 */
export function expandPicker(controls:THREE.Object3D){
  const internals=controls as THREE.Object3D&{size?:number;gizmo?:{picker?:Record<string,THREE.Object3D>}};
  const picker=internals.gizmo?.picker;
  if(!picker)return;
  const size=Math.max(.15,Math.min(2,internals.size||.9));
  const inflation=Math.min(5,Math.max(1.9,1.9*Math.sqrt(.9/size)));
  for(const [mode,group] of Object.entries(picker))for(const child of group.children){
    if(!(child instanceof THREE.Mesh))continue;
    const data=child.userData as {studioPickerBase?:THREE.BufferGeometry;studioPickerSize?:number};
    if(data.studioPickerSize===size)continue;
    const base=data.studioPickerBase??child.geometry;
    data.studioPickerBase=base;
    const geometry=base.clone();
    // Rotation torus geometries are already baked into world-aligned axes.
    // Expand only their tube radius, not the ring radius or visible mesh.
    if(mode==='rotate'&&['X','Y','Z','E'].includes(child.name)){
      const axis=child.name,attr=geometry.getAttribute('position');
      for(let i=0;i<attr.count;i++){
        const p=new THREE.Vector3(attr.getX(i),attr.getY(i),attr.getZ(i));
        const radial=axis==='X'?Math.hypot(p.y,p.z):axis==='Y'?Math.hypot(p.x,p.z):Math.hypot(p.x,p.y);
        const nominal=axis==='E'?1.25:1;
        const expanded=Math.max(.1,nominal+(radial-nominal)*inflation);
        if(radial>.001){const ratio=expanded/radial;
          if(axis==='X'){p.y*=ratio;p.z*=ratio}else if(axis==='Y'){p.x*=ratio;p.z*=ratio}else{p.x*=ratio;p.y*=ratio}}
        if(axis==='X')p.x*=inflation;
        if(axis==='Y')p.y*=inflation;
        if(axis==='Z'||axis==='E')p.z*=inflation;
        attr.setXYZ(i,p.x,p.y,p.z);
      }
    }else if(['X','Y','Z'].includes(child.name)){
      if(child.name==='X')geometry.scale(1,inflation,inflation);
      else if(child.name==='Y')geometry.scale(inflation,1,inflation);
      else geometry.scale(inflation,inflation,1);
    }else if(mode!=='rotate')geometry.scale(Math.min(inflation,2.2),Math.min(inflation,2.2),Math.min(inflation,2.2));
    if(child.geometry!==data.studioPickerBase)child.geometry.dispose();
    child.geometry=geometry;
    data.studioPickerSize=size;
  }
}

/** Quantise brush dimensions to the visible world grid when scaling from a face.
 * Three's scale factors are ordered X,Z,Y because GoldSrc is Z-up. */
export function snapBrushScaleFactors(brush:Brush,base:THREE.Vector3,factors:THREE.Vector3,step:number){
  if(!brush.vertices.length)return factors.clone();
  const min=[0,1,2].map(i=>Math.min(...brush.vertices.map(v=>v[i])));
  const max=[0,1,2].map(i=>Math.max(...brush.vertices.map(v=>v[i])));
  const sizes=[(max[0]-min[0])*base.x,(max[2]-min[2])*base.y,(max[1]-min[1])*base.z];
  const result=factors.clone();
  for(let axis=0;axis<3;axis++){
    if(sizes[axis]<.001)continue;
    const dimension=Math.max(step,Math.round(sizes[axis]*factors.getComponent(axis)/step)*step);
    result.setComponent(axis,Math.max(.05,dimension/sizes[axis]));
  }
  return result;
}
