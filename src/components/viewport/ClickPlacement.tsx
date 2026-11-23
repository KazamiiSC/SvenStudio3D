/** Viewport click-placement tools extracted from Viewport.tsx (v2.3 HF5): shapes, prefabs, CS markers, environment, textures, blueprints, terrain, NPCs, audio and cinematic points. */
import {useFrame,useThree} from '@react-three/fiber';
import {Html} from '@react-three/drei';
import {useEffect,useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import {useEditor} from '../../store';
import {useCSMapPlacement} from '../../csMapPlacementState';
import {cs16AnchorAtSurface,cs16PreviewOffsets} from '../../engine/csMapPlacement';
import {cs16Inventory,cs16MarkerTint} from '../../engine/csMapIntegration';
import {buildMeshGeometry,createSizedPlaceableShape,gameToThree,threeToGame,toRenderQuaternion,transformedVertices} from '../../engine/geometry';
import type {Brush,PointEntity,Vec3} from '../../engine/types';
import {validSoundReference} from '../../engine/sound';
import {createPathStructureBrushes} from '../../engine/pathStructures';
import {createRockCluster} from '../../engine/terrain';
import {createArchitecture} from '../../engine/architecture';
import {buildKit,kitPreviewBrushes} from '../../engine/svenKits';
import {buildBlueprintBrushes,blueprintPixelToWorld} from '../../engine/blueprintToMap';
import {useStudioLayout} from '../../layout';
import {rotateObjectsForPlacement,placementPoints} from '../../engine/smartPlacement';
import {snappedFacing,surfacePlacementAnchor} from '../../engine/smartPlacementMath';
import {computeUniversalPlacement,closestPlacementVertex,closestPlacementEdge,freeRayPoint} from '../../engine/universalPlacement';
import {textureSizeLookup,type PlacementHit} from '../Viewport';

/** Shared raycast and surface anchoring for shapes and prefabs. Ghosts do not receive raycasts. */
export function surfaceHit(e:{clientX:number;clientY:number},camera:THREE.Camera,scene:THREE.Scene,canvas:HTMLCanvasElement,align:boolean,elevation=0):PlacementHit|null{
  const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
  const state=useEditor.getState(),settings=state.universalPlacement;
  const ndc=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  const ray=new THREE.Raycaster();ray.setFromCamera(ndc,camera);
  const hit=(settings.mode==='grid'||settings.mode==='free'||settings.lockPosition)?null:
    ray.intersectObjects(scene.children,true).find(v=>{
      let node:THREE.Object3D|null=v.object;
      while(node){if(node.userData.brushId)return true;node=node.parent;}
      return false;
    });
  const groundPoint=new THREE.Vector3();
  const floor=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-settings.planeZ),groundPoint);
  // An elevated/negative-Z plane can be behind a nearly horizontal camera ray.
  // Keep a *forward* projected cursor instead of dropping the whole placement ghost.
  if(!floor){
    const projectionDistance=Math.max(128,Math.min(2048,Math.abs(ray.ray.origin.y-settings.planeZ)+384));
    ray.ray.at(projectionDistance,groundPoint);
    groundPoint.y=settings.planeZ;
  }
  const worldPoint=hit?threeToGame(hit.point):null;
  let objectPoint:Vec3|null=null;
  if(settings.mode==='object'&&hit?.face){
    const mesh=hit.object as THREE.Mesh;
    const geo=mesh.geometry as THREE.BufferGeometry|undefined;
    const vertices=geo?.getAttribute('position');
    if(vertices){
      const near=[hit.face.a,hit.face.b,hit.face.c].map(index=>{
        const v=new THREE.Vector3().fromBufferAttribute(vertices,index);
        return threeToGame(mesh.localToWorld(v));
      });
      objectPoint=closestPlacementVertex(worldPoint!,near,settings.objectSnapRadius);
    }
    // Prefer actual brush polygon boundaries, never diagonal triangle-fan edges.
    const triangle=(hit.faceIndex??0);
    const faceIndex=(geo?.userData.trianglesToFaces as number[]|undefined)?.[triangle];
    let node:THREE.Object3D|null=mesh,brushId:string|null=null;
    while(node){if(node.userData.brushId){brushId=node.userData.brushId;break;}node=node.parent;}
    const brush=state.project.objects.find(o=>o.id===brushId&&o.kind==='brush') as Brush|undefined;
    const polygon=faceIndex!==undefined?brush?.faces[faceIndex]:null;
    if(polygon&&brush){
      const world=transformedVertices(brush);
      const vertices=polygon.indices.map(index=>world[index]);
      objectPoint=closestPlacementEdge(worldPoint!,vertices,settings.objectSnapRadius)||objectPoint;
    }
  }
  const step=state.snapping?state.snap:1;
  // Free mode uses the camera ray itself, not the horizontal world grid.
  // It remains usable while looking horizontally, upward, or into empty space.
  const freePoint=freeRayPoint(threeToGame(ray.ray.origin),threeToGame(ray.ray.direction),settings.freeDepth);
  const position=computeUniversalPlacement(settings,worldPoint,threeToGame(groundPoint),objectPoint,step,elevation,freePoint);
  state.setUniversalPlacementHover(position);
  if(!position)return null;
  const cameraDirection=threeToGame(camera.getWorldDirection(new THREE.Vector3()).normalize());
  const cameraYaw=align?snappedFacing(cameraDirection):0;
  const normal=hit?.face&&!settings.lockPosition?threeToGame(hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize()):[0,0,1] as Vec3;
  const yaw=align&&!settings.lockPosition?(Math.abs(normal[2])>=.5?cameraYaw:snappedFacing(normal)):0;
  return {position,normal,autoYaw:yaw};
}
export function snapPosition(point:Vec3):Vec3{
  const state=useEditor.getState(),step=state.snapping?state.snap:1;
  return point.map(v=>Math.round(v/step)*step) as Vec3;
}
/** Determine the placed anchor using the *same* rotated geometry as the ghost. */
export function placementAt(e:PointerEvent,camera:THREE.Camera,scene:THREE.Scene,canvas:HTMLCanvasElement,
  localObjects:Brush[]|import('../../engine/types').MapObject[],rotationAxis:import('../../engine/smartPlacementMath').PlacementAxis,
  angle:number,align:boolean,origin:Vec3):{anchor:Vec3;autoYaw:number}|null{
  // First raycast to determine orientation, then compute actual rotated bounds.
  const hit=surfaceHit(e,camera,scene,canvas,align);if(!hit)return null;
  const rotated=rotateObjectsForPlacement(localObjects,origin,rotationAxis,angle,hit.autoYaw);
  const settings=useEditor.getState().universalPlacement;
  const anchor=settings.lockPosition||settings.mode==='free'?hit.position:surfacePlacementAnchor(hit.position,hit.normal,placementPoints(rotated,origin));
  return {anchor:settings.lockPosition||settings.mode==='free'?anchor:snapPosition(anchor),autoYaw:hit.autoYaw};
}
/** Preview raycasts for entity tools that previously had no hover ghost. */
export function UniversalHoverProbe(){
  const active=useEditor(s=>!!(s.pendingNpcClass||s.routePlacementFor||s.audioPlacement||s.cinematicPlacementFor));
  const settings=useEditor(s=>s.universalPlacement);
  const npc=useEditor(s=>s.pendingNpcClass),route=useEditor(s=>s.routePlacementFor);
  const {camera,scene,gl}=useThree();
  const lastMouse=useRef<{clientX:number;clientY:number}|null>(null);
  useEffect(()=>{
    if(!active)return;
    const canvas=gl.domElement;
    const move=(e:{clientX:number;clientY:number})=>{
      lastMouse.current={clientX:e.clientX,clientY:e.clientY};
      surfaceHit(e,camera,scene,canvas,false,npc?24:route?4:0);
    };
    // Keep the latest valid ghost point while the pointer crosses a toolbar or panel.
    canvas.addEventListener('pointermove',move);

    if(lastMouse.current)move(lastMouse.current);
    return()=>{canvas.removeEventListener('pointermove',move)};
  },[active,settings,npc,route,camera,scene,gl]);
  return null;
}
/** Viewport-only non-pickable indicator. Works across the placement tools;
 * scaled with camera distance so it stays easy to see on large maps. */
