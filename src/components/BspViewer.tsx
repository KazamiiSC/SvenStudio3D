import {Canvas,useFrame,useThree} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import {ArrowLeft,FileUp,Layers,Sun,Grid3x3,Move3D,RotateCcw,Info,Box,Tags,Focus,Settings2,Cloud,Package} from 'lucide-react';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {MutableRefObject} from 'react';
import * as THREE from 'three';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import type {BspFace,BspMap,BspTexture} from '../engine/bsp';
import type {TextureAsset} from '../engine/types';
import {parseWad} from '../engine/wad';
import {autoWadTexturesToAssets,fetchBspAutoWads} from '../engine/bspAutoWad';
import {layoutBspLabels,bspLabelPriority} from '../engine/bspLabelLayout';
import {gameToThree} from '../engine/geometry';
import {useT} from '../i18n';
import {useEditor} from '../store';
import {bspEntityLabel,bspEntitySearchText,bspFlyAxes,bspFlyMultiplier,clampBspFlySpeed,clampBspFlySensitivity} from '../engine/bspViewerTools';
import {BspSkyBackground,BspStaticModels,type BspAssetStatus} from './BspViewerAssets';
import {bspModelPlacements,bspSpatialBatchCell} from '../engine/bspViewerAssets';
import {BSP_LIGHTMAP_UV_CHANNEL,BSP_LIGHTMAP_DEFAULT_INTENSITY,BSP_LIGHTMAP_DEFAULT_AMBIENT,bspLightmapAtlasUv} from '../engine/bspLightmap';
import {goldSrcMaterial,normalizeGoldSrcPreview,readPreviewSettings,savePreviewSettings,type GoldSrcPreviewSettings} from '../engine/previewEnhancements';

