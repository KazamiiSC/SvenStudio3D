import {useEffect,useMemo,useRef} from 'react';
import {useFrame} from '@react-three/fiber';
import * as THREE from 'three';
import {useEditor} from '../store';
import {useMotionPreview} from '../entityMotionPreviewState';
import {createEntityMotionPlan,motionPoseAt,type MotionTrack} from '../engine/entityMotionPreview';
import {buildMeshGeometry,gameToThree,toRenderQuaternion} from '../engine/geometry';
import type {Brush,Vec3} from '../engine/types';

function MotionGhost({track,brushes,progressRef,totalDuration}:{track:MotionTrack;brushes:Brush[];progressRef:{current:number};totalDuration:number}){
 const groups=useRef<(THREE.Group|null)[]>([]);
 const geometry=useMemo(()=>brushes.map(b=>{const g=buildMeshGeometry(b,new Map());g.clearGroups();return g}),[brushes]);
 useEffect(()=>()=>geometry.forEach(g=>g.dispose()),[geometry]);
 const bases=useMemo(()=>brushes.map(b=>({pos:gameToThree(b.position),rotation:toRenderQuaternion(b.rotation),scale:[b.scale[0],b.scale[2],b.scale[1]] as Vec3})),[brushes]);
 const pivot=useMemo(()=>gameToThree(track.pivot),[track.pivot]);
 const q=new THREE.Quaternion(),shift=new THREE.Vector3(),temp=new THREE.Vector3();
 useFrame(()=>{
  const pose=motionPoseAt(track,Math.min(1,progressRef.current*totalDuration/track.duration));
  const delta=gameToThree(pose.offset);
  q.setFromAxisAngle(gameToThree(pose.axis).normalize(),THREE.MathUtils.degToRad(pose.degrees));
  groups.current.forEach((group,i)=>{if(!group)return;
   temp.copy(bases[i].pos).sub(pivot).applyQuaternion(q).add(pivot);
   shift.copy(temp).add(delta);group.position.copy(shift);
   group.quaternion.copy(q).multiply(bases[i].rotation);
  });
 });
 return <>{brushes.map((b,i)=><group key={b.id} ref={el=>{groups.current[i]=el}} position={bases[i].pos} quaternion={bases[i].rotation} scale={bases[i].scale}>
  <mesh geometry={geometry[i]} raycast={()=>{}} renderOrder={150}>
   <meshBasicMaterial color="#40e8ce" transparent opacity={.36} depthWrite={false} side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-1}/>
  </mesh>
 </group>)}</>;
}
function PathGuide({track}:{track:MotionTrack}){
 const geometry=useMemo(()=>{
  const points=track.kind==='translate'?track.path.map(p=>gameToThree([p[0]+track.pivot[0],p[1]+track.pivot[1],p[2]+track.pivot[2]] as Vec3)):
   [gameToThree(track.pivot),gameToThree([track.pivot[0]+track.axis[0]*48,track.pivot[1]+track.axis[1]*48,track.pivot[2]+track.axis[2]*48])];
  return new THREE.BufferGeometry().setFromPoints(points.flatMap((p,i)=>i? [points[i-1],p]:[]));
 },[track]);
 useEffect(()=>()=>geometry.dispose(),[geometry]);
 return <lineSegments geometry={geometry} raycast={()=>{}} renderOrder={160}><lineBasicMaterial color="#36f5bd" depthTest={false} depthWrite={false} transparent opacity={.8}/></lineSegments>;
}
/** Separate ghost objects: never moves the real geometry or changes editor selection. */
function ActiveEntityMotionPreview3D({sourceId}:{sourceId:string}){
 const showPath=useMotionPreview(s=>s.showPath);
 const objects=useEditor(s=>s.project.objects),walkMode=useEditor(s=>s.walkMode);
 const plan=useMemo(()=>sourceId?createEntityMotionPlan(objects,sourceId):null,[objects,sourceId]);
 const brushes=useMemo(()=>new Map(objects.filter((o):o is Brush=>o.kind==='brush').map(b=>[b.id,b])),[objects]);
 const elapsed=useRef(0),localProgress=useRef(0);
 useEffect(()=>{localProgress.current=0;elapsed.current=0},[sourceId]);
 useFrame((_,dt)=>{
  if(!sourceId||!plan?.tracks.length||walkMode)return;
  const state=useMotionPreview.getState();
  if(!state.playing){localProgress.current=state.progress;return}
  localProgress.current=Math.min(1,localProgress.current+Math.min(.1,dt)*state.speed/plan.duration);
  elapsed.current+=dt;
  if(elapsed.current>=.08||localProgress.current>=1){state.setProgress(localProgress.current);elapsed.current=0;}
  if(localProgress.current>=1)state.setPlaying(false);
 });
 if(!plan?.tracks.length||walkMode)return null;
 return <group>{plan.tracks.map(track=><group key={track.entityId}>
  <MotionGhost track={track} brushes={track.brushIds.map(id=>brushes.get(id)).filter((b):b is Brush=>!!b)} progressRef={localProgress} totalDuration={plan.duration}/>
  {showPath&&<PathGuide track={track}/>}
 </group>)}</group>;
}

export function EntityMotionPreview3D(){
 const sourceId=useMotionPreview(s=>s.sourceId);
 return sourceId?<ActiveEntityMotionPreview3D key={sourceId} sourceId={sourceId}/>:null;
}
