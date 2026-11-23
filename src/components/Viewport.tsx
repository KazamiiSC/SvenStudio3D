import {SkyboxBackground} from './BspViewerAssets';
import {isWalkCrouchHeld} from '../engine/controls';
import {keyboardVerticalDirection} from '../engine/cameraKeyboard';
import {canCaptureMapCamera,canMoveInCameraCapture} from '../engine/cameraCapture';
import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {visibleMarkerIds} from '../engine/mapEntityLabels';
import {Scan,EyeOff,Eye,Grid3x3,Magnet,SlidersHorizontal,Sun,Focus,Undo2,Redo2,Flashlight,ChevronDown} from 'lucide-react';
import {OrbitControls,TransformControls,GizmoHelper,GizmoViewport,Html,Line} from '@react-three/drei';
import {createContext,memo,useCallback,useContext,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import {useEditor} from '../store';
import {useCSMapPlacement} from '../csMapPlacementState';

import {useArchitectureMode} from '../architectureModeState';

import {ArchitectureDrawControls} from './ArchitectureModePanel';
import {buildMeshGeometry,brushDimensions,gameToThree,threeToGame,toRenderQuaternion,fromRenderQuaternion,transformedVertices} from '../engine/geometry';
import type {Brush,MapObject,PointEntity,TextureAsset,Vec3} from '../engine/types';
import {uniqueBrushEdges,editBrushVertices} from '../engine/modeling';
import {geometrySelectionCentroid,sanitizeGeometryDelta} from '../engine/geometryEditSelection';

import {organizeScene,routeColor} from '../engine/sceneOrganization';

import {parseLight,rgbHex,skyPreviewColor} from '../engine/environment';
import {previewLocalLight,previewSunLight,previewDirection,previewCone} from '../engine/lightingPreview';
import {useT,translate} from '../i18n';

import {MapPathEditControls} from './MapPathEditControls';
import type {PathEditAxis} from '../engine/path3DMath';
import {resolveVisualizationMode} from '../engine/viewportVisualization';
import {constrainDecalToBrush} from '../engine/decalSurface';
import {studioGuide} from '../engine/studioGuide';
import {isUvDragGesture} from '../engine/controls';
import {ContextHitProbe,ContextMenu,OrthoQuickTools,ghostContextOnlyRaycast,type SceneMenu} from './ViewportExtras';
import {StudioModel,loadModelByPath} from './ModelBrowser';
import type {StudioPreview} from '../engine/mdl';
import {useStudioLayout} from '../layout';
import {viewportTheme} from '../engine/viewportThemes';
import {markerKindForEntity,markerColorForEntity} from '../engine/entityAppearance';
import {entityBehindBrushHit} from '../engine/occludedEntitySelection';
import {canShiftSelectMapObjects,firstSelectableMapHit} from '../engine/mapShiftSelection';
import {entityDisplayName} from '../engine/entityNaming';
import {spawnYaw,spawnFloorZ,createSpawnFloorIndex,spawnModelFootHeight} from '../engine/spawnPresentation';
import {MapEntityLabelOverlay,type MapLabelAnchor} from './MapEntityLabelOverlay';
import {MapPerformanceMonitor} from './MapPerformanceMonitor';
import {updateBrushChunkReadout,clearBrushChunkReadout} from '../engine/mapRenderDiagnostics';
import {isRecoveredBspProject} from '../engine/recoveredBspPreview';
import {groupMapRenderSegments,reuseMapRenderSegments,isObjectSelected,selectMapPreviewBudget,samePreviewSets,type PreviewSets} from '../engine/mapViewportPerformance';
import {buildOpaqueBrushBatches,disposeOpaqueBatches,spatialBrushChunks,type BrushDrawBatchResult} from '../engine/opaqueBrushBatches';

import {preferredTextureAssets} from '../engine/textureWadSelection';
import type {OrbitControls as OrbitControlsImpl,TransformControls as TransformControlsImpl} from 'three-stdlib';
import {faceLocalBounds,resizeFromFace,type FaceAxis,type FaceSign} from '../engine/faceScale';
import {unitsPerScreenPixel,FACE_GIZMO_TIP_PIXELS,FACE_GIZMO_HIT_PIXELS,preciseFaceDistance} from '../engine/gizmoScale';
import {anchorPosition,selectionPivot,anchoredPose,expandPicker,GRID_STEPS,snapBrushScaleFactors} from '../engine/transformUX';
import {hitTransformPicker} from '../engine/gizmoPointer';
import {modifierKeys,EMPTY_MODIFIERS,transformGesture,snapIncrement,type ModifierKeys} from '../engine/transformModifiers';
import {createSmartSnapCache,resolveSmartSnap,smartSnapWorldTolerance,type SmartSnapCache,type SmartSnapResult,type SnapAxes} from '../engine/smartSnapping';
import {readSavedCamera,writeSavedCamera} from '../engine/cameraRecovery';

import {useHudLayout} from '../hudLayout';
import {useMapDoctorState} from '../mapDoctorState';

import {ViewportQuickActions,ViewportMoreMenu} from './ViewportQuickActions';
import {HudWidget} from './HudWidget';
import {HudCustomizer} from './HudCustomizer';
import {UniversalPlacementPanel} from './UniversalPlacementPanel';
import {QuickToolRail} from './QuickToolRail';
import {ShapePalette} from './ShapePalette';
import {TextureStudioPanel,TextureUVHandles} from './TextureStudio';
import {BuildTogetherCursors,BuildTogetherPresenceDock} from './BuildTogether';
import {RemoteBuildTogetherCameras} from './RemoteBuildTogetherCameras';
import {useBuildTogether,sendBuildTogetherCamera} from '../engine/buildTogetherClient';
import {GameplaySession} from '../engine/gameplayTest';
import {EntityMotionPreview3D} from './EntityMotionPreview3D';
import {EntityMotionPreviewPanel} from './EntityMotionPreviewPanel';
import {WALK,chooseWalkStart,walkCollider,walkStep,type WalkCollider,type WalkPose} from '../engine/playerWalk';
import {goldSrcMaterial,noclipDisplacement,readPreviewSettings,savePreviewSettings,normalizeWalkPreview,normalizeGoldSrcPreview,DEFAULT_WALK_PREVIEW,DEFAULT_GOLDSRC_PREVIEW,type WalkPreviewSettings,type GoldSrcPreviewSettings} from '../engine/previewEnhancements';
import {UniversalHoverProbe,UniversalPlacementGuide,PrimitivePlacement,PrefabClickPlacement,CSMapClickPlacement,CSMapMarkers,EnvironmentPlacement,TextureDropHandler,BlueprintClickPlacement,TerrainClickPlacement,NpcClickPlacement,AudioClickPlacement,CinematicClickPlacement} from './viewport/ClickPlacement';
import {CinematicRouteLines,AudioRadiusGuides,NpcRouteLines,EntityConnections,MeasurementOverlay,LeakTrace3D,CompileRegionBox,PlayerClearanceOverlay,CoopGhostOverlay,ArchitectureDrawingPlane,ArchitectureCornerHandles} from './viewport/SceneOverlays';

type WalkStats={position:[number,number,number];speed:number;grounded:boolean;crouched:boolean;noclip:boolean};
// A small, non-interactive world-space guide. Written by active drag sessions;
// updated through useFrame to avoid rerendering the entire MAP scene on pointermove.
let currentMagneticGuide:SmartSnapResult|null=null;
function updateMagneticGuide(value:SmartSnapResult|null){currentMagneticGuide=value;}
function MagneticSnapGuide(){
  const marker=useRef<THREE.Group>(null!);
  const {camera,size}=useThree();
  useFrame(()=>{
    const node=marker.current;if(!node)return;
    const result=currentMagneticGuide;
    node.visible=!!result;
    if(!result)return;
    node.position.copy(gameToThree(result.target));
    const distance=camera.position.distanceTo(node.position);
    const pixels=smartSnapWorldTolerance(camera,distance,size.height,12);
    node.scale.setScalar(Math.max(.1,Math.min(48,pixels*.45)));
  });
  return <group ref={marker} visible={false}>
    <mesh renderOrder={500} raycast={()=>{}}><sphereGeometry args={[.28,10,8]}/><meshBasicMaterial color="#40f4d0" depthTest={false} depthWrite={false}/></mesh>
    <mesh renderOrder={500} raycast={()=>{}}><boxGeometry args={[2,.08,.08]}/><meshBasicMaterial color="#40f4d0" depthTest={false} depthWrite={false}/></mesh>
    <mesh renderOrder={500} raycast={()=>{}}><boxGeometry args={[.08,2,.08]}/><meshBasicMaterial color="#40f4d0" depthTest={false} depthWrite={false}/></mesh>
    <mesh renderOrder={500} raycast={()=>{}}><boxGeometry args={[.08,.08,2]}/><meshBasicMaterial color="#40f4d0" depthTest={false} depthWrite={false}/></mesh>
  </group>;
}
/** Native Three.js picker axes are X/Y/Z; game axes are X/-Z/Y. */
function snapAxesForGizmo(axis:string|null|undefined):SnapAxes{
  if(!axis||axis==='XYZ'||axis==='E')return [true,true,true];
  return [axis.includes('X'),axis.includes('Z'),axis.includes('Y')];
}

type PreviewContextState={hideRecoveryNull:boolean;walk:WalkPreviewSettings;goldsrc:GoldSrcPreviewSettings;gameplaySession:{current:GameplaySession|null};reportGameplay:(text:string)=>void;updateWalk:(patch:Partial<WalkPreviewSettings>)=>void;updateGoldSrc:(patch:Partial<GoldSrcPreviewSettings>)=>void;reportWalk:(stats:WalkStats)=>void};
const PreviewContext=createContext<PreviewContextState>({hideRecoveryNull:true,walk:DEFAULT_WALK_PREVIEW,goldsrc:DEFAULT_GOLDSRC_PREVIEW,gameplaySession:{current:null},reportGameplay:()=>{},updateWalk:()=>{},updateGoldSrc:()=>{},reportWalk:()=>{}});
const waterPreviewTextures=new Set<THREE.Texture>();
function GoldSrcPreviewAnimator(){
 const {gl}=useThree();
 const {goldsrc}=useContext(PreviewContext);
 useEffect(()=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=goldsrc.enabled?goldsrc.exposure:1;return()=>{gl.toneMapping=THREE.NoToneMapping;gl.toneMappingExposure=1}},[gl,goldsrc.enabled,goldsrc.exposure]);
 useFrame(({clock})=>{if(waterPreviewTextures.size===0)return;const animate=goldsrc.enabled&&goldsrc.waterAnimation;const x=animate?Math.sin(clock.elapsedTime*.65)*.018:0,y=animate?clock.elapsedTime*.012%1:0;for(const tex of waterPreviewTextures){if(tex.offset.x!==x||tex.offset.y!==y)tex.offset.set(x,y);}});
 return null;
}
function WalkFlashlight(){
 const {walk}=useContext(PreviewContext);const walking=useEditor(s=>s.walkMode);
 const {camera,scene}=useThree();
 // Three.js physically-correct lights need much larger luminous intensity than the
 // legacy GoldSrc point-light numbers. At 100-300 editor units intensity=15
 // was effectively invisible against the existing ambient fill.
 const spot=useMemo(()=>{const light=new THREE.SpotLight('#fff7e4',60000,1250,Math.PI/5,.48,2);light.castShadow=false;return light},[]);
 useEffect(()=>{if(!walking||!walk.flashlight)return;scene.add(spot);scene.add(spot.target);return()=>{scene.remove(spot);scene.remove(spot.target)}},[walking,walk.flashlight,scene,spot]);
 useFrame(()=>{if(!walking||!walk.flashlight)return;const direction=new THREE.Vector3();camera.getWorldDirection(direction);
   spot.intensity=walk.flashlightPower;
   spot.position.copy(camera.position).addScaledVector(direction,.6);
   spot.target.position.copy(camera.position).addScaledVector(direction,350);spot.target.updateMatrixWorld();});
 return null;
}
const textureCache=new Map<string,THREE.Texture>();
const sharedMaterials=new Map<string,THREE.MeshStandardMaterial>();
// Invisible only to WebGL; Three.js Mesh.raycast still resolves the original
// per-brush triangles for UV editing, decals, selection and gizmo interactions.
const batchPickerMaterial=new THREE.MeshBasicMaterial({visible:false,side:THREE.DoubleSide});
const entityMarkerGeometry={
  box:new THREE.BoxGeometry(14,14,14),bubble:new THREE.SphereGeometry(8,14,10),
  capsule:new THREE.CapsuleGeometry(6,9,5,10),diamond:new THREE.OctahedronGeometry(10),
  cone:new THREE.ConeGeometry(8,17,12),light:new THREE.SphereGeometry(9,16,10),
  door:new THREE.BoxGeometry(4,22,14),button:new THREE.CylinderGeometry(8,8,4,16),
  speaker:new THREE.ConeGeometry(8,16,16),relay:new THREE.DodecahedronGeometry(9),
  trigger:new THREE.BoxGeometry(17,15,17),item:new THREE.TetrahedronGeometry(11)
};
// Shared per-color materials: X-ray needs no per-frame extra geometry or raycasts.
const entityMarkerMaterials=new Map<string,THREE.Material>();
function markerMaterial(color:string,selected:boolean,xray=false){
  const key=`${color}:${selected}:${xray}`;
  let material=entityMarkerMaterials.get(key);
  if(!material){
    material=xray
      ? new THREE.MeshBasicMaterial({color,transparent:true,opacity:selected?.90:.62,depthTest:false,depthWrite:false,toneMapped:false})
      : new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:selected?.8:.4});
    entityMarkerMaterials.set(key,material);
  }
  return material;
}
/** A brush often sits in front of a point entity, intercepting R3F pointerdown.
 * R3F already provides all mesh intersections, including markers behind the wall.
 * Prioritize only actual marker shapes, not entire models, when X-ray or Alt is used.
 */
function selectOccludedEntity(
  intersections:readonly {object:{userData:Record<string,unknown>}}[],
  additive:boolean
):boolean{
  const state=useEditor.getState();
  const id=entityBehindBrushHit(intersections,candidate=>state.project.objects.some(obj=>obj.kind==='entity'&&obj.id===candidate&&!obj.hidden&&!obj.locked));
  if(!id)return false;
  state.selectObject(id,additive);
  return true;
}
const textureAssetIndex=new WeakMap<TextureAsset[],{key:string;index:Map<string,TextureAsset>}>();
const textureSizeCache=new WeakMap<TextureAsset[],{key:string;sizes:ReadonlyMap<string,{width:number;height:number}>}>();
function compilerWadPriority(){
  const state=useEditor.getState();
  const paths=state.settings.wadPaths.split(/[\r\n]+/).map(s=>s.trim()).filter(Boolean);
  return {key:paths.join(';')+'|'+state.project.wadNames.join(';'),paths,projectWads:state.project.wadNames};
}
function textureAssetLookup(assets:TextureAsset[]):Map<string,TextureAsset>{
  const priority=compilerWadPriority();
  let cached=textureAssetIndex.get(assets);
  if(!cached||cached.key!==priority.key){
    cached={key:priority.key,index:preferredTextureAssets(assets,priority.paths,priority.projectWads)};
    textureAssetIndex.set(assets,cached);
  }
  return cached.index;
}
export function textureSizeLookup(assets:TextureAsset[]):ReadonlyMap<string,{width:number;height:number}>{
  const priority=compilerWadPriority();
  let cached=textureSizeCache.get(assets);
  if(!cached||cached.key!==priority.key){
    const preferred=textureAssetLookup(assets);
    cached={key:priority.key,sizes:new Map([...preferred].map(([name,asset])=>[name.toUpperCase(),{width:asset.width,height:asset.height}]))};
    textureSizeCache.set(assets,cached);
  }
  return cached.sizes;
}
const starterTextures=new Set(["SV_BRICK01", "SV_CONCRET", "SV_TILE01", "SV_METAL01", "SV_GRID01"]);
// Public starter textures are available on the very first render, even while
// asynchronous WAD decoding is still running. This does not change map data.
// Access the actual scene groups during a multi-object gizmo drag. Moving only
// the empty pivot makes the gizmo move while the brushes remain stationary.
const visualGroups=new Map<string,THREE.Group>();
// One native TransformControls picker owns handle gestures. Mesh-selection
// callbacks consult it before changing any selection (also without Measure).
let selectedGizmoPointerHit:((x:number,y:number)=>boolean)|null=null;
let faceScaleOrbitToggle:((enabled:boolean)=>void)|null=null;
function pointerOnSelectedGizmo(event:{clientX:number;clientY:number}){
  return selectedGizmoPointerHit?.(event.clientX,event.clientY)===true;
}
/** Shift+click selects an additional brush/entity before the camera or a
 * transparent R3F picker can consume the pointer event. The normal R3F handler
 * remains responsible for unmodified clicks, UV faces and gizmo transforms.
 * Capture handling prevents a second toggle from the React Three Fiber mesh.
 */
function ShiftObjectSelectionBridge(){
  const {gl,camera,scene}=useThree();
  useEffect(()=>{
    const canvas=gl.domElement;
    const raycaster=new THREE.Raycaster();
    const ndc=new THREE.Vector2();
    const down=(event:PointerEvent)=>{
      const state=useEditor.getState();
      if(!canShiftSelectMapObjects(state,event.button,event.shiftKey))return;
      if(state.hasPendingPlacement()||useArchitectureMode.getState().mode!=='off')return;
      // The transform gizmo may use Shift for fine dragging. Never steal its handles.
      if(state.mode!=='select'&&pointerOnSelectedGizmo(event))return;
      const bounds=canvas.getBoundingClientRect();
      if(bounds.width<=0||bounds.height<=0)return;
      ndc.set((event.clientX-bounds.left)*2/bounds.width-1,1-(event.clientY-bounds.top)*2/bounds.height);
      raycaster.setFromCamera(ndc,camera);
      const id=firstSelectableMapHit(raycaster.intersectObjects(scene.children,true),state.project.objects);
      if(!id)return;
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      state.selectObject(id,true);
    };
    canvas.addEventListener('pointerdown',down,true);
    return()=>canvas.removeEventListener('pointerdown',down,true);
  },[gl,camera,scene]);
  return null;
}

/** v2.4: entity marker/model groups, culled by distance and count (Appearance settings). */
const entityMarkerGroups=new Map<string,{group:THREE.Group;position:Vec3}>();
/** v2.4: 3D models are culled separately: all visible by default, or only within a chosen distance. */
const entityModelGroups=new Map<string,{group:THREE.Group;position:Vec3}>();
function EntityMarkerCuller(){
  const settings=useEditor(s=>s.mapLabelSettings);
  const modelDisplay=useStudioLayout(s=>s.modelDisplay),modelDistance=useStudioLayout(s=>s.modelDistance);
  const last=useRef({at:0,x:NaN,y:NaN,z:NaN,count:-1,serial:''});
  useFrame(({camera,clock})=>{
    const now=clock.elapsedTime,p=camera.position,l=last.current;
    const state=useEditor.getState();
    const serial=`${settings.markerDistance}:${settings.maxMarkers}:${modelDisplay}:${modelDistance}:${entityModelGroups.size}:${state.selectedIds.join(',')}`;
    const moved=Math.abs(p.x-l.x)+Math.abs(p.y-l.y)+Math.abs(p.z-l.z)>8;
    if(!moved&&serial===l.serial&&entityMarkerGroups.size===l.count&&now-l.at<1.5)return;
    if(now-l.at<.2&&serial===l.serial)return;
    last.current={at:now,x:p.x,y:p.y,z:p.z,count:entityMarkerGroups.size,serial};
    const cam=threeToGame(p.clone());
    const selected=new Set(state.selectedIds);
    const entries=[...entityMarkerGroups].map(([id,e])=>({id,selected:selected.has(id),distanceSquared:(e.position[0]-cam[0])**2+(e.position[1]-cam[1])**2+(e.position[2]-cam[2])**2}));
    const keep=visibleMarkerIds(entries,settings.markerDistance,settings.maxMarkers);
    for(const [id,e] of entityMarkerGroups)e.group.visible=keep.has(id);
    const limit=modelDisplay==='near'?modelDistance*modelDistance:Infinity;
    for(const [id,e] of entityModelGroups)e.group.visible=selected.has(id)||(e.position[0]-cam[0])**2+(e.position[1]-cam[1])**2+(e.position[2]-cam[2])**2<=limit;
  });
  useEffect(()=>()=>{for(const e of entityMarkerGroups.values())e.group.visible=true;for(const e of entityModelGroups.values())e.group.visible=true;},[]);
  return null;
}
/** v2.4: id → point entity, cached per objects array (shared by every brush of the frame). */
const entityLookupCache=new WeakMap<readonly MapObject[],Map<string,PointEntity>>();
function entityLookup(objects:readonly MapObject[]):Map<string,PointEntity>{
  let map=entityLookupCache.get(objects);
  if(!map){map=new Map();for(const o of objects)if(o.kind==='entity')map.set(o.id,o);entityLookupCache.set(objects,map);}
  return map;
}
function useVisualGroup(id:string,hidden:boolean,ref:React.RefObject<THREE.Group|null>){
  useEffect(()=>{
    if(!hidden&&ref.current)visualGroups.set(id,ref.current);
    return()=>{visualGroups.delete(id)};
  },[id,hidden,ref]);
}
function materialTexture(texture:string,assets:TextureAsset[]) {
  const a=textureAssetLookup(assets).get(texture.toLowerCase());
  const starter=starterTextures.has(texture.toUpperCase());
  if(!a&&!starter)return undefined;
  const key=a?`${a.wad}:${a.name}:${a.sourceId||'legacy'}`:`starter:${texture.toUpperCase()}`;
  if(textureCache.has(key))return textureCache.get(key);
  const url=a?.dataUrl||`/starter-textures/${texture.toUpperCase()}.png`;
  const t=new THREE.TextureLoader().load(url,undefined,undefined,error=>{
    console.warn(`Sven Studio texture could not be loaded: ${texture}`,error);
  });
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearMipmapLinearFilter;
  t.colorSpace=THREE.SRGBColorSpace;t.needsUpdate=true;textureCache.set(key,t);return t;
}
function makeBrushMaterials(b:Brush,assets:TextureAsset[],wireframe:boolean,entity:PointEntity|undefined,solidShading:boolean,goldsrc:GoldSrcPreviewSettings,hideRecoveryNull:boolean,isBspRecovered:boolean){
  return b.faces.map((f,i)=>{
    // Decompiled MAPs may expose NULL tool faces not present in the compiled BSP.
    // Preview-only: do not paint them or modify MAP/brush data.
    if(isBspRecovered&&hideRecoveryNull&&!solidShading&&!wireframe&&f.texture.toUpperCase()==='NULL'){
      // An opacity-0 MeshStandardMaterial still enters WebGL's transparent
      // render queue. Mark this preview-only material invisible so NULL tool
      // faces cost NO draw calls. Three.js raycasting continues to use the
      // original brush geometry and its face indices (tested in HF17 HF4).
      const key='bsp-recovery-hidden-null';
      let hidden=sharedMaterials.get(key);
      if(!hidden){hidden=new THREE.MeshStandardMaterial({visible:false,side:THREE.DoubleSide});sharedMaterials.set(key,hidden)}
      return hidden;
    }
    const image=solidShading?undefined:materialTexture(f.texture,assets);
    const palette=['#a9b1ba','#9da6b2','#b8a8a0','#a19a90','#8fa3ad','#99a098'];
    const color=solidShading?'#acb5c1':image?'#ffffff':palette[i%palette.length];
    const info=solidShading?{kind:'opaque' as const,opacity:1,alphaTest:0}:goldSrcMaterial(f.texture,entity);
    const special=!solidShading&&goldsrc.enabled&&goldsrc.transparency;
    const transparent=special&&['water','glass','additive'].includes(info.kind);
    const masked=info.kind==='masked';
    const key=`${image?.uuid||'none'}:${color}:${wireframe}:${info.kind}:${transparent?info.opacity:1}:${masked}`;
    let material=sharedMaterials.get(key);
    if(!material){
      material=new THREE.MeshStandardMaterial({map:image,color,roughness:info.kind==='glass'?.25:info.kind==='water'?.34:.93,metalness:info.kind==='glass'?.08:0,
        side:THREE.DoubleSide,wireframe,transparent,opacity:transparent?info.opacity:1,alphaTest:masked?info.alphaTest:0,
        depthWrite:transparent?false:true,blending:transparent&&info.kind==='additive'?THREE.AdditiveBlending:THREE.NormalBlending,emissive:info.kind==='additive'?'#888888':'#000000',emissiveIntensity:info.kind==='additive'?.4:0});
      // v2.4: transparent DoubleSide materials are otherwise drawn in two passes and flagged needsUpdate
      // twice per object per frame (program parameters recomputed every frame). One pass looks the same here.
      material.forceSinglePass=true;
      sharedMaterials.set(key,material);
    }
    if(image&&info.kind==='water')waterPreviewTextures.add(image);
    return material;
  });
}
function useMaterials(b:Brush,assets:TextureAsset[],wireframe:boolean,entity?:PointEntity){
  const wadPriority=useEditor(s=>s.settings.wadPaths+'|'+s.project.wadNames.join(';'));
  const {goldsrc,hideRecoveryNull}=useContext(PreviewContext);
  const walking=useEditor(s=>s.walkMode);
  const isBspRecovered=useEditor(s=>isRecoveredBspProject(s.project));
  const solidShading=useEditor(s=>s.solidShading)&&!walking;
  return useMemo(()=>makeBrushMaterials(b,assets,wireframe,entity,solidShading,goldsrc,hideRecoveryNull,isBspRecovered),
    [b.faces,assets,wadPriority,wireframe,entity,solidShading,goldsrc.enabled,goldsrc.transparency,isBspRecovered,hideRecoveryNull]);
}
/**
 * Screen-space nameplate for Svengine point entities and tied brush entities.
 * Drei Html without distanceFactor keeps a constant pixel size in perspective
 * AND orthographic cameras. Distance scaling made labels microscopic while
 * orbiting and enormous when switching to a numpad orthographic view.
 */
