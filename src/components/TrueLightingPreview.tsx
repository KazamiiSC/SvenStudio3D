import {useEffect,useMemo,useRef,useState} from 'react';
import {Canvas} from '@react-three/fiber';
import {X,RefreshCcw,Maximize2,Minimize2,Settings2,CheckCircle2,Sun,Layers3,AlertTriangle,Info,ScanEye,Move3D} from 'lucide-react';
import type {BspMap} from '../engine/bsp';
import type {TextureAsset} from '../engine/types';
import {BspNavigation,BspSurface} from './BspViewer';
import {BspSkyBackground,type BspAssetStatus} from './BspViewerAssets';
import {bspLightstyleStats} from '../engine/bspLighting';
import {inspectBspLighting} from '../engine/bspLightingDiagnostics';
import {fetchBspAutoWads,autoWadTexturesToAssets} from '../engine/bspAutoWad';
import {useEditor} from '../store';
import {useT} from '../i18n';
import {DEFAULT_GOLDSRC_PREVIEW} from '../engine/previewEnhancements';
import type {BspCameraView} from '../engine/bspViewerTools';
import {readBspFog,normalizeBspDisplayGamma,type BspLightFilter} from '../engine/bspPresentation';
import {lightingCompilerLabel} from '../engine/trueLightingCompiler';

/** A second viewport INSIDE the MAP workspace. It never changes editable MAP
 * objects: scene geometry and RGB irradiance come entirely from the latest
 * temporary SC-RAD or SDHLT BSP, not an approximation of editor lights. */
