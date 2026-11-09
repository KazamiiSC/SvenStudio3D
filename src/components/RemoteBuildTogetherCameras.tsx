/** BuildTogether 3.5 — lightweight 3D presence markers.
 * No extra render targets, cameras, shadows, raycasting or per-frame React updates.
 * Poses are already sent by the existing throttled presence stream.
 */
import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import * as THREE from 'three';
import {useBuildTogether,type CameraPose,type Member} from '../engine/buildTogetherClient';

function viewShape(pose:CameraPose){
 const distance=140;
 const aspect=Math.max(.4,Math.min(2.5,pose.aspect??1.6));
 const height=pose.projection==='orthographic'
  ? Math.min(145,Math.max(14,pose.orthoHeight/2))
  : Math.min(145,distance*Math.tan(THREE.MathUtils.degToRad(Math.max(10,Math.min(140,pose.fov??58)))/2));
 const width=Math.min(205,height*aspect);
 const corners=[[-width,-height,-distance],[width,-height,-distance],[width,height,-distance],[-width,height,-distance]];
 const vertices:number[]=[];
 const edge=(a:number[],b:number[])=>vertices.push(...a,...b);
 for(let i=0;i<4;i++){
  edge([0,0,-9],corners[i]);edge(corners[i],corners[(i+1)%4]);
 }
 edge([0,0,0],[0,0,-360]);
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 return geometry;
}
function RemoteCamera({member,pose,cones}:{member:Member;pose:CameraPose;cones:boolean}){
 const root=useRef<THREE.Group>(null);
 const destination=useMemo(()=>({position:new THREE.Vector3(),rotation:new THREE.Quaternion()}),[]);
 const geometry=useMemo(()=>viewShape(pose),[pose.projection,pose.orthoHeight,pose.fov,pose.aspect]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 useEffect(()=>{
  const [x,y,z]=pose.position;
  const position=destination.position.set(x,y,z);
  const aim=new THREE.Vector3(...pose.target);
  if(aim.distanceToSquared(position)<.0001)aim.set(x,y,z-1);
  // A remote camera looks down local -Z. Object3D.lookAt aims +Z, so
  // use Matrix4.lookAt(eye,target,up) to avoid showing the gaze backwards.
  const rotation=new THREE.Matrix4().lookAt(position,aim,new THREE.Vector3(...pose.up));
  destination.rotation.setFromRotationMatrix(rotation);
 },[pose,destination]);
 const initialized=useRef(false);
 useFrame((_,dt)=>{
  const group=root.current;if(!group)return;
  if(!initialized.current){group.position.copy(destination.position);group.quaternion.copy(destination.rotation);initialized.current=true;return;}
  const alpha=1-Math.exp(-Math.min(.08,dt)*12);
  group.position.lerp(destination.position,alpha);
  group.quaternion.slerp(destination.rotation,alpha);
 });
 return <group ref={root}>
  <mesh raycast={()=>{}} renderOrder={1101}>
   <boxGeometry args={[15,10,17]}/><meshBasicMaterial color={member.color} depthTest={false} depthWrite={false}/>
  </mesh>
  <mesh position={[0,0,-11]} rotation={[-Math.PI/2,0,0]} raycast={()=>{}} renderOrder={1102}>
   <cylinderGeometry args={[5,5,9,10]}/><meshBasicMaterial color="#d7f7ff" depthTest={false} depthWrite={false}/>
  </mesh>
  <mesh position={[0,7,3]} raycast={()=>{}} renderOrder={1102}>
   <sphereGeometry args={[3,8,6]}/><meshBasicMaterial color={member.color} depthTest={false} depthWrite={false}/>
  </mesh>
  {cones&&<lineSegments geometry={geometry} raycast={()=>{}} renderOrder={1099}>
   <lineBasicMaterial color={member.color} transparent opacity={.58} depthTest={false} depthWrite={false}/>
  </lineSegments>}
  {cones&&<mesh position={[0,0,-360]} raycast={()=>{}} renderOrder={1102}>
   <sphereGeometry args={[5,8,6]}/><meshBasicMaterial color={member.color} depthTest={false} depthWrite={false}/>
  </mesh>}
  {/* A distanceFactor scales Drei Html relative to the active camera projection.
      When switching from perspective to top/orthographic, this could expand
      participant names until they covered the entire viewport. Keep the
      nameplate in fixed CSS pixels, just like EntityNameLabel. */}
  <Html position={[0,24,0]} center transform={false} zIndexRange={[100,100]}
   pointerEvents="none" style={{pointerEvents:'none',userSelect:'none',whiteSpace:'nowrap'}}>
   <span className="bt-camera-label" title={member.name} style={{borderColor:member.color}}>{member.name}</span>
  </Html>
 </group>;
}
export function RemoteBuildTogetherCameras(){
 const online=useBuildTogether(s=>s.status==='online'||s.status==='reconnecting');
 const members=useBuildTogether(s=>s.participants);
 const selfId=useBuildTogether(s=>s.selfId);
 const poses=useBuildTogether(s=>s.cameras);
 const show=useBuildTogether(s=>s.showRemoteCameras);
 const cones=useBuildTogether(s=>s.showViewCones);
 if(!online||!show)return null;
 return <group name="BuildTogether remote camera markers">
  {members.filter(m=>m.id!==selfId&&poses[m.id]).map(m=><RemoteCamera key={m.id} member={m} pose={poses[m.id]} cones={cones}/>)}
 </group>;
}