function EntityNameLabel({classname,targetname,position,selected=false,color,isSpawn=false}:{
  classname:string;targetname?:string;position:[number,number,number];
  selected?:boolean;color:string;isSpawn?:boolean;
}){
  const appearance=useEditor(s=>s.entityAppearance);
  const main=(appearance.showClassname||isSpawn&&appearance.alwaysShowSpawn)?classname:'';
  const sub=appearance.showTargetname?targetname:undefined;
  if(!main&&!sub)return null;
  return <Html position={position} center zIndexRange={[3000,3000]}
      style={{pointerEvents:'none',userSelect:'none',zIndex:3000}}>
    <div className={`entity-world-label ${selected?'is-selected':''} ${isSpawn?'is-spawn':''}`}
      style={{borderColor:color,opacity:appearance.opacity,fontSize:appearance.labelSize,boxShadow:`0 4px 18px #000c,0 0 18px ${color}50`}}
      role="note" aria-label={classname}>
      <span className="entity-label-indicator" style={{background:color,boxShadow:`0 0 12px ${color}`}}/>
      <span className="entity-label-text">{main&&<strong>{main}</strong>}{sub&&<small style={{color}}>#{sub}</small>}</span>
    </div>
  </Html>;
}

/** Transparent editor-only geometry; never written to the .map or selected by raycast. */
function GhostBrush({object}:{object:Brush}){
  const assets=useEditor(s=>s.textureAssets);
  const wadPriority=useEditor(s=>s.settings.wadPaths+'|'+s.project.wadNames.join(';'));
  const assetSizes=useMemo(()=>textureSizeLookup(assets),[assets,wadPriority]);
  const geometry=useMemo(()=>buildMeshGeometry(object,assetSizes),[object.vertices,object.faces,object.position,object.rotation,object.scale,assetSizes,wadPriority]);
  const edges=useMemo(()=>new THREE.EdgesGeometry(geometry,28),[geometry]);
  useEffect(()=>()=>{geometry.dispose();edges.dispose()},[geometry,edges]);
  const pos=gameToThree(object.position),quat=toRenderQuaternion(object.rotation);
  const scale:[number,number,number]=[object.scale[0],object.scale[2],object.scale[1]];
  return <group position={pos} quaternion={quat} scale={scale}>
    <mesh geometry={geometry} userData={{hiddenBrushId:object.id}} raycast={ghostContextOnlyRaycast}>
      <meshBasicMaterial color="#62c2f7" transparent opacity={0.12} depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>
    <lineSegments geometry={edges} raycast={()=>null}>
      <lineBasicMaterial color="#78caff" transparent opacity={0.42} depthWrite={false}/>
    </lineSegments>
  </group>;
}
/** Gameplay Test only: moves a brush-entity brush (doors, platforms). Mounted only for entity brushes in walk mode,
 * instead of a per-frame callback on every brush of the map (v2.4). */
function BrushEntityMotion({groupRef,object}:{groupRef:React.RefObject<THREE.Group|null>;object:Brush}){
  const {gameplaySession}=useContext(PreviewContext);
  useFrame(()=>{
    if(!groupRef.current||!object.entityId)return;
    const offset=gameplaySession.current?.doorOffset(object.entityId)||[0,0,0];
    const base=gameToThree(object.position);
    groupRef.current.position.set(base.x+offset[0],base.y+offset[2],base.z-offset[1]);
    groupRef.current.updateMatrix();
  });
  return null;
}
function BrushVisual({object,optimizedLabels=false,batched=false,batchedFaces}:{object:Brush;optimizedLabels?:boolean;batched?:boolean;batchedFaces?:ReadonlySet<number>}){
  // v2.4 performance: a brush subscribes ONLY to state that changes how it is drawn. Tool state that is
  // only needed when the user clicks is read with useEditor.getState() inside the handlers. With thousands
  // of brushes this removes ~30 store subscriptions per brush (memory, and selector work on every change).
  const selected=useEditor(s=>isObjectSelected(s.selectedIds,object.id));
  const lastSelected=useEditor(s=>s.selected===object.id);
  const faceMode=useEditor(s=>s.faceMode);
  // Faces of THIS brush highlighted in face mode, as a stable string key.
  const faceKey=useEditor(s=>{
    if(!s.faceMode)return '';
    if(s.textureFaceSelection.length)return s.textureFaceSelection.filter(r=>r.id===object.id).slice(0,48).map(r=>r.face).join(',');
    return s.selected===object.id&&s.selectedFace!==null?String(s.selectedFace):'';
  });
  const showNames=useEditor(s=>!!object.entityId&&s.showEntityNames);
  const appearance=useEditor(s=>s.entityAppearance);
  const architectureActive=useEditor(s=>!!s.architecturePlacement);
  const hoverActive=useEditor(s=>s.architectureHoverTarget===object.id);
  const [architectureHover,setArchitectureHover]=useState<[number,number,number]|null>(null);
  const [architecturePreviewSize,setArchitecturePreviewSize]=useState<[number,number]|null>(null);
  const architectureDrag=useRef<{start:Vec3;current:Vec3}|null>(null);
  // A wall has to be a straight, sufficiently wide, upright world brush.
  // Trim, door leaves and small architectural fragments must never capture
  // placement events or leave lingering outlines around the room.
  const eligibleWall=useMemo(()=>{
    if(!architectureActive)return false;
    if(object.locked||object.hidden||object.entityId||!['box','poly'].includes(object.primitive)||object.rotation.some(v=>Math.abs(v)>.01))return false;
    if(/(?:side frame|header|sill|door \/ leaf)/i.test(object.name))return false;
    const pts=transformedVertices(object);
    // After cutting a door, SC-CSG-safe wall fragments become poly brushes.
    // Accept those only if they are still axis-aligned rectangular prisms.
    const dims=[0,1,2].map(i=>Math.max(...pts.map(p=>p[i]))-Math.min(...pts.map(p=>p[i])));
    if(object.primitive==='poly'){
      if(pts.length!==8||[0,1,2].some(i=>new Set(pts.map(p=>Math.round(p[i]*100)/100)).size!==2))return false;
    }
    return dims[2]>=32&&Math.min(dims[0],dims[1])<Math.max(dims[0],dims[1])*.5;
  },[object,architectureActive]);
  // v2.4: O(1) lookup (was a linear search over every map object, per brush, on every store update).
  const associatedEntity=useEditor(s=>object.entityId?entityLookup(s.project.objects).get(object.entityId):undefined);
  const ed=()=>useEditor.getState();
  // Vertex/edge/face edit handles: only for the single selected brush.
  const editKind=useEditor(s=>s.selectedIds.length===1&&s.selectedIds[0]===object.id&&s.geometryMode!=='object'&&!(s.geometryMode==='face'&&s.textureStudioOpen)?s.geometryMode as 'vertex'|'edge'|'face':null);
  const textureDrag=useRef<{x:number;y:number;face:number;mode:'offset'|'rotate'|'scale'}|null>(null);  const getThree=useThree(s=>s.get);
  const setOrbitEnabled=(enabled:boolean)=>{
    const orbit=getThree().controls as OrbitControlsImpl|undefined;
    if(orbit)orbit.enabled=enabled;
  };
  const assets=useEditor(s=>s.textureAssets);
  const wadPriority=useEditor(s=>s.settings.wadPaths+'|'+s.project.wadNames.join(';'));
  const wireframe=useEditor(s=>s.wireframe);
  const walkMode=useEditor(s=>s.walkMode);
  const assetSizes=useMemo(()=>textureSizeLookup(assets),[assets,wadPriority]);
  const geometry=useMemo(()=>buildMeshGeometry(object,assetSizes),[object.vertices,object.faces,object.position,object.rotation,object.scale,assetSizes,wadPriority]);
  const edges=useMemo(()=>selected?new THREE.EdgesGeometry(geometry,24):null,[geometry,selected]);
  const materials=useMaterials(object,assets,wireframe,associatedEntity);
  // HF17 HF2: only opaque faces are merged. Keep special transparent/masked
  // groups visible on their original brush mesh without duplicating opaque faces.
  // The invisible picker preserves the exact original raycast triangle indexing.
  const displayMaterials=useMemo(()=>batched?batchPickerMaterial:
    batchedFaces?materials.map((material,index)=>batchedFaces.has(index)?batchPickerMaterial:material):materials,
    [materials,batched,batchedFaces]);
  const shadows=useEditor(s=>s.environmentPreview&&s.previewShadows);
  const groupRef=useRef<THREE.Group>(null!);
  useVisualGroup(object.id,!!object.hidden,groupRef);
  // v2.4: unselected brushes do not recompute their matrix every frame (the gizmo only moves selected ones,
  // Gameplay Test moves doors); refresh it after each render instead.
  useLayoutEffect(()=>{groupRef.current?.updateMatrix();});
  useEffect(()=>()=>{geometry.dispose();edges?.dispose()},[geometry,edges]);
  useEffect(()=>{
    if(!architectureActive){setArchitectureHover(null);setArchitecturePreviewSize(null);architectureDrag.current=null;}
  },[architectureActive]);
  // Shared materials are intentionally not disposed per brush; hundreds of
  // brushes can safely reuse one WebGL material for the same texture.
  if(object.hidden&&!walkMode)return null;
  // Trigger volumes are editor-only guides, not visible solid walls in Sven Co-op.
  if(walkMode&&associatedEntity?.classname.startsWith('trigger_'))return null;
  const pos=gameToThree(object.position),quat=toRenderQuaternion(object.rotation);
  const scale=new THREE.Vector3(object.scale[0],object.scale[2],object.scale[1]);
  const node=(<group ref={groupRef} position={pos} quaternion={quat} scale={scale} matrixAutoUpdate={selected||walkMode}>
    {walkMode&&object.entityId&&<BrushEntityMotion groupRef={groupRef} object={object}/>}
    {/* v2.4: a fully batched, unselected brush is drawn by its chunk; its own mesh only serves clicks.
        visible=false skips it in the renderer (frustum test, groups) while raycasts still hit it. */}
    <mesh geometry={geometry} material={displayMaterials} visible={!batched||selected||walkMode} matrixAutoUpdate={false} castShadow={shadows&&!batched} receiveShadow={shadows&&!batched} userData={{brushId:object.id}} onPointerDown={e=>{
      if(useArchitectureMode.getState().mode!=='off'||walkMode||e.button!==0||ed().drawMode||ed().placementShape||useEditor.getState().placementPrefabId||ed().audioPlacement||ed().environmentPlacement)return;
      if(ed().activeDecal&&e.face){
        e.stopPropagation();e.nativeEvent.preventDefault();
        const normal=e.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(e.object.matrixWorld)).normalize();
        const at=e.point.clone().addScaledVector(normal,0.8); // GoldSrc decal trace needs the entity on the surface.
        useEditor.getState().placeDecal(threeToGame(at),threeToGame(normal),object.id);
        return;
      }
      // Unlike Measure mode, ordinary selection used to steal native gizmo
      // pointerdowns when a ring/plane overlapped the selected brush.
      if(pointerOnSelectedGizmo(e))return;
      // In object mode, a visible X-ray marker takes priority over the wall.
      // Alt+click temporarily enables the same behavior in normal-depth mode.
      if(!ed().architecturePlacement&&!ed().measureMode&&!faceMode&&ed().geometryMode==='object'&&!ed().texturePickerActive
        &&(appearance.markerOcclusion==='xray'||e.altKey)
        &&selectOccludedEntity(e.intersections,e.shiftKey||e.ctrlKey||e.metaKey)){
        e.stopPropagation();return;
      }
      if(ed().architecturePlacement){
        if(!eligibleWall)return; // Let the raycaster reach the wall behind decorations.
        e.stopPropagation();e.nativeEvent.preventDefault();
        ed().setArchitectureHoverTarget(object.id);
        const at=threeToGame(e.point);
        architectureDrag.current={start:at,current:at};
        setOrbitEnabled(false);
        (e.target as {setPointerCapture?:(id:number)=>void}|null)?.setPointerCapture?.(e.pointerId);
        return;
      }
      if(ed().measureMode){e.stopPropagation();ed().measurePoint(threeToGame(e.point));return;}
      e.stopPropagation();if(object.locked)return;
      const triIndex=e.faceIndex??0;
      const faceIndex=geometry.userData.trianglesToFaces?.[triIndex]??null;
      if(ed().texturePickerActive&&faceIndex!==null){ed().sampleTextureStudioFace(object.id,faceIndex);return;}
      // Alt+drag on a face moves U/V texture offsets with a live preview.
      // The whole gesture becomes ONE undo step when the pointer is released.
      if(isUvDragGesture(e,faceMode)&&faceIndex!==null){
        e.nativeEvent.preventDefault();
        setOrbitEnabled(false);
        ed().selectTextureStudioFace(object.id,faceIndex,false);
        ed().beginTextureDrag(object.id,faceIndex);
        textureDrag.current={x:e.clientX,y:e.clientY,face:faceIndex,mode:e.shiftKey?'rotate':e.ctrlKey?'scale':'offset'};
        (e.target as {setPointerCapture?:(id:number)=>void}|null)?.setPointerCapture?.(e.pointerId);
        return;
      }
      // A click on a selected brush must not collapse a multi-selection
      // while the user is grabbing a transform gizmo overlapping that brush.
      if(selected&&ed().selectedIds.length>1&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey)return;
      if(faceMode&&faceIndex!==null){
        ed().selectTextureStudioFace(object.id,faceIndex,e.shiftKey||e.ctrlKey||e.metaKey);
        document.dispatchEvent(new CustomEvent('svenstudio:uv-pin',{detail:{id:object.id,face:faceIndex,x:e.clientX,y:e.clientY}}));
      }
      else ed().selectObject(object.id,e.shiftKey||e.ctrlKey||e.metaKey,null);
    }} onDoubleClick={e=>{
      if(walkMode||object.locked||object.hidden||ed().architecturePlacement||ed().drawMode||useEditor.getState().placementPrefabId||useEditor.getState().activeDecal)return;
      const faceIndex=geometry.userData.trianglesToFaces?.[e.faceIndex??0];if(faceIndex===undefined)return;
      e.stopPropagation();
      const alreadyEditingFace=useEditor.getState().geometryMode==='face';
      if(!alreadyEditingFace)useEditor.getState().setGeometryMode('face');
      ed().selectTextureStudioFace(object.id,faceIndex,false);
      // Preserve the long-standing object-mode double-click shortcut for UV.
      // A second click in geometry Face mode must not unexpectedly open UV.
      if(!alreadyEditingFace)ed().setTextureStudioOpen(true);
      document.dispatchEvent(new CustomEvent('svenstudio:uv-pin',{detail:{id:object.id,face:faceIndex,x:e.clientX,y:e.clientY}}));
    }} onPointerMove={e=>{
      if(ed().architecturePlacement){
        if(!eligibleWall)return;
        e.stopPropagation();
        ed().setArchitectureHoverTarget(object.id);
        const at=threeToGame(e.point);
        if(architectureDrag.current){
          architectureDrag.current.current=at;
          const pts=transformedVertices(object);const size=[0,1].map(i=>Math.max(...pts.map(v=>v[i]))-Math.min(...pts.map(v=>v[i])));
          const across=size[0]<size[1]?1:0;
          const a=architectureDrag.current.start;
          const mid:Vec3=[(a[0]+at[0])/2,(a[1]+at[1])/2,(a[2]+at[2])/2];
          const local=groupRef.current?.worldToLocal(new THREE.Vector3(...gameToThree(mid)));
          if(local)setArchitectureHover([local.x,local.y,local.z]);
          setArchitecturePreviewSize([Math.abs(at[across]-a[across]),Math.abs(at[2]-a[2])]);
        }else if(groupRef.current){const p=groupRef.current.worldToLocal(e.point.clone());setArchitectureHover([p.x,p.y,p.z]);}
        return;
      }
      if(!textureDrag.current)return;
      e.stopPropagation();e.nativeEvent.preventDefault();const drag=textureDrag.current;
      if(drag.mode==='offset')ed().updateTextureDrag(object.id,drag.face,(e.clientX-drag.x)*.75,-(e.clientY-drag.y)*.75);
      else ed().updateTextureTransform(object.id,drag.face,drag.mode,e.clientX-drag.x,e.clientY-drag.y);
    }} onPointerUp={e=>{
      if(architectureDrag.current){
        e.stopPropagation();
        const drag=architectureDrag.current;architectureDrag.current=null;
        const at=drag.current;const a=drag.start;
        const pts=transformedVertices(object);const sizes=[0,1].map(i=>Math.max(...pts.map(v=>v[i]))-Math.min(...pts.map(v=>v[i])));
        const across=sizes[0]<sizes[1]?1:0;
        const dx=Math.abs(at[across]-a[across]),dz=Math.abs(at[2]-a[2]);
        const drawn=dx>8&&dz>8;
        const center:Vec3=drawn?[(a[0]+at[0])/2,(a[1]+at[1])/2,(a[2]+at[2])/2]:a;
        const increment=Math.max(1,useEditor.getState().snapping?useEditor.getState().snap:1);
        const options=drawn?{...ed().architecturePlacement!.options,width:Math.max(8,Math.round(dx/increment)*increment),height:Math.max(8,Math.round(dz/increment)*increment)}:undefined;
        try{ed().placeArchitectureOnWall(object.id,center,options);setArchitectureHover(null);ed().setArchitectureHoverTarget(null)}
        catch(error){
          const message=error instanceof Error?error.message:String(error);
          useEditor.getState().appendLogs([`Architecture placement: ${message}`]);
          // Keep the tool active, but display a visible error to the user.
          window.dispatchEvent(new CustomEvent('svenstudio:architecture-error',{detail:message}));
        }
        setArchitecturePreviewSize(null);setOrbitEnabled(true);
        (e.target as {releasePointerCapture?:(id:number)=>void}|null)?.releasePointerCapture?.(e.pointerId);
        return;
      }
      if(!textureDrag.current)return;
      e.stopPropagation();textureDrag.current=null;
      (e.target as {releasePointerCapture?:(id:number)=>void}|null)?.releasePointerCapture?.(e.pointerId);
      ed().finishTextureDrag(true);
      setOrbitEnabled(!useEditor.getState().modalTransform&&!useEditor.getState().drawMode);
    }} onPointerOut={()=>{
      if(ed().architecturePlacement&&!architectureDrag.current){
        setArchitectureHover(null);setArchitecturePreviewSize(null);
        if(useEditor.getState().architectureHoverTarget===object.id)ed().setArchitectureHoverTarget(null);
      }
    }} onPointerCancel={e=>{
      if(architectureDrag.current){architectureDrag.current=null;setArchitecturePreviewSize(null);setOrbitEnabled(true);ed().setArchitectureHoverTarget(null);return;}
      if(!textureDrag.current)return;
      e.stopPropagation();textureDrag.current=null;ed().finishTextureDrag(false);
      setOrbitEnabled(!useEditor.getState().modalTransform&&!useEditor.getState().drawMode);
    }}/>
    {architectureActive&&hoverActive&&architectureHover&&eligibleWall&&(()=>{
      const architecturePlacement=ed().architecturePlacement;if(!architecturePlacement)return null;
      const p=object.vertices;const dx=Math.max(...p.map(v=>v[0]))-Math.min(...p.map(v=>v[0]));
      const dy=Math.max(...p.map(v=>v[1]))-Math.min(...p.map(v=>v[1]));
      const thinX=dx<dy;
      const w=(architecturePreviewSize?.[0]&&architecturePreviewSize[0]>8?architecturePreviewSize[0]:architecturePlacement.options.width)+(!architecturePlacement.options.cutOnly?architecturePlacement.options.frame*2:0);
      const h=(architecturePreviewSize?.[1]&&architecturePreviewSize[1]>8?architecturePreviewSize[1]:architecturePlacement.options.height)+(!architecturePlacement.options.cutOnly?architecturePlacement.options.frame:0);
      return <mesh position={architectureHover} raycast={()=>null} renderOrder={10}>
        <boxGeometry args={thinX?[2,h,w]:[w,h,2]}/>
        <meshBasicMaterial color="#63dcff" transparent opacity={.25} depthTest depthWrite={false}/>
      </mesh>;
    })()}
    {!walkMode&&associatedEntity&&appearance.markerMode==='automatic'&&(selected||['func_door','func_button','func_door_rotating','func_rot_button'].includes(associatedEntity.classname))&&<mesh
      geometry={entityMarkerGeometry[markerKindForEntity(associatedEntity.classname,appearance)]}
      position={[0,Math.max(8,...object.vertices.map(v=>v[2]))+11,0]} scale={appearance.markerSize*.6}
      renderOrder={appearance.markerOcclusion==='xray'?250:0}
      userData={{entityPickerId:associatedEntity.id}}
      onPointerDown={e=>{
        if(useArchitectureMode.getState().mode!=='off'||e.button!==0||object.locked||associatedEntity.locked||ed().drawMode||faceMode||ed().geometryMode!=='object'||ed().architecturePlacement||ed().placementShape||ed().audioPlacement||ed().environmentPlacement)return;
        if(pointerOnSelectedGizmo(e))return;
        e.stopPropagation();ed().selectObject(associatedEntity.id,e.shiftKey||e.ctrlKey||e.metaKey);
      }}>
      <meshBasicMaterial color={markerColorForEntity(associatedEntity.classname,appearance)} transparent
        opacity={selected?.80:.58} depthTest={appearance.markerOcclusion!=='xray'} depthWrite={false} wireframe/>
    </mesh>}
    {!optimizedLabels&&!walkMode&&showNames&&associatedEntity&&<EntityNameLabel classname={(() => {const name=entityDisplayName(associatedEntity,[associatedEntity,object]);return name===associatedEntity.classname?name:name+' · '+associatedEntity.classname})()} targetname={associatedEntity.props.targetname} position={[0,46,0]} selected={selected} color={markerColorForEntity(associatedEntity.classname,appearance)}/>}
    {!walkMode&&selected&&edges&&<lineSegments geometry={edges}><lineBasicMaterial color="#5db8fa" depthTest={false} transparent opacity={1}/></lineSegments>}
    {!walkMode&&faceMode&&faceKey&&faceKey.split(',').map(face=><FaceHighlight key={`${object.id}:${face}`} brush={object} face={Number(face)}/>)}
  </group>);
  // The selection gizmo is rendered once by SelectionTransformControls.
  // Separate gizmos on individual objects previously competed for pointer hits.
  return <>{node}{!walkMode&&editKind&&!object.locked&&<GeometryEditHandles brush={object} kind={editKind}/>}</>;
}
/** Direct 3D handles for Svengine convex brush vertices and edges.
 * Transform only the chosen local vertices, reconstructing convex supporting
 * planes before committing to the map. Any illegal edit is rejected. */
function GeometryEditHandles({brush,kind}:{brush:Brush;kind:'vertex'|'edge'|'face'}){
  const indices=useEditor(s=>s.editIndices);
  const editEdgePairs=useEditor(s=>s.editEdgePairs);
  const selectedFace=useEditor(s=>s.selectedFace);
  const selectIndices=useEditor(s=>s.selectEditIndices);
  const change=useEditor(s=>s.editVertices);
  const snap=useEditor(s=>s.snap),snapping=useEditor(s=>s.snapping);
  const controlsConfig=useEditor(s=>s.controls);
  const points=useMemo(()=>transformedVertices(brush).map(gameToThree),[brush]);
  const handles=useMemo(()=>kind==='vertex'?points.map((p,i)=>({id:`v${i}`,position:p,indices:[i]})):
    kind==='edge'?uniqueBrushEdges(brush).map(([a,b],i)=>({id:`e${i}`,position:points[a].clone().add(points[b]).multiplyScalar(.5),indices:[a,b]})):[],[points,brush,kind]);
  const activeIndices=kind==='face'?(selectedFace!==null?brush.faces[selectedFace]?.indices??[]:[]):indices;
  const origin=useMemo(()=>{
    // Use the centroid of ALL selected sub-elements instead of only a single
    // edge. Shift/Ctrl multi-selection must never lose its transform handle.
    const position=geometrySelectionCentroid(points.map(p=>[p.x,p.y,p.z] as Vec3),activeIndices);
    return position?new THREE.Vector3(...position):null;
  },[points,activeIndices.join(',')]);
  const pivot=useRef<THREE.Group>(null!);
  const editGizmo=useRef<TransformControlsImpl>(null!);
  const {camera,gl}=useThree();
  const start=useRef<THREE.Vector3|null>(null);
  useEffect(()=>{if(origin&&pivot.current&&!start.current)pivot.current.position.copy(origin)},[origin]);
  useEffect(()=>{if(editGizmo.current)expandPicker(editGizmo.current)},[origin,controlsConfig.gizmoSize]);
  // The native (invisible) sub-object gizmo picker has priority over the
  // brush mesh. Otherwise grabbing a handle can clear the geometry selection.
  useEffect(()=>{
    if(!origin)return;
    const hit=(x:number,y:number)=>hitTransformPicker(editGizmo.current,camera,gl.domElement.getBoundingClientRect(),x,y);
    selectedGizmoPointerHit=hit;
    return()=>{if(selectedGizmoPointerHit===hit)selectedGizmoPointerHit=null};
  },[origin,camera,gl]);
  // World-space gizmo movement -> local brush delta (respects rotation and nonuniform scale).
  const localDelta=():Vec3|null=>{
    if(!pivot.current||!start.current)return null;
    const delta=sanitizeGeometryDelta(threeToGame(pivot.current.position.clone().sub(start.current)),snapping?snap:0);
    const euler=new THREE.Euler(...brush.rotation.map(THREE.MathUtils.degToRad) as Vec3,'XYZ');
    const local=new THREE.Vector3(...delta).applyQuaternion(new THREE.Quaternion().setFromEuler(euler).invert());
    if(brush.scale.some(v=>!Number.isFinite(v)||Math.abs(v)<.000001))throw Error('Invalid brush scale.');
    return sanitizeGeometryDelta([local.x/brush.scale[0],local.y/brush.scale[1],local.z/brush.scale[2]]);
  };
  // Live check while dragging: green outline = valid convex brush, red = the release would be rejected.
  const [preview,setPreview]=useState<{edges:THREE.Vector3[][];error?:string}|null>(null);
  const [notice,setNotice]=useState<string|null>(null);
  const t=useT();
  useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(null),4500);return()=>window.clearTimeout(timer);},[notice]);
  const updatePreview=()=>{
    if(!start.current||!activeIndices.length)return;
    try{
      const d=localDelta();
      if(!d||d.every(v=>Math.abs(v)<.00001)){setPreview(null);return;}
      const candidate=editBrushVertices(brush,activeIndices,d);
      const world=transformedVertices(candidate).map(gameToThree);
      setPreview({edges:uniqueBrushEdges(candidate).map(([a,b])=>[world[a],world[b]])});
    }catch(error){setPreview(previous=>({edges:previous?.edges??[],error:String(error instanceof Error?error.message:error)}));}
  };
  const commit=()=>{
    setPreview(null);
    if(!pivot.current||!origin||!activeIndices.length||!start.current)return;
    try{
      const d=localDelta();
      start.current=null;
      pivot.current.position.copy(origin);
      if(!d||d.every(v=>Math.abs(v)<.00001))return;
      change(brush.id,activeIndices,d);
    }catch(error){
      start.current=null;
      pivot.current?.position.copy(origin);
      const message=String(error instanceof Error?error.message:error);
      useEditor.getState().appendLogs([`${useEditor.getState().settings.gameProfile==='cs16'?'GoldSrc':'Svengine'} modeling: ${message}`]);
      // Non-blocking: the brush stays as it was and the reason is shown next to the handle.
      setNotice(message);
    }
  };
  return <>
    {handles.map(h=>{
      const active=kind==='edge'?editEdgePairs.some(pair=>pair[0]===Math.min(...h.indices)&&pair[1]===Math.max(...h.indices)):
        h.indices.every(i=>activeIndices.includes(i));
      return <mesh key={h.id} position={h.position} renderOrder={20}
        onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();e.nativeEvent.preventDefault();selectIndices(h.indices,e.shiftKey||e.ctrlKey||e.metaKey)}}>
        {kind==='edge'?<boxGeometry args={[10,10,10]}/>:<sphereGeometry args={[7,10,8]}/>}
        <meshBasicMaterial color={active?'#ffd46c':kind==='edge'?'#a6dbff':'#ff9b6c'} depthTest={false}/>
      </mesh>;
    })}
    {kind==='face'&&origin&&<mesh position={origin} renderOrder={21} raycast={()=>null}>
      <octahedronGeometry args={[7]}/><meshBasicMaterial color="#ffd46c" depthTest={false}/>
    </mesh>}
    {origin&&<>
      <group ref={pivot} position={origin}/>
      <TransformControls ref={editGizmo} object={pivot} mode="translate" size={Math.max(0.15,controlsConfig.gizmoSize)}
        translationSnap={undefined}
        onMouseDown={()=>{start.current=pivot.current?.position.clone()||null;setNotice(null)}}
        onObjectChange={updatePreview}
        onMouseUp={commit}/>
    </>}
    {preview&&preview.edges.map((seg,i)=><Line key={i} points={seg} color={preview.error?'#ff6470':'#7dffa8'} lineWidth={2} depthTest={false} depthWrite={false} raycast={()=>null}/>)}
    {(preview?.error||notice)&&origin&&<Html position={origin} className="geometry-edit-notice" pointerEvents="none" zIndexRange={[30,0]}>{t(preview?.error||notice||'')}</Html>}
  </>;
}
function FaceHighlight({brush,face}:{brush:Brush,face:number}){
  const g=useMemo(()=>{
    const f=brush.faces[face];if(!f)return null;
    const points=f.indices.map(i=>gameToThree(brush.vertices[i]));
    const geometry=new THREE.BufferGeometry(),coords:number[]=[];
    points.forEach(p=>coords.push(p.x,p.y,p.z));
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(coords,3));return geometry;
  },[brush,face]);
  useEffect(()=>()=>g?.dispose(),[g]);
  return g?<lineLoop geometry={g}><lineBasicMaterial color="#f8c96c" depthTest={false}/></lineLoop>:null;
}
/** Optional real studio geometry, while the entity marker remains selectable.
 * Unsupported model variants leave the original marker visible, without
 * manufacturing false game keyvalues or pretending to animate NPCs. */
