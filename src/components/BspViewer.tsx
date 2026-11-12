import {Canvas,useFrame,useThree,type ThreeEvent} from '@react-three/fiber';
import {OrbitControls,TransformControls,Html} from '@react-three/drei';
import {ArrowLeft,FileUp,Layers,Sun,Grid3x3,Move3D,RotateCcw,Info,Box,Tags,Focus,Settings2,Cloud,Package,ShieldCheck,PenTool,Save,Undo2,Redo2,Copy,Trash2,Plus,AlertTriangle,ChevronDown,MousePointer2,X,LibraryBig,PanelLeftClose,PanelLeftOpen,PanelRightClose,PanelRightOpen,Link2,Unlink2,Network,CheckSquare,GripVertical,Grip,Search,Users,SunMedium,Workflow,Boxes,MapPin,ChevronRight} from 'lucide-react';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import type {MutableRefObject,PointerEvent as ReactPointerEvent,KeyboardEvent as ReactKeyboardEvent} from 'react';
import * as THREE from 'three';
import type {OrbitControls as OrbitControlsImpl,TransformControls as TransformControlsImpl} from 'three-stdlib';
import type {BspFace,BspMap,BspTexture} from '../engine/bsp';
import type {TextureAsset} from '../engine/types';
import {parseWad} from '../engine/wad';
import {autoWadTexturesToAssets,fetchBspAutoWads} from '../engine/bspAutoWad';
import {layoutBspLabels,bspLabelPriority} from '../engine/bspLabelLayout';
import {gameToThree,threeToGame} from '../engine/geometry';
import {useT} from '../i18n';
import {useEditor} from '../store';
import {bspEntityLabel,bspEntitySearchText,bspFlyAxes,bspFlyMultiplier,clampBspFlySpeed,clampBspFlySensitivity,bspCameraPose,bspFlyOrbitTarget,type BspCameraView} from '../engine/bspViewerTools';
import {BspRecoveryStudio} from './BspRecoveryStudio';
import {addNativeEntity,addNativeProperty,nativeClassname,nativeChanged,readNativeBsp,removeNativeProperty,writeNativeBsp,type NativeBsp} from '../engine/bspNativeEdit';
import {bspPointEditable,bspPreviewMap,bspMovePoint,bspRotatePointYaw,bspPointYaw,bspDeletePoint,bspDuplicatePoint,bspSetPointField,bspFormatVector} from '../engine/bspVisualEntityEdit';
import {bspEntityConnections,bspConnectionPositions,bspConnectEntities,bspFlagValue,bspSetMultiplePointFields,bspTranslatePoints, type BspConnection} from '../engine/bspEntityWorkflow';
import {parseBsp} from '../engine/bsp';
import {BspSkyBackground,BspStaticModels,type BspAssetStatus} from './BspViewerAssets';
import {BspModelLibrary} from './BspModelLibrary';
import {bspCanConvertModelEntity,bspConvertModelEntity,type BspModelEntitySpec} from '../engine/bspModelPlacement';
import {bspPaneWidth,readBspPaneWidth} from '../engine/bspPaneLayout';
import {bspToggleSelection} from '../engine/bspSelection';
import {bspFaceDiagnostic,bspOriginalFaceIndex,bspToggleFaceSelection,bspTriangleFacePick} from '../engine/bspFaceSelection';
import {bspSelectSurfaceRegion,bspToggleRegionSelection,BSP_REGION_SELECTION_LIMIT,type BspRegionKind} from '../engine/bspRegionSelection';
import {extractBspObjectPrefab} from '../engine/bspObjectExtractor';
import {readPrefabFolder,ensurePrefabFolderPermission,writePrefabToFolder} from '../engine/prefabStudioFolder';
import {downloadText} from '../engine/paths';
import {bspAllowedFaceTextureIndices,bspCanEditSelectedFaces,bspApplySurfaceOperation,bspFaceIsLightmapped,bspPreviewSurfaceMap,writeBspSurfaceEdits,type BspSurfaceOverrides} from '../engine/bspSurfaceEdit';
import {BspTextureStudio,BspTextureUVWidget} from './BspTextureStudio';
import {BspLightmapStudio} from './BspLightmapStudio';
import {bspPreviewFaceLightmaps,bspValidateLightmapAdjustment,writeBspFaceLightmaps,type BspLightmapAdjustment,type BspLightmapOverrides} from '../engine/bspFaceLightmapEdit';
import {bspBrushCopyEligibility,bspBrushPasteDelta,bspPasteBrushModelInstances,type BspBrushAnchor,type BspVec3} from '../engine/bspBrushPaste';
import {nativeProperty} from '../engine/bspNativeEdit';
import {bspUvGestureOperation} from '../engine/bspUvWidget';
import {bspBatchedUvVertex,bspFaceIdVertexRanges} from '../engine/bspRealtimeUv';
import type {UvHandle} from '../engine/textureStudio';
import {bspEditableTextureName} from '../engine/bspSurfaceEdit';
import {writeBspWadSurfaceCopy,type BspWadChoice} from '../engine/bspTextureEmbedding';
import {compactBspCopy} from '../engine/bspCompactExport';
import {planBspImportedWadRemoval} from '../engine/bspImportedWadManagement';
import {bspRingBearing,bspRingDragAngle,bspRotationArcTriangles,BSP_RING_VISUAL} from '../engine/bspRotationRing';
import {BSP_FLOAT_WIDTH,BSP_FLOAT_HEIGHT,bspEntityCategory,clampBspFloatingPosition,clampBspFloatingRect,clampBspFloatingSize,bspFloatingNearClick,parseBspFloatingPosition,parseBspFloatingSize,type BspEntityCategory,type FloatingBspPosition,type FloatingBspSize} from '../engine/bspVisualInspectorLayout';
import {parseFgd} from '../engine/fgd';
import type {FgdClass} from '../engine/types';
import {bspModelPlacements,bspSpatialBatchCell,bspEntityWithinDistance,bspNearestMarkerIndices} from '../engine/bspViewerAssets';
import type {StudioPreview} from '../engine/mdl';
import {composeBspFaceLighting,bspLightstyleStats} from '../engine/bspLighting';
import {inspectBspLighting} from '../engine/bspLightingDiagnostics';
import {BSP_BAKED_LIGHT_UV_ATTRIBUTE,BSP_BAKED_VERTEX_SHADER,BSP_BAKED_FRAGMENT_SHADER} from '../engine/bspBakedShader';
import {readBspFog,normalizeBspDisplayGamma,BSP_DISPLAY_GAMMA_DEFAULT,type BspFogSettings,type BspLightFilter} from '../engine/bspPresentation';
import {BSP_LIGHTMAP_UV_CHANNEL,BSP_LIGHTMAP_DEFAULT_INTENSITY,BSP_LIGHTMAP_DEFAULT_AMBIENT,bspLightmapAtlasUv,bspDirectLightmapUv,bspPaddedLightmap} from '../engine/bspLightmap';
import {goldSrcMaterial,normalizeGoldSrcPreview,readPreviewSettings,savePreviewSettings,type GoldSrcPreviewSettings} from '../engine/previewEnhancements';

const BSP_STAGE7_LABELS={
  es:{openLight:'Abrir Lightmap Studio',hideLight:'Ocultar Lightmap Studio',edited:'caras con luz RGB pendiente',brush:'Copiar / pegar brushes BSP',desc:'Solo modelos independientes: func_wall y func_illusionary. Seleccioná varios y elegí el destino haciendo clic en el mapa.',anchor:'Anclaje',bottom:'Base del grupo',center:'Centro del grupo',copy:'Copiar brushes y elegir destino',place:'Clic sobre una superficie para pegar. Escape cancela.',cancel:'Cancelar pegado',notice:'Modelos de brush colocados. Exportá una copia BSP y comprobá el resultado en Sven Co-op; worldspawn no cambia.'},
  en:{openLight:'Open Lightmap Studio',hideLight:'Hide Lightmap Studio',edited:'faces with pending RGB edits',brush:'Copy / paste BSP brushes',desc:'Independent models only: func_wall and func_illusionary. Select several and click a destination in the map.',anchor:'Anchor',bottom:'Group bottom',center:'Group center',copy:'Copy brushes and choose destination',place:'Click a surface to paste. Escape cancels.',cancel:'Cancel paste',notice:'Brush-model instances placed. Export a BSP copy and verify in Sven Co-op; worldspawn is unchanged.'},
  ru:{openLight:'Открыть Lightmap Studio',hideLight:'Скрыть Lightmap Studio',edited:'граней с изменённым RGB',brush:'Копировать / вставить BSP brush',desc:'Только независимые модели func_wall и func_illusionary. Выберите объекты и точку вставки.',anchor:'Привязка',bottom:'Низ группы',center:'Центр группы',copy:'Скопировать и выбрать место',place:'Нажмите на поверхность для вставки. Escape отменяет.',cancel:'Отменить вставку',notice:'Копии BSP моделей размещены. Экспортируйте BSP и проверьте в Sven Co-op.'},
  ko:{openLight:'라이트맵 스튜디오 열기',hideLight:'라이트맵 스튜디오 숨기기',edited:'RGB 변경 대기 면',brush:'BSP 브러시 복사 / 붙여넣기',desc:'독립적인 func_wall / func_illusionary 모델만 지원합니다. 여러 개를 선택하고 맵에서 위치를 클릭하세요.',anchor:'기준점',bottom:'그룹 바닥',center:'그룹 중앙',copy:'브러시 복사 및 위치 선택',place:'표면을 클릭하여 붙여넣으세요. Escape 취소.',cancel:'붙여넣기 취소',notice:'브러시 모델 복사본이 배치되었습니다. BSP를 내보내 Sven Co-op에서 확인하세요.'},
  zh:{openLight:'打开 Lightmap Studio',hideLight:'隐藏 Lightmap Studio',edited:'个待保存 RGB 编辑面',brush:'复制 / 粘贴 BSP 笔刷',desc:'仅支持独立 func_wall 和 func_illusionary 模型。选中多个模型后点击地图位置。',anchor:'锚点',bottom:'组底部',center:'组中心',copy:'复制笔刷并选择位置',place:'点击表面粘贴。Escape 取消。',cancel:'取消粘贴',notice:'BSP 模型副本已放置。导出 BSP 并在 Sven Co-op 中验证。'},
  pt:{openLight:'Abrir Lightmap Studio',hideLight:'Ocultar Lightmap Studio',edited:'faces com RGB pendente',brush:'Copiar / colar brushes BSP',desc:'Somente modelos independentes func_wall e func_illusionary. Selecione vários e clique no destino no mapa.',anchor:'Âncora',bottom:'Base do grupo',center:'Centro do grupo',copy:'Copiar brushes e escolher destino',place:'Clique numa superfície para colar. Escape cancela.',cancel:'Cancelar colagem',notice:'Modelos de brush duplicados. Exporte uma cópia BSP e verifique no Sven Co-op.'},
} as const;

const BSP_REGION_LABELS={
  es:{title:'Regiones',details:'Seleccionar región',single:'Caras',region:'Regiones',note:'En worldspawn se seleccionan caras visibles conectadas con la misma textura; no es el brush original. En submodelos *N se selecciona el modelo completo. No permite copiar geometría worldspawn todavía.',typeIsland:'Isla de textura (worldspawn)',typeModel:'Submodelo completo',warning:'Un BSP compilado no conserva la agrupación original de brushes. La selección de regiones no reconstruye colisiones ni VIS.',limit:'El grupo supera el límite de selección segura.'},
  en:{title:'Regions',details:'Region selection',single:'Faces',region:'Regions',note:'For worldspawn, select connected visible faces with the same texture; not the original brush. For *N submodels, select the entire model. Worldspawn geometry cannot yet be copied.',typeIsland:'Texture island (worldspawn)',typeModel:'Entire submodel',warning:'Compiled BSPs do not retain original brush groups. Region selection does not reconstruct collisions or VIS.',limit:'The group exceeds the safe selection limit.'},
  ru:{title:'Области',details:'Выбор области',single:'Грани',region:'Области',note:'В worldspawn выделяются связанные видимые грани с одной текстурой, а не исходный brush; в *N выделяется вся модель. Копирование геометрии worldspawn пока недоступно.',typeIsland:'Область текстуры (worldspawn)',typeModel:'Вся модель',warning:'BSP не хранит исходные группы brush; коллизия и VIS не восстанавливаются.',limit:'Группа превышает безопасный предел.'},
  ko:{title:'영역',details:'영역 선택',single:'면',region:'영역',note:'worldspawn은 같은 텍스처의 연결된 보이는 면만 선택합니다. 원래 브러시가 아닙니다. *N은 모델 전체를 선택합니다. worldspawn 복사는 아직 불가합니다.',typeIsland:'텍스처 영역 (worldspawn)',typeModel:'전체 서브모델',warning:'컴파일된 BSP에는 원래 브러시 그룹이 없습니다. 충돌 및 VIS는 재구성하지 않습니다.',limit:'안전 선택 제한 초과.'},
  zh:{title:'区域',details:'区域选择',single:'面',region:'区域',note:'worldspawn 仅选择使用相同纹理的相连可见面，不代表原始笔刷。*N 则选中整个模型。目前不能复制 worldspawn 几何。',typeIsland:'纹理区域 (worldspawn)',typeModel:'完整子模型',warning:'编译 BSP 不保存原始笔刷分组；此功能不会重建碰撞与 VIS。',limit:'超出安全选择上限。'},
  pt:{title:'Regiões',details:'Selecionar região',single:'Faces',region:'Regiões',note:'Em worldspawn, seleciona faces visíveis conectadas com a mesma textura, não o brush original. Em *N seleciona todo o modelo. Ainda não copia geometria worldspawn.',typeIsland:'Região da textura (worldspawn)',typeModel:'Submodelo completo',warning:'O BSP compilado não guarda os brushes originais. Não reconstrói colisões nem VIS.',limit:'Grupo acima do limite de seleção segura.'}
} as const;

