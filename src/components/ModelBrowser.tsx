import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {Canvas,useThree,useFrame} from '@react-three/fiber';
import {OrbitControls,Grid} from '@react-three/drei';
import * as THREE from 'three';
import {Box,Search,RefreshCw,Eye,Check,AlertTriangle,Layers,Package,Play,Pause,Grid2X2,List,Star,SlidersHorizontal} from 'lucide-react';
import {parseGoldSrcMdl,type StudioPreview} from '../engine/mdl';
import {useEditor} from '../store';
import {useT} from '../i18n';
export type ModelFile={path:string;source:string;name:string};
export async function postModelJson(url:string,payload:object,signal?:AbortSignal):Promise<any>{
  const response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal});
  if(!response.ok){const body=await response.json().catch(()=>({}));throw Error(body.error||`HTTP ${response.status}`)}
  return response.json();
}
const fetchBinary=async(gameDir:string,source:string,path:string)=>{
  const response=await fetch('/api/assets/model',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameDir,source,path})});
  if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(error.error||`HTTP ${response.status}`)}
  return response.arrayBuffer();
};
const cache=new Map<string,Promise<StudioPreview>>();
export function loadModelPreview(gameDir:string,model:ModelFile):Promise<StudioPreview>{
  const key=[gameDir,model.source,model.path].join('|');
  if(!cache.has(key))cache.set(key,(async()=>{
    const file=await fetchBinary(gameDir,model.source,model.path);
    let companion: ArrayBuffer|undefined;
    if(new DataView(file).getInt32(180,true)===0){
      const companionPath=model.path.replace(/\.mdl$/i,'T.mdl');
      // Svengine searches virtual game folders by precedence. A model may
      // override a base model while reusing the base texture companion.
      for(const source of [model.source,'svencoop_addon','svencoop_downloads','svencoop']){
        try{companion=await fetchBinary(gameDir,source,companionPath);break}catch{/*Try the next game resource folder.*/}
      }
    }
    // Demand-loaded GoldSrc animation groups are separate 01.mdl, 02.mdl…
    // files (IDSQ). Fetch only the groups declared by this model.
    const groups:Record<number,ArrayBuffer>={};
    const header=new DataView(file);
    const count=header.getInt32(172,true);
    if(count>1&&count<=32){
      for(let group=1;group<Math.min(count,16);group++){
        const groupPath=model.path.replace(/\.mdl$/i,`${String(group).padStart(2,'0')}.mdl`);
        for(const source of [model.source,'svencoop_addon','svencoop_downloads','svencoop']){
          try{groups[group]=await fetchBinary(gameDir,source,groupPath);break}catch{/* Optional demand-loaded animation group. */}
        }
      }
    }
    return parseGoldSrcMdl(file,companion,groups);
  })().catch(error=>{cache.delete(key);throw error}));
  return cache.get(key)!;
}
/** For FGD previews the preferred override is addon -> downloads -> base. */
export async function loadModelByPath(gameDir:string,modelPath:string):Promise<StudioPreview>{
  if(!/^models\/[\w\-./ ]+\.mdl$/i.test(modelPath)||modelPath.includes('..'))throw Error('Unsupported model path.');
  let last:unknown;
  for(const source of ['svencoop_addon','svencoop_downloads','svencoop']){
    try{return await loadModelPreview(gameDir,{source,path:modelPath,name:modelPath.split('/').at(-1)!})}catch(error){last=error}
  }
  throw last||Error('Model not found in Sven Co-op folders.');
}
function studioMaterials(data:StudioPreview){
  return data.textures.map(texture=>{
    const map=new THREE.DataTexture(texture.rgba,texture.width,texture.height,THREE.RGBAFormat);
    map.flipY=true;map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
    map.magFilter=THREE.NearestFilter;map.minFilter=THREE.LinearFilter;map.generateMipmaps=false;map.needsUpdate=true;
    const flags=texture.flags,options={map,side:THREE.DoubleSide,depthWrite:true};
    if(flags&0x0002)return new THREE.MeshMatcapMaterial({...options,matcap:map,map:null});
    if(flags&0x0020)return new THREE.MeshBasicMaterial({...options,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false});
    if(flags&0x0004)return new THREE.MeshBasicMaterial({...options,alphaTest:flags&0x0040?0.5:0});
    return new THREE.MeshStandardMaterial({...options,alphaTest:flags&0x0040?0.5:0,flatShading:(flags&0x0001)!==0,roughness:1});
  });
}
function disposeMaterials(materials:THREE.Material[]){materials.forEach(m=>{
  const t=m as THREE.MeshStandardMaterial; t.map?.dispose();
  if(m instanceof THREE.MeshMatcapMaterial)m.matcap?.dispose();m.dispose();
});}
function activeMeshes(data:StudioPreview,bodySelection:number[]){
  return data.bodyparts.flatMap((part,i)=>part.models[bodySelection[i]??0]?.meshes||[]);
}
/** Read-only renderer, used both in the 3D editor and the model inspector.
 * Animation updates are CPU-side and limited to the active inspector. */