function SpawnFallbackFigure({floorRelative}:{floorRelative:number}){
  const ref=useRef<THREE.Group>(null);
  useFrame(({clock})=>{if(ref.current)ref.current.scale.y=1+Math.sin(clock.elapsedTime*1.7)*.005});
  return <group ref={ref} position={[0,floorRelative,0]} raycast={()=>null}>
    <mesh position={[0,53,0]}><capsuleGeometry args={[9,22,5,9]}/><meshStandardMaterial color="#d4a76e"/></mesh>
    <mesh position={[0,79,0]}><sphereGeometry args={[10,12,9]}/><meshStandardMaterial color="#e0c29a"/></mesh>
    {[-1,1].map(side=><group key={side}>
      <mesh position={[side*8,20,0]}><capsuleGeometry args={[4,30,5,9]}/><meshStandardMaterial color="#546d83"/></mesh>
      <mesh position={[side*15,51,0]} rotation={[0,0,side*.1]}><capsuleGeometry args={[4,24,5,9]}/><meshStandardMaterial color="#8198a9"/></mesh>
    </group>)}
  </group>;
}
function EntityStudioPreview({modelPath,gameDir,skin=0,body=0,animate=false,spawnFloorOffset,animationSpeed=1}:{modelPath:string;gameDir:string;skin?:number;body?:number;animate?:boolean;spawnFloorOffset?:number;animationSpeed?:number}){
  const [data,setData]=useState<StudioPreview|null>(null);
  useEffect(()=>{
    let active=true;setData(null);
    if(!gameDir||!/^models\/[\w ./\-]+\.mdl$/i.test(modelPath)||modelPath.includes('..'))return;
    loadModelByPath(gameDir,modelPath).then(result=>{if(active)setData(result)}).catch(()=>{});
    return()=>{active=false};
  },[gameDir,modelPath]);
  const bottom=useMemo(()=>data?spawnModelFootHeight(data,body):0,[data,body]);
  if(!data&&spawnFloorOffset!==undefined)return <SpawnFallbackFigure floorRelative={spawnFloorOffset}/>;
  if(!data&&animate)return <mesh position={[0,30,0]} raycast={()=>null}>
    <capsuleGeometry args={[12,36,6,10]}/>
    <meshStandardMaterial color="#7095b5" transparent opacity={.42} wireframe/>
  </mesh>;
  if(!data)return null;
  return <group position={[0,spawnFloorOffset===undefined?0:spawnFloorOffset-bottom,0]}><StudioModel data={data} skin={skin} body={body} animate={animate} animationSpeed={animationSpeed}/></group>;
}
/** Three.js/GoldSrc light directions are in different coordinate systems.
 * The target is parented to the same entity group as the light; otherwise a
 * SpotLight can accidentally aim at the scene origin instead of its own cone.
 */
function SpotLightPreview({entity,tint,brightness,selected,shadows=false}:{entity:PointEntity;tint:string;brightness:number;selected:boolean;shadows?:boolean}){
 const yaw=entity.props.angles?.trim().split(/\s+/)[1]||'0';
 const dir=previewDirection(entity.props.pitch,yaw);
 const settings=previewLocalLight(brightness,'spot');
 const cone=previewCone(entity.props._cone,entity.props._cone2);
 const target=useMemo(()=>{const o=new THREE.Object3D();o.position.set(dir[0]*400,dir[1]*400,dir[2]*400);return o},[dir[0],dir[1],dir[2]]);
 const direction=useMemo(()=>new THREE.Vector3(...dir),[dir[0],dir[1],dir[2]]);
 const guideRotation=useMemo(()=>new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,-1,0),direction),[direction]);
 return <>
  <primitive object={target}/>
  <spotLight color={tint} intensity={settings.intensity} angle={cone.angle} distance={settings.distance} decay={settings.decay} penumbra={cone.penumbra}
    target={target} castShadow={shadows} shadow-mapSize={[512,512]} shadow-bias={-.0003}/>
  {selected&&<mesh position={[dir[0]*110,dir[1]*110,dir[2]*110]} quaternion={guideRotation}>
    <coneGeometry args={[Math.tan(cone.angle)*220,220,24,1,true]}/>
    <meshBasicMaterial color={tint} wireframe transparent opacity={.36} side={THREE.DoubleSide} depthWrite={false}/>
  </mesh>}
 </>;
}
/** light_environment uses sky direction and diffuse color but is not an
 * occlusion-aware SC-RAD sun. Shadows remain optional for editor performance.
 */
function SunLightPreview({entity,tint,brightness,shadows=false}:{entity:PointEntity;tint:string;brightness:number;shadows?:boolean}){
 const yaw=entity.props.angles?.trim().split(/\s+/)[1]||'0';
 const dir=previewDirection(entity.props.pitch,yaw);
 const diffuse=parseLight(entity.props._diffuse_light);
 const strength=previewSunLight(brightness,diffuse.brightness);
 const target=useMemo(()=>new THREE.Object3D(),[]);
 return <>
   <primitive object={target}/>
   <directionalLight color={tint} intensity={strength.intensity} position={[-dir[0]*1100,-dir[1]*1100,-dir[2]*1100]} target={target}
     castShadow={shadows} shadow-mapSize={[1024,1024]} shadow-camera-left={-1600} shadow-camera-right={1600} shadow-camera-top={1600} shadow-camera-bottom={-1600}/>
   <hemisphereLight args={[rgbHex(diffuse.rgb),'#303a49',strength.diffuseIntensity]}/>
 </>;
}
const decalPreviewTextures=new Map<string,THREE.Texture>();
/** Native infodecal preview uses an editor-only normal. The MAP output still
 * contains ONLY classname, origin and texture keyvalues. */
function DecalVisual({object}:{object:PointEntity}){
  const assets=useEditor(s=>s.decalAssets),selected=useEditor(s=>isObjectSelected(s.selectedIds,object.id));
  const select=useEditor(s=>s.selectObject),walking=useEditor(s=>s.walkMode);
  const brush=useEditor(s=>s.project.objects.find(b=>b.id===object.decalBrushId));
  const move=useEditor(s=>s.moveDecalOnSurface);
  const [preview,setPreview]=useState<Vec3|null>(null);
  const drag=useRef<{pointerId:number;plane:THREE.Plane;offset:THREE.Vector3;latest:Vec3|null;changed:boolean}|null>(null);
  const asset=useMemo(()=>assets.find(a=>a.name.toLowerCase()===(object.props.texture||'').toLowerCase()),[assets,object.props.texture]);
  const normal=object.decalNormal||[0,0,1];
  const direction=useMemo(()=>gameToThree(normal).normalize(),[normal[0],normal[1],normal[2]]);
  const quaternion=useMemo(()=>new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),direction),[direction]);
  const dimensions:[number,number]=[Math.min(512,asset?.width||24),Math.min(512,asset?.height||24)];
  const texture=useMemo(()=>{
    if(!asset)return null;
    const key=`${asset.wad}:${asset.name}:${asset.sourceId||'decals'}`;
    const existing=decalPreviewTextures.get(key);if(existing)return existing;
    const tex=new THREE.TextureLoader().load(asset.dataUrl);tex.colorSpace=THREE.SRGBColorSpace;
    tex.magFilter=THREE.NearestFilter;tex.minFilter=THREE.LinearFilter;
    decalPreviewTextures.set(key,tex);return tex;
  },[asset]);
  if(object.hidden)return null;
  const movable=!walking&&!object.locked&&brush?.kind==='brush'&&!brush.hidden&&!brush.locked&&!!object.decalNormal;
  const begin=(e:import('@react-three/fiber').ThreeEvent<PointerEvent>)=>{
    if(walking||e.button!==0)return;
    e.stopPropagation();e.nativeEvent.preventDefault();
    select(object.id,e.shiftKey||e.ctrlKey||e.metaKey);
    if(!movable||e.shiftKey||e.ctrlKey||e.metaKey)return;
    const origin=gameToThree(object.position),plane=new THREE.Plane().setFromNormalAndCoplanarPoint(direction,origin);
    const hit=e.ray.intersectPlane(plane,new THREE.Vector3());if(!hit)return;
    drag.current={pointerId:e.pointerId,plane,offset:origin.sub(hit),latest:null,changed:false};
    (e.target as unknown as Element)?.setPointerCapture?.(e.pointerId);
  };
  const during=(e:import('@react-three/fiber').ThreeEvent<PointerEvent>)=>{
    const d=drag.current;if(!d||d.pointerId!==e.pointerId||brush?.kind!=='brush'||!object.decalNormal)return;
    e.stopPropagation();
    const hit=e.ray.intersectPlane(d.plane,new THREE.Vector3());if(!hit)return;
    const desired=threeToGame(hit.add(d.offset));
    const next=constrainDecalToBrush(brush,object.decalNormal,object.position,desired);
    if(!next)return;
    d.latest=next;d.changed=next.some((v,i)=>Math.abs(v-object.position[i])>.005);
    setPreview(next);
  };
  const finish=(e:import('@react-three/fiber').ThreeEvent<PointerEvent>,cancel=false)=>{
    const d=drag.current;if(!d||d.pointerId!==e.pointerId)return;
    e.stopPropagation();drag.current=null;
    if(!cancel&&d.changed&&d.latest)move(object.id,d.latest);
    setPreview(null);
    (e.target as unknown as Element)?.releasePointerCapture?.(e.pointerId);
  };
  const handlers={onPointerDown:begin,onPointerMove:during,onPointerUp:(e:import('@react-three/fiber').ThreeEvent<PointerEvent>)=>finish(e),onPointerCancel:(e:import('@react-three/fiber').ThreeEvent<PointerEvent>)=>finish(e,true)};
  return <group position={gameToThree(preview||object.position)} quaternion={quaternion}>
    {asset?<mesh position={[0,0,0.6]} renderOrder={4} {...handlers}>
      <planeGeometry args={dimensions}/><meshBasicMaterial map={texture} transparent opacity={1} alphaTest={.01} side={THREE.DoubleSide} depthWrite={false} polygonOffset polygonOffsetFactor={-3}/>
    </mesh>:!walking&&<mesh {...handlers}>
      <circleGeometry args={[9,20]}/><meshBasicMaterial color="#ffb548" transparent opacity={.8} depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>}
    {!walking&&selected&&<mesh position={[0,0,1]} raycast={()=>null}><ringGeometry args={[Math.max(dimensions[0],dimensions[1])*.48,Math.max(dimensions[0],dimensions[1])*.51,32]}/><meshBasicMaterial color="#53f0b9" side={THREE.DoubleSide} transparent opacity={.9} depthWrite={false}/></mesh>}
  </group>;
}

function EntityVisual({object,routeText,routeTint,hideLabel=false,activeLight=true,activeModel=true,showMarker=true,optimizedLabels=false,spawnGround}:{object:PointEntity;routeText?:string;routeTint?:string;hideLabel?:boolean;activeLight?:boolean;activeModel?:boolean;showMarker?:boolean;optimizedLabels?:boolean;spawnGround?:number}){
  const showNames=useEditor(s=>s.showEntityNames);
  const walking=useEditor(s=>s.walkMode);
  const {walk}=useContext(PreviewContext);
  const gameDir=useEditor(s=>s.settings.gameDir);
  const fgdClasses=useEditor(s=>s.fgdClasses);
  const fgdStudio=useMemo(()=>fgdClasses.find(c=>c.name===object.classname)?.studio,[fgdClasses,object.classname]);
  const modelPath=object.props.model?.startsWith('models/')?object.props.model:fgdStudio|| (object.classname==='info_player_start'?'models/player/gordon/gordon.mdl':undefined);
  const appearance=useEditor(s=>s.entityAppearance);
  const placementShape=useEditor(s=>s.placementShape);
  const audioPlacement=useEditor(s=>s.audioPlacement);
  const modal=useEditor(s=>s.modalTransform);
  const environmentPlacement=useEditor(s=>s.environmentPlacement);
  const editorLighting=useEditor(s=>s.environmentPreview);
  const environmentPreview=walking?walk.rendered:editorLighting;
  const shadows=useEditor(s=>s.previewShadows&&s.environmentPreview);
  const ranges=useEditor(s=>s.showLightRanges&&s.environmentPreview);
  const selected=useEditor(s=>isObjectSelected(s.selectedIds,object.id));
  const multiCount=useEditor(s=>s.selectedIds.length);
  const selectObject=useEditor(s=>s.selectObject);
  const drawMode=useEditor(s=>s.drawMode);
  const groupRef=useRef<THREE.Group>(null!);
  useVisualGroup(object.id,!!object.hidden,groupRef);
  // v2.4: unselected entities keep a fixed matrix (the gizmo only moves selected ones).
  useLayoutEffect(()=>{groupRef.current?.updateMatrix();});
  const markerRef=useRef<THREE.Group>(null);
  const modelRef=useRef<THREE.Group>(null);
  const [px,py,pz]=object.position;
  useEffect(()=>{const g=markerRef.current;if(!g)return;entityMarkerGroups.set(object.id,{group:g,position:[px,py,pz]});return()=>{entityMarkerGroups.delete(object.id)};},[object.id,px,py,pz,object.hidden,showMarker]);
  useEffect(()=>{const g=modelRef.current;if(!g)return;entityModelGroups.set(object.id,{group:g,position:[px,py,pz]});return()=>{entityModelGroups.delete(object.id)};},[object.id,px,py,pz,object.hidden]);
  if(object.hidden)return null;
  const isAudio=['ambient_generic','ambient_music','env_sound'].includes(object.classname);
  const isLight=object.classname.startsWith('light');
  const isSpawn=object.classname==='info_player_start';
  const groundOffset=isSpawn?(spawnGround??object.position[2]-36)-object.position[2]:0;
  const yaw=spawnYaw(object.props);
  const parsedLight=parseLight(object.props._light);
  const lightTint=rgbHex(parsedLight.rgb);
  const localLight=previewLocalLight(parsedLight.brightness);
  const color=appearance.colorMode==='uniform'?appearance.uniformColor:(routeTint||markerColorForEntity(object.classname,appearance));
  const content=<group ref={groupRef} position={gameToThree(object.position)} userData={{entityId:object.id}} matrixAutoUpdate={selected||walking}>
    <group ref={markerRef}>
    {showMarker&&<mesh position={isSpawn?[0,groundOffset+4,0]:undefined} geometry={entityMarkerGeometry[markerKindForEntity(object.classname,appearance)]}
      material={markerMaterial(color,selected,appearance.markerOcclusion==='xray')}
      userData={{entityId:object.id,entityPickerId:object.id}} renderOrder={appearance.markerOcclusion==='xray'?250:0}
      scale={isSpawn?appearance.markerSize*.55:appearance.markerSize}
      onPointerDown={e=>{if(e.button!==0||drawMode||placementShape||audioPlacement||environmentPlacement||useEditor.getState().architecturePlacement)return;if(pointerOnSelectedGizmo(e))return;e.stopPropagation();if(!object.locked){
        if(selected&&multiCount>1&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey)return;
        selectObject(object.id,e.shiftKey||e.ctrlKey||e.metaKey);
      }}}/>}

    {showMarker&&isSpawn&&<group position={[0,groundOffset+.5,0]} rotation={[0,THREE.MathUtils.degToRad(yaw),0]} raycast={()=>null}>
      <mesh rotation={[-Math.PI/2,0,0]}><torusGeometry args={[16,1.3,6,30]}/><meshBasicMaterial color={selected?'#c4ff7b':'#4bedad'} transparent opacity={.8}/></mesh>
      <mesh position={[21,0,0]} rotation={[0,0,-Math.PI/2]}><coneGeometry args={[5,12,9]}/><meshBasicMaterial color="#a5ffda"/></mesh>
    </group>}
    {showMarker&&isAudio&&<group scale={appearance.markerSize}><mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[12,2.7,8,24]}/><meshBasicMaterial color={selected?'#fff0aa':'#67dfee'} toneMapped={false} depthTest={appearance.markerOcclusion!=='xray'} depthWrite={false}/></mesh><mesh><sphereGeometry args={[6,8,8]}/><meshBasicMaterial color="#7ee6e8" depthTest={appearance.markerOcclusion!=='xray'} depthWrite={false}/></mesh></group>}
    </group>
    <group ref={modelRef}>
    {(showMarker||walking&&walk.showModels)&&activeModel&&modelPath&&!isLight&&!(walking&&isSpawn)&&<group onPointerDown={e=>{if(e.button!==0||object.locked||drawMode||placementShape||audioPlacement||useEditor.getState().architecturePlacement)return;if(pointerOnSelectedGizmo(e))return;e.stopPropagation();selectObject(object.id,e.shiftKey||e.ctrlKey||e.metaKey)}} rotation={[0,THREE.MathUtils.degToRad(isSpawn?yaw:Number(object.props.angles?.split(' ')[1])||0),0]}><EntityStudioPreview modelPath={modelPath} gameDir={gameDir} skin={Number(object.props.skin)||0} body={Number(object.props.body)||0} animate={isSpawn||walking&&object.classname.startsWith('monster_')} animationSpeed={isSpawn?1.4:1} spawnFloorOffset={isSpawn?groundOffset:undefined}/></group>}
    </group>
    {walking&&walk.showModels&&object.classname.startsWith('monster_')&&(!modelPath||!gameDir)&&<mesh position={[0,30,0]} raycast={()=>null}>
      <capsuleGeometry args={[12,36,6,10]}/><meshStandardMaterial color="#7095b5" transparent opacity={.42} wireframe/>
    </mesh>}
    {showMarker&&selected&&!isSpawn&&<mesh scale={appearance.markerSize} raycast={()=>null} renderOrder={appearance.markerOcclusion==='xray'?251:0}><sphereGeometry args={[11,12,8]}/><meshBasicMaterial color="#65befa" wireframe transparent opacity={.35} depthTest={appearance.markerOcclusion!=='xray'} depthWrite={false}/></mesh>}
    {isLight&&showMarker&&object.classname==='light'&&ranges&&<mesh raycast={()=>null} scale={Math.min(2500,Math.max(280,parsedLight.brightness*2.2))}><sphereGeometry args={[1,16,12]}/><meshBasicMaterial color={lightTint} transparent wireframe opacity={.13} depthWrite={false} depthTest={false}/></mesh>}
    {isLight&&activeLight&&object.classname==='light'&&environmentPreview&&<pointLight color={lightTint} intensity={localLight.intensity} distance={localLight.distance} decay={localLight.decay} castShadow={shadows&&selected} shadow-mapSize={[512,512]} shadow-bias={-.0003}/>}
    {isLight&&activeLight&&object.classname==='light_spot'&&environmentPreview&&<SpotLightPreview entity={object} tint={lightTint} brightness={parsedLight.brightness} selected={selected&&showMarker} shadows={shadows&&selected}/>}
    {isLight&&activeLight&&object.classname==='light_environment'&&environmentPreview&&<SunLightPreview entity={object} tint={lightTint} brightness={parsedLight.brightness} shadows={shadows&&selected}/>}
    {isLight&&showMarker&&selected&&<mesh><sphereGeometry args={[Math.min(220,Math.max(48,parsedLight.brightness*.28)),24,12]}/><meshBasicMaterial color={lightTint} wireframe transparent opacity={.16} depthWrite={false}/></mesh>}
  </group>;
  // Render the label at an independent WORLD anchor rather than as a child
  // of the transformed marker. This also fixes the missing player-spawn name.
  const showLabel=showMarker&&(showNames||isSpawn&&appearance.alwaysShowSpawn)&&(!hideLabel||selected);
  const worldLabel=gameToThree([object.position[0],object.position[1],object.position[2]+(isSpawn?64:45)]);
  return <>{content}{!optimizedLabels&&showLabel&&<EntityNameLabel classname={routeText||(object.name&&object.name!==object.classname?object.name+' · '+object.classname:object.classname)} targetname={object.props.targetname}
    position={[worldLabel.x,worldLabel.y,worldLabel.z]} selected={selected} color={color} isSpawn={isSpawn}/>}</>;
}
/** Blender navigation: MMB orbit, Shift+MMB pan, Ctrl+MMB dolly.
 * Classic navigation remains available as an alternative. Camera shortcuts
 * (numpad views, orthographic toggle, frame selection) are real camera moves. */