export function UniversalPlacementGuide(){
  const settings=useEditor(s=>s.universalPlacement);
  const hover=useEditor(s=>s.universalPlacementHover);
  const active=useEditor(s=>!!(s.placementShape||s.placementPrefabId||s.environmentPlacement||s.audioPlacement||s.pendingNpcClass||s.routePlacementFor||s.terrainPlacement||s.blueprintPlacementId||s.cinematicPlacementFor));
  const entityGhost=useEditor(s=>s.pendingNpcClass);
  const {camera}=useThree();
  const ring=useRef<THREE.Group>(null);
  const position=settings.lockPosition?settings.position:hover;
  const three=position?gameToThree(position):null;
  useFrame(()=>{if(!ring.current||!three)return;ring.current.scale.setScalar(Math.max(.4,Math.min(8,camera.position.distanceTo(three)/700)));});
  if(!active||!three||!position)return null;
  return <group ref={ring} position={three} raycast={()=>null}>
    {entityGhost&&<group raycast={()=>null}>
      <Html center position={[0,72,0]} style={{pointerEvents:'none'}}><div className="ui3-entity-ghost-label">{entityGhost}</div></Html>
      <mesh raycast={()=>null} position={[0,21,0]}><capsuleGeometry args={[9,26,4,10]}/><meshBasicMaterial color="#70e3ff" transparent opacity={.32} depthWrite={false} depthTest={false}/></mesh>
      <mesh raycast={()=>null} position={[0,3,0]} rotation={[-Math.PI/2,0,0]}><ringGeometry args={[10,15,32]}/><meshBasicMaterial color="#a6ffd4" transparent opacity={.8} depthTest={false} depthWrite={false} side={THREE.DoubleSide}/></mesh>
    </group>}
    <mesh rotation={[-Math.PI/2,0,0]} raycast={()=>null}>
      <ringGeometry args={[6,9,24]}/><meshBasicMaterial color="#64e1ee" side={THREE.DoubleSide} transparent opacity={.75} depthTest={false} depthWrite={false}/>
    </mesh>
  </group>;
}
/** Smart Placement: match the ghost and the saved brush exactly, including UV axes. */
export function PrimitivePlacement(){
  const shape=useEditor(s=>s.placementShape);
  const shapeSize=useEditor(s=>s.shapeSize),currentTexture=useEditor(s=>s.currentTexture);
  const axis=useEditor(s=>s.placementAxis),angle=useEditor(s=>s.placementAngle),align=useEditor(s=>s.placementAutoAlign);
  const {camera,scene,gl}=useThree();
  const universalSettings=useEditor(s=>s.universalPlacement);
  const group=useRef<THREE.Group>(null),lastMouse=useRef<{clientX:number;clientY:number}|null>(null);
  const assets=useEditor(s=>s.textureAssets);
  const priority=useEditor(s=>s.settings.wadPaths+'|'+s.project.wadNames.join(';'));
  const sizes=useMemo(()=>textureSizeLookup(assets),[assets,priority]);
  const initial=useMemo(()=>shape?createSizedPlaceableShape(shape,[0,0,0],shapeSize,currentTexture):[],[shape,shapeSize,currentTexture]);
  const geometries=useMemo(()=>initial.map(b=>buildMeshGeometry(b,sizes)),[initial,sizes]);
  useEffect(()=>()=>geometries.forEach(g=>g.dispose()),[geometries]);
  // Surface autoYaw is per-hover: update the view from the last pointer position.
  const [hoverYaw,setHoverYaw]=useState(0);
  const preview=useMemo(()=>rotateObjectsForPlacement(initial,[0,0,0],axis,angle,hoverYaw),[initial,axis,angle,hoverYaw]);
  useEffect(()=>{
    if(!shape)return;
    const target=gl.domElement;
    const location=(e:PointerEvent)=>placementAt(e,camera,scene,target,initial,axis,angle,align,[0,0,0]);
    const move=(event:PointerEvent)=>{
      lastMouse.current={clientX:event.clientX,clientY:event.clientY};
      const result=location(event);if(!group.current)return;
      group.current.visible=!!result;
      if(!result)return;
      if(result.autoYaw!==hoverYaw)setHoverYaw(result.autoYaw);
      group.current.position.copy(gameToThree(result.anchor));
    };
    const down=(event:PointerEvent)=>{
      if(event.button!==0)return;
      const result=location(event);if(!result)return;
      event.preventDefault();event.stopImmediatePropagation();
      const current=useEditor.getState().universalPlacement;
      if(current.twoStep&&!current.staged){useEditor.getState().setUniversalPlacement({position:[...result.anchor],lockPosition:true,staged:true});return;}
      useEditor.getState().placeShapeAt(result.anchor,result.autoYaw);
      if(current.staged)queueMicrotask(()=>useEditor.getState().setUniversalPlacement({staged:false,lockPosition:false}));
    };
    const leave=()=>{/* Keep the last valid ghost while crossing overlays. */};
    const key=(event:KeyboardEvent)=>{
      if((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')||event.altKey||event.ctrlKey||event.metaKey)return;
      const editor=useEditor.getState();
      if(event.code==='Escape')editor.setPlacementShape(null);
      else if(event.code==='KeyR'&&!event.repeat)editor.stepPlacementAngle(event.shiftKey?15:90);
      else if(['KeyX','KeyY','KeyZ'].includes(event.code))editor.setPlacementAxis(event.code.slice(-1).toLowerCase() as 'x'|'y'|'z');
      else if(event.code==='KeyF')editor.togglePlacementAutoAlign();
      else if(event.code==='Digit0')editor.resetPlacementAngle();
      else if(event.code==='KeyP')editor.togglePlacementRepeat();
      else return;
      event.preventDefault();event.stopImmediatePropagation();
    };
    target.addEventListener('pointermove',move);target.addEventListener('pointerdown',down,true);
    target.addEventListener('pointerleave',leave);window.addEventListener('keydown',key,true);
    if(lastMouse.current)move(lastMouse.current as PointerEvent);
    return()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerdown',down,true);target.removeEventListener('pointerleave',leave);window.removeEventListener('keydown',key,true)};
  },[shape,initial,axis,angle,align,hoverYaw,camera,scene,gl,universalSettings]);
  if(!shape)return null;
  return <group ref={group} visible={false}>{preview.map((brush,i)=><mesh key={`${shape}-${i}`}
    geometry={geometries[i]} position={gameToThree(brush.position)} quaternion={toRenderQuaternion(brush.rotation)}
    scale={[brush.scale[0],brush.scale[2],brush.scale[1]]} raycast={()=>null}>
    <meshBasicMaterial color="#63e7ff" transparent opacity={.35} side={THREE.DoubleSide} depthWrite={false}/>
  </mesh>)}</group>;
}
/** Prefabs share rotation and surface anchoring with individual shapes. */
export function PrefabClickPlacement(){
  const prefabId=useEditor(s=>s.placementPrefabId),prefabs=useEditor(s=>s.prefabs);
  const prefab=prefabs.find(p=>p.id===prefabId);
  const axis=useEditor(s=>s.placementAxis),angle=useEditor(s=>s.placementAngle),align=useEditor(s=>s.placementAutoAlign);
  const {camera,scene,gl}=useThree();
  const universalSettings=useEditor(s=>s.universalPlacement);
  const group=useRef<THREE.Group>(null),lastMouse=useRef<{clientX:number;clientY:number}|null>(null);
  const brushes=useMemo(()=>prefab?.objects.filter((o):o is Brush=>o.kind==='brush')||[],[prefab]);
  const assets=useEditor(s=>s.textureAssets),priority=useEditor(s=>s.settings.wadPaths+'|'+s.project.wadNames.join(';'));
  const sizes=useMemo(()=>textureSizeLookup(assets),[assets,priority]);
  const geometries=useMemo(()=>brushes.map(b=>buildMeshGeometry(b,sizes)),[brushes,sizes]);
  useEffect(()=>()=>geometries.forEach(g=>g.dispose()),[geometries]);
  const ghostMaterial=useMemo(()=>new THREE.MeshBasicMaterial({color:'#77d8ff',transparent:true,opacity:.30,depthWrite:false,side:THREE.DoubleSide}),[]);
  useEffect(()=>()=>ghostMaterial.dispose(),[ghostMaterial]);
  const [hoverYaw,setHoverYaw]=useState(0);
  const initial=prefab?.objects||[];const origin:Vec3=prefab?.origin||[0,0,0];
  const preview=useMemo(()=>prefab?rotateObjectsForPlacement(prefab.objects,prefab.origin,axis,angle,hoverYaw):[],[prefab,axis,angle,hoverYaw]);
  useEffect(()=>{
    if(!prefabId||!prefab)return;
    const canvas=gl.domElement;
    const location=(event:PointerEvent)=>placementAt(event,camera,scene,canvas,prefab.objects,axis,angle,align,prefab.origin);
    const move=(event:PointerEvent)=>{
      lastMouse.current={clientX:event.clientX,clientY:event.clientY};
      const result=location(event);if(!group.current)return;
      group.current.visible=!!result;
      if(!result)return;
      if(result.autoYaw!==hoverYaw)setHoverYaw(result.autoYaw);
      group.current.position.copy(gameToThree(result.anchor));
    };
    const down=(event:PointerEvent)=>{
      if(event.button!==0)return;
      const result=location(event);if(!result)return;
      event.preventDefault();event.stopImmediatePropagation();
      const current=useEditor.getState().universalPlacement;
      if(current.twoStep&&!current.staged){useEditor.getState().setUniversalPlacement({position:[...result.anchor],lockPosition:true,staged:true});return;}
      try{useEditor.getState().placePrefabAt(result.anchor,result.autoYaw);
        if(current.staged)queueMicrotask(()=>useEditor.getState().setUniversalPlacement({staged:false,lockPosition:false}));
      }catch(error){useEditor.getState().appendLogs([`Prefab placement: ${String(error)}`]);window.alert(String(error))}
    };
    const leave=()=>{/* Keep the last valid ghost while crossing overlays. */};
    const key=(event:KeyboardEvent)=>{
      if((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')||event.altKey||event.ctrlKey||event.metaKey)return;
      const editor=useEditor.getState();
      if(event.code==='Escape')editor.setPlacementPrefab(null);
      else if(event.code==='KeyR'&&!event.repeat)editor.stepPlacementAngle(event.shiftKey?15:90);
      else if(['KeyX','KeyY','KeyZ'].includes(event.code))editor.setPlacementAxis(event.code.slice(-1).toLowerCase() as 'x'|'y'|'z');
      else if(event.code==='KeyF')editor.togglePlacementAutoAlign();
      else if(event.code==='Digit0')editor.resetPlacementAngle();
      else if(event.code==='KeyP')editor.togglePlacementRepeat();
      else return;
      event.preventDefault();event.stopImmediatePropagation();
    };
    canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerdown',down,true);
window.addEventListener('keydown',key,true);
    if(lastMouse.current)move(lastMouse.current as PointerEvent);
    return()=>{canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerdown',down,true);window.removeEventListener('keydown',key,true)};
  },[prefabId,prefab,camera,scene,gl,axis,angle,align,hoverYaw,universalSettings]);
  if(!prefab)return null;
  const byId=new Map(preview.map(o=>[o.id,o]));
  return <group ref={group} visible={false}>
    {brushes.map((brush,index)=>{
      const rotated=byId.get(brush.id) as Brush;
      return <mesh key={brush.id} raycast={()=>null} geometry={geometries[index]} material={ghostMaterial}
        position={gameToThree(rotated.position.map((v,i)=>v-origin[i]) as Vec3)}
        quaternion={toRenderQuaternion(rotated.rotation)} scale={[rotated.scale[0],rotated.scale[2],rotated.scale[1]]}/>;
    })}
    {initial.filter(o=>o.kind==='entity').map(o=>{
      const rotated=byId.get(o.id)!;
      return <mesh key={o.id} raycast={()=>null} position={gameToThree(rotated.position.map((v,i)=>v-origin[i]) as Vec3)}>
        <sphereGeometry args={[12,8,6]}/><meshBasicMaterial color="#aaffbb" transparent opacity={.6}/>
      </mesh>;
    })}
  </group>;
}
/** Native Svengine light/fog placement, intercepting the editor canvas only while armed. */
/** HF31: GoldSrc-specific click placement. No saved project changes until LMB. */
export function CSMapClickPlacement(){
 const request=useCSMapPlacement(s=>s.request);
 const {camera,scene,gl}=useThree();
 const ghost=useRef<THREE.Group>(null);
 const offsets=useMemo(()=>request?cs16PreviewOffsets(request):[],[request]);
 useEffect(()=>{
  if(!request)return;
  const canvas=gl.domElement;
  let cachedObjects=useEditor.getState().project.objects;
  const findToolBrushes=(objects:typeof cachedObjects)=>new Set(objects.filter((o):o is Brush=>
   o.kind==='brush'&&o.faces.length>0&&o.faces.every(f=>f.texture.toUpperCase()==='AAATRIGGER')).map(o=>o.id));
  let toolBrushes=findToolBrushes(cachedObjects);
  const locate=(e:{clientX:number;clientY:number}):Vec3|null=>{
   const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return null;
   const ndc=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
   const ray=new THREE.Raycaster();ray.setFromCamera(ndc,camera);
   const intersections=ray.intersectObjects(scene.children,true);
   // Do not stack a new objective on top of an existing AAATRIGGER volume.
   const currentObjects=useEditor.getState().project.objects;
   if(currentObjects!==cachedObjects){cachedObjects=currentObjects;toolBrushes=findToolBrushes(cachedObjects)}
   const nearest=intersections.find(hit=>{
    let node:THREE.Object3D|null=hit.object;
    while(node){if(node.userData.brushId)return !toolBrushes.has(String(node.userData.brushId));node=node.parent}
    return false;
   });
   let surface:Vec3,normal:Vec3;
   if(nearest){
    surface=threeToGame(nearest.point);
    normal=nearest.face?threeToGame(nearest.face.normal.clone().transformDirection(nearest.object.matrixWorld).normalize()):[0,0,0];
   }else{
    // Empty map fallback: use the editor's Z=0 construction floor, never a wall.
    const hit=new THREE.Vector3();
    if(!ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),hit))return null;
    surface=threeToGame(hit);normal=[0,0,1];
   }
   const editor=useEditor.getState();
   return cs16AnchorAtSurface(surface,normal,request.tool,editor.snapping?editor.snap:1);
  };
  let lastMove=0;
  const move=(e:PointerEvent)=>{
   // The existing viewport can contain thousands of meshes; cap preview picks to ~30Hz.
   if(e.timeStamp-lastMove<32)return;lastMove=e.timeStamp;
   const at=locate(e);if(ghost.current){ghost.current.visible=!!at;if(at)ghost.current.position.copy(gameToThree(at))}
   useCSMapPlacement.getState().hoverAt(at);
  };
  const leave=()=>{if(ghost.current)ghost.current.visible=false;useCSMapPlacement.getState().hoverAt(null)};
  const down=(e:PointerEvent)=>{
   if(e.button!==0)return;
   const editor=useEditor.getState();
   if(editor.settings.gameProfile!=='cs16'||editor.walkMode||editor.hasPendingPlacement()){
    useCSMapPlacement.getState().cancel();return;
   }
   const at=locate(e);if(!at)return;
   e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
   useCSMapPlacement.getState().commit(at);
  };
  const key=(e:KeyboardEvent)=>{
   if(e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable]'))return;
   if(e.key==='Escape'){
    e.preventDefault();e.stopImmediatePropagation();useCSMapPlacement.getState().cancel();
   }else if(e.code==='KeyR'&&!e.repeat&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&request.action==='paint'&&request.tool!=='zone'){
    // Placement owns R only while armed. Editor-native R rotation is otherwise untouched.
    e.preventDefault();e.stopImmediatePropagation();useCSMapPlacement.getState().rotate(e.shiftKey?15:45);
   }
  };
  canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerleave',leave);
  canvas.addEventListener('pointerdown',down,true);
  window.addEventListener('keydown',key,true);
  return()=>{
   canvas.removeEventListener('pointermove',move);
   canvas.removeEventListener('pointerleave',leave);
   canvas.removeEventListener('pointerdown',down,true);
   window.removeEventListener('keydown',key,true);
  };
 },[request,camera,scene,gl]);
 if(!request)return null;
 const zone=request.tool==='zone';
 const color=request.tool==='spawns'?(request.team==='ct'?'#47bbff':'#ff9a76'):zone?'#f3c568':'#88ecac';
 return <group ref={ghost} visible={false}>
  {zone?<group>
   <mesh raycast={()=>null} position={[0,request.size[2]/2,0]}>
    <boxGeometry args={[request.size[0],request.size[2],request.size[1]]}/>
    <meshBasicMaterial color={color} transparent opacity={.14} depthWrite={false} side={THREE.DoubleSide}/>
   </mesh>
   <lineSegments raycast={()=>null} position={[0,request.size[2]/2,0]}>
    <edgesGeometry args={[new THREE.BoxGeometry(request.size[0],request.size[2],request.size[1])]}/>
    <lineBasicMaterial color={color} depthTest={false}/>
   </lineSegments>
  </group>:offsets.map((at,index)=><group key={index} position={gameToThree(at)}>
   <mesh raycast={()=>null}><sphereGeometry args={[8,10,8]}/><meshBasicMaterial color={color} transparent opacity={.78} depthTest={false}/></mesh>
   <mesh raycast={()=>null} rotation={[-Math.PI/2,0,0]} position={[0,-32,0]}>
    <ringGeometry args={[10,18,24]}/><meshBasicMaterial color={color} transparent opacity={.45} side={THREE.DoubleSide} depthTest={false}/>
   </mesh>
   {/* Arrow and GoldSrc yaw use the same convention as the existing spawn marker. */}
   <group rotation={[0,THREE.MathUtils.degToRad(request.yaw),0]}>
    <mesh raycast={()=>null} position={[14,0,0]} rotation={[0,0,-Math.PI/2]}>
     <coneGeometry args={[6,15,10]}/><meshBasicMaterial color="#ffffff" depthTest={false} transparent opacity={.95}/>
    </mesh>
    <mesh raycast={()=>null} position={[4,0,0]} rotation={[0,0,-Math.PI/2]}>
     <cylinderGeometry args={[2.2,2.2,11,7]}/><meshBasicMaterial color={color} depthTest={false}/>
    </mesh>
   </group>
  </group>)}
 </group>;
}
/** HF32: Unobtrusive markers in CS Map Studio. No extra hit targets or duplicate gizmos. */
export function CSMapMarkers(){
 const gameProfile=useEditor(s=>s.settings.gameProfile);
 const objects=useEditor(s=>s.project.objects),selectedIds=useEditor(s=>s.selectedIds);
 const studioOpen=useCSMapPlacement(s=>s.studioOpen),showMarkers=useCSMapPlacement(s=>s.showMarkers);
 const items=useMemo(()=>cs16Inventory(objects).filter(item=>!item.hidden).slice(0,200),[objects]);
 if(!studioOpen||!showMarkers||gameProfile!=='cs16')return null;
 const byId=new Map(objects.filter(o=>o.kind==='entity').map(o=>[o.id,o]));
 return <group>{items.map(item=>{
  const entity=byId.get(item.id);
  if(!entity||entity.kind!=='entity')return null;
  const tint=cs16MarkerTint(entity)||'#96adcd';
  const selected=selectedIds.includes(item.id)||item.brushIds.some(id=>selectedIds.includes(id));
  const directional=item.group==='ct'||item.group==='t'||item.group==='hostage'||item.group==='weapon';
  const yaw=Number(entity.props.angles?.trim().split(/\s+/)[1]??entity.props.angle??0);
  return <group key={item.id} position={gameToThree(item.position)} raycast={()=>null}>
   <mesh position={[0,selected?25:19,0]} raycast={()=>null}><octahedronGeometry args={[selected?9:6,0]}/>
    <meshBasicMaterial color={selected?'#ffffff':tint} depthTest={false} transparent opacity={.9}/></mesh>
   {directional&&<group rotation={[0,THREE.MathUtils.degToRad(Number.isFinite(yaw)?yaw:0),0]} raycast={()=>null}>
    <mesh raycast={()=>null} position={[19,19,0]} rotation={[0,0,-Math.PI/2]}><coneGeometry args={[5,12,8]}/>
     <meshBasicMaterial color={tint} depthTest={false}/></mesh>
    <mesh raycast={()=>null} position={[8,19,0]} rotation={[0,0,-Math.PI/2]}><cylinderGeometry args={[2,2,13,6]}/>
     <meshBasicMaterial color={tint} depthTest={false}/></mesh>
   </group>}
  </group>;
 })}</group>;
}
export function EnvironmentPlacement(){
 const kind=useEditor(s=>s.environmentPlacement);
 const {camera,scene,gl}=useThree();const marker=useRef<THREE.Group>(null);
 useEffect(()=>{
  if(!kind)return;
  const target=gl.domElement;
  const hit=(e:PointerEvent):Vec3|null=>surfaceHit(e,camera,scene,target,false,8)?.position||null;
  const move=(e:PointerEvent)=>{if(!marker.current)return;const p=hit(e);marker.current.visible=!!p;if(p)marker.current.position.copy(gameToThree(p))};
  const down=(e:PointerEvent)=>{if(e.button!==0)return;const p=hit(e);if(!p)return;e.preventDefault();e.stopImmediatePropagation();
   useEditor.getState().placePendingEnvironment(p);
  };
  const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();useEditor.getState().startEnvironmentPlacement(null)}};
  target.addEventListener('pointermove',move);target.addEventListener('pointerdown',down,true);window.addEventListener('keydown',esc,true);
  return()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerdown',down,true);window.removeEventListener('keydown',esc,true)};
 },[kind,camera,scene,gl]);
 return kind?<group ref={marker} visible={false}><mesh><octahedronGeometry args={[24,0]}/><meshBasicMaterial color={kind.kind==='env_fog'?'#76d8f2':'#ffdf6b'} transparent opacity={.65} depthTest={false}/></mesh></group>:null;
}
export function TextureDropHandler(){
  const {camera,scene,gl}=useThree();
  useEffect(()=>{
    const target=gl.domElement;
    const over=(e:DragEvent)=>{if(e.dataTransfer?.types.includes('application/x-svenstudio-texture')||e.dataTransfer?.types.includes('application/x-svenstudio-entity')||e.dataTransfer?.types.includes('application/x-svenstudio-model')||e.dataTransfer?.types.includes('application/x-svenstudio-sound')){e.preventDefault();e.dataTransfer.dropEffect='copy'}};
    const drop=(e:DragEvent)=>{
      const name=e.dataTransfer?.getData('application/x-svenstudio-texture');
      const entityName=e.dataTransfer?.getData('application/x-svenstudio-entity');
      const modelPath=e.dataTransfer?.getData('application/x-svenstudio-model');
      const soundPayload=e.dataTransfer?.getData('application/x-svenstudio-sound');
      if(!name&&!entityName&&!modelPath&&!soundPayload)return;
      e.preventDefault();
      const bounds=target.getBoundingClientRect();
      const ndc=new THREE.Vector2(((e.clientX-bounds.left)/bounds.width)*2-1,-((e.clientY-bounds.top)/bounds.height)*2+1);
      const ray=new THREE.Raycaster();ray.setFromCamera(ndc,camera);
      const hits=ray.intersectObjects(scene.children,true);
      if(soundPayload){
        let sound:string;
        try{const payload=JSON.parse(soundPayload);sound=payload.path;if(!validSoundReference(sound))return;}catch{return}
        const state=useEditor.getState();
        const selectedEntity=hits.map(hit=>{
          let node:THREE.Object3D|null=hit.object;
          while(node){if(node.userData.entityId)return node.userData.entityId as string;node=node.parent}
          return null;
        }).find(Boolean);
        const existing=state.project.objects.find(o=>o.id===selectedEntity&&o.kind==='entity') as PointEntity|undefined;
        if(existing&&['ambient_generic','ambient_music'].includes(existing.classname)){
          state.setObjectProp(existing.id,'message',sound);state.setSelected(existing.id);
          state.appendLogs([`Sound assigned: ${sound}`]);return;
        }
        const point=surfaceHit(e,camera,scene,target,false);
        if(!point)return;
        const at=point.position;
        state.createAudioAt('ambient_generic',sound,at);
        state.appendLogs([`${state.settings.gameProfile==='cs16'?'GoldSrc':'Svengine'} ambient_generic placed: ${sound}`]);return;
      }
      if(modelPath){
        if(!/^models\/[\w .\/-]+\.mdl$/i.test(modelPath)||modelPath.includes('..'))return;
        const state=useEditor.getState();
        const entityHit=hits.find(hit=>hit.object.userData.entityId);
        const id=entityHit?.object.userData.entityId as string|undefined;
        const entity=state.project.objects.find(o=>o.id===id&&o.kind==='entity') as PointEntity|undefined;
        if(entity){
          if(state.settings.gameProfile==='cs16'&&!state.fgdClasses.some(def=>def.name===entity.classname&&Object.hasOwn(def.props,'model'))){state.appendLogs(['CS 1.6: selected entity has no model property in FGD; drop cancelled.']);return}
          state.setObjectProp(entity.id,'model',modelPath);state.setSelected(entity.id);state.appendLogs([`Model assigned to ${entity.classname}: ${modelPath}`]);return}
        if(state.settings.gameProfile==='cs16'){state.appendLogs(['CS 1.6: item_generic is a Sven Co-op entity; model-drop creation disabled. Select a compatible entity with a model property in its FGD.']);return}
        const point=surfaceHit(e,camera,scene,target,false,3);
        if(point){
          const at=point.position;
          const def=state.fgdClasses.find(c=>c.name==='item_generic')||{name:'item_generic',type:'point' as const,description:'Generic Sven Co-op model',props:{}};
          state.addEntity(def,at);
          const id=useEditor.getState().selected;
          if(id)useEditor.getState().setObjectProp(id,'model',modelPath);
          state.appendLogs([`Svengine: item_generic model placed at ${at.join(' ')} with ${modelPath}.`]);
        }
        return;
      }
      if(entityName){
        const cls=useEditor.getState().fgdClasses.find(c=>c.name===entityName);
        if(cls&&cls.type==='point'){
          const point=surfaceHit(e,camera,scene,target,false,24);
          if(point){
            const state=useEditor.getState();const position=point.position;
            state.addEntity(cls,position);
            state.appendLogs([`${state.settings.gameProfile==='cs16'?'GoldSrc':'Svengine'} entity placed: ${entityName} at ${position.join(' ')}`]);
          }
        }
        return;
      }
      for(const hit of hits){
        const mesh=hit.object as THREE.Mesh;
        const id=mesh.userData.brushId as string|undefined;
        if(!id||!mesh.geometry)continue;
        const face=(mesh.geometry as THREE.BufferGeometry).userData.trianglesToFaces?.[hit.faceIndex??0] as number|undefined;
        if(face===undefined)continue;
        useEditor.getState().changeFace(id,face,{texture:name});
        useEditor.getState().setSelected(id,face);
        useEditor.getState().setFlag('faceMode',true);
        useEditor.getState().appendLogs([`Painted face ${face+1} of selected brush with ${name}.`]);
        break;
      }
    };
    target.addEventListener('dragover',over);target.addEventListener('drop',drop);
    return()=>{target.removeEventListener('dragover',over);target.removeEventListener('drop',drop)};
  },[camera,scene,gl]);
  return null;
}
/** Blueprint placement preview follows the exact generated brushes. A click commits
 * the saved drawing at the clicked map location in one project Undo step. */
export function BlueprintClickPlacement(){
  const id=useEditor(s=>s.blueprintPlacementId);
  const plan=useEditor(s=>s.project.blueprintPlans?.find(p=>p.id===id));
  const {camera,scene,gl}=useThree();
  const marker=useRef<THREE.Group>(null);
  const ghost=useMemo(()=>{
    if(!plan?.strokes.length)return null;
    try{
      const points=plan.strokes.flatMap(stroke=>stroke.points.map(p=>blueprintPixelToWorld(plan,p)));
      const center:[number,number]=[(Math.min(...points.map(p=>p[0]))+Math.max(...points.map(p=>p[0])))/2,
        (Math.min(...points.map(p=>p[1]))+Math.max(...points.map(p=>p[1])))/2];
      const positions:number[]=[];
      for(const brush of buildBlueprintBrushes(plan)){
        const vertices=transformedVertices(brush);
        for(const face of brush.faces)for(let n=1;n<face.indices.length-1;n++){
          for(const index of [face.indices[0],face.indices[n],face.indices[n+1]]){
            const v=vertices[index],local=gameToThree([v[0]-center[0],v[1]-center[1],v[2]-plan.baseZ]);
            positions.push(local.x,local.y,local.z);
          }
        }
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals();
      return geometry;
    }catch{return null}
  },[plan]);
  useEffect(()=>()=>{ghost?.dispose()},[ghost]);
  useEffect(()=>{
    if(!id||!ghost)return;
    const target=gl.domElement;
    const locate=(e:PointerEvent)=>{const hit=surfaceHit(e,camera,scene,target,false);return hit?snapPosition(hit.position):null};
    const move=(e:PointerEvent)=>{const at=locate(e);if(marker.current){marker.current.visible=!!at;if(at)marker.current.position.copy(gameToThree(at))}};
    const down=(e:PointerEvent)=>{
      if(e.button!==0)return;const at=locate(e);if(!at)return;
      e.preventDefault();e.stopImmediatePropagation();
      try{useEditor.getState().placeBlueprintAt(at)}catch(error){window.alert('Blueprint placement: '+String(error instanceof Error?error.message:error))}
    };
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();useEditor.getState().setBlueprintPlacement(null)}};
    target.addEventListener('pointermove',move);target.addEventListener('pointerdown',down,true);
    target.addEventListener('pointerleave',()=>{});window.addEventListener('keydown',key,true);
    return()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerdown',down,true);window.removeEventListener('keydown',key,true)};
  },[id,ghost,camera,scene,gl]);
  if(!id||!ghost)return null;
  return <group ref={marker} visible={false}><mesh geometry={ghost} raycast={()=>null}>
    <meshBasicMaterial color="#58d6ec" transparent opacity={.23} side={THREE.DoubleSide} depthWrite={false}/>
  </mesh></group>;
}
/** Single-click placement of terrain, rocks or path structures. The project is only
 * changed by placePendingTerrain after a surface hit, not when the tool is armed.
 * Uses the same Svengine coordinate conversions as the other 3D placements. */