const DEFAULT_BODIES:number[]=[];
function ModelGeometry({data,skin=0,bodySelection=DEFAULT_BODIES,sequence=-1,frame=0}:{data:StudioPreview;skin?:number;bodySelection?:number[];sequence?:number;frame?:number}){
  const meshes=useMemo(()=>activeMeshes(data,bodySelection),[data,bodySelection]);
  const materials=useMemo(()=>studioMaterials(data),[data]);
  const geometries=useMemo(()=>meshes.map(part=>{
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(part.positions.slice(),3));
    geometry.setAttribute('uv',new THREE.BufferAttribute(part.uvs,2));geometry.computeVertexNormals();
    return geometry;
  }),[meshes]);
  useEffect(()=>()=>{geometries.forEach(g=>g.dispose())},[geometries]);
  useEffect(()=>()=>disposeMaterials(materials),[materials]);
  useEffect(()=>{
    let pose:THREE.Matrix4[]|null=null;
    try{if(sequence>=0 && data.sequences[sequence]?.available)pose=data.samplePose(sequence,frame);}catch{/* Corrupted or unsupported sequence: render the bind pose instead. */}
    meshes.forEach((mesh,i)=>{
      const geometry=geometries[i],positions=geometry.getAttribute('position') as THREE.BufferAttribute;
      const target=positions.array as Float32Array;
      if(!pose){target.set(mesh.positions);}
      else{
        const point=new THREE.Vector3();
        for(let vertex=0;vertex<mesh.boneIndices.length;vertex++){
          const at=vertex*3,bone=pose[mesh.boneIndices[vertex]];
          point.set(mesh.localPositions[at],mesh.localPositions[at+1],mesh.localPositions[at+2]);
          if(bone)point.applyMatrix4(bone);
          target[at]=point.x;target[at+1]=point.z;target[at+2]=point.y;
        }
      }
      positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingSphere();
    });
  },[data,meshes,geometries,sequence,frame]);
  return <group>{geometries.map((geometry,i)=>{
    const mesh=meshes[i];const textureIndex=data.skins[skin]?.[mesh.skinref]??mesh.texture;
    const material=materials[textureIndex];
    return <mesh key={i} geometry={geometry} material={material||undefined}>
      {!material&&<meshStandardMaterial color="#b2c8e1" roughness={.95} side={THREE.DoubleSide}/>}</mesh>;
  })}</group>;
}
export function StudioModel({data,skin=0,body=0,animate=false}:{data:StudioPreview;skin?:number;body?:number;animate?:boolean}){
  // Animation is opt-in for Gameplay Test; the editor model browser remains unchanged.
  const selection=useMemo(()=>data.bodyparts.map(part=>part.base>0&&part.models.length>0?
    Math.floor(Math.max(0,body)/part.base)%part.models.length:0),[data,body]);
  const idle=useMemo(()=>{
    const preferred=data.sequences.findIndex(s=>s.available&&/^(idle|idle1|idle2|stand|rest)$/i.test(s.name||''));
    return preferred>=0?preferred:data.sequences.findIndex(s=>s.available&&s.loop&&s.frames>1);
  },[data]);
  const [frame,setFrame]=useState(0);
  const elapsed=useRef(0);
  useFrame((_,delta)=>{
    if(!animate||idle<0)return;
    const seq=data.sequences[idle];if(!seq||seq.frames<2)return;
    elapsed.current+=Math.min(.1,delta);
    if(elapsed.current<.10)return;
    const step=elapsed.current;elapsed.current=0;
    setFrame(previous=>(previous+step*Math.max(1,seq.fps||12))%Math.max(1,seq.frames-1));
  });
  return <ModelGeometry data={data} bodySelection={selection} skin={Math.max(0,Math.min(data.skins.length-1,skin))} sequence={animate?idle:-1} frame={frame}/>;
}
function modelSize(data:StudioPreview){
  const bounds=new THREE.Box3();
  for(const mesh of data.meshes){const pts=mesh.positions;for(let i=0;i<pts.length;i+=3)bounds.expandByPoint(new THREE.Vector3(pts[i],pts[i+1],pts[i+2]));}
  const sphere=bounds.getBoundingSphere(new THREE.Sphere());
  return {center:sphere.center, radius:Math.max(16,sphere.radius)};
}
function AutoFrame({data}:{data:StudioPreview}){
  const {camera}=useThree();
  useEffect(()=>{const {center,radius}=modelSize(data);camera.position.set(center.x+radius*1.8,center.y+radius*1.15,center.z+radius*1.9);
    camera.lookAt(center);camera.updateProjectionMatrix();},[camera,data]);
  return null;
}
export function ModelPreviewModal({file,gameDir,onClose,onAssign}:{file:ModelFile;gameDir:string;onClose:()=>void;onAssign:()=>void}){
  const t=useT();
  const [model,setModel]=useState<StudioPreview|null>(null),[error,setError]=useState('');
  const [seq,setSeq]=useState(0),[frame,setFrame]=useState(0),[playing,setPlaying]=useState(false),[rate,setRate]=useState(1);
  const [skin,setSkin]=useState(0),[bodySelection,setBodySelection]=useState<number[]>([]);
  useEffect(()=>{let active=true;setModel(null);setError('');setPlaying(false);setFrame(0);
    loadModelPreview(gameDir,file).then(v=>{if(active){setModel(v);setBodySelection(v.bodyparts.map(()=>0));setSeq(0);setSkin(0);}})
    .catch(e=>{if(active)setError(String(e))});return()=>{active=false};},[file,gameDir]);
  const sequence=model?.sequences[seq];
  useEffect(()=>{if(!playing||!sequence?.available||sequence.frames<=1)return;
    const interval=window.setInterval(()=>setFrame(previous=>{
      const next=previous+(sequence.fps||24)*rate*.05;
      if(next>=sequence.frames-1){if(sequence.loop)return next%(sequence.frames-1);setPlaying(false);return sequence.frames-1;}
      return next;
    }),50);
    return()=>window.clearInterval(interval);
  },[playing,sequence,rate]);
  const selections=useMemo(()=>bodySelection,[bodySelection]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="mdl-modal mdl-modal-advanced" onMouseDown={e=>e.stopPropagation()}>
    <header><strong>SVENGINE MODEL STUDIO · 0.5.2.1</strong><span>{file.path}</span><button onClick={onClose} aria-label="Close">×</button></header>
    <div className="mdl-studio-layout">
      <div className="mdl-stage">{model?<Canvas camera={{position:[190,130,220],fov:48,near:.1,far:15000}}>
        <color attach="background" args={['#10192b']}/><ambientLight intensity={1.8}/><directionalLight position={[150,270,160]} intensity={2}/>
        <Grid infiniteGrid fadeDistance={800} sectionColor="#425777" cellColor="#273850"/>
        <ModelGeometry data={model} skin={skin} bodySelection={selections} sequence={sequence?.available?seq:-1} frame={frame}/>
        <AutoFrame data={model}/><OrbitControls makeDefault target={modelSize(model).center} enablePan enableZoom/>
      </Canvas>:<div className="mdl-loading">{error?<><AlertTriangle size={30}/>{error}</>:<>Loading model and texture companions…</>}</div>}</div>
      <aside className="mdl-controls">
        <h4><SlidersHorizontal size={15}/> {t('Model settings')}</h4>
        <label>{t('Sequence')}
          <select disabled={!model} value={seq} onChange={e=>{setSeq(Number(e.target.value));setFrame(0);setPlaying(false);}}>
            {model?.sequences.map((item,i)=><option key={i} value={i}>{item.name||`Sequence ${i}`} {item.available?'':'(unavailable)'}</option>)}
          </select>
        </label>
        <div className="mdl-play-row"><button disabled={!sequence?.available||sequence.frames<=1} onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={15}/>:<Play size={15}/>} {playing?t('Pause'):t('Play')}</button>
          <select value={rate} onChange={e=>setRate(Number(e.target.value))} aria-label={t('Playback speed')}><option value={.25}>0.25×</option><option value={.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option><option value={2}>2×</option></select></div>
        <input aria-label={t('Animation frame')} type="range" min={0} max={Math.max(0,(sequence?.frames||1)-1)} step="0.1" value={frame}
          onChange={e=>{setFrame(Number(e.target.value));setPlaying(false)}} disabled={!sequence?.available}/>
        <small>{sequence?.available?`${Math.floor(frame)+1} / ${sequence.frames} frames · ${sequence.fps} fps`:t('Animation data not available for this sequence')}</small>
        <label>{t('Skin family')}
          <select value={skin} disabled={!model||model.skins.length<=1} onChange={e=>setSkin(Number(e.target.value))}>
            {model?.skins.map((_,i)=><option value={i} key={i}>Skin {i}</option>)}
          </select>
        </label>
        <div className="mdl-body-scroll"><h4>{t('Bodygroups')}</h4>
          {model?.bodyparts.map((part,i)=><label key={i}>{part.name||`Body ${i}`}
            <select disabled={part.models.length<=1} value={bodySelection[i]??0} onChange={e=>setBodySelection(prev=>prev.map((value,j)=>j===i?Number(e.target.value):value))}>
              {part.models.map((sub,j)=><option key={j} value={j}>{sub.name||`Variant ${j}`}</option>)}
            </select></label>)}
        </div>
      </aside>
    </div>
    <footer><span>{model?`${model.triangles.toLocaleString()} triangles · ${model.textures.length} textures · ${model.sequences.length} sequences · ${model.skins.length} skins`:'GoldSrc/Svengine MDL v10'}</span>
      <button onClick={onAssign} disabled={!model}><Check size={14}/> {t('Apply model to selected entity')}</button></footer>
    {model&&<div className="mdl-note">{t('Model preview only; skin and bodygroup choices do not modify the map. Advanced Svengine animation may differ in-game.')}
      {model.warnings.length>0&&<p style={{color:'#f5c687'}}>{model.warnings.join(' ')}</p>}</div>}
  </div></div>;
}

// One shared offscreen renderer for all thumbnails. The observer requests only
// cards entering the visible area; no WebGL context is created per row.
const thumbs=new Map<string,string>();
const thumbJobs=new Map<string,Promise<string>>();
let thumbQueue=Promise.resolve();
let thumbRenderer:THREE.WebGLRenderer|undefined;
function snapshot(data:StudioPreview):string{
  // Do not allocate WebGL textures for a model outside the preview budget.
  if(data.triangles>60000)throw Error('Thumbnail exceeds triangle budget.');
  const meshes=activeMeshes(data,[]);
  if(!meshes.length)throw Error('No mesh geometry to preview.');
  const scene=new THREE.Scene();scene.background=new THREE.Color('#19253c');
  scene.add(new THREE.AmbientLight('#ffffff',1.8));
  const sun=new THREE.DirectionalLight('#ffffff',2);sun.position.set(1,2,3);scene.add(sun);
  const materials=studioMaterials(data);
  const geometries:THREE.BufferGeometry[]=[];
  const fallbacks:THREE.Material[]=[];
  try{
    const bbox=new THREE.Box3();
    // The default active bodygroup and default skin must match the Model Studio.
    for(const item of meshes){
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.BufferAttribute(item.positions,3));
      geometry.setAttribute('uv',new THREE.BufferAttribute(item.uvs,2));
      geometry.computeVertexNormals();geometry.computeBoundingBox();bbox.union(geometry.boundingBox!);
      geometries.push(geometry);
      const index=data.skins[0]?.[item.skinref]??item.texture;
      let material=materials[index];
      if(!material){material=new THREE.MeshBasicMaterial({color:'#bad6f3',side:THREE.DoubleSide});fallbacks.push(material);}
      scene.add(new THREE.Mesh(geometry,material));
    }
    if(bbox.isEmpty())throw Error('No mesh geometry to preview.');
    if(!thumbRenderer){
      thumbRenderer=new THREE.WebGLRenderer({canvas:document.createElement('canvas'),alpha:true,antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power'});
      thumbRenderer.setPixelRatio(1);
      thumbRenderer.setSize(140,108,false);
      thumbRenderer.outputColorSpace=THREE.SRGBColorSpace;
      thumbRenderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();thumbRenderer=undefined;},{once:true});
    }
    const center=bbox.getCenter(new THREE.Vector3()),r=Math.max(12,bbox.getSize(new THREE.Vector3()).length()*.5);
    const camera=new THREE.PerspectiveCamera(38,140/108,.1,100000);
    camera.position.set(center.x+r*1.6,center.y+r*.8,center.z+r*1.75);camera.lookAt(center);
    thumbRenderer.render(scene,camera);
    return thumbRenderer.domElement.toDataURL('image/webp',.68);
  }finally{
    geometries.forEach(g=>g.dispose());
    disposeMaterials(materials);
    fallbacks.forEach(m=>m.dispose());
  }
}