function CameraController(){
  const preview=useContext(PreviewContext);
  const walkSettingsRef=useRef(preview.walk);walkSettingsRef.current=preview.walk;
  const reportRef=useRef(preview.reportWalk);reportRef.current=preview.reportWalk;
  const lastWalkReport=useRef(0);
  const lastGameplayMessage=useRef('');
  const controls=useRef<OrbitControlsImpl>(null);
  const keys=useRef<Set<string>>(new Set());
  // Roblox Studio style: RMB held to look, release RMB to recover the cursor.
  // This is independent of Gameplay Test and Fly pointer lock.
  const rightMouseLook=useRef(false);

  const {camera,set,size,gl,scene:getThreeScene}=useThree();
  const initialPerspective=useRef(camera as THREE.PerspectiveCamera);
  const ortho=useMemo(()=>new THREE.OrthographicCamera(-600,600,450,-450,.5,280000),[]);
  const lastTarget=useRef(new THREE.Vector3(0,100,0));
  const command=useEditor(s=>s.cameraCommand),controlsConfig=useEditor(s=>s.controls);
  const doctorFocus=useMapDoctorState(s=>s.focus),doctorFocusSerial=useMapDoctorState(s=>s.focusSerial);
  const followId=useBuildTogether(s=>s.followId),followPose=useBuildTogether(s=>s.cameras[s.followId||'']||null);
  useEffect(()=>{
    const toggle=(enabled:boolean)=>{if(controls.current)controls.current.enabled=enabled};
    faceScaleOrbitToggle=toggle;
    return()=>{if(faceScaleOrbitToggle===toggle)faceScaleOrbitToggle=null};
  },[]);
  const modal=useEditor(s=>s.modalTransform);
  const uvDragging=useEditor(s=>s.textureDragSnapshot!==null);
  const setCameraLabel=useEditor(s=>s.setCameraLabel);
  const flyMode=useEditor(s=>s.flyMode),walkMode=useEditor(s=>s.walkMode),drawMode=useEditor(s=>s.drawMode);
  const architectureDrawing=useArchitectureMode(s=>s.mode!=='off');
  const mapObjects=useEditor(s=>s.project.objects);
  const walkColliders=useMemo(()=>{
    const classById=new Map(mapObjects.filter((o):o is PointEntity=>o.kind==='entity').map(e=>[e.id,e.classname]));
    const result:Array<WalkCollider&{entityId?:string}>=[];
    for(const object of mapObjects){
      if(object.kind!=='brush')continue;
      const classname=classById.get(object.entityId||'')||'';
      if(classname==='func_illusionary'||classname==='func_water'||classname.startsWith('trigger_'))continue;
      const collider=walkCollider(transformedVertices(object).map(v=>[v[0],v[2],-v[1]] as [number,number,number]));
      if(collider)result.push({...collider,entityId:object.entityId});
    }
    return result;
  },[mapObjects]);
  const walkPose=useRef<WalkPose|null>(null);
  const walkLook=useRef({yaw:0,pitch:0});
  const walkSnapshot=useRef<{camera:THREE.PerspectiveCamera|THREE.OrthographicCamera;position:THREE.Vector3;quaternion:THREE.Quaternion;up:THREE.Vector3;target:THREE.Vector3;label:string}|null>(null);
  const previousJump=useRef(false);
  const walkDirection=()=>new THREE.Vector3(Math.sin(walkLook.current.yaw)*Math.cos(walkLook.current.pitch),Math.sin(walkLook.current.pitch),-Math.cos(walkLook.current.yaw)*Math.cos(walkLook.current.pitch));
  // Switching to BSP Viewer or closing the MAP editor must release walk mode.
  useEffect(()=>()=>{
    if(useEditor.getState().walkMode)useEditor.getState().setWalk(false);
    if(document.pointerLockElement===gl.domElement)document.exitPointerLock?.();
  },[gl]);

  const lastCommand=useRef(0);
  const cameraSaveTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const blender=controlsConfig.cameraPreset==='blender';
  // Restore the last camera pose before the user starts navigating. Layout and
  // project restoration happen separately before React is mounted.
  useEffect(()=>{
    const saved=readSavedCamera();
    if(!saved||!controls.current)return;
    const dest=saved.projection==='orthographic'?ortho:initialPerspective.current;
    dest.position.set(...saved.position);dest.up.set(...saved.up);
    const perspective=initialPerspective.current;
    perspective.fov=saved.perspectiveFov;perspective.updateProjectionMatrix();
    const aspect=Math.max(.1,size.width/Math.max(1,size.height));
    ortho.top=saved.orthoHeight/2;ortho.bottom=-saved.orthoHeight/2;
    ortho.left=-saved.orthoHeight*aspect/2;ortho.right=saved.orthoHeight*aspect/2;
    ortho.updateProjectionMatrix();
    lastTarget.current.set(...saved.target);
    controls.current.target.copy(lastTarget.current);
    dest.lookAt(lastTarget.current);
    if(camera!==dest)set({camera:dest});else controls.current.update();
    setCameraLabel(saved.projection==='orthographic'?'Orthographic':'Perspective');
    // Deliberately once per mount: navigation shouldn't re-apply old positions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  // Walk is an isolated camera session. Restore the editor view exactly on exit,
  // including an orthographic view if it was active before walking.
  useEffect(()=>{
    const orbit=controls.current;
    if(!orbit)return;
    if(walkMode&&!walkSnapshot.current){
      walkSnapshot.current={camera:camera as THREE.PerspectiveCamera|THREE.OrthographicCamera,position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone(),target:orbit.target.clone(),label:useEditor.getState().cameraLabel};
      const spawn=mapObjects.find((o):o is PointEntity=>o.kind==='entity'&&['info_player_start','info_player_deathmatch','info_player_coop'].includes(o.classname));
      const start=walkSettingsRef.current.spawn==='camera'?camera.position.clone().add(new THREE.Vector3(0,-WALK.standEye,0)):spawn?gameToThree(spawn.position):new THREE.Vector3(0,96,0);
      walkPose.current=chooseWalkStart([start.x,start.y,start.z],walkColliders);
      const angles=spawn?.props.angles?.trim().split(/\s+/).map(Number)||[];
      const entityYaw=Number.isFinite(angles[1])?angles[1]:0;
      walkLook.current={yaw:Math.PI/2-THREE.MathUtils.degToRad(entityYaw),pitch:0};
      previousJump.current=false;
      lastGameplayMessage.current='';
      preview.gameplaySession.current=new GameplaySession(mapObjects);
      preview.reportGameplay('');
      keys.current.clear();
      const perspective=initialPerspective.current;
      perspective.up.set(0,1,0);
      perspective.position.set(walkPose.current.position[0],walkPose.current.position[1]+WALK.standEye,walkPose.current.position[2]);
      perspective.lookAt(perspective.position.clone().add(walkDirection()));
      if(camera!==perspective)set({camera:perspective});
      orbit.enabled=false;
      setCameraLabel('Gameplay Test');
    }else if(!walkMode&&walkSnapshot.current){
      const snapshot=walkSnapshot.current;walkSnapshot.current=null;
      const restored=snapshot.camera;
      restored.position.copy(snapshot.position);restored.quaternion.copy(snapshot.quaternion);restored.up.copy(snapshot.up);
      orbit.target.copy(snapshot.target);lastTarget.current.copy(snapshot.target);
      if(camera!==restored)set({camera:restored});
      orbit.enabled=true;orbit.update();
      setCameraLabel(snapshot.label);
      walkPose.current=null;keys.current.clear();previousJump.current=false;
      preview.gameplaySession.current=null;preview.reportGameplay('');
    }
  },[walkMode,camera,mapObjects,walkColliders,set,setCameraLabel]);
  // Follow camera uses independent screen-space poses; it never modifies brushes.
  useEffect(()=>{
    if(!followId||!followPose||walkMode||!controls.current)return;
    const dest=followPose.projection==='orthographic'?ortho:initialPerspective.current;
    dest.up.set(...followPose.up);
    if(dest===ortho){const h=followPose.orthoHeight,a=Math.max(.1,size.width/Math.max(1,size.height));ortho.top=h/2;ortho.bottom=-h/2;ortho.left=-h*a/2;ortho.right=h*a/2;ortho.updateProjectionMatrix();}
    dest.position.set(...followPose.position);
    controls.current.target.set(...followPose.target);lastTarget.current.set(...followPose.target);
    dest.lookAt(controls.current.target);
    if(camera!==dest)set({camera:dest});else controls.current.update();
  },[followId,followPose,walkMode,camera,ortho,set,size.width,size.height]);
  const buildTogetherOnline=useBuildTogether(s=>s.status==='online');
  const saveCamera=()=>{
    if(useEditor.getState().walkMode)return;
    if(!useBuildTogether.getState().followId&&controls.current){
      sendBuildTogetherCamera({projection:camera===ortho?'orthographic':'perspective',
        position:camera.position.toArray() as [number,number,number],
        target:controls.current.target.toArray() as [number,number,number],
        up:camera.up.toArray() as [number,number,number],orthoHeight:ortho.top-ortho.bottom,
        fov:initialPerspective.current.fov,aspect:Math.max(.2,size.width/Math.max(1,size.height))});
    }
    if(cameraSaveTimer.current!==null)clearTimeout(cameraSaveTimer.current);
    cameraSaveTimer.current=setTimeout(()=>{
      if(useEditor.getState().walkMode){cameraSaveTimer.current=null;return;}
      const orbit=controls.current;
      if(!orbit)return;
      writeSavedCamera({version:1,projection:camera===ortho?'orthographic':'perspective',
        position:camera.position.toArray() as [number,number,number],
        target:orbit.target.toArray() as [number,number,number],
        up:camera.up.toArray() as [number,number,number],
        orthoHeight:ortho.top-ortho.bottom,
        perspectiveFov:initialPerspective.current.fov});
      cameraSaveTimer.current=null;
    },500);
  };
  // Send the initial camera as soon as a collaborator joins, even when idle.
  useEffect(()=>{if(buildTogetherOnline&&!walkMode&&!followId)saveCamera();},[buildTogetherOnline,walkMode,followId]);
  useEffect(()=>{
    const onHide=()=>{
      if(useEditor.getState().walkMode)return;
      if(cameraSaveTimer.current!==null){clearTimeout(cameraSaveTimer.current);cameraSaveTimer.current=null;}
      const orbit=controls.current;if(!orbit)return;
      writeSavedCamera({version:1,projection:camera===ortho?'orthographic':'perspective',
        position:camera.position.toArray() as [number,number,number],target:orbit.target.toArray() as [number,number,number],
        up:camera.up.toArray() as [number,number,number],orthoHeight:ortho.top-ortho.bottom,perspectiveFov:initialPerspective.current.fov});
    };
    window.addEventListener('pagehide',onHide);
    return()=>{window.removeEventListener('pagehide',onHide);if(cameraSaveTimer.current!==null)clearTimeout(cameraSaveTimer.current)};
  },[camera,ortho]);
  useEffect(()=>{
    if(camera instanceof THREE.PerspectiveCamera){camera.fov=controlsConfig.perspectiveFov;camera.updateProjectionMatrix();}
  },[camera,controlsConfig.perspectiveFov]);
  useEffect(()=>{
    const target=gl.domElement;
    const onPointer=(e:PointerEvent)=>{
      if(e.button===1){e.preventDefault()} // Prevent middle-click autoscroll in browsers.
      if(useEditor.getState().walkMode){
        if(e.button===0&&document.pointerLockElement!==gl.domElement)
          gl.domElement.requestPointerLock?.().catch(()=>{});
        e.preventDefault();e.stopImmediatePropagation();return;
      }
      // Native CAPTURE handler runs ahead of OrbitControls (which otherwise
      // starts a Classic LMB pan even if the R3F mesh stops propagation).
      if(isUvDragGesture(e,useEditor.getState().faceMode)&&controls.current){
        controls.current.enabled=false;
        e.preventDefault();
      }
      if(e.button===1&&blender&&controls.current){
        // In OrbitControls Shift+ROTATE is PAN. Ctrl must become DOLLY explicitly.
        controls.current.mouseButtons.MIDDLE=e.ctrlKey?THREE.MOUSE.DOLLY:THREE.MOUSE.ROTATE;
      }
    };
    const restoreCamera=()=>{
      if(controls.current)controls.current.enabled=!useEditor.getState().walkMode&&!useEditor.getState().modalTransform&&!useEditor.getState().drawMode&&useArchitectureMode.getState().mode==='off'&&!useEditor.getState().textureDragSnapshot;
    };
    const onRelease=()=>{restoreCamera()};
    const onBlur=()=>{
      if(useEditor.getState().textureDragSnapshot)useEditor.getState().finishTextureDrag(false);
      restoreCamera();
    };
    const preventContext=(e:MouseEvent)=>{if(target.contains(e.target as Node))e.preventDefault()};
    target.addEventListener('pointerdown',onPointer,true);
    window.addEventListener('pointerup',onRelease);
    window.addEventListener('pointercancel',onRelease);
    window.addEventListener('blur',onBlur);
    target.addEventListener('contextmenu',preventContext);
    return()=>{
      target.removeEventListener('pointerdown',onPointer,true);
      target.removeEventListener('contextmenu',preventContext);
      window.removeEventListener('pointerup',onRelease);
      window.removeEventListener('pointercancel',onRelease);
      window.removeEventListener('blur',onBlur);
    };
  },[gl,blender]);
  useEffect(()=>{
    const canvas=gl.domElement;
    const allowed=()=>{
      const state=useEditor.getState();
      return canCaptureMapCamera({...state,hudEditing:useHudLayout.getState().editing,
        dialogOpen:!!document.querySelector('.modal-backdrop')});
    };
    const down=(event:PointerEvent)=>{
      if(event.button!==2||!allowed())return;
      rightMouseLook.current=true;
      // Rotate around the camera position, not around an OrbitControls pivot.
      if(controls.current)controls.current.enabled=false;
      // Pointer capture does NOT hide or constrain the mouse; it also permits
      // native context menus. The MAP viewport needs true Pointer Lock both in
      // and out of fullscreen for unlimited RMB camera look. Chrome may show a
      // security tip; web content cannot suppress that browser-owned UI.
      event.preventDefault();
      if(document.pointerLockElement&&document.pointerLockElement!==canvas)return;
      if(document.pointerLockElement===canvas)return;
      try{
        void Promise.resolve(canvas.requestPointerLock?.()).then(()=>{
          // The user may release RMB before a permission prompt resolves.
          if(!rightMouseLook.current&&document.pointerLockElement===canvas)
            document.exitPointerLock?.();
        }).catch(()=>{});
      }catch{/* Lock denied: keep a bounded drag fallback. */}
    };
    const up=(event:PointerEvent)=>{
      if(event.button!==2||!rightMouseLook.current)return;
      rightMouseLook.current=false;
      try{if(canvas.hasPointerCapture?.(event.pointerId))canvas.releasePointerCapture(event.pointerId)}catch{/* Optional */}
      if(document.pointerLockElement===canvas)document.exitPointerLock?.();
      if(controls.current)controls.current.enabled=!useEditor.getState().modalTransform&&!useEditor.getState().drawMode&&useArchitectureMode.getState().mode==='off'&&!useEditor.getState().textureDragSnapshot;
      saveCamera();
    };
    const cancel=()=>{
      rightMouseLook.current=false;
      if(document.pointerLockElement===canvas)document.exitPointerLock?.();
      if(controls.current)controls.current.enabled=!useEditor.getState().walkMode&&!useEditor.getState().modalTransform&&!useEditor.getState().drawMode&&useArchitectureMode.getState().mode==='off'&&!useEditor.getState().textureDragSnapshot;
    };
    const lockChange=()=>{
      if(document.pointerLockElement!==canvas&&rightMouseLook.current){
        // Esc cancels pointer lock, not the entire editor session.
        rightMouseLook.current=false;
        if(controls.current)controls.current.enabled=true;
      }
    };
    canvas.addEventListener('pointerdown',down,true);
    document.addEventListener('pointerup',up,true);
    document.addEventListener('pointercancel',cancel,true);
    window.addEventListener('blur',cancel);
    document.addEventListener('pointerlockchange',lockChange);
    return()=>{
      canvas.removeEventListener('pointerdown',down,true);
      document.removeEventListener('pointerup',up,true);
      document.removeEventListener('pointercancel',cancel,true);
      window.removeEventListener('blur',cancel);
      document.removeEventListener('pointerlockchange',lockChange);
      if(rightMouseLook.current&&document.pointerLockElement===canvas)document.exitPointerLock?.();
      rightMouseLook.current=false;
    };
  },[gl]);
  useEffect(()=>{
    // Pointer-lock denial fallback: keep turning while RMB is held over the
    // canvas (the main path uses document mousemove while locked).
    const canvas=gl.domElement;
    const move=(event:PointerEvent)=>{
      if(!rightMouseLook.current||document.pointerLockElement===canvas||!controls.current||
         useEditor.getState().walkMode||useEditor.getState().flyMode||
         useEditor.getState().textureDragSnapshot)return;
      if(!event.movementX&&!event.movementY)return;
      const direction=new THREE.Vector3();camera.getWorldDirection(direction);
      const sensitivity=.0022*controlsConfig.orbitSensitivity*controlsConfig.flyLookSensitivity*(controlsConfig.invertOrbit?-1:1);
      const yaw=Math.atan2(direction.x,-direction.z)+event.movementX*sensitivity;
      const pitch=THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(direction.y,-1,1))-event.movementY*sensitivity,-1.46,1.46);
      direction.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
      const distance=Math.max(100,controls.current.target.distanceTo(camera.position));
      controls.current.target.copy(camera.position).addScaledVector(direction,distance);
      lastTarget.current.copy(controls.current.target);controls.current.update();saveCamera();
    };
    canvas.addEventListener('pointermove',move,true);
    return()=>canvas.removeEventListener('pointermove',move,true);
  },[camera,gl,controlsConfig.orbitSensitivity,controlsConfig.flyLookSensitivity,controlsConfig.invertOrbit]);
  useEffect(()=>{
    if(!flyMode&&!walkMode){
      if(!rightMouseLook.current&&document.pointerLockElement===gl.domElement)document.exitPointerLock?.();
    }else rightMouseLook.current=false;
    const onPointerLockChange=()=>{
      if(document.pointerLockElement!==gl.domElement){
        rightMouseLook.current=false;
        if(useEditor.getState().walkMode)useEditor.getState().setWalk(false);
        if(useEditor.getState().flyMode)useEditor.getState().setFly(false);
      }
    };
    const onMouseMove=(e:MouseEvent)=>{
      if(document.pointerLockElement!==gl.domElement||!controls.current||useEditor.getState().textureDragSnapshot)return;
      if(!useEditor.getState().walkMode&&!useEditor.getState().flyMode&&!rightMouseLook.current)return;
      const sensitivity=.0022*controlsConfig.orbitSensitivity*controlsConfig.flyLookSensitivity*(controlsConfig.invertOrbit?-1:1);
      if(useEditor.getState().walkMode){
        walkLook.current.yaw+=e.movementX*sensitivity;
        walkLook.current.pitch=THREE.MathUtils.clamp(walkLook.current.pitch-e.movementY*sensitivity,-1.46,1.46);
        camera.lookAt(camera.position.clone().add(walkDirection()));
        return;
      }
      const dir=new THREE.Vector3();camera.getWorldDirection(dir);
      const yaw=Math.atan2(dir.x,-dir.z)+e.movementX*sensitivity;
      const pitch=THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(dir.y,-1,1))-e.movementY*sensitivity,-1.46,1.46);
      dir.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
      controls.current.target.copy(camera.position).addScaledVector(dir,600);
      lastTarget.current.copy(controls.current.target);
      controls.current.update();
      saveCamera();
    };
    document.addEventListener('pointerlockchange',onPointerLockChange);
    document.addEventListener('mousemove',onMouseMove);
    return()=>{document.removeEventListener('pointerlockchange',onPointerLockChange);document.removeEventListener('mousemove',onMouseMove)};
  },[flyMode,walkMode,camera,gl,controlsConfig.orbitSensitivity,controlsConfig.flyLookSensitivity,controlsConfig.invertOrbit]);
  useEffect(()=>{
    if(!controls.current||walkMode)return;
    controls.current.target.copy(lastTarget.current);
    controls.current.update();
  },[camera,walkMode]);
  useEffect(()=>{
    const keydown=(e:KeyboardEvent)=>{
      if(document.querySelector('.true-light-workbench.true-light-full')){keys.current.clear();return;}
      if(useHudLayout.getState().editing||(e.target as HTMLElement)?.closest('input:not([type=range]),textarea,select,[contenteditable]')||document.querySelector('.modal-backdrop'))return;
      keys.current.add(e.key.toLowerCase());keys.current.add(e.code);
      if(useEditor.getState().walkMode){
        if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','F5','KeyF','KeyH','KeyN','KeyC','KeyE'].includes(e.code))e.preventDefault();
        if(e.repeat||e.altKey||e.ctrlKey||e.metaKey)return;
        if(e.code==='KeyF')preview.updateWalk({flashlight:!walkSettingsRef.current.flashlight});
        if(e.code==='KeyH')preview.updateWalk({showHud:!walkSettingsRef.current.showHud});
        if(e.code==='KeyN')preview.updateWalk({noclip:!walkSettingsRef.current.noclip});
        if(e.code==='KeyE'&&walkSettingsRef.current.interactions){
          const session=preview.gameplaySession.current;
          if(!session)return;
          const ray=new THREE.Raycaster();ray.set(camera.position,walkDirection());ray.far=124;
          // First visible solid blocks interaction; never activate a button through a wall.
          const hits=ray.intersectObjects(getThreeScene.children,true).filter(hit=>hit.object instanceof THREE.Mesh && !!hit.object.userData.brushId);
          const nearest=hits[0];
          if(!nearest){preview.reportGameplay('No interactive entity in range.');return;}
          const action=session.getAction(String(nearest.object.userData.brushId));
          const feedback=action?session.activate(action.entityId):null;
          preview.reportGameplay(feedback?.message||'No interactive entity in range.');
        }
      }
    };
    const keyup=(e:KeyboardEvent)=>{keys.current.delete(e.key.toLowerCase());keys.current.delete(e.code)};
    const onblur=()=>keys.current.clear();
    window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',onblur);
    return()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',onblur)};
  },[preview.updateWalk,preview.reportGameplay,preview.gameplaySession,camera,getThreeScene]);
  useFrame((_state,delta)=>{
    if(document.querySelector('.true-light-workbench.true-light-full')){keys.current.clear();return;}
    if(useHudLayout.getState().editing||modal||uvDragging||!controls.current)return;
    // Switching UI controls must never leave movement keys latched while typing.
    if((document.activeElement as HTMLElement|null)?.closest('input:not([type=range]),textarea,select,[contenteditable]')){keys.current.clear();return;}
    const active=keys.current;
    if(walkMode){
      if(!walkPose.current||document.pointerLockElement!==gl.domElement)return;
      const jump=active.has('Space')&&!previousJump.current;
      previousJump.current=active.has('Space');
      // One broadphase pass per frame keeps the walk preview usable on large maps.
      const p=walkPose.current.position;
      const near=walkColliders.filter(b=>!preview.gameplaySession.current?.isDoorOpen(b.entityId)&&p[0]>=b.min[0]-80&&p[0]<=b.max[0]+80&&p[2]>=b.min[2]-80&&p[2]<=b.max[2]+80);
      const config=walkSettingsRef.current;
      const forward=Number(active.has('KeyW'))-Number(active.has('KeyS'));
      const strafe=Number(active.has('KeyD'))-Number(active.has('KeyA'));
      const run=active.has('ShiftLeft')||active.has('ShiftRight');
      const crouch=isWalkCrouchHeld(active);
      const before=[...walkPose.current.position];
      if(config.noclip){
        const displacement=noclipDisplacement(walkLook.current.yaw,walkLook.current.pitch,forward,strafe,Number(active.has('Space'))-Number(crouch),config.walkSpeed*(run?config.runMultiplier:1),delta);
        walkPose.current={...walkPose.current,position:walkPose.current.position.map((v,i)=>v+displacement[i]) as [number,number,number],velocityY:0,grounded:false,crouched:false};
      }else walkPose.current=walkStep(walkPose.current,{
        forward,strafe,yaw:walkLook.current.yaw,run,crouch,jump,
        speed:config.walkSpeed,runMultiplier:config.runMultiplier,crouchMultiplier:config.crouchMultiplier
      },near,delta);
      const pose=walkPose.current;
      if(walkSettingsRef.current.interactions){
        const session=preview.gameplaySession.current;
        if(session){session.step(delta);session.enterVolumes([pose.position[0],-pose.position[2],pose.position[1]]);
          if(session.feedback&&session.feedback.message!==lastGameplayMessage.current){
            lastGameplayMessage.current=session.feedback.message;preview.reportGameplay(session.feedback.message);
          }
        }
      }
      const eye=pose.crouched?WALK.crouchEye:WALK.standEye;
      camera.position.set(pose.position[0],pose.position[1]+eye,pose.position[2]);
      camera.lookAt(camera.position.clone().add(walkDirection()));
      const now=performance.now();if(now-lastWalkReport.current>150){
        lastWalkReport.current=now;
        reportRef.current({position:[...pose.position],speed:Math.hypot(pose.position[0]-before[0],pose.position[1]-before[1],pose.position[2]-before[2])/Math.max(.0001,delta),grounded:pose.grounded,crouched:pose.crouched,noclip:config.noclip});
      }
      return;
    }
    const editState=useEditor.getState();
    const faceExtrudeActive=!flyMode&&editState.geometryMode==='face'&&editState.selectedFace!==null;
    const vertical=keyboardVerticalDirection(active,faceExtrudeActive);
    // Roblox Studio-style navigation: WASD/Q/E are available in MAP view
    // regardless of the old Blender/classic orbit preset.
    const forward=new THREE.Vector3(),right=new THREE.Vector3();camera.getWorldDirection(forward);
    forward.y=0;forward.normalize();right.crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
    const move=new THREE.Vector3();
    if(true){
      const safeMovement=canMoveInCameraCapture(active);
      if(safeMovement){
        if(active.has('w'))move.add(forward);if(active.has('s'))move.sub(forward);
        if(active.has('d'))move.add(right);if(active.has('a'))move.sub(right);
      }
    }
    if(vertical)move.y+=vertical;
    if(move.lengthSq()){
      const speed=controlsConfig.flySpeed*(active.has('shift')?controlsConfig.flyBoostMultiplier:active.has('control')?controlsConfig.flySlowMultiplier:1);
      move.normalize().multiplyScalar(Math.min(delta,.05)*speed);
      camera.position.add(move);controls.current.target.add(move);lastTarget.current.copy(controls.current.target);controls.current.update();
    }
  });
  useEffect(()=>{
    if(!command||command.serial===lastCommand.current)return;
    lastCommand.current=command.serial;
    const action=command.action;
    const orbit=controls.current;
    if(!orbit)return;
    const target=orbit.target.clone();
    // Architecture's top view must look at its current drawing height, not
    // an arbitrary previous orbit pivot (possibly far above the construction plane).
    if(action==='top'&&useArchitectureMode.getState().mode!=='off')target.y=useArchitectureMode.getState().options.baseZ;
    const isOrtho=camera===ortho;
    const aspect=Math.max(.1,size.width/Math.max(1,size.height));
    const switchCamera=(toOrtho:boolean)=>{
      const dest=toOrtho?ortho:initialPerspective.current;
      if(dest===camera)return dest;
      dest.position.copy(camera.position);dest.quaternion.copy(camera.quaternion);dest.up.copy(camera.up);
      if(!toOrtho)dest.up.set(0,1,0);
      if(toOrtho){
        const radius=Math.max(30,camera.position.distanceTo(target));
        const perspective=initialPerspective.current;
        const h=2*radius*Math.tan(THREE.MathUtils.degToRad(perspective.fov/2));
        ortho.left=-h*aspect/2;ortho.right=h*aspect/2;ortho.top=h/2;ortho.bottom=-h/2;ortho.zoom=1;ortho.updateProjectionMatrix();
      }
      lastTarget.current.copy(target);set({camera:dest});
      return dest;
    };
    if(action==='projection'){
      switchCamera(!isOrtho);setCameraLabel(isOrtho?'Perspective':'Orthographic');return;
    }
    if(['front','right','top','back','left','bottom','isometric'].includes(action)){
      const dest=switchCamera(true);
      const distance=Math.max(600,camera.position.distanceTo(target));
      const offset=action==='front'?new THREE.Vector3(0,0,distance):action==='back'?new THREE.Vector3(0,0,-distance):
        action==='right'?new THREE.Vector3(distance,0,0):action==='left'?new THREE.Vector3(-distance,0,0):
        action==='top'?new THREE.Vector3(0,distance,0):action==='bottom'?new THREE.Vector3(0,-distance,0):
        new THREE.Vector3(distance,distance,distance).normalize().multiplyScalar(distance);
      dest.up.set(0,action==='top'?0:1,action==='top'?-1:action==='bottom'?1:0);
      dest.position.copy(target).add(offset);dest.lookAt(target);lastTarget.current.copy(target);
      // OrbitControls must inherit the same pivot when switching projections.
      // Otherwise its old pivot can immediately pull an orthographic top view
      // away from the architectural drawing plane.
      orbit.target.copy(target);
      if(dest===camera)orbit.update();
      const labels:Record<string,string>={front:'Front (Ortho)',right:'Right (Ortho)',top:'Top (Ortho)',back:'Back (Ortho)',left:'Left (Ortho)',bottom:'Bottom (Ortho)',isometric:'Isometric (Ortho)'};
      setCameraLabel(labels[action]);
      return;
    }
    // Incremental viewport navigation. These commands adjust only camera state,
    // never brush coordinates or the exported Svengine map.
    if(['orbitLeft','orbitRight','orbitUp','orbitDown','panLeft','panRight','panUp','panDown','zoomIn','zoomOut','resetView'].includes(action)){
      if(action==='resetView'){
        const destination=switchCamera(false);
        destination.up.set(0,1,0);
        destination.position.set(660,530,690);
        const homeTarget=new THREE.Vector3(0,0,0);
        orbit.target.copy(homeTarget);lastTarget.current.copy(homeTarget);
        destination.lookAt(homeTarget);orbit.update();setCameraLabel('Perspective');
        return;
      }
      const offset=camera.position.clone().sub(target);
      const radius=Math.max(10,offset.length());
      const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),offset).normalize();
      if(right.lengthSq()<.0001)right.set(1,0,0);
      const up=new THREE.Vector3().crossVectors(offset,right).normalize();
      if(action.startsWith('orbit')){
        const sphere=new THREE.Spherical().setFromVector3(offset);
        if(action==='orbitLeft')sphere.theta-=Math.PI/12;
        if(action==='orbitRight')sphere.theta+=Math.PI/12;
        if(action==='orbitUp')sphere.phi=Math.max(.02,sphere.phi-Math.PI/12);
        if(action==='orbitDown')sphere.phi=Math.min(Math.PI-.02,sphere.phi+Math.PI/12);
        camera.position.copy(target).add(new THREE.Vector3().setFromSpherical(sphere));
        camera.up.set(0,1,0);camera.lookAt(target);orbit.update();setCameraLabel(isOrtho?'Orthographic':'Perspective');
        return;
      }
      if(action.startsWith('pan')){
        const move=new THREE.Vector3();const step=Math.max(8,radius*.1);
        if(action==='panLeft')move.addScaledVector(right,-step);
        if(action==='panRight')move.addScaledVector(right,step);
        if(action==='panUp')move.addScaledVector(up,step);
        if(action==='panDown')move.addScaledVector(up,-step);
        camera.position.add(move);orbit.target.add(move);lastTarget.current.copy(orbit.target);orbit.update();
        return;
      }
      if(isOrtho){
        ortho.zoom=THREE.MathUtils.clamp(ortho.zoom*(action==='zoomIn'?1.25:.8),.01,1000);
        ortho.updateProjectionMatrix();orbit.update();
      }else{
        const factor=action==='zoomIn'?.8:1.25;
        camera.position.copy(target).addScaledVector(offset,Math.max(controlsConfig.minCameraDistance,Math.min(controlsConfig.maxCameraDistance,radius*factor))/radius);
        orbit.update();
      }
      return;
    }
    if(action==='frame'||action==='frameAll'){
      const snapshot=useEditor.getState();
      let objects=snapshot.project.objects.filter(o=>(!o.hidden||(action==='frame'&&o.id===snapshot.focusHiddenId))&&(action==='frame'?snapshot.selectedIds.includes(o.id):true));
      // MAP Navigator focuses the physical brush extent of brush-based entities,
      // whose point origin can be far away from their visible geometry.
      if(action==='frame'&&snapshot.navigatorFocusedId&&snapshot.navigatorFocusedId===snapshot.selected){
        const picked=objects.find(o=>o.id===snapshot.navigatorFocusedId);
        if(picked?.kind==='entity'){
          const linked=snapshot.project.objects.filter(o=>o.kind==='brush'&&o.entityId===picked.id&&!o.hidden);
          if(linked.length)objects=linked;
        }
      }
      // v2.4: a tool can frame a world box (player-size check issues) instead of the selection.
      const box=action==='frame'?snapshot.frameTarget:null;
      if(box)useEditor.setState({frameTarget:null});
      if(!objects.length&&!box)return;
      const bounds=new THREE.Box3();
      if(box){bounds.expandByPoint(gameToThree(box.min));bounds.expandByPoint(gameToThree(box.max));objects=[];}
      for(const o of objects){
        if(o.kind==='brush')for(const v of transformedVertices(o))bounds.expandByPoint(gameToThree(v));
        else bounds.expandByPoint(gameToThree(o.position));
      }
      if(bounds.isEmpty())return;
      const center=bounds.getCenter(new THREE.Vector3()),extent=bounds.getSize(new THREE.Vector3());
      const radius=Math.max(32,extent.length()/2);
      const viewing=camera.position.clone().sub(target).normalize();if(viewing.lengthSq()<.1)viewing.set(1,.8,1).normalize();
      if(isOrtho){
        const h=Math.max(128,Math.max(extent.y,extent.x/aspect,extent.z/aspect)*1.7);
        ortho.left=-h*aspect/2;ortho.right=h*aspect/2;ortho.top=h/2;ortho.bottom=-h/2;ortho.zoom=1;ortho.updateProjectionMatrix();
        camera.position.copy(center).addScaledVector(viewing,Math.max(400,radius*3));
      } else {
        const fov=THREE.MathUtils.degToRad(initialPerspective.current.fov);
        const distance=radius/Math.sin(fov/2)*1.5;
        camera.position.copy(center).addScaledVector(viewing,distance);
      }
      orbit.target.copy(center);lastTarget.current.copy(center);orbit.update();
    }
  },[command,camera,ortho,set,size.width,size.height,setCameraLabel,controlsConfig.minCameraDistance,controlsConfig.maxCameraDistance]);
  useEffect(()=>{
    if(camera!==ortho)return;
    const aspect=Math.max(.1,size.width/Math.max(1,size.height));
    const height=ortho.top-ortho.bottom;
    ortho.left=-height*aspect/2;ortho.right=height*aspect/2;ortho.updateProjectionMatrix();
  },[size.width,size.height,camera,ortho]);
  // Focus a compiler pointfile endpoint without modifying scene geometry.
  useEffect(()=>{
    if(!doctorFocus||walkMode||!controls.current)return;
    const orbit=controls.current,target=gameToThree(doctorFocus);
    const offset=camera.position.clone().sub(orbit.target);
    if(offset.lengthSq()<.01)offset.set(1,.7,1);
    offset.normalize().multiplyScalar(340);
    camera.position.copy(target).add(offset);
    orbit.target.copy(target);lastTarget.current.copy(target);
    orbit.update();
  },[doctorFocusSerial,doctorFocus,walkMode,camera]);
  return <OrbitControls ref={controls} makeDefault enabled={!walkMode&&!modal&&!drawMode&&!architectureDrawing&&!uvDragging}
    onChange={saveCamera} enableDamping={controlsConfig.cameraDamping} dampingFactor={controlsConfig.dampingFactor}
    zoomToCursor={controlsConfig.zoomToCursor}
    enablePan={!drawMode&&!architectureDrawing} maxDistance={Math.max(controlsConfig.maxCameraDistance,controlsConfig.minCameraDistance+100)} minDistance={controlsConfig.minCameraDistance}
    rotateSpeed={(controlsConfig.invertOrbit?-1:1)*controlsConfig.orbitSensitivity}
    panSpeed={controlsConfig.panSensitivity} zoomSpeed={controlsConfig.zoomSensitivity}
    mouseButtons={blender?
      {LEFT:-1 as THREE.MOUSE,MIDDLE:THREE.MOUSE.ROTATE,RIGHT:-1 as THREE.MOUSE}:
      {LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:-1 as THREE.MOUSE}}/>;
}
/** HF19: a non-pickable world-space outline for the last Navigator focus.
 * Selection and geometry remain owned by the normal MAP editor. */
