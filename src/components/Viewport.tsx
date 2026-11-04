import { Canvas,useFrame,useThree } from '@react-three/fiber';
import { Scan } from 'lucide-react';
import { OrbitControls,TransformControls,GizmoHelper,GizmoViewport,Html,Line } from '@react-three/drei';
import { memo,useCallback,useEffect,useMemo,useRef,useState } from 'react';
import * as THREE from 'three';
import { useEditor } from '../store';
import { buildMeshGeometry,createPlaceableShape,gameToThree,threeToGame,toRenderQuaternion,fromRenderQuaternion,transformedVertices } from '../engine/geometry';
import type { Brush,PointEntity,TextureAsset,Vec3,PlaceableShape } from '../engine/types';
import {uniqueBrushEdges} from '../engine/modeling';
import {traceNpcRoute,isNpcOwner} from '../engine/npc';
import {organizeScene,routeColor} from '../engine/sceneOrganization';
import {soundInfluence,validSoundReference} from '../engine/sound';
import {parseLight,rgbHex,skyPreviewColor} from '../engine/environment';
import {useT} from '../i18n';
import {isUvDragGesture} from '../engine/controls';
import {ContextHitProbe,ContextMenu,OrthoQuickTools,type SceneMenu} from './ViewportExtras';
import {StudioModel,loadModelByPath} from './ModelBrowser';
import type {StudioPreview} from '../engine/mdl';
import {useStudioLayout} from '../layout';
import {entityColorKind} from '../engine/entityAppearance';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {readSavedCamera,writeSavedCamera} from '../engine/cameraRecovery';