function thumbnail(gameDir:string,file:ModelFile){
  const key=`${gameDir}|${file.source}|${file.path}`;
  if(thumbs.has(key))return Promise.resolve(thumbs.get(key)!);
  if(thumbJobs.has(key))return thumbJobs.get(key)!;
  const job=thumbQueue.then(async()=>{
    const data=await loadModelPreview(gameDir,file);
    const url=snapshot(data);thumbs.set(key,url);
    while(thumbs.size>100)thumbs.delete(thumbs.keys().next().value!);
    return url;
  });
  thumbQueue=job.then(()=>{},()=>{});
  thumbJobs.set(key,job);
  void job.finally(()=>thumbJobs.delete(key)).catch(()=>{});
  return job;
}
function ModelThumb({file,gameDir}:{file:ModelFile;gameDir:string}){
  const t=useT();
  const target=useRef<HTMLSpanElement>(null),[url,setUrl]=useState(''),[failed,setFailed]=useState(false);
  useEffect(()=>{
    let active=true;setUrl('');setFailed(false);const element=target.current;if(!element||!gameDir)return;
    const observer=new IntersectionObserver(entries=>{
      if(!entries.some(e=>e.isIntersecting))return;
      observer.disconnect();
      void thumbnail(gameDir,file).then(result=>{if(active)setUrl(result)}).catch(()=>{if(active)setFailed(true)});
    },{root:element.closest('.model-results'),rootMargin:'65px',threshold:.01});
    observer.observe(element);
    return()=>{active=false;observer.disconnect()};
  },[gameDir,file.path,file.source]);
  return <span ref={target} className={`model-thumb ${failed?'model-thumb-failed':''}`}>{url?<img src={url} loading="lazy" alt=""/>:failed?<span className="model-thumb-fallback"><Box size={18}/>{t('Preview unavailable')}</span>:<Box size={22}/>}</span>;
}
function readFavorites(){
  try{return new Set<string>(JSON.parse(localStorage.getItem('svstudio-model-favorites')||'[]'))}catch{return new Set<string>()}
}
export function ModelBrowser(){
  const t=useT();const gameDir=useEditor(s=>s.settings.gameDir);
  const selected=useEditor(s=>s.project.objects.find(o=>o.id===s.selected));
  const setProp=useEditor(s=>s.setObjectProp),appendLogs=useEditor(s=>s.appendLogs);
  const [query,setQuery]=useState(''),[files,setFiles]=useState<ModelFile[]>([]),[total,setTotal]=useState(0),[loading,setLoading]=useState(false),[error,setError]=useState('');
  const [focused,setFocused]=useState<ModelFile|null>(null);
  const [grid,setGrid]=useState(()=>localStorage.getItem('svstudio-model-grid')==='true');
  const [favorites,setFavorites]=useState<Set<string>>(readFavorites);
  const [onlyFavorites,setOnlyFavorites]=useState(false);
  const [visibleLimit,setVisibleLimit]=useState(48);
  const favoriteKey=(file:ModelFile)=>file.source+'|'+file.path;
  const [manualRefresh,setManualRefresh]=useState(0);
  const forceRef=useRef(false);
  const latestRequest=useRef(0);
  // React and locale re-renders must never re-start an inventory scan.
  // Only gameDir, search text, or the actual Refresh button can request data.
  useEffect(()=>{
    const request=++latestRequest.current;
    const controller=new AbortController();
    if(!gameDir){setLoading(false);setFiles([]);setTotal(0);return()=>{controller.abort()}}
    const timeout=setTimeout(()=>{
      const force=forceRef.current;forceRef.current=false;
      setLoading(true);setError('');
      void postModelJson('/api/assets/models',{gameDir,query,limit:400,refresh:force},controller.signal)
        .then(data=>{
          if(request===latestRequest.current&&!controller.signal.aborted){
            setFiles(data.items);setTotal(data.total);
          }
        })
        .catch(cause=>{
          if(!controller.signal.aborted&&request===latestRequest.current)setError(String(cause));
        })
        .finally(()=>{if(!controller.signal.aborted&&request===latestRequest.current)setLoading(false)});
    },manualRefresh>0?0:250);
    return()=>{clearTimeout(timeout);controller.abort()};
  },[gameDir,query,manualRefresh]);
  const toggleFavorite=(file:ModelFile)=>{const key=favoriteKey(file);setFavorites(previous=>{
    const next=new Set(previous);if(next.has(key))next.delete(key);else next.add(key);
    localStorage.setItem('svstudio-model-favorites',JSON.stringify([...next]));return next;});};
  const filtered=useMemo(()=>onlyFavorites?files.filter(f=>favorites.has(f.source+'|'+f.path)):files,[files,onlyFavorites,favorites]);
  const displayed=useMemo(()=>filtered.slice(0,visibleLimit),[filtered,visibleLimit]);
  useEffect(()=>setVisibleLimit(48),[query,gameDir,onlyFavorites]);
  const apply=(file:ModelFile)=>{
    if(!selected||selected.kind!=='entity'){setError(t('Select a point entity first to apply its model.'));return}
    setProp(selected.id,'model',file.path);appendLogs([`Assigned model ${file.path} to ${selected.classname}. Ensure the entity supports the model key in Sven Co-op.`]);setFocused(null);
  };
  return <div className="model-browser">
    <div className="model-head"><strong><Package size={15}/> Svengine Models</strong>
      <div className="model-view-switch">
        <button title={t('List view')} className={!grid?'active':''} onClick={()=>{setGrid(false);localStorage.setItem('svstudio-model-grid','false')}}><List size={15}/></button>
        <button title={t('Grid thumbnails')} className={grid?'active':''} onClick={()=>{setGrid(true);localStorage.setItem('svstudio-model-grid','true')}}><Grid2X2 size={15}/></button>
        <button title={t('Only favorites')} className={onlyFavorites?'active':''} onClick={()=>setOnlyFavorites(v=>!v)}><Star size={15}/></button>
        <button title={t('Rescan models')} onClick={()=>{forceRef.current=true;setManualRefresh(n=>n+1)}}><RefreshCw size={15}/></button>
      </div></div>
    <label className="model-search"><Search size={15}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search models/*.mdl"/></label>
    <p className="model-caption">{loading?'Scanning Sven Co-op…':`${filtered.length} / ${total} models · Scan complete`} · Addon / Downloads / Base</p>
    <p className="model-caption">{t('Drag a model onto the viewport to place an item_generic entity. Thumbnails load on demand.')}</p>
    {error&&<div className="model-error"><AlertTriangle size={15}/> {error}</div>}
    <div className={grid?'model-results model-grid':'model-results'}>{displayed.map(file=><div className="model-result" key={file.source+'/'+file.path}>
      <button className="model-open" title="Open preview (drag to viewport to place an item_generic)" draggable
        onDragStart={e=>{e.dataTransfer.setData('application/x-svenstudio-model',file.path);e.dataTransfer.effectAllowed='copy'}}
        onClick={()=>setFocused(file)}>
        {grid?<ModelThumb file={file} gameDir={gameDir}/>:<Box size={15}/>}
        <span><strong>{file.name}</strong><small title={file.source+'/'+file.path}>{file.source} / {file.path}</small></span>{!grid&&<Eye size={13}/>}</button>
      <div className="model-item-actions">
        <button title={t('Favorite')} className={favorites.has(favoriteKey(file))?'favorite-active':''} onClick={()=>toggleFavorite(file)}><Star size={13} fill={favorites.has(favoriteKey(file))?'currentColor':'none'}/></button>
        <button title={t('Apply to selected entity')} disabled={selected?.kind!=='entity'} onClick={()=>apply(file)}><Layers size={14}/></button>
      </div>
    </div>)}</div>
    {filtered.length>visibleLimit&&<button className="model-load-more" onClick={()=>setVisibleLimit(n=>n+48)}>{t('Show more models')} ({Math.min(visibleLimit,filtered.length)} / {filtered.length})</button>}
    {focused&&<ModelPreviewModal file={focused} gameDir={gameDir} onClose={()=>setFocused(null)} onAssign={()=>apply(focused)}/>}
  </div>;
}