export function TrueLightingPreview({map,compilerLabel,working,stale,status,layout,onBuild,onClose,onToggleLayout,onOpenBsp}:{
  map:BspMap|null;compilerLabel:string;working:boolean;stale:boolean;status:string;layout:'split'|'full';
  onBuild:(engine:'sc'|'sdhlt')=>void;onClose:()=>void;onToggleLayout:()=>void;onOpenBsp:()=>void;
}){
  const t=useT();
  const imported=useEditor(s=>s.textureAssets);
  const gameDir=useEditor(s=>s.settings.gameDir);
  const settings=useEditor(s=>s.settings);
  const setSettings=useEditor(s=>s.setSettings);
  const selectedLabel=lightingCompilerLabel(settings.compilerEngine);
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
  const [fly,setFly]=useState(false);
  const [confirmBuild,setConfirmBuild]=useState(false);
  const [pendingEngine,setPendingEngine]=useState<'sc'|'sdhlt'>(settings.compilerEngine==='sdhlt'?'sdhlt':'sc');
  const requestBuild=()=>{if(working)return;setPendingEngine(settings.compilerEngine==='sdhlt'?'sdhlt':'sc');setSettingsOpen(false);setConfirmBuild(true)};
  const acceptBuild=()=>{if(working)return;setSettings({compilerEngine:pendingEngine});setConfirmBuild(false);onBuild(pendingEngine)};
  // Expanding is a direct click: request pointer lock in that same gesture.
  // The MAP viewport is hidden in expanded layout and must not own WASD.
  const toggleExpanded=()=>{
    if(layout==='full'){
      if(document.pointerLockElement===flyRef.current)document.exitPointerLock?.();
      setFly(false);
      onToggleLayout();
      return;
    }
    // Request capture directly; Chrome can transfer it from MAP to BSP.
    onToggleLayout();
    const canvas=flyRef.current;
    if(canvas?.requestPointerLock){
      // Setting fly immediately lets the BSP navigator subscribe to WASD;
      // pointerlockchange will reset it if the browser refuses capture.
      setFly(true);
      try{
        const result=canvas.requestPointerLock();
        if(result && typeof result.catch==='function')void result.catch(()=>setFly(false));
      }catch{setFly(false);}
    }
  };
  useEffect(()=>{
    if(layout!=='full'&&fly){
      if(document.pointerLockElement===flyRef.current)document.exitPointerLock?.();
      setFly(false);
    }
  },[layout]);
  const beginFly=()=>{
    if(!map)return;
    if(fly){if(document.pointerLockElement===flyRef.current)document.exitPointerLock?.();setFly(false);return;}
    const canvas=flyRef.current;
    if(!canvas)return;
    canvas.requestPointerLock?.().then(()=>setFly(true)).catch(()=>setFly(false));
  };
  useEffect(()=>{
    const sync=()=>{if(document.pointerLockElement!==flyRef.current)setFly(false)};
    document.addEventListener('pointerlockchange',sync);
    return()=>document.removeEventListener('pointerlockchange',sync);
  },[]);
  // Chrome may reserve Escape while both Fullscreen and Pointer Lock are active.
  // Handle it in capture phase whenever it reaches the page, before MAP shortcuts.
  // F8 is an explicit fallback if the browser never delivers Escape.
  useEffect(()=>{
    if(!fly)return;
    const release=(event:KeyboardEvent)=>{
      if(event.code!=='Escape'&&event.code!=='F8')return;
      if(document.pointerLockElement!==flyRef.current)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      document.exitPointerLock?.();
      setFly(false);
    };
    window.addEventListener('keydown',release,true);
    // Some fullscreen configurations only deliver Escape on key release.
    window.addEventListener('keyup',release,true);
    return()=>{
      window.removeEventListener('keydown',release,true);
      window.removeEventListener('keyup',release,true);
    };
  },[fly]);
  useEffect(()=>()=>{if(document.pointerLockElement===flyRef.current)document.exitPointerLock?.()},[]);
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
      <strong><Sun size={16}/> True Lighting <span className="true-light-version">{surfaceOnly?'UNLIT':map?compilerLabel:selectedLabel}</span></strong>
      <div className="true-light-toolbar-actions">
        <button onClick={requestBuild} disabled={working} title={`${t("Rebuild temporary BSP (confirmation required)")} · ${selectedLabel}`} aria-label={t("Rebuild True Lighting")}><RefreshCcw size={15}/></button>
        <button className={fly?'enabled':''} onClick={beginFly} disabled={!map} title={t(fly?"Stop WASD free camera (Esc / F8)":"Free camera: WASD move, Q/E up/down, Shift fast, mouse look (Esc releases)")} aria-label={t("True Lighting fly WASD")}><Move3D size={15}/></button>
        <button ref={settingsButtonRef} className={settingsOpen?'enabled':''} onClick={()=>setSettingsOpen(v=>!v)} aria-expanded={settingsOpen} aria-controls="true-light-settings" aria-label={t("True Lighting settings")} title={t("Camera and lighting settings")}><Settings2 size={15}/></button>
        <button onClick={toggleExpanded} title={t(layout==='split'?"Expand preview in MAP workspace":"Return to split view")} aria-label={t(layout==='split'?"Full True Lighting view":"Split True Lighting view")}>{layout==='split'?<Maximize2 size={15}/>:<Minimize2 size={15}/>}</button>
        <button onClick={onClose} title={t("Close True Lighting (reopen from Studios)")} aria-label={t("Close True Lighting")}><X size={16}/></button>
      </div>
    </header>
    <div className="true-light-body">
      {map?<Canvas camera={{position:[480,350,550],fov:65,near:.25,far:200000}} dpr={[1,1.35]} gl={{antialias:true,powerPreference:'high-performance'}}>
        <color attach="background" args={[map.skyname?'#58758b':'#172532']}/>
        {map.skyname&&<BspSkyBackground map={map} gameDir={gameDir} onStatus={setSkyStatus}/>}
        <BspSurface map={map} assets={assets} lightmaps={!surfaceOnly} surfaceOnly={surfaceOnly} wireframe={wireframe} brightness={gain} baked={!surfaceOnly} styleFrame={styleFrame} fog={surfaceOnly?null:effectiveFog} displayGamma={displayGamma} lightFilter={lightFilter} preview={DEFAULT_GOLDSRC_PREVIEW}/>
        <BspNavigation map={map} fly={fly} reset={reset} flyRef={flyRef} speed={360} sensitivity={.002} smooth focus={null} view={cameraView}/>
      </Canvas>:<div className="true-light-empty"><Sun size={32}/><strong>{working?t('Compiling lightmaps…'):`${t('No compiled preview for')} ${selectedLabel}`}</strong><span>{status||t('Choose Rebuild to bake the current MAP without installing a BSP in Sven Co-op.')}</span></div>}
      {confirmBuild&&<div className="true-light-build-overlay" role="presentation" onPointerDown={event=>event.stopPropagation()}>
        <div className="true-light-build-dialog" role="dialog" aria-modal="true" aria-label={t("Confirm True Lighting compilation")}>
          <strong><AlertTriangle size={17}/> {t("Compile True Lighting?")}</strong>
          <p>{t("This will compile a temporary BSP and bake the lighting. It may take some time, and the editor or your computer may run more slowly until the process finishes.")}</p>
          <label>{t("Choose compiler before compiling")}
            <select autoFocus value={pendingEngine} onChange={event=>setPendingEngine(event.target.value as 'sc'|'sdhlt')}>
              <option value="sc">Sven Co-op SDK (SC-RAD)</option>
              <option value="sdhlt">SDHLT — {t("Experimental")}</option>
            </select>
          </label>
          <small>{t("The generated preview is read-only. It does not replace the BSP installed in Sven Co-op. SDHLT uses the configured AO and PCF settings.")}</small>
          <div className="true-light-build-buttons">
            <button type="button" onClick={()=>setConfirmBuild(false)}>{t("Cancel")}</button>
            <button type="button" disabled={working} onClick={acceptBuild}>{t("Compile lighting")}</button>
          </div>
        </div>
      </div>}
      {working&&<div className="true-light-progress" role="status"><span className="pulse-dot"/>{status||`${t('Running compilers…')} ${selectedLabel}`}</div>}
      {!working&&/^(Build error:|(?:SC-RAD|SDHLT) preview failed)/.test(status)&&<div className="true-light-progress true-light-error" role="alert"><AlertTriangle size={14}/>{status}</div>}
      {stale&&map&&<div className="true-light-stale" role="status"><AlertTriangle size={14}/> {t("MAP changed or compiler settings changed since this bake. Rebuild to update lighting.")}</div>}
      {map&&<span className="true-light-canvas-help">{cameraView==='interior'?t('Inside BSP / player spawn'):t('Outside BSP')} · {t(fly?'WASD move · Q/E vertical · Shift fast · Mouse look · Esc releases':'LMB orbit · RMB pan · Wheel zoom · Fly: WASD')}</span>}
    </div>
    <footer className="true-light-footer" role="status">
      <span className={stale?'true-light-footer-stale':''}>{working?`${selectedLabel} ${t('compiling…')}`:stale?t('MAP / compiler changed · rebuild needed'):map?`${compilerLabel} ${t('baked lightmaps')}`:t('No compiled preview')}</span>
      <span>{t(surfaceOnly?'Unlit inspection':'Baked RGB')}</span>
    </footer>
    {settingsOpen&&<div className="true-light-settings" id="true-light-settings" ref={settingsRef} role="group" aria-label="True Lighting settings" onPointerDown={event=>event.stopPropagation()}>
      <div className="true-light-settings-heading"><strong>{t("Compiled lighting / calibration")}</strong><button type="button" aria-label={t("Close settings")} onClick={()=>setSettingsOpen(false)}><X size={14}/></button></div>
      <div className="true-light-compiler-options" role="group" aria-label={t("True Lighting compiler")}>
        <label>{t("Compiler profile")}
          <select value={settings.compilerEngine||'sc'} disabled={working} onChange={event=>setSettings({compilerEngine:event.target.value as 'sc'|'sdhlt'})}>
            <option value="sc">Sven Co-op SDK — SC-RAD</option>
            <option value="sdhlt">SDHLT — {t("Experimental")}</option>
          </select>
        </label>
        {settings.compilerEngine==='sdhlt'&&<>
          <label className="true-light-compiler-check"><input type="checkbox" checked={!!settings.sdhltAO} disabled={working} onChange={event=>setSettings({sdhltAO:event.target.checked})}/> {t("Ambient Occlusion (-ao)")}</label>
          <label>{t("SDHLT PCF shadow filtering")}
            <select value={settings.sdhltPCF||'off'} disabled={working} onChange={event=>setSettings({sdhltPCF:event.target.value as 'off'|'1'|'2'|'4'})}>
              <option value="off">{t("Off")}</option><option value="1">1</option><option value="2">2</option><option value="4">4</option>
            </select>
          </label>
          <small>{t("Requires SDHLT compiler folder and sdhlt.wad in Build Configuration. AO and PCF are baked by SDHLRAD, not simulated by the browser.")}</small>
        </>}
        <small>{t('Current baked source:')} {map?compilerLabel:t('none')}. {t('Changing profile or bake options marks the previous BSP as outdated; press Rebuild to compare.')}</small>
      </div>
      <div className="true-light-camera-presets" role="group" aria-label={t("BSP camera position")}>
        <button className={cameraView==='interior'?'enabled':''} onClick={()=>{setCameraView('interior');setReset(n=>n+1)}}>{t("Interior")}</button>
        <button className={cameraView==='overview'?'enabled':''} onClick={()=>{setCameraView('overview');setReset(n=>n+1)}}>{t("Exterior")}</button>
      </div>
      <button type="button" className="true-light-open-bsp" disabled={!map} onClick={()=>{setSettingsOpen(false);onOpenBsp()}}><ScanEye size={14}/> {t("Open in BSP Viewer")}</button>
    <div className="true-light-options">
      <label><span>{t("Lightmap gain")} <b>{gain.toFixed(2)}×</b></span><input type="range" min="0.5" max="2" step="0.05" value={gain} onChange={event=>setGain(Number(event.target.value))}/></label>
      <div className="true-light-actions"><button className={surfaceOnly?'enabled':''} onClick={()=>setSurfaceOnly(v=>!v)} title={t("Diagnostic: show WAD textures without compiled lighting")}>{t(surfaceOnly?'Return to compiled RGB':'Inspect geometry (unlit)')}</button><button onClick={()=>{setGain(1);setDisplayGamma(1);setLightFilter('linear');setFogEnabled(bspFog?.initiallyEnabled??false);setStyleFrame(0);setReset(n=>n+1)}}><RefreshCcw size={13}/> {t("Reset calibration")}</button><button className={wireframe?'enabled':''} onClick={()=>setWireframe(v=>!v)}><Layers3 size={13}/> {t("Wire")}</button></div>
      {bspFog&&<label className="true-light-fog-toggle"><span><input type="checkbox" checked={fogEnabled} onChange={e=>setFogEnabled(e.target.checked)}/> BSP env_fog <b>{t(fogEnabled?'ON':'OFF')}</b></span><small>RGB {bspFog.color.join(' ')} · start {bspFog.start}u · end {bspFog.end}u{bspFog.initiallyEnabled?'':' · initially off'} · {t("static preview (triggers not simulated).")}</small></label>}
      <label><span>{t("Display gamma")} <b>{displayGamma.toFixed(2)}×</b></span><input type="range" min="0.65" max="1.6" step="0.05" value={displayGamma} onChange={e=>setDisplayGamma(normalizeBspDisplayGamma(Number(e.target.value)))}/><small>{t("1.00 is neutral; visual calibration only, not SC-RAD rad_gamma.")}</small></label>
      <label><span>{t("Lightmap filtering")} <b>{t(lightFilter==='linear'?'smooth':'nearest')}</b></span><select value={lightFilter} onChange={e=>setLightFilter(e.target.value as BspLightFilter)}><option value="linear">{t("Smooth (bilinear)")}</option><option value="nearest">{t("Pixelated (nearest)")}</option></select></label>
      {!!map&&stats.animatedFaces>0&&<label><span>{t("Lightstyle snapshot")} <b>{t("frame")} {styleFrame}/63</b></span><input type="range" min="0" max="63" value={styleFrame} onChange={event=>setStyleFrame(Number(event.target.value))}/><small>{stats.animatedFaces} {t("faces with styled lights; use this slider to examine a single lighting frame.")}</small></label>}
      {map&&<p><Info size={13}/> {map.stats.lightmappedFaces.toLocaleString()} {t("faces with compiled lighting")} · {map.faces.length.toLocaleString()} {t("total")}.</p>}
      {lightingAudit&&<p role="status">{compilerLabel} RGB · {lightingAudit.zeroFaces} {t("all-black faces")} · {t("mean")} {lightingAudit.average.toFixed(1)}/255 · {t("peak")} {lightingAudit.peak}/255.</p>}
      {lightingAudit?.status==='black'&&<p role="alert">{t("All compiled light samples are black. This is BSP data, not a camera problem. Inspect geometry to confirm surfaces; then examine the compiler output and light entities.")}</p>}
      {lightingAudit?.status==='missing'&&<p role="alert">{t("No readable RGB light samples in this BSP. Check compiler build output.")}</p>}
      {lightingAudit?.status==='very-dark'&&<p role="alert">{t("Compiled lighting is nearly black. Inspect compiler output, light entities and geometry; use geometry inspection only for visibility.")}</p>}
      {texturesStatus&&<p>{texturesStatus}</p>}
      {map?.skyname&&skyStatus!=='ready'&&<p>Skybox {map.skyname}: {skyStatus}. {t("Configure the Sven Co-op game folder if sky faces are missing.")}</p>}
      <p className="true-light-caveat">{surfaceOnly?t('Geometry inspection is UNLIT and does not represent compiled lighting. '):''}{t("Compiled RGB samples from the BSP; fog and screen gamma are optional visual presentation only, and do not modify the bake. AO and PCF only appear if enabled during SDHLRAD compilation; lightmap filtering here is a display choice, not PCF. Engine gameplay triggers, player fog settings, palettes and lightstyle timing are not reproduced.")}</p>
    </div>
    </div>}
  </section>;
}
