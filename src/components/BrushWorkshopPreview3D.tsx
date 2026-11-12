/** Isolated, inspectable THREE preview. No writes to MAP/project until Apply. */
import {useEffect,useMemo,useRef} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import {gameToThree,transformedVertices} from '../engine/geometry';
import type {Brush,Vec3} from '../engine/types';
import type {FaceFrame,WorkshopResult} from '../engine/brushWorkshop';

export type WorkshopCameraPreset='iso'|'face'|'top'|'side';
function BrushFace({brush,index,center,color,opacity,onPick}: {brush:Brush;index:number;center:THREE.Vector3;color:string;opacity:number;onPick?:()=>void}){
  const geometry=useMemo(()=>{
    const verts=transformedVertices(brush),face=brush.faces[index],points:number[]=[];
    for(let j=1;j<face.indices.length-1;j++)for(const id of [face.indices[0],face.indices[j],face.indices[j+1]]){
      const g=gameToThree(verts[id]);g.sub(center);points.push(g.x,g.y,g.z);
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.computeVertexNormals();return geo;
  },[brush,index,center]);
  const edges=useMemo(()=>new THREE.EdgesGeometry(geometry,15),[geometry]);
  useEffect(()=>()=>{geometry.dispose();edges.dispose()},[geometry,edges]);
  return <group>
    <mesh geometry={geometry} onClick={onPick?e=>{e.stopPropagation();onPick()}:undefined}>
      <meshStandardMaterial color={color} transparent opacity={opacity} roughness={0.8} metalness={0.06} side={THREE.DoubleSide} depthWrite={opacity>=.99}/>
    </mesh>
    <lineSegments geometry={edges}><lineBasicMaterial color={color} transparent opacity={Math.min(.9,opacity+.12)}/></lineSegments>
  </group>;
}
function BrushSolid({brush,center,selectedFace,onPick,color,opacity=1}: {brush:Brush;center:THREE.Vector3;selectedFace?:number;onPick?:(face:number)=>void;color:string;opacity?:number}){
  return <group>{brush.faces.map((face,i)=><BrushFace key={`${brush.id}-${i}-${face.indices.join(',')}`} brush={brush} index={i} center={center}
    color={selectedFace===i?'#edc775':color} opacity={selectedFace===i?Math.min(1,opacity+.12):opacity} onPick={onPick?()=>onPick(i):undefined}/>)}</group>;
}
function CameraRig({preset,frame,radius,changeId}:{preset:WorkshopCameraPreset;frame:FaceFrame|null;radius:number;changeId:string}){
  const {camera,invalidate}=useThree(),controls=useRef<OrbitControlsImpl>(null);
  const faceKey=preset==='face'?frame?.normal.join(',')??'':'fixed';
  useEffect(()=>{
    const normal=frame?gameToThree(frame.normal):new THREE.Vector3(1,.5,1);
    const direction=preset==='top'?new THREE.Vector3(.001,1,.001):preset==='side'?new THREE.Vector3(1,.1,.001):preset==='face'?normal:new THREE.Vector3(1,.72,1);
    direction.normalize();camera.up.set(0,1,0);camera.position.copy(direction.multiplyScalar(radius*2.4));
    camera.lookAt(0,0,0);camera.updateProjectionMatrix();controls.current?.target.set(0,0,0);controls.current?.update();invalidate();
  },[camera,preset,faceKey,radius,changeId,invalidate]);
  return <OrbitControls ref={controls} makeDefault enablePan enableRotate enableZoom enableDamping dampingFactor={.09} minDistance={Math.max(2,radius*.12)} maxDistance={Math.max(300,radius*20)}/>;
}
export function BrushWorkshopPreview3D({brush,face,frame,result,preset,onFaceSelect,showSource}:{
  brush:Brush;face:number;frame:FaceFrame|null;result:WorkshopResult|null;preset:WorkshopCameraPreset;onFaceSelect:(i:number)=>void;showSource:boolean;
}){
  const bounds=useMemo(()=>{
    const world=transformedVertices(brush).map(gameToThree);const box=new THREE.Box3().setFromPoints(world);
    const center=box.getCenter(new THREE.Vector3());const radius=Math.max(32,box.getSize(new THREE.Vector3()).length()*.5);
    return {center,radius};
  },[brush]);
  const solids=useMemo(()=>result?[...(result.replacement??[brush]),...result.additions]:[brush],[result,brush]);
  return <div className="bw-3d-stage" aria-label="Brush Workshop 3D preview" onContextMenu={e=>e.preventDefault()}>
    <Canvas dpr={[1,1.5]} camera={{position:[200,140,200],fov:48,near:.1,far:100000}} gl={{antialias:true,powerPreference:'high-performance'}}>
      <color attach="background" args={['#0e2333']}/><ambientLight intensity={1.2}/><directionalLight position={[200,400,200]} intensity={1.8}/><directionalLight position={[-100,80,-120]} intensity={.5}/>
      {showSource&&result?.replacement&&<BrushSolid brush={brush} center={bounds.center} color="#d59e57" opacity={.13} selectedFace={face} onPick={onFaceSelect}/>}
      {solids.map((solid,i)=><BrushSolid key={`${solid.id}-${i}`} brush={solid} center={bounds.center}
        selectedFace={result?.replacement?undefined:solid.id===brush.id?face:undefined}
        onPick={solid.id===brush.id?onFaceSelect:undefined}
        color={result?.replacement?'#5bc6b7':solid.id===brush.id?'#7297af':'#59cbbd'} opacity={1}/>)}
      <CameraRig preset={preset} frame={frame} radius={bounds.radius} changeId={brush.id}/>
      <axesHelper args={[Math.min(bounds.radius*.9,128)]}/>
    </Canvas>
    <div className="bw-3d-watermark">3D · LMB rotate · RMB pan · Wheel zoom</div>
  </div>;
}