export function TerrainClickPlacement(){
  const {camera,scene,gl}=useThree();
  const request=useEditor(s=>s.terrainPlacement);
  const marker=useRef<THREE.Group>(null);
  const pathGhost=useMemo(()=>{
    if(!request)return null;
    try{
      // v2.4: the ghost shows the real geometry for routes, spiral stairs and rocks.
      const solids=request.kind==='path'&&request.path?createPathStructureBrushes(request.path)
        :request.kind==='rocks'&&request.rocks?createRockCluster({...request.rocks,origin:[0,0,0],texture:request.draft.texture})
        :request.kind==='structure'&&request.structure?createArchitecture(request.structure.kind,request.structure.options,null,request.draft.texture,undefined,[0,0,0]).objects.filter((o):o is Brush=>o.kind==='brush')
        :request.kind==='kit'&&request.kit?kitPreviewBrushes(buildKit(request.kit.id,request.kit.options,[0,0,0],[],request.draft.texture).objects)
        :null;
      if(!solids)return null;
      const positions:number[]=[];
      const offset:Vec3=request.kind==='path'?request.draft.origin:[0,0,0];
      for(const brush of solids){const world=transformedVertices(brush);for(const face of brush.faces)for(let k=1;k<face.indices.length-1;k++){
        for(const id of [face.indices[0],face.indices[k],face.indices[k+1]]){
          const v=world[id],local=gameToThree([v[0]-offset[0],v[1]-offset[1],v[2]-offset[2]]);
          positions.push(local.x,local.y,local.z);
        }
      }}
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.computeVertexNormals();return geometry;
    }catch{return null;}
  },[request]);
  useEffect(()=>()=>{pathGhost?.dispose()},[pathGhost]);
  useEffect(()=>{
    if(!request)return;
    const target=gl.domElement;
    const locate=(e:PointerEvent):Vec3|null=>surfaceHit(e,camera,scene,target,false)?.position||null;
    const move=(e:PointerEvent)=>{if(!marker.current)return;const point=locate(e);
      marker.current.visible=!!point;if(point)marker.current.position.copy(gameToThree(point));};
    const down=(e:PointerEvent)=>{
      if(e.button!==0)return;
      const point=locate(e);if(!point)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const state=useEditor.getState();
      try{state.placePendingTerrain(point);state.appendLogs([`Terrain Studio: ${request.kind} placed at ${point.join(' ')}.`]);}
      catch(error){state.appendLogs([`Terrain placement rejected: ${String(error)}`]);window.alert(String(error));}
    };
    const leave=()=>{/* Keep the last valid preview across overlays. */};
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();useEditor.getState().startTerrainPlacement(null);}};
    target.addEventListener('pointermove',move);target.addEventListener('pointerleave',leave);
    target.addEventListener('pointerdown',down,true);window.addEventListener('keydown',key,true);
    return()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerleave',leave);
      target.removeEventListener('pointerdown',down,true);window.removeEventListener('keydown',key,true)};
  },[camera,scene,gl,request]);
  return request?<group ref={marker} visible={false} raycast={()=>null}>
    {pathGhost&&<mesh geometry={pathGhost} raycast={()=>null}><meshBasicMaterial color="#48dbfc" transparent opacity={0.36} side={THREE.DoubleSide} depthTest={false} depthWrite={false}/></mesh>}
    {request.kind==='radial'&&request.radial&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,1,0]} raycast={()=>null}><ringGeometry args={[Math.max(1,request.radial.radius-3),request.radial.radius,64,1,request.radial.startAngle*Math.PI/180,request.radial.sweep*Math.PI/180]}/><meshBasicMaterial color="#ffd27a" transparent opacity={.95} depthTest={false} depthWrite={false} side={THREE.DoubleSide}/></mesh>}
    {request.kind==='scatter'&&request.scatter&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,1,0]} raycast={()=>null}><ringGeometry args={[Math.max(1,request.scatter.options.radius-3),request.scatter.options.radius,64]}/><meshBasicMaterial color="#7dffb0" transparent opacity={.95} depthTest={false} depthWrite={false} side={THREE.DoubleSide}/></mesh>}
    {!pathGhost&&request.kind!=='scatter'&&request.kind!=='radial'&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,1,0]} raycast={()=>null}>
      <planeGeometry args={[request.kind==='terrain'?request.draft.width:request.kind==='path'?request.path?.width||96:request.rocks?.radius?request.rocks.radius*2:128,
        request.kind==='terrain'?request.draft.depth:request.kind==='path'?request.path?.width||96:request.rocks?.radius?request.rocks.radius*2:128]}/>
      <meshBasicMaterial color="#48dbfc" wireframe transparent opacity={.9} depthTest={false} depthWrite={false}/>
    </mesh>}<mesh raycast={()=>null}><sphereGeometry args={[6,8,6]}/><meshBasicMaterial color="#fff37a" depthTest={false}/></mesh>
  </group>:null;
}
/** Point-entity and NPC tools capture the next left click on the scene, then release it.
 * This is distinct from the Blender transform mode and ordinary selection.
 */
