/** Real six-face GoldSrc sky and static MDL placements for the read-only BSP viewer.
 * Models remain frozen in their bind pose; Svengine runtime animation is not simulated. */
import {useEffect,useMemo,useState} from 'react';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {BspMap} from '../engine/bsp';
import type {StudioPreview,StudioMesh} from '../engine/mdl';
import {loadModelByPath} from './ModelBrowser';
import {gameToThree} from '../engine/geometry';
import {BSP_SKY_CUBE_SIDES,bspModelPlacements,bspSkyFaceUrl,findInstalledBspSky} from '../engine/bspViewerAssets';
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

type RenderMesh={geometry:THREE.BufferGeometry;textureIndex:number;skinref:number};
type ModelAsset={materials:THREE.Material[];bodyparts:{base:number;models:RenderMesh[][]}[];textures:THREE.Texture[]};
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
  const toMesh=(mesh:StudioMesh):RenderMesh=>{
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(mesh.positions,3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(mesh.uvs,2));
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    return {geometry,textureIndex:mesh.texture,skinref:mesh.skinref};
  };
  return {materials,textures,bodyparts:model.bodyparts.map(part=>({base:part.base,models:part.models.map(m=>m.meshes.map(toMesh))}))};
}
function BspPlacedModel({asset,placement,model}:{asset:ModelAsset;placement:BspModelPlacement;model:StudioPreview}){
  const position=gameToThree(placement.origin);
  const [pitch,yaw,roll]=placement.angles;
  // Studio parser uses x,z,+y; the map renderer uses x,z,-y. Mirror local Z to match.
  const rotation:[number,number,number]=[THREE.MathUtils.degToRad(-pitch),THREE.MathUtils.degToRad(yaw),THREE.MathUtils.degToRad(roll)];
  const parts=asset.bodyparts.flatMap(part=>{
    const index=part.base>0?Math.floor(placement.body/part.base)%part.models.length:0;
    return part.models[index]||[];
  });
  return <group position={position.toArray()} rotation={new THREE.Euler(...rotation,'YXZ')} scale={[1,1,-1]}>
    {parts.map((mesh,i)=>{
      const tex=model.skins[placement.skin]?.[mesh.skinref]??mesh.textureIndex;
      return <mesh key={i} geometry={mesh.geometry} material={asset.materials[tex]} frustumCulled>
        {!asset.materials[tex]&&<meshStandardMaterial color="#aec1d8" side={THREE.DoubleSide}/>}
      </mesh>;
    })}
  </group>;
}
export function BspStaticModels({map,gameDir,onStatus}:{map:BspMap;gameDir:string;onStatus:(status:BspAssetStatus)=>void}){
  const placements=useMemo(()=>bspModelPlacements(map.entities),[map]);
  const [models,setModels]=useState<Map<string,StudioPreview>>(new Map());
  useEffect(()=>{
    if(!gameDir){setModels(new Map());onStatus('no-game');return;}
    if(!placements.length){setModels(new Map());onStatus('none');return;}
    let active=true;
    setModels(new Map());onStatus('loading');
    const paths=[...new Set(placements.map(item=>item.path))];
    void Promise.allSettled(paths.map(path=>loadModelByPath(gameDir,path))).then(results=>{
      if(!active)return;
      const found=new Map<string,StudioPreview>();
      results.forEach((result,i)=>{if(result.status==='fulfilled')found.set(paths[i],result.value)});
      setModels(found);onStatus(found.size===paths.length?'ready':found.size?'missing':'error');
    });
    return()=>{active=false};
  },[gameDir,placements,onStatus]);
  const resources=useMemo(()=>new Map([...models].map(([path,data])=>[path,buildAsset(data)])),[models]);
  useEffect(()=>()=>{for(const asset of resources.values()){
    asset.bodyparts.forEach(part=>part.models.forEach(meshes=>meshes.forEach(mesh=>mesh.geometry.dispose())));
    asset.materials.forEach(material=>material.dispose());asset.textures.forEach(tex=>tex.dispose());
  }},[resources]);
  return <group>{placements.map(item=>{
    const asset=resources.get(item.path),model=models.get(item.path);
    return asset&&model?<BspPlacedModel key={item.index} placement={item} asset={asset} model={model}/>:null;
  })}</group>;
}