const BSP_BROWSER_CATEGORIES:readonly {id:BspEntityCategory;label:string}[]=[
  {id:'all',label:'All'}, {id:'npc',label:'NPCs'}, {id:'items',label:'Items'},
  {id:'weapons',label:'Weapons'}, {id:'triggers',label:'Triggers'},
  {id:'logic',label:'Logic / spawns'}, {id:'environment',label:'Lights / effects'},
  {id:'geometry',label:'Brush entities'}, {id:'other',label:'Other'}
];
const ATLAS_SIZE=1024,MAX_LIGHT_PAGES=24;
type AtlasPage={rgba:Uint8ClampedArray;x:number;y:number;rowH:number};
type AtlasPlacement={page:number;x:number;y:number};
type RenderChunk={geometry:THREE.BufferGeometry;material:THREE.Material;triangleFaceIds:Uint32Array};
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
function buildBspScene(map:BspMap,wadAssets:TextureAsset[],lightmaps:boolean,wireframe:boolean,preview:GoldSrcPreviewSettings,baked=false,styleFrame=0,surfaceOnly=false):RenderChunk[]{
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
  // On small scenes a separate face texture avoids atlas coordinate/packing
  // dependencies entirely. Large maps keep the existing efficient atlases.
  const directFaces=baked&&lightmaps&&map.faces.length<=64;
  const directTextures=new Map<BspFace,THREE.Texture>();
  if(lightmaps){
    const page=():AtlasPage=>({rgba:new Uint8ClampedArray(ATLAS_SIZE*ATLAS_SIZE*4),x:1,y:1,rowH:0});
    if(!directFaces)pages.push(page());
    for(const face of map.faces){
      const rgb=baked?composeBspFaceLighting(face,map.entities,styleFrame):face.lightRgb,w=face.lightWidth,h=face.lightHeight;
      if(!rgb||w>ATLAS_SIZE-4||h>ATLAS_SIZE-4)continue;
      if(directFaces){
        const texture=canvasTexture(new ImageData(bspPaddedLightmap(rgb,w,h),w+2,h+2));
        texture.colorSpace=THREE.LinearSRGBColorSpace;
        texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
        texture.magFilter=texture.minFilter=THREE.LinearFilter;
        texture.generateMipmaps=false;texture.userData.bspLightmap=true;
        allTextures.push(texture);directTextures.set(face,texture);
        continue;
      }
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
    tex.generateMipmaps=false;tex.userData.bspLightmap=true;
    allTextures.push(tex);return tex;
  });
  type Part={p:number[];n:number[];uv:number[];uv1:number[];triangleFaceIds:number[]};
  const batches=new Map<string,{part:Part;textureIndex:number;page:number;model:number;direct?:THREE.Texture}>();
  for(const [index,face] of map.faces.entries()){
    if(face.points.length<3)continue;
    const tex=map.textures[face.texture],name=tex?.name||'';
    if(!visibleTexture(name))continue;
    const placement=placements.get(face),direct=directTextures.get(face),page=placement?.page??-1;
    const key=direct?`direct:${index}`:`${face.texture}:${page}:${face.model}:${map.faces.length>4000?bspSpatialBatchCell(face.points):'all'}`;
    let entry=batches.get(key);
    if(!entry){entry={textureIndex:face.texture,page,model:face.model,direct,part:{p:[],n:[],uv:[],uv1:[],triangleFaceIds:[]}};batches.set(key,entry)}
    const part=entry.part,normal=geometricNormal(face),w=Math.max(1,tex?.width||16),h=Math.max(1,tex?.height||16);
    for(let i=1;i<face.points.length-1;i++){
      part.triangleFaceIds.push(bspOriginalFaceIndex(face,index));
      for(const k of [0,i,i+1]){
      const point=face.points[k],uv=face.texels[k];
      part.p.push(point[0],point[2],-point[1]);part.n.push(normal.x,normal.y,normal.z);
      part.uv.push(uv[0]/w,-uv[1]/h);
      if(direct){
        const [lightU,lightV]=bspDirectLightmapUv(uv,face.lightMin,face.lightWidth,face.lightHeight);
        part.uv1.push(lightU,lightV);
      }else if(placement){
        const [lightU,lightV]=bspLightmapAtlasUv(uv,face.lightMin,placement,ATLAS_SIZE);
        part.uv1.push(lightU,lightV);
      }else part.uv1.push(0,0);
      }
    }
  }
  const chunks:RenderChunk[]=[];
  for(const {part,textureIndex,page,model,direct} of batches.values()){
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.p,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.n,3));
    geometry.setAttribute('uv',new THREE.Float32BufferAttribute(part.uv,2));
    const lightUv=new THREE.Float32BufferAttribute(part.uv1,2);
    // The UV channel required by built-in Three.js lightmaps also has a
    // custom GLSL attribute for ShaderMaterial, which does not imply USE_UV1.
    geometry.setAttribute('uv1',lightUv);
    geometry.setAttribute(BSP_BAKED_LIGHT_UV_ATTRIBUTE,lightUv);
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
    // True baked mode directly multiplies the compiled RGB lightmap and WAD
    // albedo. No Three.js point/hemisphere lights or PBR ambient term is used.
    // Runtime renderer gamma/palette/lightstyle behavior remains engine-dependent.
    const bakedTexture=direct||(page>=0?atlasTextures[page]:null);
    const material=surfaceOnly?new THREE.MeshBasicMaterial(common):baked&&bakedTexture?new THREE.ShaderMaterial({
      uniforms:{uDiffuse:{value:image},uLighting:{value:bakedTexture},uGain:{value:1},uOpacity:{value:blended?info.opacity:1},uAlphaCutoff:{value:masked?.5:0},
        uDisplayGamma:{value:1},uFogEnabled:{value:false},uFogColor:{value:new THREE.Color('#000000')},uFogStart:{value:0},uFogEnd:{value:1}},
      vertexShader:BSP_BAKED_VERTEX_SHADER,
      fragmentShader:BSP_BAKED_FRAGMENT_SHADER,
      transparent:blended,depthWrite:!blended,side:THREE.DoubleSide,wireframe,
      blending:blended&&info.kind==='additive'?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false
    }):lightmaps&&!bakedTexture&&page<0
      ?new THREE.MeshBasicMaterial(common)
      :new THREE.MeshStandardMaterial({...common,lightMap:page>=0?atlasTextures[page]:null,
        lightMapIntensity:BSP_LIGHTMAP_DEFAULT_INTENSITY,color:'#ffffff',roughness:info.kind==='water'?.28:info.kind==='glass'?.2:1,metalness:info.kind==='glass'?.08:0});
    if(info.kind==='water')material.userData.previewWater=true;
    chunks.push({geometry,material,triangleFaceIds:Uint32Array.from(part.triangleFaceIds)});
  }
  // Assign texture ownership to the collection for deterministic disposal.
  Object.defineProperty(chunks,'ownedTextures',{value:allTextures});
  return chunks;
}
export function BspSurface({map,assets,lightmaps,wireframe,brightness,preview,baked=false,styleFrame=0,surfaceOnly=false,fog=null,displayGamma=BSP_DISPLAY_GAMMA_DEFAULT,lightFilter='linear',overrides,onPlace,onHover,onEmptyClick,onFaceClick,onAltUvStart,onAltUvMove,onAltUvEnd}:{map:BspMap;assets:TextureAsset[];lightmaps:boolean;wireframe:boolean;brightness:number;preview:GoldSrcPreviewSettings;baked?:boolean;styleFrame?:number;surfaceOnly?:boolean;fog?:BspFogSettings|null;displayGamma?:number;lightFilter?:BspLightFilter;overrides?:BspSurfaceOverrides;onPlace?:(position:[number,number,number])=>void;onHover?:(position:[number,number,number])=>void;onEmptyClick?:()=>void;onFaceClick?:(bspFaceIndex:number,extend:boolean,x:number,y:number)=>void;onAltUvStart?:(bspFaceIndex:number)=>void;onAltUvMove?:(dx:number,dy:number)=>void;onAltUvEnd?:(commit:boolean)=>void}){
  const {gl}=useThree();
  const chunks=useMemo(()=>buildBspScene(map,assets,lightmaps,wireframe,preview,baked,styleFrame,surfaceOnly),[map,assets,lightmaps,wireframe,preview.enabled,preview.transparency,baked,styleFrame,surfaceOnly]);
  // Keep GPU meshes, materials, lightmap atlases and async WAD textures mounted
  // while the user drags UV controls. Update ONLY the affected diffuse UV
  // attributes. Rebuilding the entire scene on each pointermove caused a black
  // frame while the material textures were reloaded.
  const uvTargets=useMemo(()=>{
    const byFace=new Map<number,Array<{chunk:RenderChunk;indices:number[];baseline:Float32Array}>>();
    for(const chunk of chunks){
      const baseline=new Float32Array((chunk.geometry.getAttribute('uv') as THREE.BufferAttribute).array as Float32Array);
      for(const [id,indices] of bspFaceIdVertexRanges(chunk.triangleFaceIds)){
        const targets=byFace.get(id)||[];
        targets.push({chunk,indices,baseline});byFace.set(id,targets);
      }
    }
    return byFace;
  },[chunks]);
  const editedUvIds=useRef<Set<number>>(new Set());
  useLayoutEffect(()=>{
    const faces=new Map(map.faces.map((face,index)=>[bspOriginalFaceIndex(face,index),face]));
    const changed=new Set([...editedUvIds.current,...Object.keys(overrides||{}).map(Number)]);
    const touched=new Set<RenderChunk>();
    for(const id of changed){
      const face=faces.get(id),edit=overrides?.[id],texture=map.textures[edit?.texture??face?.texture??-1];
      for(const target of uvTargets.get(id)||[]){
        const uv=target.chunk.geometry.getAttribute('uv') as THREE.BufferAttribute;
        const positions=target.chunk.geometry.getAttribute('position') as THREE.BufferAttribute;
        const raw=uv.array as Float32Array;
        for(const vertex of target.indices){
          if(!face||!edit||!texture){raw[vertex*2]=target.baseline[vertex*2];raw[vertex*2+1]=target.baseline[vertex*2+1];continue}
          const coords=bspBatchedUvVertex(positions.getX(vertex),positions.getY(vertex),positions.getZ(vertex),edit.s,edit.t,texture.width,texture.height);
          raw[vertex*2]=coords[0];raw[vertex*2+1]=coords[1];
        }
        touched.add(target.chunk);
      }
    }
    for(const chunk of touched)(chunk.geometry.getAttribute('uv') as THREE.BufferAttribute).needsUpdate=true;
    editedUvIds.current=new Set(Object.keys(overrides||{}).map(Number));
  },[map,overrides,uvTargets]);
  const waterMaps=useMemo(()=>[...new Set(chunks.filter(c=>c.material.userData.previewWater).map(c=>(c.material as THREE.MeshStandardMaterial).map).filter((x):x is THREE.Texture=>!!x))],[chunks]);
  useFrame(({clock})=>{for(const tex of waterMaps){tex.offset.x=preview.enabled&&preview.waterAnimation?Math.sin(clock.elapsedTime*.65)*.02:0;tex.offset.y=preview.enabled&&preview.waterAnimation?clock.elapsedTime*.014%1:0;}});
  useEffect(()=>{gl.toneMapping=baked?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;gl.toneMappingExposure=baked?1:preview.enabled?preview.exposure:1;return()=>{gl.toneMapping=THREE.NoToneMapping;gl.toneMappingExposure=1}},[gl,preview.enabled,preview.exposure,baked]);
  useEffect(()=>{
    for(const chunk of chunks){
      if(chunk.material instanceof THREE.MeshStandardMaterial)chunk.material.lightMapIntensity=brightness;
      if(chunk.material instanceof THREE.ShaderMaterial){
        const u=chunk.material.uniforms;
        u.uGain.value=brightness;
        u.uDisplayGamma.value=normalizeBspDisplayGamma(displayGamma);
        u.uFogEnabled.value=!!fog;
        u.uFogColor.value.set(fog?.hex||'#000000');
        u.uFogStart.value=fog?.start??0;
        u.uFogEnd.value=fog?.end??1;
      }
    }
    const textures=(chunks as RenderChunk[]&{ownedTextures?:THREE.Texture[]}).ownedTextures||[];
    const filter=lightFilter==='nearest'?THREE.NearestFilter:THREE.LinearFilter;
    for(const texture of textures){
      if(!texture.userData.bspLightmap)continue;
      if(texture.magFilter!==filter||texture.minFilter!==filter){
        texture.magFilter=filter;texture.minFilter=filter;texture.needsUpdate=true;
      }
    }
  },[chunks,brightness,displayGamma,fog,lightFilter]);
  useEffect(()=>()=>{
    chunks.forEach(c=>{c.geometry.dispose();c.material.dispose()});
    const textures=(chunks as RenderChunk[]&{ownedTextures?:THREE.Texture[]}).ownedTextures;
    textures?.forEach(t=>t.dispose());
  },[chunks]);
  const uvDrag=useRef<{pointer:number;x:number;y:number}|null>(null);
  const consumedAltClick=useRef(false);
  const finishAltRef=useRef(onAltUvEnd);
  finishAltRef.current=onAltUvEnd;
  useEffect(()=>{
    // Pointer capture is not guaranteed when Chrome loses focus or the pointer leaves
    // its canvas. Clear the drag even if R3F never receives an onPointerUp.
    const end=(event:PointerEvent)=>{
      if(!uvDrag.current||uvDrag.current.pointer!==event.pointerId)return;
      uvDrag.current=null;finishAltRef.current?.(event.type==='pointerup');
    };
    const blur=()=>{if(!uvDrag.current)return;uvDrag.current=null;finishAltRef.current?.(false)};
    window.addEventListener('pointerup',end);window.addEventListener('pointercancel',end);
    window.addEventListener('blur',blur);
    return ()=>{window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);window.removeEventListener('blur',blur)};
  },[]);
  return <group>{chunks.map((c,i)=><mesh key={i} geometry={c.geometry} material={c.material} frustumCulled
    onPointerDown={e=>{if(!e.nativeEvent.altKey)consumedAltClick.current=false;if(!onAltUvStart||!e.nativeEvent.altKey||e.button!==0)return;
      const id=bspTriangleFacePick(c.triangleFaceIds,e.faceIndex);if(id===null)return;
      e.stopPropagation();consumedAltClick.current=true;uvDrag.current={pointer:e.pointerId,x:e.nativeEvent.clientX,y:e.nativeEvent.clientY};
      (e.target as unknown as {setPointerCapture?:(id:number)=>void})?.setPointerCapture?.(e.pointerId);onAltUvStart(id);
    }}
    onPointerUp={e=>{if(!uvDrag.current||uvDrag.current.pointer!==e.pointerId)return;e.stopPropagation();uvDrag.current=null;onAltUvEnd?.(true);if((e.target as unknown as {hasPointerCapture?:(id:number)=>boolean})?.hasPointerCapture?.(e.pointerId))(e.target as unknown as {releasePointerCapture:(id:number)=>void}).releasePointerCapture(e.pointerId)}}
    onPointerCancel={e=>{if(!uvDrag.current||uvDrag.current.pointer!==e.pointerId)return;e.stopPropagation();uvDrag.current=null;onAltUvEnd?.(false)}}

    onClick={e=>{if(consumedAltClick.current){consumedAltClick.current=false;e.stopPropagation();return;}if(e.button!==0||e.delta>5||e.nativeEvent.altKey)return;e.stopPropagation();if(onFaceClick){const original=bspTriangleFacePick(c.triangleFaceIds,e.faceIndex);if(original!==null)onFaceClick(original,!!(e.nativeEvent.ctrlKey||e.nativeEvent.metaKey||e.nativeEvent.shiftKey),e.nativeEvent.clientX,e.nativeEvent.clientY);return}if(onPlace){const normal=e.face?.normal.clone()||new THREE.Vector3(0,1,0);if(normal.dot(e.ray.direction)>0)normal.negate();onPlace(threeToGame(e.point.clone().addScaledVector(normal,4)) as [number,number,number])}else onEmptyClick?.()}}
    onPointerMove={e=>{if(uvDrag.current&&uvDrag.current.pointer===e.pointerId){e.stopPropagation();onAltUvMove?.(e.nativeEvent.clientX-uvDrag.current.x,e.nativeEvent.clientY-uvDrag.current.y);return;}if(!onHover)return;const normal=e.face?.normal.clone()||new THREE.Vector3(0,1,0);if(normal.dot(e.ray.direction)>0)normal.negate();onHover(threeToGame(e.point.clone().addScaledVector(normal,4)) as [number,number,number]);}}
  />)}</group>;
}
/** Lightweight, unpickable selection highlight. Reuses the original BSP face polygon. */
function BspFaceHighlight({face}:{face:BspFace}){
  const geometries=useMemo(()=>{
    const fill=new THREE.BufferGeometry(),line=new THREE.BufferGeometry();
    const vertices:number[]=[],outline:number[]=[];
    const normal=geometricNormal(face);
    const point=(p:[number,number,number])=>[p[0]+normal.x*.16,p[2]+normal.y*.16,-p[1]+normal.z*.16];
    for(let i=1;i<face.points.length-1;i++)for(const index of [0,i,i+1])vertices.push(...point(face.points[index]));
    for(const p of face.points)outline.push(...point(p));
    fill.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    line.setAttribute('position',new THREE.Float32BufferAttribute(outline,3));
    return {fill,line};
  },[face]);
  useEffect(()=>()=>{geometries.fill.dispose();geometries.line.dispose()},[geometries]);
  return <group raycast={()=>null}>
    <mesh geometry={geometries.fill} raycast={()=>null} renderOrder={7}>
      <meshBasicMaterial color="#20d6f8" side={THREE.DoubleSide} transparent opacity={.27} depthWrite={false} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2}/>
    </mesh>
    <lineLoop geometry={geometries.line} raycast={()=>null} renderOrder={8}>
      <lineBasicMaterial color="#79f5ff" transparent opacity={.95} depthWrite={false} depthTest={true}/>
    </lineLoop>
  </group>;
}
/** Preview is a pure overlay. The exported brush copy is an entity using the
 * same compiled *N bmodel; clipping/hulls are not reconstructed. */
function BspBrushPastePreview({map,doc,indices,destination,anchor}:{map:BspMap;doc:NativeBsp;indices:number[];destination:BspVec3;anchor:BspBrushAnchor}){
  const geometry=useMemo(()=>{
    const chosenModels=new Set(indices.map(index=>Number(nativeProperty(doc.entities[index],'model').slice(1))));
    const positions:number[]=[];
    for(const face of map.faces)if(chosenModels.has(face.model)){
      for(let i=1;i<face.points.length-1;i++)for(const k of [0,i,i+1]){
        const point=face.points[k];positions.push(point[0],point[2],-point[1]);
      }
    }
    const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));return result;
  },[map,doc,indices]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  const delta=useMemo(()=>{
    try{return bspBrushPasteDelta(map,doc,indices,destination,anchor)}catch{return [0,0,0] as BspVec3}
  },[map,doc,indices,destination,anchor]);
  return <group position={[delta[0],delta[2],-delta[1]]} raycast={()=>null}>
    <mesh geometry={geometry} raycast={()=>null} renderOrder={9}>
      <meshBasicMaterial color="#33eaba" transparent opacity={.25} depthTest={false} depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>
    <mesh geometry={geometry} raycast={()=>null} renderOrder={10}>
      <meshBasicMaterial color="#b3ffe8" transparent opacity={.8} wireframe depthTest={false} depthWrite={false}/>
    </mesh>
  </group>;
}
/** Distinguish newly added bmodel instances from original entities using
 * model occurrence counts (no custom keys injected into the exported BSP). */
