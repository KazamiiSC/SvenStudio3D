/** BSP MDL preview with bounded, shared idle-pose playback and viewer-distance
 * culling. This is a visual approximation, not Svengine NPC simulation. */
import {useEffect,useMemo,useRef,useState} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {BspMap} from '../engine/bsp';
import type {StudioPreview,StudioMesh} from '../engine/mdl';
import {loadModelByPath} from './ModelBrowser';
import {gameToThree,threeToGame} from '../engine/geometry';
import {spawnModelFootHeight} from '../engine/spawnPresentation';
import {BSP_SKY_CUBE_SIDES,bspModelPlacements,bspSkyFaceUrl,findInstalledBspSky,bspIdleSequence,bspFloorZ,bspShouldGroundPreview,bspEntityWithinDistance,bspIdlePoseInterval,bspIdlePreviewFrame,bspPreviewGroundPosition} from '../engine/bspViewerAssets';
import type {InstalledBspSky,BspModelPlacement} from '../engine/bspViewerAssets';

export type BspAssetStatus='off'|'no-game'|'none'|'loading'|'ready'|'missing'|'error';
export function BspSkyBackground({map,gameDir,onStatus}:{map:BspMap;gameDir:string;onStatus:(status:BspAssetStatus)=>void}){
  const {scene}=useThree();
  useEffect(()=>{
    if(!gameDir){onStatus('no-game');return;}
    if(!map.skyname){onStatus('none');return;}
    let active=true,loaded:THREE.CubeTexture|null=null;
    onStatus('loading');
    void (async()=>{
      try{
        const response=await fetch('/api/assets/skies',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameDir})});
        if(!response.ok)throw Error(`Sky list HTTP ${response.status}`);
        const data=await response.json() as {items:InstalledBspSky[]};
        if(!active)return;
        const sky=findInstalledBspSky(data.items,map.skyname);
        if(!sky){onStatus('missing');return;}
        // Three.js cube order: +X,-X,+Y,-Y,+Z,-Z. Names are GoldSrc's six gfx/env suffixes.
        const urls=BSP_SKY_CUBE_SIDES.map(side=>bspSkyFaceUrl(gameDir,sky,side));
        const texture=await new THREE.CubeTextureLoader().loadAsync(urls);
        texture.colorSpace=THREE.SRGBColorSpace;
        if(!active){texture.dispose();return;}
        loaded=texture;scene.background=texture;onStatus('ready');
      }catch{if(active)onStatus('error');}
    })();
    return()=>{active=false;if(loaded){if(scene.background===loaded)scene.background=new THREE.Color('#57748f');loaded.dispose();}};
  },[map,gameDir,onStatus,scene]);
  return null;
}