const textureCache=new Map<string,THREE.Texture>();
const sharedMaterials=new Map<string,THREE.MeshStandardMaterial>();
const entityMarkerGeometry={box:new THREE.BoxGeometry(18,18,18),light:new THREE.OctahedronGeometry(10),spawn:new THREE.CapsuleGeometry(10,20,4,8)};
const entityMarkerMaterials=new Map<string,THREE.MeshStandardMaterial>();
function markerMaterial(color:string,selected:boolean){
  const key=`${color}:${selected}`;
  let material=entityMarkerMaterials.get(key);
  if(!material){material=new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:selected?.8:.4});entityMarkerMaterials.set(key,material)}
  return material;
}
const textureAssetIndex=new WeakMap<TextureAsset[],Map<string,TextureAsset>>();
const starterTextures=new Set(["SV_BRICK01", "SV_CONCRET", "SV_TILE01", "SV_METAL01", "SV_GRID01"]);
// Public starter textures are available on the very first render, even while
// asynchronous WAD decoding is still running. This does not change map data.
// Access the actual scene groups during a multi-object gizmo drag. Moving only
// the empty pivot makes the gizmo move while the brushes remain stationary.
const visualGroups=new Map<string,THREE.Group>();
function useVisualGroup(id:string,hidden:boolean,ref:React.RefObject<THREE.Group|null>){
  useEffect(()=>{
    if(!hidden&&ref.current)visualGroups.set(id,ref.current);
    return()=>{visualGroups.delete(id)};
  },[id,hidden,ref]);
}
function materialTexture(texture:string,assets:TextureAsset[]) {
  let index=textureAssetIndex.get(assets);
  if(!index){index=new Map(assets.map(asset=>[asset.name.toLowerCase(),asset]));textureAssetIndex.set(assets,index)}
  const a=index.get(texture.toLowerCase());
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
function useMaterials(b:Brush,assets:TextureAsset[],wireframe:boolean){
  return useMemo(()=>b.faces.map((f,i)=>{
    const image=materialTexture(f.texture,assets);
    const palette=['#a9b1ba','#9da6b2','#b8a8a0','#a19a90','#8fa3ad','#99a098'];
    const color=image?'#ffffff':palette[i%palette.length];
    const key=`${image?.uuid||'none'}:${color}:${wireframe}`;
    let material=sharedMaterials.get(key);
    if(!material){material=new THREE.MeshStandardMaterial({map:image,color,roughness:.93,metalness:0,side:THREE.DoubleSide,wireframe});sharedMaterials.set(key,material)}
    return material;
  }),[b.faces,assets,wireframe]);
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

function BrushVisual({object}:{object:Brush}){
  const selected=useEditor(s=>s.selectedIds.includes(object.id));
  const lastSelected=useEditor(s=>s.selected===object.id);
  const multiCount=useEditor(s=>s.selectedIds.length);
  const selectedFace=useEditor(s=>s.selectedFace);
  const faceMode=useEditor(s=>s.faceMode);
  const drawMode=useEditor(s=>s.drawMode);
  const geometryMode=useEditor(s=>s.geometryMode);
  const measureMode=useEditor(s=>s.measureMode),measurePoint=useEditor(s=>s.measurePoint);
  const showNames=useEditor(s=>s.showEntityNames);
  const appearance=useEditor(s=>s.entityAppearance);
  const placementShape=useEditor(s=>s.placementShape);
  const audioPlacement=useEditor(s=>s.audioPlacement);
  const environmentPlacement=useEditor(s=>s.environmentPlacement);
  const associatedEntity=useEditor(s=>object.entityId?s.project.objects.find(o=>o.id===object.entityId&&o.kind==='entity') as PointEntity|undefined:undefined);
  const modal=useEditor(s=>s.modalTransform);
  const cameraLabel=useEditor(s=>s.cameraLabel);
  const mode=useEditor(s=>s.mode);
  const selectObject=useEditor(s=>s.selectObject);
  const update=useEditor(s=>s.updateObject);
  const beginTextureDrag=useEditor(s=>s.beginTextureDrag);
  const updateTextureDrag=useEditor(s=>s.updateTextureDrag);
  const updateTextureTransform=useEditor(s=>s.updateTextureTransform);
  const finishTextureDrag=useEditor(s=>s.finishTextureDrag);
  const textureDrag=useRef<{x:number;y:number;face:number;mode:'offset'|'rotate'|'scale'}|null>(null);
  const getThree=useThree(s=>s.get);
  const setOrbitEnabled=(enabled:boolean)=>{
    const orbit=getThree().controls as OrbitControlsImpl|undefined;
    if(orbit)orbit.enabled=enabled;
  };
  const snap=useEditor(s=>s.snap);
  const uiScale=useStudioLayout(s=>s.uiScale);const snapping=useEditor(s=>s.snapping);
  const controlsConfig=useEditor(s=>s.controls);
  const assets=useEditor(s=>s.textureAssets);
  const wireframe=useEditor(s=>s.wireframe);
  const geometry=useMemo(()=>buildMeshGeometry(object),[object.vertices,object.faces,object.position,object.rotation,object.scale]);
  const edges=useMemo(()=>selected?new THREE.EdgesGeometry(geometry,24):null,[geometry,selected]);
  const materials=useMaterials(object,assets,wireframe);
  const shadows=useEditor(s=>s.environmentPreview&&s.previewShadows);
  const groupRef=useRef<THREE.Group>(null!);
  useVisualGroup(object.id,!!object.hidden,groupRef);
  useEffect(()=>()=>{geometry.dispose();edges?.dispose()},[geometry,edges]);
  // Shared materials are intentionally not disposed per brush; hundreds of
  // brushes can safely reuse one WebGL material for the same texture.
  if(object.hidden)return null;
  const pos=gameToThree(object.position),quat=toRenderQuaternion(object.rotation);
  const scale=new THREE.Vector3(object.scale[0],object.scale[2],object.scale[1]);
  const commit=()=>{
    if(!groupRef.current)return;
    const g=groupRef.current;
    let p=threeToGame(g.position);
    if(snapping&&mode==='translate')p=p.map(v=>Math.round(v/snap)*snap) as Vec3;
    const rotation=fromRenderQuaternion(g.quaternion);
    const sc:Vec3=[g.scale.x,g.scale.z,g.scale.y].map(x=>Math.max(.05,Math.abs(x))) as Vec3;
    if(object.position.some((v,i)=>Math.abs(v-p[i])>.01)||object.rotation.some((v,i)=>Math.abs(v-rotation[i])>.01)||object.scale.some((v,i)=>Math.abs(v-sc[i])>.01))
      update(object.id,{position:p,rotation,scale:sc});
  };
  const node=(<group ref={groupRef} position={pos} quaternion={quat} scale={scale}>
    <mesh geometry={geometry} material={materials} castShadow={shadows} receiveShadow={shadows} userData={{brushId:object.id}} onPointerDown={e=>{
      if(e.button!==0||drawMode||placementShape||audioPlacement||environmentPlacement)return;
      if(measureMode){e.stopPropagation();measurePoint(threeToGame(e.point));return;}
      e.stopPropagation();if(object.locked)return;
      const triIndex=e.faceIndex??0;
      const faceIndex=geometry.userData.trianglesToFaces?.[triIndex]??null;
      // Alt+drag on a face moves U/V texture offsets with a live preview.
      // The whole gesture becomes ONE undo step when the pointer is released.
      if(isUvDragGesture(e,faceMode)&&faceIndex!==null){
        e.nativeEvent.preventDefault();
        setOrbitEnabled(false);
        selectObject(object.id,false,faceIndex);
        beginTextureDrag(object.id,faceIndex);
        textureDrag.current={x:e.clientX,y:e.clientY,face:faceIndex,mode:e.shiftKey?'rotate':e.ctrlKey?'scale':'offset'};
        (e.target as {setPointerCapture?:(id:number)=>void}|null)?.setPointerCapture?.(e.pointerId);
        return;
      }
      // A click on a selected brush must not collapse a multi-selection
      // while the user is grabbing a transform gizmo overlapping that brush.
      if(selected&&multiCount>1&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey)return;
      selectObject(object.id,e.shiftKey||e.ctrlKey||e.metaKey,faceMode?faceIndex:null);
    }} onPointerMove={e=>{
      if(!textureDrag.current)return;
      e.stopPropagation();e.nativeEvent.preventDefault();const drag=textureDrag.current;
      if(drag.mode==='offset')updateTextureDrag(object.id,drag.face,(e.clientX-drag.x)*.75,-(e.clientY-drag.y)*.75);
      else updateTextureTransform(object.id,drag.face,drag.mode,e.clientX-drag.x,e.clientY-drag.y);
    }} onPointerUp={e=>{
      if(!textureDrag.current)return;
      e.stopPropagation();textureDrag.current=null;
      (e.target as {releasePointerCapture?:(id:number)=>void}|null)?.releasePointerCapture?.(e.pointerId);
      finishTextureDrag(true);
      setOrbitEnabled(!useEditor.getState().modalTransform&&!useEditor.getState().drawMode);
    }} onPointerCancel={e=>{
      if(!textureDrag.current)return;
      e.stopPropagation();textureDrag.current=null;finishTextureDrag(false);
      setOrbitEnabled(!useEditor.getState().modalTransform&&!useEditor.getState().drawMode);
    }}/>
    {showNames&&associatedEntity&&<EntityNameLabel classname={associatedEntity.classname} targetname={associatedEntity.props.targetname} position={[0,46,0]} selected={selected} color={appearance.colors[entityColorKind(associatedEntity.classname)]}/>}
    {selected&&edges&&<lineSegments geometry={edges}><lineBasicMaterial color="#5db8fa" depthTest={false} transparent opacity={1}/></lineSegments>}
    {lastSelected&&faceMode&&selectedFace!==null&&<FaceHighlight brush={object} face={selectedFace}/>}
  </group>);
  return <>{node}{selected&&multiCount===1&&!object.locked&&(geometryMode==='vertex'||geometryMode==='edge')&&<GeometryEditHandles brush={object} kind={geometryMode}/>}
    {selected&&multiCount===1&&geometryMode==='object'&&!object.locked&&!modal&&mode!=='select'&&<TransformControls object={groupRef} mode={mode} onMouseUp={commit} showX showY showZ
    space={controlsConfig.gizmoSpace} translationSnap={snapping?snap:undefined}
    rotationSnap={controlsConfig.rotationSnapDegrees?THREE.MathUtils.degToRad(controlsConfig.rotationSnapDegrees):undefined}
    scaleSnap={controlsConfig.scaleSnapStep||undefined} size={controlsConfig.gizmoSize*(cameraLabel.includes('Ortho')?1.45:1)}/>}</>;
}
/** Direct 3D handles for Svengine convex brush vertices and edges.
 * Transform only the chosen local vertices, reconstructing convex supporting
 * planes before committing to the map. Any illegal edit is rejected. */
function GeometryEditHandles({brush,kind}:{brush:Brush;kind:'vertex'|'edge'}){
  const indices=useEditor(s=>s.editIndices);
  const selectIndices=useEditor(s=>s.selectEditIndices);
  const change=useEditor(s=>s.editVertices);
  const snap=useEditor(s=>s.snap),snapping=useEditor(s=>s.snapping);
  const controlsConfig=useEditor(s=>s.controls);
  const points=useMemo(()=>transformedVertices(brush).map(gameToThree),[brush]);
  const handles=useMemo(()=>kind==='vertex'?points.map((p,i)=>({id:`v${i}`,position:p,indices:[i]})):
    uniqueBrushEdges(brush).map(([a,b],i)=>({id:`e${i}`,position:points[a].clone().add(points[b]).multiplyScalar(.5),indices:[a,b]})),[points,brush,kind]);
  const current=handles.find(h=>h.indices.length===indices.length&&h.indices.every(i=>indices.includes(i)));
  const origin=current?.position;
  const pivot=useRef<THREE.Group>(null!);
  const start=useRef<THREE.Vector3|null>(null);
  useEffect(()=>{if(origin&&pivot.current&&!start.current)pivot.current.position.copy(origin)},[origin]);
  const commit=()=>{
    if(!pivot.current||!origin||!indices.length||!start.current)return;
    let delta=threeToGame(pivot.current.position.clone().sub(start.current));
    if(snapping)delta=delta.map(x=>Math.round(x/snap)*snap) as Vec3;
    // Geometry vertices live in the brush-local GoldSrc coordinate frame.
    const euler=new THREE.Euler(...brush.rotation.map(THREE.MathUtils.degToRad) as Vec3,'XYZ');
    const inverse=new THREE.Quaternion().setFromEuler(euler).invert();
    const local=new THREE.Vector3(...delta).applyQuaternion(inverse);
    const d:Vec3=[local.x/brush.scale[0],local.y/brush.scale[1],local.z/brush.scale[2]];
    start.current=null;
    pivot.current.position.copy(origin);
    if(d.every(x=>Math.abs(x)<.00001))return;
    try{change(brush.id,indices,d)}catch(error){
      useEditor.getState().appendLogs([`Svengine modeling: ${String(error)}`]);
      window.alert(`Svengine: ${String(error)}`);
    }
  };
  return <>
    {handles.map(h=>{
      const active=!!current&&h.id===current.id;
      return <mesh key={h.id} position={h.position} renderOrder={20} onPointerDown={e=>{e.stopPropagation();selectIndices(h.indices)}}>
        {kind==='edge'?<boxGeometry args={[10,10,10]}/>:<sphereGeometry args={[7,10,8]}/>}
        <meshBasicMaterial color={active?'#ffc966':kind==='edge'?'#a6dbff':'#ff9b6c'} depthTest={false}/>
      </mesh>
    })}
    {origin&&<>
      <group ref={pivot} position={origin}/>
      <TransformControls object={pivot} mode="translate" size={controlsConfig.gizmoSize*.8}
        translationSnap={snapping?snap:undefined}
        onMouseDown={()=>{start.current=pivot.current?.position.clone()||null}}
        onMouseUp={commit}/>
    </>}
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
function EntityStudioPreview({modelPath,gameDir,skin=0,body=0}:{modelPath:string;gameDir:string;skin?:number;body?:number}){
  const [data,setData]=useState<StudioPreview|null>(null);
  useEffect(()=>{
    let active=true;setData(null);
    if(!gameDir||!/^models\/[\w ./\-]+\.mdl$/i.test(modelPath)||modelPath.includes('..'))return;
    loadModelByPath(gameDir,modelPath).then(result=>{if(active)setData(result)}).catch(()=>{});
    return()=>{active=false};
  },[gameDir,modelPath]);
  if(!data)return null;
  return <group><StudioModel data={data} skin={skin} body={body}/></group>;
}
/** Directional spotlight guide. This is a preview, never the SC-RAD result. */
function SpotLightPreview({entity,tint,intensity,selected,shadows=false}:{entity:PointEntity;tint:string;intensity:number;selected:boolean;shadows?:boolean}){
 const angle=Math.PI/180*Math.min(89,Math.max(1,Number(entity.props._cone2)||55))/2;
 const yaw=Number(entity.props.angles?.split(' ')[1])||0;
 const pitch=Number(entity.props.pitch)||-45;
 const target=useMemo(()=>{const o=new THREE.Object3D();o.position.set(0,-200,0);return o},[]);
 return <group rotation={[0,THREE.MathUtils.degToRad(yaw),THREE.MathUtils.degToRad(pitch+90)]}>
  <primitive object={target}/><spotLight color={tint} intensity={intensity} angle={angle} distance={850} decay={2} penumbra={.32} target={target} castShadow={shadows} shadow-mapSize={[512,512]} shadow-bias={-.0003}/>
  {selected&&<mesh position={[0,-110,0]} rotation={[0,0,0]}><coneGeometry args={[Math.tan(angle)*220,220,24,1,true]}/><meshBasicMaterial color={tint} wireframe transparent opacity={.36} side={THREE.DoubleSide} depthWrite={false}/></mesh>}
 </group>;
}
function EntityVisual({object,routeText,routeTint,hideLabel=false,activeLight=true,activeModel=true}:{object:PointEntity;routeText?:string;routeTint?:string;hideLabel?:boolean;activeLight?:boolean;activeModel?:boolean}){
  const showNames=useEditor(s=>s.showEntityNames);
  const gameDir=useEditor(s=>s.settings.gameDir);
  const fgdClasses=useEditor(s=>s.fgdClasses);
  const fgdStudio=useMemo(()=>fgdClasses.find(c=>c.name===object.classname)?.studio,[fgdClasses,object.classname]);
  const modelPath=object.props.model?.startsWith('models/')?object.props.model:fgdStudio;
  const appearance=useEditor(s=>s.entityAppearance);
  const placementShape=useEditor(s=>s.placementShape);
  const audioPlacement=useEditor(s=>s.audioPlacement);
  const modal=useEditor(s=>s.modalTransform);
  const environmentPlacement=useEditor(s=>s.environmentPlacement);
  const environmentPreview=useEditor(s=>s.environmentPreview);
  const shadows=useEditor(s=>s.previewShadows&&s.environmentPreview);
  const ranges=useEditor(s=>s.showLightRanges&&s.environmentPreview);
  const selected=useEditor(s=>s.selectedIds.includes(object.id));
  const multiCount=useEditor(s=>s.selectedIds.length);
  const selectObject=useEditor(s=>s.selectObject);
  const update=useEditor(s=>s.updateObject);
  const drawMode=useEditor(s=>s.drawMode);
  const mode=useEditor(s=>s.mode);
  const groupRef=useRef<THREE.Group>(null!);
  useVisualGroup(object.id,!!object.hidden,groupRef);
  const snap=useEditor(s=>s.snap),snapping=useEditor(s=>s.snapping),controlsConfig=useEditor(s=>s.controls);
  if(object.hidden)return null;
  const isAudio=['ambient_generic','ambient_music','env_sound'].includes(object.classname);
  const isLight=object.classname.startsWith('light');
  const isSpawn=object.classname==='info_player_start';
  const parsedLight=parseLight(object.props._light);
  const lightTint=rgbHex(parsedLight.rgb);
  const lightIntensity=Math.min(16,Math.max(.08,parsedLight.brightness/110));
  const color=routeTint||appearance.colors[entityColorKind(object.classname)];
  const content=<group ref={groupRef} position={gameToThree(object.position)} userData={{entityId:object.id}}>
    <mesh geometry={isLight?entityMarkerGeometry.light:isSpawn?entityMarkerGeometry.spawn:entityMarkerGeometry.box}
      material={markerMaterial(color,selected)} userData={{entityId:object.id}} scale={appearance.markerSize}
      onPointerDown={e=>{if(e.button!==0||drawMode||placementShape||audioPlacement||environmentPlacement)return;e.stopPropagation();if(!object.locked){
        if(selected&&multiCount>1&&!e.shiftKey&&!e.ctrlKey&&!e.metaKey)return;
        selectObject(object.id,e.shiftKey||e.ctrlKey||e.metaKey);
      }}}/>

    {isAudio&&<group><mesh rotation={[Math.PI/2,0,0]}><torusGeometry args={[17,3.5,8,24]}/><meshBasicMaterial color={selected?'#fff0aa':'#67dfee'} toneMapped={false}/></mesh><mesh><sphereGeometry args={[6,8,8]}/><meshBasicMaterial color="#7ee6e8"/></mesh></group>}
    {activeModel&&modelPath&&gameDir&&!isLight&&<group onPointerDown={e=>{if(e.button!==0||object.locked||drawMode||placementShape||audioPlacement)return;e.stopPropagation();selectObject(object.id,e.shiftKey||e.ctrlKey||e.metaKey)}} rotation={[0,THREE.MathUtils.degToRad(Number(object.props.angles?.split(' ')[1])||0),0]}><EntityStudioPreview modelPath={modelPath} gameDir={gameDir} skin={Number(object.props.skin)||0} body={Number(object.props.body)||0}/></group>}
    {selected&&<mesh><sphereGeometry args={[16,12,8]}/><meshBasicMaterial color="#65befa" wireframe transparent opacity={.35}/></mesh>}
    {isLight&&object.classname==='light'&&ranges&&<mesh raycast={()=>null} scale={Math.min(2500,Math.max(280,parsedLight.brightness*2.2))}><sphereGeometry args={[1,16,12]}/><meshBasicMaterial color={lightTint} transparent wireframe opacity={.13} depthWrite={false} depthTest={false}/></mesh>}
    {isLight&&activeLight&&object.classname==='light'&&<pointLight color={environmentPreview?lightTint:'#ffebc1'} intensity={environmentPreview?lightIntensity:4} distance={environmentPreview?Math.min(2500,Math.max(280,parsedLight.brightness*2.2)):400} decay={2} castShadow={shadows&&selected} shadow-mapSize={[512,512]} shadow-bias={-.0003}/>}
    {isLight&&activeLight&&object.classname==='light_spot'&&<SpotLightPreview entity={object} tint={environmentPreview?lightTint:'#ffebc1'} intensity={environmentPreview?lightIntensity:4} selected={selected} shadows={shadows&&selected}/>}
    {isLight&&activeLight&&object.classname==='light_environment'&&environmentPreview&&<directionalLight color={lightTint} intensity={Math.min(2.8,lightIntensity*.34)} position={[400,900,400]} castShadow={shadows&&selected} shadow-mapSize={[1024,1024]} shadow-camera-left={-1600} shadow-camera-right={1600} shadow-camera-top={1600} shadow-camera-bottom={-1600}/>}
    {isLight&&selected&&<mesh><sphereGeometry args={[Math.min(220,Math.max(48,parsedLight.brightness*.28)),24,12]}/><meshBasicMaterial color={lightTint} wireframe transparent opacity={.16} depthWrite={false}/></mesh>}
  </group>;
  const commit=()=>{
    const g=groupRef.current;if(!g)return;
    let p=threeToGame(g.position);
    if(snapping)p=p.map(v=>Math.round(v/snap)*snap) as Vec3;
    if(p.some((v,i)=>Math.abs(v-object.position[i])>.01))update(object.id,{position:p});
  };
  // Render the label at an independent WORLD anchor rather than as a child
  // of the transformed marker. This also fixes the missing player-spawn name.
  const showLabel=(showNames||isSpawn&&appearance.alwaysShowSpawn)&&(!hideLabel||selected);
  const worldLabel=gameToThree([object.position[0],object.position[1],object.position[2]+(isSpawn?64:45)]);
  return <>{content}{showLabel&&<EntityNameLabel classname={routeText||object.classname||object.name} targetname={object.props.targetname}
    position={[worldLabel.x,worldLabel.y,worldLabel.z]} selected={selected} color={color} isSpawn={isSpawn}/>} {selected&&multiCount===1&&!object.locked&&!modal&&mode==='translate'&&<TransformControls object={groupRef} mode="translate" onMouseUp={commit}
    translationSnap={snapping?snap:undefined} size={controlsConfig.gizmoSize}/>}</>;
}
/** Blender navigation: MMB orbit, Shift+MMB pan, Ctrl+MMB dolly.
 * Classic navigation remains available as an alternative. Camera shortcuts
 * (numpad views, orthographic toggle, frame selection) are real camera moves. */
function CameraController(){
  const controls=useRef<OrbitControlsImpl>(null);
  const keys=useRef<Set<string>>(new Set());
  const {camera,set,size,gl}=useThree();
  const initialPerspective=useRef(camera as THREE.PerspectiveCamera);
  const ortho=useMemo(()=>new THREE.OrthographicCamera(-600,600,450,-450,.5,280000),[]);
  const lastTarget=useRef(new THREE.Vector3(0,100,0));
  const command=useEditor(s=>s.cameraCommand),controlsConfig=useEditor(s=>s.controls);
  const modal=useEditor(s=>s.modalTransform);
  const uvDragging=useEditor(s=>s.textureDragSnapshot!==null);
  const setCameraLabel=useEditor(s=>s.setCameraLabel);
  const flyMode=useEditor(s=>s.flyMode),drawMode=useEditor(s=>s.drawMode);
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
  const saveCamera=()=>{
    if(cameraSaveTimer.current!==null)clearTimeout(cameraSaveTimer.current);
    cameraSaveTimer.current=setTimeout(()=>{
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
  useEffect(()=>{
    const onHide=()=>{
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
      if(controls.current)controls.current.enabled=!useEditor.getState().modalTransform&&!useEditor.getState().drawMode&&!useEditor.getState().textureDragSnapshot;
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
    if(!flyMode){
      if(document.pointerLockElement===gl.domElement)document.exitPointerLock?.();
      return;
    }
    const onPointerLockChange=()=>{
      if(document.pointerLockElement!==gl.domElement&&useEditor.getState().flyMode)
        useEditor.getState().setFly(false);
    };
    const onMouseMove=(e:MouseEvent)=>{
      if(document.pointerLockElement!==gl.domElement||!controls.current||useEditor.getState().textureDragSnapshot)return;
      const dir=new THREE.Vector3();camera.getWorldDirection(dir);
      const sensitivity=.0022*controlsConfig.orbitSensitivity*controlsConfig.flyLookSensitivity*(controlsConfig.invertOrbit?-1:1);
      const yaw=Math.atan2(dir.x,-dir.z)+e.movementX*sensitivity;
      const pitch=THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(dir.y,-1,1))-e.movementY*sensitivity,-1.46,1.46);
      dir.set(Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),-Math.cos(yaw)*Math.cos(pitch));
      controls.current.target.copy(camera.position).addScaledVector(dir,600);
      lastTarget.current.copy(controls.current.target);
      controls.current.update();
    };
    document.addEventListener('pointerlockchange',onPointerLockChange);
    document.addEventListener('mousemove',onMouseMove);
    return()=>{document.removeEventListener('pointerlockchange',onPointerLockChange);document.removeEventListener('mousemove',onMouseMove)};
  },[flyMode,camera,gl,controlsConfig.orbitSensitivity,controlsConfig.flyLookSensitivity,controlsConfig.invertOrbit]);
  useEffect(()=>{
    if(!controls.current)return;
    controls.current.target.copy(lastTarget.current);
    controls.current.update();
  },[camera]);
  useEffect(()=>{
    const keydown=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]')||document.querySelector('.modal-backdrop'))return;
      keys.current.add(e.key.toLowerCase());
    };
    const keyup=(e:KeyboardEvent)=>keys.current.delete(e.key.toLowerCase());
    const onblur=()=>keys.current.clear();
    window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',onblur);
    return()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',onblur)};
  },[]);
  useFrame((_state,delta)=>{
    if(modal||uvDragging||!controls.current||(!flyMode&&blender))return;
    const active=keys.current;
    const forward=new THREE.Vector3(),right=new THREE.Vector3();camera.getWorldDirection(forward);
    forward.y=0;forward.normalize();right.crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
    const move=new THREE.Vector3();
    if(active.has('w'))move.add(forward);if(active.has('s'))move.sub(forward);
    if(active.has('d'))move.add(right);if(active.has('a'))move.sub(right);
    if(active.has('e'))move.y+=1;if(active.has('q'))move.y-=1;
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
      if(dest===camera){orbit.target.copy(target);orbit.update()}
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
      const objects=useEditor.getState().project.objects.filter(o=>!o.hidden&&(action==='frame'?useEditor.getState().selectedIds.includes(o.id):true));
      if(!objects.length)return;
      const bounds=new THREE.Box3();
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
  return <OrbitControls ref={controls} makeDefault enabled={!modal&&!drawMode&&!uvDragging}
    onChange={saveCamera} enableDamping={controlsConfig.cameraDamping} dampingFactor={controlsConfig.dampingFactor}
    zoomToCursor={controlsConfig.zoomToCursor}
    enablePan={!drawMode} maxDistance={Math.max(controlsConfig.maxCameraDistance,controlsConfig.minCameraDistance+100)} minDistance={controlsConfig.minCameraDistance}
    rotateSpeed={(controlsConfig.invertOrbit?-1:1)*controlsConfig.orbitSensitivity}
    panSpeed={controlsConfig.panSensitivity} zoomSpeed={controlsConfig.zoomSensitivity}
    mouseButtons={blender?
      {LEFT:-1 as THREE.MOUSE,MIDDLE:THREE.MOUSE.ROTATE,RIGHT:flyMode?THREE.MOUSE.ROTATE:-1 as THREE.MOUSE}:
      {LEFT:THREE.MOUSE.PAN,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.ROTATE}}/>;
}
function Ground(){const show=useEditor(s=>s.showGrid);return show?<gridHelper args={[4096,256,'#44637e','#334253']} rotation={[0,0,0]} position={[0,-.15,0]}/>:null}
/**
 * Move every selected brush/entity in real time, then commit ONE undoable change
 * on mouse release. TransformControls moves only the pivot, so visual groups
 * must be previewed explicitly. The editor's positions are changed only once.
 */
function MultiSelectionControls(){
  const ids=useEditor(s=>s.selectedIds),mode=useEditor(s=>s.mode);
  const cameraLabel=useEditor(s=>s.cameraLabel);
  const modal=useEditor(s=>s.modalTransform);
  const objects=useEditor(s=>s.project.objects);
  const snapping=useEditor(s=>s.snapping),snap=useEditor(s=>s.snap),controlsConfig=useEditor(s=>s.controls);
  const transformSelection=useEditor(s=>s.transformSelection);
  const members=objects.filter(o=>ids.includes(o.id)&&!o.locked);
  const center:Vec3=members.reduce<Vec3>((p,o)=>p.map((v,i)=>v+o.position[i]/Math.max(1,members.length)) as Vec3,[0,0,0]);
  const pivot=useRef<THREE.Group>(null!);
  type Pose={position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3};
  const drag=useRef<{start:THREE.Vector3;positions:Map<string,Pose>}|null>(null);
  if(ids.length<2||!members.length||mode==='select'||modal)return null;
  const begin=()=>{
    drag.current={start:gameToThree(center),positions:new Map(members.map(o=>[o.id,{
      position:gameToThree(o.position),quaternion:o.kind==='brush'?toRenderQuaternion(o.rotation):new THREE.Quaternion(),
      scale:o.kind==='brush'?new THREE.Vector3(o.scale[0],o.scale[2],o.scale[1]):new THREE.Vector3(1,1,1)
    }]))};
  };
  const poseFor=(original:Pose)=>{
    const p=pivot.current,origin=drag.current!.start;
    const position=original.position.clone().sub(origin);
    if(mode==='rotate')position.applyQuaternion(p.quaternion);
    if(mode==='scale')position.multiply(p.scale);
    position.add(p.position);
    const quaternion=original.quaternion.clone();
    if(mode==='rotate')quaternion.premultiply(p.quaternion);
    const scale=original.scale.clone();if(mode==='scale')scale.multiply(p.scale);
    return {position,quaternion,scale};
  };
  const preview=()=>{
    if(!drag.current||!pivot.current)return;
    for(const [id,original] of drag.current.positions){
      const visual=visualGroups.get(id);if(!visual)continue;
      const next=poseFor(original);
      visual.position.copy(next.position);
      visual.quaternion.copy(next.quaternion);
      visual.scale.copy(next.scale);
    }
  };
  const commit=()=>{
    if(!drag.current||!pivot.current)return;
    const session=drag.current;
    const updates:Record<string,{position:Vec3;rotation?:Vec3;scale?:Vec3}>={};
    let changed=false;
    for(const [id,original] of session.positions){
      const next=poseFor(original);
      const o=members.find(o=>o.id===id);
      if(o){
        let pos=threeToGame(next.position);
        if(mode==='translate'&&snapping){
          const raw=threeToGame(pivot.current.position.clone().sub(session.start));
          const delta=raw.map(v=>Math.round(v/snap)*snap) as Vec3;
          pos=o.position.map((v,i)=>v+delta[i]) as Vec3;
        }
        const rotation=mode==='rotate'&&o.kind==='brush'?fromRenderQuaternion(next.quaternion):undefined;
        const scale:Vec3|undefined=mode==='scale'&&o.kind==='brush'?[next.scale.x,next.scale.z,next.scale.y].map(v=>Math.max(.05,Math.abs(v))) as Vec3:undefined;
        updates[id]={position:pos,...(rotation?{rotation}:{}),...(scale?{scale}:{})};
        if(pos.some((v,i)=>Math.abs(v-o.position[i])>.001) || (o.kind==='brush' &&
          (rotation?.some((v,i)=>Math.abs(v-o.rotation[i])>.001)||scale?.some((v,i)=>Math.abs(v-o.scale[i])>.001))))changed=true;
      }
      const v=visualGroups.get(id);
      if(v){v.position.copy(original.position);v.quaternion.copy(original.quaternion);v.scale.copy(original.scale)}
    }
    drag.current=null;
    pivot.current.position.copy(session.start);pivot.current.quaternion.identity();pivot.current.scale.set(1,1,1);
    if(changed)transformSelection(updates);
  };
  return <>
    <group ref={pivot} position={gameToThree(center)}/>
    <TransformControls object={pivot} mode={mode} onMouseDown={begin} onObjectChange={preview} onMouseUp={commit}
      space="world" translationSnap={snapping?snap:undefined}
      rotationSnap={controlsConfig.rotationSnapDegrees?THREE.MathUtils.degToRad(controlsConfig.rotationSnapDegrees):undefined}
      scaleSnap={controlsConfig.scaleSnapStep||undefined} size={controlsConfig.gizmoSize*(cameraLabel.includes('Ortho')?1.65:1.1)}/>
  </>;
}
/** Real Blender-like modal transform: the mouse drives all selected objects;
 * neither the camera nor the gizmo handles pointer motion during G/R/C.
 * Preview is transient; a single undoable project change is made on confirmation.
 * X/Y/Z constrain the global Svengine axes; numbers specify units/degrees/factor.
 */
function BlenderModalTransform(){
  const modal=useEditor(s=>s.modalTransform),finish=useEditor(s=>s.modalFinish);
  const ids=useEditor(s=>s.selectedIds),objects=useEditor(s=>s.project.objects);
  const controls=useEditor(s=>s.controls),snapping=useEditor(s=>s.snapping),snap=useEditor(s=>s.snap);
  const transformSelection=useEditor(s=>s.transformSelection),complete=useEditor(s=>s.completeModalTransform);
  const {camera,gl,size}=useThree();
  const cursor=useRef<{x:number;y:number}|null>(null);
  const session=useRef<{
    start:{x:number;y:number};center:THREE.Vector3;mode:'translate'|'rotate'|'scale';
    original:Map<string,{position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3;kind:'brush'|'entity'}>;
    result:Map<string,{position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3}>;
    axis:'X'|'Y'|'Z'|null;numeric:string;
  }|null>(null);
  const handled=useRef(0);
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
    const data:{start:typeof start;center:THREE.Vector3;mode:'translate'|'rotate'|'scale';original:typeof origin;
      result:Map<string,{position:THREE.Vector3;quaternion:THREE.Quaternion;scale:THREE.Vector3}>;axis:'X'|'Y'|'Z'|null;numeric:string}=
      {start,center,mode:modal.mode,original:origin,result:new Map(),axis:null,numeric:''};
    session.current=data;
    const axisVector=()=>data.axis==='X'?new THREE.Vector3(1,0,0):data.axis==='Y'?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
    const hud=()=>document.getElementById('studio-modal-readout');
    const preview=(current:{x:number;y:number},fine:boolean=false)=>{
      if(session.current!==data)return;
      const dx=(current.x-data.start.x)*(fine?.15:1),dy=(data.start.y-current.y)*(fine?.15:1);
      const unitPerPixel=camera instanceof THREE.OrthographicCamera
        ?(camera.top-camera.bottom)/Math.max(1,size.height)/camera.zoom
        :2*Math.max(50,camera.position.distanceTo(data.center))*Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov)/2)/Math.max(1,size.height);
      const right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
      const up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      const delta=right.multiplyScalar(dx*unitPerPixel).addScaledVector(up,dy*unitPerPixel);
      let numberValue=Number(data.numeric);
      if(!Number.isFinite(numberValue)||data.numeric==='-'||data.numeric==='.')numberValue=0;
      const isNumeric=!!data.numeric&&data.numeric!=='-'&&data.numeric!=='.';
      let amount=0,rotation=new THREE.Quaternion(),stretch=new THREE.Vector3(1,1,1);
      const axis=axisVector();
      if(data.mode==='translate'){
        if(data.axis){
          const p1=data.center.clone().project(camera),p2=data.center.clone().addScaledVector(axis,100).project(camera);
          const width=Math.max(1,rect.width),height=Math.max(1,rect.height);
          const ax=(p2.x-p1.x)*width/2,ay=(p2.y-p1.y)*height/2;
          const denom=ax*ax+ay*ay;
          amount=denom>1e-4?100*(dx*ax+dy*ay)/denom:0;
          if(isNumeric)amount=numberValue;
          if(snapping)amount=Math.round(amount/snap)*snap;
          delta.copy(axis).multiplyScalar(amount);
        }else if(isNumeric){delta.normalize().multiplyScalar(numberValue)}
        if(snapping&&!data.axis){
          const g=threeToGame(delta).map(n=>Math.round(n/snap)*snap) as Vec3;
          delta.copy(gameToThree(g));
        }
      }else if(data.mode==='rotate'){
        // Unconstrained rotation follows camera view; X/Y/Z are world axes.
        const rotateAxis=data.axis?axis:new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
        amount=isNumeric?numberValue:dx*.45;
        if(controls.rotationSnapDegrees)amount=Math.round(amount/controls.rotationSnapDegrees)*controls.rotationSnapDegrees;
        rotation.setFromAxisAngle(rotateAxis,THREE.MathUtils.degToRad(amount));
      }else{
        amount=isNumeric?numberValue:Math.exp((dx+dy)*.006);
        amount=Math.max(.05,Math.min(100,amount));
        if(controls.scaleSnapStep)amount=Math.max(.05,Math.round(amount/controls.scaleSnapStep)*controls.scaleSnapStep);
        if(data.axis)stretch.set(data.axis==='X'?amount:1,data.axis==='Z'?amount:1,data.axis==='Y'?amount:1);
        else stretch.setScalar(amount);
      }
      data.result.clear();
      for(const [id,pose] of data.original){
        const position=pose.position.clone(),quaternion=pose.quaternion.clone(),scale=pose.scale.clone();
        if(data.mode==='translate')position.add(delta);
        else {
          position.sub(data.center);
          if(data.mode==='rotate'){position.applyQuaternion(rotation);quaternion.premultiply(rotation)}
          else {position.multiply(stretch);scale.multiply(stretch)}
          position.add(data.center);
        }
        data.result.set(id,{position,quaternion,scale});
        const visual=visualGroups.get(id);
        if(visual){visual.position.copy(position);visual.quaternion.copy(quaternion);visual.scale.copy(scale)}
      }
      const readout=hud();if(readout)readout.textContent=`${data.axis?data.axis+' · ':''}${isNumeric?data.numeric:data.mode==='translate'?threeToGame(delta).map(v=>v.toFixed(0)).join(' / ')+' u':data.mode==='rotate'?amount.toFixed(1)+'°':amount.toFixed(2)+'×'}`;
    };
    const move=(e:PointerEvent)=>{preview({x:e.clientX,y:e.clientY},e.shiftKey)};
    const key=(e:KeyboardEvent)=>{
      if((e.target as HTMLElement)?.closest('input,textarea,select,[contenteditable]'))return;
      if(['KeyX','KeyY','KeyZ'].includes(e.code)&&!e.ctrlKey&&!e.altKey&&!e.repeat){
        e.preventDefault();data.axis=data.axis===e.code.slice(-1)?null:e.code.slice(-1) as 'X'|'Y'|'Z';
        preview(cursor.current??data.start,e.shiftKey);return;
      }
      if(e.key==='Enter'){e.preventDefault();useEditor.getState().finishModalTransform(true);return}
      if(e.key==='Backspace'&&data.numeric){e.preventDefault();data.numeric=data.numeric.slice(0,-1);preview(cursor.current??data.start);return}
      if(!e.ctrlKey&&!e.altKey&&!e.metaKey&&/^[0-9.\-]$/.test(e.key)){
        e.preventDefault();if(e.key==='.'&&data.numeric.includes('.'))return;
        if(e.key==='-'&&data.numeric.length)return;
        data.numeric+=e.key;preview(cursor.current??data.start,e.shiftKey);
      }
    };
    const click=(e:PointerEvent)=>{
      if(!gl.domElement.contains(e.target as Node))return;
      if(e.button===0||e.button===2){e.stopImmediatePropagation();e.preventDefault();useEditor.getState().finishModalTransform(e.button===0)}
    };
    window.addEventListener('pointermove',move);
    window.addEventListener('keydown',key);
    window.addEventListener('pointerdown',click,true);
    preview(start);
    return()=>{
      window.removeEventListener('pointermove',move);
      window.removeEventListener('keydown',key);
      window.removeEventListener('pointerdown',click,true);
      for(const [id,pose] of data.original){const visual=visualGroups.get(id);if(visual){visual.position.copy(pose.position);visual.quaternion.copy(pose.quaternion);visual.scale.copy(pose.scale)}}
      if(session.current===data)session.current=null;
    };
  // Every modal session captures its own original objects; don't recreate it as the mouse moves.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[modal?.serial,camera,gl]);
  useEffect(()=>{
    if(!finish||!modal||!session.current||finish.serial===handled.current)return;
    handled.current=finish.serial;
    const data=session.current;
    if(finish.commit){
      const updates:Record<string,{position:Vec3;rotation?:Vec3;scale?:Vec3}>={};
      for(const [id,pose] of data.result){
        const original=data.original.get(id);if(!original)continue;
        updates[id]={position:threeToGame(pose.position)};
        if(original.kind==='brush'){
          updates[id].rotation=fromRenderQuaternion(pose.quaternion);
          updates[id].scale=[Math.max(.05,pose.scale.x),Math.max(.05,pose.scale.z),Math.max(.05,pose.scale.y)];
        }
      }
      transformSelection(updates);
    }
    complete();
  },[finish,modal,complete,transformSelection]);
  return null;
}

function DrawBrushPlane(){
  const enabled=useEditor(s=>s.drawMode),height=useEditor(s=>s.drawHeight);
  const add=useEditor(s=>s.addDrawnBox),snapping=useEditor(s=>s.snapping),snap=useEditor(s=>s.snap);
  const dragStart=useRef<Vec3|null>(null);
  const [end,setEnd]=useState<Vec3|null>(null);
  const floorPoint=(v:THREE.Vector3):Vec3=>{
    const game=threeToGame(v);
    const step=snapping?snap:1;
    return [Math.round(game[0]/step)*step,Math.round(game[1]/step)*step,0];
  };
  const from=dragStart.current;
  const dx=from&&end?Math.abs(end[0]-from[0]):0;
  const dy=from&&end?Math.abs(end[1]-from[1]):0;
  return enabled?<>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,1,0]}
      onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();dragStart.current=floorPoint(e.point);setEnd(dragStart.current);(e.target as unknown as Element | null)?.setPointerCapture?.(e.pointerId)}}
      onPointerMove={e=>{if(!dragStart.current)return;e.stopPropagation();setEnd(floorPoint(e.point))}}
      onPointerUp={e=>{if(!dragStart.current)return;e.stopPropagation();const final=floorPoint(e.point);const start=dragStart.current;dragStart.current=null;setEnd(null);try{add(start,final)}catch(err){useEditor.getState().appendLogs([`Draw block: ${String(err)}`])}(e.target as unknown as Element | null)?.releasePointerCapture?.(e.pointerId)}}
      onPointerCancel={()=>{dragStart.current=null;setEnd(null)}}>
      <planeGeometry args={[30000,30000]}/><meshBasicMaterial transparent opacity={0.03} color="#6fbbff" side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>
    {from&&end&&<mesh position={gameToThree([(from[0]+end[0])/2,(from[1]+end[1])/2,height/2])}>
      <boxGeometry args={[Math.max(snapping?snap:1,dx),height,Math.max(snapping?snap:1,dy)]}/>
      <meshBasicMaterial color="#74c6ff" transparent opacity={.24} depthTest={false} depthWrite={false}/>
    </mesh>}
  </>:null;
}