function BspPastedBrushInstances({map,doc,assets}:{map:BspMap;doc:NativeBsp;assets:TextureAsset[]}){
  const instances=useMemo(()=>{
    const originalCounts=new Map<string,number>();
    for(const ent of map.entities){const model=ent.properties.model||'';if(/^\*\d+$/.test(model))originalCounts.set(model,(originalCounts.get(model)||0)+1)}
    const occurrences=new Map<string,number>();
    const origins=new Map<string,BspVec3>();
    for(const ent of map.entities){const model=ent.properties.model||'';
      if(!origins.has(model)){const pos=(ent.properties.origin||'0 0 0').split(/\s+/).map(Number);origins.set(model,pos.length===3&&pos.every(Number.isFinite)?pos as BspVec3:[0,0,0]);}}
    return doc.entities.flatMap(ent=>{
      const model=nativeProperty(ent,'model');if(!/^\*[1-9]\d*$/.test(model))return [];
      const count=(occurrences.get(model)||0)+1;occurrences.set(model,count);
      if(count<=(originalCounts.get(model)||0)||!['func_wall','func_illusionary'].includes(nativeProperty(ent,'classname')))return [];
      const origin=nativeProperty(ent,'origin').trim().split(/\s+/).map(Number),base=origins.get(model)||[0,0,0];
      if(origin.length!==3||origin.some(x=>!Number.isFinite(x)))return [];
      return [{model:Number(model.slice(1)),delta:origin.map((v,i)=>v-base[i]) as BspVec3}];
    });
  },[map,doc]);
  // Batch faces of each independent model by texture. These are visual preview
  // instances, not additional worldspawn faces or editable collision meshes.
  const groups=useMemo(()=>{
    const models=[...new Set(instances.map(item=>item.model))];
    const assetsByName=new Map(assets.map(asset=>[asset.name.toLowerCase(),asset]));
    const textures=new Map<number,THREE.Texture>();
    const materials=new Map<number,THREE.MeshBasicMaterial>();
    const materialFor=(id:number)=>{
      const existing=materials.get(id);if(existing)return existing;
      const tex=map.textures[id];let image:THREE.Texture;
      if(tex?.rgba)image=canvasTexture(new ImageData(new Uint8ClampedArray(tex.rgba),tex.width,tex.height));
      else {
        const asset=assetsByName.get((tex?.name||'').toLowerCase());
        if(asset?.dataUrl){image=new THREE.TextureLoader().load(asset.dataUrl);image.wrapS=image.wrapT=THREE.RepeatWrapping;image.colorSpace=THREE.SRGBColorSpace;image.magFilter=THREE.NearestFilter;}
        else image=checkerTexture();
      }
      textures.set(id,image);
      const material=new THREE.MeshBasicMaterial({map:image,side:THREE.DoubleSide});materials.set(id,material);return material;
    };
    const result=models.map(model=>{
      const parts=new Map<number,number[]>();
      for(const face of map.faces)if(face.model===model){
        const arr=parts.get(face.texture)||[];
        const tex=map.textures[face.texture],w=Math.max(1,tex?.width||16),h=Math.max(1,tex?.height||16);
        for(let i=1;i<face.points.length-1;i++)for(const k of [0,i,i+1]){
          const point=face.points[k],uv=face.texels[k];
          arr.push(point[0],point[2],-point[1],uv[0]/w,-uv[1]/h);
        }
        parts.set(face.texture,arr);
      }
      return {model,parts:[...parts].map(([id,values])=>{
        const positions:number[]=[],uv:number[]=[];
        for(let i=0;i<values.length;i+=5){positions.push(...values.slice(i,i+3));uv.push(values[i+3],values[i+4]);}
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
        return {geometry,material:materialFor(id)};
      })};
    });
    return {result,materials,textures};
  },[instances,map,assets]);
  useEffect(()=>()=>{
    for(const model of groups.result)for(const part of model.parts)part.geometry.dispose();
    for(const material of groups.materials.values())material.dispose();
    for(const texture of groups.textures.values())texture.dispose();
  },[groups]);
  if(!instances.length)return null;
  return <group raycast={()=>null}>{instances.map((item,i)=>{
    const model=groups.result.find(group=>group.model===item.model);if(!model)return null;
    return <group key={`${item.model}:${i}`} position={[item.delta[0],item.delta[2],-item.delta[1]]} raycast={()=>null}>
      {model.parts.map((part,j)=><mesh key={j} geometry={part.geometry} material={part.material} raycast={()=>null}/>)}
    </group>;
  })}</group>;
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
function BspEntities({map,onSelect,onContextEntity,selected,extraSelected,labels,smartLabels,labelLimit,labelDistance,entityDistance}:{map:BspMap;onSelect:(index:number,extend:boolean,clientX?:number,clientY?:number)=>void;onContextEntity?:(index:number,x:number,y:number)=>void;selected:number|null;extraSelected:readonly number[];labels:boolean;smartLabels:boolean;labelLimit:number;labelDistance:number;entityDistance:number}){
  const {camera,size}=useThree();
  const [markerAnchor,setMarkerAnchor]=useState<[number,number,number]>(()=>bspCameraPose(map).position);
  useEffect(()=>setMarkerAnchor(bspCameraPose(map).position),[map.name]);
  const anchorVector=useMemo(()=>new THREE.Vector3(...markerAnchor),[markerAnchor]);
  const markers=useMemo(()=>{
    const nearest=bspNearestMarkerIndices(map.entities,threeToGame(anchorVector),800,selected);
    // Every selected entity must keep its marker even when the nearest-800
    // budget is exhausted by unrelated entities on a large map.
    const visible=new Set([...nearest,...extraSelected]);
    return [...visible].filter(i=>!!map.entities[i]?.origin).map(i=>({
      i,entity:map.entities[i],position:gameToThree(map.entities[i].origin!),
    }));
  },[map,selected,extraSelected,anchorVector]);
  const labelRefs=useRef(new Map<number,THREE.Sprite>());
  const markerRefs=useRef(new Map<number,THREE.Group>());
  const textureCache=useMemo(()=>new Map<string,THREE.CanvasTexture>(),[map]);
  const elapsed=useRef(0),vec=useMemo(()=>new THREE.Vector3(),[]),labelOffset=useMemo(()=>new THREE.Vector3(),[]);
  useEffect(()=>()=>{for(const tex of textureCache.values())tex.dispose()},[textureCache]);
  useFrame((_,delta)=>{
    elapsed.current+=delta;
    if(elapsed.current<.12)return;
    elapsed.current=0;
    // Refresh the bounded marker set as the camera visits another area.
    const travel=Math.max(340,entityDistance*.4);
    if(camera.position.distanceToSquared(anchorVector)>travel*travel)
      setMarkerAnchor(camera.position.toArray() as [number,number,number]);
    const camGame:[number,number,number]=[camera.position.x,-camera.position.z,camera.position.y];
    for(const m of markers){
      const group=markerRefs.current.get(m.i);
      if(group)group.visible=bspEntityWithinDistance(m.entity.origin,camGame,entityDistance,m.i===selected||extraSelected.includes(m.i));
    }
    if(!labels){for(const sprite of labelRefs.current.values())sprite.visible=false;return}
    const candidates=[];
    for(const m of markers){
      const dist=camera.position.distanceToSquared(m.position);
      if(m.i!==selected&&(dist>labelDistance*labelDistance||dist>entityDistance*entityDistance))continue;
      vec.copy(m.position).project(camera);
      if(vec.z<=-1||vec.z>=1||Math.abs(vec.x)>1.04||Math.abs(vec.y)>1.04)continue;
      const selectedLabel=m.i===selected||extraSelected.includes(m.i),text=bspEntityLabel(m.entity),texture=textureCache.get(text);
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
      const labelHeight=m.i===selected||extraSelected.includes(m.i)?27:22;
      sprite.scale.set(texture.image.width/texture.image.height*labelHeight*worldPerPixel,labelHeight*worldPerPixel,1);
      sprite.position.copy(m.position).add(labelOffset.set(0,10+labelHeight*worldPerPixel*.55,0));
    }
  });
  return <group>{markers.map(({entity,i,position})=>{
    const marked=selected===i||extraSelected.includes(i);
    const color=entity.classname.startsWith('light')?'#e8be65':entity.classname.includes('player')?'#5ddb9b':'#74afe3';
    return <group key={i} ref={group=>{if(group)markerRefs.current.set(i,group);else markerRefs.current.delete(i)}}>
      <mesh position={position.toArray()} onContextMenu={event=>{event.stopPropagation();event.nativeEvent.preventDefault();onContextEntity?.(i,event.nativeEvent.clientX,event.nativeEvent.clientY)}} onClick={event=>{event.stopPropagation();onSelect(i,!!(event.nativeEvent.ctrlKey||event.nativeEvent.metaKey||event.nativeEvent.shiftKey),event.nativeEvent.clientX,event.nativeEvent.clientY)}}>
        <sphereGeometry args={[marked?11:7,8,6]}/><meshBasicMaterial color={marked?'#fff3ac':color} depthTest={false}/>
      </mesh>
      {marked&&<group position={position.toArray()} raycast={()=>null}>
        <mesh rotation={[-Math.PI/2,0,0]} renderOrder={9} raycast={()=>null}>
          <ringGeometry args={[18,21,40]}/>
          <meshBasicMaterial color={i===selected?'#55efff':'#ffd76e'} transparent opacity={.96} depthTest={false} depthWrite={false} side={THREE.DoubleSide}/>
        </mesh>
        <mesh position={[0,17,0]} renderOrder={9} raycast={()=>null}>
          <sphereGeometry args={[3,8,6]}/><meshBasicMaterial color="#fff3b4" depthTest={false} depthWrite={false}/>
        </mesh>
      </group>}
      <sprite ref={sprite=>{if(sprite)labelRefs.current.set(i,sprite);else labelRefs.current.delete(i)}} visible={false}
        onClick={event=>{event.stopPropagation();onSelect(i,!!(event.nativeEvent.ctrlKey||event.nativeEvent.metaKey||event.nativeEvent.shiftKey),event.nativeEvent.clientX,event.nativeEvent.clientY)}} onContextMenu={event=>{event.stopPropagation();event.nativeEvent.preventDefault();onContextEntity?.(i,event.nativeEvent.clientX,event.nativeEvent.clientY)}} frustumCulled={false} renderOrder={8}>
        <spriteMaterial transparent depthTest={false} depthWrite={false}/>
      </sprite>
    </group>;
  })}</group>;
}
/** Connections are editor overlays. They never alter compiled VIS or brush geometry. */
function BspConnectionLines({map,edges}:{map:BspMap;edges:readonly BspConnection[]}){
  const lines=useMemo(()=>{
    const positions=bspConnectionPositions(map.entities,edges,160);
    return (['target','killtarget','trigger_target'] as const).map(kind=>{
      const vertices:number[]=[];
      for(const edge of positions.filter(edge=>edge.key===kind)){
        const a=gameToThree(edge.start),b=gameToThree(edge.end);
        vertices.push(a.x,a.y,a.z,b.x,b.y,b.z);
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      return {kind,geometry,count:vertices.length};
    });
  },[map,edges]);
  useEffect(()=>()=>lines.forEach(x=>x.geometry.dispose()),[lines]);
  return <group raycast={()=>null}>{lines.filter(x=>x.count).map(x=><lineSegments key={x.kind} geometry={x.geometry} raycast={()=>null} renderOrder={6}>
    <lineBasicMaterial color={x.kind==='killtarget'?'#fd7d84':x.kind==='trigger_target'?'#d5a2ff':'#6eecc9'} depthTest={false} transparent opacity={.85}/>
  </lineSegments>)}</group>;
}

/** Compact rotating two-arc handle. The model's rendered forward direction is
 * deliberately not inferred from a generic arrow: this edits GoldSrc yaw. */
function BspPointGizmo({position,yaw,mode,onCommit}:{position:[number,number,number];yaw:number;mode:'translate'|'rotate';onCommit:(next:{position?:[number,number,number];yaw?:number})=>void}){
  const pivot=useRef<THREE.Group>(null!);
  const gizmo=useRef<TransformControlsImpl>(null!);
  const orbitControls=useThree(state=>state.controls);
  const start=useMemo(()=>gameToThree(position),[position]);
  const angle=THREE.MathUtils.degToRad(yaw);
  const begin=useRef<THREE.Vector3|null>(null);
  const drag=useRef<{angle:number;lastBearing:number;pointerId:number}|null>(null);
  const suspendedOrbit=useRef<{control:{enabled:boolean};wasEnabled:boolean}|null>(null);
  const [liveYaw,setLiveYaw]=useState(yaw);
  const [dragging,setDragging]=useState(false);
  const [hover,setHover]=useState(false);
  const plane=useMemo(()=>new THREE.Plane(new THREE.Vector3(0,1,0),-(start.y+8)),[start.y]);
  const rotationArcs=useMemo(()=>{
    const mesh=new THREE.BufferGeometry();
    mesh.setAttribute('position',new THREE.BufferAttribute(bspRotationArcTriangles(),3));
    return mesh;
  },[]);
  useEffect(()=>()=>rotationArcs.dispose(),[rotationArcs]);
  const normalizedYaw=(value:number)=>((Math.round(value)%360)+360)%360;
  const deltaYaw=((liveYaw-yaw+540)%360)-180;
  const restoreOrbit=()=>{
    const previous=suspendedOrbit.current;
    if(previous)previous.control.enabled=previous.wasEnabled;
    suspendedOrbit.current=null;
  };
  useEffect(()=>{setLiveYaw(yaw);setDragging(false);drag.current=null},[yaw,mode]);
  // Also restore navigation if a selected entity disappears during dragging.
  useEffect(()=>()=>{
    const previous=suspendedOrbit.current;
    if(previous)previous.control.enabled=previous.wasEnabled;
    suspendedOrbit.current=null;
  },[]);
  const bearing=(event:ThreeEvent<PointerEvent>)=>{
    const point=event.ray.intersectPlane(plane,new THREE.Vector3());
    if(!point||!Number.isFinite(point.x)||!Number.isFinite(point.z))return null;
    return bspRingBearing(point.x,point.z,start.x,start.z);
  };
  const beginRing=(event:ThreeEvent<PointerEvent>)=>{
    if(event.button!==0)return;
    const startBearing=bearing(event);
    if(startBearing===null)return;
    event.stopPropagation();
    drag.current={angle:pivot.current.rotation.y,lastBearing:startBearing,pointerId:event.pointerId};
    setDragging(true);
    const control=orbitControls as unknown as {enabled:boolean}|undefined;
    if(control&&typeof control.enabled==='boolean'){
      suspendedOrbit.current={control,wasEnabled:control.enabled};control.enabled=false;
    }
    (event.target as unknown as {setPointerCapture?:(id:number)=>void}).setPointerCapture?.(event.pointerId);
  };
  const moveRing=(event:ThreeEvent<PointerEvent>)=>{
    const current=drag.current;
    if(!current||event.pointerId!==current.pointerId)return;
    event.stopPropagation();
    const nextBearing=bearing(event);
    if(nextBearing===null)return;
    current.angle=bspRingDragAngle(current.angle,current.lastBearing,nextBearing);
    current.lastBearing=nextBearing;
    pivot.current.rotation.y=current.angle;
    setLiveYaw(THREE.MathUtils.radToDeg(current.angle));
  };
  const finishRing=(event:ThreeEvent<PointerEvent>,cancel=false)=>{
    const current=drag.current;
    if(!current||event.pointerId!==current.pointerId)return;
    event.stopPropagation();
    drag.current=null;
    const target=event.target as unknown as {hasPointerCapture?:(id:number)=>boolean;releasePointerCapture?:(id:number)=>void};
    if(target.hasPointerCapture?.(event.pointerId))target.releasePointerCapture?.(event.pointerId);
    restoreOrbit();setDragging(false);setHover(false);
    if(cancel){pivot.current.rotation.y=angle;setLiveYaw(yaw);return;}
    if(Math.abs(current.angle-angle)>.0001)onCommit({yaw:THREE.MathUtils.radToDeg(current.angle)});
  };
  return <>
    <group ref={pivot} position={start} rotation={[0,angle,0]}>
      {mode==='translate'&&<mesh raycast={()=>null}><sphereGeometry args={[9,10,8]}/><meshBasicMaterial color="#fff6b1" transparent opacity={.45} depthTest={false}/></mesh>}
      {mode==='rotate'&&<group position={[0,8,0]}>
        {/* Two compact curved-arrow strokes signal rotation without a gigantic
            solid disk. A larger transparent annulus keeps rotation easy to grab. */}
        <mesh rotation={[-Math.PI/2,0,0]} geometry={rotationArcs} renderOrder={12} raycast={()=>null}>
          <meshBasicMaterial color={dragging?'#c1f8ff':hover?'#91ebff':'#62c6ea'} transparent opacity={dragging||hover?.99:.9} side={THREE.DoubleSide} depthTest={false} depthWrite={false}/>
        </mesh>
        <mesh rotation={[-Math.PI/2,0,0]} renderOrder={13}
          onPointerOver={event=>{event.stopPropagation();setHover(true)}}
          onPointerOut={()=>{if(!drag.current)setHover(false)}}
          onPointerDown={beginRing} onPointerMove={moveRing}
          onPointerUp={event=>finishRing(event)}
          onPointerCancel={event=>finishRing(event,true)}>
          <ringGeometry args={[BSP_RING_VISUAL.grabInnerRadius,BSP_RING_VISUAL.grabOuterRadius,96]}/>
          <meshBasicMaterial transparent opacity={0} colorWrite={false} side={THREE.DoubleSide} depthTest={false} depthWrite={false}/>
        </mesh>
        <Html position={[0,27,0]} center style={{pointerEvents:'none'}}>
          <div className="bsp-yaw-readout">Yaw: {normalizedYaw(liveYaw)}°{dragging&&<span> {deltaYaw>=0?'+':''}{Math.round(deltaYaw)}°</span>}</div>
        </Html>
      </group>}
    </group>
    {mode==='translate'&&<TransformControls ref={gizmo} object={pivot} mode="translate" space="world" size={.85}
      onObjectChange={()=>{ /* Translation is committed only once on release. */ }}
      onMouseDown={()=>{begin.current=pivot.current.position.clone();setDragging(true)}}
      onMouseUp={()=>{
        const first=begin.current;begin.current=null;setDragging(false);
        if(first&&first.distanceToSquared(pivot.current.position)>.000001)
          onCommit({position:threeToGame(pivot.current.position) as [number,number,number]});
      }}/>}
  </>;
}

/** Commit a keyvalue on blur/Enter, rather than on each keystroke (one undo step). */
function BspValueInput({value,onCommit,disabled,label}:{value:string;onCommit:(value:string)=>void;disabled?:boolean;label:string}){
  const [draft,setDraft]=useState(value);
  const cancelled=useRef(false);
  useEffect(()=>setDraft(value),[value]);
  return <input aria-label={label} value={draft} disabled={disabled} onChange={e=>setDraft(e.target.value)}
    onBlur={()=>{if(cancelled.current){cancelled.current=false;return}if(draft!==value)onCommit(draft)}}
    onKeyDown={e=>{if(e.key==='Enter'){e.currentTarget.blur()}else if(e.key==='Escape'){cancelled.current=true;setDraft(value);e.currentTarget.blur();e.stopPropagation()}}}/>;
}

export function BspNavigation({map,fly,reset,flyRef,speed,sensitivity,smooth,focus,view='interior',uvDragging=false}:{map:BspMap;fly:boolean;reset:number;uvDragging?:boolean;view?:BspCameraView;
  flyRef:MutableRefObject<HTMLCanvasElement|null>;speed:number;sensitivity:number;smooth:boolean;focus:{index:number;serial:number;position?:[number,number,number]}|null}){
  const {camera,gl}=useThree();
  const orbit=useRef<OrbitControlsImpl>(null),keys=useRef(new Set<string>());
  const velocity=useRef(new THREE.Vector3());
  const targetVelocity=useMemo(()=>new THREE.Vector3(),[]);
  const forward=useMemo(()=>new THREE.Vector3(),[]),right=useMemo(()=>new THREE.Vector3(),[]);
  const justFlying=useRef(false);
  // Keep the last pointer-locked pose independently of OrbitControls: React
  // may mount/enable OrbitControls before the fly=false layout effect fires.
  const finalFlyPose=useRef<{position:THREE.Vector3;rotation:THREE.Quaternion}|null>(null);
  const handoffFrames=useRef(0);
  const orbitTarget=useRef(new THREE.Vector3());
  useEffect(()=>{
    const pose=bspCameraPose(map,view);
    const position=new THREE.Vector3(...pose.position),target=new THREE.Vector3(...pose.target);
    const span=Math.max(150,gameToThree(map.bounds.max).distanceTo(gameToThree(map.bounds.min)));
    camera.position.copy(position);
    camera.near=.25;camera.far=Math.max(5000,span*25);camera.updateProjectionMatrix();
    camera.lookAt(target);orbitTarget.current.copy(target);orbit.current?.target.copy(target);orbit.current?.update();
    velocity.current.set(0,0,0);
  },[camera,map,reset,view]);
  useEffect(()=>{
    if(!focus)return;
    const position=focus.position||map.entities[focus.index]?.origin;if(!position)return;
    const at=gameToThree(position),offset=new THREE.Vector3(100,75,110);
    camera.position.copy(at).add(offset);
    camera.lookAt(at);
    orbitTarget.current.copy(at);orbit.current?.target.copy(at);orbit.current?.update();
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
  // Hand off the exact pointer-locked pose both ways. Keep one OrbitControls
  // instance mounted: recreating it when entering flight restores an obsolete
  // target and can rotate the camera even before the first mouse movement.
  useLayoutEffect(()=>{
    flyRef.current=gl.domElement;
    if(fly){
      // Enter flight from the *current* orbit pose, not the old orbit target.
      // OrbitControls must remain mounted across mode changes: remounting it
      // with a stale target used to rotate the camera as soon as Fly was pressed.
      const posePosition=camera.position.clone(),poseRotation=camera.quaternion.clone();
      forward.set(0,0,-1).applyQuaternion(poseRotation).normalize();
      orbitTarget.current.set(...bspFlyOrbitTarget(posePosition.toArray(),forward.toArray()));
      if(orbit.current){
        const control=orbit.current,damping=control.enableDamping;
        control.enableDamping=false;control.target.copy(orbitTarget.current);control.update();control.enableDamping=damping;
      }
      camera.position.copy(posePosition);camera.quaternion.copy(poseRotation);camera.updateMatrixWorld();
      justFlying.current=true;handoffFrames.current=0;
      finalFlyPose.current={position:posePosition,rotation:poseRotation};
      velocity.current.set(0,0,0);keys.current.clear();return;
    }
    if(!justFlying.current)return;
    const posePosition=finalFlyPose.current?.position.clone()||camera.position.clone(),poseRotation=finalFlyPose.current?.rotation.clone()||camera.quaternion.clone();
    forward.set(0,0,-1).applyQuaternion(poseRotation).normalize();
    orbitTarget.current.set(...bspFlyOrbitTarget(posePosition.toArray(),forward.toArray()));
    orbit.current?.target.copy(orbitTarget.current);
    orbit.current?.update();
    camera.position.copy(posePosition);camera.quaternion.copy(poseRotation);
    // Drei/OrbitControls can run its own update after the mode switches.
    // Reapply the snapshot after that update for a few frames, then release.
    finalFlyPose.current={position:posePosition,rotation:poseRotation};
    handoffFrames.current=3;
    velocity.current.set(0,0,0);keys.current.clear();justFlying.current=false;
  },[fly,camera,gl,flyRef,forward]);
  useEffect(()=>{
    if(!fly)return;
    const euler=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');
    const move=(event:MouseEvent)=>{
      if(document.pointerLockElement!==gl.domElement)return;
      euler.y-=event.movementX*sensitivity;
      euler.x=THREE.MathUtils.clamp(euler.x-event.movementY*sensitivity,-Math.PI/2+.015,Math.PI/2-.015);
      camera.quaternion.setFromEuler(euler);
      finalFlyPose.current={position:camera.position.clone(),rotation:camera.quaternion.clone()};
    };
    document.addEventListener('mousemove',move);
    return()=>{document.removeEventListener('mousemove',move);keys.current.clear()};
  },[fly,camera,gl,sensitivity]);
  useFrame((_,delta)=>{
    if(!fly){
      if(handoffFrames.current>0&&finalFlyPose.current){
        const pose=finalFlyPose.current,control=orbit.current;
        if(control){
          const damping=control.enableDamping;control.enableDamping=false;
          control.target.copy(orbitTarget.current);control.update();control.enableDamping=damping;
        }
        camera.position.copy(pose.position);camera.quaternion.copy(pose.rotation);camera.updateMatrixWorld();
        handoffFrames.current--;
      }
      return;
    }
    if(document.pointerLockElement!==gl.domElement)return;
    const axes=bspFlyAxes(keys.current),dt=Math.min(delta,.08);
    camera.getWorldDirection(forward);
    orbitTarget.current.set(...bspFlyOrbitTarget(camera.position.toArray(),forward.toArray()));
    right.crossVectors(forward,camera.up).normalize();
    targetVelocity.copy(forward).multiplyScalar(axes.forward).addScaledVector(right,axes.right);
    targetVelocity.y+=axes.up;
    if(targetVelocity.lengthSq()>1)targetVelocity.normalize();
    targetVelocity.multiplyScalar(speed*bspFlyMultiplier(keys.current));
    if(smooth)velocity.current.lerp(targetVelocity,1-Math.exp(-12*dt));
    else velocity.current.copy(targetVelocity);
    camera.position.addScaledVector(velocity.current,dt);
    finalFlyPose.current={position:camera.position.clone(),rotation:camera.quaternion.clone()};
  });
  return <OrbitControls ref={orbit} target={orbitTarget.current} enabled={!fly&&!uvDragging} makeDefault enableDamping dampingFactor={.12} maxDistance={100000}/>;
}
export function BspViewer({map,source,initialBaked=false,editingRequested=false,onEditingChange,onBack,onOpen,onCompiled,onOpenRecoveredMap}:{map:BspMap;source:ArrayBuffer|null;initialBaked?:boolean;editingRequested?:boolean;onEditingChange?:(editing:boolean)=>void;onBack:()=>void;onOpen:()=>void;onCompiled:()=>void;onOpenRecoveredMap:(source:string,name:string,textures?:TextureAsset[])=>Promise<boolean>}){
  const editorAssets=useEditor(s=>s.textureAssets);
  const gameDir=useEditor(s=>s.settings.gameDir);
  const fgdClasses=useEditor(s=>s.fgdClasses);
  // Extra FGD definitions apply to this BSP editor session only; they do not
  // mutate shared MAP editor definitions or execute #include directives.
  const [extraFgdFiles,setExtraFgdFiles]=useState<{name:string;text:string}[]>([]);
  const [fgdImportError,setFgdImportError]=useState('');
  const fgdFileInput=useRef<HTMLInputElement>(null);
  const effectiveFgdClasses=useMemo<FgdClass[]>(()=>{
    if(!extraFgdFiles.length)return fgdClasses;
    const extras=parseFgd(extraFgdFiles.map(f=>f.text).join('\n'));
    return [...new Map([...fgdClasses,...extras].map(cls=>[cls.name.toLowerCase(),cls])).values()].sort((a,b)=>a.name.localeCompare(b.name));
  },[fgdClasses,extraFgdFiles]);
  const importExtraFgd=async(files:FileList|null)=>{
    if(!files?.length)return;
    try{
      if(files.length>8||Array.from(files).some(f=>!f.name.toLowerCase().endsWith('.fgd')||f.size>2_000_000))throw Error('Choose up to 8 FGD files, each no larger than 2 MB.');
      const incoming=await Promise.all(Array.from(files).map(async f=>({name:f.name,text:await f.text()})));
      const merged=[...new Map([...extraFgdFiles,...incoming].map(f=>[f.name.toLowerCase(),f])).values()];
      if(merged.length>8||merged.reduce((n,f)=>n+f.text.length,0)>8_000_000)throw Error('Additional FGD files exceed the safety limit.');
      if(!parseFgd(merged.map(f=>f.text).join('\n')).length)throw Error('No supported PointClass or SolidClass definitions found.');
      setExtraFgdFiles(merged);setFgdImportError('');
    }catch(error){setFgdImportError(String(error instanceof Error?error.message:error))}
  };
  const [entityEdit,setEntityEdit]=useState(false);
  const [surfaceMode,setSurfaceMode]=useState<'entities'|'faces'>('entities');
  const [facePickMode,setFacePickMode]=useState<'face'|'region'>('face');
  const [regionKind,setRegionKind]=useState<BspRegionKind|null>(null);
  const [regionSelectionError,setRegionSelectionError]=useState('');
  const [objectExtractError,setObjectExtractError]=useState('');
  const [selectedFaces,setSelectedFaces]=useState<number[]>([]);
  const [lightmapHistory,setLightmapHistory]=useState<{past:BspLightmapOverrides[];present:BspLightmapOverrides;future:BspLightmapOverrides[]}>({past:[],present:{},future:[]});
  const [lightmapStudioOpen,setLightmapStudioOpen]=useState(false);
  const [lightmapEditError,setLightmapEditError]=useState('');
  const [surfaceHistory,setSurfaceHistory]=useState<{past:BspSurfaceOverrides[];present:BspSurfaceOverrides;future:BspSurfaceOverrides[]}>({past:[],present:{},future:[]});
  const [surfaceTexture,setSurfaceTexture]=useState(-1);
  const [surfaceShiftU,setSurfaceShiftU]=useState(0),[surfaceShiftV,setSurfaceShiftV]=useState(0);
  const [surfaceRotate,setSurfaceRotate]=useState(0),[surfaceScaleU,setSurfaceScaleU]=useState(1),[surfaceScaleV,setSurfaceScaleV]=useState(1);
  const [surfaceError,setSurfaceError]=useState(''),[surfaceNotice,setSurfaceNotice]=useState('');
  const [bspStudioOpen,setBspStudioOpen]=useState(true);
  const [gesturePreview,setGesturePreview]=useState<BspSurfaceOverrides|null>(null);
  const [uvDragging,setUvDragging]=useState(false);
  const gestureRef=useRef<{base:BspSurfaceOverrides;faces:number[]}|null>(null);
  const previewRef=useRef<BspSurfaceOverrides|null>(null);
  const [importedWadAssets,setImportedWadAssets]=useState<TextureAsset[]>([]);
  const [importedWadData,setImportedWadData]=useState<{name:string;bytes:Uint8Array}[]>([]);
  // Panels dock either side of the scene and persist their independently adjustable widths.
  const [leftPaneWidth,setLeftPaneWidth]=useState(()=>readBspPaneWidth('left'));
  const [rightPaneWidth,setRightPaneWidth]=useState(()=>readBspPaneWidth('right'));
  const [leftPaneOpen,setLeftPaneOpen]=useState(true),[rightPaneOpen,setRightPaneOpen]=useState(true);
  const bspContentRef=useRef<HTMLDivElement>(null);
  const paneWidthsRef=useRef({left:leftPaneWidth,right:rightPaneWidth});
  paneWidthsRef.current={left:leftPaneWidth,right:rightPaneWidth};
  const resizeSession=useRef<{side:'left'|'right';startX:number;startWidth:number}|null>(null);
  const [modelLibraryOpen,setModelLibraryOpen]=useState(false);
  const [localModels,setLocalModels]=useState<Map<string,StudioPreview>>(()=>new Map());
  const [modelReport,setModelReport]=useState<{loaded:number;total:number;missing:string[]}|null>(null);
  const [placement,setPlacement]=useState<{classname:string;model?:string;spec?:BspModelEntitySpec}|null>(null);
  const [placementHover,setPlacementHover]=useState<[number,number,number]|null>(null);
  const [brushPaste,setBrushPaste]=useState<{indices:number[];anchor:BspBrushAnchor}|null>(null);
  const [brushPasteHover,setBrushPasteHover]=useState<BspVec3|null>(null);
  const [brushAnchor,setBrushAnchor]=useState<BspBrushAnchor>('bottom');
  const [entityHistory,setEntityHistory]=useState<{past:NativeBsp[];present:NativeBsp;future:NativeBsp[]}|null>(null);
  const [entityError,setEntityError]=useState(''),[entityNotice,setEntityNotice]=useState('');
  const [gizmoMode,setGizmoMode]=useState<'translate'|'rotate'>('translate');
  const [newEntityQuery,setNewEntityQuery]=useState(''),[newEntityClass,setNewEntityClass]=useState('info_target');
  const entitySearchRef=useRef<HTMLInputElement>(null),entityCreateRef=useRef<HTMLInputElement>(null);
  const [inspectorJump,setInspectorJump]=useState<'search'|'create'|null>(null);
  const [newKey,setNewKey]=useState(''),[newValue,setNewValue]=useState('');
  const [extraSelected,setExtraSelected]=useState<number[]>([]),[multiSelectMode,setMultiSelectMode]=useState(false),[showConnections,setShowConnections]=useState(true);
  const [connectionArmed,setConnectionArmed]=useState(false),[connectionKey,setConnectionKey]=useState<BspConnection['key']>('target');
  const [batchKey,setBatchKey]=useState('spawnflags'),[batchValue,setBatchValue]=useState('0');
  const [propertiesTab,setPropertiesTab]=useState<'attributes'|'flags'|'raw'>('attributes');
  const [browseCategory,setBrowseCategory]=useState<BspEntityCategory>('all');
  const [browsePage,setBrowsePage]=useState(1);
  const [propertiesOpen,setPropertiesOpen]=useState(true);
  const [floatingPosition,setFloatingPosition]=useState<FloatingBspPosition|null>(()=>{
    try{return parseBspFloatingPosition(localStorage.getItem('sven-bsp-floating-properties-v1'))}catch{return null}
  });
  const [floatingSize,setFloatingSize]=useState<FloatingBspSize>(()=>{
    try{return parseBspFloatingSize(localStorage.getItem('sven-bsp-floating-properties-size-v1'))||{width:BSP_FLOAT_WIDTH,height:BSP_FLOAT_HEIGHT}}catch{return {width:BSP_FLOAT_WIDTH,height:BSP_FLOAT_HEIGHT}}
  });
  const [contentSize,setContentSize]=useState({width:1280,height:720});
  const effectiveFloatingSize=clampBspFloatingSize(floatingSize,contentSize.width,contentSize.height);
  const effectiveFloatingPosition=clampBspFloatingRect(floatingPosition||{x:260,y:45},effectiveFloatingSize,contentSize.width,contentSize.height);
  const floatingDrag=useRef<{pointer:number;startX:number;startY:number;position:FloatingBspPosition}|null>(null);
  const floatingResize=useRef<{pointer:number;startX:number;startY:number;size:FloatingBspSize;position:FloatingBspPosition}|null>(null);
  const propertiesPositionRef=useRef(floatingPosition);propertiesPositionRef.current=floatingPosition;
  const floatingSizeRef=useRef(floatingSize);floatingSizeRef.current=floatingSize;
  useEffect(()=>{
    if(!floatingPosition)return;
    try{localStorage.setItem('sven-bsp-floating-properties-v1',JSON.stringify(floatingPosition))}catch{/* Private mode */}
  },[floatingPosition]);
  useEffect(()=>{
    try{localStorage.setItem('sven-bsp-floating-properties-size-v1',JSON.stringify(floatingSize))}catch{/* Private mode */}
  },[floatingSize]);
  const beginBspPropertiesDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.button!==0||(event.target as HTMLElement).closest('button,input,select'))return;
    event.preventDefault();event.stopPropagation();
    const pos=propertiesPositionRef.current||{x:200,y:40};
    floatingDrag.current={pointer:event.pointerId,startX:event.clientX,startY:event.clientY,position:pos};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragBspProperties=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const drag=floatingDrag.current;if(!drag||drag.pointer!==event.pointerId)return;
    const rect=bspContentRef.current?.getBoundingClientRect();if(!rect)return;
    event.preventDefault();
    setFloatingPosition(clampBspFloatingRect({x:drag.position.x+event.clientX-drag.startX,y:drag.position.y+event.clientY-drag.startY},floatingSizeRef.current,rect.width,rect.height));
  };
  const finishBspPropertiesDrag=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(!floatingDrag.current||floatingDrag.current.pointer!==event.pointerId)return;
    floatingDrag.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    const pos=propertiesPositionRef.current;
    if(pos)try{localStorage.setItem('sven-bsp-floating-properties-v1',JSON.stringify(pos))}catch{/* Private mode */}
  };
  const beginBspPropertiesResize=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    const rect=bspContentRef.current?.getBoundingClientRect();if(!rect)return;
    const size=clampBspFloatingSize(floatingSizeRef.current,rect.width,rect.height);
    floatingResize.current={pointer:event.pointerId,startX:event.clientX,startY:event.clientY,size,position:clampBspFloatingRect(propertiesPositionRef.current||{x:260,y:45},size,rect.width,rect.height)};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const dragBspPropertiesResize=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const drag=floatingResize.current;if(!drag||drag.pointer!==event.pointerId)return;
    const rect=bspContentRef.current?.getBoundingClientRect();if(!rect)return;
    event.preventDefault();event.stopPropagation();
    const size=clampBspFloatingSize({width:drag.size.width+event.clientX-drag.startX,height:drag.size.height+event.clientY-drag.startY},rect.width,rect.height);
    setFloatingSize(size);
    setFloatingPosition(clampBspFloatingRect(drag.position,size,rect.width,rect.height));
  };
  const finishBspPropertiesResize=(event:ReactPointerEvent<HTMLDivElement>)=>{
    if(!floatingResize.current||floatingResize.current.pointer!==event.pointerId)return;
    floatingResize.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const resizeBspPropertiesByKeyboard=(deltaWidth:number,deltaHeight:number)=>{
    const rect=bspContentRef.current?.getBoundingClientRect();if(!rect)return;
    const size=clampBspFloatingSize({width:floatingSizeRef.current.width+deltaWidth,height:floatingSizeRef.current.height+deltaHeight},rect.width,rect.height);
    setFloatingSize(size);
    setFloatingPosition(old=>clampBspFloatingRect(old||{x:260,y:45},size,rect.width,rect.height));
  };
  useEffect(()=>{
    const root=bspContentRef.current;
    if(!root||typeof ResizeObserver==='undefined')return;
    const observer=new ResizeObserver(()=>{
      const width=root.clientWidth,height=root.clientHeight;
      setContentSize(previous=>previous.width===width&&previous.height===height?previous:{width,height});
      setFloatingPosition(old=>old?clampBspFloatingRect(old,floatingSizeRef.current,width,height):old);
    });
    observer.observe(root);return()=>observer.disconnect();
  },[]);
  const showBspProperties=(clientX?:number,clientY?:number)=>{
    setPropertiesOpen(true);
    setFloatingPosition(old=>{
      if(old)return old;
      const rect=bspContentRef.current?.getBoundingClientRect();
      if(!rect)return {x:260,y:40};
      const click=clientX!==undefined&&clientY!==undefined?{x:clientX-rect.left,y:clientY-rect.top}:{x:rect.width*.52,y:rect.height*.3};
      return bspFloatingNearClick(click,rect.width,rect.height);
    });
  };

  const [contextMenu,setContextMenu]=useState<{index:number;x:number;y:number}|null>(null);
  const contextStart=useRef<{x:number;y:number}|null>(null);
  useEffect(()=>{try{localStorage.setItem('sven-bsp-left-pane-width',String(leftPaneWidth));localStorage.setItem('sven-bsp-right-pane-width',String(rightPaneWidth))}catch{/* Private browsing can disable storage. */}},[leftPaneWidth,rightPaneWidth]);
  useEffect(()=>{
    const root=bspContentRef.current;if(!root||typeof ResizeObserver==='undefined')return;
    const adjust=()=>{
      // Small-screen CSS stacks panes; desktop widths must leave space for the canvas.
      if(root.clientWidth<=760)return;
      const current=paneWidthsRef.current;
      const right=bspPaneWidth('right',current.right,root.clientWidth,leftPaneOpen?current.left:0);
      const left=bspPaneWidth('left',current.left,root.clientWidth,rightPaneOpen?right:0);
      setRightPaneWidth(right);setLeftPaneWidth(left);
    };
    const observer=new ResizeObserver(adjust);observer.observe(root);adjust();
    return()=>observer.disconnect();
  },[leftPaneOpen,rightPaneOpen]);
  const setPaneSize=(side:'left'|'right',width:number)=>{
    const container=bspContentRef.current?.clientWidth||1280;
    const other=side==='left'?(rightPaneOpen?rightPaneWidth:0):(leftPaneOpen?leftPaneWidth:0);
    const clamped=bspPaneWidth(side,width,container,other);
    if(side==='left')setLeftPaneWidth(clamped);else setRightPaneWidth(clamped);
  };
  const startPaneResize=(side:'left'|'right',event:ReactPointerEvent<HTMLDivElement>)=>{
    if(event.button!==0)return;
    event.preventDefault();event.stopPropagation();
    resizeSession.current={side,startX:event.clientX,startWidth:side==='left'?leftPaneWidth:rightPaneWidth};
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const movePaneResize=(event:ReactPointerEvent<HTMLDivElement>)=>{
    const session=resizeSession.current;if(!session)return;
    event.preventDefault();
    const delta=event.clientX-session.startX;
    setPaneSize(session.side,session.startWidth+(session.side==='left'?delta:-delta));
  };
  const finishPaneResize=(event:ReactPointerEvent<HTMLDivElement>)=>{
    resizeSession.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const paneKeyResize=(side:'left'|'right',event:ReactKeyboardEvent<HTMLDivElement>)=>{
    if(event.key!=='ArrowLeft'&&event.key!=='ArrowRight')return;
    event.preventDefault();event.stopPropagation();
    const direction=event.key==='ArrowRight'?1:-1;
    setPaneSize(side,(side==='left'?leftPaneWidth:rightPaneWidth)+(side==='left'?direction:-direction)*20);
  };
  useEffect(()=>{
    if(!inspectorJump||!rightPaneOpen)return;
    const target=inspectorJump==='search'?entitySearchRef.current:entityCreateRef.current;
    target?.scrollIntoView({block:'center',behavior:'auto'});target?.focus();
    setInspectorJump(null);
  },[inspectorJump,rightPaneOpen]);
  const jumpToInspector=(where:'search'|'create')=>{setRightPaneOpen(true);setInspectorJump(where)};
  const stage7Text=BSP_STAGE7_LABELS[useEditor.getState().locale]||BSP_STAGE7_LABELS.en;
  const regionLabels=BSP_REGION_LABELS[useEditor.getState().locale as keyof typeof BSP_REGION_LABELS]||BSP_REGION_LABELS.en;
  const t=useT(),[lightmaps,setLightmaps]=useState(true),[wireframe,setWireframe]=useState(false),[showEntities,setShowEntities]=useState(true),[baked,setBaked]=useState(initialBaked),[styleFrame,setStyleFrame]=useState(0);
  const [showLabels,setShowLabels]=useState(true),[navSettings,setNavSettings]=useState(false),[recoveryOpen,setRecoveryOpen]=useState(false);
  useEffect(()=>{setSurfaceMode('entities');setImportedWadAssets([]);setImportedWadData([]);setGesturePreview(null);previewRef.current=null;gestureRef.current=null;setUvDragging(false);setSelectedFaces([]);setSurfaceHistory({past:[],present:{},future:[]});setSurfaceError('');setSurfaceNotice('');setRecoveryOpen(false);setEntityEdit(false);setPlacement(null);setModelLibraryOpen(false);setEntityHistory(null);setExtraSelected([]);setConnectionArmed(false);setEntityError('');setEntityNotice('')},[source]);
  const [smartLabels,setSmartLabels]=useState(true),[labelLimit,setLabelLimit]=useState(32),[labelDistance,setLabelDistance]=useState(2400);
  const [entityDistance,setEntityDistance]=useState(1200);
  const [groundModelPreviews,setGroundModelPreviews]=useState(true);
  const [lightBrightness,setLightBrightness]=useState(BSP_LIGHTMAP_DEFAULT_INTENSITY);
  const [rendererPreview,setRendererPreview]=useState(()=>readPreviewSettings('goldsrc-preview-2',normalizeGoldSrcPreview));
  useEffect(()=>savePreviewSettings('goldsrc-preview-2',rendererPreview),[rendererPreview]);
  const changeRenderer=(patch:Partial<GoldSrcPreviewSettings>)=>setRendererPreview(p=>normalizeGoldSrcPreview({...p,...patch}));
  const [ambientFill,setAmbientFill]=useState(BSP_LIGHTMAP_DEFAULT_AMBIENT);
  const bspFog=useMemo(()=>readBspFog(map.entities),[map]);
  const [fogEnabled,setFogEnabled]=useState(()=>readBspFog(map.entities)?.initiallyEnabled??false);
  const [displayGamma,setDisplayGamma]=useState(BSP_DISPLAY_GAMMA_DEFAULT);
  const [lightFilter,setLightFilter]=useState<BspLightFilter>('linear');
  useEffect(()=>setFogEnabled(bspFog?.initiallyEnabled??false),[bspFog]);
  const effectiveFog=fogEnabled?bspFog:null;
  const [showSky,setShowSky]=useState(true),[showModels,setShowModels]=useState(false);
  const [skyStatus,setSkyStatus]=useState<BspAssetStatus>('off'),[modelStatus,setModelStatus]=useState<BspAssetStatus>('off');
  const styleStats=useMemo(()=>bspLightstyleStats(map.faces),[map]);
  const lightingAudit=useMemo(()=>inspectBspLighting(map.faces,map.entities,styleFrame),[map,styleFrame]);
  const [speed,setSpeed]=useState(()=>{try{return clampBspFlySpeed(Number(localStorage.getItem('sven-bsp-fly-speed')||360))}catch{return 360}});
  const [sensitivity,setSensitivity]=useState(()=>{try{return clampBspFlySensitivity(Number(localStorage.getItem('sven-bsp-fly-sensitivity')||.002))}catch{return .002}});
  const [smooth,setSmooth]=useState(true),[flyError,setFlyError]=useState('');
  const [fly,setFly]=useState(false),[reset,setReset]=useState(0),[cameraView,setCameraView]=useState<BspCameraView>('interior'),[chosen,setChosen]=useState<number|null>(null),[query,setQuery]=useState('');
  const [focus,setFocus]=useState<{index:number;serial:number}|null>(null);
  const [assets,setAssets]=useState<TextureAsset[]>([]),[autoAssets,setAutoAssets]=useState<TextureAsset[]>([]);
  const [autoWadStatus,setAutoWadStatus]=useState<'idle'|'searching'|'ready'|'no-game'|'error'>('idle');
  const [autoWadScanned,setAutoWadScanned]=useState(0),[autoWadPages,setAutoWadPages]=useState([0,0]),[autoWadError,setAutoWadError]=useState('');
  const [autoWadRefresh,setAutoWadRefresh]=useState(0),[loadingWads,setLoadingWads]=useState(false),[wadError,setWadError]=useState('');
  const wadInput=useRef<HTMLInputElement>(null),flyRef=useRef<HTMLCanvasElement|null>(null);
  const allAssets=useMemo(()=>[...assets,...editorAssets,...autoAssets],[autoAssets,editorAssets,assets]);
  // Only entity overlays update on edits; BSP surface geometry, textures and camera stay mounted.
  const doc=entityHistory?.present||null;
  const viewMap=useMemo(()=>entityEdit&&doc?bspPreviewMap(map,doc):map,[entityEdit,doc,map]);
  const studioByClass=useMemo(()=>Object.fromEntries(effectiveFgdClasses.filter(item=>item.type==='point'&&item.studio).map(item=>[item.name.toLowerCase(),item.studio!])),[effectiveFgdClasses]);
  const modelCount=useMemo(()=>bspModelPlacements(viewMap.entities,96,22,studioByClass,chosen).length,[viewMap,studioByClass,chosen]);
  const selection=chosen===null?null:viewMap.entities[chosen];
  const buildImportedChoices=(items:readonly TextureAsset[])=>{
    const names=new Set(map.textures.map(texture=>texture.name.toUpperCase()));
    return items.flatMap(asset=>{
      const key=asset.name.toUpperCase();
      if(!bspEditableTextureName(asset.name)||asset.width%16!==0||asset.height%16!==0||names.has(key))return [];
      names.add(key);return [{name:asset.name,width:asset.width,height:asset.height,wad:asset.wad}];
    });
  };
  const importedChoices=useMemo(()=>buildImportedChoices(importedWadAssets),[map,importedWadAssets]);
  const extendedMap=useMemo<BspMap>(()=>importedChoices.length?{...map,textures:[...map.textures,...importedChoices.map(choice=>({name:choice.name,width:choice.width,height:choice.height,external:true}))]}:map,[map,importedChoices]);
  const exportedChoices: BspWadChoice[]=importedChoices;
  const removeUnusedImportedWad=(filename:string)=>{
    try{
      if(gestureRef.current)finishUvGesture(false);
      const snapshots=[...surfaceHistory.past,surfaceHistory.present,...surfaceHistory.future];
      const clean=(name:string)=>name.toLowerCase()!==filename.toLowerCase();
      if(!importedWadData.some(item=>!clean(item.name)))throw Error('Only WAD3 files imported into this BSP session can be removed.');
      const retainedChoices=buildImportedChoices(importedWadAssets.filter(asset=>clean(asset.wad)));
      const plan=planBspImportedWadRemoval(map.textures.length,importedChoices,filename,snapshots,surfaceTexture,retainedChoices);
      const previousCount=surfaceHistory.past.length;
      setImportedWadData(previous=>previous.filter(wad=>clean(wad.name)));
      setImportedWadAssets(previous=>previous.filter(asset=>clean(asset.wad)));
      setAssets(previous=>previous.filter(asset=>clean(asset.wad)));
      setSurfaceHistory({past:plan.states.slice(0,previousCount),present:plan.states[previousCount],future:plan.states.slice(previousCount+1)});
      setSurfaceTexture(plan.selectedTexture);
      setWadError('');setSurfaceError('');
      setSurfaceNotice(`${filename}: ${plan.removedTextures} imported texture(s) removed from this editor session; original files were not touched.`);
    }catch(error){setWadError(String(error instanceof Error?error.message:error))}
  };
  const surfaceOverrides=surfaceHistory.present;
  const surfaceEdited=Object.keys(surfaceOverrides).length>0;
  const surfaceMap=useMemo(()=>bspPreviewSurfaceMap(extendedMap,gesturePreview??surfaceOverrides),[extendedMap,surfaceOverrides,gesturePreview]);
  // Source BSP meshes only rebuild when a face CHANGES TEXTURE (or WADs load),
  // never when its UV axes move/rotate/scale. Otherwise the whole map flashes.
  const renderTextureKey=Object.entries(surfaceOverrides).filter(([id,edit])=>{
    const face=extendedMap.faces.find((face,i)=>bspOriginalFaceIndex(face,i)===Number(id));
    return face&&edit.texture!==face.texture;
  }).map(([id,edit])=>`${id}:${edit.texture}`).sort().join('|');
  const renderDiffuseMap=useMemo<BspMap>(()=>{
    if(!renderTextureKey)return extendedMap;
    const substitutions=new Map(renderTextureKey.split('|').map(chunk=>chunk.split(':').map(Number) as [number,number]));
    return {...extendedMap,faces:extendedMap.faces.map((face,i)=>{
      const replacement=substitutions.get(bspOriginalFaceIndex(face,i));
      return replacement===undefined?face:{...face,texture:replacement};
    })};
  },[extendedMap,renderTextureKey]);
  const lightmapOverrides=lightmapHistory.present;
  const lightmapEdited=Object.keys(lightmapOverrides).length>0;
  // Only rebuild the lighting atlas when a lightmap edit is COMMITTED, not on
  // each slider movement. Stable texture/UV drags continue their fast path.
  const renderSurfaceMap=useMemo(()=>bspPreviewFaceLightmaps(renderDiffuseMap,lightmapOverrides),[renderDiffuseMap,lightmapOverrides]);
  const applyLightmapEdit=(op:BspLightmapAdjustment)=>{
    try{
      const next={...lightmapHistory.present};
      if(!selectedFaces.length)throw Error('Select at least one BSP face to edit.');
      for(const id of selectedFaces){bspValidateLightmapAdjustment(map,id,op);next[id]={...op,tint:[...op.tint] as [number,number,number]}}
      setLightmapHistory(old=>({past:[...old.past.slice(-79),old.present],present:next,future:[]}));setLightmapEditError('');
    }catch(e){setLightmapEditError(String(e instanceof Error?e.message:e))}
  };
  const undoLightmapEdit=()=>setLightmapHistory(old=>old.past.length?{past:old.past.slice(0,-1),present:old.past[old.past.length-1],future:[old.present,...old.future].slice(0,80)}:old);
  const redoLightmapEdit=()=>setLightmapHistory(old=>old.future.length?{past:[...old.past,old.present].slice(-80),present:old.future[0],future:old.future.slice(1)}:old);
  const extractSelectedObject=async(mode:'exact'|'surface-shell'|'hull0-solid'='exact')=>{
    try{
      if(!source)throw Error('No BSP source data is loaded.');
      const title=window.prompt('BSP Object Extractor — nombre del objeto / Object name:',map.name.replace(/\.bsp$/i,'')+'_objeto');
      if(title===null)return;
      if(!title.trim())throw Error('Choose a non-empty object name.');
      const prefab=extractBspObjectPrefab(surfaceMap,source,selectedFaces,title.trim(),importedWadData.map(w=>w.bytes),{mode});
      const skipped=prefab.recovery?.skippedFaces??[];
      if(skipped.length){
        const example=skipped.slice(0,6).map(item=>`#${item.faceId}: ${item.reason}`).join('\n');
        const lang=useEditor.getState().locale;
        const notices:Record<string,[string,string,string]>={
          es:['Recuperación PARCIAL','caras no pudieron convertirse en paneles válidos. El objeto puede quedar incompleto.','¿Guardar este prefab incompleto?'],
          en:['PARTIAL recovery','faces could not be converted to valid panels. The object may be incomplete.','Save this incomplete prefab?'],
          ru:['ЧАСТИЧНОЕ восстановление','граней не удалось преобразовать в панели. Объект может быть неполным.','Сохранить неполный префаб?'],
          ko:['부분 복구','개 면을 유효한 패널로 변환하지 못했습니다. 개체가 불완전할 수 있습니다.','불완전한 프리팹을 저장할까요?'],
          zh:['部分恢复','个面无法转换为有效面板。对象可能不完整。','是否保存这个不完整的预制件？'],
          pt:['Recuperação PARCIAL','faces não puderam ser convertidas em painéis válidos. O objeto pode ficar incompleto.','Salvar este prefab incompleto?'],
        };
        const [heading,detail,question]=notices[lang]??notices.en;
        const warning=`${heading}: ${skipped.length} / ${selectedFaces.length} ${detail}\n${prefab.objects.length} panels / paneles.\n\nBSP faces / caras BSP:\n${example}\n\n${question}`;
        if(!window.confirm(warning)){
          setObjectExtractError(`${heading}: ${skipped.length} BSP faces (#${skipped.slice(0,8).map(f=>f.faceId).join(', #')}); ${lang==='es'?'exportación cancelada':'export cancelled'}.`);
          return;
        }
      }
      const fileName=(title.trim().replace(/[^a-z0-9_-]/gi,'_').slice(0,40)||'bsp_object')+(skipped.length?`_PARCIAL_${skipped.length}`:mode==='hull0-solid'?'_HULL0':'');
      let destination='';
      const folder=await readPrefabFolder().catch(()=>null);
      if(folder&&await ensurePrefabFolderPermission(folder,true)){
        destination=await writePrefabToFolder(folder,prefab,`${fileName}.svprefab`);
      }else{downloadText(JSON.stringify(prefab),`${fileName}.svprefab`,'application/json');destination='Downloads';}
      setObjectExtractError('');setSurfaceNotice(mode==='hull0-solid'
        ?`HULL-0 SOLID PREFAB saved to ${destination}: ${prefab.objects.length} reconstructed convex BSP cells with WAD3. NOT original brushes; material boundaries, collision hulls and baked lighting are not recovered. Validate appearance and compile in Sven Co-op.`
        :mode==='surface-shell'
        ?`APPROXIMATE SURFACE PREFAB saved to ${destination}: ${prefab.objects.length} thin editable MAP panels; ${skipped.length} BSP faces omitted (${skipped.slice(0,8).map(f=>`#${f.faceId}`).join(', ')||'none'}). Original texture/UV data on retained panels. This does NOT recover original brush volumes, hidden faces, or collision hulls. Inspect before compiling. Import from MAP Editor → File.`
        :`Prefab saved to ${destination}. Exported: ${prefab.objects.length} validated editable brush(es), ${prefab.wad.filename} with original WAD3 mipmaps and palette. Import from MAP Editor → File.`);
    }catch(error){setObjectExtractError(error instanceof Error?error.message:String(error))}
  };
  const selectedFace=useMemo(()=>selectedFaces.length?bspFaceDiagnostic(surfaceMap,selectedFaces[selectedFaces.length-1]):null,[surfaceMap,selectedFaces]);
  const faceById=useMemo(()=>surfaceMode==='faces'?new Map(map.faces.map((face,index)=>[bspOriginalFaceIndex(face,index),face])):new Map<number,BspFace>(),[map,surfaceMode]);
  const canEditSelectedSurfaces=useMemo(()=>bspCanEditSelectedFaces(extendedMap,selectedFaces),[extendedMap,selectedFaces]);
  const availableSurfaceTextures=useMemo(()=>{
    try{return bspAllowedFaceTextureIndices(extendedMap,selectedFaces)}catch{return []}
  },[extendedMap,selectedFaces]);
  const allSelectedUnlit=selectedFaces.length>0&&selectedFaces.every(id=>{
    const face=map.faces.find((entry,i)=>bspOriginalFaceIndex(entry,i)===id);
    return !!face&&!bspFaceIsLightmapped(face);
  });
  const beginUvGesture=(forcedFaces?:number[])=>{
    const faces=forcedFaces??selectedFaces;
    if(!faces.length)return;
    if(forcedFaces&&faces.join(',')!==selectedFaces.join(','))setSelectedFaces(faces);
    gestureRef.current={base:surfaceHistory.present,faces};previewRef.current=null;setGesturePreview(null);setUvDragging(true);
    setSurfaceError('');
  };
  const updateUvGesture=(handle:UvHandle,dx:number,dy:number,shift:boolean)=>{
    const gesture=gestureRef.current;if(!gesture)return;
    try{
      const delta=bspUvGestureOperation(handle,dx,dy,shift,false);
      const next=bspApplySurfaceOperation(extendedMap,gesture.base,gesture.faces,delta);
      previewRef.current=next;setGesturePreview(next);setSurfaceError('');
    }catch(error){previewRef.current=null;setGesturePreview(null);setSurfaceError(String(error instanceof Error?error.message:error))}
  };
  const finishUvGesture=(commit:boolean)=>{
    const gesture=gestureRef.current;if(!gesture)return;
    const preview=previewRef.current;
    if(commit&&preview&&JSON.stringify(preview)!==JSON.stringify(gesture.base)){
      setSurfaceHistory(old=>({past:[...old.past,gesture.base].slice(-80),present:preview,future:[]}));
      setSurfaceNotice(t('Surface changes staged. Export a BSP copy to save.'));
    }
    gestureRef.current=null;previewRef.current=null;setGesturePreview(null);setUvDragging(false);
  };
  const applyStudioSurface=(op:{texture:number;offsetU:number;offsetV:number;rotation:number;scaleU:number;scaleV:number})=>{
    try{const next=bspApplySurfaceOperation(extendedMap,surfaceHistory.present,selectedFaces,op);
      if(JSON.stringify(next)===JSON.stringify(surfaceHistory.present))return false;
      setSurfaceHistory(old=>({past:[...old.past,old.present].slice(-80),present:next,future:[]}));
      setSurfaceError('');setSurfaceNotice(t('Surface changes staged. Export a BSP copy to save.'));return true;
    }catch(error){setSurfaceError(String(error instanceof Error?error.message:error));setSurfaceNotice('');return false}
  };
  const resetSurfaceForm=()=>{setSurfaceTexture(-1);setSurfaceShiftU(0);setSurfaceShiftV(0);setSurfaceRotate(0);setSurfaceScaleU(1);setSurfaceScaleV(1)};
  const changeSurfaceSelection=(ids:number[])=>{if(gestureRef.current)finishUvGesture(false);setSelectedFaces(ids);resetSurfaceForm();setSurfaceError('')};
  const undoSurfaceEdit=()=>setSurfaceHistory(old=>old.past.length?{past:old.past.slice(0,-1),present:old.past[old.past.length-1],future:[old.present,...old.future].slice(0,80)}:old);
  const redoSurfaceEdit=()=>setSurfaceHistory(old=>old.future.length?{past:[...old.past,old.present].slice(-80),present:old.future[0],future:old.future.slice(1)}:old);
  const applySurfaceEdit=()=>{
    try{
      const next=bspApplySurfaceOperation(extendedMap,surfaceHistory.present,selectedFaces,{
        texture:surfaceTexture,offsetU:surfaceShiftU,offsetV:surfaceShiftV,
        rotation:surfaceRotate,scaleU:surfaceScaleU,scaleV:surfaceScaleV
      });
      if(JSON.stringify(next)===JSON.stringify(surfaceHistory.present)){setSurfaceNotice(t('No surface changes to apply.'));return}
      setSurfaceHistory(old=>({past:[...old.past,old.present].slice(-80),present:next,future:[]}));
      resetSurfaceForm();setSurfaceError('');setSurfaceNotice(t('Surface changes staged. Export a BSP copy to save.'));
    }catch(error){setSurfaceError(t(String(error instanceof Error?error.message:error)));setSurfaceNotice('')}
  };
  const changeSurfaceMode=(next:'entities'|'faces')=>{
    setBrushPaste(null);setBrushPasteHover(null);
    setSurfaceMode(next);changeSurfaceSelection([]);setRegionKind(null);setRegionSelectionError('');setContextMenu(null);setPlacement(null);setPlacementHover(null);
    setConnectionArmed(false);setChosen(null);setExtraSelected([]);
    if(next==='faces')setRightPaneOpen(true);
  };
  const selectSurfaceFace=(index:number,extend:boolean,x?:number,y?:number)=>{
    const additive=extend||multiSelectMode;
    if(facePickMode==='region'){
      const result=bspSelectSurfaceRegion(map,index,BSP_REGION_SELECTION_LIMIT);
      if(result.reason){setRegionSelectionError(result.reason);return}
      const selection=bspToggleRegionSelection(selectedFaces,result.indices,additive);
      if(!selection){setRegionSelectionError(regionLabels.limit);return}
      changeSurfaceSelection(selection);setRegionKind(result.kind);setRegionSelectionError('');
      return;
    }
    if(Number.isFinite(x)&&Number.isFinite(y))document.dispatchEvent(new CustomEvent('svenstudio:bsp-uv-pin',{detail:{x,y}}));
    changeSurfaceSelection(bspToggleFaceSelection(selectedFaces,index,additive));setRegionKind(null);setRegionSelectionError('');
  };
  useEffect(()=>{if(chosen!==null&&chosen>=viewMap.entities.length)setChosen(null)},[chosen,viewMap]);
  const chosenNative=doc&&chosen!==null?doc.entities[chosen]:null;
  const selectedIndices=useMemo(()=>chosen===null?[]:[chosen,...extraSelected.filter(index=>index!==chosen&&index>0&&index<viewMap.entities.length)],[chosen,extraSelected,viewMap]);
  const editableIndices=useMemo(()=>selectedIndices.filter(i=>!!doc&&bspPointEditable(doc.entities[i],i)),[selectedIndices,doc]);
  const brushEligibility=useMemo(()=>doc?bspBrushCopyEligibility(map,doc,selectedIndices):{ok:false,reason:'No BSP loaded.'},[map,doc,selectedIndices]);
  const allEditable=selectedIndices.length>0&&editableIndices.length===selectedIndices.length;
  const groupMoveAllowed=allEditable&&selectedIndices.every(i=>!!viewMap.entities[i]?.origin);
  const selectedCentroid=useMemo(()=>{
    const points=selectedIndices.map(i=>viewMap.entities[i]?.origin).filter((p):p is [number,number,number]=>!!p);
    return points.length?points.reduce<[number,number,number]>((sum,p)=>[sum[0]+p[0],sum[1]+p[1],sum[2]+p[2]],[0,0,0]).map(n=>n/points.length) as [number,number,number]:null;
  },[selectedIndices,viewMap]);
  const connectionAudit=useMemo(()=>bspEntityConnections(viewMap.entities),[viewMap,selectedIndices]);
  const selectedConnections=useMemo(()=>connectionAudit.connections.filter(c=>selectedIndices.includes(c.from)||selectedIndices.includes(c.to)),[connectionAudit,selectedIndices]);
  const fgdSelected=useMemo(()=>effectiveFgdClasses.find(c=>c.name===selection?.classname),[effectiveFgdClasses,selection?.classname]);
  const selectEntity=(index:number,extend=false,clientX?:number,clientY?:number)=>{
    setContextMenu(null);
    if(connectionArmed&&chosen!==null&&index!==chosen){
      if(editMutation(current=>bspConnectEntities(current,chosen,index,connectionKey))){setConnectionArmed(false);setShowConnections(true);setEntityNotice(t('Connection saved in the BSP entity lump. Export a copy.'))}
      return;
    }
    const next=bspToggleSelection({primary:chosen,additional:extraSelected},index,extend||multiSelectMode);
    setChosen(next.primary);setExtraSelected(next.additional);
    if(next.primary!==null&&entityEdit)showBspProperties(clientX,clientY);
  };
  const cancelToolOrSelection=()=>{
    if(brushPaste){setBrushPaste(null);setBrushPasteHover(null);return}
    if(surfaceMode==='faces'){changeSurfaceSelection([]);setContextMenu(null);return}
    setContextMenu(null);
    if(placement){setPlacement(null);setPlacementHover(null)}
    else if(connectionArmed)setConnectionArmed(false);
    else{setChosen(null);setExtraSelected([]);setMultiSelectMode(false)}
  };
  const openEntityContext=(index:number,clientX:number,clientY:number)=>{
    if(!entityEdit||fly||placement)return;
    if(contextStart.current&&Math.hypot(clientX-contextStart.current.x,clientY-contextStart.current.y)>7)return;
    const scene=bspContentRef.current?.querySelector('.bsp-canvas');
    const rect=scene?.getBoundingClientRect();if(!rect)return;
    if(chosen!==index&&!extraSelected.includes(index)){setChosen(index);setExtraSelected([])}
    showBspProperties(clientX,clientY);
    setContextMenu({index,x:Math.max(6,Math.min(clientX-rect.left,rect.width-212)),y:Math.max(6,Math.min(clientY-rect.top,rect.height-232))});
  };
  const deleteEntitySelection=()=>{
    if(!doc||!selectedIndices.length)return;
    if(selectedIndices.some(i=>!bspPointEditable(doc.entities[i],i))){setEntityError(t('Compiled brush entities cannot be deleted in visual mode.'));return}
    if(selectedIndices.length>1&&!window.confirm(t('Delete the selected entities? This can be undone.')))return;
    const descending=[...selectedIndices].sort((a,b)=>b-a);
    if(editMutation(current=>descending.reduce((next,index)=>bspDeletePoint(next,index),current))){setChosen(null);setExtraSelected([]);setContextMenu(null)}
  };
  const duplicateContextEntity=()=>{
    const index=contextMenu?.index??chosen;
    if(index===null||!doc||!bspPointEditable(doc.entities[index],index))return;
    if(editMutation(current=>bspDuplicatePoint(current,index))){setChosen(doc.entities.length);setExtraSelected([])}setContextMenu(null);
  };
  const pointEditable=!!entityEdit&&!!chosenNative&&chosen!==null&&bspPointEditable(chosenNative,chosen);
  const edited=(!!doc&&nativeChanged(doc))||surfaceEdited||lightmapEdited;
  const browserTotals=useMemo(()=>{
    const totals:Record<BspEntityCategory,number>={all:0,npc:0,items:0,weapons:0,triggers:0,logic:0,environment:0,geometry:0,other:0};
    for(const item of viewMap.entities)if(item.classname!=='worldspawn'){
      totals.all++;totals[bspEntityCategory(item.classname)]++;
    }
    return totals;
  },[viewMap]);
  const filtered=useMemo(()=>viewMap.entities.map((entity,index)=>({entity,index})).filter(({entity})=>entity.classname!=='worldspawn'
    &&(browseCategory==='all'||bspEntityCategory(entity.classname)===browseCategory)
    &&bspEntitySearchText(entity).includes(query.trim().toLowerCase())),[viewMap,query,browseCategory]);
  const visibleBrowserItems=filtered.slice(0,browsePage*24);

  const availableClasses=useMemo(()=>effectiveFgdClasses.filter(cls=>cls.type==='point'&&cls.name.toLowerCase().includes(newEntityQuery.trim().toLowerCase())).slice(0,200),[effectiveFgdClasses,newEntityQuery]);
  const editMutation=(fn:(current:NativeBsp)=>NativeBsp):boolean=>{
    if(!entityHistory)return false;
    try{
      const next=fn(entityHistory.present);
      if(next!==entityHistory.present){
        setEntityHistory({past:[...entityHistory.past.slice(-79),entityHistory.present],present:next,future:[]});
        setEntityNotice('');
      }
      setEntityError('');return true;
    }catch(error){setEntityError(t(String(error instanceof Error?error.message:error)));return false}
  };
  const beginBrushPaste=()=>{
    if(!doc||!brushEligibility.ok){setEntityError(brushEligibility.reason);return}
    setBrushPaste({indices:[...selectedIndices],anchor:brushAnchor});setBrushPasteHover(null);
    setSurfaceMode('entities');setPlacement(null);setContextMenu(null);setEntityError('');
    if(fly)document.exitPointerLock?.();setFly(false);
  };
  const pasteBrushAt=(position:BspVec3)=>{
    if(!brushPaste||!doc)return;
    const count=doc.entities.length;
    if(editMutation(current=>bspPasteBrushModelInstances(map,current,brushPaste.indices,position,brushPaste.anchor))){
      setChosen(count);setExtraSelected([]);setBrushPaste(null);setBrushPasteHover(null);
      setEntityNotice(stage7Text.notice);
    }
  };
  const confirmLeave=()=>!edited||window.confirm(t('Unsaved BSP edits (entities, surfaces or lightmaps) will be lost. Continue?'));
  const startEntityEditing=()=>{
    if(!source)return;
    try{
      const document=entityHistory?.present||readNativeBsp(source);
      setEntityHistory(old=>old||{past:[],present:document,future:[]});
      if(fly){documentGlobalExitFly()}
      setRecoveryOpen(false);setEntityEdit(true);setExtraSelected([]);setConnectionArmed(false);setShowEntities(true);setShowLabels(true);setShowModels(true);setEntityError('');setEntityNotice('');onEditingChange?.(true);
    }catch(error){setEntityError(`${t('Cannot start BSP visual editing')}: ${String(error instanceof Error?error.message:error)}`)}
  };
  useEffect(()=>{
    if(editingRequested&&!entityEdit&&source)startEntityEditing();
    if(!editingRequested&&entityEdit){setEntityEdit(false);setPlacement(null);setExtraSelected([]);setConnectionArmed(false)}
  },[editingRequested,source,entityEdit]);
  const documentGlobalExitFly=()=>{document.exitPointerLock?.();setFly(false)};
  const undoEntityEdit=()=>setEntityHistory(old=>old?.past.length?{
    past:old.past.slice(0,-1),present:old.past[old.past.length-1],future:[old.present,...old.future].slice(0,80)}:old);
  const redoEntityEdit=()=>setEntityHistory(old=>old?.future.length?{
    past:[...old.past,old.present].slice(-80),present:old.future[0],future:old.future.slice(1)}:old);
  const exportEntityBsp=()=>{
    if(!doc||!source)return;
    try{
      const entitiesBytes=writeNativeBsp(doc);
      const surfaceStaged=surfaceEdited?writeBspWadSurfaceCopy(entitiesBytes,surfaceOverrides,exportedChoices,importedWadData.map(item=>item.bytes),writeBspSurfaceEdits):entitiesBytes;
      const staged=lightmapEdited?writeBspFaceLightmaps(surfaceStaged,lightmapOverrides):surfaceStaged;
      // Stage 6E: emit only current lump payloads, not superseded append-only lumps.
      const {bytes,report}=compactBspCopy(staged);
      const check=readNativeBsp(bytes);
      const rendered=parseBsp(bytes,map.name);
      if(check.entities.length!==doc.entities.length||rendered.entities.length!==doc.entities.length)throw Error('Exported BSP entity count mismatch.');
      const url=URL.createObjectURL(new Blob([bytes],{type:'application/octet-stream'}));
      const link=document.createElement('a');link.href=url;
      link.download=map.name.replace(/\.bsp$/i,'')+(lightmapEdited?'_lightmaps.bsp':surfaceEdited?'_visual_surfaces.bsp':'_visual_entities.bsp');
      document.body.appendChild(link);link.click();link.remove();
      window.setTimeout(()=>URL.revokeObjectURL(url),15000);
      setEntityError('');setSurfaceError('');setLightmapEditError('');setEntityNotice(`${t('BSP copy exported. Open it again to inspect the result.')} · ${report.afterBytes.toLocaleString()} bytes (${report.recoveredBytes.toLocaleString()} bytes recovered)`);setSurfaceNotice(`${t('BSP copy exported. Open it again to inspect the result.')} · ${report.afterBytes.toLocaleString()} bytes (${report.recoveredBytes.toLocaleString()} bytes recovered)`);
    }catch(error){setEntityError(String(error instanceof Error?error.message:error));setSurfaceError(String(error instanceof Error?error.message:error));setLightmapEditError(String(error instanceof Error?error.message:error))}
  };
  const pointClass=(classname:string)=>effectiveFgdClasses.find(def=>def.type==='point'&&def.name===classname)
    ||(['item_generic','monster_generic','cycler'].includes(classname)?{name:classname,type:'point' as const,description:'Sven Co-op MDL point entity',props:{}}:undefined);
  const startPlacement=(classname:string,model?:string,spec?:BspModelEntitySpec)=>{
    if(!pointClass(classname)){setEntityError(t('Choose a valid point entity from the FGD catalog.'));return}
    if(!entityEdit){setEntityError(t('Open BSP Editor first.'));return}
    setPlacement({classname,model,spec});setPlacementHover(null);setEntityError('');setEntityNotice('');
    if(fly)documentGlobalExitFly();
  };
  const startModelPlacement=(spec:BspModelEntitySpec):boolean=>{
    if(!pointClass(spec.classname)){
      setEntityError(t('This monster class is not available in your loaded FGD. Import Sven Co-op FGD first.'));
      return false;
    }
    startPlacement(spec.classname,spec.modelPath,spec);
    return true;
  };
  const placePointAt=(position:[number,number,number])=>{
    if(!placement||!entityHistory)return;
    const cls=pointClass(placement.classname);
    if(!cls){setEntityError(t('Choose a valid point entity from the FGD catalog.'));return}
    const index=entityHistory.present.entities.length;
    if(editMutation(current=>{
      let next=addNativeEntity(current,cls.name,bspFormatVector(position));
      if(placement.spec){
        // The model behavior preset is canonical and validated by the MDL library.
        for(const [key,value] of Object.entries(placement.spec.properties))next=bspSetPointField(next,index,key,value);
      }else{
        for(const [key,definition] of Object.entries(cls.props)){
          if(['classname','origin','model'].includes(key)||definition.defaultValue===undefined||definition.defaultValue==='')continue;
          if(key==='spawnflags'||['angle','angles','health','renderamt','rendermode','skin','body','targetname'].includes(key))next=addNativeProperty(next,index,key,definition.defaultValue);
        }
        if(placement.model)next=bspSetPointField(next,index,'model',placement.model);
      }
      return next;
    })){
      setChosen(index);setExtraSelected([]);setPlacement(null);setPlacementHover(null);setShowEntities(true);setShowModels(true);showBspProperties();
      setEntityNotice(t('Entity placed. Export a BSP copy to save your changes.'));
    }
  };
  const assignModel=(path:string)=>{
    if(!pointEditable||chosen===null){setEntityError(t('Select an editable point entity before assigning a model.'));return}
    if(editMutation(current=>bspSetPointField(current,chosen,'model',path))){setModelLibraryOpen(false);setShowModels(true)}
  };
  const focusEntity=(index:number)=>{
    if(fly){document.exitPointerLock?.();setFly(false)}
    setChosen(index);setExtraSelected([]);if(entityEdit)showBspProperties();setFocus(old=>({index,serial:(old?.serial||0)+1,position:viewMap.entities[index]?.origin}));
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
  useEffect(()=>{setSurfaceMode('entities');setSelectedFaces([]);setChosen(null);setExtraSelected([]);setContextMenu(null);setConnectionArmed(false);setAssets([]);setFly(false);setQuery('');setFocus(null);setBaked(initialBaked);setShowEntities(true);setShowLabels(true);if(initialBaked)setLightBrightness(1)},[map,initialBaked]);
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
  useEffect(()=>{
    if(!entityEdit)return;
    const keyboard=(event:KeyboardEvent)=>{
      if((event.target as HTMLElement)?.closest('input,textarea,select,[contenteditable=true]'))return;
      if(fly||modelLibraryOpen||recoveryOpen)return; // Do not delete while a dialog or flight control is active.
      const modifier=event.ctrlKey||event.metaKey;
      if(surfaceMode==='faces'){
        if(modifier&&(event.code==='KeyZ'||event.code==='KeyY')){
          event.preventDefault();event.stopImmediatePropagation();
          if(event.code==='KeyY'||event.shiftKey)redoSurfaceEdit();else undoSurfaceEdit();return;
        }
        if(event.code==='Escape'){event.preventDefault();event.stopImmediatePropagation();changeSurfaceSelection([])}
        return;
      }
      if(modifier&&event.code==='KeyZ'){
        event.preventDefault();event.stopImmediatePropagation();if(event.shiftKey)redoEntityEdit();else undoEntityEdit();return;
      }
      if(modifier&&event.code==='KeyY'){
        event.preventDefault();event.stopImmediatePropagation();redoEntityEdit();return;
      }
      if(modifier||event.altKey)return;
      if(event.code==='KeyG'||event.code==='KeyR'){
        event.preventDefault();event.stopImmediatePropagation();setGizmoMode(event.code==='KeyG'?'translate':'rotate');return;
      }
      if(event.code==='Delete'){
        if(!selectedIndices.length)return;
        event.preventDefault();event.stopImmediatePropagation();deleteEntitySelection();return;
      }
      if(event.code==='Escape'){
        event.preventDefault();event.stopImmediatePropagation();cancelToolOrSelection();
      }
    };
    window.addEventListener('keydown',keyboard,true);
    return()=>window.removeEventListener('keydown',keyboard,true);
  },[entityEdit,entityHistory,surfaceHistory,lightmapHistory,selectedFaces,placement,brushPaste,fly,selectedIndices,contextMenu,connectionArmed,modelLibraryOpen,recoveryOpen,surfaceMode]);
  const importWads=async(files:FileList|null)=>{
    if(!files?.length)return;
    setLoadingWads(true);setWadError('');
    try{
      const incoming=Array.from(files);
      const allNames=[...importedWadData.map(item=>item.name.toLowerCase()),...incoming.map(file=>file.name.toLowerCase())];
      if(new Set(allNames).size!==allNames.length)throw Error('This WAD file is already imported. Remove it first to replace it.');
      if(incoming.length+importedWadData.length>8||incoming.some(f=>f.size>64*1024*1024)||incoming.reduce((sum,f)=>sum+f.size,importedWadData.reduce((sum,f)=>sum+f.bytes.byteLength,0))>128*1024*1024)throw Error('Import up to 8 WAD3 files (64 MiB each; 128 MiB total).');
      const results=await Promise.all(incoming.map(async f=>({name:f.name,bytes:new Uint8Array(await f.arrayBuffer()),assets:await parseWad(f,{remember:false})})));
      setImportedWadData(prev=>[...prev,...results.map(({name,bytes})=>({name,bytes}))]);
      setImportedWadAssets(prev=>[...prev,...results.flatMap(result=>result.assets)]);
      setAssets(prev=>[...prev,...results.flatMap(result=>result.assets)]);
    }
    catch(err){setWadError(String(err))}finally{setLoadingWads(false)}
  };
  const entityPropertyPanel=<>
        {selection&&<div className="bsp-entity-properties"><h4>{selection.classname} <small>#{chosen}</small></h4>
          {entityEdit&&chosenNative?<>
            {!pointEditable&&<p className="bsp-note"><AlertTriangle size={13}/>{t('Compiled brush entity: geometry and transforms are locked. Use native BSP Recovery for permitted keyvalues.')}</p>}
            {pointEditable&&<div className="bsp-visual-edit-actions">
              <button onClick={()=>{if(chosen!==null&&editMutation(current=>bspDuplicatePoint(current,chosen)))setChosen(doc!.entities.length)}}><Copy size={13}/>{t('Duplicate')}</button>
              <button className="danger" onClick={()=>{if(chosen===null||!confirm(t('Remove this point entity from the exported BSP?')))return;if(editMutation(current=>bspDeletePoint(current,chosen))){setChosen(null);setExtraSelected([])}}}><Trash2 size={13}/>{t('Delete')}</button>
            </div>}
            {pointEditable&&<div className="bsp-workflow-card">
              <strong><Network size={14}/>{t('Entity connections')}</strong>
              <label>{t('Connection property')}<select value={connectionKey} onChange={e=>setConnectionKey(e.target.value as BspConnection['key'])}>
                <option value="target">target</option><option value="killtarget">killtarget</option><option value="trigger_target">trigger_target</option>
              </select></label>
              <button className={connectionArmed?'bsp-on':''} onClick={()=>{setConnectionArmed(v=>!v);setShowConnections(true)}}><Link2 size={14}/>{connectionArmed?t('Cancel connection'):t('Choose destination in 3D')}</button>
              <small>{t('Destination receives a unique targetname if it has none. Existing targetnames are preserved.')}</small>
              {selectedConnections.slice(0,16).map((c,i)=><button key={`${c.from}:${c.to}:${c.key}:${i}`} className="bsp-connection-link" title={c.name} onClick={()=>focusEntity(c.to)}>{c.key}: #{c.from} → #{c.to} · {c.name}</button>)}
              {connectionAudit.unresolved.slice(0,8).map((c,i)=><small key={`${c.from}:${c.key}:${i}`} className="bsp-unresolved">{t('Unresolved target')}: #{c.from} · {c.key} = {c.name}</small>)}
            </div>}
            <small className="bsp-fgd-section-label">{t('FGD options and spawnflags')}</small>
            <div className="bsp-fgd-tabs" role="tablist" aria-label={t('FGD property editor')}>
              {(['attributes','flags','raw'] as const).map(tab=><button type="button" role="tab" aria-selected={propertiesTab===tab} key={tab} className={propertiesTab===tab?'active':''} onClick={()=>setPropertiesTab(tab)}>{t(tab==='attributes'?'Attributes':tab==='flags'?'Flags':'Raw edit')}</button>)}
            </div>
            {propertiesTab==='attributes'&&<div className="bsp-fgd-tab-content">
              {!fgdSelected&&<small>{t('No class definition found in the loaded FGDs. Use Raw edit to edit keyvalues.')}</small>}
              {fgdSelected&&Object.entries(fgdSelected.props).filter(([,prop])=>prop.type!=='flags').map(([key,prop])=>{
                const value=selection.properties[key]??prop.defaultValue??'';
                return <div className="bsp-fgd-attribute" key={key}>
                  <label title={key}><strong>{prop.label||key}</strong><small>{key}</small></label>
                  {prop.type==='choices'&&prop.options?.length?<select disabled={!pointEditable} value={value} onChange={e=>{if(chosen!==null)editMutation(d=>bspSetPointField(d,chosen,key,e.target.value))}}>
                    {!prop.options.some(o=>o.value===value)&&<option value={value}>{value||t('Custom value')}</option>}
                    {prop.options.map(opt=><option key={opt.value} value={opt.value}>{opt.label} ({opt.value})</option>)}
                  </select>:<BspValueInput key={`${chosen}:${key}:${selection.classname}`} value={value} label={prop.label||key} disabled={!pointEditable} onCommit={v=>{if(chosen!==null)editMutation(d=>bspSetPointField(d,chosen,key,v))}}/>}
                </div>;
              })}
              {!fgdSelected||!Object.keys(fgdSelected.props).length?<small>{t('Use Raw edit for properties not defined in the FGD.')}</small>:null}
            </div>}
            {propertiesTab==='flags'&&<div className="bsp-fgd-tab-content">
              {fgdSelected&&Object.entries(fgdSelected.props).filter(([,prop])=>prop.type==='flags').map(([key,prop])=>{
                const current=selection.properties[key]??prop.defaultValue??'0';
                return <div key={key} className="bsp-fgd-flags"><strong>{prop.label||key} <small>({key})</small></strong>
                  {(prop.options||[]).map(option=>{
                    const bit=Number(option.value),valid=Number.isInteger(bit)&&bit>0&&bit<=0x80000000&&(bit&(bit-1))===0;
                    return <label key={option.value}><input type="checkbox" disabled={!valid||!pointEditable} checked={valid&&(Number(current)&bit)!==0} onChange={e=>{if(chosen!==null)try{const next=bspFlagValue(current,bit,e.target.checked);editMutation(d=>bspSetPointField(d,chosen,key,next))}catch(err){setEntityError(String(err))}}}/>{option.label} ({option.value})</label>;
                  })}
                  <small>{t('Unknown flag bits are preserved.')}</small>
                </div>;
              })}
              <label>{t('Spawnflags (decimal)')}<BspValueInput key={`${chosen}:spawnflags`} value={selection.properties.spawnflags||'0'} label="spawnflags" disabled={!pointEditable} onCommit={value=>{if(chosen!==null)editMutation(d=>bspSetPointField(d,chosen,'spawnflags',value))}}/></label>
            </div>}
            {propertiesTab==='raw'&&<div className="bsp-fgd-tab-content">
            {chosenNative.pairs.map((pair,pairIndex)=><div className="bsp-visual-property" key={`${chosen}:${pairIndex}`}>
              <label title={effectiveFgdClasses.find(cls=>cls.name===selection.classname)?.props[pair.key]?.label||pair.key}>{pair.key}</label>
              <BspValueInput key={`${chosen}:${pairIndex}`} value={pair.value} label={`${pair.key} value`} disabled={!pointEditable||pair.key==='classname'} onCommit={value=>{
                if(chosen===null)return;
                editMutation(current=>bspSetPointField(current,chosen,pair.key,value,pairIndex));
              }}/>
              <button disabled={!pointEditable||pair.key==='classname'} title={t('Delete keyvalue')} onClick={()=>{if(chosen!==null)editMutation(current=>removeNativeProperty(current,chosen,pairIndex))}}><Trash2 size={12}/></button>
            </div>)}
            {pointEditable&&<form className="bsp-visual-new-key" onSubmit={e=>{e.preventDefault();if(chosen!==null&&editMutation(current=>addNativeProperty(current,chosen,newKey.trim(),newValue))){setNewKey('');setNewValue('')}}}>
              <input aria-label={t('Key')} placeholder={t('Key')} value={newKey} onChange={e=>setNewKey(e.target.value)}/>
              <input aria-label={t('Value')} placeholder={t('Value')} value={newValue} onChange={e=>setNewValue(e.target.value)}/>
              <button type="submit" disabled={!newKey.trim()}><Plus size={13}/></button>
            </form>}
            </div>}
          </>:Object.entries(selection.properties).map(([k,v])=><div key={k}><b>{k}</b><span>{v}</span></div>)}
        </div>}
  </>;
  return <div className="bsp-viewer">
    {recoveryOpen&&source&&<BspRecoveryStudio key={map.name} source={source} filename={map.name} map={map} knownTextures={allAssets} onClose={()=>setRecoveryOpen(false)} onOpenMap={onOpenRecoveredMap}/> }
    {modelLibraryOpen&&<BspModelLibrary
      canAssign={pointEditable} canConvert={pointEditable&&extraSelected.length===0&&!!chosenNative&&bspCanConvertModelEntity(nativeClassname(chosenNative))}
      npcClasses={effectiveFgdClasses.filter(cls=>cls.type==='point'&&cls.name.startsWith('monster_')).map(cls=>({name:cls.name,description:cls.description}))}
      gameDir={gameDir} localModels={localModels} onImportLocal={next=>setLocalModels(prev=>new Map([...prev,...next]))}
      onClose={()=>setModelLibraryOpen(false)} onAssign={assignModel}
      onPlace={spec=>{if(startModelPlacement(spec))setModelLibraryOpen(false)}}
      onConvert={spec=>{if(chosen!==null&&editMutation(current=>bspConvertModelEntity(current,chosen,spec))){setModelLibraryOpen(false);setShowEntities(true);setShowModels(true);setEntityNotice(t('Model behavior updated. Export a BSP copy to save.'))}}}/>}
    <div className="bsp-toolbar bsp-toolbar-compact bsp-toolbar-split">
      <div className="bsp-toolbar-start">
        <button onClick={()=>{if(confirmLeave())onBack()}} title={t('MAP Editor')} aria-label={t('MAP Editor')}><ArrowLeft size={15}/></button>
        <strong><Box size={15}/>{t(entityEdit?'BSP Editor':'BSP Viewer')}</strong>
        <span className="bsp-file-name" title={map.name}>{map.name}</span>
        <button onClick={()=>{if(confirmLeave())onOpen()}}><FileUp size={15}/>{t('Open BSP')}</button>
        <button onClick={()=>{if(confirmLeave())onCompiled()}} title={t('Open compiled BSP')}>{t('Compiled BSP')}</button>
      </div>
      <div className="bsp-toolbar-end">
        {entityEdit&&<div className="bsp-surface-mode-switch" role="group" aria-label={t('BSP selection mode')}>
          <button type="button" className={surfaceMode==='entities'?'bsp-on':''} aria-pressed={surfaceMode==='entities'} onClick={()=>changeSurfaceMode('entities')}><Users size={14}/>{t('Entities')}</button>
          <button type="button" className={surfaceMode==='faces'&&facePickMode==='face'?'bsp-on':''} aria-pressed={surfaceMode==='faces'&&facePickMode==='face'} onClick={()=>{setFacePickMode('face');changeSurfaceMode('faces')}}><Grid3x3 size={14}/>{t('Faces')}</button>
          <button type="button" className={surfaceMode==='faces'&&facePickMode==='region'?'bsp-on':''} aria-pressed={surfaceMode==='faces'&&facePickMode==='region'} title={regionLabels.note} onClick={()=>{setFacePickMode('region');changeSurfaceMode('faces')}}><Layers size={14}/>{regionLabels.title}</button>
        </div>}
        {entityEdit&&<>
          <button className={fly?'bsp-on bsp-fly-button bsp-fly-priority':'bsp-fly-button bsp-fly-priority'} onClick={()=>{
          if(fly){document.exitPointerLock?.();setFly(false)}
          else {const canvas=flyRef.current;if(canvas?.requestPointerLock){
            setFlyError('');canvas.requestPointerLock().then(()=>setFly(true)).catch(()=>{setFly(false);setFlyError(t('Pointer lock blocked. Click the viewer and try again.'))});
          }}
        }}><Move3D size={15}/>{fly?t('Exit fly'):t('Fly WASD')}</button>
          {surfaceMode==='entities'&&<><button className="bsp-quick-access" title={t('Search entities...')} onClick={()=>jumpToInspector('search')}><Focus size={14}/>{t('Search entities')}</button>
          <button className="bsp-quick-access" title={t('Place point entity')} onClick={()=>jumpToInspector('create')}><Plus size={14}/>{t('Place entity')}</button>
          <button className="bsp-quick-access" title={t('Model library')} onClick={()=>setModelLibraryOpen(true)}><LibraryBig size={14}/>{t('Models')}</button>
          </>}
          <button className={multiSelectMode?'bsp-on bsp-quick-access':'bsp-quick-access'} aria-pressed={multiSelectMode} title={t('Ctrl+click to add or remove')} onClick={()=>setMultiSelectMode(v=>!v)}><CheckSquare size={14}/>{t('Multi-select')}</button>
        </>}
        {!entityEdit&&<button className={fly?'bsp-on bsp-fly-button':'bsp-fly-button'} onClick={()=>{
          if(fly){document.exitPointerLock?.();setFly(false)}
          else {const canvas=flyRef.current;if(canvas?.requestPointerLock){
            setFlyError('');canvas.requestPointerLock().then(()=>setFly(true)).catch(()=>{setFly(false);setFlyError(t('Pointer lock blocked. Click the viewer and try again.'))});
          }}
        }}><Move3D size={15}/>{fly?t('Exit fly'):t('Fly WASD')}</button>}
        <button type="button" title={t('Tools')} aria-label={t('Tools')} aria-expanded={leftPaneOpen} onClick={()=>setLeftPaneOpen(v=>!v)}>{leftPaneOpen?<PanelLeftClose size={16}/>:<PanelLeftOpen size={16}/>}</button>
        {entityEdit&&<button className="bsp-export-button" disabled={!edited} onClick={exportEntityBsp}><Save size={15}/>{t('Export BSP copy')}</button>}

        <button title={t('BSP Recovery')} disabled={!source||entityEdit} onClick={()=>{if(!source)return;try{readNativeBsp(source);if(fly)documentGlobalExitFly();setRecoveryOpen(true)}catch(e){window.alert(`${t('BSP Recovery cannot edit this map safely')}: ${String(e)}`)}}}><ShieldCheck size={15}/></button>
        <button type="button" title={t('Entity inspector')} aria-label={t('Entity inspector')} aria-expanded={rightPaneOpen} onClick={()=>setRightPaneOpen(v=>!v)}>{rightPaneOpen?<PanelRightClose size={16}/>:<PanelRightOpen size={16}/>}</button>
      </div>
    </div>
    <div className="bsp-content bsp-content-docked" ref={bspContentRef}>
      {leftPaneOpen&&<>
        <aside className="bsp-tool-rail" style={{width:leftPaneWidth,flexBasis:leftPaneWidth}} aria-label={t('Tools')}>
          <section className="bsp-tool-section">
            <h3><Move3D size={15}/>{t('Tools')}</h3>
            {entityEdit&&surfaceMode==='entities'&&<>
              <div className="bsp-rail-actions bsp-rail-grid">
                <button className={gizmoMode==='translate'?'bsp-on':''} onClick={()=>setGizmoMode('translate')}><Move3D size={14}/>{t('Move')} · G</button>
                <button className={gizmoMode==='rotate'?'bsp-on':''} onClick={()=>setGizmoMode('rotate')}><RotateCcw size={14}/>{t('Rotate')} · R</button>
                <button disabled={!entityHistory?.past.length} onClick={undoEntityEdit}><Undo2 size={14}/>{t('Undo')}</button>
                <button disabled={!entityHistory?.future.length} onClick={redoEntityEdit}><Redo2 size={14}/>{t('Redo')}</button>
                <button className={multiSelectMode?'bsp-on':''} aria-pressed={multiSelectMode} onClick={()=>setMultiSelectMode(v=>!v)}><CheckSquare size={14}/>{t('Multi-select')}</button>
                <button className={connectionArmed?'bsp-on':''} disabled={!pointEditable} onClick={()=>{setConnectionArmed(v=>!v);setShowConnections(true)}}><Link2 size={14}/>{t('Connect entities')}</button>
                <button role="checkbox" aria-checked={showConnections} onClick={()=>setShowConnections(v=>!v)}><Network size={14}/>{t('Connection lines')}: {showConnections?'✓':'—'}</button>
              </div>
              <button className="bsp-rail-wide bsp-library-button" onClick={()=>setModelLibraryOpen(true)}><LibraryBig size={14}/>{t('Model library')}</button>
            </>}
          </section>
          <section className="bsp-tool-section">
            <h3><Layers size={15}/>{t('View options')}</h3>
            <div className="bsp-toolbar-popover bsp-rail-actions">
              {([['Lightmaps',lightmaps,()=>{setLightmaps(v=>!v);setBaked(false)}],['Baked RGB',baked,()=>{setBaked(v=>!v);setLightmaps(true);setLightBrightness(1)}],['Wireframe',wireframe,()=>setWireframe(v=>!v)],['Real skybox',showSky,()=>setShowSky(v=>!v)],['MDL models',showModels,()=>setShowModels(v=>!v)],['Entities',showEntities,()=>setShowEntities(v=>!v)],['Entity labels',showLabels,()=>setShowLabels(v=>!v)]] as const).map(([label,active,toggle])=><button key={label} role="checkbox" aria-checked={active} onClick={toggle}><span className={active?'bsp-setting-check active':'bsp-setting-check'}>{active?'✓':''}</span>{t(label)}</button>)}
            </div>
          </section>
          <section className="bsp-tool-section">
            <h3><Focus size={15}/>{t('Camera')}</h3>
            <div className="bsp-rail-actions bsp-rail-grid">
              <button onClick={()=>{setCameraView('interior');setReset(v=>v+1)}}><Focus size={14}/>{t('Interior')}</button>
              <button onClick={()=>{setCameraView('overview');setReset(v=>v+1)}}><Box size={14}/>{t('Exterior')}</button>
              <button onClick={()=>setReset(v=>v+1)}><RotateCcw size={14}/>{t('Reset camera')}</button>
              <button onClick={()=>setNavSettings(v=>!v)}><Settings2 size={14}/>{t('Fly settings')}</button>
            </div>
          </section>
          <small className="bsp-rail-tip">{t('Drag panel divider to resize')}</small>
        </aside>
        <div className="bsp-panel-splitter" role="separator" aria-orientation="vertical" aria-label={t('Resize tools panel')} tabIndex={0} aria-valuemin={165} aria-valuemax={470} aria-valuenow={leftPaneWidth}
          onPointerDown={event=>startPaneResize('left',event)} onPointerMove={movePaneResize} onPointerUp={finishPaneResize} onPointerCancel={finishPaneResize} onKeyDown={event=>paneKeyResize('left',event)}><span/></div>
      </>}
      <div className={placement||brushPaste?"bsp-canvas bsp-canvas-placing":"bsp-canvas"}
        onPointerDownCapture={event=>{if(event.button===2)contextStart.current={x:event.clientX,y:event.clientY}}}
        onContextMenu={event=>event.preventDefault()}><Canvas onPointerMissed={event=>{if(event.button===0&&!fly)cancelToolOrSelection()}} camera={{position:[480,350,550],fov:65,near:.25,far:200000}} gl={{antialias:true,powerPreference:'high-performance'}} dpr={[1,1.4]}>
        <color attach="background" args={[map.skyname?'#57748f':'#18263a']}/>
        {effectiveFog&&!baked&&<fog attach="fog" args={[effectiveFog.hex,effectiveFog.start,effectiveFog.end]}/>}
        {showSky&&<BspSkyBackground map={map} gameDir={gameDir} onStatus={setSkyStatus}/>}
        {showModels&&surfaceMode==='entities'&&<BspStaticModels map={viewMap} gameDir={gameDir} onStatus={setModelStatus} onReport={setModelReport} studioByClass={studioByClass} selected={chosen} extraSelected={extraSelected} distance={entityDistance} groundModels={groundModelPreviews} extraModels={localModels} onSelect={entityEdit&&!placement?selectEntity:undefined} onContextEntity={entityEdit?openEntityContext:undefined}/>} 
        {!baked&&<><ambientLight intensity={lightmaps?ambientFill:1.7}/><hemisphereLight args={['#dae4ef','#737e93',lightmaps?.12:1.1]}/></>}
        <BspSurface map={renderSurfaceMap} overrides={gesturePreview??surfaceOverrides} assets={allAssets} lightmaps={lightmaps} wireframe={wireframe} brightness={lightBrightness} preview={rendererPreview} baked={baked} styleFrame={styleFrame} fog={effectiveFog} displayGamma={displayGamma} lightFilter={lightFilter} onPlace={brushPaste&&!fly?pasteBrushAt:placement&&!fly?placePointAt:undefined} onHover={brushPaste&&!fly?setBrushPasteHover:placement&&!fly?setPlacementHover:undefined} onEmptyClick={entityEdit&&!fly?cancelToolOrSelection:undefined} onFaceClick={entityEdit&&!fly&&surfaceMode==='faces'?selectSurfaceFace:undefined} onAltUvStart={entityEdit&&!fly&&surfaceMode==='faces'&&bspStudioOpen?(id)=>beginUvGesture(selectedFaces.includes(id)?undefined:[id]):undefined} onAltUvMove={(dx,dy)=>updateUvGesture('move',dx,dy,false)} onAltUvEnd={finishUvGesture}/>
        {surfaceMode==='faces'&&selectedFaces.map(id=>{const face=faceById.get(id);return face?<BspFaceHighlight key={id} face={face}/>:null})}
        {surfaceMode==='entities'&&showConnections&&entityEdit&&!placement&&<BspConnectionLines map={viewMap} edges={selectedConnections}/>}
        {surfaceMode==='entities'&&showEntities&&!placement&&<BspEntities map={viewMap} onSelect={selectEntity} onContextEntity={entityEdit?openEntityContext:undefined} selected={chosen} extraSelected={extraSelected} labels={showLabels} smartLabels={smartLabels} labelLimit={labelLimit} labelDistance={labelDistance} entityDistance={entityDistance}/>}
        {surfaceMode==='entities'&&entityEdit&&!placement&&!fly&&showEntities&&groupMoveAllowed&&chosen!==null&&selectedCentroid&&chosenNative&&
          <BspPointGizmo key={`${selectedIndices.join(',')}:${gizmoMode}:${selectedIndices.map(i=>viewMap.entities[i]?.properties.origin).join('|')}:${bspPointYaw(chosenNative)}`}
            position={selectedIndices.length>1?selectedCentroid:(selection?.origin||selectedCentroid)} yaw={selectedIndices.length>1?0:bspPointYaw(chosenNative)} mode={selectedIndices.length>1?'translate':gizmoMode} onCommit={next=>{
              if(chosen===null)return;
              if(next.position){
                if(selectedIndices.length>1)editMutation(current=>bspTranslatePoints(current,selectedIndices,[next.position![0]-selectedCentroid[0],next.position![1]-selectedCentroid[1],next.position![2]-selectedCentroid[2]]));
                else editMutation(current=>bspMovePoint(current,chosen,next.position!));
              }else if(next.yaw!==undefined&&selectedIndices.length===1)editMutation(current=>bspRotatePointYaw(current,chosen,next.yaw!));
            }}/>}
        {entityEdit&&doc&&surfaceMode==='entities'&&<BspPastedBrushInstances map={surfaceMap} doc={doc} assets={allAssets}/>}
        {brushPaste&&brushPasteHover&&doc&&<BspBrushPastePreview map={map} doc={doc} indices={brushPaste.indices} destination={brushPasteHover} anchor={brushPaste.anchor}/>}
        {placement&&placementHover&&<mesh position={gameToThree(placementHover).toArray()} raycast={()=>null}><sphereGeometry args={[9,10,8]}/><meshBasicMaterial color="#51dcb8" transparent opacity={.75} depthTest={false}/></mesh>}
        <BspNavigation map={map} fly={fly} uvDragging={uvDragging} reset={reset} flyRef={flyRef} speed={speed} sensitivity={sensitivity} smooth={smooth} focus={focus} view={cameraView}/>
      </Canvas>
        <BspTextureUVWidget visible={entityEdit&&surfaceMode==='faces'&&bspStudioOpen&&!fly&&selectedFaces.length>0} lit={false} locale={useEditor.getState().locale} onBegin={()=>beginUvGesture()} onMove={updateUvGesture} onFinish={finishUvGesture}/>
        {contextMenu&&entityEdit&&surfaceMode==='entities'&&!fly&&<div className="bsp-entity-context" role="menu" style={{left:contextMenu.x,top:contextMenu.y}} onPointerDown={e=>e.stopPropagation()} onContextMenu={e=>e.preventDefault()}>
          <strong>{viewMap.entities[contextMenu.index]?.classname||t('Entity')} #{contextMenu.index}</strong>
          <button role="menuitem" onClick={()=>{setChosen(contextMenu.index);setExtraSelected([]);showBspProperties();setPropertiesTab('attributes');setContextMenu(null)}}>{t('Properties')}</button>
          <button role="menuitem" onClick={()=>{focusEntity(contextMenu.index);setContextMenu(null)}}>{t('Focus selected entity')}</button>
          <button role="menuitem" disabled={!doc||!bspPointEditable(doc.entities[contextMenu.index],contextMenu.index)} onClick={duplicateContextEntity}>{t('Duplicate')}</button>
          <button role="menuitem" disabled={!doc||!bspPointEditable(doc.entities[contextMenu.index],contextMenu.index)} onClick={()=>{setChosen(contextMenu.index);setConnectionArmed(true);setShowConnections(true);setContextMenu(null)}}>{t('Connect entities')}</button>
          <button role="menuitem" className="danger" disabled={!doc||selectedIndices.some(i=>!bspPointEditable(doc.entities[i],i))} onClick={deleteEntitySelection}>{t('Delete')} · Supr</button>
        </div>}
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
        {placement&&<div className="bsp-placement-banner"><MousePointer2 size={17}/><strong>{t('Click a surface to place')}: {placement.classname}</strong><span>{placement.model||''}</span><button onClick={()=>{setPlacement(null);setPlacementHover(null)}}><X size={14}/>{t('Cancel')} · Esc</button></div>}
        {entityEdit&&surfaceMode==='faces'&&!fly&&<div className="bsp-viewport-help bsp-viewport-help-extra">{facePickMode==='region'?regionLabels.note:t('Click a BSP surface to inspect its face · Ctrl/Shift+click to multi-select · Esc clears selection')}</div>}
        {flyError&&<div className="bsp-fly-error">{flyError}</div>}
        <div className="bsp-viewport-help">{fly?t('WASD move · Mouse look · Shift fast · Ctrl slow · Q/E down/up · Esc exit'):t('Left mouse orbit · Right mouse pan · Wheel zoom · Fly for WASD')}</div>
        {entityEdit&&surfaceMode==='entities'&&!fly&&<div className="bsp-viewport-help bsp-viewport-help-extra">{t('Right-click an entity for actions · Click empty space to clear selection · Del deletes selected point entities')}</div>}
      </div>
      <input ref={wadInput} hidden multiple type="file" accept=".wad" onChange={e=>{void importWads(e.target.files);e.target.value=''}}/>
      {entityEdit&&surfaceMode==='faces'&&<BspLightmapStudio locale={useEditor.getState().locale} map={map} visible={lightmapStudioOpen} selected={selectedFaces} edited={Object.keys(lightmapOverrides).length} canUndo={lightmapHistory.past.length>0} canRedo={lightmapHistory.future.length>0} onClose={()=>setLightmapStudioOpen(false)} onApply={applyLightmapEdit} onUndo={undoLightmapEdit} onRedo={redoLightmapEdit} error={lightmapEditError}/>}
      {entityEdit&&surfaceMode==='faces'&&<BspTextureStudio visible={bspStudioOpen} locale={useEditor.getState().locale} map={surfaceMap} assets={allAssets} selectedFaces={selectedFaces} textureIndex={surfaceTexture} setTextureIndex={setSurfaceTexture} onApply={applyStudioSurface} onClear={()=>changeSurfaceSelection([])} onUndo={undoSurfaceEdit} onRedo={redoSurfaceEdit} canUndo={surfaceHistory.past.length>0} canRedo={surfaceHistory.future.length>0} onImportWad={()=>wadInput.current?.click()} importedWads={importedWadData.map(item=>item.name)} onRemoveImportedWad={removeUnusedImportedWad} importing={loadingWads} notice={surfaceNotice} error={surfaceError||wadError} onGestureBegin={()=>beginUvGesture()} onGestureUpdate={updateUvGesture} onGestureFinish={finishUvGesture}/>}
      {rightPaneOpen&&<>
      <div className="bsp-panel-splitter" role="separator" aria-orientation="vertical" aria-label={t('Resize inspector panel')} tabIndex={0} aria-valuemin={220} aria-valuemax={480} aria-valuenow={rightPaneWidth}
        onPointerDown={event=>startPaneResize('right',event)} onPointerMove={movePaneResize} onPointerUp={finishPaneResize} onPointerCancel={finishPaneResize} onKeyDown={event=>paneKeyResize('right',event)}><span/></div>
      <aside className={entityEdit?'bsp-info bsp-info-edit bsp-info-docked':'bsp-info bsp-info-docked'} style={{width:rightPaneWidth,flexBasis:rightPaneWidth}}>
        <h3><Info size={16}/>{t(entityEdit?(surfaceMode==='faces'?'BSP face inspector':'BSP entity editor'):'Compiled map')}</h3>
        {entityEdit&&surfaceMode==='entities'&&<div className="bsp-fgd-import">
          <input ref={fgdFileInput} type="file" multiple accept=".fgd" hidden onChange={event=>{void importExtraFgd(event.target.files);event.currentTarget.value=''}}/>
          <button onClick={()=>fgdFileInput.current?.click()}><FileUp size={14}/>{t('Import additional FGD')}</button>
          <small>{effectiveFgdClasses.length} {t('FGD classes')} · {extraFgdFiles.length} {t('additional files')}</small>
          {extraFgdFiles.length>0&&<button onClick={()=>{setExtraFgdFiles([]);setFgdImportError('')}}>{t('Clear additional FGD')}</button>}
          {fgdImportError&&<small role="alert">{fgdImportError}</small>}
          <small>{t('Additional FGDs affect this editor session only. They describe entity properties; they do not install NPC AI.')}</small>
        </div>}
        <p className="bsp-note">{t(entityEdit?(surfaceMode==='faces'?'BSP surface edits are validated before export; unsupported operations are rejected.':'Live entity preview. Only point-entity keyvalues are changed; original BSP and compiled geometry are preserved.'):'Read-only preview. Does not change the editable .MAP or .svenstudio.json project.')}</p>
        {entityEdit&&surfaceMode==='entities'&&<div className="bsp-visual-edit-head">
          <strong><PenTool size={14}/>{t('Point entities and NPCs')}</strong>
          {!gameDir.trim()&&<div className="bsp-warning">{t('Set the Sven Co-op game folder in Build Configuration to preview MDL models.')}</div>}
          <small>{t('G: move · R: yaw rotation · Ctrl+Z/Y: undo/redo. Export a new BSP copy to save.')}</small>
          <div className="bsp-visual-edit-actions">
            <button disabled={!edited} onClick={exportEntityBsp}><Save size={13}/>{t('Export BSP copy')}</button>
            <button disabled={!edited} onClick={()=>{if(!confirm(t('Discard all unsaved BSP entity edits?')))return;setEntityHistory({past:[],present:readNativeBsp(source!),future:[]});setChosen(null);setEntityError('');setEntityNotice('')}}><RotateCcw size={13}/>{t('Revert')}</button>
          </div>
          <div className="bsp-brush-paste-toolbar">
            <strong><Copy size={13}/> {stage7Text.brush}</strong>
            <small>{stage7Text.desc}</small>
            <label>{stage7Text.anchor} <select value={brushAnchor} onChange={e=>setBrushAnchor(e.target.value as BspBrushAnchor)}><option value="bottom">{stage7Text.bottom}</option><option value="center">{stage7Text.center}</option></select></label>
            <button disabled={!brushEligibility.ok} title={brushEligibility.reason} onClick={beginBrushPaste}><Copy size={13}/> {stage7Text.copy} ({selectedIndices.length})</button>
            {brushPaste?<><small>{stage7Text.place}</small><button onClick={()=>{setBrushPaste(null);setBrushPasteHover(null)}}>{stage7Text.cancel}</button></>:null}
            {!brushEligibility.ok&&selectedIndices.length>0?<small className="bsp-warning">{brushEligibility.reason}</small>:null}
          </div>
          <small>{t('Light entities keep their original baked lighting. Brush-model (*n) geometry and transforms are locked.')}</small>
          {entityError&&<div className="bsp-warning" role="alert">{entityError}</div>}
          {entityNotice&&<div className="bsp-edit-notice" role="status">{entityNotice}</div>}
        </div>}
        {entityEdit&&surfaceMode==='faces'&&<button type="button" className="bsp-import" onClick={()=>setBspStudioOpen(v=>!v)}>{bspStudioOpen?t('Hide Texture Studio'):t('Open Texture Studio')}</button>}
        {entityEdit&&surfaceMode==='faces'&&<button type="button" className="bsp-import" onClick={()=>setLightmapStudioOpen(v=>!v)}><Sun size={14}/>{lightmapStudioOpen?stage7Text.hideLight:stage7Text.openLight}</button>}
        {entityEdit&&surfaceMode==='faces'&&lightmapEdited&&<small className="bsp-edit-notice">{Object.keys(lightmapOverrides).length} {stage7Text.edited}.</small>}
        {entityEdit&&surfaceMode==='faces'&&<section className="bsp-face-inspector" aria-label={t('BSP face inspector')}>
          <strong><Grid3x3 size={16}/>{t('Compiled BSP surfaces')}</strong>
          <small>{t('Select a visible surface in the viewport. Original BSP face IDs are preserved across triangle batches.')}</small>
          {facePickMode==='region'&&<div className="bsp-region-explanation"><strong>{regionKind==='submodel'?regionLabels.typeModel:regionKind==='material-island'?regionLabels.typeIsland:regionLabels.details}</strong><small>{regionLabels.warning}</small>{regionSelectionError&&<small role="alert" className="bsp-warning">{regionSelectionError}</small>}</div>}
          <div className="bsp-face-selection-count">{selectedFaces.length} {t('faces selected')} / {map.stats.faces}</div>
          <div className="bsp-object-extractor">
            <strong><Package size={15}/> BSP Object Extractor · 8A HF5</strong>
            <small>{({es:'Seleccioná todas las caras de uno o varios sólidos convexos cerrados (Ctrl/Mayús + clic). Conserva texturas WAD3 originales y UV; rechaza selecciones incompletas. Las regiones del BSP no son brushes originales.',en:'Select every side of one or more closed convex solids (Ctrl/Shift + click). Preserves original WAD3 textures and UV; rejects incomplete selections. BSP regions are not original brushes.',ru:'Выберите все стороны замкнутых выпуклых объектов. Сохраняет WAD3 и UV; неполные выборки отклоняются.',ko:'닫힌 볼록 오브젝트의 모든 면을 선택하세요. WAD3 및 UV 보존. 불완전한 선택은 거부합니다.',zh:'选择封闭凸体的所有面。保留 WAD3 和 UV，拒绝不完整的选择。',pt:'Selecione todas as faces de sólidos convexos fechados. Preserva WAD3 e UV; rejeita seleções incompletas.'} as Record<string,string>)[useEditor.getState().locale]||'Select all sides of closed convex solids.'}</small>
            <button type="button" disabled={!source||selectedFaces.length<4} onClick={()=>void extractSelectedObject('exact')}><Package size={14}/>{({es:'Extraer sólidos completos a .svprefab',en:'Extract complete solids to .svprefab',ru:'Экспорт замкнутых объектов в .svprefab',ko:'완전한 솔리드 .svprefab 추출',zh:'导出完整实体 .svprefab',pt:'Extrair sólidos completos para .svprefab'} as Record<string,string>)[useEditor.getState().locale]}</button>
            <small>{({es:'¿Objeto complejo, como computadora o silla? Los paneles conservan superficies visibles y texturas WAD3 (incluyendo {, + y -). NO recuperan brushes originales, caras ocultas ni colisiones. Para recuperación de sólidos, usá Visor BSP → Recuperación BSP → BSP a MAP con SurfDecomp.',en:'Complex object, such as a computer or chair? Panels preserve visible surfaces and WAD3 textures (including {, + and -), NOT original brush volumes, hidden faces or collision hulls. For solid recovery, use BSP Viewer → BSP Recovery → BSP to MAP with SurfDecomp.',ru:'Сложный объект? Панели сохраняют видимые поверхности и текстуры WAD3 ({, +, -), но НЕ восстанавливают исходные объёмы и коллизии. Для восстановления используйте BSP Recovery с SurfDecomp.',ko:'복잡한 물체는 보이는 표면과 WAD3 텍스처({, +, -)만 패널로 보존합니다. 원본 브러시와 충돌은 복구하지 않습니다. 실제 브러시는 BSP Recovery / SurfDecomp를 사용하세요.',zh:'复杂物体的面板可保留可见面与 WAD3 纹理（{、+、-），但不能恢复原始笔刷、隐藏面或碰撞。真实实体请使用 BSP Recovery / SurfDecomp。',pt:'Objeto complexo? Os painéis preservam superfícies e texturas WAD3 ({, +, -), mas NÃO recuperam brushes, faces ocultas ou colisões. Para sólidos, utilize BSP Recovery com SurfDecomp.'} as Record<string,string>)[useEditor.getState().locale]}</small>
            <button type="button" disabled={!source||!selectedFaces.length} onClick={()=>void extractSelectedObject('surface-shell')}><Package size={14}/>{({es:'Extraer paneles visibles (aproximado)',en:'Extract visible panels (approximate)',ru:'Извлечь видимые панели (приближённо)',ko:'보이는 패널 추출 (근사)',zh:'导出可见面板（近似）',pt:'Extrair painéis visíveis (aproximado)'} as Record<string,string>)[useEditor.getState().locale]}</button>
            <small>{({es:'Sólidos desde submodelo *N: recupera celdas convexas del árbol BSP (Hull 0), no los brushes originales. Podés importarlos como sólidos editables, pero las divisiones de textura, colisiones y luces pueden diferir.',en:'Solid *N model recovery: reconstructs convex BSP hull-0 cells, NOT original brushes. Editable geometry, but material boundaries, collision and lighting may differ.',ru:'Восстановление твёрдых моделей *N по BSP hull-0. Это не исходные кисти; текстуры, коллизии и свет могут отличаться.',ko:'*N 모델의 BSP hull-0 셀을 솔리드로 복구합니다. 원본 브러시가 아니며 텍스처/충돌/조명이 다를 수 있습니다.',zh:'从 *N 子模型的 BSP Hull 0 重建凸实体，非原始笔刷；纹理边界、碰撞与照明可能不同。',pt:'Recupera sólidos convexos do Hull 0 de submodelos *N, não brushes originais. Texturas, colisões e iluminação podem diferir.'} as Record<string,string>)[useEditor.getState().locale]}</small>
            <button type="button" disabled={!source||selectedFaces.length<4} onClick={()=>void extractSelectedObject('hull0-solid')}><Boxes size={14}/>{({es:'Recuperar sólidos del submodelo (Hull 0)',en:'Recover submodel solids (Hull 0)',ru:'Восстановить тела подмодели (Hull 0)',ko:'서브모델 솔리드 복구 (Hull 0)',zh:'恢复子模型实体（Hull 0）',pt:'Recuperar sólidos do submodelo (Hull 0)'} as Record<string,string>)[useEditor.getState().locale]}</button>
            {objectExtractError&&<small className="bsp-warning" role="alert">{objectExtractError}</small>}
          </div>
          {!selectedFace?<div className="bsp-face-empty">{t('No face selected. Click a visible polygon in the BSP.')}</div>:<>
            <div className="bsp-face-heading"><span>{t('BSP face')} #{selectedFace.index}</span><button type="button" onClick={()=>changeSurfaceSelection([])} title={t('Clear face selection')}><X size={14}/></button></div>
            <dl className="bsp-face-fields">
              <dt>{t('Model')}</dt><dd>{selectedFace.model===0?'worldspawn':`*${selectedFace.model}`}</dd>
              <dt>{t('Texture')}</dt><dd><code>{selectedFace.textureName}</code> (#{selectedFace.textureIndex})</dd>
              <dt>{t('Texture dimensions')}</dt><dd>{selectedFace.textureSize.join(' × ')} px {selectedFace.textureExternal?`· ${t('External WAD')}`:`· ${t('Embedded')}`}</dd>
              <dt>Texinfo</dt><dd>{selectedFace.texinfoIndex??'—'} · {selectedFace.sharedTexinfoFaces} {t('faces share texinfo')}</dd>
              <dt>{t('Plane / side')}</dt><dd>{selectedFace.planeIndex??'—'} / {selectedFace.planeSide??'—'}</dd>
              <dt>{t('Vertices')}</dt><dd>{selectedFace.vertices}</dd>
              <dt>Flags</dt><dd>{selectedFace.flags}</dd>
              <dt>{t('Normal')}</dt><dd>{selectedFace.normal.map(v=>v.toFixed(3)).join(', ')}</dd>
              <dt>U (S)</dt><dd>{selectedFace.sAxis?.map(v=>v.toFixed(3)).join(', ')??'—'}</dd>
              <dt>V (T)</dt><dd>{selectedFace.tAxis?.map(v=>v.toFixed(3)).join(', ')??'—'}</dd>
              <dt>{t('UV bounds')}</dt><dd>U {selectedFace.uvBounds[0].toFixed(1)}…{selectedFace.uvBounds[1].toFixed(1)} / V {selectedFace.uvBounds[2].toFixed(1)}…{selectedFace.uvBounds[3].toFixed(1)}</dd>
              <dt>{t('Lightmap')}</dt><dd>{selectedFace.hasLightmap?t('Available'):t('Unavailable')} · {selectedFace.lightmapSize.join(' × ')} · ofs {selectedFace.lightmapOffset??'—'}</dd>
              <dt>Lightstyles</dt><dd>{selectedFace.lightStyles.join(', ')||'—'}</dd>
            </dl>
            {selectedFaces.length>1&&<small>{t('Last selected face shown. All selected faces are highlighted.')}</small>}
            {surfaceOverrides[selectedFace.index]&&<small className="bsp-edit-notice">{t('Pending change: this face will receive independent texinfo on export.')}</small>}
          </>}
          <div className="bsp-face-editor">
            <strong><PenTool size={15}/>{t('Edit compiled surface')}</strong>
            <details className="bsp-surface-advanced"><summary>{t('Advanced numeric UV controls')}</summary>
            <small>{t('Replace with a compatible ordinary BSP or imported WAD3 texture; special textures are locked.')}</small>
            <label>{t('Replacement texture')}
              <select value={surfaceTexture} onChange={event=>setSurfaceTexture(Number(event.target.value))} disabled={!availableSurfaceTextures.length}>
                <option value={-1}>{t('Keep current texture')}</option>
                {availableSurfaceTextures.map(index=><option key={index} value={index}>{extendedMap.textures[index]?.name||'—'} (#{index})</option>)}
              </select>
            </label>
            <div className="bsp-face-editor-grid">
              <label>{t('UV shift U (pixels)')}<input type="number" min={-16384} max={16384} step={1} value={surfaceShiftU} onChange={event=>setSurfaceShiftU(Number(event.target.value))}/></label>
              <label>{t('UV shift V (pixels)')}<input type="number" min={-16384} max={16384} step={1} value={surfaceShiftV} onChange={event=>setSurfaceShiftV(Number(event.target.value))}/></label>
              <label>{t('UV rotation (degrees)')}<input type="number" min={-360} max={360} step={15} value={surfaceRotate} onChange={event=>setSurfaceRotate(Number(event.target.value))}/></label>
              <label>{t('UV scale U')}<input type="number" min={0.125} max={8} step={0.125} value={surfaceScaleU} onChange={event=>setSurfaceScaleU(Number(event.target.value))}/></label>
              <label>{t('UV scale V')}<input type="number" min={0.125} max={8} step={0.125} value={surfaceScaleV} onChange={event=>setSurfaceScaleV(Number(event.target.value))}/></label>
            </div>
            {!allSelectedUnlit&&<small>{t('Lit surfaces: UV transformations resample existing lightmap RGB on export. Shadows are not recalculated; review the result in game.')}</small>}
            {!canEditSelectedSurfaces&&selectedFaces.length>0&&<small className="bsp-warning">{t('This selection uses special or unsupported textures and cannot be edited safely.')}</small>}
            <div className="bsp-face-editor-actions">
              <button type="button" disabled={!canEditSelectedSurfaces} onClick={applySurfaceEdit}><PenTool size={14}/>{t('Apply to selected faces')}</button>
              <button type="button" disabled={!surfaceHistory.past.length} onClick={undoSurfaceEdit}><Undo2 size={14}/>{t('Undo')}</button>
              <button type="button" disabled={!surfaceHistory.future.length} onClick={redoSurfaceEdit}><Redo2 size={14}/>{t('Redo')}</button>
            </div>
            </details>
            <div className="bsp-face-selection-count">{Object.keys(surfaceOverrides).length} {t('faces with pending edits')}</div>
            <div className="bsp-face-editor-actions">
              <button type="button" disabled={!edited} onClick={exportEntityBsp}><Save size={14}/>{t('Export BSP copy')}</button>
              <button type="button" disabled={!surfaceEdited} onClick={()=>{if(!window.confirm(t('Discard pending surface edits?')))return;setSurfaceHistory({past:[],present:{},future:[]});setSurfaceNotice('');setSurfaceError('')}}><RotateCcw size={14}/>{t('Revert surfaces')}</button>
            </div>
            {surfaceError&&<div className="bsp-warning" role="alert">{surfaceError}</div>}
            {surfaceNotice&&<div className="bsp-edit-notice" role="status">{surfaceNotice}</div>}
            <small><ShieldCheck size={13}/>{t('Exports a BSP copy. Imported WAD3 textures are embedded when used; baked lightmaps are reprojected if UVs change, without recalculating shadows. Geometry, VIS and collisions stay unchanged.')}</small>
          </div>
        </section>}
        <div className="bsp-light-settings">
          <strong>{t('GoldSrc Renderer 2.0')}</strong>
          <label className="bsp-fly-checkbox"><input type="checkbox" checked={rendererPreview.enabled} onChange={e=>changeRenderer({enabled:e.target.checked})}/>{t('GoldSrc material preview')}</label>
          <label className="bsp-fly-checkbox"><input type="checkbox" checked={rendererPreview.transparency} onChange={e=>changeRenderer({transparency:e.target.checked})}/>{t('Water and glass transparency')}</label>
          <label className="bsp-fly-checkbox"><input type="checkbox" checked={rendererPreview.waterAnimation} onChange={e=>changeRenderer({waterAnimation:e.target.checked})}/>{t('Water texture animation')}</label>
          <label className="bsp-light-control">{t('Exposure')} · {rendererPreview.exposure.toFixed(2)}×<input type="range" min="0.5" max="2" step="0.05" value={rendererPreview.exposure} onChange={e=>changeRenderer({exposure:Number(e.target.value)})}/></label>
          <small>{t('GoldSrc preview is approximate; compiled BSP lightmaps remain the reference for baked lighting.')}</small>
        </div>
        <div className="bsp-light-settings">
          <strong>Calibración de Svengine · vista previa</strong>
          {bspFog?<>
            <label className="bsp-fly-checkbox"><input type="checkbox" checked={fogEnabled} onChange={event=>setFogEnabled(event.target.checked)}/>Niebla BSP (env_fog)</label>
            <small>RGB {bspFog.color.join(' ')} · inicio {bspFog.start}u · fin {bspFog.end}u{!bspFog.initiallyEnabled?' · Start Off en el BSP':''}. Vista estática, sin simular triggers.</small>
          </>:<small>Este BSP no tiene un env_fog válido.</small>}
          <label className="bsp-light-control">Gamma visual · {displayGamma.toFixed(2)}×
            <input type="range" min="0.65" max="1.6" step="0.05" value={displayGamma} onChange={event=>setDisplayGamma(normalizeBspDisplayGamma(Number(event.target.value)))}/>
          </label>
          <label className="bsp-light-control">Filtro de lightmap
            <select value={lightFilter} onChange={event=>setLightFilter(event.target.value as BspLightFilter)}><option value="linear">Suave (bilineal)</option><option value="nearest">Píxel (nearest)</option></select>
          </label>
          <button className="bsp-light-reset" onClick={()=>{setFogEnabled(bspFog?.initiallyEnabled??false);setDisplayGamma(1);setLightFilter('linear')}}>Restablecer calibración</button>
          <small>Gamma es una corrección de pantalla (1.0 = neutro) solo en Baked RGB; no es el parámetro rad_gamma y no modifica la iluminación del BSP.</small>
        </div>
        {lightmaps&&<div className="bsp-light-settings">
          <strong>SC-RAD · RGB diagnostic</strong>
          <small>{lightingAudit.litFaces} faces with samples · {lightingAudit.zeroFaces} completely black · {lightingAudit.missingFaces} without samples. Peak {lightingAudit.peak}/255, mean {lightingAudit.average.toFixed(1)}/255.</small>
          {lightingAudit.status==='black'&&<div className="bsp-warning" role="alert">Compiled lightmap pixels are all zero. Baked RGB correctly shows black: check SC-RAD build output, light keys, leaks and geometry; disabling Baked RGB uses an approximate fallback.</div>}
          {lightingAudit.status==='missing'&&<div className="bsp-warning" role="alert">This BSP contains no readable static RGB lighting. Check the RAD stage and BSP light lump.</div>}
          {lightingAudit.status==='very-dark'&&<div className="bsp-warning" role="alert">SC-RAD samples are extremely dark. Check the compile log and light entity configuration before increasing gain.</div>}
          <label className="bsp-light-control">{t('Lightmap intensity')} · {lightBrightness.toFixed(1)}
            <input type="range" min="0.5" max="6" step="0.1" value={lightBrightness} onChange={e=>setLightBrightness(Number(e.target.value))}/>
          </label>
          {baked&&styleStats.animatedFaces>0&&<label className="bsp-light-control">Lightstyle snapshot · frame {styleFrame}<input type="range" min="0" max="63" value={styleFrame} onChange={e=>setStyleFrame(Number(e.target.value))}/></label>}
          {!baked&&<label className="bsp-light-control">{t('Ambient fill')} · {ambientFill.toFixed(2)}
            <input type="range" min="0" max="1.2" step="0.04" value={ambientFill} onChange={e=>setAmbientFill(Number(e.target.value))}/>
          </label>}
          <button className="bsp-light-reset" onClick={()=>{setLightBrightness(BSP_LIGHTMAP_DEFAULT_INTENSITY);setAmbientFill(BSP_LIGHTMAP_DEFAULT_AMBIENT)}}>{t('Reset lighting')}</button>
          <small>{baked?'Baked RGB uses the actual SC-RAD samples. Browser color output and lightstyle snapshots can still differ from Svengine.':t('BSP lighting preview is approximate; dynamic lightstyles are not simulated.')}</small>
        </div>}
        <dl><dt>BSP</dt><dd>v{map.version}</dd><dt>{t('Faces')}</dt><dd>{map.stats.faces.toLocaleString()}</dd><dt>{t('Vertices')}</dt><dd>{map.stats.vertices.toLocaleString()}</dd><dt>{t('Entities')}</dt><dd>{viewMap.stats.entities.toLocaleString()}</dd><dt>{t('Models')}</dt><dd>{map.stats.models}</dd><dt>{t('Lightmapped faces')}</dt><dd>{map.stats.lightmappedFaces.toLocaleString()}</dd><dt>{t('Textures')}</dt><dd>{map.textures.length} ({map.stats.embeddedTextures} {t('embedded')})</dd><dt>skyname</dt><dd>{map.skyname||'—'}</dd><dt>{t('Real skybox')}</dt><dd>{t(showSky?skyStatus:'off')}</dd><dt>{t('MDL models')}</dt><dd>{modelCount} · {t(showModels?modelStatus:'off')}{modelReport&&showModels?` (${modelReport.loaded}/${modelReport.total})`:null}</dd></dl>
        {showSky&&skyStatus==='no-game'&&<div className="bsp-warning">{t('Configure the Sven Co-op game directory to preview installed skyboxes.')}</div>}
        {showSky&&skyStatus==='missing'&&<div className="bsp-warning">{t('The six skybox textures were not found for this skyname.')}</div>}
        {showSky&&skyStatus==='error'&&<div className="bsp-warning">{t('Could not load the installed skybox textures.')}</div>}
        {showModels&&modelStatus==='no-game'&&<div className="bsp-warning">{t('Configure the Sven Co-op game directory to load MDL models.')}</div>}
        {showModels&&['missing','error'].includes(modelStatus)&&<div className="bsp-warning">{t('Some MDL assets are unavailable or unsupported.')}
          {!!modelReport?.missing.length&&<details><summary>{t('Missing model paths')} ({modelReport.missing.length})</summary>{modelReport.missing.slice(0,12).map(path=><div key={path}><code>{path}</code></div>)}</details>}
        </div>}
        <div className="bsp-auto-wad-status" role="status">
          <strong>{t('Automatic WAD textures')}</strong>
          <span>{t(autoWadStatus==='searching'?'Searching installed WADs...':autoWadStatus==='no-game'?'Configure the game folder for automatic WAD loading.':autoWadStatus==='error'?'Automatic WAD lookup failed.':autoWadStatus==='ready'?'Automatic WAD scan finished.':'Automatic WAD lookup idle.')}</span>
          <small>{autoAssets.length} {t('textures loaded')} · {autoWadScanned} {t('WAD files scanned')}{autoWadPages[1]>1?` · ${autoWadPages[0]}/${autoWadPages[1]} ${t('batches')}`:''}</small>
          <button type="button" className="bsp-import" disabled={autoWadStatus==='searching'||!gameDir.trim()} onClick={()=>setAutoWadRefresh(v=>v+1)}><RotateCcw size={14}/>{t('Rescan WADs')}</button>
          {autoWadError&&<small className="bsp-warning">{t(autoWadError)}</small>}
        </div>
        {missing>0&&<div className="bsp-warning">{missing} {t('external textures need WAD files')}</div>}
        
        <button className="bsp-import" onClick={()=>wadInput.current?.click()} disabled={loadingWads}><FileUp size={15}/>{loadingWads?t('Loading WAD...'):t('Import external WAD3')}</button>
        {map.wadNames.length>0&&<p className="bsp-note">WAD: {map.wadNames.join(', ')}</p>}
        {wadError&&<div className="bsp-warning">{wadError}</div>}
        {map.warnings.map((warning,i)=><div className="bsp-warning" key={i}>{warning}</div>)}
        {surfaceMode==='entities'&&<>
        <h3>{t('Entity inspector')}</h3>
        <div className="bsp-label-settings">
          <label className="bsp-label-check"><input type="checkbox" checked={smartLabels} onChange={e=>setSmartLabels(e.target.checked)}/>{t('Avoid overlapping labels')}</label>
          <label>{t('Maximum labels')} · {smartLabels?labelLimit:90}
            <input type="range" min="8" max="80" step="4" value={labelLimit} disabled={!smartLabels} onChange={e=>setLabelLimit(Number(e.target.value))}/>
          </label>
          <label>{t('Entity visibility distance')} · {entityDistance} u
            <input type="range" min="200" max="6400" step="200" value={entityDistance} onChange={e=>setEntityDistance(Number(e.target.value))}/>
          </label>
          <small>{t('Hides distant markers and MDL previews; the selected entity remains visible. Does not modify the BSP.')}</small>
          <label className="bsp-label-check"><input type="checkbox" checked={groundModelPreviews} onChange={event=>setGroundModelPreviews(event.target.checked)}/>{t('Ground NPCs and pickups in preview')}</label>
          <label>{t('Label distance')} · {labelDistance} u
            <input type="range" min="400" max="8000" step="200" value={labelDistance} onChange={e=>setLabelDistance(Number(e.target.value))}/>
          </label>
          <small>{t('Selected entities and player spawns receive label priority.')}</small>
        </div>
        <section className="bsp-entity-browser" aria-label={t('Entity Browser')}>
          <div className="bsp-browser-heading"><strong><Boxes size={15}/>{t('Entity Browser')}</strong><small>{browserTotals.all} {t('entities')}</small></div>
          <div className="bsp-browser-search"><Search size={14}/><input ref={entitySearchRef} className="bsp-search" placeholder={t('Search entities...')} value={query} onChange={e=>{setQuery(e.target.value);setBrowsePage(1)}}/></div>
          <div className="bsp-browser-categories" role="group" aria-label={t('Entity categories')}>
            {BSP_BROWSER_CATEGORIES.map(cat=><button type="button" key={cat.id} className={browseCategory===cat.id?'active':''} aria-pressed={browseCategory===cat.id} onClick={()=>{setBrowseCategory(cat.id);setBrowsePage(1)}}>
              {t(cat.label)} <small>{browserTotals[cat.id]}</small>
            </button>)}
          </div>
          <div className="bsp-browser-result-heading"><span>{filtered.length} {t('results')}</span><small>{t('Double-click to focus entity')}</small></div>
          <div className="bsp-entity-browser-grid">{visibleBrowserItems.map(({entity,index})=>{
            const category=bspEntityCategory(entity.classname);
            return <button type="button" key={index} className={`bsp-browser-tile ${selectedIndices.includes(index)?'active':''}`} data-category={category}
              onClick={event=>selectEntity(index,event.ctrlKey||event.metaKey||event.shiftKey)}
              onContextMenu={event=>{event.preventDefault();setChosen(index);setExtraSelected([]);showBspProperties();setContextMenu(null);setPropertiesTab('attributes')}}
              onDoubleClick={()=>focusEntity(index)} title={`${entity.classname} · ${entity.properties.targetname||'#'+index}`}>
              <span className="bsp-browser-tile-icon">{category==='npc'?<Users size={16}/>:category==='environment'?<SunMedium size={16}/>:category==='logic'||category==='triggers'?<Workflow size={16}/>:category==='geometry'?<Boxes size={16}/>:<MapPin size={16}/>}</span>
              <span className="bsp-browser-tile-text"><strong>{entity.classname}</strong><small>{entity.properties.targetname||`#${index}`}</small></span><ChevronRight className="bsp-browser-tile-chevron" size={13}/>
            </button>;
          })}</div>
          {!visibleBrowserItems.length&&<small className="bsp-browser-empty">{t('No matching entities')}</small>}
          {visibleBrowserItems.length<filtered.length&&<button className="bsp-browser-more" onClick={()=>setBrowsePage(page=>page+1)}>{t('Show more')} · {filtered.length-visibleBrowserItems.length}</button>}
        </section>
        {entityEdit&&multiSelectMode&&<div className="bsp-multiselect-summary"><CheckSquare size={14}/> {t('Multi-select')}: {t('Click entities to add or remove')}. {selectedIndices.length} {t('entities selected')}.</div>}
        {entityEdit&&selectedIndices.length>1&&<div className="bsp-multiselect-summary"><CheckSquare size={14}/> {selectedIndices.length} {t('entities selected')} · {t('Ctrl+click to add or remove')} <button onClick={()=>setExtraSelected([])}>{t('Clear multi-selection')}</button></div>}
        {connectionArmed&&<div className="bsp-warning">{t('Click a destination entity in 3D or in the list. Esc cancels connecting.')}</div>}
        {chosen!==null&&selection?.origin&&<button className="bsp-import" onClick={()=>focusEntity(chosen)}><Focus size={15}/>{t('Focus selected entity')}</button>}
        {entityEdit&&<div className="bsp-visual-create">
          <strong><Plus size={14}/>{t('Place point entity')}</strong>
          <input ref={entityCreateRef} className="bsp-search" placeholder={t('Filter FGD point entities...')} value={newEntityQuery} onChange={event=>{setNewEntityQuery(event.target.value);const match=effectiveFgdClasses.find(cls=>cls.type==='point'&&cls.name.toLowerCase().includes(event.target.value.toLowerCase()));if(match)setNewEntityClass(match.name)}}/>
          <select aria-label={t('Point entity class')} value={availableClasses.some(cls=>cls.name===newEntityClass)?newEntityClass:''} onChange={e=>setNewEntityClass(e.target.value)}>
            {!availableClasses.some(cls=>cls.name===newEntityClass)&&<option value="">{t('Select a point entity')}</option>}
            {availableClasses.map(cls=><option key={cls.name} value={cls.name}>{cls.name}</option>)}
          </select>
          <button disabled={!availableClasses.some(cls=>cls.name===newEntityClass)} onClick={()=>startPlacement(newEntityClass)}><Plus size={14}/>{t('Place in 3D')}</button>
          <small>{t('Choose an entity and click a surface in the BSP viewport. Press Esc to cancel.')}</small>
        </div>}
        {entityEdit&&selectedIndices.length>1&&<div className="bsp-workflow-card">
          <strong><CheckSquare size={14}/>{t('Batch edit point entities')}</strong>
          <small>{t('The operation is atomic and undoable. Compiled brush entities cannot be batch edited.')}</small>
          <div className="bsp-batch-fields"><input aria-label={t('Property key')} value={batchKey} onChange={e=>setBatchKey(e.target.value)}/><input aria-label={t('Value')} value={batchValue} onChange={e=>setBatchValue(e.target.value)}/></div>
          <button disabled={!allEditable||!batchKey.trim()} onClick={()=>editMutation(current=>bspSetMultiplePointFields(current,selectedIndices,batchKey.trim(),batchValue))}>{t('Apply to selected entities')}</button>
        </div>}
        </>}
        {!entityEdit&&entityPropertyPanel}
        <p className="bsp-note">{t('BSP Viewer 2.0 uses the installed six-face skybox and optional static MDL bind poses. No gameplay, collision simulation, animations or dynamic engine effects.')}</p>
      </aside>
      </>}
      {entityEdit&&surfaceMode==='entities'&&selection&&propertiesOpen&&!fly&&<section className="bsp-floating-inspector" role="dialog" aria-label={t('Entity properties')}
        style={{left:effectiveFloatingPosition.x,top:effectiveFloatingPosition.y,width:effectiveFloatingSize.width,height:effectiveFloatingSize.height}}>
        <div className="bsp-floating-inspector-header" tabIndex={0} title={t('Drag to move properties')}
          onKeyDown={event=>{
            const steps:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};
            const step=steps[event.key];if(!step||(event.target as HTMLElement).closest('button,input,select'))return;
            event.preventDefault();event.stopPropagation();
            const bounds=bspContentRef.current?.getBoundingClientRect();if(!bounds)return;
            setFloatingPosition(old=>clampBspFloatingRect({x:(old?.x??260)+step[0]*(event.shiftKey?40:16),y:(old?.y??45)+step[1]*(event.shiftKey?40:16)},floatingSizeRef.current,bounds.width,bounds.height));
          }} onPointerDown={beginBspPropertiesDrag} onPointerMove={dragBspProperties} onPointerUp={finishBspPropertiesDrag} onPointerCancel={finishBspPropertiesDrag}>
          <GripVertical size={16}/><span><strong>{t('Entity properties')}</strong><small>{selection.classname} · #{chosen}</small></span>
          <button type="button" title={t('Close')} aria-label={t('Close')} onPointerDown={e=>e.stopPropagation()} onClick={()=>setPropertiesOpen(false)}><X size={16}/></button>
        </div>
        <div className="bsp-floating-inspector-body" onPointerDown={e=>e.stopPropagation()}>{entityPropertyPanel}</div>
        <div className="bsp-floating-inspector-resize" role="separator" tabIndex={0} title={t('Drag to resize properties')} aria-label={t('Drag to resize properties')}
          onPointerDown={beginBspPropertiesResize} onPointerMove={dragBspPropertiesResize} onPointerUp={finishBspPropertiesResize} onPointerCancel={finishBspPropertiesResize}
          onKeyDown={event=>{
            const step=event.shiftKey?48:20;
            if(event.key==='ArrowRight')resizeBspPropertiesByKeyboard(step,0);
            else if(event.key==='ArrowLeft')resizeBspPropertiesByKeyboard(-step,0);
            else if(event.key==='ArrowDown')resizeBspPropertiesByKeyboard(0,step);
            else if(event.key==='ArrowUp')resizeBspPropertiesByKeyboard(0,-step);
            else return;
            event.preventDefault();event.stopPropagation();
          }}><Grip size={17}/></div>
      </section>}
    </div>
  </div>;
}