export function NpcClickPlacement(){
  const {camera,scene,gl}=useThree();
  const npcClass=useEditor(s=>s.pendingNpcClass);
  const routeOwner=useEditor(s=>s.routePlacementFor);
  useEffect(()=>{
    if(!npcClass&&!routeOwner)return;
    const target=gl.domElement;
    const down=(e:PointerEvent)=>{
      const state=useEditor.getState();
      if(!state.pendingNpcClass&&!state.routePlacementFor)return;
      if(e.button===2){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();state.startNpcPlacement(null);state.startWaypointPlacement(null);return;}
      if(e.button!==0)return;
      const point=surfaceHit(e,camera,scene,target,false,state.pendingNpcClass?24:4);
      if(!point)return;
      const at=point.position;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      try{
        if(state.routePlacementFor){state.placeWaypoint(state.routePlacementFor,at);state.appendLogs([`Svengine path_waypoint added at ${at.join(' ')}.`]);}
        else {const name=state.pendingNpcClass;state.placePendingNpc(at,useStudioLayout.getState().entityStampMode);state.appendLogs([`Svengine point entity placed: ${name} at ${at.join(' ')}.`]);}
      }catch(error){state.appendLogs([`NPC placement error: ${String(error)}`]);}
    };
    const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      const state=useEditor.getState();state.startNpcPlacement(null);state.startWaypointPlacement(null);
    }};
    target.addEventListener('pointerdown',down,true);window.addEventListener('keydown',key,true);
    return()=>{target.removeEventListener('pointerdown',down,true);window.removeEventListener('keydown',key,true)};
  },[camera,scene,gl,npcClass,routeOwner]);
  return null;
}
/** Captures one click in the 3D scene for a pending audio entity. */
export function AudioClickPlacement(){
  const {camera,scene,gl}=useThree();const active=useEditor(s=>s.audioPlacement);
  useEffect(()=>{
    if(!active)return;
    const target=gl.domElement;
    const onDown=(e:PointerEvent)=>{
      if(e.button!==0||!useEditor.getState().audioPlacement)return;
      const point=surfaceHit(e,camera,scene,target,false);
      if(!point)return;
      const state=useEditor.getState(),position=point.position;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      try{state.placePendingAudio(position);state.appendLogs([`Svengine sound entity placed at ${position.join(' ')}.`])}
      catch(error){state.appendLogs([`Audio placement failed: ${String(error)}`])}
    };
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();useEditor.getState().startAudioPlacement(null);
    }};
    target.addEventListener('pointerdown',onDown,true);window.addEventListener('keydown',onKey,true);
    return()=>{target.removeEventListener('pointerdown',onDown,true);window.removeEventListener('keydown',onKey,true)};
  },[camera,scene,gl,active]);return null;
}
/** Dedicated placement mode for GoldSrc path_corner; unlike the NPC path_waypoint tool. */
export function CinematicClickPlacement(){
  const {camera,scene,gl}=useThree();
  const active=useEditor(s=>s.cinematicPlacementFor);
  useEffect(()=>{
    if(!active)return;
    const target=gl.domElement;
    const onDown=(e:PointerEvent)=>{
      if(e.button!==0||!useEditor.getState().cinematicPlacementFor)return;
      const point=surfaceHit(e,camera,scene,target,false);
      if(!point)return;
      const state=useEditor.getState(),position=point.position;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      try{state.placeCinematicPoint(position);state.appendLogs([`Cinematic path_corner added at ${position.join(' ')}.`]);}
      catch(error){state.appendLogs([`Cinematic waypoint rejected: ${String(error)}`]);}
    };
    const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      useEditor.getState().startCinematicPlacement(null);
    }};
    target.addEventListener('pointerdown',onDown,true);window.addEventListener('keydown',onKey,true);
    return()=>{target.removeEventListener('pointerdown',onDown,true);window.removeEventListener('keydown',onKey,true)};
  },[camera,scene,gl,active]);
  return null;
}