/** Click-to-place with a ground/brush surface snap and transparent 3D preview.
 * Intercepts the canvas pointer events only while a primitive tool is armed. */
function PrimitivePlacement(){
  const shape=useEditor(s=>s.placementShape);
  const {camera,scene,gl}=useThree();
  const group=useRef<THREE.Group>(null);
  const preview=useMemo(()=>shape?createPlaceableShape(shape,[0,0,0]):[],[shape]);
  const geometries=useMemo(()=>preview.map(buildMeshGeometry),[preview]);
  useEffect(()=>()=>geometries.forEach(g=>g.dispose()),[geometries]);
  useEffect(()=>{
    if(!shape)return;
    const target=gl.domElement;
    const floor=new THREE.Plane(new THREE.Vector3(0,1,0),0);
    const pointAt=(event:PointerEvent):Vec3|null=>{
      const bounds=target.getBoundingClientRect();
      if(bounds.width===0||bounds.height===0)return null;
      const screen=new THREE.Vector2((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
      const ray=new THREE.Raycaster();ray.setFromCamera(screen,camera);
      const hit=ray.intersectObjects(scene.children,true).find(item=>item.object.userData.brushId);
      const normal=hit?.face?.normal?.clone();
      if(hit&&normal){
        normal.transformDirection(hit.object.matrixWorld).normalize();
        const p=hit.point.clone();
        const game=threeToGame(p);
        const gameNormal=threeToGame(normal);
        // Place on the face, just outside it. At a vertical wall, align the
        // center to the clicked height, because shapes anchor at their bottom.
        const isWall=Math.abs(gameNormal[2])<.5;
        const extent=64;
        return [game[0]+gameNormal[0]*(isWall?extent:1),
          game[1]+gameNormal[1]*(isWall?extent:1),
          game[2]+gameNormal[2]*(gameNormal[2]<-.5?128:1)-(isWall?64:0)];
      }
      const p=new THREE.Vector3();
      return ray.ray.intersectPlane(floor,p)?threeToGame(p):null;
    };
    const move=(event:PointerEvent)=>{
      if(!group.current)return;
      const p=pointAt(event);
      group.current.visible=!!p;
      if(!p)return;
      const state=useEditor.getState();const step=state.snapping?state.snap:1;
      const snapped=p.map(v=>Math.round(v/step)*step) as Vec3;
      group.current.position.copy(gameToThree(snapped));
    };
    const down=(event:PointerEvent)=>{
      if(event.button!==0)return;
      const p=pointAt(event);
      if(!p)return;
      event.preventDefault();event.stopImmediatePropagation();
      useEditor.getState().placeShapeAt(p);
    };
    const leave=()=>{if(group.current)group.current.visible=false};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){
      event.preventDefault();event.stopImmediatePropagation();useEditor.getState().setPlacementShape(null);
    }};
    target.addEventListener('pointermove',move);
    target.addEventListener('pointerdown',down,true);
    target.addEventListener('pointerleave',leave);
    window.addEventListener('keydown',key,true);
    return()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerdown',down,true);target.removeEventListener('pointerleave',leave);window.removeEventListener('keydown',key,true)};
  },[shape,camera,scene,gl]);
  if(!shape)return null;
  return <group ref={group} visible={false}>{preview.map((brush,i)=>
    <mesh key={`${shape}-${i}`} geometry={geometries[i]} position={gameToThree(brush.position)}>
      <meshBasicMaterial color="#63e7ff" transparent opacity={.35} side={THREE.DoubleSide} depthWrite={false}/>
    </mesh>)}</group>;
}