function NavigatorFocusOutline(){
  const focusedId=useEditor(s=>s.navigatorFocusedId);
  const selected=useEditor(s=>s.selected);
  const objects=useEditor(s=>s.project.objects);
  const outline=useMemo(()=>{
    if(!focusedId||selected!==focusedId)return null;
    const object=objects.find(o=>o.id===focusedId);
    if(!object||object.hidden)return null;
    const bounds=new THREE.Box3();
    const linked=object.kind==='entity'?objects.filter(o=>o.kind==='brush'&&o.entityId===object.id&&!o.hidden):[];
    if(object.kind==='brush'||linked.length){
      const brushSet=object.kind==='brush'?[object]:linked;
      for(const brush of brushSet){
        if(brush.kind!=='brush')continue;
        for(const point of transformedVertices(brush))bounds.expandByPoint(gameToThree(point));
      }
      if(bounds.isEmpty())return null;
      bounds.expandByScalar(2);
    }else{
      bounds.setFromCenterAndSize(gameToThree(object.position),new THREE.Vector3(42,65,42));
    }
    if(bounds.isEmpty())return null;
    const size=bounds.getSize(new THREE.Vector3());
    const box=new THREE.BoxGeometry(size.x,size.y,size.z);
    const geometry=new THREE.EdgesGeometry(box);
    box.dispose();
    return {center:bounds.getCenter(new THREE.Vector3()),geometry};
  },[focusedId,selected,objects]);
  useEffect(()=>()=>outline?.geometry.dispose(),[outline]);
  if(!outline)return null;
  return <lineSegments geometry={outline.geometry} position={outline.center} raycast={()=>null} renderOrder={950}>
    <lineBasicMaterial color="#ffdc63" transparent opacity={0.95} depthTest={false} depthWrite={false}/>
  </lineSegments>;
}
/** Remote selections are read-only color outlines; they cannot steal clicks. */
function BuildTogetherSelections(){
  const participants=useBuildTogether(state=>state.participants),selfId=useBuildTogether(state=>state.selfId);
  const objects=useEditor(state=>state.project.objects);
  const selectionKey=participants.map(member=>`${member.id}:${member.color}:${member.selection.join(',')}`).join('|');
  const overlays=useMemo(()=>{
    if(participants.length<2)return [] as {key:string;helper:THREE.Box3Helper}[];
    const lookup=new Map(objects.map(object=>[object.id,object]));
    const result:{key:string;helper:THREE.Box3Helper}[]=[];
    for(const member of participants){if(member.id===selfId)continue;
      for(const id of member.selection.slice(0,40)){
        const object=lookup.get(id);if(!object||object.hidden)continue;
        const points=object.kind==='brush'?transformedVertices(object).map(gameToThree):[gameToThree(object.position)];
        const bounds=new THREE.Box3().setFromPoints(points);
        if(object.kind==='entity')bounds.expandByScalar(9);
        const helper=new THREE.Box3Helper(bounds,member.color);
        const material=helper.material as THREE.LineBasicMaterial;
        material.depthTest=false;material.depthWrite=false;material.transparent=true;material.opacity=.87;
        helper.renderOrder=1000;helper.raycast=()=>{};
        result.push({key:`${member.id}:${id}`,helper});
      }
    }
    return result;
  },[selectionKey,selfId,objects]);
  useEffect(()=>()=>{for(const {helper} of overlays){helper.geometry.dispose();(helper.material as THREE.Material).dispose()}},[overlays]);
  return <group>{overlays.map(item=><primitive key={item.key} object={item.helper}/>)}</group>;
}
/** v2.6: viewport display style — vertical gradient background (Options → 3D viewport). */
function ThemeBackground({top,bottom}:{top:string;bottom:string}){
  const {scene,invalidate}=useThree();
  useEffect(()=>{
    if(top===bottom){const prev=scene.background;scene.background=new THREE.Color(top);invalidate();return()=>{scene.background=prev;};}
    const c=document.createElement('canvas');c.width=2;c.height=256;const g=c.getContext('2d');
    if(g){const gr=g.createLinearGradient(0,0,0,256);gr.addColorStop(0,top);gr.addColorStop(1,bottom);g.fillStyle=gr;g.fillRect(0,0,2,256);}
    const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const prev=scene.background;scene.background=tex;invalidate();
    return()=>{scene.background=prev;tex.dispose();};
  },[top,bottom,scene,invalidate]);
  return null;
}
function Ground(){
  const show=useEditor(s=>s.showGrid),snap=useEditor(s=>s.gridDisplayStep);
  const gridTheme=viewportTheme(useStudioLayout(s=>s.viewportTheme));
  const selected=useEditor(s=>s.selected),objects=useEditor(s=>s.project.objects);
  const target=objects.find(o=>o.id===selected);
  // HF15 Preview 1 overlaid a coarse helper beneath fine grid sizes to extend
  // the visible area. That produced a darker square patch when the two helpers
  // stacked after changing the grid size or selecting a brush.
  // Use one larger helper instead so the visible grid stays continuous.
  const minSpan=snap<=1?1024:snap<16?2048:0;
  const span=Math.min(8192,Math.max(snap*256,minSpan));
  const divisions=Math.max(16,Math.round(span/Math.max(1,snap)));
  const center=target?gameToThree(target.position):new THREE.Vector3();
  const step=snap*128;
  const x=Math.round(center.x/step)*step,z=Math.round(center.z/step)*step;
  return show?<gridHelper key={gridTheme.id} args={[span,divisions,gridTheme.grid,gridTheme.gridMinor]} position={[x,-.15,z]}/>:null;
}
/**
 * Move every selected brush/entity in real time, then commit ONE undoable change
 * on mouse release. TransformControls moves only the pivot, so visual groups
 * must be previewed explicitly. The editor's positions are changed only once.
 */
/** One consistent gizmo for single brushes, entities, and multi-selection.
 * A single mouseUp commits exactly one undo entry; object meshes are only
 * previewed during the drag. Gizmo handles are larger in hit-testing space.
 */
/** Six individually draggable face arrows. Unlike the stock scale gizmo,
 * the opposite face remains fixed. Dragging changes only the local brush
 * scale and world position, with one Undo/Redo entry at pointer release. */
function FaceScaleGizmo({brush,snap,snapping}:{brush:Brush;snap:number;snapping:boolean}){
  const {camera,gl}=useThree();
  const transformSelection=useEditor(s=>s.transformSelection);
  const groups=useRef<Record<string,THREE.Group|null>>({});
  const drag=useRef<{pointerId:number;x:number;y:number;px:number;py:number;distance:number;axis:FaceAxis;sign:FaceSign;original:Brush;last:{position:Vec3;scale:Vec3}|null}|null>(null);
  const {mins,maxs}=useMemo(()=>faceLocalBounds(brush),[brush]);
  const origin=gameToThree(brush.position),rotation=toRenderQuaternion(brush.rotation);
  const directions:[FaceAxis,FaceSign][]=[[0,-1],[0,1],[1,-1],[1,1],[2,-1],[2,1]];
  const gameBasis=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,0,-1),new THREE.Vector3(0,1,0)];
  const handles=directions.map(([axis,sign])=>{
    const local:[number,number,number]=[(mins[0]+maxs[0])/2,(mins[1]+maxs[1])/2,(mins[2]+maxs[2])/2];
    local[axis]=sign===1?maxs[axis]:mins[axis];
    const position=origin.clone().add(gameToThree(local.map((v,i)=>v*brush.scale[i]) as Vec3).applyQuaternion(rotation));
    const direction=gameBasis[axis].clone().applyQuaternion(rotation).multiplyScalar(sign);
    return {axis,sign,position,direction,key:`${axis}:${sign}`};
  });
  // A single screen-space scale guarantees usable hit areas on small buttons
  // without making the arrow gigantic on a 1000-unit wall.
  const pixelWorld=(position:THREE.Vector3)=>{
    const cameraDepth=-position.clone().applyMatrix4(camera.matrixWorldInverse).z;
    return unitsPerScreenPixel({orthographic:camera instanceof THREE.OrthographicCamera,
      cameraDepth,zoom:camera instanceof THREE.OrthographicCamera||camera instanceof THREE.PerspectiveCamera?camera.zoom:1,viewportHeight:gl.domElement.getBoundingClientRect().height,
      fovDegrees:camera instanceof THREE.PerspectiveCamera?camera.fov:50,
      orthoHeight:camera instanceof THREE.OrthographicCamera?camera.top-camera.bottom:1});
  };
  useFrame(()=>{
    for(const h of handles){const group=groups.current[h.key];if(group){
      const size=pixelWorld(h.position);if(Number.isFinite(size))group.scale.setScalar(size);
    }}
  });
  const projectedTip=(h:typeof handles[number])=>{
    const position=h.position.clone().addScaledVector(h.direction,FACE_GIZMO_TIP_PIXELS*pixelWorld(h.position));
    return position.project(camera);
  };
  useEffect(()=>{
    const hit=(x:number,y:number)=>{
      const rect=gl.domElement.getBoundingClientRect();
      return handles.some(h=>{
        const projected=projectedTip(h);
        if(projected.z<-1||projected.z>1)return false;
        const px=rect.left+(projected.x+1)*rect.width/2;
        const py=rect.top+(1-projected.y)*rect.height/2;
        return (x-px)**2+(y-py)**2<(FACE_GIZMO_HIT_PIXELS+3)**2;
      });
    };
    selectedGizmoPointerHit=hit;
    return()=>{if(selectedGizmoPointerHit===hit)selectedGizmoPointerHit=null};
  },[brush,camera,gl]);
  const start=(e:import('@react-three/fiber').ThreeEvent<PointerEvent>,h:typeof handles[number])=>{
    if(e.button!==0)return;
    e.stopPropagation();e.nativeEvent.preventDefault();
    const rect=gl.domElement.getBoundingClientRect();
    const distance=80*pixelWorld(h.position);
    const a=h.position.clone().project(camera),b=h.position.clone().addScaledVector(h.direction,distance).project(camera);
    const px=(b.x-a.x)*rect.width/2,py=-(b.y-a.y)*rect.height/2;
    if(px*px+py*py<1)return;
    (e.target as unknown as {setPointerCapture:(id:number)=>void}).setPointerCapture(e.pointerId);
    drag.current={pointerId:e.pointerId,x:e.clientX,y:e.clientY,px,py,distance,
      axis:h.axis,sign:h.sign,original:structuredClone(brush),last:null};
    faceScaleOrbitToggle?.(false);
  };
  const move=(e:import('@react-three/fiber').ThreeEvent<PointerEvent>)=>{
    const session=drag.current;if(!session||session.pointerId!==e.pointerId)return;
    e.stopPropagation();
    const traveled=((e.clientX-session.x)*session.px+(e.clientY-session.y)*session.py)/(session.px**2+session.py**2)*session.distance;
    const distance=preciseFaceDistance(traveled,snap,snapping,e.shiftKey);
    const next=resizeFromFace(session.original,session.axis,session.sign,distance);
    session.last=next;
    const visual=visualGroups.get(brush.id);
    if(visual){visual.position.copy(gameToThree(next.position));visual.scale.set(next.scale[0],next.scale[2],next.scale[1]);}
  };
  const finish=(e:import('@react-three/fiber').ThreeEvent<PointerEvent>,commit:boolean)=>{
    const session=drag.current;if(!session||session.pointerId!==e.pointerId)return;
    e.stopPropagation();drag.current=null;faceScaleOrbitToggle?.(true);
    const visual=visualGroups.get(brush.id);
    if(visual){visual.position.copy(gameToThree(session.original.position));visual.scale.set(session.original.scale[0],session.original.scale[2],session.original.scale[1]);}
    try{(e.target as unknown as {releasePointerCapture:(id:number)=>void}).releasePointerCapture(e.pointerId)}catch{/* already released */}
    const next=session.last;
    if(commit&&next&&(next.position.some((v,i)=>Math.abs(v-session.original.position[i])>.001)||next.scale.some((v,i)=>Math.abs(v-session.original.scale[i])>.001)))
      transformSelection({[brush.id]:next});
  };
  useEffect(()=>()=>{const session=drag.current;if(!session)return;
    const visual=visualGroups.get(brush.id);
    if(visual){visual.position.copy(gameToThree(session.original.position));visual.scale.set(session.original.scale[0],session.original.scale[2],session.original.scale[1]);}
    drag.current=null;faceScaleOrbitToggle?.(true);
  },[brush.id]);
  return <group>{handles.map(h=>{
    const quaternion=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),h.direction);
    const color=h.axis===0?'#fb6576':h.axis===1?'#60c983':'#5faaff';
    const handler={onPointerDown:(e:import('@react-three/fiber').ThreeEvent<PointerEvent>)=>start(e,h),
      onPointerMove:move,onPointerUp:(e:import('@react-three/fiber').ThreeEvent<PointerEvent>)=>finish(e,true),
      onPointerCancel:(e:import('@react-three/fiber').ThreeEvent<PointerEvent>)=>finish(e,false)};
    return <group key={h.key} position={h.position} quaternion={quaternion} ref={node=>{groups.current[h.key]=node}}>
      <mesh position={[0,15,0]} raycast={()=>null}><cylinderGeometry args={[1.5,1.5,19,8]}/><meshBasicMaterial color={color} depthTest={false}/></mesh>
      <mesh position={[0,FACE_GIZMO_TIP_PIXELS,0]} {...handler}>
        <coneGeometry args={[6.5,12,10]}/><meshBasicMaterial color={color} depthTest={false}/>
      </mesh>
      <mesh position={[0,FACE_GIZMO_TIP_PIXELS,0]} {...handler}>
        <sphereGeometry args={[FACE_GIZMO_HIT_PIXELS,12,8]}/><meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false}/>
      </mesh>
    </group>;
  })}</group>;
}

function SelectionTransformControls(){
  const ids=useEditor(s=>s.selectedIds),mode=useEditor(s=>s.mode);
  const modal=useEditor(s=>s.modalTransform);
  const gizmoVisible=useEditor(s=>s.showTransformGizmo),objects=useEditor(s=>s.project.objects);
  const geometryMode=useEditor(s=>s.geometryMode),drawMode=useEditor(s=>s.drawMode);
  const architecturePlacement=useEditor(s=>s.architecturePlacement);
  const snapping=useEditor(s=>s.snapping),snap=useEditor(s=>s.snap),settings=useEditor(s=>s.controls);
  const anchorSetting=useEditor(s=>s.scaleAnchor),transformSelection=useEditor(s=>s.transformSelection);
  const members=objects.filter(o=>ids.includes(o.id)&&!o.locked&&!o.hidden);
  const anchor=members.length>1?'center':anchorSetting;
  const active=mode!=='select'&&members.length>0&&ids.length>0&&gizmoVisible&&!modal&&geometryMode==='object'&&!drawMode&&!architecturePlacement;
  const transformMode=mode==='select'?'translate':mode;
  const single=members.length===1?members[0]:null;
  const pivot=useRef<THREE.Group>(null!);
  const controls=useRef<TransformControlsImpl>(null!);
  const {camera,gl}=useThree();
  // Test the actual invisible native picker, not a guessed radius or the
  // visible colored arrows. This protects rotate rings and plane handles.
  useEffect(()=>{
    if(!active||(transformMode==='scale'&&single?.kind==='brush'))return;
    const hit=(x:number,y:number)=>hitTransformPicker(controls.current,camera,
      gl.domElement.getBoundingClientRect(),x,y);
    selectedGizmoPointerHit=hit;
    return()=>{if(selectedGizmoPointerHit===hit)selectedGizmoPointerHit=null;};
  },[active,camera,gl,transformMode,single?.id,single?.kind]);
  type Pose={position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3;kind:'brush'|'entity'};
  const drag=useRef<{start:THREE.Vector3;quat:THREE.Quaternion;poses:Map<string,Pose>;mode:'translate'|'rotate'|'scale';singleBrush:boolean;snapCache:SmartSnapCache|null;matched:boolean}|null>(null);
  const gizmoKeys=useRef<ModifierKeys>(EMPTY_MODIFIERS);
  useEffect(()=>()=>updateMagneticGuide(null),[ids.join(','),mode]);
  // Center the gizmo on each brush's visible geometry. CSG fragments in older
  // projects may still keep absolute vertices with a zero transform origin.
  const positions=members.map(selectionPivot);
  const center=positions.reduce((sum,p)=>sum.add(p),new THREE.Vector3()).multiplyScalar(1/Math.max(1,positions.length));
  let pivotStart=center;
  if(transformMode==='scale'&&anchor!=='center'){
    if(single?.kind==='brush')pivotStart=anchorPosition(single,anchor);
    else if(members.length>1){
      const bounds=new THREE.Box3();for(const o of members){
        if(o.kind==='brush')for(const point of transformedVertices(o))bounds.expandByPoint(gameToThree(point));
        else bounds.expandByPoint(gameToThree(o.position));
      }
      const a=anchor[0]==='x'?0:anchor[0]==='y'?2:1;
      const min=anchor.endsWith('min');
      const value=min?bounds.min.getComponent(a):bounds.max.getComponent(a);
      pivotStart=center.clone().setComponent(a,value);
    }
  }
  const localScale=transformMode==='scale'&&single?.kind==='brush';
  const pivotQuaternion=single?.kind==='brush'&&(localScale||settings.gizmoSpace==='local')?toRenderQuaternion(single.rotation):new THREE.Quaternion();
  useEffect(()=>{if(controls.current)expandPicker(controls.current)},[transformMode,ids.join(','),settings.gizmoSize]);
  // Native Three.js gizmo receives modifier snaps BEFORE its pointermove
  // handler. G/R/C keeps the richer Shift/Alt transform behavior below.
  useEffect(()=>{
    const c=controls.current;if(!active||!c)return;
    const sync=(event:Pick<KeyboardEvent,'shiftKey'|'ctrlKey'|'altKey'>)=>{
      const keys=modifierKeys(event);gizmoKeys.current=keys;
      const gesture=transformGesture(transformMode,keys,settings,snapping,false);
      // Translation is quantised relative to drag start in preview/commit.
      // Native translationSnap snaps absolute pivot position and would jump.
      c.setRotationSnap(gesture.degrees?THREE.MathUtils.degToRad(gesture.degrees):(null as unknown as number));
      c.setScaleSnap(gesture.factorStep||(null as unknown as number));
    };
    const mouse=(event:PointerEvent)=>sync(event);
    const key=(event:KeyboardEvent)=>{if(['Shift','Control','Alt'].includes(event.key))sync(event)};
    const reset=()=>sync({shiftKey:false,ctrlKey:false,altKey:false});
    const canvas=gl.domElement;
    canvas.addEventListener('pointerdown',mouse,true);
    canvas.addEventListener('pointermove',mouse,true);
    window.addEventListener('keydown',key,true);window.addEventListener('keyup',key,true);
    window.addEventListener('blur',reset);
    reset();
    return()=>{canvas.removeEventListener('pointerdown',mouse,true);canvas.removeEventListener('pointermove',mouse,true);
      window.removeEventListener('keydown',key,true);window.removeEventListener('keyup',key,true);window.removeEventListener('blur',reset)};
  },[active,gl,transformMode,settings,snapping,snap]);
  if(!active)return null;
  if(transformMode==='scale'&&single?.kind==='brush')return <FaceScaleGizmo brush={single} snap={snap} snapping={snapping}/>;
  const begin=()=>{
    if(!pivot.current)return;
    updateMagneticGuide(null);
    drag.current={start:pivot.current.position.clone(),quat:pivot.current.quaternion.clone(),mode:transformMode,
      singleBrush:!!localScale,
      snapCache:transformMode==='translate'&&settings.smartSnapEnabled?createSmartSnapCache(members,objects):null,matched:false,
      poses:new Map(members.map(o=>[o.id,{position:gameToThree(o.position),
        quaternion:o.kind==='brush'?toRenderQuaternion(o.rotation):new THREE.Quaternion(),
        scale:o.kind==='brush'?new THREE.Vector3(o.scale[0],o.scale[2],o.scale[1]):new THREE.Vector3(1,1,1),kind:o.kind}]))};
  };
  const isGridSnapping=()=>transformGesture(transformMode,gizmoKeys.current,settings,snapping,false).grid;
  const poseFor=(original:Pose)=>{
    const session=drag.current!,p=pivot.current;
    const position=original.position.clone(),quaternion=original.quaternion.clone(),scale=original.scale.clone();
    if(session.mode==='translate'){
      position.add(p.position.clone().sub(session.start));
    }else if(session.mode==='rotate'){
      const rotation=p.quaternion.clone().multiply(session.quat.clone().invert());
      position.sub(session.start).applyQuaternion(rotation).add(p.position);
      quaternion.premultiply(rotation);
    }else{
      let factor=p.scale.clone();factor.set(Math.max(.05,Math.abs(factor.x)),Math.max(.05,Math.abs(factor.y)),Math.max(.05,Math.abs(factor.z)));
      if(session.singleBrush&&single?.kind==='brush'&&anchor!=='center'&&isGridSnapping())
        factor=snapBrushScaleFactors(single,original.scale,factor,snap);
      if(session.singleBrush)position.copy(anchoredPose(original.position,original.quaternion,session.start,factor));
      else position.sub(session.start).multiply(factor).add(p.position);
      if(original.kind==='brush')scale.multiply(factor);
    }
    return {position,quaternion,scale};
  };
  const preview=()=>{
    if(!drag.current||!pivot.current)return;
    if(drag.current.mode==='translate'&&isGridSnapping()){
      // Snap the displacement relative to its drag origin, not the pivot's
      // absolute world coordinates. The gizmo and brush stay aligned.
      const displacement=threeToGame(pivot.current.position.clone().sub(drag.current.start));
      const snapped=displacement.map(value=>Math.round(value/snap)*snap) as Vec3;
      pivot.current.position.copy(drag.current.start).add(gameToThree(snapped));
    }
    if(drag.current.mode==='translate'){
      const snapCache=drag.current.snapCache;
      const gizmoAxis=(controls.current as unknown as {axis?:string|null})?.axis;
      const current=threeToGame(pivot.current.position.clone().sub(drag.current.start));
      const threshold=smartSnapWorldTolerance(camera,camera.position.distanceTo(drag.current.start),gl.domElement.clientHeight,settings.smartSnapPixels);
      const result=snapCache&&!gizmoKeys.current.shift
        ?resolveSmartSnap(snapCache,current,threshold,settings.smartSnapMode,snapAxesForGizmo(gizmoAxis)):null;
      drag.current.matched=!!result;
      updateMagneticGuide(result);
      if(result)pivot.current.position.copy(drag.current.start).add(gameToThree(result.delta));
    }
    for(const [id,original] of drag.current.poses){
      const visual=visualGroups.get(id);if(!visual)continue;
      const next=poseFor(original);
      visual.position.copy(next.position);visual.quaternion.copy(next.quaternion);visual.scale.copy(next.scale);
    }
  };
  const commit=()=>{
    const session=drag.current;if(!session||!pivot.current)return;
    const updates:Record<string,{position:Vec3;rotation?:Vec3;scale?:Vec3}>={};
    let changed=false;
    for(const [id,original] of session.poses){
      const next=poseFor(original),o=members.find(item=>item.id===id);
      if(!o)continue;
      let position=threeToGame(next.position);
      if(session.mode==='translate'&&isGridSnapping()&&!session.matched){
        const moved=threeToGame(pivot.current.position.clone().sub(session.start));
        position=o.position.map((v,i)=>v+Math.round(moved[i]/snap)*snap) as Vec3;
      }
      const rotation=o.kind==='brush'?fromRenderQuaternion(next.quaternion):undefined;
      const scale=o.kind==='brush'?[next.scale.x,next.scale.z,next.scale.y].map(v=>Math.max(.05,Math.abs(v))) as Vec3:undefined;
      updates[id]={position,...(rotation?{rotation}:{}),...(scale?{scale}:{})};
      if(position.some((v,i)=>Math.abs(v-o.position[i])>.001)||o.kind==='brush'&&(
        rotation?.some((v,i)=>Math.abs(v-o.rotation[i])>.001)||scale?.some((v,i)=>Math.abs(v-o.scale[i])>.001)))changed=true;
      const visual=visualGroups.get(id);
      if(visual){visual.position.copy(original.position);visual.quaternion.copy(original.quaternion);visual.scale.copy(original.scale)}
    }
    drag.current=null;
    updateMagneticGuide(null);
    pivot.current.position.copy(session.start);pivot.current.quaternion.copy(session.quat);pivot.current.scale.set(1,1,1);
    if(changed)transformSelection(updates);
  };
  return <>
    <group ref={pivot} position={pivotStart} quaternion={pivotQuaternion}/>
    <TransformControls ref={controls} object={pivot} mode={transformMode} onMouseDown={begin} onObjectChange={preview} onMouseUp={commit}
      space={localScale?'local':settings.gizmoSpace} showX showY showZ
      rotationSnap={settings.rotationSnapDegrees?THREE.MathUtils.degToRad(settings.rotationSnapDegrees):undefined}
      scaleSnap={settings.scaleSnapStep||undefined}
      size={Math.max(0.15,settings.gizmoSize)}/>
  </>;
}
/** Real Blender-like modal transform: the mouse drives all selected objects;
 * neither the camera nor the gizmo handles pointer motion during G/R/C.
 * Preview is transient; a single undoable project change is made on confirmation.
 * X/Y/Z constrain the global Svengine axes; numbers specify units/degrees/factor.
 */
