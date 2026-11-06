import * as THREE from 'three';
import {rotateBrushTextureLock,transformedVertices} from './geometry';
import type {Brush,MapObject,Vec3} from './types';
import type {PlacementAxis} from './smartPlacementMath';
/** Rotation is composed in GoldSrc space and baked into the brush pose, not its vertices. */
export function placementRotationQuaternion(axis:PlacementAxis,angle:number,autoYaw=0):THREE.Quaternion {
  const yaw=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,0,1),THREE.MathUtils.degToRad(autoYaw));
  const selected=new THREE.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0);
  return yaw.multiply(new THREE.Quaternion().setFromAxisAngle(selected,THREE.MathUtils.degToRad(angle)));
}
export function rotateObjectsForPlacement<T extends MapObject>(objects:T[],pivot:Vec3,axis:PlacementAxis,angle:number,autoYaw=0):T[]{
  if(!angle&&!autoYaw)return objects;
  const delta=placementRotationQuaternion(axis,angle,autoYaw);
  return objects.map(object=>{
    const point=new THREE.Vector3(...object.position).sub(new THREE.Vector3(...pivot)).applyQuaternion(delta).add(new THREE.Vector3(...pivot));
    const position=point.toArray() as Vec3;
    if(object.kind!=='brush'){
      const props={...object.props};
      if(axis==='z'){
        if(props.angles){const values=props.angles.trim().split(/\s+/).map(Number);
          if(values.length===3&&values.every(Number.isFinite))props.angles=`${values[0]} ${values[1]+angle+autoYaw} ${values[2]}`;}
        if(props.angle){const a=Number(props.angle);if(Number.isFinite(a)&&a!==-1&&a!==-2)props.angle=String(a+angle+autoYaw)}
      }
      return {...object,position,props} as T;
    }
    const prev=new THREE.Quaternion().setFromEuler(new THREE.Euler(...(object.rotation.map(v=>THREE.MathUtils.degToRad(v)) as Vec3),'XYZ'));
    const euler=new THREE.Euler().setFromQuaternion(delta.clone().multiply(prev),'XYZ');
    const rotation=[euler.x,euler.y,euler.z].map(v=>THREE.MathUtils.radToDeg(v)) as Vec3;
    const faces=rotateBrushTextureLock(object,{position,rotation,scale:object.scale});
    return {...object,position,rotation,faces} as T;
  });
}
export function placementPoints(objects:MapObject[],pivot:Vec3):Vec3[]{
  return objects.flatMap(o=>(o.kind==='brush'?transformedVertices(o):[o.position]).map(p=>p.map((v,i)=>v-pivot[i]) as Vec3));
}