type RenderMesh={geometry:THREE.BufferGeometry;textureIndex:number;skinref:number;source:StudioMesh};
type ModelAsset={materials:THREE.Material[];bodyparts:{base:number;models:RenderMesh[][]}[];textures:THREE.Texture[];minY:number;vertexCount:number;footByBody:Map<number,number>};
function buildAsset(model:StudioPreview):ModelAsset{
  const textures=model.textures.map(t=>{
    const image=new THREE.DataTexture(t.rgba,t.width,t.height,THREE.RGBAFormat);
    image.colorSpace=THREE.SRGBColorSpace;image.flipY=true;image.wrapS=image.wrapT=THREE.RepeatWrapping;
    image.magFilter=THREE.NearestFilter;image.minFilter=THREE.LinearFilter;image.generateMipmaps=false;image.needsUpdate=true;
    return image;
  });
  const materials:THREE.Material[]=model.textures.map((t,i)=>{
    const options={map:textures[i],side:THREE.DoubleSide as THREE.Side,alphaTest:(t.flags&0x0040)?0.5:0};
    if(t.flags&0x0020)return new THREE.MeshBasicMaterial({...options,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
    if(t.flags&0x0004)return new THREE.MeshBasicMaterial(options);
    return new THREE.MeshStandardMaterial({...options,roughness:1,metalness:0});
  });
  let minY=Infinity,vertexCount=0;
  const toMesh=(mesh:StudioMesh):RenderMesh=>{
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(mesh.positions.slice(),3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(mesh.uvs,2));
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    for(let i=1;i<mesh.positions.length;i+=3)minY=Math.min(minY,mesh.positions[i]);
    vertexCount+=mesh.boneIndices.length;
    return {geometry,textureIndex:mesh.texture,skinref:mesh.skinref,source:mesh};
  };
  return {materials,textures,minY:Number.isFinite(minY)?minY:0,vertexCount,footByBody:new Map(),
    bodyparts:model.bodyparts.map(part=>({base:part.base,models:part.models.map(m=>m.meshes.map(toMesh))}))};
}
/** Animated poses are shared per MDL path to avoid one skinning task per NPC. */
function updateIdlePose(model:StudioPreview,asset:ModelAsset,sequence:number,frame:number){
  const pose=model.samplePose(sequence,frame),point=new THREE.Vector3();
  // Validate the complete skeleton before touching a shared geometry buffer.
  // A malformed frame must not leave only one arm/leg partially updated.
  if(!pose.length||pose.some(m=>!m.elements.every(Number.isFinite)))return;
  for(const part of asset.bodyparts)for(const variant of part.models)for(const mesh of variant){
    const {source,geometry}=mesh,attr=geometry.getAttribute('position') as THREE.BufferAttribute;
    const target=attr.array as Float32Array,local=source.localPositions;
    for(let i=0;i<source.boneIndices.length;i++){
      const offset=i*3,bone=pose[source.boneIndices[i]];
      point.set(local[offset],local[offset+1],local[offset+2]);
      if(bone)point.applyMatrix4(bone);
      target[offset]=point.x;target[offset+1]=point.z;target[offset+2]=point.y;
    }
    attr.needsUpdate=true;geometry.computeVertexNormals();
  }
}
/** A bounded wireframe enclosing the active model bodygroups. The outline is
 * purely an editor overlay and never changes MDL geometry or BSP data. */
function BspModelSelectionOutline({parts}:{parts:readonly RenderMesh[]}){
  const outline=useMemo(()=>{
    const bounds=new THREE.Box3();
    for(const mesh of parts){
      mesh.geometry.computeBoundingBox();
      if(mesh.geometry.boundingBox)bounds.union(mesh.geometry.boundingBox);
    }
    if(bounds.isEmpty())return null;
    const size=bounds.getSize(new THREE.Vector3());
    if(![size.x,size.y,size.z].every(v=>Number.isFinite(v)&&v<4096))return null;
    const geometry=new THREE.BoxGeometry(Math.max(12,size.x+8),Math.max(12,size.y+8),Math.max(12,size.z+8));
    const edges=new THREE.EdgesGeometry(geometry);geometry.dispose();
    return {edges,center:bounds.getCenter(new THREE.Vector3())};
  },[parts]);
  useEffect(()=>()=>outline?.edges.dispose(),[outline]);
  if(!outline)return null;
  return <lineSegments geometry={outline.edges} position={outline.center} renderOrder={9} raycast={()=>null}>
    <lineBasicMaterial color="#63e9ff" depthTest={false} depthWrite={false} transparent opacity={.95}/>
  </lineSegments>;
}
function BspPlacedModel({asset,placement,model,onSelect,onContextEntity,selected,distance,floorZ}:{asset:ModelAsset;placement:BspModelPlacement;model:StudioPreview;onSelect?:(index:number,extend:boolean,clientX?:number,clientY?:number)=>void;onContextEntity?:(index:number,x:number,y:number)=>void;selected:boolean;distance:number;floorZ:number|null}){
  const root=useRef<THREE.Group>(null);
  const position=gameToThree(placement.origin);
  const grounded=floorZ!==null&&bspShouldGroundPreview(placement.classname);
  // The bind pose can have a different foot height from the actual idle
  // sequence. Cache an idle-pose estimate per MDL bodygroup, not per NPC.
  let footY=asset.footByBody.get(placement.body);
  if(footY===undefined){
    try{footY=spawnModelFootHeight(model,placement.body)}catch{footY=asset.minY}
    if(!Number.isFinite(footY))footY=asset.minY;
    asset.footByBody.set(placement.body,footY);
  }
  // Ground NPCs and ordinary pickups/decorations, but preserve authored
  // heights where no nearby floor is found. Never rewrite BSP origin.
  if(grounded)position.y=bspPreviewGroundPosition(placement.origin[2],floorZ,footY,placement.classname);
  const [pitch,yaw,roll]=placement.angles;
  const rotation:[number,number,number]=[THREE.MathUtils.degToRad(-pitch),THREE.MathUtils.degToRad(yaw),THREE.MathUtils.degToRad(roll)];
  const parts=asset.bodyparts.flatMap(part=>{
    const index=part.base>0?Math.floor(placement.body/part.base)%part.models.length:0;
    return part.models[index]||[];
  });
  const {camera}=useThree();
  const tick=useRef(0);
  useFrame((_,delta)=>{
    tick.current+=delta;if(tick.current<.12)return;tick.current=0;
    if(root.current)root.current.visible=selected||camera.position.distanceToSquared(position)<=distance*distance;
  });
  return <group ref={root} position={position.toArray()} rotation={new THREE.Euler(...rotation,'YXZ')} scale={[1,1,-1]} onClick={onSelect?event=>{event.stopPropagation();onSelect(placement.index,!!(event.nativeEvent.ctrlKey||event.nativeEvent.metaKey||event.nativeEvent.shiftKey),event.nativeEvent.clientX,event.nativeEvent.clientY)}:undefined} onContextMenu={onContextEntity?event=>{event.stopPropagation();event.nativeEvent.preventDefault();onContextEntity(placement.index,event.nativeEvent.clientX,event.nativeEvent.clientY)}:undefined}>
    {parts.map((mesh,i)=>{
      const tex=model.skins[placement.skin]?.[mesh.skinref]??mesh.textureIndex;
      return <mesh key={i} geometry={mesh.geometry} material={asset.materials[tex]} frustumCulled={false}>
        {!asset.materials[tex]&&<meshStandardMaterial color="#aec1d8" side={THREE.DoubleSide}/>}
      </mesh>;
    })}
    {selected&&<BspModelSelectionOutline parts={parts}/>}
  </group>;
}
export function BspStaticModels({map,gameDir,onStatus,onSelect,onContextEntity,studioByClass,selected,extraSelected=[],onReport,distance,groundModels,extraModels}:{map:BspMap;gameDir:string;onStatus:(status:BspAssetStatus)=>void;onReport?:(report:{loaded:number;total:number;missing:string[]})=>void;onSelect?:(index:number,extend:boolean,clientX?:number,clientY?:number)=>void;onContextEntity?:(index:number,x:number,y:number)=>void;studioByClass?:Readonly<Record<string,string>>;selected?:number|null;extraSelected?:readonly number[];distance:number;groundModels:boolean;extraModels?:ReadonlyMap<string,StudioPreview>}){
  const {camera}=useThree();
  const [viewer,setViewer]=useState<[number,number,number]|null>(null);
  const cameraTick=useRef(0),poseClock=useRef(0),poseTick=useRef(0);
  useFrame((_,delta)=>{
    cameraTick.current+=delta;
    if(cameraTick.current<.6)return;cameraTick.current=0;
    const next=threeToGame(camera.position) as [number,number,number];
    if(!viewer||Math.hypot(...next.map((v,i)=>v-(viewer[i]||0)))>480)setViewer(next);
  });
  const placements=useMemo(()=>bspModelPlacements(map.entities,96,22,studioByClass,selected,viewer||undefined),[map,studioByClass,selected,viewer]);
  const resourceKey=useMemo(()=>[...new Set(placements.map(item=>item.path))].sort().join('|'),[placements]);
  const [models,setModels]=useState<Map<string,StudioPreview>>(new Map());
  const cached=useRef<Map<string,StudioPreview>>(new Map());
  useEffect(()=>{cached.current.clear();setModels(new Map())},[gameDir]);
  useEffect(()=>{
    const paths=resourceKey.split('|').filter(Boolean);
    if(!paths.length){onStatus('none');onReport?.({loaded:0,total:0,missing:[]});return;}
    const found=new Map<string,StudioPreview>();
    for(const path of paths){const data=extraModels?.get(path)||cached.current.get(path);if(data)found.set(path,data)}
    setModels(found);
    if(!gameDir&&found.size!==paths.length){onStatus('no-game');onReport?.({loaded:found.size,total:paths.length,missing:paths.filter(path=>!found.has(path))});return;}
    const missing=paths.filter(path=>!found.has(path));
    if(!missing.length){onStatus('ready');onReport?.({loaded:found.size,total:paths.length,missing:[]});return;}
    let active=true;onStatus('loading');
    void Promise.allSettled(missing.map(path=>loadModelByPath(gameDir,path))).then(results=>{
      if(!active)return;
      results.forEach((result,i)=>{if(result.status==='fulfilled'){cached.current.set(missing[i],result.value);found.set(missing[i],result.value)}});
      setModels(new Map(found));
      const failed=paths.filter(path=>!found.has(path));
      onStatus(failed.length?found.size?'missing':'error':'ready');
      onReport?.({loaded:found.size,total:paths.length,missing:failed});
    });
    return()=>{active=false};
  },[gameDir,resourceKey,extraModels,onStatus,onReport]);
  const resources=useMemo(()=>new Map([...models].map(([path,data])=>[path,buildAsset(data)])),[models]);
  useEffect(()=>()=>{for(const asset of resources.values()){
    asset.bodyparts.forEach(part=>part.models.forEach(meshes=>meshes.forEach(mesh=>mesh.geometry.dispose())));
    asset.materials.forEach(material=>material.dispose());asset.textures.forEach(tex=>tex.dispose());
  }},[resources]);
  const animationInfo=useMemo(()=>new Map([...models].map(([path,model])=>[path,bspIdleSequence(model.sequences)])),[models]);
  const floors=useMemo(()=>new Map(placements.map(item=>[item.index,groundModels&&bspShouldGroundPreview(item.classname)?bspFloorZ(map.faces,item.origin):null])),[placements,map.faces,groundModels]);
  useFrame((_,delta)=>{
    poseClock.current+=Math.min(delta,.1);poseTick.current+=Math.min(delta,.1);
    const cameraGame=threeToGame(camera.position) as [number,number,number];
    // Shared MDL geometry only requires one pose per model path. Prioritize
    // selected and nearby entities, and limit the number of skinned vertices.
    const candidates=[...new Map(placements.filter(item=>bspEntityWithinDistance(item.origin,cameraGame,Math.min(distance,1600),item.index===selected))
      .sort((a,b)=>(a.index===selected?-Infinity:Math.hypot(a.origin[0]-cameraGame[0],a.origin[1]-cameraGame[1],a.origin[2]-cameraGame[2]))
          -(b.index===selected?-Infinity:Math.hypot(b.origin[0]-cameraGame[0],b.origin[1]-cameraGame[1],b.origin[2]-cameraGame[2])))
      .map(item=>[item.path,item] as const)).keys()];
    const active:{model:StudioPreview;asset:ModelAsset;sequence:number}[]=[];
    let vertices=0;
    for(const path of candidates){
      if(active.length>=6)break;
      const model=models.get(path),asset=resources.get(path),sequence=animationInfo.get(path)??-1;
      if(!model||!asset||sequence<0||asset.vertexCount>26000)continue;
      const seq=model.sequences[sequence];if(!seq?.available||seq.frames<2)continue;
      if(vertices+asset.vertexCount>82000&&active.length>0)continue;
      vertices+=asset.vertexCount;active.push({model,asset,sequence});
    }
    if(poseTick.current<bspIdlePoseInterval(vertices))return;
    poseTick.current=0;
    for(const {model,asset,sequence} of active){
      const seq=model.sequences[sequence];
      // samplePose interpolates fractional GoldSrc frames; do not round them.
      const frame=bspIdlePreviewFrame(poseClock.current,seq);
      try{updateIdlePose(model,asset,sequence,frame)}
      catch{/* Invalid or unsupported sequences retain their previous safe pose. */}
    }
  });
  return <group>{placements.map(item=>{
    const asset=resources.get(item.path),model=models.get(item.path);
    return asset&&model?<BspPlacedModel key={`${item.index}:${item.path}`} placement={item} asset={asset} model={model} onSelect={onSelect} onContextEntity={onContextEntity} selected={item.index===selected||extraSelected.includes(item.index)} distance={distance} floorZ={floors.get(item.index)??null}/>:null;
  })}</group>;
}
