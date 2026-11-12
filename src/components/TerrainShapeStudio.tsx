import {useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useThree} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import type {OrbitControls as OrbitControlsImpl} from 'three-stdlib';
import {CheckCircle2,Mountain,MousePointer2,RotateCcw,ShieldCheck,TriangleAlert,X,Search,Image as ImageIcon,Maximize2,Minimize2,PanelLeftClose,PanelLeftOpen,ChevronsUpDown,Undo2,Redo2} from 'lucide-react';
import {useT} from '../i18n';
import {useEditor} from '../store';
import type {Brush,Vec3} from '../engine/types';
import {parseWad} from '../engine/wad';
import {createRockCluster,createTerrainBrushes,terrainBrushCount,defaultTerrain,sculptTerrain,validateTerrainDraft,createTerrainPreviewShell,terrainBaseZ,terrainTopVertex,type TerrainDraft,type TerrainTool,type TerrainBaseMode} from '../engine/terrain';
import {transformedVertices} from '../engine/geometry';
import {generateWorldHeights,heightsFromRgba,transformWorldHeights,worldTerrainStats,sampleTerrainHeight,applyWorldFeature,type WorldFeature,type WorldPreset,type TerrainTransform} from '../engine/worldBuilderTerrain';
import {createPathStructureBrushes,samplePath,pathStations,type PathStructureKind,type PathStructureOptions} from '../engine/pathStructures';
import {planSmartWorld,type SmartWorldSettings} from '../engine/smartWorld';
import {selectPathGroups} from '../engine/pathGroupSelector';
import {PathPlanEditor} from './PathPlanEditor';
import {Path3DControls,type PathAxis} from './Path3DControls';
import {CurvedGeometryPanel} from './CurvedGeometryPanel';
import {createRailwayExtras,defaultRailwaySettings,checkRailwayGraph,type RailwaySettings} from '../engine/railwayBuilder';

const STARTER_TEXTURES=['SV_BRICK01','SV_CONCRET','SV_TILE01','SV_METAL01','SV_GRID01'];
const previewTextureURL=(name:string,assets:{name:string;dataUrl:string}[])=>assets.find(a=>a.name.toLowerCase()===name.toLowerCase())?.dataUrl||
  (STARTER_TEXTURES.includes(name.toUpperCase())?`/starter-textures/${name.toUpperCase()}.png`:null);


