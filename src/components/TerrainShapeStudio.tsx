import {useEffect,useMemo,useRef,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import {CheckCircle2,Mountain,MousePointer2,RotateCcw,ShieldCheck,TriangleAlert,X,Search,Image as ImageIcon} from 'lucide-react';
import {useT} from '../i18n';
import {useEditor} from '../store';
import type {Brush,Vec3} from '../engine/types';
import {parseWad} from '../engine/wad';
import {createRockCluster,createTerrainBrushes,defaultTerrain,sculptTerrain,validateTerrainDraft,createTerrainPreviewShell,terrainBaseZ,type TerrainDraft,type TerrainTool} from '../engine/terrain';
import {transformedVertices} from '../engine/geometry';

const STARTER_TEXTURES=['SV_BRICK01','SV_CONCRET','SV_TILE01','SV_METAL01','SV_GRID01'];
const previewTextureURL=(name:string,assets:{name:string;dataUrl:string}[])=>assets.find(a=>a.name.toLowerCase()===name.toLowerCase())?.dataUrl||
  (STARTER_TEXTURES.includes(name.toUpperCase())?`/starter-textures/${name.toUpperCase()}.png`:null);


function PreviewSurface({draft,tool,radius,strength,sculptMode,showBase,onPaint,texture}:{draft:TerrainDraft;tool:TerrainTool;radius:number;strength:number;sculptMode:boolean;showBase:boolean;onPaint:(x:number,y:number)=>void;texture:THREE.Texture|null}){
  const dragging=useRef(false);
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
  },[draft.width,draft.depth,draft.heights,draft.resolution,draft.origin,draft.baseDepth]);
  useEffect(()=>()=>{surface.dispose();base.dispose()},[surface,base]);
  const paint=(p:THREE.Vector3)=>onPaint(p.x+draft.width/2,draft.depth/2-p.z);
  return <group>
    {/* Sculpt only the top surface, never an exterior wall or the bottom. */}
    <mesh geometry={surface}
      onPointerDown={e=>{if(!sculptMode||e.button!==0)return;e.stopPropagation();dragging.current=true;paint(e.point);}}
      onPointerMove={e=>{if(!sculptMode||!dragging.current||!(e.buttons&1))return;e.stopPropagation();paint(e.point);}}
      onPointerUp={()=>{dragging.current=false}} onPointerOut={()=>{dragging.current=false}}>
      <meshStandardMaterial map={texture||undefined} color={texture?'#ffffff':'#8eab86'} side={THREE.DoubleSide} flatShading roughness={1}/>
    </mesh>
    {showBase&&<mesh geometry={base} raycast={()=>null}>
      <meshStandardMaterial map={texture||undefined} color={texture?'#ffffff':'#8eab86'} side={THREE.DoubleSide} flatShading roughness={1}/>
    </mesh>}
  </group>;
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
export function TerrainShapeStudio({onClose}:{onClose:()=>void}){
  const t=useT();
  const existing=useEditor(s=>s.project.terrainGroups);
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
  const addObjects=useEditor(s=>s.addObjects);
  const compileBusy=useEditor(s=>s.compileBusy);
  const [tab,setTab]=useState<'terrain'|'rocks'>('terrain');
  const [draft,setDraft]=useState<TerrainDraft>(()=>defaultTerrain());
  const [tool,setTool]=useState<TerrainTool>('raise');
  const [radius,setRadius]=useState(128),[strength,setStrength]=useState(32);
  const [sculptMode,setSculptMode]=useState(true);
  const [showBase,setShowBase]=useState(true);
  const [rockCount,setRockCount]=useState(6),[rockRadius,setRockRadius]=useState(96),[rockHeight,setRockHeight]=useState(96),[seed,setSeed]=useState(12);
  const [message,setMessage]=useState('');
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
  const placeOnMap=()=>{
    if(compileBusy)return;
    try{
      if(tab==='terrain'){
        const errors=validateTerrainDraft(draft);if(errors.length)throw Error(errors.join(' · '));
        startTerrainPlacement({kind:'terrain',draft});
      }else{
        startTerrainPlacement({kind:'rocks',draft,rocks:{count:rockCount,radius:rockRadius,height:rockHeight,seed}});
      }
      onClose();
    }catch(error){setMessage(String(error));}
  };
  const issues=useMemo(()=>validateTerrainDraft(draft),[draft]);
  const count=draft.resolution*draft.resolution*2;
  const bottomOffset=terrainBaseZ(draft)-draft.origin[2];
  const rockBrushes=useMemo(()=>{
    try{return createRockCluster({origin:[0,0,0],count:rockCount,radius:rockRadius,height:rockHeight,seed,texture:draft.texture});}
    catch{return [] as Brush[];}
  },[rockCount,rockRadius,rockHeight,seed,draft.texture]);
  const setNumber=(key:'width'|'depth',value:number)=>setDraft(d=>({...d,[key]:Number.isFinite(value)?value:d[key]}));
  const setOrigin=(i:number,value:number)=>setDraft(d=>({...d,origin:d.origin.map((v,j)=>i===j&&Number.isFinite(value)?value:v) as Vec3}));
  const paint=(x:number,y:number)=>{
    try{setDraft(d=>({...d,heights:sculptTerrain(d,tool,x,y,radius,strength/6)}));setMessage('');}
    catch(err){setMessage(String(err instanceof Error?err.message:err));}
  };
  const loadTerrain=(id:string)=>{
    const g=existing?.find(g=>g.id===id);if(!g)return;
    setDraft({id:g.id,name:g.name,origin:[...g.origin],width:g.width,depth:g.depth,resolution:g.resolution,heights:[...g.heights],texture:g.texture,baseDepth:g.baseDepth??96});
    setMessage(t('Loaded terrain for editing. Existing geometry will be checked before replacement.'));
  };
  const apply=()=>{
    try{
      const objects=createTerrainBrushes(draft,record?.brushIds);
      if(objects.length>512)throw Error('Terrain brush limit exceeded.');
      applyTerrain(draft);setMessage(`${objects.length} ${t('convex brushes added or safely updated. Use Undo to revert.')}`);
    }catch(err){setMessage(String(err instanceof Error?err.message:err));}
  };
  const applyRocks=()=>{
    try{
      const rocks=createRockCluster({origin:draft.origin,count:rockCount,radius:rockRadius,height:rockHeight,seed,texture:draft.texture});
      addObjects(rocks);setMessage(`${rocks.length} ${t('convex rocks added. Use Undo to revert.')}`);
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
    <section className="terrain-shell" role="dialog" aria-modal="true" aria-label={t('Terrain & Shape Studio')} onMouseDown={e=>e.stopPropagation()}>
      <header className="terrain-header"><Mountain size={21}/><div><strong>{t('Terrain & Shape Studio')}</strong><small>{t('Convex brush geometry · Sven Co-op / Svengine')}</small></div><button title={t('Close')} onClick={onClose}><X size={20}/></button></header>
      <div className="terrain-tabs"><button className={tab==='terrain'?'active':''} onClick={()=>{setTab('terrain');setMessage('')}}>{t('Sculpt Terrain')}</button><button className={tab==='rocks'?'active':''} onClick={()=>{setTab('rocks');setMessage('')}}>{t('Rock & Cliff Generator')}</button></div>
      <div className="terrain-layout">
        <aside className="terrain-tools">
          {tab==='terrain'&&<>
            <label>{t('Terrain group')}
              <select value={record?.id||'new'} onChange={e=>{
                if(e.target.value==='new'){setDraft({...defaultTerrain(draft.origin),name:`Terrain ${String((existing?.length||0)+1).padStart(2,'0')}`});setMessage('');}else loadTerrain(e.target.value);
              }}><option value="new">{t('New terrain')}</option>{(existing||[]).map(g=><option value={g.id} key={g.id}>{g.name}</option>)}</select>
            </label>
            <label>{t('Name')}<input maxLength={48} value={draft.name} onChange={e=>setDraft(d=>({...d,name:e.target.value||'Terrain'}))}/></label>
            <div className="terrain-inline">
              <label>{t('Width')}<input type="number" min="64" max="4096" step="32" value={draft.width} onChange={e=>setNumber('width',e.target.valueAsNumber)}/></label>
              <label>{t('Depth')}<input type="number" min="64" max="4096" step="32" value={draft.depth} onChange={e=>setNumber('depth',e.target.valueAsNumber)}/></label>
            </div>
            <label>{t('Base depth (units)')} <output>{draft.baseDepth??96} u</output>
              <input type="range" min="64" max="1024" step="16" value={draft.baseDepth??96} onChange={e=>setDraft(d=>({...d,baseDepth:+e.target.value}))}/>
            </label>
            <p className="terrain-muted">{t('Base extends below the terrain. Deep valleys require an extra 64 units of clearance.')}</p>
            <label>{t('Grid resolution')}
              <select value={draft.resolution} onChange={e=>{
                const n=Number(e.target.value);setDraft(d=>({...d,resolution:n,heights:resample(d.heights,d.resolution,n)}));
              }}>{[4,8,12,16].map(n=><option key={n} value={n}>{n}×{n} · {n*n*2} {t('brushes')}</option>)}</select>
            </label>
            <div className="terrain-modes">{(['raise','lower','smooth','flatten','noise'] as TerrainTool[]).map(m=><button key={m} className={tool===m?'active':''} onClick={()=>{setTool(m);setSculptMode(true)}}>{t(m[0].toUpperCase()+m.slice(1))}</button>)}</div>
            <label>{t('Brush radius')} <output>{radius} u</output><input type="range" min="32" max="512" step="16" value={radius} onChange={e=>setRadius(+e.target.value)}/></label>
            <label>{t('Brush strength')} <output>{strength}</output><input type="range" min="2" max="96" step="2" value={strength} onChange={e=>setStrength(+e.target.value)}/></label>
            <button className="terrain-secondary" onClick={()=>setDraft(d=>({...d,heights:Array((d.resolution+1)**2).fill(0)}))}><RotateCcw size={15}/>{t('Flatten entire preview')}</button>
          </>}
          {tab==='rocks'&&<>
            <p className="terrain-muted">{t('Convex rock brushes with a reproducible seed. No models or Source displacements.')}</p>
            <label>{t('Rocks')} <output>{rockCount}</output><input type="range" min="1" max="24" value={rockCount} onChange={e=>setRockCount(+e.target.value)}/></label>
            <label>{t('Cluster radius')} <output>{rockRadius} u</output><input type="range" min="16" max="512" step="16" value={rockRadius} onChange={e=>setRockRadius(+e.target.value)}/></label>
            <label>{t('Rock height')} <output>{rockHeight} u</output><input type="range" min="16" max="512" step="16" value={rockHeight} onChange={e=>setRockHeight(+e.target.value)}/></label>
            <label>{t('Random seed')}<input type="number" value={seed} step="1" onChange={e=>setSeed(Number.isFinite(e.target.valueAsNumber)?e.target.valueAsNumber:0)}/></label>
          </>}
          <div className="terrain-separator"/>
          <div className="terrain-textures-head"><strong>{t('GoldSrc texture')}</strong><span>{availableTextures.length} · WAD</span></div>
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
          <label>{t('Placement center (X / Y / Z)')}</label>
          <div className="terrain-inline three">{draft.origin.map((v,i)=><input aria-label={['X','Y','Z'][i]} key={i} type="number" value={v} step="16" onChange={e=>setOrigin(i,e.target.valueAsNumber)}/>)}</div>
          <button className="terrain-secondary" onClick={useSelection}><MousePointer2 size={14}/>{t('Use selected object position')}</button>
        </aside>
        <main className="terrain-preview">
          <div className="terrain-preview-head">
            <span>{t('Interactive preview')} <small>· {tab==='terrain'?`${count} ${t('brushes')}`:`${rockCount} ${t('rocks')}`}</small></span>
            {tab==='terrain'&&<div className="terrain-preview-actions">
              <button className={showBase?'active':''} onClick={()=>setShowBase(v=>!v)}>{showBase?t('Solid terrain (base visible)'):t('Top surface only')}</button>
              <button className={sculptMode?'active':''} onClick={()=>setSculptMode(v=>!v)}>{sculptMode?t('Sculpt with mouse'):t('Orbit / inspect')}</button>
            </div>}
          </div>
          <div className="terrain-canvas">
            <Canvas camera={{position:[660,440,680],fov:45,near:1,far:20000}} dpr={[1,1.5]} gl={{antialias:true}}>
              <color attach="background" args={['#172431']}/>
              <ambientLight intensity={1.5}/><directionalLight position={[200,500,300]} intensity={2}/>
              <gridHelper args={[4096,64,'#4d7182','#2c4555']} position={[0,tab==='terrain'?bottomOffset-2:-96,0]}/>
              {tab==='terrain'?<PreviewSurface draft={draft} tool={tool} radius={radius} strength={strength} sculptMode={sculptMode} showBase={showBase} onPaint={paint} texture={previewTexture}/>:
                <group>{rockBrushes.map(b=><RockShape key={b.id} brush={b} texture={previewTexture}/>)}</group>}
              <OrbitControls makeDefault enableRotate={tab==='rocks'||!sculptMode} enablePan={tab==='rocks'||!sculptMode} enableZoom minDistance={65} maxDistance={6500}/>
            </Canvas>
          </div>
          {tab==='terrain'&&<p className="terrain-depth-readout">{t('Base bottom relative to placement Z')}: {fmt(bottomOffset)} u · {t('Terrain is a solid volume, not a hollow shell.')}</p>}
          <p className="terrain-muted">{tab==='terrain'?(sculptMode?t('Drag the left mouse button on the terrain to sculpt. Switch to Orbit to inspect.'):t('Drag to orbit; use the wheel to zoom. Switch to Sculpt to edit.')):t('Drag to orbit; wheel to zoom. Rocks are previewed before placement.')}</p>
          {tab==='terrain'&&count>=288&&<div className="terrain-warning"><TriangleAlert size={15}/>{t('High brush count: start with 4×4 or 8×8 for performance. More segments increase BSP compile cost.')}</div>}
          <div className="terrain-info"><ShieldCheck size={17}/><span>{t('Exports only convex planar Valve 220 brushes. The preview does not compile BSP or seal leaks.')}</span></div>
          {issues.length>0&&tab==='terrain'&&<div className="terrain-warning"><TriangleAlert size={15}/>{issues.join(' · ')}</div>}
          {message&&<div className="terrain-notice"><CheckCircle2 size={15}/>{message}</div>}
        </main>
      </div>
      <footer className="terrain-footer"><span>{t('No changes to the map until Apply. Undo/Redo supported.')}</span>
        <button className="terrain-place-button" disabled={compileBusy||(tab==='terrain'&&issues.length>0)} onClick={tab==='terrain'?apply:applyRocks}>{t('Apply at X/Y/Z')}</button>
        <button onClick={onClose}>{t('Close')}</button>
        <button className="terrain-primary" disabled={compileBusy||(tab==='terrain'&&issues.length>0)} onClick={placeOnMap}><MousePointer2 size={14}/>{t('Place by clicking map')}</button>
      </footer>
    </section>
  </div>;
}