/** Native Svengine light/fog placement, intercepting the editor canvas only while armed. */
function EnvironmentPlacement(){
 const kind=useEditor(s=>s.environmentPlacement);
 const {camera,scene,gl}=useThree();const marker=useRef<THREE.Group>(null);
 useEffect(()=>{
  if(!kind)return;
  const target=gl.domElement,plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
  const hit=(e:PointerEvent):Vec3|null=>{
   const rect=target.getBoundingClientRect();if(!rect.width||!rect.height)return null;
   const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height),camera);
   const surface=ray.intersectObjects(scene.children,true).find(x=>x.object.userData.brushId);
   if(surface)return threeToGame(surface.point.clone().add(new THREE.Vector3(0,8,0)));
   const point=new THREE.Vector3();return ray.ray.intersectPlane(plane,point)?threeToGame(point):null;
  };
  const move=(e:PointerEvent)=>{if(!marker.current)return;const p=hit(e);marker.current.visible=!!p;if(p)marker.current.position.copy(gameToThree(p))};
  const down=(e:PointerEvent)=>{if(e.button!==0)return;const p=hit(e);if(!p)return;e.preventDefault();e.stopImmediatePropagation();
   const state=useEditor.getState();const step=state.snapping?state.snap:1;state.placePendingEnvironment(p.map(v=>Math.round(v/step)*step) as Vec3);
  };
  const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();useEditor.getState().startEnvironmentPlacement(null)}};
  target.addEventListener('pointermove',move);target.addEventListener('pointerdown',down,true);window.addEventListener('keydown',esc,true);
  return()=>{target.removeEventListener('pointermove',move);target.removeEventListener('pointerdown',down,true);window.removeEventListener('keydown',esc,true)};
 },[kind,camera,scene,gl]);
 return kind?<group ref={marker} visible={false}><mesh><octahedronGeometry args={[24,0]}/><meshBasicMaterial color={kind.kind==='env_fog'?'#76d8f2':'#ffdf6b'} transparent opacity={.65} depthTest={false}/></mesh></group>:null;
}