const ATLAS_SIZE=1024,MAX_LIGHT_PAGES=24;
type AtlasPage={rgba:Uint8ClampedArray;x:number;y:number;rowH:number};
type AtlasPlacement={page:number;x:number;y:number};
type RenderChunk={geometry:THREE.BufferGeometry;material:THREE.Material};
const visibleTexture=(name:string)=>!(/^(sky|clip|origin|hint|skip|null|aaatrigger|bevel|solidhint)$/i.test(name));
function canvasTexture(image:ImageData){
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  canvas.getContext('2d')?.putImageData(image,0,0);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.anisotropy=4;
  return texture;
}
function checkerTexture(){
  const data=new Uint8ClampedArray(16*16*4);
  for(let y=0;y<16;y++)for(let x=0;x<16;x++){
    const p=(y*16+x)*4,on=(Math.floor(x/8)+Math.floor(y/8))%2===0;
    data[p]=on?146:81;data[p+1]=on?153:91;data[p+2]=on?170:112;data[p+3]=255;
  }
  return canvasTexture(new ImageData(data,16,16));
}
const geometricNormal=(face:BspFace)=>{
  const [x,y,z]=face.normal;
  return new THREE.Vector3(x,z,-y).normalize();
};
function buildBspScene(map:BspMap,wadAssets:TextureAsset[],lightmaps:boolean,wireframe:boolean,preview:GoldSrcPreviewSettings):RenderChunk[]{
  const allTextures:THREE.Texture[]=[];
  const byName=new Map(wadAssets.map(a=>[a.name.toLowerCase(),a]));
  const fallback=checkerTexture();allTextures.push(fallback);
  const textureFor=(t:BspTexture|undefined)=>{
    if(!t)return fallback;
    if(t.rgba){
      const data=new Uint8ClampedArray(t.rgba);
      const tex=canvasTexture(new ImageData(data,t.width,t.height));allTextures.push(tex);return tex;
    }
    const asset=byName.get(t.name.toLowerCase());
    if(!asset)return fallback;
    const tex=new THREE.TextureLoader().load(asset.dataUrl);
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.magFilter=THREE.NearestFilter;tex.colorSpace=THREE.SRGBColorSpace;
    allTextures.push(tex);return tex;
  };
  const maps=map.textures.map(textureFor);
  // A brush entity's model field (*n) identifies the faces using its rendermode/renderamt.
  const brushEntityByModel=new Map<number,{classname:string;props:Record<string,string>}>();
  for(const entity of map.entities){const match=/^\*(\d+)$/.exec(entity.properties.model||'');if(match)brushEntityByModel.set(Number(match[1]),{classname:entity.classname,props:entity.properties});}
  const pages:AtlasPage[]=[];
  const placements=new Map<BspFace,AtlasPlacement>();
  if(lightmaps){
    const page=():AtlasPage=>({rgba:new Uint8ClampedArray(ATLAS_SIZE*ATLAS_SIZE*4),x:1,y:1,rowH:0});
    pages.push(page());
    for(const face of map.faces){
      const rgb=face.lightRgb,w=face.lightWidth,h=face.lightHeight;
      if(!rgb||w>ATLAS_SIZE-4||h>ATLAS_SIZE-4)continue;
      let p=pages[pages.length-1];
      if(p.x+w+2>ATLAS_SIZE){p.x=1;p.y+=p.rowH+1;p.rowH=0}
      if(p.y+h+2>ATLAS_SIZE){if(pages.length>=MAX_LIGHT_PAGES)continue;p=page();pages.push(p)}
      const x=p.x+1,y=p.y+1,idx=pages.length-1;
      // Copy one extra pixel around each face to prevent linear-filter bleed.
      for(let dy=-1;dy<=h;dy++)for(let dx=-1;dx<=w;dx++){
        const sourceY=Math.max(0,Math.min(h-1,dy)),sourceX=Math.max(0,Math.min(w-1,dx));
        const src=(sourceY*w+sourceX)*3,dst=((y+dy)*ATLAS_SIZE+(x+dx))*4;
        p.rgba[dst]=rgb[src];p.rgba[dst+1]=rgb[src+1];p.rgba[dst+2]=rgb[src+2];p.rgba[dst+3]=255;
      }
      placements.set(face,{page:idx,x,y});p.x+=w+2;p.rowH=Math.max(p.rowH,h+2);
    }
  }
  const atlasTextures=pages.map(p=>{
    const tex=canvasTexture(new ImageData(p.rgba,ATLAS_SIZE,ATLAS_SIZE));
    // BSP light samples are raw RGB illuminance, not sRGB surface colors.
    // Three.js r175 reads a second coordinate set from `uv1` when channel=1.
    tex.colorSpace=THREE.LinearSRGBColorSpace;tex.channel=BSP_LIGHTMAP_UV_CHANNEL;
    tex.wrapS=tex.wrapT=THREE.ClampToEdgeWrapping;tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearFilter;
    allTextures.push(tex);return tex;
  });
  type Part={p:number[];n:number[];uv:number[];uv1:number[]};
  const batches=new Map<string,{part:Part;textureIndex:number;page:number;model:number}>();
  for(const face of map.faces){
    if(face.points.length<3)continue;
    const tex=map.textures[face.texture],name=tex?.name||'';
    if(!visibleTexture(name))continue;
    const placement=placements.get(face),page=placement?.page??-1;
    const key=`${face.texture}:${page}:${face.model}:${map.faces.length>4000?bspSpatialBatchCell(face.points):'all'}`;
    let entry=batches.get(key);
    if(!entry){entry={textureIndex:face.texture,page,model:face.model,part:{p:[],n:[],uv:[],uv1:[]}};batches.set(key,entry)}
    const part=entry.part,normal=geometricNormal(face),w=Math.max(1,tex?.width||16),h=Math.max(1,tex?.height||16);
    for(let i=1;i<face.points.length-1;i++)for(const k of [0,i,i+1]){
      const point=face.points[k],uv=face.texels[k];
      part.p.push(point[0],point[2],-point[1]);part.n.push(normal.x,normal.y,normal.z);
      part.uv.push(uv[0]/w,-uv[1]/h);
      if(placement){
        const [lightU,lightV]=bspLightmapAtlasUv(uv,face.lightMin,placement,ATLAS_SIZE);
        part.uv1.push(lightU,lightV);
      }else part.uv1.push(0,0);
    }
  }
  const chunks:RenderChunk[]=[];
  for(const {part,textureIndex,page,model} of batches.values()){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.p,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.n,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(part.uv,2));
    geometry.setAttribute('uv1',new THREE.Float32BufferAttribute(part.uv1,2));
    geometry.computeBoundingSphere();
    const tex=map.textures[textureIndex];
    const info=goldSrcMaterial(tex?.name||'',brushEntityByModel.get(model));
    const transparency=preview.enabled&&preview.transparency;
    const blended=transparency&&['water','glass','additive'].includes(info.kind);
    const masked=info.kind==='masked';
    const image=maps[textureIndex]||fallback;
    const common={map:image,side:THREE.DoubleSide as THREE.Side,
      transparent:blended,opacity:blended?info.opacity:1,alphaTest:masked?.5:0,
      depthWrite:!blended,blending:blended&&info.kind==='additive'?THREE.AdditiveBlending:THREE.NormalBlending,wireframe};
    // Surfaces without baked samples remain visible; transparent water/glass
    // are visual-only approximations and never change the compiled BSP.
    const material=lightmaps&&page<0
      ?new THREE.MeshBasicMaterial(common)
      :new THREE.MeshStandardMaterial({...common,lightMap:page>=0?atlasTextures[page]:null,
        lightMapIntensity:BSP_LIGHTMAP_DEFAULT_INTENSITY,color:'#ffffff',roughness:info.kind==='water'?.28:info.kind==='glass'?.2:1,metalness:info.kind==='glass'?.08:0});
    if(info.kind==='water')material.userData.previewWater=true;
    chunks.push({geometry,material});
  }
  // Assign texture ownership to the collection for deterministic disposal.
  Object.defineProperty(chunks,'ownedTextures',{value:allTextures});
  return chunks;
}
function BspSurface({map,assets,lightmaps,wireframe,brightness,preview}:{map:BspMap;assets:TextureAsset[];lightmaps:boolean;wireframe:boolean;brightness:number;preview:GoldSrcPreviewSettings}){
  const {gl}=useThree();
  const chunks=useMemo(()=>buildBspScene(map,assets,lightmaps,wireframe,preview),[map,assets,lightmaps,wireframe,preview.enabled,preview.transparency]);
  const waterMaps=useMemo(()=>[...new Set(chunks.filter(c=>c.material.userData.previewWater).map(c=>(c.material as THREE.MeshStandardMaterial).map).filter((x):x is THREE.Texture=>!!x))],[chunks]);
  useFrame(({clock})=>{for(const tex of waterMaps){tex.offset.x=preview.enabled&&preview.waterAnimation?Math.sin(clock.elapsedTime*.65)*.02:0;tex.offset.y=preview.enabled&&preview.waterAnimation?clock.elapsedTime*.014%1:0;}});
  useEffect(()=>{gl.toneMapping=THREE.ACESFilmicToneMapping;gl.toneMappingExposure=preview.enabled?preview.exposure:1;return()=>{gl.toneMapping=THREE.NoToneMapping;gl.toneMappingExposure=1}},[gl,preview.enabled,preview.exposure]);
  useEffect(()=>{
    for(const chunk of chunks){
      if(chunk.material instanceof THREE.MeshStandardMaterial)chunk.material.lightMapIntensity=brightness;
    }
  },[chunks,brightness]);
  useEffect(()=>()=>{
    chunks.forEach(c=>{c.geometry.dispose();c.material.dispose()});
    const textures=(chunks as RenderChunk[]&{ownedTextures?:THREE.Texture[]}).ownedTextures;
    textures?.forEach(t=>t.dispose());
  },[chunks]);
  return <group>{chunks.map((c,i)=><mesh key={i} geometry={c.geometry} material={c.material} frustumCulled/>)}</group>;
}
/** Draw classname / targetname labels as billboards, not hundreds of DOM overlays. */
function labelTexture(value:string){
  const display=value.length>56?`${value.slice(0,53)}…`:value;
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  const font='600 22px Segoe UI, Arial, sans-serif';
  if(!ctx)return null;
  ctx.font=font;
  canvas.width=Math.min(820,Math.ceil(ctx.measureText(display).width)+28);
  canvas.height=40;
  ctx.font=font;
  ctx.fillStyle='rgba(12,23,39,0.88)';
  ctx.beginPath();ctx.roundRect(0,0,canvas.width,canvas.height,7);ctx.fill();
  ctx.strokeStyle='rgba(110,175,213,0.8)';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle='#e8f3ff';ctx.textBaseline='middle';ctx.fillText(display,14,canvas.height/2);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  return texture;
}
function BspEntities({map,onSelect,selected,labels,smartLabels,labelLimit,labelDistance}:{map:BspMap;onSelect:(index:number)=>void;selected:number|null;labels:boolean;smartLabels:boolean;labelLimit:number;labelDistance:number}){
  const {camera,size}=useThree();
  const markers=useMemo(()=>{
    const valid=map.entities.map((entity,i)=>({entity,i,position:entity.origin?gameToThree(entity.origin):null}))
      .filter((x):x is {entity:typeof x.entity;i:number;position:THREE.Vector3}=>!!x.position&&x.entity.classname!=='worldspawn');
    return valid.length<=800?valid:valid.slice(0,800).concat(valid.filter(x=>x.i===selected&&x.i>=800));
  },[map,selected]);
  const labelRefs=useRef(new Map<number,THREE.Sprite>());
  const textureCache=useMemo(()=>new Map<string,THREE.CanvasTexture>(),[map]);
  const elapsed=useRef(0),vec=useMemo(()=>new THREE.Vector3(),[]),labelOffset=useMemo(()=>new THREE.Vector3(),[]);
  useEffect(()=>()=>{for(const tex of textureCache.values())tex.dispose()},[textureCache]);
  useFrame((_,delta)=>{
    elapsed.current+=delta;
    if(elapsed.current<.12)return;
    elapsed.current=0;
    if(!labels){for(const sprite of labelRefs.current.values())sprite.visible=false;return}
    const candidates=[];
    for(const m of markers){
      const dist=camera.position.distanceToSquared(m.position);
      if(m.i!==selected&&dist>labelDistance*labelDistance)continue;
      vec.copy(m.position).project(camera);
      if(vec.z<=-1||vec.z>=1||Math.abs(vec.x)>1.04||Math.abs(vec.y)>1.04)continue;
      const selectedLabel=m.i===selected,text=bspEntityLabel(m.entity),texture=textureCache.get(text);
      const labelHeight=selectedLabel?27:22;
      const estimatedWidth=texture?(texture.image.width/texture.image.height*labelHeight):Math.min(420,text.length*12+18);
      candidates.push({index:m.i,x:(vec.x+1)*size.width*.5,y:(1-vec.y)*size.height*.5-20,
        width:estimatedWidth,height:labelHeight,distance:dist,
        priority:bspLabelPriority(m.entity.classname,m.entity.properties.targetname,selectedLabel),selected:selectedLabel});
    }
    const visibleIds=new Set(layoutBspLabels(candidates,{width:size.width,height:size.height,limit:smartLabels?labelLimit:90,smart:smartLabels,padding:6}));
    for(const [i,sprite] of labelRefs.current)sprite.visible=visibleIds.has(i);
    for(const m of markers){
      if(!visibleIds.has(m.i))continue;
      const sprite=labelRefs.current.get(m.i);if(!sprite)continue;
      const text=bspEntityLabel(m.entity);
      let texture=textureCache.get(text);
      if(!texture){const created=labelTexture(text);if(!created)continue;texture=created;textureCache.set(text,texture)}
      const material=sprite.material as THREE.SpriteMaterial;
      if(material.map!==texture){material.map=texture;material.needsUpdate=true}
      const dist=camera.position.distanceTo(m.position);
      const fov=(camera as THREE.PerspectiveCamera).isPerspectiveCamera?(camera as THREE.PerspectiveCamera).fov:65;
      const worldPerPixel=2*Math.max(dist,32)*Math.tan(fov*Math.PI/360)/Math.max(size.height,1);
      const labelHeight=m.i===selected?27:22;
      sprite.scale.set(texture.image.width/texture.image.height*labelHeight*worldPerPixel,labelHeight*worldPerPixel,1);
      sprite.position.copy(m.position).add(labelOffset.set(0,10+labelHeight*worldPerPixel*.55,0));
    }
  });
  return <group>{markers.map(({entity,i,position})=>{
    const color=entity.classname.startsWith('light')?'#e8be65':entity.classname.includes('player')?'#5ddb9b':'#74afe3';
    return <group key={i}>
      <mesh position={position.toArray()} onClick={event=>{event.stopPropagation();onSelect(i)}}>
        <sphereGeometry args={[selected===i?11:7,8,6]}/><meshBasicMaterial color={selected===i?'#fff3ac':color} depthTest={false}/>
      </mesh>
      <sprite ref={sprite=>{if(sprite)labelRefs.current.set(i,sprite);else labelRefs.current.delete(i)}} visible={false}
        onClick={event=>{event.stopPropagation();onSelect(i)}} frustumCulled={false} renderOrder={8}>
        <spriteMaterial transparent depthTest={false} depthWrite={false}/>
      </sprite>
    </group>;
  })}</group>;
}
function BspNavigation({map,fly,reset,flyRef,speed,sensitivity,smooth,focus}:{map:BspMap;fly:boolean;reset:number;
  flyRef:MutableRefObject<HTMLCanvasElement|null>;speed:number;sensitivity:number;smooth:boolean;focus:{index:number;serial:number}|null}){
  const {camera,gl}=useThree();
  const orbit=useRef<OrbitControlsImpl>(null),keys=useRef(new Set<string>());
  const velocity=useRef(new THREE.Vector3());
  const targetVelocity=useMemo(()=>new THREE.Vector3(),[]);
  const forward=useMemo(()=>new THREE.Vector3(),[]),right=useMemo(()=>new THREE.Vector3(),[]);
  const justFlying=useRef(false);
  useEffect(()=>{
    const min=gameToThree(map.bounds.min),max=gameToThree(map.bounds.max),center=min.clone().add(max).multiplyScalar(.5);
    const span=Math.max(150,max.distanceTo(min));
    camera.position.copy(center.clone().add(new THREE.Vector3(span*.8,span*.45,span*.8)));
    camera.near=.25;camera.far=Math.max(5000,span*25);camera.updateProjectionMatrix();
    camera.lookAt(center);orbit.current?.target.copy(center);orbit.current?.update();
    velocity.current.set(0,0,0);
  },[camera,map,reset]);
  useEffect(()=>{
    if(!focus)return;
    const entity=map.entities[focus.index];if(!entity?.origin)return;
    const at=gameToThree(entity.origin),offset=new THREE.Vector3(100,75,110);
    camera.position.copy(at).add(offset);
    camera.lookAt(at);
    orbit.current?.target.copy(at);orbit.current?.update();
    velocity.current.set(0,0,0);
  },[map,focus,camera]);
  useEffect(()=>{
    const down=(event:KeyboardEvent)=>{
      if(!fly||document.pointerLockElement!==gl.domElement)return;
      if((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]'))return;
      keys.current.add(event.code);
      if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))event.preventDefault();
    };
    const up=(event:KeyboardEvent)=>keys.current.delete(event.code);
    const blur=()=>{keys.current.clear();velocity.current.set(0,0,0)};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur)};
  },[fly,gl]);
  useEffect(()=>{
    flyRef.current=gl.domElement;
    if(!fly){
      if(justFlying.current){
        camera.getWorldDirection(forward);
        orbit.current?.target.copy(camera.position).addScaledVector(forward,160);
        orbit.current?.update();
      }
      justFlying.current=false;
      return;
    }
    justFlying.current=true;
    velocity.current.set(0,0,0);
    const euler=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');
    const move=(event:MouseEvent)=>{
      if(document.pointerLockElement!==gl.domElement)return;
      euler.y-=event.movementX*sensitivity;
      euler.x=THREE.MathUtils.clamp(euler.x-event.movementY*sensitivity,-Math.PI/2+.015,Math.PI/2-.015);
      camera.quaternion.setFromEuler(euler);
    };
    document.addEventListener('mousemove',move);
    return()=>{document.removeEventListener('mousemove',move);keys.current.clear()};
  },[fly,camera,gl,flyRef,sensitivity,forward,reset,focus]);
  useFrame((_,delta)=>{
    if(!fly||document.pointerLockElement!==gl.domElement)return;
    const axes=bspFlyAxes(keys.current),dt=Math.min(delta,.08);
    camera.getWorldDirection(forward);
    right.crossVectors(forward,camera.up).normalize();
    targetVelocity.copy(forward).multiplyScalar(axes.forward).addScaledVector(right,axes.right);
    targetVelocity.y+=axes.up;
    if(targetVelocity.lengthSq()>1)targetVelocity.normalize();
    targetVelocity.multiplyScalar(speed*bspFlyMultiplier(keys.current));
    if(smooth)velocity.current.lerp(targetVelocity,1-Math.exp(-12*dt));
    else velocity.current.copy(targetVelocity);
    camera.position.addScaledVector(velocity.current,dt);
  });
  return <OrbitControls ref={orbit} enabled={!fly} makeDefault enableDamping dampingFactor={.12} maxDistance={100000}/>;
}
export function BspViewer({map,onBack,onOpen,onCompiled}:{map:BspMap;onBack:()=>void;onOpen:()=>void;onCompiled:()=>void}){
  const editorAssets=useEditor(s=>s.textureAssets);
  const gameDir=useEditor(s=>s.settings.gameDir);
  const t=useT(),[lightmaps,setLightmaps]=useState(true),[wireframe,setWireframe]=useState(false),[showEntities,setShowEntities]=useState(true);
  const [showLabels,setShowLabels]=useState(true),[navSettings,setNavSettings]=useState(false);
  const [smartLabels,setSmartLabels]=useState(true),[labelLimit,setLabelLimit]=useState(32),[labelDistance,setLabelDistance]=useState(2400);
  const [lightBrightness,setLightBrightness]=useState(BSP_LIGHTMAP_DEFAULT_INTENSITY);
  const [rendererPreview,setRendererPreview]=useState(()=>readPreviewSettings('goldsrc-preview-2',normalizeGoldSrcPreview));
  useEffect(()=>savePreviewSettings('goldsrc-preview-2',rendererPreview),[rendererPreview]);
  const changeRenderer=(patch:Partial<GoldSrcPreviewSettings>)=>setRendererPreview(p=>normalizeGoldSrcPreview({...p,...patch}));
  const [ambientFill,setAmbientFill]=useState(BSP_LIGHTMAP_DEFAULT_AMBIENT);
  const [showSky,setShowSky]=useState(true),[showModels,setShowModels]=useState(false);
  const [skyStatus,setSkyStatus]=useState<BspAssetStatus>('off'),[modelStatus,setModelStatus]=useState<BspAssetStatus>('off');
  const modelCount=useMemo(()=>bspModelPlacements(map.entities).length,[map]);
  const [speed,setSpeed]=useState(()=>{try{return clampBspFlySpeed(Number(localStorage.getItem('sven-bsp-fly-speed')||360))}catch{return 360}});
  const [sensitivity,setSensitivity]=useState(()=>{try{return clampBspFlySensitivity(Number(localStorage.getItem('sven-bsp-fly-sensitivity')||.002))}catch{return .002}});
  const [smooth,setSmooth]=useState(true),[flyError,setFlyError]=useState('');
  const [fly,setFly]=useState(false),[reset,setReset]=useState(0),[chosen,setChosen]=useState<number|null>(null),[query,setQuery]=useState('');
  const [focus,setFocus]=useState<{index:number;serial:number}|null>(null);
  const [assets,setAssets]=useState<TextureAsset[]>([]),[autoAssets,setAutoAssets]=useState<TextureAsset[]>([]);
  const [autoWadStatus,setAutoWadStatus]=useState<'idle'|'searching'|'ready'|'no-game'|'error'>('idle');
  const [autoWadScanned,setAutoWadScanned]=useState(0),[autoWadPages,setAutoWadPages]=useState([0,0]),[autoWadError,setAutoWadError]=useState('');
  const [autoWadRefresh,setAutoWadRefresh]=useState(0),[loadingWads,setLoadingWads]=useState(false),[wadError,setWadError]=useState('');
  const wadInput=useRef<HTMLInputElement>(null),flyRef=useRef<HTMLCanvasElement|null>(null);
  const allAssets=useMemo(()=>[...autoAssets,...editorAssets,...assets],[autoAssets,editorAssets,assets]);
  const selection=chosen===null?null:map.entities[chosen];
  const filtered=useMemo(()=>map.entities.map((entity,index)=>({entity,index})).filter(x=>x.entity.classname!=='worldspawn'&&bspEntitySearchText(x.entity).includes(query.toLowerCase())).slice(0,250),[map,query]);
  const focusEntity=(index:number)=>{
    if(fly){document.exitPointerLock?.();setFly(false)}
    setChosen(index);setFocus(old=>({index,serial:(old?.serial||0)+1}));
  };
  const imported=useMemo(()=>new Set(allAssets.map(a=>a.name.toLowerCase())),[allAssets]);
  const missing=useMemo(()=>map.textures.filter(tex=>tex.external&&!imported.has(tex.name.toLowerCase())).length,[map,imported]);
  const userProvided=useMemo(()=>new Set([...editorAssets,...assets].map(a=>a.name.toLowerCase())),[editorAssets,assets]);
  const missingLocalNames=useMemo(()=>map.textures.filter(tex=>tex.external&&!userProvided.has(tex.name.toLowerCase())).map(tex=>tex.name),[map,userProvided]);
  useEffect(()=>{
    let active=true;const controller=new AbortController();
    setAutoAssets([]);setAutoWadError('');setAutoWadScanned(0);setAutoWadPages([0,0]);
    if(!missingLocalNames.length){setAutoWadStatus('ready');return ()=>{active=false;controller.abort()}};
    if(!gameDir.trim()){setAutoWadStatus('no-game');return ()=>{active=false;controller.abort()}};
    setAutoWadStatus('searching');
    void (async()=>{
      try{
        const result=await fetchBspAutoWads(gameDir,map.wadNames,missingLocalNames,controller.signal,progress=>{
          if(!active)return;
          setAutoAssets(autoWadTexturesToAssets(progress.textures));
          setAutoWadScanned(progress.scanned);setAutoWadPages([progress.batchesCompleted,progress.batchesTotal]);
        });
        if(!active)return;
        setAutoWadError(result.limited?'Some WAD files could not be checked within the safety limits. You can import them manually.':'');
        setAutoWadStatus('ready');
      }catch(error){if(active&&!controller.signal.aborted){setAutoWadStatus('error');setAutoWadError(String(error))}}
    })();
    return ()=>{active=false;controller.abort()};
  },[map,gameDir,missingLocalNames,autoWadRefresh]);
  useEffect(()=>{setChosen(null);setAssets([]);setFly(false);setQuery('');setFocus(null)},[map]);
  useEffect(()=>{try{localStorage.setItem('sven-bsp-fly-speed',String(speed));localStorage.setItem('sven-bsp-fly-sensitivity',String(sensitivity))}catch{/* Storage can be disabled. */}},[speed,sensitivity]);
  useEffect(()=>()=>{if(document.pointerLockElement===flyRef.current)document.exitPointerLock?.()},[]);
  useEffect(()=>{
    if(!fly)return;
    const canvas=flyRef.current;if(!canvas)return;
    const wheel=(event:WheelEvent)=>{event.preventDefault();setSpeed(old=>clampBspFlySpeed(old*Math.exp(-event.deltaY*.001)))};
    canvas.addEventListener('wheel',wheel,{passive:false});
    return()=>canvas.removeEventListener('wheel',wheel);
  },[fly]);
  useEffect(()=>{
    if(!fly)return;
    const changed=()=>{if(document.pointerLockElement!==flyRef.current)setFly(false)};
    document.addEventListener('pointerlockchange',changed);
    return()=>document.removeEventListener('pointerlockchange',changed);
  },[fly]);
  const importWads=async(files:FileList|null)=>{
    if(!files?.length)return;
    setLoadingWads(true);setWadError('');
    try{const results=await Promise.all(Array.from(files).map(parseWad));setAssets(prev=>[...prev,...results.flat()])}
    catch(err){setWadError(String(err))}finally{setLoadingWads(false)}
  };
  return <div className="bsp-viewer">
    <div className="bsp-toolbar">
      <button onClick={onBack}><ArrowLeft size={15}/>{t('MAP Editor')}</button>
      <strong><Box size={15}/> {t('BSP Viewer')}</strong>
      <span className="bsp-file-name" title={map.name}>{map.name}</span>
      <button onClick={onOpen}><FileUp size={15}/>{t('Open BSP')}</button>
      <button onClick={onCompiled} title={t('Open compiled BSP')}>{t('Compiled BSP')}</button>
      <button className={lightmaps?'bsp-on':''} onClick={()=>setLightmaps(v=>!v)} title={t('Compiled lightmaps')}><Sun size={15}/>{t('Lightmaps')}</button>
      <button className={wireframe?'bsp-on':''} onClick={()=>setWireframe(v=>!v)}><Grid3x3 size={15}/>{t('Wireframe')}</button>
      <button className={showSky?'bsp-on':''} onClick={()=>setShowSky(v=>!v)} title={t('Use installed sky textures')}><Cloud size={15}/>{t('Real skybox')}</button>
      <button className={showModels?'bsp-on':''} onClick={()=>setShowModels(v=>!v)} title={t('Static model previews')}><Package size={15}/>{t('MDL models')}</button>
      <button className={showEntities?'bsp-on':''} onClick={()=>setShowEntities(v=>!v)}><Layers size={15}/>{t('Entities')}</button>
      <button disabled={!showEntities} className={showEntities&&showLabels?'bsp-on':''} onClick={()=>setShowLabels(v=>!v)}><Tags size={15}/>{t('Entity labels')}</button>
      <button className={navSettings?'bsp-on':''} onClick={()=>setNavSettings(v=>!v)}><Settings2 size={15}/>{t('Fly settings')}</button>
      <button onClick={()=>setReset(v=>v+1)} title={t('Reset camera')}><RotateCcw size={15}/></button>
      <button className={fly?'bsp-on bsp-fly-button':'bsp-fly-button'} onClick={()=>{
        if(fly){document.exitPointerLock?.();setFly(false)}
        else {const canvas=flyRef.current;if(canvas?.requestPointerLock){
          setFlyError('');
          canvas.requestPointerLock().then(()=>setFly(true)).catch(()=>{setFly(false);setFlyError(t('Pointer lock blocked. Click the viewer and try again.'))});
        }}
      }}><Move3D size={15}/>{fly?t('Exit fly'):t('Fly WASD')}</button>
    </div>
    <div className="bsp-content">
      <div className="bsp-canvas"><Canvas camera={{position:[480,350,550],fov:65,near:.25,far:200000}} gl={{antialias:true,powerPreference:'high-performance'}} dpr={[1,1.4]}>
        <color attach="background" args={[map.skyname?'#57748f':'#18263a']}/>
        {showSky&&<BspSkyBackground map={map} gameDir={gameDir} onStatus={setSkyStatus}/>}
        {showModels&&<BspStaticModels map={map} gameDir={gameDir} onStatus={setModelStatus}/>} 
        <ambientLight intensity={lightmaps?ambientFill:1.7}/><hemisphereLight args={['#dae4ef','#737e93',lightmaps?.12:1.1]}/>
        <BspSurface map={map} assets={allAssets} lightmaps={lightmaps} wireframe={wireframe} brightness={lightBrightness} preview={rendererPreview}/>
        {showEntities&&<BspEntities map={map} onSelect={setChosen} selected={chosen} labels={showLabels} smartLabels={smartLabels} labelLimit={labelLimit} labelDistance={labelDistance}/>}
        <BspNavigation map={map} fly={fly} reset={reset} flyRef={flyRef} speed={speed} sensitivity={sensitivity} smooth={smooth} focus={focus}/>
      </Canvas>
        {navSettings&&<div className="bsp-fly-settings" onPointerDown={e=>e.stopPropagation()}>
          <strong>{t('Fly camera controls')}</strong>
          <label>{t('Movement speed')}: {Math.round(speed)} u/s
            <input type="range" min={40} max={2000} step={20} value={speed} onChange={e=>setSpeed(clampBspFlySpeed(Number(e.target.value)))}/>
          </label>
          <label>{t('Mouse sensitivity')}: {(sensitivity*1000).toFixed(1)}
            <input type="range" min={.0005} max={.006} step={.00025} value={sensitivity} onChange={e=>setSensitivity(clampBspFlySensitivity(Number(e.target.value)))}/>
          </label>
          <label className="bsp-fly-checkbox"><input type="checkbox" checked={smooth} onChange={e=>setSmooth(e.target.checked)}/>{t('Smooth movement')}</label>
          <small>{t('Mouse wheel changes fly speed')}</small>
        </div>}
        {flyError&&<div className="bsp-fly-error">{flyError}</div>}
        <div className="bsp-viewport-help">{fly?t('WASD move · Mouse look · Shift fast · Ctrl slow · Q/E down/up · Esc exit'):t('Left mouse orbit · Right mouse pan · Wheel zoom · Fly for WASD')}</div>
      </div>
      <aside className="bsp-info">
        <h3><Info size={16}/>{t('Compiled map')}</h3>
        <p className="bsp-note">{t('Read-only preview. Does not change the editable .MAP or .svenstudio.json project.')}</p>
        <div className="bsp-light-settings">
          <strong>{t('GoldSrc Renderer 2.0')}</strong>
          <label className="bsp-fly-checkbox"><input type="checkbox" checked={rendererPreview.enabled} onChange={e=>changeRenderer({enabled:e.target.checked})}/>{t('GoldSrc material preview')}</label>
          <label className="bsp-fly-checkbox"><input type="checkbox" checked={rendererPreview.transparency} onChange={e=>changeRenderer({transparency:e.target.checked})}/>{t('Water and glass transparency')}</label>
          <label className="bsp-fly-checkbox"><input type="checkbox" checked={rendererPreview.waterAnimation} onChange={e=>changeRenderer({waterAnimation:e.target.checked})}/>{t('Water texture animation')}</label>
          <label className="bsp-light-control">{t('Exposure')} · {rendererPreview.exposure.toFixed(2)}×<input type="range" min="0.5" max="2" step="0.05" value={rendererPreview.exposure} onChange={e=>changeRenderer({exposure:Number(e.target.value)})}/></label>
          <small>{t('GoldSrc preview is approximate; compiled BSP lightmaps remain the reference for baked lighting.')}</small>
        </div>
        {lightmaps&&<div className="bsp-light-settings">
          <label className="bsp-light-control">{t('Lightmap intensity')} · {lightBrightness.toFixed(1)}
            <input type="range" min="0.5" max="6" step="0.1" value={lightBrightness} onChange={e=>setLightBrightness(Number(e.target.value))}/>
          </label>
          <label className="bsp-light-control">{t('Ambient fill')} · {ambientFill.toFixed(2)}
            <input type="range" min="0" max="1.2" step="0.04" value={ambientFill} onChange={e=>setAmbientFill(Number(e.target.value))}/>
          </label>
          <button className="bsp-light-reset" onClick={()=>{setLightBrightness(BSP_LIGHTMAP_DEFAULT_INTENSITY);setAmbientFill(BSP_LIGHTMAP_DEFAULT_AMBIENT)}}>{t('Reset lighting')}</button>
          <small>{t('BSP lighting preview is approximate; dynamic lightstyles are not simulated.')}</small>
        </div>}
        <dl><dt>BSP</dt><dd>v{map.version}</dd><dt>{t('Faces')}</dt><dd>{map.stats.faces.toLocaleString()}</dd><dt>{t('Vertices')}</dt><dd>{map.stats.vertices.toLocaleString()}</dd><dt>{t('Entities')}</dt><dd>{map.stats.entities.toLocaleString()}</dd><dt>{t('Models')}</dt><dd>{map.stats.models}</dd><dt>{t('Lightmapped faces')}</dt><dd>{map.stats.lightmappedFaces.toLocaleString()}</dd><dt>{t('Textures')}</dt><dd>{map.textures.length} ({map.stats.embeddedTextures} {t('embedded')})</dd><dt>skyname</dt><dd>{map.skyname||'—'}</dd><dt>{t('Real skybox')}</dt><dd>{t(showSky?skyStatus:'off')}</dd><dt>{t('MDL models')}</dt><dd>{modelCount} · {t(showModels?modelStatus:'off')}</dd></dl>
        {showSky&&skyStatus==='no-game'&&<div className="bsp-warning">{t('Configure the Sven Co-op game directory to preview installed skyboxes.')}</div>}
        {showSky&&skyStatus==='missing'&&<div className="bsp-warning">{t('The six skybox textures were not found for this skyname.')}</div>}
        {showSky&&skyStatus==='error'&&<div className="bsp-warning">{t('Could not load the installed skybox textures.')}</div>}
        {showModels&&modelStatus==='no-game'&&<div className="bsp-warning">{t('Configure the Sven Co-op game directory to load MDL models.')}</div>}
        {showModels&&['missing','error'].includes(modelStatus)&&<div className="bsp-warning">{t('Some MDL assets are unavailable or unsupported.')}</div>}
        <div className="bsp-auto-wad-status" role="status">
          <strong>{t('Automatic WAD textures')}</strong>
          <span>{t(autoWadStatus==='searching'?'Searching installed WADs...':autoWadStatus==='no-game'?'Configure the game folder for automatic WAD loading.':autoWadStatus==='error'?'Automatic WAD lookup failed.':autoWadStatus==='ready'?'Automatic WAD scan finished.':'Automatic WAD lookup idle.')}</span>
          <small>{autoAssets.length} {t('textures loaded')} · {autoWadScanned} {t('WAD files scanned')}{autoWadPages[1]>1?` · ${autoWadPages[0]}/${autoWadPages[1]} ${t('batches')}`:''}</small>
          <button type="button" className="bsp-import" disabled={autoWadStatus==='searching'||!gameDir.trim()} onClick={()=>setAutoWadRefresh(v=>v+1)}><RotateCcw size={14}/>{t('Rescan WADs')}</button>
          {autoWadError&&<small className="bsp-warning">{t(autoWadError)}</small>}
        </div>
        {missing>0&&<div className="bsp-warning">{missing} {t('external textures need WAD files')}</div>}
        <input ref={wadInput} hidden multiple type="file" accept=".wad" onChange={e=>{void importWads(e.target.files);e.target.value=''}}/>
        <button className="bsp-import" onClick={()=>wadInput.current?.click()} disabled={loadingWads}><FileUp size={15}/>{loadingWads?t('Loading WAD...'):t('Import external WAD3')}</button>
        {map.wadNames.length>0&&<p className="bsp-note">WAD: {map.wadNames.join(', ')}</p>}
        {wadError&&<div className="bsp-warning">{wadError}</div>}
        {map.warnings.map((warning,i)=><div className="bsp-warning" key={i}>{warning}</div>)}
        <h3>{t('Entity inspector')}</h3>
        <div className="bsp-label-settings">
          <label className="bsp-label-check"><input type="checkbox" checked={smartLabels} onChange={e=>setSmartLabels(e.target.checked)}/>{t('Avoid overlapping labels')}</label>
          <label>{t('Maximum labels')} · {smartLabels?labelLimit:90}
            <input type="range" min="8" max="80" step="4" value={labelLimit} disabled={!smartLabels} onChange={e=>setLabelLimit(Number(e.target.value))}/>
          </label>
          <label>{t('Label distance')} · {labelDistance} u
            <input type="range" min="400" max="8000" step="200" value={labelDistance} onChange={e=>setLabelDistance(Number(e.target.value))}/>
          </label>
          <small>{t('Selected entities and player spawns receive label priority.')}</small>
        </div>
        <input className="bsp-search" placeholder={t('Search entities...')} value={query} onChange={e=>setQuery(e.target.value)}/>
        <div className="bsp-entity-list">{filtered.map(({entity,index})=><button key={index} className={chosen===index?'active':''} onClick={()=>setChosen(index)} onDoubleClick={()=>focusEntity(index)} title={t('Double-click to focus entity')}><span>{entity.classname}</span><small>{entity.properties.targetname||`#${index}`}</small></button>)}</div>
        {chosen!==null&&selection?.origin&&<button className="bsp-import" onClick={()=>focusEntity(chosen)}><Focus size={15}/>{t('Focus selected entity')}</button>}
        {selection&&<div className="bsp-entity-properties"><h4>{selection.classname}</h4>{Object.entries(selection.properties).map(([k,v])=><div key={k}><b>{k}</b><span>{v}</span></div>)}</div>}
        <p className="bsp-note">{t('BSP Viewer 2.0 uses the installed six-face skybox and optional static MDL bind poses. No gameplay, collision simulation, animations or dynamic engine effects.')}</p>
      </aside>
    </div>
  </div>;
}