function BlenderModalTransform(){
  const modal=useEditor(s=>s.modalTransform);
  const ids=useEditor(s=>s.selectedIds),objects=useEditor(s=>s.project.objects);
  const controls=useEditor(s=>s.controls),snapping=useEditor(s=>s.snapping),snap=useEditor(s=>s.snap);
  const transformSelection=useEditor(s=>s.transformSelection),complete=useEditor(s=>s.completeModalTransform);
  const {camera,gl,size}=useThree();
  const t=useT();
  const cursor=useRef<{x:number;y:number}|null>(null);
  const session=useRef<{
    start:{x:number;y:number};center:THREE.Vector3;mode:'translate'|'rotate'|'scale';
    original:Map<string,{position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3;kind:'brush'|'entity'}>;
    result:Map<string,{position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3}>;
    axis:'X'|'Y'|'Z'|null;numeric:string;
  }|null>(null);
  useEffect(()=>{
    const track=(e:PointerEvent)=>{cursor.current={x:e.clientX,y:e.clientY}};
    window.addEventListener('pointermove',track);
    return()=>window.removeEventListener('pointermove',track);
  },[]);
  useEffect(()=>{
    if(!modal)return;
    const rect=gl.domElement.getBoundingClientRect();
    const start=cursor.current??{x:rect.left+rect.width/2,y:rect.top+rect.height/2};
    const members=objects.filter(o=>ids.includes(o.id)&&!o.locked&&!o.hidden);
    if(!members.length){complete();return}
    const origin=new Map(members.map(o=>[o.id,{
      position:gameToThree(o.position),quaternion:o.kind==='brush'?toRenderQuaternion(o.rotation):new THREE.Quaternion(),
      scale:o.kind==='brush'?new THREE.Vector3(o.scale[0],o.scale[2],o.scale[1]):new THREE.Vector3(1,1,1),kind:o.kind
    }]));
    const center=new THREE.Vector3();for(const o of origin.values())center.add(o.position);center.multiplyScalar(1/origin.size);
    const originalCenter=center.clone();
    let anchor=useEditor.getState().scaleAnchor;
    const single=members.length===1?members[0]:null;
    const snapCache=modal.mode==='translate'&&controls.smartSnapEnabled?createSmartSnapCache(members,objects):null;
    const updateScalePivot=(anchorMode:typeof anchor)=>{
      center.copy(originalCenter);
      if(modal.mode==='scale'&&anchorMode!=='center'){
        if(single?.kind==='brush')center.copy(anchorPosition(single,anchorMode));
        else if(members.length>1){
          const bounds=new THREE.Box3();for(const o of members){
            if(o.kind==='brush')for(const point of transformedVertices(o))bounds.expandByPoint(gameToThree(point));
            else bounds.expandByPoint(gameToThree(o.position));
          }
          const axis=anchorMode[0]==='x'?0:anchorMode[0]==='y'?2:1;
          center.setComponent(axis,anchorMode.endsWith('min')?bounds.min.getComponent(axis):bounds.max.getComponent(axis));
        }
      }
    };
    updateScalePivot(anchor);
    const data:{start:typeof start;center:THREE.Vector3;mode:'translate'|'rotate'|'scale';original:typeof origin;
      result:Map<string,{position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3}>;axis:'X'|'Y'|'Z'|null;numeric:string}=
      {start,center,mode:modal.mode,original:origin,result:new Map(),axis:null,numeric:''};
    session.current=data;
    let finished=false,committed=false;
    let pressed:ModifierKeys={...EMPTY_MODIFIERS};
    const axisVector=()=>data.axis==='X'?new THREE.Vector3(1,0,0):data.axis==='Y'?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
    const hud=()=>document.getElementById('studio-modal-readout');
    const preview=(current:{x:number;y:number},keys:ModifierKeys=pressed)=>{
      pressed=keys;
      const gesture=transformGesture(data.mode,keys,controls,snapping,!!data.axis);
      if(session.current!==data)return;
      const dx=(current.x-data.start.x)*gesture.fine,dy=(data.start.y-current.y)*gesture.fine;
      const unitPerPixel=camera instanceof THREE.OrthographicCamera
        ?(camera.top-camera.bottom)/Math.max(1,size.height)/camera.zoom
        :2*Math.max(50,camera.position.distanceTo(data.center))*Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov)/2)/Math.max(1,size.height);
      const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
      const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      const delta=right.multiplyScalar(dx*unitPerPixel).addScaledVector(up,dy*unitPerPixel);
      let numberValue=Number(data.numeric);
      if(!Number.isFinite(numberValue)||data.numeric==='-'||data.numeric==='.')numberValue=0;
      const isNumeric=!!data.numeric&&data.numeric!=='-'&&data.numeric!=='.';
      let amount=0,trackballPitch=0,rotation=new THREE.Quaternion(),stretch=new THREE.Vector3(1,1,1);
      const axis=axisVector();
      if(data.mode==='translate'){
        if(gesture.vertical){
          amount=isNumeric?numberValue:dy*unitPerPixel;
          if(gesture.grid)amount=snapIncrement(amount,snap);
          delta.set(0,amount,0); // GoldSrc world Z is Three.js Y
        }else if(data.axis){
          const p1=data.center.clone().project(camera),p2=data.center.clone().addScaledVector(axis,100).project(camera);
          const width=Math.max(1,rect.width),height=Math.max(1,rect.height);
          const ax=(p2.x-p1.x)*width/2,ay=(p2.y-p1.y)*height/2;
          const denom=ax*ax+ay*ay;
          amount=denom>1e-4?100*(dx*ax+dy*ay)/denom:0;
          if(isNumeric)amount=numberValue;
          if(gesture.grid)amount=snapIncrement(amount,snap);
          delta.copy(axis).multiplyScalar(amount);
        }else if(isNumeric){delta.normalize().multiplyScalar(numberValue)}
        if(gesture.grid&&!data.axis&&!gesture.vertical){
          const g=threeToGame(delta).map(n=>Math.round(n/snap)*snap) as Vec3;
          delta.copy(gameToThree(g));
        }
        const axes:SnapAxes=data.axis==='X'?[true,false,false]:data.axis==='Y'?[false,true,false]:data.axis==='Z'||gesture.vertical?[false,false,true]:[true,true,true];
        // Numeric transforms must remain exact; Shift temporarily releases magnetism.
        const snapped=snapCache&&!keys.shift&&!isNumeric
          ?resolveSmartSnap(snapCache,threeToGame(delta),smartSnapWorldTolerance(camera,camera.position.distanceTo(data.center),size.height,controls.smartSnapPixels),controls.smartSnapMode,axes)
          :null;
        updateMagneticGuide(snapped);
        if(snapped)delta.copy(gameToThree(snapped.delta));
      }else if(data.mode==='rotate'){
        // Alt + mouse: two-axis virtual trackball, not the view-axis-only turn.
        // X/Y/Z overrides Alt and keeps the explicit world-axis constraint.
        amount=isNumeric?numberValue:dx*.45;
        if(gesture.trackball){
          const yaw=snapIncrement(amount,gesture.degrees);
          const pitch=snapIncrement(isNumeric?0:dy*.45,gesture.degrees);
          trackballPitch=pitch;
          const viewUp=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
          const viewRight=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
          rotation.setFromAxisAngle(viewUp,THREE.MathUtils.degToRad(yaw));
          rotation.multiply(new THREE.Quaternion().setFromAxisAngle(viewRight,THREE.MathUtils.degToRad(pitch)));
          amount=yaw;
        }else{
          const rotateAxis=data.axis?axis:new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
          amount=snapIncrement(amount,gesture.degrees);
          rotation.setFromAxisAngle(rotateAxis,THREE.MathUtils.degToRad(amount));
        }
      }else{
        amount=isNumeric?numberValue:Math.exp((dx+dy)*.006);
        amount=Math.max(.05,Math.min(100,amount));
        if(gesture.factorStep)amount=Math.max(.05,snapIncrement(amount,gesture.factorStep));
        if(data.axis)stretch.set(data.axis==='X'?amount:1,data.axis==='Z'?amount:1,data.axis==='Y'?amount:1);
        else stretch.setScalar(amount);
      }
      const scalePivot=gesture.centered?originalCenter:data.center;
      const scaleAnchor=gesture.centered?'center':anchor;
      data.result.clear();
      for(const [id,pose] of data.original){
        const position=pose.position.clone(),quaternion=pose.quaternion.clone(),scale=pose.scale.clone();
        if(data.mode==='translate')position.add(delta);
        else {
          position.sub(data.mode==='scale'?scalePivot:data.center);
          if(data.mode==='rotate'){position.applyQuaternion(rotation);quaternion.premultiply(rotation)}
          else if(single?.kind==='brush'){
            // Brush-local scale about the selected fixed face, including rotated walls.
            const scaleFactor=scaleAnchor!=='center'&&gesture.grid?snapBrushScaleFactors(single,pose.scale,stretch,snap):stretch;
            position.copy(anchoredPose(pose.position,pose.quaternion,scalePivot,scaleFactor));scale.multiply(scaleFactor);
            data.result.set(id,{position,quaternion,scale});
            const visual=visualGroups.get(id);
            if(visual){visual.position.copy(position);visual.quaternion.copy(quaternion);visual.scale.copy(scale)}
            continue;
          }
          else {position.multiply(stretch);scale.multiply(stretch)}
          position.add(data.mode==='scale'?scalePivot:data.center);
        }
        data.result.set(id,{position,quaternion,scale});
        const visual=visualGroups.get(id);
        if(visual){visual.position.copy(position);visual.quaternion.copy(quaternion);visual.scale.copy(scale)}
      }
      const indicator=document.getElementById('studio-modal-modifiers');
      if(indicator)indicator.textContent=[keys.shift?t('Fine'):null,keys.ctrl?t('Snap'):null,
        currentMagneticGuide?t('Magnetic')+' · '+t(currentMagneticGuide.kind==='surface'||currentMagneticGuide.kind==='face'?'Face':currentMagneticGuide.kind==='vertex'?'Vertex':'Edge'):null,
        keys.alt?t(data.mode==='translate'?'Vertical move (Z)':data.mode==='rotate'?'Trackball rotation':'Center scale'):null]
        .filter(Boolean).join(' · ')||t('Normal drag');
      const readout=hud();if(readout)readout.textContent=`${data.axis?data.axis+' · ':''}${isNumeric?data.numeric:data.mode==='translate'?threeToGame(delta).map(v=>v.toFixed(0)).join(' / ')+' u':data.mode==='rotate'?(gesture.trackball?amount.toFixed(1)+'° / '+trackballPitch.toFixed(1)+'°':amount.toFixed(1)+'°'):amount.toFixed(2)+'×'}`;
    };
    // Subscribe directly to confirmation. Delaying this to a React effect
    // let the preview cleanup restore the brush before the first click was
    // committed, forcing users to perform G/R/C a second time.
    const unsubscribe=useEditor.subscribe((state)=>{
      if(!finished&&modal.mode==='scale'&&state.scaleAnchor!==anchor){
        anchor=state.scaleAnchor;
        updateScalePivot(anchor);
        preview(cursor.current??data.start,pressed);
      }
      if(finished||!state.modalFinish||!state.modalTransform||state.modalTransform.serial!==modal.serial)return;
      finished=true;
      const commit=state.modalFinish.commit;
      committed=commit;
      if(commit){
        const updates:Record<string,{position:Vec3;rotation?:Vec3;scale?:Vec3}>={};
        for(const [id,pose] of data.result){
          const original=data.original.get(id);if(!original)continue;
          const position=threeToGame(pose.position);
          const originalPosition=threeToGame(original.position);
          const changed=position.some((v,i)=>Math.abs(v-originalPosition[i])>.0001)||
            original.kind==='brush'&&(!pose.scale.equals(original.scale)||!pose.quaternion.equals(original.quaternion));
          if(!changed)continue;
          updates[id]={position};
          if(original.kind==='brush'){
            updates[id].rotation=fromRenderQuaternion(pose.quaternion);
            updates[id].scale=[Math.max(.05,pose.scale.x),Math.max(.05,pose.scale.z),Math.max(.05,pose.scale.y)];
          }
        }
        if(Object.keys(updates).length)transformSelection(updates);
      }
      complete();
    });
    const move=(e:PointerEvent)=>{preview({x:e.clientX,y:e.clientY},modifierKeys(e))};
    const key=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]'))return;
      if(['Shift','Control','Alt'].includes(e.key)){
        // A modifier can change the preview without any mouse movement.
        if(e.key==='Alt')e.preventDefault();
        preview(cursor.current??data.start,modifierKeys(e));return;
      }
      if(['KeyX','KeyY','KeyZ'].includes(e.code)&&!e.ctrlKey&&!e.altKey&&!e.repeat){
        e.preventDefault();data.axis=data.axis===e.code.slice(-1)?null:e.code.slice(-1) as 'X'|'Y'|'Z';
        preview(cursor.current??data.start,modifierKeys(e));return;
      }
      if(e.key==='Enter'){e.preventDefault();useEditor.getState().finishModalTransform(true);return}
      if(e.key==='Backspace'&&data.numeric){e.preventDefault();data.numeric=data.numeric.slice(0,-1);preview(cursor.current??data.start);return}
      if(!e.ctrlKey&&!e.altKey&&!e.metaKey&&/^[0-9.\-]$/.test(e.key)){
        e.preventDefault();if(e.key==='.'&&data.numeric.includes('.'))return;
        if(e.key==='-'&&data.numeric.length)return;
        data.numeric+=e.key;preview(cursor.current??data.start,modifierKeys(e));
      }
    };
    const keyRelease=(e:KeyboardEvent)=>{
      if(['Shift','Control','Alt'].includes(e.key))preview(cursor.current??data.start,modifierKeys(e));
    };
    const loseFocus=()=>{pressed={...EMPTY_MODIFIERS};preview(cursor.current??data.start,pressed)};
    const click=(e:PointerEvent)=>{
      if(!gl.domElement.contains(e.target as Node))return;
      if(e.button===0||e.button===2){e.stopImmediatePropagation();e.preventDefault();useEditor.getState().finishModalTransform(e.button===0)}
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('keydown',key);
    window.addEventListener('keyup',keyRelease);
    window.addEventListener('blur',loseFocus);
    window.addEventListener('pointerdown',click,true);
    preview(start);
    return()=>{
      updateMagneticGuide(null);
      unsubscribe();
      window.removeEventListener('pointermove',move);
      window.removeEventListener('keydown',key);
      window.removeEventListener('keyup',keyRelease);
      window.removeEventListener('blur',loseFocus);
      window.removeEventListener('pointerdown',click,true);
      // Restore only on cancel or aborted session. A committed pose is now
      // owned by the store and must never be overwritten by a stale snapshot.
      if(!committed){
        for(const [id,pose] of data.original){const visual=visualGroups.get(id);if(visual){visual.position.copy(pose.position);visual.quaternion.copy(pose.quaternion);visual.scale.copy(pose.scale)}}
      }
      if(session.current===data)session.current=null;
    };
  // Every modal session captures its own original objects; don't recreate it as the mouse moves.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[modal?.serial,camera,gl]);
  return null;
}

/** Draw brushes on the XY, XZ or YZ construction plane; X/Y/Z switch planes. */
function DrawBrushPlane(){
  const enabled=useEditor(s=>s.drawMode),height=useEditor(s=>s.drawHeight),plane=useEditor(s=>s.drawPlane),sign=useEditor(s=>s.drawSign);
  const add=useEditor(s=>s.addDrawnBox),snapping=useEditor(s=>s.snapping),snap=useEditor(s=>s.snap);
  const dragStart=useRef<Vec3|null>(null);
  const [end,setEnd]=useState<Vec3|null>(null);
  const {camera,scene,gl}=useThree();
  const lastCursor=useRef<{x:number;y:number}|null>(null);
  const workplaneZ=useEditor(s=>s.universalPlacement.planeZ);
  const [planeOffset,setPlaneOffset]=useState(()=>useEditor.getState().universalPlacement.planeZ);
  useEffect(()=>{if(enabled&&plane==='xy')setPlaneOffset(workplaneZ)},[workplaneZ,enabled,plane]);
  useEffect(()=>{
    if(!enabled)return;
    const onKey=(event:KeyboardEvent)=>{
      if(event.ctrlKey||event.altKey||event.metaKey||event.target instanceof HTMLInputElement||event.target instanceof HTMLTextAreaElement)return;
      if(['KeyX','KeyY','KeyZ'].includes(event.code)){
        event.preventDefault();event.stopImmediatePropagation();
        useEditor.getState().setDrawPlane(event.code==='KeyX'?'yz':event.code==='KeyY'?'xz':'xy');
        setPlaneOffset(event.code==='KeyZ'?useEditor.getState().universalPlacement.planeZ:0);dragStart.current=null;setEnd(null);
      }else if(event.code==='KeyF'&&lastCursor.current){
        const rect=gl.domElement.getBoundingClientRect(),cursor=lastCursor.current;
        const ray=new THREE.Raycaster();
        ray.setFromCamera(new THREE.Vector2((cursor.x-rect.left)/rect.width*2-1,-(cursor.y-rect.top)/rect.height*2+1),camera);
        const hit=ray.intersectObjects(scene.children,true).find(v=>v.object.userData.brushId);
        if(hit){
          const normal=hit.face?.normal?.clone().transformDirection(hit.object.matrixWorld).normalize()||new THREE.Vector3(0,1,0);
          const n=threeToGame(normal),point=threeToGame(hit.point);
          const axis=Math.abs(n[0])>Math.max(Math.abs(n[1]),Math.abs(n[2]))?0:Math.abs(n[1])>Math.abs(n[2])?1:2;
          useEditor.getState().setDrawPlane(axis===0?'yz':axis===1?'xz':'xy');
          useEditor.getState().setDrawSign(n[axis]>=0?1:-1);
          setPlaneOffset(point[axis]+n[axis]*.5);
          dragStart.current=null;setEnd(null);
          event.preventDefault();event.stopImmediatePropagation();
        }
      }
    };
    window.addEventListener('keydown',onKey,true);
    return()=>window.removeEventListener('keydown',onKey,true);
  },[enabled,camera,scene,gl]);
  const floorPoint=(v:THREE.Vector3):Vec3=>{
    const game=threeToGame(v),step=snapping?snap:1;
    const result=game.map(n=>Math.round(n/step)*step) as Vec3;
    result[plane==='xy'?2:plane==='xz'?1:0]=planeOffset;
    return result;
  };
  const from=dragStart.current;
  const previewPose=from&&end?(()=>{
    const snapped=(value:number)=>Math.round(value/(snapping?snap:1))*(snapping?snap:1);
    const a=from.map(snapped),b=end.map(snapped),orth=plane==='xy'?2:plane==='xz'?1:0;
    const center=a.map((v,i)=>(v+b[i])/2) as Vec3;
    const size=a.map((v,i)=>Math.max(snapping?snap:1,Math.abs(b[i]-v))) as Vec3;
    center[orth]=planeOffset+height/2*sign;size[orth]=height;
    return {center,size};
  })():null;
  return enabled? <>
    <mesh key={plane} rotation={plane==='xy'?[-Math.PI/2,0,0]:plane==='xz'?[0,0,0]:[0,Math.PI/2,0]}
      position={gameToThree(plane==='xy'?[0,0,planeOffset]:plane==='xz'?[0,planeOffset,0]:[planeOffset,0,0])}
      onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();dragStart.current=floorPoint(e.point);setEnd(dragStart.current);(e.target as unknown as Element | null)?.setPointerCapture?.(e.pointerId)}}
      onPointerMove={e=>{lastCursor.current={x:e.clientX,y:e.clientY};if(!dragStart.current)return;e.stopPropagation();setEnd(floorPoint(e.point))}}
      onPointerUp={e=>{if(!dragStart.current)return;e.stopPropagation();const final=floorPoint(e.point);const begin=dragStart.current;dragStart.current=null;setEnd(null);try{add(begin,final)}catch(err){useEditor.getState().appendLogs([`Draw block: ${String(err)}`])}(e.target as unknown as Element | null)?.releasePointerCapture?.(e.pointerId)}}
      onPointerCancel={()=>{dragStart.current=null;setEnd(null)}}>
      <planeGeometry args={[30000,30000]}/><meshBasicMaterial transparent opacity={.035} color="#6fbbff" side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>
    {previewPose&&<mesh position={gameToThree(previewPose.center)}>
      <boxGeometry args={[previewPose.size[0],previewPose.size[2],previewPose.size[1]]}/>
      <meshBasicMaterial color="#74c6ff" transparent opacity={.24} depthTest={false} depthWrite={false}/>
    </mesh>}
  </>:null;
}

export type PlacementHit={position:Vec3;normal:Vec3;autoYaw:number};
const MemoBrushVisual=memo(BrushVisual);
const MemoEntityVisual=memo(EntityVisual);
/** Entity-preview culling changes while the camera moves. Keep the complete
 * brush layer mounted and unchanged across those updates; individual brushes
 * still subscribe to editing, selection and material updates as before. */
/** HF17 HF1: Each chunk changes independently during selection and editing;
 * unmodified chunks keep the same GPU buffers and material instances.
 * Only opaque world brushes are batched. Every original brush mesh stays in
 * the scene as an invisible raycast target, preserving tool behavior.
 */
