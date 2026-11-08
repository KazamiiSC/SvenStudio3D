import {useEffect,useMemo,useRef,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {X,RefreshCcw,Maximize2,Minimize2,Settings2,CheckCircle2,Sun,Layers3,AlertTriangle,Info,ScanEye} from 'lucide-react';
import type {BspMap} from '../engine/bsp';
import type {TextureAsset} from '../engine/types';
import {BspNavigation,BspSurface} from './BspViewer';
import {BspSkyBackground,type BspAssetStatus} from './BspViewerAssets';
import {bspLightstyleStats} from '../engine/bspLighting';
import {inspectBspLighting} from '../engine/bspLightingDiagnostics';
import {fetchBspAutoWads,autoWadTexturesToAssets} from '../engine/bspAutoWad';
import {useEditor} from '../store';
import {DEFAULT_GOLDSRC_PREVIEW} from '../engine/previewEnhancements';
import type {BspCameraView} from '../engine/bspViewerTools';
import {readBspFog,normalizeBspDisplayGamma,type BspLightFilter} from '../engine/bspPresentation';

/** A second viewport INSIDE the MAP workspace. It never changes editable MAP
 * objects: scene geometry and RGB irradiance come entirely from the latest
 * temporary SC-RAD BSP, not an approximation of editor lights. */
export function TrueLightingPreview({map,working,stale,status,layout,onBuild,onClose,onToggleLayout,onOpenBsp}:{
  map:BspMap|null;working:boolean;stale:boolean;status:string;layout:'split'|'full';
  onBuild:()=>void;onClose:()=>void;onToggleLayout:()=>void;onOpenBsp:()=>void;
}){
  const imported=useEditor(s=>s.textureAssets);
  const gameDir=useEditor(s=>s.settings.gameDir);
  const [automated,setAutomated]=useState<TextureAsset[]>([]);
  const [skyStatus,setSkyStatus]=useState<BspAssetStatus>('off');
  const [texturesStatus,setTexturesStatus]=useState('');
  const [settingsOpen,setSettingsOpen]=useState(false);
  const settingsRef=useRef<HTMLDivElement|null>(null);
  const settingsButtonRef=useRef<HTMLButtonElement|null>(null);
  useEffect(()=>{
    if(!settingsOpen)return;
    const outside=(event:PointerEvent)=>{
      if(!settingsRef.current?.contains(event.target as Node)&&!settingsButtonRef.current?.contains(event.target as Node))setSettingsOpen(false);
    };
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')setSettingsOpen(false)};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)};
  },[settingsOpen]);
  const [gain,setGain]=useState(1);
  const [displayGamma,setDisplayGamma]=useState(1);
  const [lightFilter,setLightFilter]=useState<BspLightFilter>('linear');
  const bspFog=useMemo(()=>readBspFog(map?.entities||[]),[map]);
  const [fogEnabled,setFogEnabled]=useState(false);
  useEffect(()=>setFogEnabled(bspFog?.initiallyEnabled??false),[bspFog]);
  const effectiveFog=fogEnabled?bspFog:null;
  const [styleFrame,setStyleFrame]=useState(0);
  const [wireframe,setWireframe]=useState(false);
  const [surfaceOnly,setSurfaceOnly]=useState(false);
  useEffect(()=>setSurfaceOnly(false),[map]);
  const [cameraView,setCameraView]=useState<BspCameraView>('interior');
  const flyRef=useRef<HTMLCanvasElement|null>(null);
  const [reset,setReset]=useState(0);
  const assets=useMemo(()=>[...automated,...imported],[automated,imported]);
  const stats=useMemo(()=>bspLightstyleStats(map?.faces||[]),[map]);
  const lightingAudit=useMemo(()=>map?inspectBspLighting(map.faces,map.entities,styleFrame):null,[map,styleFrame]);
  const missingNames=useMemo(()=>{
    if(!map)return [];
    const included=new Set(imported.map(item=>item.name.toLowerCase()));
    return [...new Set(map.textures.filter(item=>item.external&&!included.has(item.name.toLowerCase())).map(item=>item.name))];
  },[map,imported]);
  useEffect(()=>{
    const abort=new AbortController();let active=true;
    setAutomated([]);setTexturesStatus('');
    if(!map||!missingNames.length)return()=>{active=false;abort.abort()};
    if(!gameDir){setTexturesStatus('External WAD textures are missing. Configure the Sven Co-op game directory.');return()=>{active=false;abort.abort()}}
    setTexturesStatus('Loading external WAD textures…');
    void fetchBspAutoWads(gameDir,map.wadNames,missingNames,abort.signal,progress=>{
      if(active)setAutomated(autoWadTexturesToAssets(progress.textures));
    }).then(result=>{if(active)setTexturesStatus(result.limited?'WAD scan reached its safety limit; some textures may be missing.':'External WAD scan finished.')})
    .catch(error=>{if(active&&!abort.signal.aborted)setTexturesStatus(`WAD scan: ${String(error)}`)});
    return()=>{active=false;abort.abort()};
  },[map,gameDir,missingNames]);
  return <section className="true-light-panel" aria-label="True Lighting Preview">
    <header className="true-light-toolbar">
      <strong><Sun size={16}/> True Lighting <span className="true-light-version">{surfaceOnly?'UNLIT':'SC-RAD'}</span></strong>
      <div className="true-light-toolbar-actions">
        <button onClick={onBuild} disabled={working} title="Rebuild temporary SC-RAD BSP" aria-label="Rebuild True Lighting"><RefreshCcw size={15}/></button>
        <button ref={settingsButtonRef} className={settingsOpen?'enabled':''} onClick={()=>setSettingsOpen(v=>!v)} aria-expanded={settingsOpen} aria-controls="true-light-settings" aria-label="True Lighting settings" title="Camera and lighting settings"><Settings2 size={15}/></button>
        <button onClick={onToggleLayout} title={layout==='split'?'Expand preview in MAP workspace':'Return to split view'} aria-label={layout==='split'?'Full True Lighting view':'Split True Lighting view'}>{layout==='split'?<Maximize2 size={15}/>:<Minimize2 size={15}/>}</button>
        <button onClick={onClose} title="Close True Lighting (reopen from Visualization)" aria-label="Close True Lighting"><X size={16}/></button>
      </div>
    </header>
    <div className="true-light-body">
      {map?<Canvas camera={{position:[480,350,550],fov:65,near:.25,far:200000}} dpr={[1,1.35]} gl={{antialias:true,powerPreference:'high-performance'}}>
        <color attach="background" args={[map.skyname?'#58758b':'#172532']}/>
        {map.skyname&&<BspSkyBackground map={map} gameDir={gameDir} onStatus={setSkyStatus}/>}
        <BspSurface map={map} assets={assets} lightmaps={!surfaceOnly} surfaceOnly={surfaceOnly} wireframe={wireframe} brightness={gain} baked={!surfaceOnly} styleFrame={styleFrame} fog={surfaceOnly?null:effectiveFog} displayGamma={displayGamma} lightFilter={lightFilter} preview={DEFAULT_GOLDSRC_PREVIEW}/>
        <BspNavigation map={map} fly={false} reset={reset} flyRef={flyRef} speed={360} sensitivity={.002} smooth focus={null} view={cameraView}/>
      </Canvas>:<div className="true-light-empty"><Sun size={32}/><strong>{working?'Compiling lightmaps…':'No SC-RAD preview yet'}</strong><span>{status||'Choose Rebuild to bake the current MAP without installing a BSP in Sven Co-op.'}</span></div>}
      {working&&<div className="true-light-progress" role="status"><span className="pulse-dot"/>{status||'Running Sven Co-op compilers…'}</div>}
      {!working&&/^(Build error:|SC-RAD preview failed)/.test(status)&&<div className="true-light-progress true-light-error" role="alert"><AlertTriangle size={14}/>{status}</div>}
      {stale&&map&&<div className="true-light-stale" role="status"><AlertTriangle size={14}/> MAP changed since this bake. Rebuild to update lighting.</div>}
      {map&&<span className="true-light-canvas-help">{cameraView==='interior'?'Inside BSP / player spawn':'Outside BSP'} · LMB orbit · RMB pan · Wheel zoom</span>}
    </div>
    <footer className="true-light-footer" role="status">
      <span className={stale?'true-light-footer-stale':''}>{working?'SC-RAD compiling…':stale?'MAP changed · rebuild needed':map?'Compiled lighting up to date':'No compiled preview'}</span>
      <span>{surfaceOnly?'Unlit inspection':'Baked RGB'}</span>
    </footer>
    {settingsOpen&&<div className="true-light-settings" id="true-light-settings" ref={settingsRef} role="group" aria-label="True Lighting settings" onPointerDown={event=>event.stopPropagation()}>
      <div className="true-light-settings-heading"><strong>Vista y calibración</strong><button type="button" aria-label="Close settings" onClick={()=>setSettingsOpen(false)}><X size={14}/></button></div>
      <div className="true-light-camera-presets" role="group" aria-label="BSP camera position">
        <button className={cameraView==='interior'?'enabled':''} onClick={()=>{setCameraView('interior');setReset(n=>n+1)}}>Interior</button>
        <button className={cameraView==='overview'?'enabled':''} onClick={()=>{setCameraView('overview');setReset(n=>n+1)}}>Exterior</button>
      </div>
      <button type="button" className="true-light-open-bsp" disabled={!map} onClick={()=>{setSettingsOpen(false);onOpenBsp()}}><ScanEye size={14}/> Open in BSP Viewer</button>
    <div className="true-light-options">
      <label><span>Lightmap gain <b>{gain.toFixed(2)}×</b></span><input type="range" min="0.5" max="2" step="0.05" value={gain} onChange={event=>setGain(Number(event.target.value))}/></label>
      <div className="true-light-actions"><button className={surfaceOnly?'enabled':''} onClick={()=>setSurfaceOnly(v=>!v)} title="Diagnostic: show WAD textures without compiled lighting">{surfaceOnly?'Return to compiled RGB':'Inspect geometry (unlit)'}</button><button onClick={()=>{setGain(1);setDisplayGamma(1);setLightFilter('linear');setFogEnabled(bspFog?.initiallyEnabled??false);setStyleFrame(0);setReset(n=>n+1)}}><RefreshCcw size={13}/> Reset calibration</button><button className={wireframe?'enabled':''} onClick={()=>setWireframe(v=>!v)}><Layers3 size={13}/> Wire</button></div>
      {bspFog&&<label className="true-light-fog-toggle"><span><input type="checkbox" checked={fogEnabled} onChange={e=>setFogEnabled(e.target.checked)}/> BSP env_fog <b>{fogEnabled?'ON':'OFF'}</b></span><small>RGB {bspFog.color.join(' ')} · start {bspFog.start}u · end {bspFog.end}u{bspFog.initiallyEnabled?'':' · initially off'} · static preview (triggers not simulated).</small></label>}
      <label><span>Display gamma <b>{displayGamma.toFixed(2)}×</b></span><input type="range" min="0.65" max="1.6" step="0.05" value={displayGamma} onChange={e=>setDisplayGamma(normalizeBspDisplayGamma(Number(e.target.value)))}/><small>1.00 is neutral; visual calibration only, not SC-RAD rad_gamma.</small></label>
      <label><span>Lightmap filtering <b>{lightFilter==='linear'?'smooth':'nearest'}</b></span><select value={lightFilter} onChange={e=>setLightFilter(e.target.value as BspLightFilter)}><option value="linear">Smooth (bilinear)</option><option value="nearest">Pixelated (nearest)</option></select></label>
      {!!map&&stats.animatedFaces>0&&<label><span>Lightstyle snapshot <b>frame {styleFrame}/63</b></span><input type="range" min="0" max="63" value={styleFrame} onChange={event=>setStyleFrame(Number(event.target.value))}/><small>{stats.animatedFaces} faces with styled lights; use this slider to examine a single lighting frame.</small></label>}
      {map&&<p><Info size={13}/> {map.stats.lightmappedFaces.toLocaleString()} faces with compiled lighting · {map.faces.length.toLocaleString()} total.</p>}
      {lightingAudit&&<p role="status">SC-RAD RGB · {lightingAudit.zeroFaces} all-black faces · mean {lightingAudit.average.toFixed(1)}/255 · peak {lightingAudit.peak}/255.</p>}
      {lightingAudit?.status==='black'&&<p role="alert">All compiled light samples are black. This is BSP data, not a camera problem. Inspect geometry to confirm surfaces; then examine the SC-RAD output and light entities.</p>}
      {lightingAudit?.status==='missing'&&<p role="alert">No readable RGB light samples in this BSP. Check SC-RAD build output.</p>}
      {lightingAudit?.status==='very-dark'&&<p role="alert">Compiled lighting is nearly black. Inspect SC-RAD output, light entities and geometry; use geometry inspection only for visibility.</p>}
      {texturesStatus&&<p>{texturesStatus}</p>}
      {map?.skyname&&skyStatus!=='ready'&&<p>Skybox {map.skyname}: {skyStatus}. Configure the Sven Co-op game folder if sky faces are missing.</p>}
      <p className="true-light-caveat">{surfaceOnly?'Geometry inspection is UNLIT and does not represent compiled lighting. ':''}Compiled RGB samples from the BSP; fog and screen gamma are optional visual presentation only, and do not modify the bake. Engine gameplay triggers, player fog settings, palettes and lightstyle timing are not reproduced.</p>
    </div>
    </div>}
  </section>;
}
