/** Direct 3D route editing for the studio preview. Coordinates are Valve 220
 * game X/Y/Z but Three.js uses (X, Z, -Y). World placement is never changed
 * while adjusting these handles; committing remains a separate map click. */
import {useRef,useState} from 'react';
import {useThree} from '@react-three/fiber';
import {Line} from '@react-three/drei';
import * as THREE from 'three';
import type {Vec3} from '../engine/types';
import {pathPointToPreview,movePathPointOnAxis,type PathEditAxis} from '../engine/path3DMath';
export type PathAxis=PathEditAxis;
type Props={points:Vec3[];activePoint:number;axis:PathAxis;onSelect:(index:number)=>void;
  onBeginDrag:()=>void;onMove:(index:number,p:Vec3)=>void;onEndDrag:()=>void;
  onInsertAfter:(index:number)=>void;onDraggingChange:(isDragging:boolean)=>void};
const toWorld=(p:Vec3):THREE.Vector3=>new THREE.Vector3(...pathPointToPreview(p));
export function Path3DControls({points,activePoint,axis,onSelect,onBeginDrag,onMove,onEndDrag,onInsertAfter,onDraggingChange}:Props){
  const {camera}=useThree();
  const [hovered,setHovered]=useState<number|null>(null);
  const drag=useRef<{index:number;axis:PathAxis;plane:THREE.Plane;anchor:THREE.Vector3;start:Vec3}|null>(null);
  const finish=(event:import('@react-three/fiber').ThreeEvent<PointerEvent>)=>{
    if(!drag.current)return;
    drag.current=null;onEndDrag();onDraggingChange(false);
    const target=event.target as unknown as {hasPointerCapture?:(id:number)=>boolean;releasePointerCapture?:(id:number)=>void};
    if(target?.hasPointerCapture?.(event.pointerId))target.releasePointerCapture?.(event.pointerId);
  };
  const begin=(event:import('@react-three/fiber').ThreeEvent<PointerEvent>,index:number)=>{
    if(event.button!==0)return;
    event.stopPropagation();onSelect(index);
    const start=[...points[index]] as Vec3,world=toWorld(start);
    // Horizontal drag plane keeps height fixed. Vertical drag plane is oriented
    // to the camera, but contains the vertical direction and selected point.
    let normal=new THREE.Vector3(0,1,0);
    if(axis==='z'){
      normal=new THREE.Vector3(camera.position.x-world.x,0,camera.position.z-world.z);
      if(normal.lengthSq()<1e-6)normal.set(1,0,0);
      normal.normalize();
    }
    const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,world);
    const anchor=event.ray.intersectPlane(plane,new THREE.Vector3());
    if(!anchor)return;
    drag.current={index,axis,plane,anchor:anchor.clone(),start};
    onBeginDrag();onDraggingChange(true);
    (event.target as unknown as {setPointerCapture:(id:number)=>void}).setPointerCapture(event.pointerId);
  };
  const move=(event:import('@react-three/fiber').ThreeEvent<PointerEvent>,index:number)=>{
    const current=drag.current;
    if(!current||current.index!==index)return;
    event.stopPropagation();
    const hit=event.ray.intersectPlane(current.plane,new THREE.Vector3());
    if(!hit)return;
    const delta=hit.sub(current.anchor);
    const next=movePathPointOnAxis(current.start,[delta.x,delta.y,delta.z],current.axis);
    onMove(index,next);
  };
  return <group>
    <Line points={points.map(toWorld)} depthTest={false} renderOrder={40} color="#83dff7" lineWidth={2} dashed dashSize={5} gapSize={4}/>
    {points.slice(0,-1).map((p,index)=>{
      const q=points[index+1],center:Vec3=[(p[0]+q[0])/2,(p[1]+q[1])/2,(p[2]+q[2])/2];
      return <mesh key={`mid-${index}`} position={toWorld(center)}
        onClick={event=>{event.stopPropagation();onInsertAfter(index)}}>
        <octahedronGeometry args={[8,0]}/><meshBasicMaterial color="#5cdec5" depthTest={false}/>
      </mesh>;
    })}
    {points.map((point,index)=>{
      const active=activePoint===index,highlight=hovered===index;
      return <group key={index} position={toWorld(point)}>
        {active&&<group raycast={()=>null}>
          <mesh position={[0,0,0]}><sphereGeometry args={[9,12,8]}/><meshBasicMaterial color="#f3d47a" wireframe opacity={.65} transparent depthTest={false}/></mesh>
          <axesHelper args={[32]}/>
        </group>}
        <mesh onPointerOver={event=>{event.stopPropagation();setHovered(index)}}
          onPointerOut={()=>setHovered(v=>v===index?null:v)}
          onPointerDown={event=>begin(event,index)} onPointerMove={event=>move(event,index)}
          onPointerUp={finish} onPointerCancel={finish}
          onClick={event=>{event.stopPropagation();onSelect(index)}}>
          <sphereGeometry args={[active?11:9,14,10]}/>
          <meshBasicMaterial color={active?'#ffe093':highlight?'#ffffff':'#ffad58'} depthTest={false}/>
        </mesh>
      </group>;
    })}
  </group>;
}