const MapBrushChunk=memo(function MapBrushChunk({brushes,optimizedLabels}:{brushes:readonly Brush[];optimizedLabels:boolean}){
  const ids=useMemo(()=>new Set(brushes.map(b=>b.id)),[brushes]);
  const selectedKey=useEditor(s=>s.selectedIds.filter(id=>ids.has(id)).join('\u001f'));
  const assets=useEditor(s=>s.textureAssets);
  const wadPriority=useEditor(s=>s.settings.wadPaths+'|'+s.project.wadNames.join(';'));
  const wireframe=useEditor(s=>s.wireframe);
  const solidShading=useEditor(s=>s.solidShading);
  const walkMode=useEditor(s=>s.walkMode);
  const shadows=useEditor(s=>s.environmentPreview&&s.previewShadows);
  const recovered=useEditor(s=>isRecoveredBspProject(s.project));
  const {goldsrc,hideRecoveryNull}=useContext(PreviewContext);
  const batchingEnabled=useStudioLayout(s=>s.opaqueBrushBatching);
  const sizes=useMemo(()=>textureSizeLookup(assets),[assets,wadPriority]);
  const nullFaces=useMemo(()=>brushes.reduce((count,brush)=>count+brush.faces.filter(face=>face.texture.trim().toUpperCase()==='NULL').length,0),[brushes]);
  const nullFacesHidden=recovered&&hideRecoveryNull&&!solidShading&&!wireframe;
  // Rebuild this chunk when an owning entity's render settings change (rendermode/renderamt/visibility).
  const entityIds=useMemo(()=>[...new Set(brushes.map(b=>b.entityId).filter((id):id is string=>!!id))],[brushes]);
  const entityKey=useEditor(s=>{if(!entityIds.length)return '';const m=entityLookup(s.project.objects);let k='';for(const id of entityIds){const e=m.get(id);k+=`${id}:${e?.classname}:${e?.props.rendermode??''}:${e?.props.renderamt??''}:${e?.hidden?1:0};`;}return k;});
  const batch=useMemo<BrushDrawBatchResult|null>(()=>{
    if(!batchingEnabled||walkMode||brushes.length<2)return null;
    const selected=new Set(selectedKey?selectedKey.split('\u001f'):[]);
    const entities=entityLookup(useEditor.getState().project.objects);
    const inputs=brushes.filter(b=>!selected.has(b.id)&&!b.hidden&&!(b.entityId&&selected.has(b.entityId))).map(brush=>({brush,
      materials:makeBrushMaterials(brush,assets,wireframe,brush.entityId?entities.get(brush.entityId):undefined,solidShading&&!walkMode,goldsrc,hideRecoveryNull,recovered)}));
    if(inputs.length<2)return null;
    return buildOpaqueBrushBatches(inputs,sizes);
  },[brushes,selectedKey,batchingEnabled,walkMode,wireframe,assets,wadPriority,sizes,solidShading,goldsrc.enabled,goldsrc.transparency,hideRecoveryNull,recovered,entityKey]);
  useEffect(()=>()=>{if(batch)disposeOpaqueBatches(batch)},[batch]);
  // HF17 HF3: report whether merging is actually active in this MAP. This is
  // read-only and is intentionally not a subscribed React/Zustand state.
  const diagnosticsId=useRef(Symbol('map-brush-chunk'));
  useEffect(()=>{
    updateBrushChunkReadout(diagnosticsId.current,{
      brushes:brushes.length,batchedBrushes:batch?.batchedIds.size??0,
      batchDrawMeshes:batch?.batches.length??0,sourceTriangles:batch?.sourceTriangles??0,
      eligibleForChunk:brushes.length>=2, batchingEnabled,
      nullFaces,hiddenNullFaces:nullFacesHidden?nullFaces:0,
    });
    return()=>clearBrushChunkReadout(diagnosticsId.current);
  },[brushes,batch,batchingEnabled,nullFaces,nullFacesHidden]);
  return <>
    {batch?.batches.map((b,i)=><mesh key={`opaque-${i}`} geometry={b.geometry} material={b.material}
      castShadow={shadows} receiveShadow={shadows} raycast={()=>null}/>) }
    {brushes.map(object=><MemoBrushVisual key={object.id} object={object} optimizedLabels={optimizedLabels} batched={batch?.fullyBatchedIds.has(object.id)??false} batchedFaces={batch?.batchedFaceIndices.get(object.id)}/>)}
  </>;
});
const MapBrushLayer=memo(function MapBrushLayer({brushes,optimizedLabels}:{brushes:readonly Brush[];optimizedLabels:boolean}){
  // 96 world brushes per draw group balances draw calls against frustum culling
  // and avoids rebuilding the entire map when one brush is edited or selected.
  const previousChunks=useRef<Map<string,Brush[]>>(new Map());
  const chunks=useMemo(()=>{
    const next=spatialBrushChunks(brushes,previousChunks.current);
    previousChunks.current=new Map(next.map(c=>[c.key,c.brushes]));
    return next;
  },[brushes]);
  return <>{chunks.map(chunk=><MapBrushChunk key={chunk.key} brushes={chunk.brushes} optimizedLabels={optimizedLabels}/>)}</>;
});
/** The map's real skyname cube behind the editor view (optional, from Quick actions). */
function EditorSkybox(){
  const enabled=useEditor(s=>!!s.settings.editorSkybox);
  const skyname=useEditor(s=>s.project.world.skyname);
  const gameDir=useEditor(s=>s.settings.gameDir);
  const onStatus=useCallback((status:string)=>useEditor.setState({editorSkyStatus:status}),[]);
  useEffect(()=>{if(!enabled)useEditor.setState({editorSkyStatus:'off'});},[enabled]);
  if(!enabled)return null;
  return <SkyboxBackground skyname={skyname} gameDir={gameDir} onStatus={onStatus}/>;
}
function Scene({onContextMenu}:{onContextMenu:(menu:SceneMenu)=>void}){
  const {goldsrc,walk}=useContext(PreviewContext);
  const displayTheme=viewportTheme(useStudioLayout(s=>s.viewportTheme));
  const objects=useEditor(s=>s.project.objects),setSelected=useEditor(s=>s.setSelected);
  const architectureMode=useArchitectureMode(s=>s.mode);
  const {camera:sceneCamera,gl:sceneGl,size:sceneSize}=useThree();
  const axes=useHudLayout(s=>s.items.axes);
  const axesGlobalOpacity=useHudLayout(s=>s.globalOpacity);
  const axesRef=useRef<THREE.Group>(null);
  useEffect(()=>{
    axesRef.current?.traverse(obj=>{
      const mesh=obj as THREE.Mesh;
      const materials=mesh.material?(Array.isArray(mesh.material)?mesh.material:[mesh.material]):[];
      for(const material of materials){
        const data=material.userData as {hudOpacityBase?:number};
        if(data.hudOpacityBase===undefined)data.hudOpacityBase=material.opacity;
        material.transparent=true;material.opacity=data.hudOpacityBase*axes.opacity*axesGlobalOpacity;material.needsUpdate=true;
      }
    });
  },[axes.opacity,axesGlobalOpacity,axes.visible]);
  const showLights=useEditor(s=>s.showLights);
  const walkMode=useEditor(s=>s.walkMode);
  const editorLighting=useEditor(s=>s.environmentPreview);
  const environmentPreview=walkMode?walk.rendered:editorLighting;
  const fogPreview=useEditor(s=>s.fogPreview);
  const skyname=useEditor(s=>s.project.world.skyname||'desert');
  const ghostHidden=useEditor(s=>s.ghostHidden);
  const focusHiddenId=useEditor(s=>s.focusHiddenId);
  const fogEntity=objects.find((o):o is PointEntity=>o.kind==='entity'&&o.classname==='env_fog'&&!o.hidden&&!(Number(o.props.spawnflags||0)&1));
  const fogStart=Number(fogEntity?.props.iuser2)||256,fogEnd=Number(fogEntity?.props.iuser3)||2048;
  const fogColor=fogEntity?rgbHex((fogEntity.props.rendercolor||'115 141 176').split(/\s+/).map(Number)):'#0b1325';
  const routeSolo=useEditor(s=>s.routeSolo);
  const selectedId=useEditor(s=>s.selected);
  const selectedIds=useEditor(s=>s.selectedIds);
  const showEntityNames=useEditor(s=>s.showEntityNames);
  const appearance=useEditor(s=>s.entityAppearance);
  const mapLabelSettings=useEditor(s=>s.mapLabelSettings);
  const fpsHudVisible=useHudLayout(s=>s.items.fps.visible);
  const optimizedLabels=mapLabelSettings.mode==='optimized';
  const cinematicPlacementFor=useEditor(s=>s.cinematicPlacementFor);
  const organization=useMemo(()=>organizeScene(objects),[objects]);
  const preset=useStudioLayout(s=>s.performancePreset||'balanced');
  // One state update per culling pass, instead of three scene renders.
  const [previewSets,setPreviewSets]=useState<PreviewSets>(()=>({labels:new Set(),lights:new Set(),models:new Set()}));
  const {labels:visibleLabels,lights:activeLights,models:activeModels}=previewSets;
  const lastCull=useRef(-1);
  const lastCullCamera=useRef(new THREE.Vector3(Infinity,Infinity,Infinity));
  const previousSegments=useRef<ReturnType<typeof groupMapRenderSegments>>([]);
  const brushes=useMemo(()=>objects.filter((o):o is Brush=>o.kind==='brush'),[objects]);
  const entityObjects=useMemo(()=>objects.filter((o):o is PointEntity=>o.kind==='entity'),[objects]);
  // v2.4: ALL brushes go to one layer (then spatial chunks) instead of one layer per run of consecutive
  // brushes. Imported/recovered maps interleave entities and brushes, which produced thousands of tiny
  // runs below the batching threshold, i.e. thousands of individual draw calls.
  const renderSegments=useMemo(()=>{
    const next=reuseMapRenderSegments(previousSegments.current,groupMapRenderSegments([...brushes,...entityObjects]));
    previousSegments.current=next;
    return next;
  },[brushes,entityObjects]);
  const entities=useMemo(()=>objects.filter((o):o is PointEntity=>o.kind==='entity'&&!o.hidden),[objects]);
  const spawnGrounds=useMemo(()=>{
    const spawns=entities.filter(e=>e.classname==='info_player_start');
    if(!spawns.length)return new Map<string,number>();
    // A single spawn is cheaper with the original routine; shared geometry
    // indexing pays off when a large co-op map contains multiple spawns.
    const floorAt=spawns.length>2?createSpawnFloorIndex(objects):(position:Vec3)=>spawnFloorZ(position,objects);
    return new Map(spawns.map(e=>[e.id,floorAt(e.position)]));
  },[entities,objects]);
  // Cache editor-to-Three coordinate conversions when project data changes.
  // With thousands of entities this avoids allocating vectors on each cull tick.
  const cullCandidates=useMemo(()=>entities.map(entity=>({entity,point:gameToThree(entity.position)})),[entities]);
  const lastCullInputs=useRef<{candidates:typeof cullCandidates|null;preset:string;optimizedLabels:boolean}>({candidates:null,preset:'',optimizedLabels:false});
  const routeLookup=useMemo(()=>{
    const lookup=new Map<string,typeof organization.routes>();
    for(const route of organization.routes)for(const node of route.nodes){
      if(!lookup.has(node.id))lookup.set(node.id,[]);
      lookup.get(node.id)!.push(route);
    }
    return lookup;
  },[organization]);
  // Labels for point entities AND tied-brush entities use one virtualized DOM layer.
  // Keep the map, geometry, markers, FGD keyvalues and object ordering unchanged.
  // This memo changes only when map/selection/label settings change, not each frame.
  const mapLabelAnchors=useMemo<MapLabelAnchor[]>(()=>{
    if(!optimizedLabels||walkMode)return [];
    const anchors:MapLabelAnchor[]=[];
    const byEntity=new Map(objects.filter((o):o is PointEntity=>o.kind==='entity').map(o=>[o.id,o]));
    const selectedSet=new Set(selectedIds);
    for(const obj of objects){
      if(obj.hidden)continue;
      if(obj.kind==='brush'){
        if(!showEntityNames||!obj.entityId)continue;
        const linked=byEntity.get(obj.entityId);
        if(!linked)continue;
        const display=entityDisplayName(linked,[linked,obj]);
        const main=appearance.showClassname?(display===linked.classname?linked.classname:display+' · '+linked.classname):'';
        const targetname=appearance.showTargetname?linked.props.targetname:undefined;
        if(!main&&!targetname)continue;
        // BrushVisual originally places its Html at [0,46,0] inside the
        // brush's rotated/scaled group. Reproduce that world anchor precisely.
        const rotation=toRenderQuaternion(obj.rotation);
        const offset=new THREE.Vector3(0,46*obj.scale[2],0).applyQuaternion(rotation);
        anchors.push({id:`brush:${obj.id}`,position:gameToThree(obj.position).add(offset),classname:linked.classname,
          main,targetname,color:markerColorForEntity(linked.classname,appearance),selected:selectedSet.has(obj.id),spawn:false});
        continue;
      }
      if(routeSolo&&obj.classname==='path_waypoint'&&!(routeLookup.get(obj.id)||[]).some(r=>r.key===routeSolo))continue;
      const showMarker=showLights||obj.classname==='info_player_start'||['ambient_generic','ambient_music','env_sound'].includes(obj.classname)
        ||!!(obj.group?.startsWith('Cinematic:')&&(obj.id===selectedId||cinematicPlacementFor));
      if(!showMarker)continue;
      const spawn=obj.classname==='info_player_start',selected=selectedSet.has(obj.id);
      if(!showEntityNames&&!(spawn&&appearance.alwaysShowSpawn))continue;
      if(obj.classname==='path_waypoint'&&!routeSolo&&!selected)continue;
      const routes=routeLookup.get(obj.id)||[],first=routes[0];
      const number=first?first.nodes.findIndex(n=>n.id===obj.id)+1:0;
      const classname=obj.classname==='path_waypoint'?(first?`WP ${number} · ${first.name}${routes.length>1?' (shared)':''}`:'WP · unassigned'):(obj.classname||obj.name);
      const alias=obj.name?.trim()&&obj.name.trim()!==obj.classname&&obj.classname!=='path_waypoint'?obj.name.trim()+' · '+classname:classname;
      const main=(appearance.showClassname||spawn&&appearance.alwaysShowSpawn)?alias:'';
      const targetname=appearance.showTargetname?obj.props.targetname:undefined;
      if(!main&&!targetname)continue;
      const offset=spawn?64:45;
      anchors.push({id:obj.id,position:gameToThree([obj.position[0],obj.position[1],obj.position[2]+offset]),
        classname,main,targetname,color:appearance.colorMode==='uniform'?appearance.uniformColor:first?routeColor(first.name):markerColorForEntity(obj.classname,appearance),selected,spawn});
    }
    return anchors;
  },[optimizedLabels,walkMode,objects,selectedIds,selectedId,showEntityNames,appearance,routeSolo,routeLookup,showLights,cinematicPlacementFor]);
  // Throttled camera-distance budgets. HTML overlays, loaded studio models and
  // realtime lights are by far the most expensive items on very large maps.
  // The map itself is NEVER culled or modified; only editor previews are.
  useFrame(({camera,clock})=>{
    if(clock.elapsedTime-lastCull.current<.65)return;
    const origin=camera.position;
    // When camera, project entities and performance preset are unchanged, skip
    // rebuilding distance-sorted sets every 650ms. Recheck periodically.
    const stable=lastCullInputs.current.candidates===cullCandidates&&lastCullInputs.current.preset===preset&&lastCullInputs.current.optimizedLabels===optimizedLabels
      &&lastCullCamera.current.distanceToSquared(origin)<64;
    if(stable&&clock.elapsedTime-lastCull.current<5)return;
    lastCull.current=clock.elapsedTime;
    lastCullCamera.current.copy(origin);
    lastCullInputs.current={candidates:cullCandidates,preset,optimizedLabels};
    const next=selectMapPreviewBudget(cullCandidates,origin,preset,optimizedLabels);
    setPreviewSets(previous=>samePreviewSets(previous,next)?previous:next);
  });
  return <>
    {environmentPreview?<color attach="background" args={[skyPreviewColor(skyname)]}/>:<ThemeBackground top={displayTheme.top} bottom={displayTheme.bottom}/>}
    <fog attach="fog" args={environmentPreview&&fogPreview&&fogEntity&&fogEnd>fogStart?[fogColor,fogStart,fogEnd]:['#0b1325',1500,8000]}/>
    <ambientLight intensity={environmentPreview?.09+(goldsrc.enabled?goldsrc.ambientFill*.35:0):1.5+(goldsrc.enabled?goldsrc.ambientFill:0)}/><hemisphereLight args={['#b9d6ee','#495764',environmentPreview?.09:1.1]}/>
    <directionalLight position={[600,1100,550]} intensity={environmentPreview?.04:2.2}/>
    <GoldSrcPreviewAnimator/><WalkFlashlight/>
    {!walkMode&&<Ground/>}
    {!walkMode&&<ArchitectureDrawingPlane/>}
    {!walkMode&&<ArchitectureCornerHandles/>}
    {!walkMode&&<><DrawBrushPlane/><UniversalHoverProbe/><UniversalPlacementGuide/><PrimitivePlacement/><PrefabClickPlacement/><EnvironmentPlacement/><NpcClickPlacement/><AudioClickPlacement/><CinematicClickPlacement/><TerrainClickPlacement/><BlueprintClickPlacement/><CSMapClickPlacement/><CSMapMarkers/><TextureDropHandler/><ContextHitProbe open={onContextMenu}/></>}
    {!walkMode&&<mesh rotation={[-Math.PI/2,0,0]} position={[0,-.5,0]} onPointerDown={e=>{
      if(useArchitectureMode.getState().mode!=='off')return;
      if(pointerOnSelectedGizmo(e))return;
      const state=useEditor.getState();
      if(state.measureMode){e.stopPropagation();state.measurePoint(threeToGame(e.point));return}
      if(state.showTransformGizmo&&state.selectedIds.length){
        const selected=state.project.objects.filter(obj=>state.selectedIds.includes(obj.id));
        const center=selected.reduce((point,obj)=>point.add(gameToThree(obj.position)),new THREE.Vector3()).divideScalar(Math.max(1,selected.length));
        const ndc=center.project(sceneCamera),rect=sceneGl.domElement.getBoundingClientRect();
        const dx=e.clientX-(rect.left+(ndc.x+1)*rect.width/2);
        const dy=e.clientY-(rect.top+(1-ndc.y)*rect.height/2);
        // A missed handle near the gizmo should never deselect the brush.
        if(dx*dx+dy*dy<100*100){e.stopPropagation();return}
      }
      if(!state.faceMode&&state.geometryMode==='object'&&(state.entityAppearance.markerOcclusion==='xray'||e.altKey)
        &&selectOccludedEntity(e.intersections,e.shiftKey||e.ctrlKey||e.metaKey)){
        e.stopPropagation();return;
      }
      // Shift on empty space must never erase a multi-object selection.
      if(e.shiftKey||e.ctrlKey||e.metaKey)return;
      setSelected(null);
    }}><planeGeometry args={[20000,20000]}/><meshBasicMaterial visible={false}/></mesh>}
    {!walkMode&&brushes.filter(obj=>!!obj.hidden&&(ghostHidden||obj.id===focusHiddenId)).map(obj=><GhostBrush key={`ghost-${obj.id}`} object={obj}/>)}
    {!walkMode&&fpsHudVisible&&<MapPerformanceMonitor/>}
    {optimizedLabels&&!walkMode&&<MapEntityLabelOverlay anchors={mapLabelAnchors} appearance={appearance} settings={mapLabelSettings}/>}
    {renderSegments.map((segment,index)=>segment.kind==='brush'
      ?<MapBrushLayer key={`brush-run-${index}`} brushes={segment.objects} optimizedLabels={optimizedLabels}/>
      :segment.objects.map(obj=>{if(obj.classname==='infodecal')return <DecalVisual key={obj.id} object={obj}/>;
      const routes=routeLookup.get(obj.id)||[];
      if(routeSolo&&obj.classname==='path_waypoint'&&!routes.some(r=>r.key===routeSolo))return null;
      if(architectureMode!=='off')return null;
      const isLightSource=obj.classname==='light'||obj.classname==='light_spot'||obj.classname==='light_environment';
      const showMarker=!walkMode&&(showLights||obj.classname==='info_player_start'||['ambient_generic','ambient_music','env_sound'].includes(obj.classname)||(obj.group?.startsWith('Cinematic:')&&(obj.id===selectedId||!!useEditor.getState().cinematicPlacementFor)));
      const lightActive=activeLights.has(obj.id)||obj.id===selectedId||obj.classname==='light_environment';
      const modelCandidate=walkMode&&walk.showModels&&(obj.classname.startsWith('monster_')||obj.props.model?.startsWith('models/')||!!useEditor.getState().fgdClasses.find(c=>c.name===obj.classname)?.studio);
      if(!showMarker&&!modelCandidate&&!(environmentPreview&&isLightSource&&lightActive))return null;
      const first=routes[0];const number=first?first.nodes.findIndex(n=>n.id===obj.id)+1:0;
      const routeText=obj.classname==='path_waypoint'?(first?`WP ${number} · ${first.name}${routes.length>1?' (shared)':''}`:'WP · unassigned'):undefined;
      return <MemoEntityVisual key={obj.id} object={obj} routeText={routeText} routeTint={first?routeColor(first.name):undefined} hideLabel={optimizedLabels||!visibleLabels.has(obj.id)||(obj.classname==='path_waypoint'&&!routeSolo&&obj.id!==selectedId)} activeLight={lightActive} activeModel showMarker={showMarker} optimizedLabels={optimizedLabels} spawnGround={spawnGrounds.get(obj.id)}/>;
    }))}
    {!walkMode&&<><NavigatorFocusOutline/><MapPathEditControls/><BuildTogetherSelections/><RemoteBuildTogetherCameras/></>}
    <LeakTrace3D/><CompileRegionBox/><PlayerClearanceOverlay/><EntityMarkerCuller/><EditorSkybox/>
    {!walkMode&&<CoopGhostOverlay/>}
    {!walkMode&&<EntityMotionPreview3D/>}
    {!walkMode&&<><MeasurementOverlay/><EntityConnections/><NpcRouteLines/><CinematicRouteLines/><AudioRadiusGuides/><MagneticSnapGuide/><SelectionTransformControls/><BlenderModalTransform/></>}
    <CameraController/>
    {!walkMode&&<ShiftObjectSelectionBridge/>}
    {!walkMode&&axes.visible&&<GizmoHelper alignment="top-left" margin={[sceneSize.width*axes.x/100,sceneSize.height*axes.y/100]}>
      <group ref={axesRef} scale={axes.scale}><GizmoViewport axisColors={['#f46e78','#84d899','#73b8ff']} labelColor="white"/></group>
    </GizmoHelper>}
  </>;
}
/** Dimension fields are independent from gizmo hit testing, so a 4u brush
 * can always be resized precisely without accidentally dragging another face. */
function PreciseScalePanel(){
  const t=useT();
  const mode=useEditor(s=>s.mode),ids=useEditor(s=>s.selectedIds),objects=useEditor(s=>s.project.objects);
  const resize=useEditor(s=>s.changeDimensions);
  const brush=mode==='scale'&&ids.length===1?objects.find((obj):obj is Brush=>obj.id===ids[0]&&obj.kind==='brush'&&!obj.locked&&!obj.hidden):undefined;
  if(!brush)return null;
  const size=brushDimensions(brush);
  const change=(i:number,value:number)=>{
    if(!Number.isFinite(value)||value<1||value>131072)return;
    const next=[...size] as Vec3;next[i]=value;
    try{resize(brush.id,next)}catch(error){window.alert(String(error))}
  };
  return <div className="precise-scale-panel" onPointerDown={e=>e.stopPropagation()} onKeyDown={e=>e.stopPropagation()}>
    <div className="precise-scale-title">{t('Precise brush dimensions')}<span>{t('GoldSrc units')}</span></div>
    <div className="precise-scale-fields">{(['Shape width','Shape depth','Shape height'] as const).map((label,i)=><label key={`${brush.id}:${i}`}>
      {t(label)}<input type="number" min="1" max="131072" step="1" key={`${brush.id}:${i}:${size[i]}`}
        defaultValue={Number(size[i].toFixed(3))} aria-label={t(label)}
        onBlur={e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&Math.abs(n-size[i])>.0001)change(i,n)}}
        onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur()}}/>
    </label>)}</div>
    <div className="precise-scale-hint">{t('Face arrows stay readable at any zoom. Hold Shift to scale finely without snapping.')}</div>
  </div>;
}