function TextureDropHandler(){
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
        const surface=hits.find(hit=>{
          let node:THREE.Object3D|null=hit.object;
          while(node){if(node.userData.brushId)return true;node=node.parent}return false;
        });
        const ground=new THREE.Vector3(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
        const point=surface?.point||ray.ray.intersectPlane(plane,ground);
        if(!point)return;
        const pos=threeToGame(point),grid=state.snapping?state.snap:1;
        const at=pos.map(v=>Math.round(v/grid)*grid) as Vec3;
        state.createAudioAt('ambient_generic',sound,at);
        state.appendLogs([`Svengine ambient_generic placed: ${sound}`]);return;
      }
      if(modelPath){
        if(!/^models\/[\w .\/-]+\.mdl$/i.test(modelPath)||modelPath.includes('..'))return;
        const state=useEditor.getState();
        const target=hits.find(hit=>hit.object.userData.entityId);
        const id=target?.object.userData.entityId as string|undefined;
        const entity=state.project.objects.find(o=>o.id===id&&o.kind==='entity') as PointEntity|undefined;
        if(entity){state.setObjectProp(entity.id,'model',modelPath);state.setSelected(entity.id);state.appendLogs([`Model assigned to ${entity.classname}: ${modelPath}`]);return}
        const surface=hits.find(hit=>(hit.object as THREE.Mesh).userData.brushId);
        const p=new THREE.Vector3();const plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
        const point=surface?.point||ray.ray.intersectPlane(plane,p);
        if(point){
          const xy=threeToGame(point);const snap=state.snapping?state.snap:1;
          const at=xy.map((v,i)=>Math.round((v+(i===2?3:0))/snap)*snap) as Vec3;
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
          const surface=hits.find(hit=>(hit.object as THREE.Mesh).userData.brushId);
          const onFloor=new THREE.Vector3();const floor=new THREE.Plane(new THREE.Vector3(0,1,0),0);
          const point=surface?.point||ray.ray.intersectPlane(floor,onFloor);
          if(point){
            const state=useEditor.getState();const game=threeToGame(point);
            const grid=state.snapping?state.snap:1;
            const position=game.map((v,i)=>Math.round((v+(i===2?24:0))/grid)*grid) as Vec3;
            state.addEntity(cls,position);
            state.appendLogs([`Svengine entity placed: ${entityName} at ${position.join(' ')}`]);
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
/** NPC tools capture the next left click on the scene, then release it.
 * This is distinct from the Blender transform mode and ordinary selection.
 */
function NpcClickPlacement(){
  const {camera,scene,gl}=useThree();
  const npcClass=useEditor(s=>s.pendingNpcClass);
  const routeOwner=useEditor(s=>s.routePlacementFor);
  useEffect(()=>{
    if(!npcClass&&!routeOwner)return;
    const target=gl.domElement;
    const down=(e:PointerEvent)=>{
      if(e.button!==0)return;
      const state=useEditor.getState();
      if(!state.pendingNpcClass&&!state.routePlacementFor)return;
      const bounds=target.getBoundingClientRect();
      const ndc=new THREE.Vector2(2*(e.clientX-bounds.left)/bounds.width-1,1-2*(e.clientY-bounds.top)/bounds.height);
      const ray=new THREE.Raycaster();ray.setFromCamera(ndc,camera);
      const hits=ray.intersectObjects(scene.children,true);
      const surface=hits.find(hit=>{
        let node:THREE.Object3D|null=hit.object;
        while(node){if(node.userData.brushId)return true;node=node.parent;}return false;
      });
      const ground=new THREE.Vector3(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
      const point=surface?.point||ray.ray.intersectPlane(plane,ground);
      if(!point)return;
      const raw=threeToGame(point),snap=state.snapping?state.snap:1;
      const at=raw.map((v,i)=>Math.round((v+(i===2?(state.pendingNpcClass?24:4):0))/snap)*snap) as Vec3;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      try{
        if(state.routePlacementFor){state.placeWaypoint(state.routePlacementFor,at);state.appendLogs([`Svengine path_waypoint added at ${at.join(' ')}.`]);}
        else {const name=state.pendingNpcClass;state.placePendingNpc(at);state.appendLogs([`Svengine NPC placed: ${name} at ${at.join(' ')}.`]);}
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
function AudioClickPlacement(){
  const {camera,scene,gl}=useThree();const active=useEditor(s=>s.audioPlacement);
  useEffect(()=>{
    if(!active)return;
    const target=gl.domElement;
    const onDown=(e:PointerEvent)=>{
      if(e.button!==0||!useEditor.getState().audioPlacement)return;
      const bounds=target.getBoundingClientRect();
      const ndc=new THREE.Vector2(2*(e.clientX-bounds.left)/bounds.width-1,1-2*(e.clientY-bounds.top)/bounds.height);
      const ray=new THREE.Raycaster();ray.setFromCamera(ndc,camera);
      const hits=ray.intersectObjects(scene.children,true);
      const surface=hits.find(hit=>{let node:THREE.Object3D|null=hit.object;while(node){if(node.userData.brushId)return true;node=node.parent}return false});
      const ground=new THREE.Vector3(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
      const point=surface?.point||ray.ray.intersectPlane(plane,ground);if(!point)return;
      const state=useEditor.getState(),game=threeToGame(point),step=state.snapping?state.snap:1;
      const position=game.map(v=>Math.round(v/step)*step) as Vec3;
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
/** Editor-only indication; full game sound propagation requires the engine. */
function AudioRadiusGuides(){
  const selected=useEditor(s=>s.selected),objects=useEditor(s=>s.project.objects);
  const obj=objects.find(o=>o.id===selected&&o.kind==='entity') as PointEntity|undefined;
  const radius=obj?soundInfluence(obj):null;
  if(!obj||radius===null||radius<=0)return null;
  return <group position={gameToThree(obj.position)}><mesh><sphereGeometry args={[radius,32,18]}/><meshBasicMaterial color={obj.classname==='env_sound'?'#ad9aff':'#54e4fa'} transparent opacity={.1} wireframe depthTest={false} depthWrite={false}/></mesh></group>;
}
function NpcRouteLines(){
  const objects=useEditor(s=>s.project.objects);
  const selected=useEditor(s=>s.selected);
  const routeOwner=useEditor(s=>s.routePlacementFor);
  const routeSolo=useEditor(s=>s.routeSolo);
  const owner=objects.find(o=>o.kind==='entity'&&o.id===(routeOwner||selected));
  const candidates=objects.filter((o):o is PointEntity=>o.kind==='entity'&&isNpcOwner(o.classname));
  const activeOwner=routeSolo?candidates.find(o=>o.props.path_name===routeSolo):owner&&owner.kind==='entity'&&isNpcOwner(owner.classname)?owner:
    candidates.find(o=>traceNpcRoute(objects,o.id).nodes.some(n=>n.id===selected));
  if(!activeOwner)return null;
  const trace=traceNpcRoute(objects,activeOwner.id),nodes=[activeOwner,...trace.nodes];
  if(nodes.length<2)return null;
  return <>{nodes.slice(1).map((next,i)=>{
    const a=gameToThree(nodes[i].position),b=gameToThree(next.position);
    return <Line key={next.id} points={[a,b]} color={routeColor(activeOwner.props.path_name||'route')} lineWidth={3} dashed dashSize={9} gapSize={5} transparent opacity={.94}/>;
  })}</>;
}

function EntityConnections(){
  const selected=useEditor(s=>s.selected);
  const objects=useEditor(s=>s.project.objects);
  const source=objects.find(o=>o.id===selected&&o.kind==='entity') as PointEntity|undefined;
  if(!source?.props.target)return null;
  const targets=objects.filter(o=>o.kind==='entity'&&o.id!==source.id&&o.props.targetname===source.props.target) as PointEntity[];
  return <>{targets.map(target=><Line key={target.id} points={[gameToThree(source.position),gameToThree(target.position)]} color="#55f0d7" lineWidth={2} dashed dashSize={12} gapSize={8} transparent opacity={.82} />)}</>;
}
function MeasurementOverlay(){
  const active=useEditor(s=>s.measureMode),{a,b}=useEditor(s=>s.measurement);
  if(!active||!a)return null;
  const start=gameToThree(a),end=b?gameToThree(b):null;
  const mid=end?start.clone().add(end).multiplyScalar(.5):start;
  const distance=b?Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]):null;
  return <group>
    <mesh position={start} raycast={()=>null}><sphereGeometry args={[6,10,8]}/><meshBasicMaterial color="#ffdd7e" depthTest={false}/></mesh>
    {end&&<><mesh position={end} raycast={()=>null}><sphereGeometry args={[6,10,8]}/><meshBasicMaterial color="#ffdd7e" depthTest={false}/></mesh>
      <Line points={[start,end]} color="#ffde80" lineWidth={3} depthTest={false} raycast={()=>null}/>
      <Html position={mid} center style={{pointerEvents:'none'}}><div className="measurement-label"><strong>{distance!.toFixed(2)} u</strong><small>Δ {['X','Y','Z'].map((name,i)=>`${name} ${(b![i]-a[i]).toFixed(1)}`).join(' · ')}</small></div></Html>
    </>}
  </group>;
}
const MemoBrushVisual=memo(BrushVisual);
const MemoEntityVisual=memo(EntityVisual);
function Scene({onContextMenu}:{onContextMenu:(menu:SceneMenu)=>void}){
  const objects=useEditor(s=>s.project.objects),setSelected=useEditor(s=>s.setSelected);
  const showLights=useEditor(s=>s.showLights);
  const environmentPreview=useEditor(s=>s.environmentPreview),fogPreview=useEditor(s=>s.fogPreview);
  const skyname=useEditor(s=>s.project.world.skyname||'desert');
  const fogEntity=objects.find((o):o is PointEntity=>o.kind==='entity'&&o.classname==='env_fog'&&!o.hidden&&!(Number(o.props.spawnflags||0)&1));
  const fogStart=Number(fogEntity?.props.iuser2)||256,fogEnd=Number(fogEntity?.props.iuser3)||2048;
  const fogColor=fogEntity?rgbHex((fogEntity.props.rendercolor||'115 141 176').split(/\s+/).map(Number)):'#0b1325';
  const routeSolo=useEditor(s=>s.routeSolo);
  const selectedId=useEditor(s=>s.selected);
  const organization=useMemo(()=>organizeScene(objects),[objects]);
  const preset=useStudioLayout(s=>s.performancePreset||'balanced');
  const [visibleLabels,setVisibleLabels]=useState<Set<string>>(()=>new Set());
  const [activeLights,setActiveLights]=useState<Set<string>>(()=>new Set());
  const [activeModels,setActiveModels]=useState<Set<string>>(()=>new Set());
  const lastCull=useRef(-1);
  const entities=useMemo(()=>objects.filter((o):o is PointEntity=>o.kind==='entity'&&!o.hidden),[objects]);
  const routeLookup=useMemo(()=>{
    const lookup=new Map<string,typeof organization.routes>();
    for(const route of organization.routes)for(const node of route.nodes){
      if(!lookup.has(node.id))lookup.set(node.id,[]);
      lookup.get(node.id)!.push(route);
    }
    return lookup;
  },[organization]);
  // Throttled camera-distance budgets. HTML overlays, loaded studio models and
  // realtime lights are by far the most expensive items on very large maps.
  // The map itself is NEVER culled or modified; only editor previews are.
  useFrame(({camera,clock})=>{
    if(clock.elapsedTime-lastCull.current<.65)return;
    lastCull.current=clock.elapsedTime;
    const origin=camera.position;
    const near=entities.map(entity=>({entity,dist:gameToThree(entity.position).distanceToSquared(origin)})).sort((a,b)=>a.dist-b.dist);
    const budgets=preset==='quality'?[240,26,45]:preset==='large'?[32,4,3]:[95,10,14];
    const labels=new Set(near.slice(0,budgets[0]).map(item=>item.entity.id));
    const lights=new Set(near.filter(item=>item.entity.classname.startsWith('light')).slice(0,budgets[1]).map(item=>item.entity.id));
    const models=new Set(near.filter(item=>item.entity.props.model?.startsWith('models/')||item.entity.classname.startsWith('monster_')).slice(0,budgets[2]).map(item=>item.entity.id));
    const equal=(a:Set<string>,b:Set<string>)=>a.size===b.size&&[...a].every(id=>b.has(id));
    setVisibleLabels(previous=>equal(previous,labels)?previous:labels);
    setActiveLights(previous=>equal(previous,lights)?previous:lights);
    setActiveModels(previous=>equal(previous,models)?previous:models);
  });
  return <>
    <color attach="background" args={[environmentPreview?skyPreviewColor(skyname):'#0b1325']}/>
    <fog attach="fog" args={environmentPreview&&fogPreview&&fogEntity&&fogEnd>fogStart?[fogColor,fogStart,fogEnd]:['#0b1325',1500,8000]}/>
    <ambientLight intensity={environmentPreview?.22:1.5}/><hemisphereLight args={['#b9d6ee','#495764',environmentPreview?.22:1.1]}/>
    <directionalLight position={[600,1100,550]} intensity={environmentPreview?.3:2.2}/>
    <Ground/>
    <DrawBrushPlane/><PrimitivePlacement/><EnvironmentPlacement/><NpcClickPlacement/><AudioClickPlacement/><TextureDropHandler/><ContextHitProbe open={onContextMenu}/>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.5,0]} onPointerDown={e=>{if(useEditor.getState().measureMode){e.stopPropagation();useEditor.getState().measurePoint(threeToGame(e.point))}else setSelected(null)}}><planeGeometry args={[20000,20000]}/><meshBasicMaterial visible={false}/></mesh>
    {objects.map(obj=>{if(obj.kind==='brush')return <MemoBrushVisual key={obj.id} object={obj}/>;
      const routes=routeLookup.get(obj.id)||[];
      if(routeSolo&&obj.classname==='path_waypoint'&&!routes.some(r=>r.key===routeSolo))return null;
      if(!(showLights||obj.classname==='info_player_start'||['ambient_generic','ambient_music','env_sound'].includes(obj.classname)))return null;
      const first=routes[0];const number=first?first.nodes.findIndex(n=>n.id===obj.id)+1:0;
      const routeText=obj.classname==='path_waypoint'?(first?`WP ${number} · ${first.name}${routes.length>1?' (shared)':''}`:'WP · unassigned'):undefined;
      return <MemoEntityVisual key={obj.id} object={obj} routeText={routeText} routeTint={first?routeColor(first.name):undefined} hideLabel={!visibleLabels.has(obj.id)||(obj.classname==='path_waypoint'&&!routeSolo&&obj.id!==selectedId)} activeLight={activeLights.has(obj.id)||obj.id===selectedId} activeModel={activeModels.has(obj.id)||obj.id===selectedId}/>;
    })}
    <MeasurementOverlay/><EntityConnections/><NpcRouteLines/><AudioRadiusGuides/><MultiSelectionControls/><BlenderModalTransform/><CameraController/>
    <GizmoHelper alignment="bottom-right" margin={[74,72]}><GizmoViewport axisColors={['#f46e78','#84d899','#73b8ff']} labelColor="white"/></GizmoHelper>
  </>;
}
export function Viewport(){
  const t=useT();
  // The WebGL layer compensates the workspace zoom; subscribe in this component
  // rather than borrowing the uiScale local used inside BrushVisual.
  const uiScale=useStudioLayout(s=>Number.isFinite(s.uiScale)&&s.uiScale>0?s.uiScale:1);
  const perfPreset=useStudioLayout(s=>s.performancePreset||'balanced');
  const mode=useEditor(s=>s.mode),faceMode=useEditor(s=>s.faceMode);
  const measureMode=useEditor(s=>s.measureMode),measurement=useEditor(s=>s.measurement);
  const modal=useEditor(s=>s.modalTransform);
  const cameraLabel=useEditor(s=>s.cameraLabel),controls=useEditor(s=>s.controls),flyMode=useEditor(s=>s.flyMode);
  const projection=useEditor(s=>s.issueCameraCommand);
  const count=useEditor(s=>s.project.objects.length);
  const [contextMenu,setContextMenu]=useState<SceneMenu|null>(null);
  const openMenu=useCallback((menu:SceneMenu)=>setContextMenu(menu),[]);
  const closeMenu=useCallback(()=>setContextMenu(null),[]);
  // Explorer rows and the 3D canvas share the same editor-native context menu.
  useEffect(()=>{
    const onExplorer=(event:Event)=>setContextMenu((event as CustomEvent<SceneMenu>).detail);
    document.addEventListener('svenstudio:explorer-context',onExplorer);
    return()=>document.removeEventListener('svenstudio:explorer-context',onExplorer);
  },[]);
  const placementShape=useEditor(s=>s.placementShape);
  const environmentPlacement=useEditor(s=>s.environmentPlacement);
  const environmentPreview=useEditor(s=>s.environmentPreview),setEnvironmentPreview=useEditor(s=>s.setEnvironmentPreview);
  const shadowEnabled=useEditor(s=>s.environmentPreview&&s.previewShadows);
  const pendingNpcClass=useEditor(s=>s.pendingNpcClass);
  const audioPlacement=useEditor(s=>s.audioPlacement);
  const routePlacementFor=useEditor(s=>s.routePlacementFor);
  const routeSolo=useEditor(s=>s.routeSolo),setRouteSolo=useEditor(s=>s.setRouteSolo);
  const snap=useEditor(s=>s.snap);
  const drawMode=useEditor(s=>s.drawMode),drawHeight=useEditor(s=>s.drawHeight),selectedCount=useEditor(s=>s.selectedIds.length);
  return <div className="viewport-frame">
    {environmentPlacement&&<div className="primitive-placement-hud"><strong>{t('Place in 3D')}: {environmentPlacement.kind}</strong><span>{t('Click a surface to place')} · Esc {t('Cancel')}</span></div>}

    {audioPlacement&&<div className="primitive-placement-hud"><strong>{t('Place in 3D')}: {audioPlacement.classname}</strong><span>{t('Click a surface to place')} · Esc {t('Cancel')}</span></div>}
    {(pendingNpcClass||routePlacementFor)&&<div className="primitive-placement-hud"><strong>{routePlacementFor?`path_waypoint · ${t('NPC Route')}`:`${t('Place NPC')}: ${pendingNpcClass}`}</strong><span>{t('Click a surface to place')} · Esc {t('Cancel')}</span></div>}
    {placementShape&&<div className="primitive-placement-hud"><strong>{t('Place')}: {t(placementShape[0].toUpperCase()+placementShape.slice(1))}</strong><span>{t('Click a surface to place')} · Esc {t('Cancel')}</span></div>}
    {routeSolo&&<div className="viewport-route-focus"><span style={{background:routeColor(routeSolo)}}/>{t('Isolated AI route')}: <b>{routeSolo}</b><button onClick={()=>setRouteSolo(null)}>{t('Show all')}</button></div>}
    {measureMode&&<div className="measure-mode-hud"><strong>Measure distance</strong><span>{measurement.a&&!measurement.b?'Click second point':'Click first point'} · Esc to exit</span></div>}
    <div className="viewport-top-left"><div className="viewport-label"><span className="viewport-bullet"/> {t(cameraLabel)} <span className="viewport-sep">/</span> {drawMode?`${t('Draw')} (${drawHeight}u)` :t('Textured')} <span className="viewport-sep">/</span> {t(faceMode?'Face':'Object')} {t('selection')}</div>
      <div className="viewport-controls-row">
        <button className="projection-toggle" onClick={()=>projection('projection')} title={t('Switch orthographic / perspective')}><Scan size={15}/> {t(cameraLabel.includes('Ortho')||cameraLabel==='Orthographic'?'Orthographic':'Perspective')}</button>
        <button className={`lighting-viewport-toggle ${environmentPreview?'active':''}`} onClick={()=>setEnvironmentPreview(!environmentPreview)} title={t('Approximate lighting preview')}>{environmentPreview?'◉':'◌'} {t('Lighting Preview')}</button>
      </div>
    </div>
    {/* R3F measures physical pixels. The editor shell uses CSS zoom for UI scale,
        so the WebGL layer must undo that zoom to avoid a double-scaled canvas. */}
    <div onContextMenu={e=>e.preventDefault()} className="viewport-canvas" style={{zoom:1/uiScale}}><Canvas shadows={shadowEnabled} dpr={[1,perfPreset==='quality'?1.75:perfPreset==='large'?1:1.35]} camera={{position:[660,530,690],fov:58,near:.5,far:280000}} gl={{antialias:true,powerPreference:'high-performance'}}>
      <Scene onContextMenu={openMenu}/>
    </Canvas></div>
    {contextMenu&&<ContextMenu menu={contextMenu} onClose={closeMenu}/>}
    {!modal&&<OrthoQuickTools/>}
    {modal&&<div className="modal-transform-hud"><span className="modal-command">{modal.mode==='translate'?'G':modal.mode==='rotate'?'R':'S'}</span><span><strong>{t(modal.mode==='translate'?'Move':modal.mode==='rotate'?'Rotate':'Scale')} · Blender</strong><small>{t('Mouse moves selected objects · X/Y/Z axis · numbers · Enter/click confirm · Esc/right click cancel · same key confirm')}</small></span><b id="studio-modal-readout">0</b></div>}
    <div className="viewport-hotkeys">{t(placementShape?'Click a surface to place · Esc cancel':drawMode?'Left drag · Draw box | Esc · Exit draw mode':controls.cameraPreset==='blender'?'MMB · Orbit | Shift+MMB · Pan | Ctrl+MMB · Zoom':'RMB · Orbit | LMB · Pan | MMB · Zoom')} <span> | </span> {t(flyMode?'Fly/Walk ON · WASD / Q,E · Esc exit':'Wheel · Zoom')}</div>
    <div className="viewport-stats"><span>{count} {t('objects')}</span>{selectedCount>1&&<span>{selectedCount} {t('selected')} · {t('TRANSFORM')} {mode==='select'?t('Ready'):t(mode)}</span>}<span>{mode.toUpperCase()}</span><span>Grid {snap}</span></div>
  </div>;
}
