/** Read-only BSP leaf bounding boxes and optional PRT1 portal edges. */
import {useEffect,useMemo} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {Vec3} from '../engine/types';
import type {BspPortalFile,BspVisExplorerData,BspPvsResult} from '../engine/bspVisExplorer';
import {gameToThree,threeToGame} from '../engine/geometry';

export const BSP_VIS_LEAF_DRAW_LIMIT=160;
export const BSP_VIS_PORTAL_DRAW_LIMIT=600;

const pushLine=(to:number[],a:Vec3,b:Vec3)=>{
  const v=gameToThree(a),w=gameToThree(b);
  to.push(v.x,v.y,v.z,w.x,w.y,w.z);
};
function appendBounds(lines:number[],min:Vec3,max:Vec3){
  if(!min.every(Number.isFinite)||!max.every(Number.isFinite)||min.some((x,i)=>x>=max[i]))return;
  // The compiled leaf bounding box is a coarse AABB, not an exact leaf hull.
  for(let axis=0;axis<3;axis++){
    const [other1,other2]=[0,1,2].filter(i=>i!==axis);
    for(let j=0;j<2;j++)for(let k=0;k<2;k++){
      const a:Vec3=[...min],b:Vec3=[...min];
      a[other1]=b[other1]=j?max[other1]:min[other1];
      a[other2]=b[other2]=k?max[other2]:min[other2];
      b[axis]=max[axis];
      pushLine(lines,a,b);
    }
  }
}
function lineGeometry(lines:number[]):THREE.BufferGeometry {
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  return geometry;
}
export function BspVisOverlay({data,selected,pvs,showPvs,portals,showPortals}:{
  data:BspVisExplorerData;selected:number;pvs:BspPvsResult;showPvs:boolean;
  portals:BspPortalFile|null;showPortals:boolean;
}){
  const selectedGeo=useMemo(()=>{
    const lines:number[]=[],leaf=data.leaves[selected];
    if(leaf)appendBounds(lines,leaf.min,leaf.max);
    return lineGeometry(lines);
  },[data,selected]);
  const visibleGeo=useMemo(()=>{
    const lines:number[]=[];
    if(showPvs&&pvs.status==='ok'){
      let drawn=0;
      for(const index of pvs.indices){
        if(index===selected)continue;
        const leaf=data.leaves[index];if(!leaf)continue;
        appendBounds(lines,leaf.min,leaf.max);
        if(++drawn>=BSP_VIS_LEAF_DRAW_LIMIT)break;
      }
    }
    return lineGeometry(lines);
  },[data,selected,pvs,showPvs]);
  const portalGeo=useMemo(()=>{
    const lines:number[]=[];
    if(portals&&showPortals){
      for(const portal of portals.portals.slice(0,BSP_VIS_PORTAL_DRAW_LIMIT)){
        for(let i=0;i<portal.points.length;i++)pushLine(lines,portal.points[i],portal.points[(i+1)%portal.points.length]);
      }
    }
    return lineGeometry(lines);
  },[portals,showPortals]);
  useEffect(()=>()=>selectedGeo.dispose(),[selectedGeo]);
  useEffect(()=>()=>visibleGeo.dispose(),[visibleGeo]);
  useEffect(()=>()=>portalGeo.dispose(),[portalGeo]);
  return <group raycast={()=>null}>
    <lineSegments geometry={visibleGeo} raycast={()=>null} renderOrder={998}>
      <lineBasicMaterial color="#35c9e7" transparent opacity={.60} depthTest={false} depthWrite={false}/>
    </lineSegments>
    <lineSegments geometry={portalGeo} raycast={()=>null} renderOrder={999}>
      <lineBasicMaterial color="#efaf4a" transparent opacity={.82} depthTest={false} depthWrite={false}/>
    </lineSegments>
    <lineSegments geometry={selectedGeo} raycast={()=>null} renderOrder={1000}>
      <lineBasicMaterial color="#ff5a7a" depthTest={false} depthWrite={false}/>
    </lineSegments>
  </group>;
}
/** Samples the actual live editor camera only on an explicit user request. */
export function BspVisLocateCamera({request,onSample}:{request:number;onSample:(point:Vec3)=>void}){
  const {camera}=useThree();
  useEffect(()=>{if(request>0)onSample(threeToGame(camera.position.clone()))},[request]);
  return null;
}