export function Viewport({trueLightingOpen=false,trueLightingBusy=false,onVisualizationMode}:{
  trueLightingOpen?:boolean;trueLightingBusy?:boolean;
  onVisualizationMode?:(mode:'normal'|'quick'|'baked')=>void;
}={}){
  const t=useT();
  const locale=useEditor(s=>s.locale);const guide=studioGuide(locale);
  const cinematicPlacementFor=useEditor(s=>s.cinematicPlacementFor);
  const csMapPlacement=useCSMapPlacement(s=>s.request);
  const activeDecalForHud=useEditor(s=>s.activeDecal);
  const doctorTrace=useMapDoctorState(s=>s.trace),doctorTraceVisible=useMapDoctorState(s=>s.traceVisible),setDoctorTraceVisible=useMapDoctorState(s=>s.setTraceVisible);
  const [walkSettings,setWalkSettings]=useState(()=>readPreviewSettings('walk-preview-2',normalizeWalkPreview));
  const [goldsrcSettings,setGoldsrcSettings]=useState(()=>readPreviewSettings('goldsrc-preview-2',normalizeGoldSrcPreview));
  // Hide NULL tool materials in a recovered MAP preview without altering brushes.
  const [hideRecoveryNull,setHideRecoveryNull]=useState(true);
  const gameplaySession=useRef<GameplaySession|null>(null);
  const [gameplayMessage,setGameplayMessage]=useState('');
  const [walkStats,setWalkStats]=useState<WalkStats>({position:[0,0,0],speed:0,grounded:false,crouched:false,noclip:false});
  const [showPreviewOptions,setShowPreviewOptions]=useState(false);
  const updateWalk=useCallback((patch:Partial<WalkPreviewSettings>)=>setWalkSettings(s=>normalizeWalkPreview({...s,...patch})),[]);
  const updateGoldSrc=useCallback((patch:Partial<GoldSrcPreviewSettings>)=>setGoldsrcSettings(s=>normalizeGoldSrcPreview({...s,...patch})),[]);
  useEffect(()=>{
    const onToggle=()=>{if(!useEditor.getState().walkMode)setShowPreviewOptions(v=>!v)};
    document.addEventListener('svenstudio:toggle-gameplay-settings',onToggle);
    return ()=>document.removeEventListener('svenstudio:toggle-gameplay-settings',onToggle);
  },[]);
  useEffect(()=>savePreviewSettings('walk-preview-2',walkSettings),[walkSettings]);
  useEffect(()=>savePreviewSettings('goldsrc-preview-2',goldsrcSettings),[goldsrcSettings]);
  const previewContext=useMemo(()=>({hideRecoveryNull,walk:walkSettings,goldsrc:goldsrcSettings,gameplaySession,reportGameplay:setGameplayMessage,updateWalk,updateGoldSrc,reportWalk:setWalkStats}),[hideRecoveryNull,walkSettings,goldsrcSettings,updateWalk,updateGoldSrc]);

  // The WebGL layer compensates the workspace zoom; subscribe in this component
  // rather than borrowing the uiScale local used inside BrushVisual.
  const uiScale=useStudioLayout(s=>Number.isFinite(s.uiScale)&&s.uiScale>0?s.uiScale:1);
  const perfPreset=useStudioLayout(s=>s.performancePreset||'balanced');
  const viewportPixelRatio=useStudioLayout(s=>s.viewportPixelRatio||0);
  // v2.5: while a full-screen studio covers the editor, the 3D view stops rendering (it is not visible anyway).
  const viewportPaused=useEditor(s=>s.viewportPaused);
  const compactTools=useStudioLayout(s=>s.compactTools!==false);
  const hudEditing=useHudLayout(s=>s.editing);
  const mode=useEditor(s=>s.mode),faceMode=useEditor(s=>s.faceMode);
  const measureMode=useEditor(s=>s.measureMode),measurement=useEditor(s=>s.measurement);
  const modal=useEditor(s=>s.modalTransform);
  const cameraLabel=useEditor(s=>s.cameraLabel),controls=useEditor(s=>s.controls),flyMode=useEditor(s=>s.flyMode),walkMode=useEditor(s=>s.walkMode);
  useEffect(()=>{if(walkMode){useArchitectureMode.getState().cancel();useArchitectureMode.getState().edit(null)}},[walkMode]);
  const projection=useEditor(s=>s.issueCameraCommand);
  const count=useEditor(s=>s.project.objects.length);
  const [contextMenu,setContextMenu]=useState<SceneMenu|null>(null);
  const rightGesture=useRef<{x:number;y:number;at:number;moved:boolean}|null>(null);
  const placementCanvasRef=useRef<HTMLDivElement>(null);
  const [walkCaptured,setWalkCaptured]=useState(false);
  useEffect(()=>{
    const sync=()=>{
      const captured=document.pointerLockElement===document.querySelector('.viewport-frame canvas');
      setWalkCaptured(captured);
    };
    document.addEventListener('pointerlockchange',sync);sync();
    return()=>document.removeEventListener('pointerlockchange',sync);
  },[]);
  const openMenu=useCallback((menu:SceneMenu)=>setContextMenu(menu),[]);
  const closeMenu=useCallback(()=>setContextMenu(null),[]);
  // Explorer rows and the 3D canvas share the same editor-native context menu.
  useEffect(()=>{
    const onExplorer=(event:Event)=>setContextMenu((event as CustomEvent<SceneMenu>).detail);
    document.addEventListener('svenstudio:explorer-context',onExplorer);
    return()=>document.removeEventListener('svenstudio:explorer-context',onExplorer);
  },[]);
  const placementShape=useEditor(s=>s.placementShape);
  const placementPrefabId=useEditor(s=>s.placementPrefabId);
  const placementPrefabName=useEditor(s=>s.prefabs.find(p=>p.id===s.placementPrefabId)?.name||'');
  const placementAxis=useEditor(s=>s.placementAxis),placementAngle=useEditor(s=>s.placementAngle);
  const placementAutoAlign=useEditor(s=>s.placementAutoAlign),placementRepeat=useEditor(s=>s.placementRepeat);
  const terrainPlacement=useEditor(s=>s.terrainPlacement);
  const pathEditingId=useEditor(s=>s.pathEditingId);
  const pathEditAxis=useEditor(s=>s.pathEditAxis);
  const pathEditName=useEditor(s=>s.project.pathGroups?.find(g=>g.id===s.pathEditingId)?.options.name||'');
  const architecturePlacement=useEditor(s=>s.architecturePlacement);
  const environmentPlacement=useEditor(s=>s.environmentPlacement);
  const environmentPreview=useEditor(s=>s.environmentPreview),setEnvironmentPreview=useEditor(s=>s.setEnvironmentPreview);
  const [visualMenuOpen,setVisualMenuOpen]=useState(false);
  const visualMenuRef=useRef<HTMLDivElement|null>(null);
  const activeVisualization=resolveVisualizationMode(trueLightingOpen,environmentPreview);
  useEffect(()=>{
    if(!visualMenuOpen)return;
    const dismiss=(event:PointerEvent)=>{
      if(!visualMenuRef.current?.contains(event.target as Node))setVisualMenuOpen(false);
    };
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setVisualMenuOpen(false)};
    document.addEventListener('pointerdown',dismiss);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',dismiss);document.removeEventListener('keydown',escape)};
  },[visualMenuOpen]);
  const selectVisualization=(mode:'normal'|'quick'|'baked')=>{
    setVisualMenuOpen(false);
    if(onVisualizationMode)onVisualizationMode(mode);
    else setEnvironmentPreview(mode==='quick');
  };
  const shadowEnabled=useEditor(s=>s.environmentPreview&&s.previewShadows);
  const pendingNpcClass=useEditor(s=>s.pendingNpcClass);
  const audioPlacement=useEditor(s=>s.audioPlacement);
  const routePlacementFor=useEditor(s=>s.routePlacementFor);
  const routeSolo=useEditor(s=>s.routeSolo),setRouteSolo=useEditor(s=>s.setRouteSolo);
  const snap=useEditor(s=>s.snap),setSnap=useEditor(s=>s.setSnap);
  const gridDisplayStep=useEditor(s=>s.gridDisplayStep),setGridDisplayStep=useEditor(s=>s.setGridDisplayStep);
  const setControls=useEditor(s=>s.setControls);
  const [precisionOpen,setPrecisionOpen]=useState(false);
  const [precisionLeft,setPrecisionLeft]=useState(70);
  useEffect(()=>{if(!precisionOpen)return;
    const close=(e:KeyboardEvent)=>{if(e.key==='Escape')setPrecisionOpen(false)};
    window.addEventListener('keydown',close);return()=>window.removeEventListener('keydown',close);
  },[precisionOpen]);
  const snapping=useEditor(s=>s.snapping),toggleSnap=useEditor(s=>s.toggleSnap);
  const showGrid=useEditor(s=>s.showGrid),setFlag=useEditor(s=>s.setFlag);
  const showEntityNames=useEditor(s=>s.showEntityNames);
  const textureStudioOpen=useEditor(s=>s.textureStudioOpen);

  const isBspRecovered=useEditor(s=>isRecoveredBspProject(s.project));
  // New BSP→MAP sessions start with NULL render suppression ON, even if the
  // user manually exposed NULL faces in another recovered map. Switching the
  // toggle on this map never triggers a reset.
  const recoveredMapKey=useEditor(s=>isRecoveredBspProject(s.project)?s.project.name:'');
  useEffect(()=>{if(recoveredMapKey)setHideRecoveryNull(true)},[recoveredMapKey]);
  const undo=useEditor(s=>s.undo),redo=useEditor(s=>s.redo);
  const historyCount=useEditor(s=>s.history.length),futureCount=useEditor(s=>s.future.length);
  const drawMode=useEditor(s=>s.drawMode),drawHeight=useEditor(s=>s.drawHeight),drawPlane=useEditor(s=>s.drawPlane),selectedCount=useEditor(s=>s.selectedIds.length);
  const universalActive=useEditor(s=>!!(s.placementShape||s.placementPrefabId||s.terrainPlacement||s.blueprintPlacementId||s.audioPlacement||s.environmentPlacement||s.pendingNpcClass||s.routePlacementFor||s.cinematicPlacementFor||s.drawMode));
  // Wheel shortcuts act only over the actual viewport canvas, never while
  // scrolling the inspector or changing numeric fields.
  useEffect(()=>{
    const canvas=placementCanvasRef.current;if(!canvas)return;
    const wheel=(event:WheelEvent)=>{
      const state=useEditor.getState();
      if(!state.hasPendingPlacement())return;
      const prefs=state.universalPlacement;
      const sign=Math.sign(event.deltaY||event.deltaX);
      if(!sign)return;
      if(event.altKey&&!event.ctrlKey&&!event.metaKey&&prefs.mode==='free'){
        event.preventDefault();event.stopImmediatePropagation();
        const step=Math.max(16,Math.min(256,Math.round(prefs.freeDepth*.07/16)*16));
        state.setUniversalPlacement({freeDepth:Math.min(8192,Math.max(32,prefs.freeDepth+sign*step))});
      }else if(event.shiftKey&&!event.ctrlKey&&!event.altKey&&!event.metaKey&&['grid','relative'].includes(prefs.mode)){
        event.preventDefault();event.stopImmediatePropagation();
        const increment=state.snapping?state.snap:16;
        if(prefs.mode==='grid')state.setUniversalPlacement({planeZ:prefs.planeZ-sign*increment});
        else state.setUniversalPlacement({offsetZ:prefs.offsetZ-sign*increment});
      }
    };
    canvas.addEventListener('wheel',wheel,{capture:true,passive:false});
    return()=>canvas.removeEventListener('wheel',wheel,true);
  },[]);
  // All canvas placement tools share one Escape cancellation path.
  useEffect(()=>{
    const onEscape=(event:KeyboardEvent)=>{
      if(event.key!=='Escape'||!useEditor.getState().hasPendingPlacement())return;
      if(document.querySelector('.modal-backdrop'))return;
      event.preventDefault();event.stopImmediatePropagation();useEditor.getState().cancelPendingPlacement();
    };
    window.addEventListener('keydown',onEscape,true);
    return()=>window.removeEventListener('keydown',onEscape,true);
  },[]);
  return <PreviewContext.Provider value={previewContext}><div className={`viewport-frame ${universalActive?'is-universal-placing':''}`} onContextMenuCapture={e=>{e.preventDefault()}} onDoubleClickCapture={e=>{if(universalActive&&!(e.target as HTMLElement).closest('input,textarea,select,[contenteditable]'))e.preventDefault()}}><BuildTogetherCursors/>{!walkMode&&<BuildTogetherPresenceDock/>}
    {!walkMode&&<EntityMotionPreviewPanel/>}
    {!walkMode&&<HudCustomizer/>}
    {!walkMode&&!hudEditing&&<TextureStudioPanel/>}
    <TextureUVHandles/>
    {hudEditing&&<div className="hud-edit-shield" aria-hidden="true" onPointerDown={e=>{e.stopPropagation();useHudLayout.getState().select(null)}}/>}
    {!walkMode&&<HudWidget id="alerts">
      <div className="hud-alert-group">
        {activeDecalForHud&&<div className="primitive-placement-hud"><strong>Decal Studio: {activeDecalForHud}</strong><span>{translate(locale,'Click a brush surface to place · Esc to finish')}</span></div>}
        {environmentPlacement&&<div className="primitive-placement-hud"><strong>{t('Place in 3D')}: {environmentPlacement.kind}</strong><span>{t('Click a surface to place')} · RMB / Esc {t('Cancel')}</span></div>}
        {audioPlacement&&<div className="primitive-placement-hud"><strong>{t('Place in 3D')}: {audioPlacement.classname}</strong><span>{t('Click a surface to place')} · RMB / Esc {t('Cancel')}</span></div>}
        {(pendingNpcClass||routePlacementFor)&&<div className="primitive-placement-hud"><strong>{routePlacementFor?`path_waypoint · ${t('NPC Route')}`:`${t('Place NPC')}: ${pendingNpcClass}`}</strong><span>{t('Click a surface to place')} · RMB / Esc {t('Cancel')}</span></div>}
        {architecturePlacement&&<div className="primitive-placement-hud"><strong>{t('Point and place in 3D')}</strong><span>{t('Hover over an axis-aligned Box wall, click to position the opening. Change Width/Height before activating. Esc cancels.')}</span></div>}
        {terrainPlacement&&<div className="primitive-placement-hud"><strong>{t('Place in 3D')}: {terrainPlacement.kind==='terrain'?t('Sculpt Terrain'):terrainPlacement.kind==='path'?t('Path & Structure Studio'):terrainPlacement.kind==='scatter'?t('Scatter'):terrainPlacement.kind==='structure'?t('Smart Build structure'):terrainPlacement.kind==='radial'?t('Radial Array'):terrainPlacement.kind==='kit'?t('Sven kit'):t('Rock & Cliff Generator')}</strong><span>{t('Click a surface to place')} · RMB / Esc {t('Cancel')}</span></div>}
        {placementPrefabId&&<div className="primitive-placement-hud"><strong>{t('Place prefab with mouse')}: {placementPrefabName}</strong><span>R 90° · Shift+R 15° · X/Y/Z · F · 0 · P · Esc</span></div>}
        {placementShape&&<div className="primitive-placement-hud"><strong>{t('Place')}: {t(placementShape[0].toUpperCase()+placementShape.slice(1))}</strong><span>R 90° · Shift+R 15° · X/Y/Z · F · 0 · P · Esc</span></div>}
        {(placementShape||placementPrefabId)&&<div className="smart-placement-controls" onPointerDown={e=>e.stopPropagation()}>
          <span>{placementAxis.toUpperCase()} {placementAngle}°</span>
          <button title={t('Rotate 90 degrees')} onClick={()=>useEditor.getState().stepPlacementAngle(90)}>↻ 90°</button>
          {(['x','y','z'] as const).map(axis=><button key={axis} className={placementAxis===axis?'active':''} onClick={()=>useEditor.getState().setPlacementAxis(axis)} title={`${t('Axis')} ${axis.toUpperCase()}`}>{axis.toUpperCase()}</button>)}
          <button className={placementAutoAlign?'active':''} onClick={()=>useEditor.getState().togglePlacementAutoAlign()} title={t('Align to surface')}>F · {t('Surface')}</button>
          <button className={placementRepeat?'active':''} onClick={()=>useEditor.getState().togglePlacementRepeat()} title={t('Repeat placement')}>P · {t('Repeat')}</button>
        </div>}
        {routeSolo&&<div className="viewport-route-focus"><span style={{background:routeColor(routeSolo)}}/>{t('Isolated AI route')}: <b>{routeSolo}</b><button onClick={()=>setRouteSolo(null)}>{t('Show all')}</button></div>}
        {measureMode&&<div className="measure-mode-hud"><strong>{t('Measure distance')}</strong><span>{measurement.a&&!measurement.b?t('Click second point'):t('Click first point')} · Esc</span></div>}
        {hudEditing&&!environmentPlacement&&!audioPlacement&&!pendingNpcClass&&!routePlacementFor&&!architecturePlacement&&!placementShape&&!placementPrefabId&&!routeSolo&&!measureMode&&<span className="hud-empty-slot">{t('Editor messages')}</span>}
      </div>
    </HudWidget>}
    {!walkMode&&pathEditingId&&<div className="map-path-edit-toolbar" onPointerDown={e=>e.stopPropagation()}>
      <strong>{t('Edit saved route in MAP')}: {pathEditName}</strong>
      {(['xy','x','y','z'] as PathEditAxis[]).map(axis=><button key={axis} className={pathEditAxis===axis?'active':''} type="button" onClick={()=>useEditor.getState().setPathEditAxis(axis)}>{axis.toUpperCase()}</button>)}
      <button type="button" onClick={()=>useEditor.getState().setPathEditing(null)}>{t('Finish route editing')} · Esc</button>
    </div>}
    {!walkMode&&<HudWidget id="status">
      <div className="viewport-label"><span className="viewport-bullet"/> {t(cameraLabel)} <span className="viewport-sep">/</span> {drawMode?`${t('Draw')} ${drawPlane.toUpperCase()} (${drawHeight}u) · X/Y/Z: ${t('Plane')} · F: ${t('Surface')}` :t('Textured')} <span className="viewport-sep">/</span> {t(faceMode?'Face':'Object')} {t('selection')}</div>
    </HudWidget>}
    {!walkMode&&<HudWidget id="view" className={precisionOpen||visualMenuOpen?'hud-popup-open':''}><div className="viewport-grid-controls-wrap"><div className="viewport-controls-row">
      <button type="button" className="projection-toggle" onClick={()=>projection('projection')} title={t('Switch orthographic / perspective')} aria-label={t('Switch orthographic / perspective')}><Scan size={16}/><span className="hud-projection-label vbar-label">{t(cameraLabel.includes('Ortho')||cameraLabel==='Orthographic'?'Orthographic':'Perspective')}</span></button>
      <div className="viewport-visualization-control" ref={visualMenuRef}>
        <button type="button" className={`viewport-visualization-trigger ${activeVisualization!=='normal'?'active':''}`} onClick={()=>{setPrecisionOpen(false);setVisualMenuOpen(v=>!v)}} title={translate(locale,'Visualization modes')} aria-label={translate(locale,'Visualization')} aria-haspopup="menu" aria-expanded={visualMenuOpen}><Eye size={15}/><span className="vbar-label">{translate(locale,'Visualize')}</span><ChevronDown size={12}/></button>
        {visualMenuOpen&&<div className="viewport-visualization-menu" role="menu" aria-label={translate(locale,'Visualization modes')} onPointerDown={e=>e.stopPropagation()}>
          {([
            {id:'normal',Icon:Eye,es:['Vista normal','Editor MAP sin iluminación aproximada'],en:['Normal view','MAP editor without lighting approximation']},
            {id:'quick',Icon:Sun,es:['Vista previa rápida','Iluminación aproximada en tiempo real'],en:['Quick lighting','Approximate real-time lighting']}
          ] as const).map(item=><button type="button" role="menuitemradio" aria-checked={activeVisualization===item.id} key={item.id} className={activeVisualization===item.id?'selected':''} onClick={()=>selectVisualization(item.id)}>
            <item.Icon size={17}/><span><strong>{item[locale==='es'?'es':'en'][0]}</strong><small>{item[locale==='es'?'es':'en'][1]}</small></span>{activeVisualization===item.id&&<span className="viewport-visualization-selected" aria-hidden="true">✓</span>}
          </button>)}
        </div>}
      </div>
      <label className="viewport-grid-select" title={t('Visual grid')}><Grid3x3 size={13}/><select aria-label={t('Visual grid')} value={gridDisplayStep} onChange={e=>setGridDisplayStep(Number(e.target.value))}>{GRID_STEPS.map(step=><option key={step} value={step}>{step}u</option>)}</select></label>
      <button type="button" className={`grid-snap ${snapping?'active':''}`} aria-pressed={snapping} aria-label={t('Snap to grid')} title={t('Snap to grid')} onClick={toggleSnap}><Magnet size={16}/></button>
      <label className="viewport-grid-select viewport-edit-step" title={t('Move / draw step')}><span aria-hidden="true">±</span><select aria-label={t('Move / draw step')} value={snap} onChange={e=>setSnap(Number(e.target.value))}>{GRID_STEPS.map(step=><option key={step} value={step}>{step}u</option>)}</select></label>
      <button type="button" className={precisionOpen?'hud-pressed':''} aria-expanded={precisionOpen} aria-label={t('Grid precision settings')} title={t('Grid precision settings')} onClick={e=>{
        if(!precisionOpen){
          const toolbar=e.currentTarget.closest('.viewport-grid-controls-wrap')?.getBoundingClientRect();
          const viewport=e.currentTarget.closest('.viewport-frame')?.getBoundingClientRect();
          const trigger=e.currentTarget.getBoundingClientRect();
          if(toolbar&&viewport){
            // Anchor below the settings button, not below the whole HUD row.
            // Avoid the vertical tool rail and keep the popup on-screen.
            const available=viewport.right-toolbar.left-320;
            setPrecisionLeft(Math.max(68,Math.min(trigger.left-toolbar.left,available)));
          }
        }
        setPrecisionOpen(value=>!value);
      }}><SlidersHorizontal size={16}/></button>
      <div className="hud-tools-separator"/>
      {isBspRecovered&&<button type="button" className={`vbar-p2 ${hideRecoveryNull?'hud-pressed':''}`} title={t(hideRecoveryNull?'Show NULL faces (may reduce FPS)':'Hide NULL faces (improves recovered MAP performance)')} aria-label={t(hideRecoveryNull?'Show NULL faces':'Hide NULL faces')} aria-pressed={hideRecoveryNull} onClick={()=>setHideRecoveryNull(v=>!v)}>{hideRecoveryNull?<EyeOff size={16}/>:<Eye size={16}/>}</button>}
      {/* v2.3 HF8: one viewport bar. Undo/redo, wireframe, grid visibility and entity names live in the Tools ribbon. */}
      <ViewportQuickActions/>
      {/* v2.4: Texture Studio (UV) moved to the Tools ribbon → Textures group. */}
      <ViewportMoreMenu/>
    </div>
      {precisionOpen&&<section className="viewport-precision-panel" style={{left:precisionLeft}} role="group" aria-label={t('Grid precision settings')} onPointerDown={e=>e.stopPropagation()}>
        <div className="viewport-precision-head"><strong>{t('Grid precision settings')}</strong><button type="button" aria-label={t('Close precision settings')} onClick={()=>setPrecisionOpen(false)}>×</button></div>
        <label>{t('Visual grid')}<select value={gridDisplayStep} onChange={e=>setGridDisplayStep(Number(e.target.value))}>{GRID_STEPS.map(step=><option key={step} value={step}>{step}u</option>)}</select></label>
        <label>{t('Move / draw step')}<select value={snap} onChange={e=>setSnap(Number(e.target.value))}>{GRID_STEPS.map(step=><option key={step} value={step}>{step}u</option>)}</select></label>
        <label>{t('Rotation step')}<select value={controls.rotationSnapDegrees} onChange={e=>setControls({rotationSnapDegrees:Number(e.target.value)})}>{[0,1,5,10,15,30,45,90].map(v=><option key={v} value={v}>{v===0?t('Free rotation'):`${v}°`}</option>)}</select></label>
        <label>{t('Scale step')}<select value={controls.scaleSnapStep} onChange={e=>setControls({scaleSnapStep:Number(e.target.value)})}>{[0,.01,.02,.05,.1,.25,.5,1].map(v=><option key={v} value={v}>{v===0?t('Free scaling'):`${v}×`}</option>)}</select></label>
        <small>{t('The visible grid does not limit editing precision.')}</small>
        <small>{t('Shift: temporarily free/fine move. Ctrl: temporarily use snapped steps.')}</small>
      </section>}
    </div></HudWidget>}
    {!walkMode&&showPreviewOptions&&<div className="walk-render-panel" onPointerDown={e=>e.stopPropagation()}>
      <div className="walk-render-panel-header"><strong>{t('Gameplay Test settings')}</strong><button type="button" onClick={()=>setShowPreviewOptions(false)}>×</button></div>
      <label>{t('Starting position')}<select value={walkSettings.spawn} onChange={e=>updateWalk({spawn:e.target.value as WalkPreviewSettings['spawn']})}><option value="entity">info_player_start</option><option value="camera">{t('Current camera position')}</option></select></label>
      <label>{t('Walk speed')}: {walkSettings.walkSpeed} u/s<input type="range" min="60" max="600" step="10" value={walkSettings.walkSpeed} onChange={e=>updateWalk({walkSpeed:Number(e.target.value)})}/></label>
      <label>{t('Run multiplier')}: {walkSettings.runMultiplier.toFixed(2)}×<input type="range" min="1" max="4" step="0.1" value={walkSettings.runMultiplier} onChange={e=>updateWalk({runMultiplier:Number(e.target.value)})}/></label>
      <label>{t('Crouch multiplier')}: {walkSettings.crouchMultiplier.toFixed(2)}×<input type="range" min="0.15" max="1" step="0.05" value={walkSettings.crouchMultiplier} onChange={e=>updateWalk({crouchMultiplier:Number(e.target.value)})}/></label>
      <label className="walk-render-checkbox"><input type="checkbox" checked={walkSettings.safeFullscreen} onChange={e=>updateWalk({safeFullscreen:e.target.checked})}/>{t('Safe fullscreen keyboard mode')}</label>
      {walkSettings.safeFullscreen&&<small>{t('In supported browsers, fullscreen Keyboard Lock can capture Ctrl+W. Browser permission may be required. Hold Esc to exit fullscreen.')}</small>}
      <label className="walk-render-checkbox"><input type="checkbox" checked={walkSettings.showHud} onChange={e=>updateWalk({showHud:e.target.checked})}/>{t('Player HUD')}</label>
      <label className="walk-render-checkbox"><input type="checkbox" checked={walkSettings.flashlight} onChange={e=>updateWalk({flashlight:e.target.checked})}/>{t('Flashlight')}</label>
      <label>{t('Flashlight power')}: {Math.round(walkSettings.flashlightPower/1000)}k<input type="range" min="10000" max="120000" step="5000" value={walkSettings.flashlightPower} onChange={e=>updateWalk({flashlightPower:Number(e.target.value)})}/></label>
      <label className="walk-render-checkbox"><input type="checkbox" checked={walkSettings.noclip} onChange={e=>updateWalk({noclip:e.target.checked})}/>{t('Noclip preview')}</label>
      <div className="walk-render-divider"/>
      <label className="walk-render-checkbox"><input type="checkbox" checked={walkSettings.rendered} onChange={e=>updateWalk({rendered:e.target.checked})}/>{t('Rendered lighting in test')}</label>
      <label className="walk-render-checkbox"><input type="checkbox" checked={walkSettings.showModels} onChange={e=>updateWalk({showModels:e.target.checked})}/>{t('Show NPC and MDL models')}</label>
      <label className="walk-render-checkbox"><input type="checkbox" checked={walkSettings.interactions} onChange={e=>updateWalk({interactions:e.target.checked})}/>{t('Simulate buttons, doors and triggers')}</label>
      <div className="walk-render-divider"/>
      <label className="walk-render-checkbox"><input type="checkbox" checked={goldsrcSettings.enabled} onChange={e=>updateGoldSrc({enabled:e.target.checked})}/><strong>{t('GoldSrc material preview')}</strong></label>
      <label className="walk-render-checkbox"><input type="checkbox" checked={goldsrcSettings.transparency} onChange={e=>updateGoldSrc({transparency:e.target.checked})}/>{t('Water and glass transparency')}</label>
      <label className="walk-render-checkbox"><input type="checkbox" checked={goldsrcSettings.waterAnimation} onChange={e=>updateGoldSrc({waterAnimation:e.target.checked})}/>{t('Water texture animation')}</label>
      <label>{t('Exposure')}: {goldsrcSettings.exposure.toFixed(2)}×<input type="range" min="0.5" max="2" step="0.05" value={goldsrcSettings.exposure} onChange={e=>updateGoldSrc({exposure:Number(e.target.value)})}/></label>
      <label>{t('Ambient fill')}: {goldsrcSettings.ambientFill.toFixed(2)}<input type="range" min="0" max="1.5" step="0.05" value={goldsrcSettings.ambientFill} onChange={e=>updateGoldSrc({ambientFill:Number(e.target.value)})}/></label>
      <small>{t('GoldSrc preview is approximate; compiled BSP lightmaps remain the reference for baked lighting.')}</small>
    </div>}
    {!walkMode&&doctorTrace.length>1&&<div className="viewport-leak-actions"><button type="button" className="viewport-leak-toggle" onClick={()=>setDoctorTraceVisible(!doctorTraceVisible)}>{doctorTraceVisible?t('Hide leak route'):t('Show leak route')} · {doctorTrace.length}</button><button type="button" className="viewport-leak-toggle viewport-leak-go" onClick={()=>{setDoctorTraceVisible(true);useMapDoctorState.getState().focusTrace(0)}} title={t('The pointfile starts at the entity that sees the void; follow the red line to the hole.')}>{t('Go to leak')}</button></div>}
    {/* R3F measures physical pixels. The editor shell uses CSS zoom for UI scale,
        so the WebGL layer must undo that zoom to avoid a double-scaled canvas. */}
    <div ref={placementCanvasRef} onPointerDownCapture={e=>{
        const state=useEditor.getState();
        if(e.button===2){
          // Keep RMB down available to the normal camera look; only a SHORT
          // click cancels. A drag never destroys the pending placement.
          rightGesture.current={x:e.clientX,y:e.clientY,at:performance.now(),moved:false};
          return;
        }
        if(e.button!==0||!state.hasPendingPlacement())return;
        const settings=state.universalPlacement;
        if(!settings.twoStep||state.drawMode||state.placementShape||state.placementPrefabId)return;
        if(!settings.staged){
          const hover=state.universalPlacementHover;
          e.preventDefault();e.stopPropagation();
          if(!hover)return; // Do not accidentally commit when preview has not initialized.
          state.setUniversalPlacement({position:[...hover],lockPosition:true,staged:true});
        }else{
          // Native canvas placement handlers execute before this microtask.
          // The operation itself therefore uses the staged XYZ exactly.
          queueMicrotask(()=>useEditor.getState().setUniversalPlacement({staged:false,lockPosition:false}));
        }
      }}
      onPointerMoveCapture={e=>{
        const gesture=rightGesture.current;
        if(gesture&&(Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)>6||Math.abs(e.movementX)+Math.abs(e.movementY)>8))gesture.moved=true;
      }}
      onPointerUpCapture={e=>{
        if(e.button!==2)return;
        const gesture=rightGesture.current;rightGesture.current=null;
        if(!gesture||gesture.moved||performance.now()-gesture.at>500)return;
        const state=useEditor.getState();
        if(state.hasPendingPlacement()){e.preventDefault();e.stopPropagation();state.cancelPendingPlacement();}
        else if(useArchitectureMode.getState().mode!=='off'){e.preventDefault();e.stopPropagation();useArchitectureMode.getState().cancel();}
      }}
      onContextMenu={e=>e.preventDefault()} className="viewport-canvas" style={{zoom:1/uiScale}}><Canvas frameloop={viewportPaused?'never':'always'} shadows={shadowEnabled} dpr={viewportPixelRatio?[Math.min(1,viewportPixelRatio),viewportPixelRatio]:[1,perfPreset==='quality'?1.75:perfPreset==='large'?1:1.35]} camera={{position:[660,530,690],fov:58,near:.5,far:280000}} gl={{antialias:true,powerPreference:'high-performance'}}>
      <Scene onContextMenu={openMenu}/>
    </Canvas></div>
    {!walkMode&&!hudEditing&&<UniversalPlacementPanel/>}
    {!walkMode&&<HudWidget id="shapes"><ShapePalette/></HudWidget>}
    {!walkMode&&<ArchitectureDrawControls/>}
    {!walkMode&&!hudEditing&&<PreciseScalePanel/>}
    {!walkMode&&csMapPlacement&&<div className="primitive-placement-hud" role="status" style={{pointerEvents:'none'}}>
      <strong>CS Map Studio · {csMapPlacement.action==='pick'?'XYZ':'3D'}</strong>
      <span>{locale==='es'?'Clic izquierdo en el suelo para elegir o colocar · Esc cancela':locale==='pt'?'Clique no chão para escolher ou colocar · Esc cancela':locale==='ru'?'Нажмите на пол для выбора или размещения · Esc — отмена':locale==='ko'?'바닥 클릭으로 위치 선택 또는 배치 · Esc 취소':locale==='zh'?'点击地面选择位置或放置 · Esc 取消':'Click the map floor to pick or place · Esc cancels'}</span>
    </div>}
    {!walkMode&&cinematicPlacementFor&&<div className="cine-placement-overlay" role="status">{t('Cinematic route: click a map surface to add a path_corner. Esc to finish.')}</div>}
    {walkMode&&<div className="player-walk-overlay" role="status" aria-label={t('Gameplay Test')}>
      <span className="player-walk-crosshair" aria-hidden="true"/>
      {walkSettings.showHud&&<div className="player-walk-info" aria-label={t('Player HUD')}>
        <strong>{t('Player HUD')}</strong>
        <span>{t('Speed')}: {walkStats.speed.toFixed(0)} u/s</span>
        <span>XYZ: {walkStats.position.map(n=>Math.round(n)).join(' / ')}</span>
        <span>{walkStats.noclip?'NOCLIP':walkStats.crouched?t('Crouched'):walkStats.grounded?t('Grounded'):t('Airborne')}</span>
        <span className={walkSettings.flashlight?'walk-lamp-on':'walk-lamp-off'}><Flashlight size={13}/> {t('Flashlight')}: {walkSettings.flashlight?'ON':'OFF'}</span>
      </div>}
      <div className="player-walk-guide"><strong>{t('Gameplay Test')}</strong>
        {!walkCaptured&&<span>{t('Click viewport to capture mouse')}</span>}
        <span>{t('Gameplay Test controls hint')}</span>
        {walkSettings.interactions&&<span>{t('Interaction is an approximation; verify in Sven Co-op.')}</span>}
        {gameplayMessage&&<span className="player-walk-mode-status">{gameplayMessage}</span>}
        <span className="player-walk-safety-hint">{t('Use C to crouch while moving. Ctrl+W may close the browser.')}</span>
        <span className="player-walk-mode-status">F: {t('Flashlight')} <b>{walkSettings.flashlight?'ON':'OFF'}</b> · H: HUD <b>{walkSettings.showHud?'ON':'OFF'}</b></span>
      </div>
    </div>}
    {!walkMode&&contextMenu&&<ContextMenu menu={contextMenu} onClose={closeMenu}/>}
    {!walkMode&&compactTools&&<HudWidget id="tools"><QuickToolRail/></HudWidget>}
    {!walkMode&&(!modal||hudEditing)&&<HudWidget id="orthographic">{hudEditing?<span className="hud-empty-slot">{t('Orthographic tools')}</span>:<OrthoQuickTools/>}</HudWidget>}
    {!walkMode&&(modal||hudEditing)&&<HudWidget id="transform"><div className="modal-transform-hud"><span className="modal-command">{modal?.mode==='translate'?'G':modal?.mode==='rotate'?'R':'S'}</span><span><strong>{t(modal?.mode==='translate'?'Move':modal?.mode==='rotate'?'Rotate':'Scale')} · Blender</strong><small>{t('Shift + mouse: fine · Ctrl + mouse: snap · Alt + mouse: alternate · X/Y/Z: axis · Enter/click: confirm · Esc: cancel')}</small><em id="studio-modal-modifiers">{t('Normal drag')}</em></span><b id="studio-modal-readout">0</b></div></HudWidget>}
    {!walkMode&&<HudWidget id="fps"><div className="map-fps-mount" data-map-fps-mount/></HudWidget>}
    {!walkMode&&<HudWidget id="help"><div className="viewport-hotkeys">{t(placementShape||placementPrefabId?'Click a surface to place · Esc cancel':drawMode?'Arrastrar · Dibujar | X: plano YZ · Y: plano XZ · Z: plano XY · Esc cancelar':controls.cameraPreset==='blender'?'RMB · Mirar | MMB · Orbit | Shift+MMB · Pan':'RMB arrastrar · Mirar | LMB · Pan | MMB · Zoom')} <span> | </span> {t(flyMode?'Fly/Walk ON · WASD · Q/E down/up · Esc exit':'RMB · Mirar · WASD mover · Q/E bajar/subir · rueda zoom')}</div></HudWidget>}
    {!walkMode&&(!modal||hudEditing)?<HudWidget id="stats"><div className="viewport-stats"><span>{count} {t('objects')}</span>{selectedCount>1&&<span>{selectedCount} {t('selected')} · {t('TRANSFORM')} {mode==='select'?t('Ready'):t(mode)}</span>}<span>{mode.toUpperCase()}</span><span>{t('Visual grid')} {gridDisplayStep}u · {t('Move / draw step')} {snapping?`${snap}u`:t('Off')}</span></div></HudWidget>:null}
    {!walkMode&&hudEditing&&<HudWidget id="axes" editPlaceholder><div/></HudWidget>}

  </div></PreviewContext.Provider>;
}