function PreviewSurface({draft,tool,radius,strength,sculptMode,showBase,onPaint,onStrokeStart,onToggleDiagonal,diagonalMode,texture}:{draft:TerrainDraft;tool:TerrainTool;radius:number;strength:number;sculptMode:boolean;showBase:boolean;diagonalMode:boolean;onPaint:(x:number,y:number)=>void;onStrokeStart:()=>void;onToggleDiagonal:(x:number,y:number)=>void;texture:THREE.Texture|null}){
  const dragging=useRef(false);
  const cursor=useRef<THREE.Mesh>(null);
  const {surface,base}=useMemo(()=>{
    // Invalid values while editing numeric inputs should show a warning,
    // never crash the entire editor with an uncaught preview error.
    let shell:ReturnType<typeof createTerrainPreviewShell>|null=null;
    try{shell=createTerrainPreviewShell(draft)}catch{/* invalid draft: empty preview */}
    const make=(positions:number[],uvs:number[])=>{
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      geometry.computeVertexNormals();return geometry;
    };
    return {surface:make(shell?.topPositions||[],shell?.topUvs||[]),base:make(shell?.basePositions||[],shell?.baseUvs||[])};
  },[draft.width,draft.depth,draft.heights,draft.resolution,draft.origin,draft.baseDepth,draft.baseMode,draft.surfaceThickness,draft.customBaseOffset,draft.diagonalFlips]);
  useEffect(()=>()=>{surface.dispose();base.dispose()},[surface,base]);
  const paint=(p:THREE.Vector3)=>onPaint(p.x+draft.width/2,draft.depth/2-p.z);
  const cursorAt=(p:THREE.Vector3)=>{if(cursor.current){cursor.current.visible=sculptMode;cursor.current.position.set(p.x,p.y+1.6,p.z)}};
  return <group>
    {/* Sculpt only the top surface, never an exterior wall or the bottom. */}
    <mesh geometry={surface}
      onPointerDown={e=>{
        if(e.button!==0)return;
        if(diagonalMode){e.stopPropagation();onToggleDiagonal(e.point.x+draft.width/2,draft.depth/2-e.point.z);return;}
        if(!sculptMode)return;
        e.stopPropagation();dragging.current=true;onStrokeStart();cursorAt(e.point);
        (e.target as unknown as HTMLElement)?.setPointerCapture?.(e.pointerId);paint(e.point);
      }}
      onPointerMove={e=>{
        cursorAt(e.point);
        if(!sculptMode||!dragging.current||!(e.buttons&1))return;
        e.stopPropagation();paint(e.point);
      }}
      onPointerUp={e=>{dragging.current=false;if((e.target as unknown as HTMLElement)?.hasPointerCapture?.(e.pointerId))(e.target as unknown as HTMLElement)?.releasePointerCapture?.(e.pointerId)}}
      onPointerCancel={()=>{dragging.current=false}} onPointerOut={()=>{if(cursor.current)cursor.current.visible=false}}>
      <meshStandardMaterial map={texture||undefined} color={texture?'#ffffff':'#8eab86'} side={THREE.DoubleSide} flatShading roughness={1}/>
    </mesh>
    <mesh ref={cursor} visible={false} rotation={[-Math.PI/2,0,0]} scale={[radius,radius,1]} raycast={()=>null} renderOrder={9}>
      <ringGeometry args={[0.95,1,64]}/>
      <meshBasicMaterial color="#5beaff" transparent opacity={0.85} depthTest={false} side={THREE.DoubleSide}/>
    </mesh>
    {showBase&&<mesh geometry={base} raycast={()=>null}>
      <meshStandardMaterial map={texture||undefined} color={texture?'#ffffff':'#8eab86'} side={THREE.DoubleSide} flatShading roughness={1}/>
    </mesh>}
  </group>;
}
/** Compact in-viewport vertex handles. Only one drag snapshot is recorded per gesture. */
function TerrainVertexHandles({draft,selected,onSelect,onBeginDrag,onMove}:{draft:TerrainDraft;selected:number|null;onSelect:(index:number)=>void;onBeginDrag:()=>void;onMove:(index:number,height:number)=>void}){
  const dragging=useRef<{index:number;startY:number;height:number}|null>(null);
  const r=Math.max(6,Math.min(18,Math.min(draft.width,draft.resolution?draft.depth:64)/draft.resolution*.19));
  return <group>{draft.heights.map((h,index)=>{
    const i=index%(draft.resolution+1),j=Math.floor(index/(draft.resolution+1));
    const vertex=terrainTopVertex(draft,i,j);
    return <mesh key={index} position={[vertex[0]-draft.origin[0],vertex[2]-draft.origin[2]+2,draft.origin[1]-vertex[1]]}
      renderOrder={10}
      onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();onSelect(index);onBeginDrag();dragging.current={index,startY:e.clientY,height:h};(e.target as unknown as HTMLElement)?.setPointerCapture?.(e.pointerId)}}
      onPointerMove={e=>{if(dragging.current?.index!==index)return;e.stopPropagation();const move=(dragging.current.startY-e.clientY)*.75;onMove(index,Math.round((dragging.current.height+move)/2)*2)}}
      onPointerUp={e=>{if(dragging.current?.index===index)dragging.current=null;if((e.target as unknown as HTMLElement)?.hasPointerCapture?.(e.pointerId))(e.target as unknown as HTMLElement)?.releasePointerCapture?.(e.pointerId)}}
      onPointerCancel={()=>{dragging.current=null}}>
      <sphereGeometry args={[r,10,8]}/><meshBasicMaterial color={index===selected?'#ffdb75':'#64e4f3'} transparent opacity={index===selected?1:.8} depthTest={false}/>
    </mesh>;
  })}</group>;
}
function TerrainCameraRig({mode,tick,size,controls}:{mode:'perspective'|'top'|'side';tick:number;size:number;controls:React.RefObject<OrbitControlsImpl|null>}){
  const {camera}=useThree();
  useEffect(()=>{
    const dist=Math.max(480,size*1.55);
    if(mode==='top')camera.position.set(0,dist,0.01);
    else if(mode==='side')camera.position.set(dist,dist*.22,0);
    else camera.position.set(dist*.75,dist*.62,dist*.85);
    camera.lookAt(0,0,0);camera.updateProjectionMatrix();
    controls.current?.target.set(0,0,0);controls.current?.update();
  },[mode,tick,camera,controls]);
  return null;
}
function RockShape({brush,texture}:{brush:Brush;texture:THREE.Texture|null}){
  const geometry=useMemo(()=>{
    const points=transformedVertices(brush),triangles:number[]=[],uvs:number[]=[];
    for(const face of brush.faces){
      for(let k=1;k<face.indices.length-1;k++){
        for(const idx of [face.indices[0],face.indices[k],face.indices[k+1]]){
          const p=points[idx];triangles.push(p[0],p[2],-p[1]);uvs.push(p[0]/64,p[1]/64);
        }
      }
    }
    const buffer=new THREE.BufferGeometry();buffer.setAttribute('position',new THREE.Float32BufferAttribute(triangles,3));buffer.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));buffer.computeVertexNormals();return buffer;
  },[brush]);
  useEffect(()=>()=>geometry.dispose(),[geometry]);
  return <mesh geometry={geometry}><meshStandardMaterial map={texture||undefined} color={texture?'#ffffff':'#9d9b8e'} side={THREE.DoubleSide} roughness={1} flatShading/></mesh>;
}
const fmt=(v:number)=>Math.round(v*100)/100;
function resample(heights:number[],oldSize:number,newSize:number):number[]{
  const get=(x:number,y:number)=>heights[Math.min(oldSize,y)*(oldSize+1)+Math.min(oldSize,x)]||0;
  return Array.from({length:(newSize+1)**2},(_,k)=>{
    const i=k%(newSize+1),j=Math.floor(k/(newSize+1)),px=i/newSize*oldSize,py=j/newSize*oldSize;
    const x=Math.floor(px),y=Math.floor(py),fx=px-x,fy=py-y;
    return fmt((get(x,y)*(1-fx)+get(x+1,y)*fx)*(1-fy)+(get(x,y+1)*(1-fx)+get(x+1,y+1)*fx)*fy);
  });
}
export function TerrainShapeStudio({onClose,initialTab='terrain'}:{onClose:()=>void;initialTab?:'terrain'|'curves'}){
  const t=useT();
  const existing=useEditor(s=>s.project.terrainGroups);
  const existingPaths=useEditor(s=>selectPathGroups(s.project));
  const updatePathStructure=useEditor(s=>s.updatePathStructure);
  const setPathEditing=useEditor(s=>s.setPathEditing);
  const objects=useEditor(s=>s.project.objects);
  const selected=useEditor(s=>s.selected);
  const texture=useEditor(s=>s.currentTexture);
  const textureAssets=useEditor(s=>s.textureAssets);
  const setTextures=useEditor(s=>s.setTextures);
  const startTerrainPlacement=useEditor(s=>s.startTerrainPlacement);
  const [textureSearch,setTextureSearch]=useState('');
  const [wadFilter,setWadFilter]=useState('all');
  const [importingWad,setImportingWad]=useState(false);
  const [previewTexture,setPreviewTexture]=useState<THREE.Texture|null>(null);
  const applyTerrain=useEditor(s=>s.applyTerrain);
  const applySmartWorld=useEditor(s=>s.applySmartWorld);
  const compileBusy=useEditor(s=>s.compileBusy);
  const [tab,setTab]=useState<'terrain'|'rocks'|'paths'|'curves'>(initialTab);
  const [draft,setDraft]=useState<TerrainDraft>(()=>{const d=defaultTerrain();return {...d,optimized:true,heights:generateWorldHeights(d.resolution,'hills',192,7)}});
  const [tool,setTool]=useState<TerrainTool>('raise');
  const [radius,setRadius]=useState(128),[strength,setStrength]=useState(32);
  const [sculptMode,setSculptMode]=useState(true);
  const [vertexMode,setVertexMode]=useState(false);
  const [diagonalMode,setDiagonalMode]=useState(false);
  const [selectedVertex,setSelectedVertex]=useState<number|null>(null);
  const [focusTerrain,setFocusTerrain]=useState(false);
  const [cameraMode,setCameraMode]=useState<'perspective'|'top'|'side'>('perspective');
  const [cameraRevision,setCameraRevision]=useState(0);
  const orbitRef=useRef<OrbitControlsImpl>(null);
  const [showBase,setShowBase]=useState(false);

  // World Builder: height edits are preview-only until the user applies/places them.
  const [worldPreset,setWorldPreset]=useState<WorldPreset>('hills');
  const [worldSeed,setWorldSeed]=useState(7);
  const [worldAmplitude,setWorldAmplitude]=useState(192);
  const [heightmapMin,setHeightmapMin]=useState(-128);
  const [heightmapMax,setHeightmapMax]=useState(256);
  const [heightmapInvert,setHeightmapInvert]=useState(false);
  const [terraceStep,setTerraceStep]=useState(32);
  const [feature,setFeature]=useState<WorldFeature>('ridge');
  const [featureHeight,setFeatureHeight]=useState(80);
  const [featureWidth,setFeatureWidth]=useState(128);
  const [featureDirection,setFeatureDirection]=useState<'x'|'y'>('x');
  const [,setTerrainHistoryVersion]=useState(0);
  type TerrainHistoryEntry={heights:number[];diagonalFlips?:number[];optimized?:boolean};
  const terrainUndo=useRef<TerrainHistoryEntry[]>([]);
  const terrainRedo=useRef<TerrainHistoryEntry[]>([]);
  const terrainCurrent=useRef(draft);
  terrainCurrent.current=draft;
  const snapshotHeights=()=>{
    terrainUndo.current.push({heights:[...terrainCurrent.current.heights],diagonalFlips:terrainCurrent.current.diagonalFlips?[...terrainCurrent.current.diagonalFlips]:undefined,optimized:terrainCurrent.current.optimized});
    if(terrainUndo.current.length>60)terrainUndo.current.shift();
    terrainRedo.current=[];setTerrainHistoryVersion(v=>v+1);
  };
  const restoreHeights=(undo:boolean)=>{
    const source=undo?terrainUndo.current:terrainRedo.current;
    const target=source.pop();if(!target)return;
    const current=terrainCurrent.current;
    (undo?terrainRedo.current:terrainUndo.current).push({heights:[...current.heights],diagonalFlips:current.diagonalFlips?[...current.diagonalFlips]:undefined,optimized:current.optimized});
    terrainCurrent.current={...current,heights:[...target.heights],diagonalFlips:target.diagonalFlips?[...target.diagonalFlips]:undefined,optimized:target.optimized};
    setDraft(terrainCurrent.current);setTerrainHistoryVersion(v=>v+1);setMessage('');
  };
  const applyHeights=(heights:number[],label:string)=>{
    if(heights.length!==terrainCurrent.current.heights.length||heights.some(h=>!Number.isFinite(h)||Math.abs(h)>512)){
      setMessage('Invalid heightmap: the result exceeds terrain elevation limits.');return;
    }
    snapshotHeights();const updated={...terrainCurrent.current,heights};
    terrainCurrent.current=updated;setDraft(updated);setMessage(label);
  };
  const resetHeightHistory=()=>{terrainUndo.current=[];terrainRedo.current=[];setTerrainHistoryVersion(v=>v+1)};
  const makeLandform=()=>{
    try{applyHeights(applyWorldFeature(terrainCurrent.current,feature,{height:featureHeight,width:featureWidth,seed:worldSeed,direction:featureDirection}),t('Landform generated in preview.'))}
    catch(error){setMessage(String(error instanceof Error?error.message:error))}
  };
  const toggleDiagonal=(x:number,y:number)=>{
    const d=terrainCurrent.current,n=d.resolution;
    const i=Math.max(0,Math.min(n-1,Math.floor(x/d.width*n)));
    const j=Math.max(0,Math.min(n-1,Math.floor(y/d.depth*n)));
    snapshotHeights();const flips=d.diagonalFlips?.slice()??Array(n*n).fill(0);
    flips[j*n+i]=1-flips[j*n+i];
    const next={...d,diagonalFlips:flips,optimized:false};terrainCurrent.current=next;setDraft(next);setMessage('');
  };
  const moveTerrainVertex=(index:number,height:number)=>{
    const h=Math.max(-512,Math.min(512,height));
    setDraft(d=>{
      if(index<0||index>=d.heights.length||d.heights[index]===h)return d;
      const heights=[...d.heights];heights[index]=h;const next={...d,heights};terrainCurrent.current=next;return next;
    });
  };
  const setInteraction=(mode:'sculpt'|'inspect'|'vertex'|'diagonal')=>{
    setSculptMode(mode==='sculpt');setVertexMode(mode==='vertex');setDiagonalMode(mode==='diagonal');
  };
  const generatePreset=()=>{
    try{applyHeights(generateWorldHeights(draft.resolution,worldPreset,worldAmplitude,worldSeed),`Landscape ${worldPreset} generated in preview. Apply or place to save.`);}
    catch(error){setMessage(String(error instanceof Error?error.message:error))}
  };
  const applyHeightTransform=(operation:TerrainTransform)=>{
    try{applyHeights(transformWorldHeights(terrainCurrent.current,operation,{terraceStep}),`Terrain ${operation} updated in preview.`)}
    catch(error){setMessage(String(error instanceof Error?error.message:error))}
  };
  const importHeightmap=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>16*1024*1024){setMessage('Heightmap must be 16 MB or smaller.');return;}
    if(!/^image\/(png|jpeg|webp)$/.test(file.type)){setMessage('Use a PNG, JPEG or WebP heightmap.');return;}
    let bitmap:ImageBitmap|undefined;
    try{
      bitmap=await createImageBitmap(file);
      if(bitmap.width<2||bitmap.height<2||bitmap.width>4096||bitmap.height>4096)throw Error('Heightmap dimensions must be 2–4096 pixels.');
      const canvas=document.createElement('canvas');const factor=Math.min(1,512/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(2,Math.round(bitmap.width*factor));canvas.height=Math.max(2,Math.round(bitmap.height*factor));
      const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error('Canvas is unavailable.');
      context.drawImage(bitmap,0,0,canvas.width,canvas.height);
      const data=context.getImageData(0,0,canvas.width,canvas.height);
      applyHeights(heightsFromRgba(data.data,canvas.width,canvas.height,terrainCurrent.current.resolution,heightmapMin,heightmapMax,heightmapInvert),`Heightmap ${file.name} loaded into preview. Original project unchanged.`);
    }catch(error){setMessage(`Heightmap import failed: ${String(error instanceof Error?error.message:error)}`)}
    finally{bitmap?.close()}
  };
  const exportHeightmap=()=>{
    try{
      const grid=terrainCurrent.current,stats=worldTerrainStats(grid.heights),canvas=document.createElement('canvas'),size=256;
      canvas.width=size;canvas.height=size;
      const context=canvas.getContext('2d');if(!context)throw Error('Canvas unavailable');
      const img=context.createImageData(size,size);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const h=sampleTerrainHeight(grid.heights,grid.resolution,x/(size-1),y/(size-1));
        const lum=Math.round(Math.max(0,Math.min(255,stats.range?(h-stats.min)/stats.range*255:127)));
        const i=(y*size+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=lum;img.data[i+3]=255;
      }
      context.putImageData(img,0,0);
      canvas.toBlob(blob=>{
        if(!blob){setMessage('Failed to export PNG.');return;}
        const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;
        link.download=(grid.name.replace(/[^a-z0-9_-]+/gi,'_')||'terrain')+'_heightmap.png';link.click();
        window.setTimeout(()=>URL.revokeObjectURL(url),5000);
      },'image/png');
      setMessage(`Heightmap PNG exported (grayscale normalized to current ${stats.min}–${stats.max} u).`);
    }catch(error){setMessage(String(error instanceof Error?error.message:error))}
  };
  useEffect(()=>{
    if(tab!=='terrain')return;
    const onKey=(event:KeyboardEvent)=>{
      if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
      if((event.target as HTMLElement|null)?.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(event.key.toLowerCase()!=='z'&&event.key.toLowerCase()!=='y')return;
      event.preventDefault();event.stopImmediatePropagation();
      restoreHeights(event.key.toLowerCase()==='z'&&!event.shiftKey);
    };
    document.addEventListener('keydown',onKey,true);
    return()=>document.removeEventListener('keydown',onKey,true);
  },[tab]);

  const [rockCount,setRockCount]=useState(6),[rockRadius,setRockRadius]=useState(96),[rockHeight,setRockHeight]=useState(96),[seed,setSeed]=useState(12);
  const [message,setMessage]=useState('');
  const [editingPathId,setEditingPathId]=useState<string|null>(null);
  const [pathKind,setPathKind]=useState<PathStructureKind>('road');
  const [pathSurfacePortals,setPathSurfacePortals]=useState(false);
  const [smartTerrainId,setSmartTerrainId]=useState('');
  const [smartShoulder,setSmartShoulder]=useState(96);
  const [smartClearance,setSmartClearance]=useState(16);
  const [pathPoints,setPathPoints]=useState<Vec3[]>([[-160,-80,0],[0,50,0],[160,-80,0]]);
  const [pathWidth,setPathWidth]=useState(96);
  const [pathHeight,setPathHeight]=useState(96);
  const [pathThickness,setPathThickness]=useState(8);
  const [pathView3D,setPathView3D]=useState(false);
  const [editIn3D,setEditIn3D]=useState(false);
  const [path3DAxis,setPath3DAxis]=useState<PathAxis>('xy');
  const [path3DDragging,setPath3DDragging]=useState(false);
  const [repeatSpacing,setRepeatSpacing]=useState(96);
  const [railwayEnabled,setRailwayEnabled]=useState(true);
  const [railPreviewPct,setRailPreviewPct]=useState(0);
  const [railway,setRailway]=useState<RailwaySettings>(()=>defaultRailwaySettings());
  const editRailway=<K extends keyof RailwaySettings>(key:K,value:RailwaySettings[K])=>setRailway(v=>({...v,[key]:value}));
  const [cableSag,setCableSag]=useState(32);
  const [cableCount,setCableCount]=useState(1);
  const [cableSpacing,setCableSpacing]=useState(16);
  const [expandedStudio,setExpandedStudio]=useState(false);
  const [focusRoute,setFocusRoute]=useState(false);
  const [expandedElevation,setExpandedElevation]=useState(false);
  const [pathSmooth,setPathSmooth]=useState(true);
  const [pathQuality,setPathQuality]=useState(6);
  const [sidewalkWidth,setSidewalkWidth]=useState(0);
  const [curbHeight,setCurbHeight]=useState(8);
  const [activePoint,setActivePoint]=useState(1);
  const dragHeight=useRef<number|null>(null);
  const [fixedProfileRange,setFixedProfileRange]=useState<{low:number;high:number}|null>(null);
  // Studio-local path history. A pointer drag is recorded once, not once per frame.
  const pathUndo=useRef<Vec3[][]>([]);
  const pathRedo=useRef<Vec3[][]>([]);
  const pathLatest=useRef(pathPoints);
  pathLatest.current=pathPoints;
  const clonePath=(points:Vec3[])=>points.map(p=>[...p] as Vec3);
  const rememberPath=()=>{
    pathUndo.current.push(clonePath(pathLatest.current));
    if(pathUndo.current.length>100)pathUndo.current.shift();
    pathRedo.current=[];
  };
  const editPath=(next:Vec3[])=>{
    if(JSON.stringify(next)===JSON.stringify(pathLatest.current))return;
    rememberPath();pathLatest.current=next;setPathPoints(next);setMessage('');
  };
  const undoPath=()=>{
    const prior=pathUndo.current.pop();if(!prior)return;
    pathRedo.current.push(clonePath(pathLatest.current));pathLatest.current=prior;setPathPoints(prior);
    setActivePoint(p=>Math.min(p,prior.length-1));setMessage('');
  };
  const redoPath=()=>{
    const next=pathRedo.current.pop();if(!next)return;
    pathUndo.current.push(clonePath(pathLatest.current));pathLatest.current=next;setPathPoints(next);
    setActivePoint(p=>Math.min(p,next.length-1));setMessage('');
  };
  useEffect(()=>{
    if(tab!=='paths')return;
    const onKey=(event:KeyboardEvent)=>{
      if(!(event.ctrlKey||event.metaKey)||event.altKey)return;
      const target=event.target as HTMLElement|null;
      // Keep native text editing undo in input fields; intercept only route gestures.
      if(target?.closest('input,textarea,[contenteditable="true"]'))return;
      const key=event.key.toLowerCase();
      if(key==='z'||key==='y'){
        event.preventDefault();event.stopImmediatePropagation();
        if(key==='y'||event.shiftKey)redoPath();else undoPath();
      }
    };
    document.addEventListener('keydown',onKey,true);
    return()=>document.removeEventListener('keydown',onKey,true);
  },[tab]);
  const pathDistances=useMemo(()=>pathPoints.map((p,i)=>i===0?0:pathPoints.slice(1,i+1).reduce((dist,q,j)=>dist+Math.hypot(q[0]-pathPoints[j][0],q[1]-pathPoints[j][1],...((['vent','pipe','cable','cave'] as PathStructureKind[]).includes(pathKind)?[q[2]-pathPoints[j][2]]:[])),0)),[pathPoints,pathKind]);
  const lengthTotal=Math.max(1,pathDistances[pathDistances.length-1]||1);
  const elevationRange=useMemo(()=>{
    const levels=pathPoints.map(p=>p[2]);
    const min=Math.min(...levels),max=Math.max(...levels);
    const padding=Math.max(64,(max-min)*.3);
    return {low:Math.floor((min-padding)/16)*16,high:Math.ceil((max+padding)/16)*16};
  },[pathPoints]);
  const visibleProfileRange=fixedProfileRange||elevationRange;
  const profileX=(index:number)=>32+736*(pathDistances[index]||0)/lengthTotal;
  const profileY=(z:number)=>144-(z-visibleProfileRange.low)/(visibleProfileRange.high-visibleProfileRange.low)*120;
  const heightFromPointer=(event:React.PointerEvent<SVGCircleElement>)=>{
    const bounds=event.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const y=(event.clientY-bounds.top)/bounds.height*168;
    return Math.round((visibleProfileRange.low+(144-y)/120*(visibleProfileRange.high-visibleProfileRange.low))/8)*8;
  };
  const pathOptions=useMemo<PathStructureOptions>(()=>({
    kind:pathKind,width:pathWidth,height:pathHeight,wallThickness:pathThickness,surfacePortals:pathKind==='cave'?pathSurfacePortals:undefined,repeatSpacing,cableSag,cableCount,cableSpacing,
    texture:draft.texture,name:({road:'Road',vent:'Ventilation duct',pipe:'Industrial pipe',cable:'Suspended cables',walkway:'Walkway',rail:'Railway track',fence:'Fence line',bridge:'Bridge & Catwalk',cave:'Cave Tunnel'} as Record<PathStructureKind,string>)[pathKind],smooth:pathSmooth,subdivisions:pathQuality,sidewalkWidth:pathKind==='road'?sidewalkWidth:0,curbHeight,
    railway:pathKind==='rail'&&railwayEnabled?{...railway,branchNode:Math.min(railway.branchNode??0,pathPoints.length-2),stationNode:Math.min(railway.stationNode??0,pathPoints.length-1)}:undefined,
    points:pathPoints.map(([x,y,z])=>[x+draft.origin[0],y+draft.origin[1],z+draft.origin[2]] as Vec3),
  }),[pathKind,pathWidth,pathHeight,pathThickness,pathSurfacePortals,repeatSpacing,cableSag,cableCount,cableSpacing,draft.texture,draft.origin,pathPoints,pathSmooth,pathQuality,sidewalkWidth,curbHeight,railwayEnabled,railway]);
  const smartTerrain=useMemo(()=>existing?.find(g=>g.id===smartTerrainId)||null,[existing,smartTerrainId]);
  const smartSettings:SmartWorldSettings=useMemo(()=>({shoulder:smartShoulder,clearance:smartClearance}),[smartShoulder,smartClearance]);
  const smartPreview=useMemo(()=>{
    if(!smartTerrain||!['road','walkway','cave'].includes(pathKind))return {plan:null,error:''};
    if(editingPathId)return {plan:null,error:'Save-path editing is protected; start a new route to use smart integration.'};
    try{return {plan:planSmartWorld(smartTerrain,pathOptions,smartSettings),error:''};}
    catch(error){return {plan:null,error:String(error instanceof Error?error.message:error)};}
  },[smartTerrain,pathOptions,smartSettings,pathKind,editingPathId]);
  const commitSmartWorld=()=>{
    if(!smartTerrain||!smartPreview.plan||compileBusy)return;
    try{
      applySmartWorld(smartTerrain.id,pathOptions,smartSettings);
      setSmartTerrainId('');
      setMessage(t('Terrain and path integrated. One MAP Editor Undo restores both.'));
    }catch(error){setMessage(String(error instanceof Error?error.message:error));}
  };
  const centerSmartRoute=()=>{
    if(!smartTerrain)return;
    const span=Math.min(smartTerrain.width,smartTerrain.depth),half=Math.max(30,Math.min(span*.19,span*.5-pathWidth*.5-smartShoulder-16));
    setDraft(d=>({...d,origin:[...smartTerrain.origin],texture:smartTerrain.texture}));
    editPath([[-half,-span*.07,0],[0,span*.07,0],[half,-span*.07,0]]);
    setPathView3D(true);setEditIn3D(false);
  };
  // Movement preview is an approximate interpolation over sampled native path
  // nodes. It never simulates collisions or train control logic.
  const railPreviewPose=useMemo(()=>{
    if(pathKind!=='rail'||!railwayEnabled||!railway.train)return null;
    try{
      const points=samplePath(pathOptions);if(points.length<2)return null;
      const segments=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1],p[2]-points[i][2]));
      const total=segments.reduce((a,b)=>a+b,0);let remaining=total*railPreviewPct/100;
      for(let i=0;i<segments.length;i++){
        if(remaining<=segments[i]||i===segments.length-1){
          const f=segments[i]?Math.min(1,remaining/segments[i]):0,a=points[i],b=points[i+1];
          return {point:[a[0]+(b[0]-a[0])*f-draft.origin[0],a[2]+(b[2]-a[2])*f-draft.origin[2]+48,-(a[1]+(b[1]-a[1])*f-draft.origin[1])] as Vec3,
            yaw:Math.atan2(b[1]-a[1],b[0]-a[0])};
        }remaining-=segments[i];
      }
    }catch{/* Invalid railway: preview stays hidden. */}
    return null;
  },[pathKind,railwayEnabled,railway.train,pathOptions,railPreviewPct,draft.origin]);
  const sampledElevations=useMemo(()=>{
    try{
      const points=samplePath(pathOptions);
      let distance=0;
      return points.map((point,index)=>{
        if(index)distance+=Math.hypot(point[0]-points[index-1][0],point[1]-points[index-1][1],...((['vent','pipe','cable','cave'] as PathStructureKind[]).includes(pathKind)?[point[2]-points[index-1][2]]:[]));
        return {distance,z:point[2]-draft.origin[2]};
      });
    }catch{return [] as {distance:number;z:number}[];}
  },[pathOptions,draft.origin,pathKind]);
  const pathPreview=useMemo(()=>{try{
      const effectivePath=smartPreview.plan?.path??pathOptions;
      const base=createPathStructureBrushes(effectivePath),extras=createRailwayExtras(effectivePath);
      const networkErrors=checkRailwayGraph(extras.entities);if(networkErrors.length)throw Error(networkErrors.join(' | '));
      return {brushes:[...base,...extras.brushes],entities:extras.entities.length,warnings:extras.warnings,error:''};
    }catch(e){return {brushes:[] as Brush[],entities:0,warnings:[] as string[],error:String(e instanceof Error?e.message:e)};}},[pathOptions,smartPreview.plan]);
  const pathOutline=useMemo(()=>{
    try{
      if((['vent','pipe','cable','cave'] as PathStructureKind[]).includes(pathKind)){
        return {road:'',left:'',right:'',center:samplePath(pathOptions).map(p=>`${p[0]-draft.origin[0]},${p[1]-draft.origin[1]}`).join(' ')};
      }
      const samples=samplePath(pathOptions),stations=pathStations(samples,pathWidth+2*(pathKind==='road'?sidewalkWidth:0));
      const edge=(i:number,side:number)=>`${stations.points[i][0]-draft.origin[0]+stations.normals[i][0]*stations.miters[i]*side},${stations.points[i][1]-draft.origin[1]+stations.normals[i][1]*stations.miters[i]*side}`;
      const polygon=(lo:number,hi:number)=>[...samples.map((_,i)=>edge(i,lo)),...samples.map((_,k)=>edge(samples.length-k-1,hi))].join(' ');
      return {road:polygon(-pathWidth/2,pathWidth/2),left:polygon(-pathWidth/2-sidewalkWidth,-pathWidth/2),right:polygon(pathWidth/2,pathWidth/2+sidewalkWidth),center:samples.map(p=>`${p[0]-draft.origin[0]},${p[1]-draft.origin[1]}`).join(' ')};
    }catch{return null;}
  },[pathOptions,pathWidth,pathKind,sidewalkWidth,draft.origin]);
  const movePoint=(index:number,x:number,y:number)=>{
    const next=pathLatest.current.map((p,i)=>i===index?[x,y,p[2]] as Vec3:p);
    pathLatest.current=next;setPathPoints(next);setMessage('');
  };
  const moveHeight=(index:number,z:number)=>{
    const next=pathLatest.current.map((p,i)=>i===index?[p[0],p[1],z] as Vec3:p);
    pathLatest.current=next;setPathPoints(next);setMessage('');
  };
  const insertPoint=()=>{
    const ps=pathLatest.current;if(ps.length>=48)return;
    const i=Math.min(activePoint,ps.length-2),a=ps[i],b=ps[i+1];
    editPath([...ps.slice(0,i+1),[Math.round((a[0]+b[0])/16)*8,Math.round((a[1]+b[1])/16)*8,(a[2]+b[2])/2] as Vec3,...ps.slice(i+1)]);
    setActivePoint(i+1);
  };
  const addPathPoint=(x:number,y:number)=>{
    if(pathLatest.current.length>=48)return;
    editPath([...pathLatest.current,[x,y,pathLatest.current[pathLatest.current.length-1]?.[2]||0]]);
  };
  const record=existing?.find(g=>g.id===draft.id);
  const availableTextures=useMemo(()=>{
    const result=[...textureAssets.map(a=>({name:a.name,wad:a.wad,url:a.thumbUrl||a.dataUrl}))];
    for(const name of STARTER_TEXTURES)if(!result.some(a=>a.name.toLowerCase()===name.toLowerCase()))
      result.push({name,wad:'Starter',url:`/starter-textures/${name}.png`});
    return result;
  },[textureAssets]);
  const wadNames=useMemo(()=>[...new Set(availableTextures.map(x=>x.wad))],[availableTextures]);
  const shownTextures=useMemo(()=>availableTextures.filter(a=>(wadFilter==='all'||a.wad===wadFilter)&&a.name.toLowerCase().includes(textureSearch.trim().toLowerCase())).slice(0,100),[availableTextures,wadFilter,textureSearch]);
  useEffect(()=>{
    const url=previewTextureURL(draft.texture,textureAssets);
    if(!url){setPreviewTexture(null);return;}
    let active=true;
    const loader=new THREE.TextureLoader();
    let loaded:THREE.Texture|undefined;
    loaded=loader.load(url,texture=>{
      texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
      texture.magFilter=THREE.NearestFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
      texture.colorSpace=THREE.SRGBColorSpace;
      if(active)setPreviewTexture(texture);else texture.dispose();
    },undefined,()=>{if(active)setPreviewTexture(null)});
    return()=>{active=false;loaded?.dispose();};
  },[draft.texture,textureAssets]);
  const importWad=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const files=Array.from(event.target.files||[]);if(!files.length)return;
    setImportingWad(true);
    try{for(const file of files){const assets=await parseWad(file);setTextures(assets,file.name);}setMessage(`${files.length} ${t('WAD files imported into texture browser.')}`);}
    catch(error){setMessage(`${t('WAD import error')}: ${String(error)}`);}
    finally{setImportingWad(false);event.target.value='';}
  };
  const copySavedRoute=()=>{
    if(!editingPathId)return;
    // Keep world-space points and current profile parameters, but do not regenerate
    // or mutate the saved route. The next MAP placement creates a new record.
    setEditingPathId(null);setPathSurfacePortals(false);
    setRailwayEnabled(false);setRailway(defaultRailwaySettings());
    setMessage(t('Route copied. Choose a different structure type and place a new copy; the original route is unchanged.'));
  };
  const loadPath=(id:string)=>{
    if(!id){setEditingPathId(null);setPathSurfacePortals(false);setRailwayEnabled(true);setRailway(defaultRailwaySettings());setMessage('');return;}
    const group=existingPaths.find(record=>record.id===id);if(!group)return;
    const data=group.options;
    setEditingPathId(id);setPathKind(data.kind);setPathSurfacePortals(!!data.surfacePortals);setPathWidth(data.width);setPathHeight(data.height);
    setPathThickness(data.wallThickness);setPathSmooth(data.smooth??true);setPathQuality(data.subdivisions??6);
    setRailwayEnabled(!!data.railway);setRailway(data.railway??defaultRailwaySettings());
    setRepeatSpacing(data.repeatSpacing??96);setCableSag(data.cableSag??32);setCableCount(data.cableCount??1);setCableSpacing(data.cableSpacing??16);setSidewalkWidth(data.sidewalkWidth??0);setCurbHeight(data.curbHeight??8);
    if((['vent','pipe','cable','cave'] as PathStructureKind[]).includes(data.kind))setPathView3D(true);
    setDraft(d=>({...d,origin:[...group.origin],texture:data.texture}));
    const points=data.points.map(point=>point.map((v,axis)=>v-group.origin[axis]) as Vec3);
    pathUndo.current=[];pathRedo.current=[];pathLatest.current=points;setPathPoints(points);setActivePoint(Math.min(1,points.length-1));
    setMessage(t('Route loaded for editing. Updating it will regenerate the original brushes.'));
  };
  const initialRouteSelection=useRef<string|null>(null);
  useEffect(()=>{
    const selectedRoute=existingPaths.find(group=>group.brushIds.includes(selected||''));
    if(initialTab==='curves'||!selectedRoute||initialRouteSelection.current===selectedRoute.id)return;
    initialRouteSelection.current=selectedRoute.id;
    setTab('paths');loadPath(selectedRoute.id);
  },[selected,existingPaths]);
  const applyPathUpdate=()=>{
    if(!editingPathId||compileBusy)return;
    try{updatePathStructure(editingPathId,pathOptions);setMessage(t('Route updated. Undo in MAP Editor restores the previous geometry.'));}
    catch(error){setMessage(String(error instanceof Error?error.message:error));}
  };
  const placeOnMap=()=>{
    if(compileBusy)return;
    try{
      if(tab==='paths'){
        if(pathPreview.error)throw Error(pathPreview.error);
        startTerrainPlacement({kind:'path',draft,path:pathOptions});
      }else if(tab==='terrain'){
        const errors=validateTerrainDraft(draft);if(errors.length)throw Error(errors.join(' · '));
        startTerrainPlacement({kind:'terrain',draft});
      }else{
        startTerrainPlacement({kind:'rocks',draft,rocks:{count:rockCount,radius:rockRadius,height:rockHeight,seed}});
      }
      onClose();
    }catch(error){setMessage(String(error));}
  };
  const issues=useMemo(()=>validateTerrainDraft(draft),[draft]);
  const count=useMemo(()=>terrainBrushCount(draft),[draft]);
  const bottomOffset=terrainBaseZ(draft)-draft.origin[2];
  const baseMode:TerrainBaseMode=draft.baseMode??'solid';
  const selectBaseMode=(mode:TerrainBaseMode)=>{
    setDraft(d=>({...d,baseMode:mode,
      excludedCells:mode!=='thin'?undefined:d.excludedCells,
      customBaseOffset:mode==='custom'?Math.min(d.customBaseOffset??-192,Math.min(...d.heights)-8):d.customBaseOffset}));
    setShowBase(mode!=='thin');setMessage('');
  };
  const rockBrushes=useMemo(()=>{
    try{return createRockCluster({origin:[0,0,0],count:rockCount,radius:rockRadius,height:rockHeight,seed,texture:draft.texture});}
    catch{return [] as Brush[];}
  },[rockCount,rockRadius,rockHeight,seed,draft.texture]);
  const setNumber=(key:'width'|'depth',value:number)=>setDraft(d=>({...d,[key]:Number.isFinite(value)?value:d[key]}));
  const setOrigin=(i:number,value:number)=>setDraft(d=>({...d,origin:d.origin.map((v,j)=>i===j&&Number.isFinite(value)?value:v) as Vec3}));
  const paint=(x:number,y:number)=>{
    try{setDraft(d=>{const next={...d,heights:sculptTerrain(d,tool,x,y,radius,strength/6)};terrainCurrent.current=next;return next;});setMessage('');}
    catch(err){setMessage(String(err instanceof Error?err.message:err));}
  };
  const loadTerrain=(id:string)=>{
    const g=existing?.find(g=>g.id===id);if(!g)return;
    resetHeightHistory();setSelectedVertex(null);setShowBase((g.baseMode??'solid')!=='thin');setDraft({id:g.id,name:g.name,origin:[...g.origin],width:g.width,depth:g.depth,resolution:g.resolution,heights:[...g.heights],texture:g.texture,baseDepth:g.baseDepth??96,baseMode:g.baseMode??'solid',surfaceThickness:g.surfaceThickness??16,customBaseOffset:g.customBaseOffset??-192,hideUnderside:g.hideUnderside??true,excludedCells:g.excludedCells?[...g.excludedCells]:undefined,diagonalFlips:g.diagonalFlips?[...g.diagonalFlips]:undefined,optimized:g.optimized??false});
    setMessage(t('Loaded terrain for editing. Existing geometry will be checked before replacement.'));
  };
  const apply=()=>{
    try{
      const objects=createTerrainBrushes(draft,record?.brushIds);
      if(objects.length>512)throw Error('Terrain brush limit exceeded.');
      applyTerrain(draft);setMessage(`${objects.length} ${t('convex brushes added or safely updated. Use Undo to revert.')}`);
    }catch(err){setMessage(String(err instanceof Error?err.message:err));}
  };
  const useSelection=()=>{
    const obj=objects.find(o=>o.id===selected);if(!obj){setMessage(t('Select an object in the map first.'));return;}
    let pos:[number,number,number]=[...obj.position];
    if(obj.kind==='brush'){
      const pts=transformedVertices(obj);
      pos=[obj.position[0],obj.position[1],Math.max(...pts.map(p=>p[2]))];
    }
    setOrigin(0,pos[0]);setOrigin(1,pos[1]);setOrigin(2,pos[2]);setMessage(t('Placement position copied from selection.'));
  };
  return <div className="modal-backdrop terrain-backdrop" onMouseDown={onClose}>
    <section className={`terrain-shell world-builder-shell${expandedStudio?' terrain-shell-expanded':''}${tab==='paths'&&focusRoute?' terrain-route-focus':''}${tab==='terrain'&&focusTerrain?' wb-terrain-focus':''}`} role="dialog" aria-modal="true" aria-label={t("World Builder Studio")} onMouseDown={e=>e.stopPropagation()}>
      <header className="terrain-header"><Mountain size={23}/><div><strong>{t('World Builder Studio')}</strong><small>{t('Convex brush geometry · Sven Co-op / Svengine')}</small></div>
        {<button className="terrain-expand-button" title={expandedStudio?t('Restore editor size'):t('Maximize World Builder Studio')} aria-label={expandedStudio?t('Restore editor size'):t('Maximize World Builder Studio')} onClick={()=>setExpandedStudio(v=>!v)}>{expandedStudio?<Minimize2 size={18}/>:<Maximize2 size={18}/>}</button>}
        <button title={t('Close')} onClick={onClose}><X size={20}/></button>
      </header>
      <div className="terrain-tabs" role="tablist" aria-label={t("World Builder Studio")}><button role="tab" aria-selected={tab==='terrain'} className={tab==='terrain'?'active':''} onClick={()=>{setTab('terrain');setMessage('')}}>{t('Sculpt Terrain')}</button><button role="tab" aria-selected={tab==='rocks'} className={tab==='rocks'?'active':''} onClick={()=>{setTab('rocks');setMessage('')}}>{t('Rock & Cliff Generator')}</button><button role="tab" aria-selected={tab==='paths'} className={tab==='paths'?'active':''} onClick={()=>{setTab('paths');setMessage('')}}>{t('Path & Structure Studio')}</button><button role="tab" aria-selected={tab==='curves'} className={tab==='curves'?'active':''} onClick={()=>{setTab('curves');setMessage('')}}>{t('Curves & Repetitions')}</button></div>
      {tab==='curves'?<CurvedGeometryPanel embedded onClose={()=>setTab('paths')}/>:<div className="terrain-layout">
        <aside className="terrain-tools">
          {tab==='terrain'&&<nav className="wb-section-nav" aria-label={t('World Builder tools')}>
            {([['wb-landscapes','Landscapes'],['wb-landforms','Landforms'],['wb-precision','Precision'],['wb-textures','Textures']] as const).map(([id,label])=><button key={id} type="button" onClick={()=>document.getElementById(id)?.scrollIntoView({block:'nearest',behavior:'smooth'})}>{t(label)}</button>)}
          </nav>}
          {tab==='terrain'&&<>
            <section id="wb-landscapes" className="wb-section" aria-label={t('Landscape Generator')}>
              <div className="wb-section-title"><strong>{t('Landscape Generator')}</strong><small>{t('Editable relief · GoldSrc-compatible brushes')}</small></div>
              <label>{t('Landscape type')}
                <select value={worldPreset} onChange={e=>setWorldPreset(e.target.value as WorldPreset)}>
                  <option value="flat">{t('Flat')}</option><option value="hills">{t('Hills')}</option><option value="mountains">{t('Mountains')}</option>
                  <option value="valley">{t('Valley')}</option><option value="canyon">{t('Canyon')}</option><option value="island">{t('Island')}</option>
                  <option value="crater">{t('Crater')}</option><option value="dunes">{t('Dunes')}</option><option value="plateau">{t('Plateau')}</option>
                </select>
              </label>
              <div className="terrain-inline">
                <label>{t('Elevation')} <output>{worldAmplitude} u</output><input type="range" min="0" max="512" step="8" value={worldAmplitude} onChange={e=>setWorldAmplitude(+e.target.value)}/></label>
                <label>{t('Seed')}<input type="number" step="1" value={worldSeed} onChange={e=>setWorldSeed(Number.isFinite(e.target.valueAsNumber)?Math.round(e.target.valueAsNumber):worldSeed)}/></label>
              </div>
              <button className="terrain-secondary wb-accent" type="button" onClick={generatePreset}>{t('Generate landscape preview')}</button>
              <p className="terrain-muted">{t('Only preview elevations are replaced. Your map stays unchanged until Apply or Place.')}</p>
            </section>
            <section className="wb-section" aria-label={t('Heightmap (image)')}>
              <div className="wb-section-title"><strong>{t('Heightmap (image)')}</strong><small>PNG · JPEG · WebP</small></div>
              <div className="terrain-inline"><label>{t('Dark pixel elevation (u)')}<input type="number" min="-512" max="511" step="8" value={heightmapMin} onChange={e=>setHeightmapMin(Number.isFinite(e.target.valueAsNumber)?e.target.valueAsNumber:heightmapMin)}/></label>
              <label>{t('Bright pixel elevation (u)')}<input type="number" min="-511" max="512" step="8" value={heightmapMax} onChange={e=>setHeightmapMax(Number.isFinite(e.target.valueAsNumber)?e.target.valueAsNumber:heightmapMax)}/></label></div>
              <label className="wb-check"><input type="checkbox" checked={heightmapInvert} onChange={e=>setHeightmapInvert(e.target.checked)}/> {t('Invert bright and dark elevations')}</label>
              <label className="wb-upload">{t('Import heightmap image')}<input type="file" accept="image/png,image/jpeg,image/webp" onChange={importHeightmap}/></label>
              <button className="terrain-secondary" type="button" onClick={exportHeightmap}>{t('Export terrain heightmap PNG')}</button>
            </section>
            <section className="wb-section" aria-label={t('Terrain Editing Tools')}>
              <div className="wb-section-title"><strong>{t('Terrain Editing Tools')}</strong><small>{t('Project remains unchanged until Apply')}</small></div>
              <div className="wb-tool-grid">
                <button type="button" onClick={()=>applyHeightTransform('smooth')}>{t('Smooth')}</button>
                <button type="button" onClick={()=>applyHeightTransform('terrace')}>{t('Terrace')}</button>
                <button type="button" onClick={()=>applyHeightTransform('normalize')}>{t('Center elevations')}</button>
                <button type="button" onClick={()=>applyHeightTransform('rotate90')}>{t('Rotate 90°')}</button>
                <button type="button" onClick={()=>applyHeightTransform('mirrorX')}>{t('Mirror X')}</button>
                <button type="button" onClick={()=>applyHeightTransform('mirrorY')}>{t('Mirror Y')}</button>
              </div>
              <label>{t('Terrace step')} <output>{terraceStep} u</output><input type="range" min="4" max="128" step="4" value={terraceStep} onChange={e=>setTerraceStep(+e.target.value)}/></label>
              <div className="wb-history-actions">
                <button type="button" disabled={terrainUndo.current.length===0} onClick={()=>restoreHeights(true)}><Undo2 size={16}/> {t('Undo heights')}</button>
                <button type="button" disabled={terrainRedo.current.length===0} onClick={()=>restoreHeights(false)}><Redo2 size={16}/> {t('Redo heights')}</button>
              </div>
            </section>
            <section id="wb-landforms" className="wb-section" aria-label={t('Advanced landforms')}>
              <div className="wb-section-title"><strong>{t('Advanced landforms')}</strong><small>{t('Flowing ridges, riverbeds and layered cliffs from the terrain guide')}</small></div>
              <label>{t('Landform type')}<select value={feature} onChange={e=>setFeature(e.target.value as WorldFeature)}>
                <option value="ridge">{t('Mountain ridge')}</option><option value="riverbed">{t('Riverbed / trench')}</option><option value="cliff">{t('Escarpment / cliff')}</option>
              </select></label>
              <div className="terrain-inline">
                <label>{t('Landform height')}<input type="number" min="8" max="256" step="8" value={featureHeight} onChange={e=>setFeatureHeight(Number.isFinite(e.target.valueAsNumber)?e.target.valueAsNumber:80)}/></label>
                <label>{t('Landform width')}<input type="number" min="16" max="2048" step="16" value={featureWidth} onChange={e=>setFeatureWidth(Number.isFinite(e.target.valueAsNumber)?e.target.valueAsNumber:128)}/></label>
              </div>
              <label>{t('Direction')}<select value={featureDirection} onChange={e=>setFeatureDirection(e.target.value as 'x'|'y')}><option value="x">X</option><option value="y">Y</option></select></label>
              <button type="button" className="terrain-secondary wb-accent" onClick={makeLandform}>{t('Add landform to preview')}</button>
              <p className="terrain-muted">{t('Surface relief only. For walkable underground passages, use Cave Tunnel under Paths & Structures.')}</p>
            </section>
            <div id="wb-precision" className="wb-section-title wb-project-heading"><strong>{t('Terrain Properties')}</strong><small>{t('Group editing and placement')}</small></div>
            <label>{t('Terrain group')}
              <select value={record?.id||'new'} onChange={e=>{
                if(e.target.value==='new'){resetHeightHistory();setShowBase(false);setSelectedVertex(null);setDraft({...defaultTerrain(draft.origin),optimized:true,name:`Terrain ${String((existing?.length||0)+1).padStart(2,'0')}`});setMessage('');}else loadTerrain(e.target.value);
              }}><option value="new">{t('New terrain')}</option>{(existing||[]).map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select>
            </label>
            <label>{t('Name')}<input maxLength={48} value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value||'Terrain'}))}/></label>
            <div className="terrain-inline">
              <label>{t('Width')}<input type="number" min="64" max="4096" step="32" value={draft.width} onChange={e=>setNumber('width',e.target.valueAsNumber)}/></label>
              <label>{t('Depth')}<input type="number" min="64" max="4096" step="32" value={draft.depth} onChange={e=>setNumber('depth',e.target.valueAsNumber)}/></label>
            </div>
            <section className="wb-depth-panel" aria-label={t('Terrain geometry mode')}>
              <strong>{t('Terrain geometry mode')}</strong>
              <div className="wb-depth-modes" role="group" aria-label={t('Terrain geometry mode')}>
                {(['thin','solid','custom'] as TerrainBaseMode[]).map(mode=><button type="button" key={mode}
                  aria-pressed={baseMode===mode} className={baseMode===mode?'active':''} onClick={()=>selectBaseMode(mode)}>
                  {t(mode==='thin'?'Thin surface':mode==='solid'?'Solid base':'Custom base')}
                </button>)}
              </div>
              {baseMode==='thin'?<>
                <label>{t('Surface thickness (units)')} <output>{draft.surfaceThickness??16} u</output>
                  <input type="range" min="8" max="128" step="2" value={draft.surfaceThickness??16}
                    onChange={e=>setDraft(d=>({...d,surfaceThickness:+e.target.value}))}/>
                </label>
                <label className="wb-depth-check"><input type="checkbox" checked={draft.hideUnderside!==false}
                  onChange={e=>setDraft(d=>({...d,hideUnderside:e.target.checked}))}/>{t('Hide underside and sides with NULL texture')}</label>
                <p className="terrain-muted">{t('Only the top is visible in-game; each slope remains a closed convex brush for collision. Does not seal a map by itself.')}</p>
              </>:baseMode==='solid'?<>
                <label>{t('Base depth (units)')} <output>{draft.baseDepth??96} u</output>
                  <input type="range" min="64" max="1024" step="16" value={draft.baseDepth??96} onChange={e=>setDraft(d=>({...d,baseDepth:+e.target.value}))}/>
                </label>
                <p className="terrain-muted">{t('Base extends below the terrain. Deep valleys require an extra 64 units of clearance.')}</p>
              </>:<>
                <label>{t('Base Z relative to placement (units)')}
                  <input type="number" min="-2048" max="512" step="8" value={draft.customBaseOffset??-192}
                    onChange={e=>setDraft(d=>({...d,customBaseOffset:Number.isFinite(e.target.valueAsNumber)?e.target.valueAsNumber:d.customBaseOffset}))}/>
                </label>
                <p className="terrain-muted">{t('The custom base must stay at least 8 units below the lowest terrain point.')}</p>
              </>}
            </section>
            <label>{t('Grid resolution')}
              <select value={draft.resolution} onChange={e=>{
                const n=Number(e.target.value);resetHeightHistory();setSelectedVertex(null);setDraft(d=>({...d,resolution:n,heights:resample(d.heights,d.resolution,n),excludedCells:undefined,diagonalFlips:undefined}));
              }}>{[4,8,12,16].map(n=><option key={n} value={n}>{n}×{n}</option>)}</select>
            </label>
            <label className="terrain-muted"><input type="checkbox" checked={!!draft.optimized} onChange={e=>setDraft(d=>({...d,optimized:e.target.checked}))}/>{' '}{t('Optimize planar terrain brushes')}</label>
            <p className="terrain-muted">{t('Merge coplanar cells into fewer closed convex brushes. Existing terrain keeps its original mode until you enable it.')}</p>
            <div className="terrain-modes">{(['raise','lower','smooth','flatten','noise'] as TerrainTool[]).map(m=><button key={m} className={tool===m?'active':''} onClick={()=>{setTool(m);setSculptMode(true)}}>{t(m[0].toUpperCase()+m.slice(1))}</button>)}</div>
            <label>{t('Brush radius')} <output>{radius} u</output><input type="range" min="32" max="512" step="16" value={radius} onChange={e=>setRadius(+e.target.value)}/></label>
            <label>{t('Brush strength')} <output>{strength}</output><input type="range" min="2" max="96" step="2" value={strength} onChange={e=>setStrength(+e.target.value)}/></label>
            {selectedVertex!==null&&vertexMode&&<section className="wb-section wb-vertex-precision" aria-label={t('Selected vertex')}>
              <strong>{t('Selected vertex')} #{selectedVertex+1}</strong>
              <label>{t('Vertex height (u)')}<input type="number" min="-512" max="512" step="2" value={draft.heights[selectedVertex]??0} onChange={e=>{if(Number.isFinite(e.target.valueAsNumber)&&e.target.valueAsNumber!==draft.heights[selectedVertex]){snapshotHeights();moveTerrainVertex(selectedVertex,e.target.valueAsNumber)}}}/></label>
              <p className="terrain-muted">{t('Drag large cyan handles vertically, or enter an exact height. Undo with Ctrl+Z.')}</p>
            </section>}
            <button className="terrain-secondary" onClick={()=>applyHeights(Array((draft.resolution+1)**2).fill(0),"Terrain flattened in preview.")}><RotateCcw size={15}/>{t('Flatten entire preview')}</button>
          </>}
          {tab==='rocks'&&<>
            <p className="terrain-muted">{t('Convex rock brushes with a reproducible seed. No models or Source displacements.')}</p>
            <label>{t('Rocks')} <output>{rockCount}</output><input type="range" min="1" max="24" value={rockCount} onChange={e=>setRockCount(+e.target.value)}/></label>
            <label>{t('Cluster radius')} <output>{rockRadius} u</output><input type="range" min="16" max="512" step="16" value={rockRadius} onChange={e=>setRockRadius(+e.target.value)}/></label>
            <label>{t('Rock height')} <output>{rockHeight} u</output><input type="range" min="16" max="512" step="16" value={rockHeight} onChange={e=>setRockHeight(+e.target.value)}/></label>
            <label>{t('Random seed')}<input type="number" value={seed} step="1" onChange={e=>setSeed(Number.isFinite(e.target.valueAsNumber)?e.target.valueAsNumber:0)}/></label>
          </>}
          {tab==='paths'&&<>
            <label>{t('Saved editable routes')}
              <select value={editingPathId||''} onChange={e=>loadPath(e.target.value)}>
                <option value="">{t('New route')}</option>
                {existingPaths.map(item=><option key={item.id} value={item.id}>{item.options.name||item.options.kind} · {item.brushIds.length} {t('brushes')}</option>)}
              </select>
            </label>
            {editingPathId&&<p className="terrain-muted">{t('This route is stored in the project. Edited or deleted source brushes cannot be replaced automatically.')}</p>}
            {editingPathId&&<button type="button" className="terrain-secondary wb-route-copy" onClick={copySavedRoute}>{t('Reuse points as a new structure')}</button>}
            <p className="terrain-muted">{t('One editable route can be reused for roads, walkways, tunnels, railways or bridges: load a saved route, copy its points, then choose a new type. Existing brushes stay untouched.')}</p>
            {editingPathId&&existingPaths.find(p=>p.id===editingPathId)?.integratedTerrainId&&<p className="terrain-warning">{t('This route is linked to terrain. Editing only the route is blocked; create a new route for a new integration.')}</p>}
            <p className="terrain-muted">{t('Draw the route with points, drag the orange handles to shape bends, then place the result in your map.')}</p>
            <label>{t('Structure type')}<select value={pathKind} onChange={e=>{const kind=e.target.value as PathStructureKind;setPathKind(kind);if(kind==='cable'){setPathWidth(8);setPathView3D(true);}else if((['pipe','vent','cave'] as PathStructureKind[]).includes(kind)){if(pathKind==='cable')setPathWidth(96);setPathView3D(true);}}}>
              <option value="road">{t('Road Builder · smooth road')}</option>
              <option value="walkway">{t('Elevated walkway')}</option>
              <option value="vent">{t('Rectangular ventilation duct')}</option>
              <option value="pipe">{t('Octagonal hollow pipe')}</option>
              <option value="cave">{t('Cave tunnel (walkable)')}</option>
              <option value="cable">{t('Suspended cables (3D)')}</option>
              <option value="rail">{t('Railway tracks & sleepers')}</option>
              <option value="fence">{t('Fence & barrier line')}</option>
              <option value="bridge">{t('Bridge & catwalk with supports')}</option>
            </select></label>
            <label>{t(pathKind==='cable'?'Cable diameter':'Profile width')} <output>{pathWidth} u</output><input type="range" min={pathKind==='cable'?4:16} max={pathKind==='cable'?32:384} step={pathKind==='cable'?2:8} value={pathWidth} onChange={e=>setPathWidth(+e.target.value)}/></label>
            {(['vent','pipe','cave','fence','bridge'] as PathStructureKind[]).includes(pathKind)&&<label>{t(pathKind==='fence'?'Fence height':pathKind==='bridge'?'Bridge support depth':'Duct / pipe height')} <output>{pathHeight} u</output><input type="range" min="16" max="256" step="8" value={pathHeight} onChange={e=>setPathHeight(+e.target.value)}/></label>}
            {(['rail','fence','bridge'] as PathStructureKind[]).includes(pathKind)&&<label>{t('Support / sleeper spacing')} <output>{repeatSpacing} u</output><input type="range" min="32" max="320" step="16" value={repeatSpacing} onChange={e=>setRepeatSpacing(+e.target.value)}/></label>}
            {pathKind==='rail'&&<div className="railway-builder-controls">
              <strong>{t('Railway Builder 2.0')}</strong>
              <p className="terrain-muted">{t('Create native Sven Co-op path_track links, stations, a basic turnout and an optional controllable train template.')}</p>
              <label className="terrain-muted"><input type="checkbox" checked={railwayEnabled} onChange={e=>setRailwayEnabled(e.target.checked)}/>{' '}{t('Generate railway gameplay network')}</label>
              {railwayEnabled&&<>
                <label>{t('Unique railway ID')}<input type="text" spellCheck={false} maxLength={23} value={railway.prefix} onChange={e=>editRailway('prefix',e.target.value.toLowerCase().replace(/[^a-z0-9_]/g,''))}/></label>
                <button type="button" className="terrain-secondary" onClick={()=>editRailway('prefix',defaultRailwaySettings().prefix)}>{t('Generate a new network ID')}</button>
                <label className="terrain-muted"><input type="checkbox" checked={!!railway.doubleTrack} onChange={e=>editRailway('doubleTrack',e.target.checked)}/>{' '}{t('Parallel second track')}</label>
                {railway.doubleTrack&&<label>{t('Track separation')} <output>{railway.parallelSpacing??192} u</output><input type="range" min="96" max="512" step="16" value={railway.parallelSpacing??192} onChange={e=>editRailway('parallelSpacing',+e.target.value)}/></label>}
                <label className="terrain-muted"><input type="checkbox" checked={!!railway.branch} onChange={e=>editRailway('branch',e.target.checked)}/>{' '}{t('Branch / turnout')}</label>
                {railway.branch&&<>
                  <label>{t('Turnout control point')}<select value={Math.min(railway.branchNode??0,pathPoints.length-2)} onChange={e=>editRailway('branchNode',+e.target.value)}>{pathPoints.slice(0,-1).map((_,i)=><option key={i} value={i}>{t('Point')} {i+1}</option>)}</select></label>
                  <label>{t('Branch direction')}<select value={railway.branchSide??'left'} onChange={e=>editRailway('branchSide',e.target.value as 'left'|'right')}><option value="left">{t('Left')}</option><option value="right">{t('Right')}</option></select></label>
                  <p className="terrain-muted">{t('A func_button toggles path_track.altpath. The visual turnout is experimental and must be checked in the game.')}</p>
                </>}
                <label className="terrain-muted"><input type="checkbox" checked={!!railway.station} onChange={e=>editRailway('station',e.target.checked)}/>{' '}{t('Add station platform')}</label>
                {railway.station&&<>
                  <label>{t('Station control point')}<select value={Math.min(railway.stationNode??0,pathPoints.length-1)} onChange={e=>editRailway('stationNode',+e.target.value)}>{pathPoints.map((_,i)=><option key={i} value={i}>{t('Point')} {i+1}</option>)}</select></label>
                  <label>{t('Platform side')}<select value={railway.stationSide??'right'} onChange={e=>editRailway('stationSide',e.target.value as 'left'|'right')}><option value="left">{t('Left')}</option><option value="right">{t('Right')}</option></select></label>
                  <label>{t('Platform length')} <output>{railway.platformLength??192} u</output><input type="range" min="64" max="512" step="16" value={railway.platformLength??192} onChange={e=>editRailway('platformLength',+e.target.value)}/></label>
                  <label>{t('Platform width')} <output>{railway.platformWidth??96} u</output><input type="range" min="48" max="256" step="16" value={railway.platformWidth??96} onChange={e=>editRailway('platformWidth',+e.target.value)}/></label>
                  <label className="terrain-muted"><input type="checkbox" checked={!!railway.stationStop} onChange={e=>editRailway('stationStop',e.target.checked)}/>{' '}{t('Stop train at platform (newspeed 0)')}</label>
                </>}
                <label className="terrain-muted"><input type="checkbox" checked={!!railway.train} onChange={e=>{editRailway('train',e.target.checked);if(e.target.checked)setPathView3D(true)}}/>{' '}{t('Create func_tracktrain template')}</label>
                {railway.train&&<>
                  <label>{t('Maximum train speed')} <output>{railway.trainSpeed??180} u/s</output><input type="range" min="16" max="800" step="16" value={railway.trainSpeed??180} onChange={e=>editRailway('trainSpeed',+e.target.value)}/></label>
                  <label>{t('Train length')} <output>{railway.trainLength??96} u</output><input type="range" min="48" max="256" step="16" value={railway.trainLength??96} onChange={e=>editRailway('trainLength',+e.target.value)}/></label>
                  <label className="terrain-muted"><input type="checkbox" checked={railway.trainControls!==false} onChange={e=>editRailway('trainControls',e.target.checked)}/>{' '}{t('Add player train controls')}</label>
                  <label>{t('Train movement preview (approximate)')} <output>{railPreviewPct}%</output><input type="range" min="0" max="100" step="1" value={railPreviewPct} onChange={e=>{setRailPreviewPct(+e.target.value);setPathView3D(true)}}/></label>
                <p className="terrain-muted">{t('Visual train preview does not simulate gameplay physics.')}</p>
                  <p className="terrain-muted">{t('Train starts stopped and uses an ORIGIN brush. Validate orientation and player controls in Sven Co-op.')}</p>
                </>}
              </>}
            </div>}
            {(['road','walkway','cave'] as PathStructureKind[]).includes(pathKind)&&<section className="wb-smart-panel" aria-label={t('Smart World Integration')}>
              <header><strong>{t('Smart World Integration')}</strong><small>v1.9.3</small></header>
              <p className="terrain-muted">{t('Connect a NEW road or cave to a saved terrain. Geometry is previewed before one atomic MAP transaction.')}</p>
              <label>{t('Target saved terrain')}
                <select value={smartTerrainId} onChange={e=>{setSmartTerrainId(e.target.value);if(e.target.value)setPathView3D(true);setMessage('')}}>
                  <option value="">{t('Manual route (no terrain changes)')}</option>
                  {(existing||[]).map(group=><option key={group.id} value={group.id}>{group.name} · {group.resolution}×{group.resolution}</option>)}
                </select>
              </label>
              {smartTerrain&&<>
                <button type="button" className="terrain-secondary" onClick={centerSmartRoute}>{t('Center new route on terrain')}</button>
                {pathKind!=='cave'&&<label>{t('Terrain shoulder blend')} <output>{smartShoulder} u</output>
                  <input type="range" min="16" max="512" step="16" value={smartShoulder} onChange={e=>setSmartShoulder(+e.target.value)}/></label>}
                <label>{t('Road rise / cave roof clearance')} <output>{smartClearance} u</output>
                  <input type="range" min="4" max="128" step="4" value={smartClearance} onChange={e=>setSmartClearance(+e.target.value)}/></label>
                {smartPreview.error?<p role="alert" className="terrain-warning">{t('Integration blocked')}: {t(smartPreview.error)}</p>:
                  smartPreview.plan&&<>
                    <div className="wb-smart-metrics">
                      <span>{t('Adjusted terrain vertices')}<strong>{smartPreview.plan.changedVertices}</strong></span>
                      <span>{t('Opened surface cells')}<strong>{smartPreview.plan.openedCells}</strong></span>
                      <span>{t('Resulting terrain brushes')}<strong>{terrainBrushCount(smartPreview.plan.terrain)}</strong></span>
                      <span>{t('Resulting path brushes')}<strong>{pathPreview.brushes.length}</strong></span>
                    </div>
                    {smartPreview.plan.warnings.map((w,i)=><p key={i} className="terrain-info">{t(w)}</p>)}
                  </>}
                <button type="button" className="terrain-secondary wb-smart-apply" disabled={!smartPreview.plan||!!smartPreview.error||!!pathPreview.error||!!editingPathId||compileBusy} onClick={commitSmartWorld}>
                  {t('Integrate terrain and path (one Undo)')}
                </button>
                {pathKind==='cave'&&<p className="terrain-muted">{t('Cave portals only remove thin-surface terrain cells near entrances; surrounding solids are never subtracted. Test access, VIS, collisions and leaks.')}</p>}
              </>}
              {!existing?.length&&<p className="terrain-muted">{t('Apply a World Builder terrain to the MAP editor first.')}</p>}
            </section>}
            {pathKind==='cave'&&<p className="terrain-info">{t('Cave Tunnel creates a convex hollow arched shell with a walkable flat floor. It does NOT automatically excavate surrounding world brushes. Connect portals manually and verify leaks, collisions and VIS in-game.')}</p>}
            {pathKind==='cable'&&<>
              <label>{t('Cable droop between anchors')} <output>{cableSag} u</output><input type="range" min="0" max="256" step="8" value={cableSag} onChange={e=>setCableSag(+e.target.value)}/></label>
              <label>{t('Parallel cable strands')} <output>{cableCount}</output><input type="range" min="1" max="4" step="1" value={cableCount} onChange={e=>setCableCount(+e.target.value)}/></label>
              {cableCount>1&&<label>{t('Cable strand spacing')} <output>{cableSpacing} u</output><input type="range" min="4" max="64" step="4" value={cableSpacing} onChange={e=>setCableSpacing(+e.target.value)}/></label>}
              <p className="terrain-muted">{t('Cable droop is simulated between anchor points. The finished cable uses closed, six-sided GoldSrc brushes.')}</p>
            </>}
            {pathKind!=='cable'&&<label>{t('Wall / floor thickness')} <output>{pathThickness} u</output><input type="range" min="2" max="32" step="2" value={pathThickness} onChange={e=>setPathThickness(+e.target.value)}/></label>}
            {(['pipe','vent','cave'] as PathStructureKind[]).includes(pathKind)&&<p className="terrain-muted">{t('3D sweep: the duct profile rotates with the XYZ route. Tight bends may require convex brush subdivisions.')}</p>}
            {pathKind==='road'&&<>
              <label>{t('Sidewalk width')} <output>{sidewalkWidth} u</output><input type="range" min="0" max="96" step="8" value={sidewalkWidth} onChange={e=>setSidewalkWidth(+e.target.value)}/></label>
              {sidewalkWidth>0&&<label>{t('Curb height')} <output>{curbHeight} u</output><input type="range" min="0" max="24" step="2" value={curbHeight} onChange={e=>setCurbHeight(+e.target.value)}/></label>}
            </>}
            <label className="terrain-muted"><input type="checkbox" checked={pathSmooth} onChange={e=>setPathSmooth(e.target.checked)}/>{' '}{t('Smooth curves (centripetal spline)')}</label>
            {pathSmooth&&<label>{t('Curve detail')} <output>{pathQuality}</output><input type="range" min="1" max="16" step="1" value={pathQuality} onChange={e=>setPathQuality(+e.target.value)}/></label>}
            <p className="terrain-muted">{t('Select a control point to change its height. Right-click a point to remove it.')} · {t('Elevation profile')}: X/Y → Z</p>
            {pathPoints[activePoint]&&<label>{t('Selected point height')} <input type="number" step="8" value={pathPoints[activePoint][2]} onChange={e=>{if(Number.isFinite(e.target.valueAsNumber))editPath(pathLatest.current.map((p,i)=>i===activePoint?[p[0],p[1],e.target.valueAsNumber] as Vec3:p));}}/></label>}
            <div className="terrain-inline"><button className="terrain-secondary" onClick={insertPoint} disabled={pathPoints.length>=48}>{t('Insert midpoint')}</button><button className="terrain-secondary" onClick={()=>editPath(pathLatest.current.filter((_,i)=>i!==activePoint))} disabled={pathPoints.length<=2}>{t('Remove selected point')}</button></div>
            <div className="terrain-inline"><button className="terrain-secondary" onClick={undoPath} disabled={!pathUndo.current.length}>{t('Undo')} · Ctrl+Z</button><button className="terrain-secondary" onClick={redoPath} disabled={!pathRedo.current.length}>{t('Redo')} · Ctrl+Y</button></div><div className="terrain-inline"><button className="terrain-secondary" onClick={()=>editPath([[-160,-80,0],[0,60,0],[160,-80,0]])}>{t('Reset route')}</button><button className="terrain-secondary" onClick={()=>editPath(pathLatest.current.slice(0,-1))} disabled={pathPoints.length<=2}>{t('Undo last point')}</button></div>
          </>}
          <div className="terrain-separator"/>
          <div id="wb-textures" className="terrain-textures-head"><strong>{t('GoldSrc texture')}</strong><span>{availableTextures.length} · WAD</span></div>
          <label><input maxLength={32} aria-label={t('GoldSrc texture')} value={draft.texture} onChange={e=>setDraft(d=>({...d,texture:e.target.value.toUpperCase()}))}/></label>
          <div className="terrain-textures-controls">
            <label className="terrain-texture-filter"><Search size={12}/><input aria-label={t('Search textures...')} placeholder={t('Search textures...')} value={textureSearch} onChange={e=>setTextureSearch(e.target.value)}/></label>
            <select aria-label={t('Filter WAD')} value={wadFilter} onChange={e=>setWadFilter(e.target.value)}><option value="all">{t('All WAD files')}</option>{wadNames.map(wad=><option key={wad} value={wad}>{wad}</option>)}</select>
          </div>
          <div className="terrain-textures-grid" role="list" aria-label="Texturas disponibles">
            {shownTextures.map(asset=><button type="button" role="listitem" title={`${asset.name} · ${asset.wad}`} key={`${asset.wad}:${asset.name}`} className={draft.texture.toLowerCase()===asset.name.toLowerCase()?'selected':''} onClick={()=>setDraft(d=>({...d,texture:asset.name}))}>
              <img src={asset.url} loading="lazy" alt=""/><small>{asset.name}</small>
            </button>)}
            {!shownTextures.length&&<p>{t('No matching textures.')}</p>}
          </div>
          <label className="terrain-wad-import"><ImageIcon size={13}/> {importingWad?t('Importing WAD...'):t('Import WAD file')}<input type="file" accept=".wad" multiple disabled={importingWad} onChange={importWad}/></label>
          <button className="terrain-secondary" onClick={()=>setDraft(d=>({...d,texture:texture||d.texture}))}>{t('Use selected WAD texture')}</button>
          {!previewTexture&&<p className="terrain-muted">{t('Texture preview unavailable. Import the matching WAD.')}</p>}
          {tab==='paths'?<div className="terrain-info terrain-placement-hint"><MousePointer2 size={16}/><span>{t('Choose the placement point in the MAP viewport. The route will not be created at world origin.')}</span></div>:<>
            <label>{t('Placement center (X / Y / Z)')}</label>
            <div className="terrain-inline three">{draft.origin.map((v,i)=><input aria-label={['X','Y','Z'][i]} key={i} type="number" value={v} step="16" onChange={e=>setOrigin(i,e.target.valueAsNumber)}/>)}</div>
            <button className="terrain-secondary" onClick={useSelection}><MousePointer2 size={14}/>{t('Use selected object position')}</button>
          </>}
        </aside>
        <main className="terrain-preview">
          <div className="terrain-preview-head">
            <span>{t('Interactive preview')} <small>· {tab==='terrain'?`${count} ${t('brushes')}`:tab==='rocks'?`${rockCount} ${t('rocks')}`:`${pathPreview.brushes.length} ${t('brushes')}`}</small></span>
            {tab==='paths'&&<div className="terrain-preview-actions">
              <button className={!pathView3D?'active':''} onClick={()=>{setPathView3D(false);setEditIn3D(false)}}>{t('Edit route')}</button>
              <button className={pathView3D&&!editIn3D?'active':''} onClick={()=>{setPathView3D(true);setEditIn3D(false)}}>{t('3D geometry preview')}</button>
              <button className={pathView3D&&editIn3D?'active':''} onClick={()=>{setPathView3D(true);setEditIn3D(true)}}>{t('Edit route in 3D')}</button>
              <button onClick={()=>setFocusRoute(v=>!v)} title={focusRoute?t('Show settings panel'):t('Focus route editor')}>
                {focusRoute?<PanelLeftOpen size={14}/>:<PanelLeftClose size={14}/>} {focusRoute?t('Show settings panel'):t('Focus route editor')}
              </button>
              <button onClick={undoPath} disabled={!pathUndo.current.length} title={`${t('Undo')} Ctrl+Z`}><Undo2 size={14}/></button>
              <button onClick={redoPath} disabled={!pathRedo.current.length} title={`${t('Redo')} Ctrl+Y`}><Redo2 size={14}/></button>
            </div>}
            {tab==='terrain'&&<div className="terrain-preview-actions wb-preview-modes">
              <button type="button" className={sculptMode?'active':''} onClick={()=>setInteraction('sculpt')}>{t('Sculpt')}</button>
              <button type="button" className={!sculptMode&&!vertexMode&&!diagonalMode?'active':''} onClick={()=>setInteraction('inspect')}>{t('Inspect')}</button>
              <button type="button" className={vertexMode?'active':''} onClick={()=>setInteraction('vertex')}>{t('Edit vertices')}</button>
              <button type="button" className={diagonalMode?'active':''} onClick={()=>setInteraction('diagonal')}>{t('Flip diagonals')}</button>
              <button type="button" className={showBase?'active':''} onClick={()=>setShowBase(v=>!v)}>{showBase?t('Preview with underside'):t('Preview top only')}</button>
              <button type="button" className={focusTerrain?'active':''} onClick={()=>setFocusTerrain(v=>!v)} title={t('Focus 3D workspace')}>{focusTerrain?<PanelLeftOpen size={18}/>:<PanelLeftClose size={18}/>} {focusTerrain?t('Show properties'):t('Focus 3D workspace')}</button>
            </div>}
          </div>
          <div className="terrain-canvas" onContextMenu={e=>{if(tab==='terrain')e.preventDefault()}}>
            {tab==='terrain'&&<div className="wb-viewport-overlay">
              <div className="wb-view-angles" role="group" aria-label={t('Camera views')}>
                {(['perspective','top','side'] as const).map(mode=><button key={mode} type="button" className={cameraMode===mode?'active':''} onClick={()=>{setCameraMode(mode);setCameraRevision(v=>v+1)}}>{t(mode==='perspective'?'Perspective view':mode==='top'?'Top view':'Side view')}</button>)}
                <button type="button" onClick={()=>setCameraRevision(v=>v+1)} title={t('Frame terrain')}>{t('Frame terrain')}</button>
              </div>
              {focusTerrain&&<div className="wb-floating-tools" aria-label={t('Sculpt controls')}>
                {sculptMode&&<>
                  <div className="wb-tool-grid">{(['raise','lower','smooth','flatten','noise'] as TerrainTool[]).map(mode=><button key={mode} className={tool===mode?'active':''} type="button" onClick={()=>setTool(mode)}>{t(mode[0].toUpperCase()+mode.slice(1))}</button>)}</div>
                  <label>{t('Brush radius')} {radius}u <input type="range" min="32" max="512" step="16" value={radius} onChange={e=>setRadius(+e.target.value)}/></label>
                  <label>{t('Brush strength')} {strength} <input type="range" min="2" max="96" step="2" value={strength} onChange={e=>setStrength(+e.target.value)}/></label>
                </>}
                {vertexMode&&selectedVertex!==null&&<label>{t('Vertex height (u)')}<input type="number" min="-512" max="512" step="2" value={draft.heights[selectedVertex]??0} onChange={e=>{if(Number.isFinite(e.target.valueAsNumber)&&e.target.valueAsNumber!==draft.heights[selectedVertex]){snapshotHeights();moveTerrainVertex(selectedVertex,e.target.valueAsNumber)}}}/></label>}
                <div className="wb-history-actions"><button onClick={()=>restoreHeights(true)} disabled={!terrainUndo.current.length}><Undo2 size={17}/> {t('Undo')}</button><button onClick={()=>restoreHeights(false)} disabled={!terrainRedo.current.length}><Redo2 size={17}/> {t('Redo')}</button></div>
              </div>}
              <div className="wb-viewport-help">{t(sculptMode?'Left drag: sculpt · Right drag: orbit · Middle drag: pan · Wheel: zoom':vertexMode?'Drag cyan points vertically to edit heights · Right drag: orbit':diagonalMode?'Click a triangle cell to flip its diagonal · Right drag: orbit':'Left / right drag: orbit · Middle drag: pan · Wheel: zoom')}</div>
            </div>}
            {tab==='paths'&&!pathView3D?<PathPlanEditor
              points={pathPoints} outline={pathOutline} kind={pathKind} sidewalkWidth={sidewalkWidth} profileWidth={pathWidth}
              activePoint={activePoint} onSelect={setActivePoint} onBeginDrag={rememberPath}
              onMove={movePoint} onEndDrag={()=>{}} onDelete={index=>{if(pathLatest.current.length>2)editPath(pathLatest.current.filter((_,j)=>j!==index));}}
              onAdd={addPathPoint}/>
            :<Canvas camera={{position:[660,440,680],fov:45,near:1,far:20000}} dpr={[1,1.5]} gl={{antialias:true}}>
              <color attach="background" args={['#172431']}/>
              {tab==='terrain'&&<TerrainCameraRig mode={cameraMode} tick={cameraRevision} size={Math.max(draft.width,draft.depth)} controls={orbitRef}/>}
              <ambientLight intensity={1.5}/><directionalLight position={[200,500,300]} intensity={2}/>
              <gridHelper args={[4096,64,'#4d7182','#2c4555']} position={[0,tab==='terrain'?bottomOffset-2:-96,0]}/>
              {tab==='paths'?<>{smartTerrain&&pathView3D&&<group position={[smartTerrain.origin[0]-draft.origin[0],smartTerrain.origin[2]-draft.origin[2],draft.origin[1]-smartTerrain.origin[1]]}><PreviewSurface draft={smartPreview.plan?.terrain??smartTerrain} tool={tool} radius={radius} strength={strength} sculptMode={false} showBase diagonalMode={false} onToggleDiagonal={()=>{}} onPaint={()=>{}} onStrokeStart={()=>{}} texture={previewTexture}/></group>}<group position={[-draft.origin[0],-draft.origin[2],draft.origin[1]]}>{pathPreview.brushes.map(b=><RockShape key={b.id} brush={b} texture={previewTexture}/>)}</group>
                {railPreviewPose&&<mesh position={railPreviewPose.point} rotation={[0,railPreviewPose.yaw,0]} raycast={()=>null}>
                  <boxGeometry args={[railway.trainLength??96,30,44]}/><meshStandardMaterial color="#55c8ff" wireframe transparent opacity={0.8} depthWrite={false}/>
                </mesh>}
                {editIn3D&&<Path3DControls points={pathPoints} activePoint={activePoint} axis={path3DAxis} onSelect={setActivePoint}
                  onBeginDrag={rememberPath} onMove={(index,point)=>{const next=pathLatest.current.map((p,i)=>i===index?point:p);pathLatest.current=next;setPathPoints(next);setMessage('')}}
                  onEndDrag={()=>{}} onInsertAfter={index=>{if(pathLatest.current.length>=48)return;const a=pathLatest.current[index],b=pathLatest.current[index+1];editPath([...pathLatest.current.slice(0,index+1),a.map((v,j)=>Math.round((v+b[j])/16)*8) as Vec3,...pathLatest.current.slice(index+1)]);setActivePoint(index+1)}}
                  onDraggingChange={setPath3DDragging}/>}</>:tab==='terrain'?<><PreviewSurface draft={draft} tool={tool} radius={radius} strength={strength} sculptMode={sculptMode} showBase={showBase} diagonalMode={diagonalMode} onToggleDiagonal={toggleDiagonal} onPaint={paint} onStrokeStart={snapshotHeights} texture={previewTexture}/>
                  {vertexMode&&<TerrainVertexHandles draft={draft} selected={selectedVertex} onSelect={setSelectedVertex} onBeginDrag={snapshotHeights} onMove={moveTerrainVertex}/>}
                </>:
                <group>{rockBrushes.map(b=><RockShape key={b.id} brush={b} texture={previewTexture}/>)}</group>}
              <OrbitControls ref={orbitRef} makeDefault enabled={!path3DDragging} enableRotate enablePan enableZoom minDistance={40} maxDistance={12000}
                mouseButtons={tab==='terrain'?{LEFT:sculptMode||vertexMode||diagonalMode?(-1 as THREE.MOUSE):THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE}:undefined}/>

            </Canvas>}
          </div>
          {tab==='paths'&&pathView3D&&editIn3D&&<div className="path-3d-axisbar" role="group" aria-label={t('3D point movement axis')}>
            <span>{t('Move selected point')}:</span>{(['xy','x','y','z'] as PathAxis[]).map(axis=><button type="button" key={axis} className={path3DAxis===axis?'active':''} onClick={()=>setPath3DAxis(axis)}>{axis.toUpperCase()}</button>)}
            <small>{t('Drag orange handles to move; green diamonds insert control points. Undo with Ctrl+Z.')}</small>
          </div>}
          {tab==='paths'&&<section className={`path-elevation-panel${expandedElevation?' path-elevation-expanded':''}`} aria-label={t('Elevation profile')}>
            <header><strong>{t('Elevation profile')}</strong><small>{t('Drag points vertically to raise or lower the path. The overhead view edits X/Y; this profile edits Z.')}</small>
              <button type="button" className="path-elevation-toggle" onClick={()=>setExpandedElevation(v=>!v)} title={expandedElevation?t('Compact elevation profile'):t('Expand elevation profile')}><ChevronsUpDown size={14}/>{expandedElevation?t('Compact elevation profile'):t('Expand elevation profile')}</button>
            </header>
            <svg viewBox="0 0 800 168" preserveAspectRatio="none" aria-label={t('Elevation profile control points')} style={{width:'100%',height:expandedElevation?260:155,touchAction:'none'}}>
              {[0,1,2,3,4].map(i=>{const z=visibleProfileRange.low+(visibleProfileRange.high-visibleProfileRange.low)*i/4;return <g key={i}><line x1="26" x2="774" y1={profileY(z)} y2={profileY(z)} stroke="#466378" strokeDasharray="4 7"/><text x="2" y={profileY(z)-3} fontSize="11" fill="#a8c5d8">{Math.round(z)}</text></g>})}
              <polyline points={(sampledElevations.length?sampledElevations.map(p=>`${32+736*p.distance/Math.max(1,sampledElevations[sampledElevations.length-1].distance)},${profileY(p.z)}`):pathPoints.map((p,i)=>`${profileX(i)},${profileY(p[2])}`)).join(' ')} fill="none" stroke="#64d9fa" strokeWidth="3" vectorEffect="non-scaling-stroke"/>
              {pathPoints.map((p,i)=><g key={i}>
                <circle cx={profileX(i)} cy={profileY(p[2])} r={activePoint===i?13:11} fill={activePoint===i?'#ffdb78':'#ffad58'} stroke="#142332" strokeWidth="2" style={{cursor:'ns-resize',touchAction:'none'}}
                  onPointerDown={e=>{e.stopPropagation();rememberPath();setFixedProfileRange(elevationRange);dragHeight.current=i;setActivePoint(i);e.currentTarget.setPointerCapture(e.pointerId)}}
                  onPointerMove={e=>{if(dragHeight.current!==i)return;moveHeight(i,heightFromPointer(e))}}
                  onPointerUp={e=>{dragHeight.current=null;setFixedProfileRange(null);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
                  onPointerCancel={()=>{dragHeight.current=null;setFixedProfileRange(null)}}/>
                <text x={profileX(i)+17} y={profileY(p[2])-10} fontSize="12" fill="#f0f8ff">{i+1} · {Math.round(p[2])}u</text>
              </g>)}
            </svg>
          </section>}
          {tab==='terrain'&&<div className="wb-metrics" aria-label="Estadísticas del relieve">
            <span><strong>{count}</strong> brushes</span>
            <span><strong>{worldTerrainStats(draft.heights).min}</strong> u mínimo</span>
            <span><strong>{worldTerrainStats(draft.heights).max}</strong> u máximo</span>
            <span><strong>{draft.resolution}×{draft.resolution}</strong> celdas</span>
          </div>}
          {tab==='terrain'&&<p className="terrain-depth-readout">{t('Lowest underside relative to placement Z')}: {fmt(bottomOffset)} u · {baseMode==='thin'?t('Thin convex terrain slabs with collision.'):t('Terrain is a solid volume, not a hollow shell.')}</p>}
          <p className="terrain-muted">{tab==='terrain'?(sculptMode?t('Left drag: sculpt · Right drag: orbit · Middle drag: pan · Wheel: zoom'):vertexMode?t('Drag cyan points vertically to edit heights · Right drag: orbit'):diagonalMode?t('Click a triangle cell to flip its diagonal · Right drag: orbit'):t('Left / right drag: orbit · Middle drag: pan · Wheel: zoom')):tab==='rocks'?t('Drag to orbit; wheel to zoom. Rocks are previewed before placement.'):t('Route preview shows shared bend edges, not overlapping rectangles. Very sharp turns are rejected.')}</p>
          {tab==='terrain'&&count>=288&&<div className="terrain-warning"><TriangleAlert size={15}/>{t('High brush count: start with 4×4 or 8×8 for performance. More segments increase BSP compile cost.')}</div>}
          <div className="terrain-info"><ShieldCheck size={17}/><span>{t('Exports only convex planar Valve 220 brushes. The preview does not compile BSP or seal leaks.')}</span></div>
          {tab==='paths'&&pathPreview.error&&<div className="terrain-warning"><TriangleAlert size={15}/>{pathPreview.error}</div>}
          {tab==='paths'&&pathKind==='rail'&&pathPreview.entities>0&&<p className="terrain-muted">{pathPreview.entities} {t('Generated railway entities')} · {t('Editable with the saved route')}</p>}
          {tab==='paths'&&pathPreview.warnings.map((warning,i)=><p className="terrain-muted" key={i}><TriangleAlert size={13}/> {t(warning)}</p>)}
          {issues.length>0&&tab==='terrain'&&<div className="terrain-warning"><TriangleAlert size={15}/>{issues.join(' · ')}</div>}
          {message&&<div className="terrain-notice"><CheckCircle2 size={15}/>{message}</div>}
        </main>
      </div>}
      {tab!=='curves'&&<footer className="terrain-footer"><span>{t('No changes to the map until Apply. Undo/Redo supported.')}</span>
        {tab==='paths'&&editingPathId&&<button className="terrain-place-button" onClick={()=>{setPathEditing(editingPathId);onClose()}}>{t('Edit saved route in MAP')}</button>}
        {tab==='paths'&&editingPathId&&<button className="terrain-place-button" disabled={compileBusy||!!pathPreview.error} onClick={applyPathUpdate}>{t('Update saved route')}</button>}
        {tab==='terrain'&&record&&<button className="terrain-place-button" disabled={compileBusy||issues.length>0} onClick={apply}>{t('Update existing terrain')}</button>}
        <button onClick={onClose}>{t('Close')}</button>
        <button className="terrain-primary" disabled={compileBusy||(tab==='terrain'&&issues.length>0)||(tab==='paths'&&!!pathPreview.error)} onClick={placeOnMap}><MousePointer2 size={14}/>{t('Place by clicking map')}</button>
      </footer>}
    </section>
  </div>;
}
