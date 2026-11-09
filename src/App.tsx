import {useEffect,useRef,useState} from 'react';
import type React from 'react';
import {Hammer,Box,Move3D,Rotate3D,Scaling,Magnet,Grid3x3,Paintbrush,Eye,Undo2,Redo2,Save,FolderOpen,FilePlus2,PackagePlus,Play,StopCircle,Settings2,ChevronDown,Layers,MonitorCog,Mountain,FileDown,FileUp,Info,Clapperboard,CheckCircle2,AlertTriangle,Terminal,SunMoon,ShieldCheck,Copy,Trash2,Keyboard,Globe2,Menu,FileCode2,LayoutTemplate,Palette,GitBranch,Skull,Headphones,Ruler,Users,ScanEye,Ghost,EyeOff,Maximize2,Minimize2,HardDrive} from 'lucide-react';
import {useEditor} from './store';
import {ensureSvenCoopFgd} from './engine/svenFgdLoader';
import {useArchitectureMode} from './architectureModeState';
import {DockWorkspace,LayoutModal} from './components/DockWorkspace';
import {useStudioLayout,TOOLBAR_GROUPS,type ToolbarGroup} from './layout';
import {useHudLayout} from './hudLayout';
import {Viewport} from './components/Viewport';
import {WelcomeScreen} from './components/WelcomeScreen';
import {resolveShellScale} from './engine/shellScale';
import {useCssElementSize} from './engine/useCssElementSize';
import {headerDensity} from './engine/adaptiveUiGeometry';
import {shouldBuildLightingPreview} from './engine/viewportVisualization';
import {lightingCompilerKey,lightingCompilerLabel} from './engine/trueLightingCompiler';
import {ShadingPie} from './components/ShadingPie';
import {BspViewer} from './components/BspViewer';
import {TrueLightingPreview} from './components/TrueLightingPreview';
import {parseBsp} from './engine/bsp';
import type {BspMap} from './engine/bsp';
import type {TextureAsset} from './engine/types';
import {VisibilityManager} from './components/VisibilityManager';
import {EntityAppearanceModal} from './components/EntityAppearanceModal';
import {GameplayStudio} from './components/GameplayStudio';
import {CinematicCameraStudio} from './components/CinematicCameraStudio';
import {TopDropdown} from './components/TopDropdown';
import {analyzeGameplay} from './engine/gameplay';
import {validateNpcLogic} from './engine/npc';
import {NPCStudio} from './components/NpcStudio';
import {SoundStudio} from './components/SoundStudio';
import {LightingStudio} from './components/LightingStudio';
import {MapDoctor} from './components/MapDoctor';
import {MapPackagerStudio} from './components/MapPackagerStudio';
import {TerrainShapeStudio} from './components/TerrainShapeStudio';
import {BuildTogetherPanel} from './components/BuildTogether';
import {LocalFolderPicker,autoDetectInstallations,type FolderKind,type DiscoveredFolders} from './components/LocalFolderPicker';
import {useBuildTogether,setBuildTogetherDialog} from './engine/buildTogetherClient';
import {useMapDoctorState} from './mapDoctorState';
import {analyzeMap} from './engine/mapDiagnostics';
import {validateEnvironment} from './engine/environment';
import {validateAudio} from './engine/sound';
import type {PlaceableShape} from './engine/types';
import {ErrorBoundary} from './components/ErrorBoundary';
import {exportMap,validateProject} from './engine/exportMap';
import {inspectMapImport} from './engine/importMap';
import {lightTestMapName} from './engine/lightTest';
import {parseWad} from './engine/wad';
import {textureCompileWarnings} from './engine/textureCompileDiagnostics';
import {loadSavedWadFiles} from './engine/wadPersistence';
import {downloadText,readProject,saveProject} from './engine/paths';
import type {ToolMode} from './store';
import {CONTROL_ACTIONS,displayBinding,keyEventBinding,shortcutAction,isBrowserReservedBinding,shouldGuardNavigationKey} from './engine/controls';
import {readPreviewSettings,normalizeWalkPreview} from './engine/previewEnhancements';
import {requestSafeWalkFullscreen,releaseSafeWalkFullscreen} from './engine/walkKeyboardLock';
import {bindFullscreenEscapeHold} from './engine/fullscreenEscapeHold';
import type {ShortcutAction} from './engine/controls';
import {useT,LANGUAGES} from './i18n';
import {studioGuide} from './engine/studioGuide';
import {editorManual,EDITOR_SHORTCUT_GROUPS,actionTitlesEs,actionTitlesEn} from './engine/editorManual';
import {lastRecoveredAt,checkpointBeforeImport} from './engine/sessionManager';
import {readRecoveryBackup} from './engine/sessionRecovery';
import './style.css';
function ToolButton({active=false,title,children,onClick,disabled=false}:{active?:boolean,title:string,children:React.ReactNode,onClick:()=>void,disabled?:boolean}){
  return <button title={title} className={`tool-button ${active?'active':''}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
function MenuButton({children,onClick}:{children:React.ReactNode,onClick:()=>void}){return <button className="menu-action" onClick={onClick}>{children}</button>}
/** Persistent top-bar entry for the app-wide fullscreen/keyboard-lock mode. */
function FullscreenMenuButton(){
  const t=useT();
  const [fullscreen,setFullscreen]=useState(false);
  useEffect(()=>{
    const sync=()=>{
      const active=Boolean(document.fullscreenElement);
      setFullscreen(active);
      if(!active){
        try{(navigator as Navigator & {keyboard?:{unlock?:()=>void}}).keyboard?.unlock?.()}catch{/* optional API */}
      }
    };
    const guardBookmark=(event:KeyboardEvent)=>{
      // Chrome may still reserve shortcuts: prevent only if the browser delivers them.
      if(document.fullscreenElement&&(event.code==='Escape'||event.ctrlKey&&event.code==='KeyD'))event.preventDefault();
    };
    document.addEventListener('fullscreenchange',sync);
    window.addEventListener('keydown',guardBookmark,true);
    // Browser Keyboard Lock keeps short Escape available for cancelling tools.
    // Add an editor-controlled 1.5-second hold without touching Chrome's native safety exit.
    const unbindEscapeHold=bindFullscreenEscapeHold(document,window);
    sync();
    return()=>{unbindEscapeHold();document.removeEventListener('fullscreenchange',sync);window.removeEventListener('keydown',guardBookmark,true)};
  },[]);
  const toggle=async()=>{
    if(document.fullscreenElement){
      try{await document.exitFullscreen()}catch{/* browser can refuse */}
      return;
    }
    try{await document.documentElement.requestFullscreen({keyboardLock:'browser'} as FullscreenOptions)}
    catch{
      try{await document.documentElement.requestFullscreen()}catch{return}
    }
    try{
      const keyboard=(navigator as Navigator & {keyboard?:{lock?:(keys?:string[])=>Promise<void>}}).keyboard;
      if(!keyboard?.lock)throw Error('Keyboard Lock API is not supported or unavailable');
      await keyboard.lock(['Escape','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyR','KeyF','KeyP','KeyX','KeyY','KeyZ','Digit0']);
    }catch(error){
      useEditor.getState().appendLogs([`Fullscreen: Keyboard Lock (Escape) unavailable: ${String(error)}. The browser may exit fullscreen with a short Esc.`]);
    }
  };
  return <button type="button" className={`top-nav fullscreen-nav ${fullscreen?'chosen':''}`}
    title={t('Fullscreen keyboard lock (when available)')} aria-pressed={fullscreen}
    onClick={()=>void toggle()}>
    {fullscreen?<Minimize2 size={15}/>:<Maximize2 size={15}/>}
    <span>{t(fullscreen?'Exit fullscreen':'Fullscreen')}</span>
  </button>;
}
async function streamCompile(payload:object,callback:(event:{type:string;message:string;output?:string;previewId?:string})=>void){
  const response=await fetch('/api/compile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.error||`HTTP ${response.status}`)}
  if(!response.body)throw Error('Compiler service returned no output stream.');
  const reader=response.body.getReader(),decoder=new TextDecoder();let pending='';
  while(true){const {done,value}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});
    const pieces=pending.split('\n');pending=pieces.pop()||'';
    for(const piece of pieces){if(piece.trim())callback(JSON.parse(piece));}
  }
  if(pending.trim())callback(JSON.parse(pending));
}
function SettingsModal({onClose}:{onClose:()=>void}){
  const t=useT();
  const settings=useEditor(s=>s.settings),setSettings=useEditor(s=>s.setSettings);
  const es=useEditor(s=>s.locale)==='es';
  const [picker,setPicker]=useState<FolderKind|null>(null);
  const [discovery,setDiscovery]=useState<DiscoveredFolders|null>(null);
  const [detecting,setDetecting]=useState(false),[info,setInfo]=useState('');
  const initialDetection=useRef(false);
  const detect=async()=>{setDetecting(true);setInfo('');try{
    const data=await autoDetectInstallations();setDiscovery(data);
    const updates:{compilerDir?:string;gameDir?:string}={};
    const current=useEditor.getState().settings;
    if(!current.gameDir&&data.gameDirs.length===1)updates.gameDir=data.gameDirs[0];
    if(!current.compilerDir&&data.compilerDirs.length===1)updates.compilerDir=data.compilerDirs[0];
    if(Object.keys(updates).length)setSettings(updates);
    setInfo(data.gameDirs.length+data.compilerDirs.length===0?(es?'No se detectó una instalación Steam; usá Buscar carpeta.':'No Steam installation found; use Browse folder.'):(es?'Instalaciones detectadas. Seleccioná las carpetas correctas.':'Installations detected. Select the correct directories.'));
  }catch(e){setInfo(String(e))}finally{setDetecting(false)}};
  // First-time setup: fill only uniquely discovered, missing paths.
  // Existing manual paths and multiple-install choices remain untouched.
  useEffect(()=>{if(initialDetection.current)return;initialDetection.current=true;if(!settings.gameDir||!settings.compilerDir)void detect();},[]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card build-settings-modal" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-title"><Settings2 size={20}/><span>{t('Build configuration')}</span><button onClick={onClose}>×</button></div>
    <p className="modal-subtext">{t('Point to your installed Sven Co-op SDK compiler folder and Sven Co-op game directory. Paths must be on the PC running the editor.')}</p>
    <div className="build-autosave-notice" role="note">
      <strong>{t('Automatic map output')}</strong>
      <p>{t('When you click Compile Map, the editor generates the MAP source in a temporary build folder and runs the Sven Co-op SDK compilers. After a successful build, the BSP is automatically saved to the maps folder of the configured Sven Co-op game directory using the map name below.')}</p>
      <code>{settings.gameDir ? `${settings.gameDir.replace(/[\\/]+$/,'')}\\maps\\${settings.mapName||'my_sven_map'}.bsp` : `svencoop\\maps\\${settings.mapName||'my_sven_map'}.bsp`}</code>
      <p>{t('Building does not export a portable project file; use File → Save project (Ctrl+S) to back up your editable project. A failed build will not copy a new BSP.')}</p>
    </div>
    <label>{t('Map name')}<input value={settings.mapName} onChange={e=>setSettings({mapName:e.target.value})} placeholder="my_sven_map"/><small>{t('Letters, numbers, underscores and hyphens only.')}</small></label>
    <div className="build-discovery"><button className="secondary-action" disabled={detecting} type="button" onClick={()=>void detect()}><HardDrive size={16}/>{detecting?(es?'Buscando en Steam...':'Searching Steam...'):(es?'Detectar Sven Co-op y SDK automáticamente':'Automatically detect Sven Co-op and SDK')}</button><small>{es?'Busca en las bibliotecas de Steam de las unidades disponibles; no escanea todos los archivos de cada disco.':'Searches Steam libraries across available drives; does not scan every file on disk.'}</small>{info&&<p role="status">{info}</p>}</div>
    <div className="build-autosave-notice" role="group" aria-label="Compiler engine">
      <label>{es?'Motor de compilación':'Compiler engine'}<select value={settings.compilerEngine||'sc'} onChange={e=>setSettings({compilerEngine:e.target.value as 'sc'|'sdhlt'})}>
        <option value="sc">Sven Co-op SDK (SC-CSG / SC-BSP / SC-VIS / SC-RAD) — Default</option>
        <option value="sdhlt">SDHLT — Experimental (Half-Life GoldSrc)</option>
      </select></label>
      {(settings.compilerEngine||'sc')==='sdhlt'&&<>
        <p>{es?'Experimental: no se garantiza la compatibilidad con Svengine. Elegí los ejecutables SDHLT en una carpeta independiente. No se modifican los compiladores SC.':'Experimental: Svengine compatibility is not guaranteed. Choose SDHLT executables in a separate folder. SC compilers are not modified.'}</p>
        <label>{es?'Carpeta de SDHLT':'SDHLT compiler folder'}<div className="build-path-row"><input value={settings.sdhltDir||''} onChange={e=>setSettings({sdhltDir:e.target.value})} placeholder={'C:\\SDHLT\\bin'}/><button type="button" onClick={()=>setPicker('compiler')}><FolderOpen size={15}/>{es?'Buscar':'Browse'}</button></div></label>
        <label><input type="checkbox" checked={!!settings.sdhltAO} onChange={e=>setSettings({sdhltAO:e.target.checked})}/> {es?'Oclusión ambiental (-ao)':'Ambient occlusion (-ao)'}</label>
        <label>{es?'Suavizado de sombras (-pcf)':'Shadow filtering (-pcf)'}<select value={settings.sdhltPCF||'off'} onChange={e=>setSettings({sdhltPCF:e.target.value as 'off'|'1'|'2'|'4'})}>
          <option value="off">Off</option><option value="1">1</option><option value="2">2</option><option value="4">4</option>
        </select></label>
        <small>{es?'Para sombras MDL, configurá zhlt_studioshadow=1 en la entidad del modelo; requiere compatibilidad con SDHLT y pruebas dentro del juego.':'For MDL shadows set zhlt_studioshadow=1 on the model entity; requires SDHLT support and in-game testing.'}</small>
      </>}
    </div>
    <label>{t('Compiler folder')}<div className="build-path-row"><input value={settings.compilerDir} onChange={e=>setSettings({compilerDir:e.target.value})} placeholder="C:\Program Files (x86)\Steam\steamapps\common\Sven Co-op SDK\mapping\compilers"/><button type="button" onClick={()=>setPicker('compiler')}><FolderOpen size={15}/>{es?'Buscar':'Browse'}</button></div></label>
    {discovery&&discovery.compilerDirs.length>0&&<div className="build-discovered">{discovery.compilerDirs.map(p=><button type="button" key={p} onClick={()=>setSettings({compilerDir:p})}>{p}</button>)}</div>}
    <label>{t('Sven Co-op game data folder')}<div className="build-path-row"><input value={settings.gameDir} onChange={e=>setSettings({gameDir:e.target.value})} placeholder="C:\Program Files (x86)\Steam\steamapps\common\Sven Co-op\svencoop"/><button type="button" onClick={()=>setPicker('game')}><FolderOpen size={15}/>{es?'Buscar':'Browse'}</button></div></label>
    {discovery&&discovery.gameDirs.length>0&&<div className="build-discovered">{discovery.gameDirs.map(p=><button type="button" key={p} onClick={()=>setSettings({gameDir:p})}>{p}</button>)}</div>}
    <label>{t('WAD full paths (one per line)')}<textarea rows={4} value={settings.wadPaths} onChange={e=>setSettings({wadPaths:e.target.value})} placeholder={'C:\\Steam\\steamapps\\common\\Sven Co-op\\svencoop\\halflife.wad'}/><small>{t('These file paths are written to the worldspawn wad key for the compilers. Import a matching .WAD in the Texture Browser for previews.')}</small></label>
    <label>{t('SC-RAD lighting diagnostic')}<select className="lighting-test-select" value={settings.radAmbientTest||'off'} onChange={e=>setSettings({radAmbientTest:e.target.value as typeof settings.radAmbientTest})}>
      <option value="off">{t('Normal compile — no ambient override')}</option>
      <option value="0.08">{t('Low ambient test (0.08)')}</option>
      <option value="0.15">{t('Moderate ambient test (0.15)')}</option>
      <option value="0.25">{t('Strong ambient test (0.25)')}</option>
    </select><small>{t('Diagnostic only: compiles a separate BSP with a _lightXX suffix. Does not overwrite the original BSP or restore its lightmaps. Return to Normal afterward.')}</small></label>
    <div className="modal-footer"><button className="primary-action" onClick={onClose}><CheckCircle2 size={16}/> {t('Save settings')}</button></div>
  </div>{picker&&<LocalFolderPicker kind={picker} initial={picker==='compiler'&&settings.compilerEngine==='sdhlt'?settings.sdhltDir||'':picker==='compiler'?settings.compilerDir:settings.gameDir} es={es} onClose={()=>setPicker(null)} onPick={p=>setSettings(picker==='compiler'&&settings.compilerEngine==='sdhlt'?{sdhltDir:p}:picker==='compiler'?{compilerDir:p}:{gameDir:p})}/>}</div>;
}
function ControlsModal({onClose}:{onClose:()=>void}){
  const t=useT();
  const controls=useEditor(s=>s.controls),setControls=useEditor(s=>s.setControls);
  const setShortcut=useEditor(s=>s.setShortcut),resetControls=useEditor(s=>s.resetControls);
  const [capture,setCapture]=useState<ShortcutAction|null>(null);
  const [notice,setNotice]=useState('');
  const locale=useEditor(s=>s.locale);const guide=studioGuide(locale);
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.code==='Escape'&&capture===null){e.stopPropagation();onClose()}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[capture,onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card controls-card" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-title"><Keyboard size={20}/><span>{t('Camera & Gizmo Controls')}</span><button onClick={onClose}>×</button></div>
    <div className="controls-scroll">
      <section className="controls-quick-reference" aria-label={guide.guideTitle}>
        <h4>{guide.guideTitle}</h4>
        <p>{guide.capture}</p>
        <p className="controls-browser-warning">{guide.browserWarning}</p>
        <div className="controls-reference-grid">
          <div><strong>{t('Camera navigation')}</strong><p>{guide.cameraKeys}</p></div>
          <div><strong>{t('Gizmo / Transform')}</strong><p>{guide.transformKeys}</p></div>
          <div><strong>{t('Fly / Walk mode')}</strong><p>{t('Gameplay Test')}: F5 / Shift+P · {t('Fly / Walk mode')}: {displayBinding(controls.shortcuts.fly||'Shift+KeyF')} · F: {t('Flashlight')} · H: HUD · N: noclip · E: {guide.interact}.</p></div>
          <div><strong>{t('Camera views')}</strong><p>{t('Front view')}: {displayBinding(controls.shortcuts.front||'')} · {t('Right view')}: {displayBinding(controls.shortcuts.right||'')} · {t('Top view')}: {displayBinding(controls.shortcuts.top||'')} · {t('Orthographic / Perspective')}: {displayBinding(controls.shortcuts.projection||'')} · {t('Frame all')}: {displayBinding(controls.shortcuts.frameAll||'')}.</p></div>
        </div>
      </section>
      <h4>{t('Camera navigation')}</h4>
      <label>{t('Navigation preset')}<select value={controls.cameraPreset} onChange={e=>setControls({cameraPreset:e.target.value as 'blender'|'classic'})}>
        <option value="blender">{t('Blender — MMB orbit · Shift+MMB pan · Ctrl+MMB zoom')}</option>
        <option value="classic">{t('Classic — RMB orbit · MMB zoom · LMB pan')} · RMB look</option>
      </select></label>
      <p className="modal-subtext">{t('Wheel: zoom. Blender preset uses WASD only in Fly/Walk mode; Classic keeps WASD always available. Esc exits Fly or the active transform tool.')}</p>
      <p className="modal-subtext">{t('G starts mouse-follow Move. R and C toggle the Rotate and Scale gizmos; press again to return to Select. Drag a gizmo handle to edit the brush.')}</p>
      <div className="controls-sliders">
        {([['orbitSensitivity','Orbit sensitivity',.15,4,.05],['panSensitivity','Pan sensitivity',.15,4,.05],['zoomSensitivity','Zoom sensitivity',.15,4,.05],['flySpeed','Fly speed (units/sec)',10,3000,10]] as const).map(([id,label,min,max,step])=><label key={id}>{t(label)}<div className="controls-range"><input type="range" min={min} max={max} step={step} value={controls[id]} onChange={e=>setControls({[id]:Number(e.target.value)})}/><output>{controls[id]}</output></div></label>)}
        <label className="controls-check"><input type="checkbox" checked={controls.invertOrbit} onChange={e=>setControls({invertOrbit:e.target.checked})}/> {t('Invert orbit rotation')}</label>
      </div>
      <h4>{t('Advanced camera options')}</h4>
      <div className="controls-sliders">
        <label className="controls-check"><input type="checkbox" checked={controls.cameraDamping} onChange={e=>setControls({cameraDamping:e.target.checked})}/> {t('Smooth camera motion')}</label>
        <label className="controls-check"><input type="checkbox" checked={controls.zoomToCursor} onChange={e=>setControls({zoomToCursor:e.target.checked})}/> {t('Zoom toward mouse cursor')}</label>
        {([['dampingFactor','Camera smoothing',.02,.25,.01],['perspectiveFov','Perspective field of view',35,100,1],['minCameraDistance','Minimum camera distance',1,500,1],['maxCameraDistance','Maximum camera distance',500,250000,500],['flyLookSensitivity','Fly mouse sensitivity',.2,3,.05],['flyBoostMultiplier','Fast flight multiplier (Shift)',1,8,.25],['flySlowMultiplier','Slow flight multiplier (Ctrl)',.05,1,.05]] as const).map(([id,label,min,max,step])=><label key={id}>{t(label)}<div className="controls-range"><input type="range" min={min} max={max} step={step} value={controls[id]} onChange={e=>setControls({[id]:Number(e.target.value)})}/><output>{controls[id]}</output></div></label>)}
      </div>
      <p className="modal-subtext">{t('These options affect only the editor camera. They do not change map geometry or the BSP.')}</p>
      <h4>{t('Mouse transform modifiers')}</h4>
      <p className="modal-subtext">{t('G uses mouse-follow Move with Shift/Ctrl/Alt and X/Y/Z axis constraints. R/C show gizmos: drag a handle to rotate/scale, or press the shortcut again to select normally.')}</p>
      <div className="controls-sliders">
        {([['transformFineFactor','Shift precision',.02,1,.01],['transformRotationStep','Ctrl rotation step (degrees)',1,90,1],['transformScaleStep','Ctrl scale step',.01,.5,.01]] as const).map(([id,label,min,max,step])=><label key={id}>{t(label)}<div className="controls-range"><input type="range" min={min} max={max} step={step} value={controls[id]} onChange={e=>setControls({[id]:Number(e.target.value)})}/><output>{controls[id]}</output></div></label>)}
      </div>
      <p className="modal-subtext">{t('Alt + mouse: Move = world height (Z), Rotate = two-axis trackball, Scale = temporarily use center pivot. Ctrl works with the gizmo too.')}</p>
      <h4>{t('Gizmo / Transform')}</h4>
      <div className="controls-sliders">
        <label>{t('Gizmo orientation')}<select value={controls.gizmoSpace} onChange={e=>setControls({gizmoSpace:e.target.value as 'local'|'world'})}><option value="world">{t('Global / World')}</option><option value="local">{t('Local / Object')}</option></select></label>
        {([['rotationSnapDegrees','Rotation snap (0 = off)',0,90,5],['scaleSnapStep','Scale snap (0 = off)',0,1,.05],['gizmoSize','Gizmo size',.15,2,.05]] as const).map(([id,label,min,max,step])=><label key={id}>{t(label)}<div className="controls-range"><input type="range" min={min} max={max} step={step} value={controls[id]} onChange={e=>setControls({[id]:Number(e.target.value)})}/><output>{controls[id]}</output></div></label>)}
      </div>
      <p className="modal-subtext">{t('Translate uses the Grid / Snap controls in the editor toolbar. Rotation and scale snaps are optional. Multi-selection pivots use World axes.')}</p>
      <h4>{t('Custom keyboard shortcuts')}</h4>
      <p className="modal-subtext">{t('Click a shortcut and press your preferred key combination. Backspace clears it; Esc cancels. Conflicting shortcuts are automatically unassigned.')}</p>
      <div className="binding-grid">{CONTROL_ACTIONS.map(action=><div key={action.id} className="binding-action-slot">
        {(['fly','front','orbitLeft','zoomIn'].includes(action.id))&&<div className="binding-section">{t(action.id==='fly'?'Fly / Walk mode':action.id==='front'?'Camera views':action.id==='orbitLeft'?'Camera movement':'Camera zoom')}</div>}
        <div className="binding-row">
        <span title={action.description}>{t(action.label)}</span>
        <button className={capture===action.id?'capturing':''} onClick={()=>{setCapture(action.id);setNotice(t('Press a key combination…'))}}
          onKeyDown={e=>{
            if(capture!==action.id)return;
            e.stopPropagation();e.preventDefault();
            if(e.code==='Escape'){setCapture(null);setNotice(t('Shortcut recording cancelled.'));return}
            const code=e.code==='Backspace'?'':keyEventBinding(e.nativeEvent);
            if(!code&&e.code!=='Backspace')return;
            if(isBrowserReservedBinding(code)){
              setNotice(t('This shortcut is reserved by your browser or operating system. Choose another key.'));
              return;
            }
            setShortcut(action.id,code);setCapture(null);setNotice(`${action.label} set to ${code?displayBinding(code):'unassigned'}.`);
          }}>
          {capture===action.id?t('Press a key…'):controls.shortcuts[action.id]?displayBinding(controls.shortcuts[action.id]):t('Unassigned')}
        </button>
        </div>
      </div>)}</div>
      <p className="controls-note" aria-live="polite">{notice||t('Changes are saved automatically in this browser.')}</p>
    </div>
    <div className="modal-footer"><button onClick={()=>{resetControls();setCapture(null);setNotice(t('Blender controls restored.'))}}>{t('Reset to Blender defaults')}</button><button className="primary-action" onClick={onClose}><CheckCircle2 size={16}/> {t('Done')}</button></div>
  </div></div>;
}
function AboutModal({onClose}:{onClose:()=>void}){
  const t=useT();
  const locale=useEditor(s=>s.locale);
  const controls=useEditor(s=>s.controls);
  const manual=editorManual(locale);
  const shortcutGroups=[
    {id:'transform',title:locale==='es'?'Transformación y encuadre':'Transform and framing',actions:EDITOR_SHORTCUT_GROUPS.transform},
    {id:'views',title:locale==='es'?'Vistas y proyección':'Views and projection',actions:EDITOR_SHORTCUT_GROUPS.views},
    {id:'orbit',title:locale==='es'?'Órbita, desplazamiento y zoom':'Orbit, pan and zoom',actions:EDITOR_SHORTCUT_GROUPS.orbit}
  ];
  const textList=(items:readonly string[])=><ul>{items.map((item,index)=><li key={index}>{item}</li>)}</ul>;
  const section=(id:string,title:string,items:readonly string[])=><section id={`manual-${id}`} className="help-feature-card manual-block" key={id}><h4>{title}</h4>{textList(items)}</section>;
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card about-card help-dialog help-dialog-current" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('Help')}>
    <div className="modal-title"><Info size={20}/><span>{t('Sven Studio guide')} · v1.7.19</span><button title={t('Close')} onClick={onClose}>×</button></div>
    <div className="help-scroll" tabIndex={0}>
      <div className="help-credits" role="group" aria-label={t('Project credits')}>

        <p>{t('This project was made with the help of GPT-6 Astra.')}</p>
      </div>
      <div className="help-summary"><h4>{t('Editor summary')}</h4><p>{manual.intro}</p></div>
      <nav className="help-index" aria-label={locale==='es'?'Índice de la guía':'Guide navigation'}>
        {[
          ['start',manual.firstTitle],['camera',manual.cameraTitle],['edit',manual.editTitle],['uv',manual.uvTitle],
          ['shapes',manual.shapesTitle],['walk',manual.walkTitle],['shortcuts',manual.shortcutsTitle],
          ['studios',manual.studiosTitle],['workspace',manual.workspaceTitle],['technical',manual.technicalTitle],['contact',manual.noticeTitle]
        ].map(([id,label])=><a key={id} href={`#manual-${id}`}>{label}</a>)}
      </nav>
      <section className="help-camera-note manual-fullscreen" role="note"><h4>{manual.fullTitle}</h4><p>{manual.full}</p></section>
      <div className="help-feature-grid manual-guide-grid">
        {section('start',manual.firstTitle,manual.first)}
        {section('camera',manual.cameraTitle,manual.camera)}
        {section('edit',manual.editTitle,manual.edit)}
        {section('uv',manual.uvTitle,manual.uv)}
        {section('shapes',manual.shapesTitle,manual.shapes)}
        {section('walk',manual.walkTitle,manual.walk)}
      </div>
      <section className="help-feature-card manual-block" aria-label="True Lighting help"><h4>True Lighting · SC-RAD / SDHLT</h4><p>{({
        es:'En Estudios → True Lighting elegí SC-RAD o SDHLT antes de compilar. El cálculo puede reducir el rendimiento temporalmente. En vista ampliada WASD controla solo la cámara BSP, Q/E cambia la altura, Esc o F8 libera el cursor. Reducí o cerrá la vista para volver al editor.',
        en:'Open Studios → True Lighting, select SC-RAD or SDHLT before baking. Compilation may temporarily reduce performance. In expanded view WASD controls only the BSP camera, Q/E adjusts height, Esc or F8 releases the cursor. Minimize or close the preview to return to the editor.',
        ru:'Откройте Студии → True Lighting и выберите SC-RAD или SDHLT перед пересчётом. Компиляция может снизить производительность. В развёрнутом просмотре WASD управляет камерой BSP, Q/E — высотой, Esc или F8 освобождает курсор.',
        ko:'Studios → True Lighting에서 컴파일 전 SC-RAD 또는 SDHLT를 선택하세요. 처리 중 성능이 저하될 수 있습니다. 확대 화면에서는 WASD가 BSP 카메라만 이동하고 Q/E는 높이를 조절하며 Esc 또는 F8로 마우스를 해제합니다.',
        zh:'在“工作室 → True Lighting”中选择 SC-RAD 或 SDHLT 后再烘焙。编译可能暂时降低性能。放大预览时 WASD 仅移动 BSP 相机，Q/E 调整高度，Esc 或 F8 释放鼠标。',
        pt:'Abra Estúdios → True Lighting e selecione SC-RAD ou SDHLT antes de compilar. O processo pode reduzir o desempenho. Na prévia ampliada, WASD move só a câmera BSP, Q/E ajusta a altura; Esc ou F8 libera o cursor.'
      } as Record<string,string>)[locale]}</p></section>
      <section className="help-feature-card manual-shortcuts" id="manual-shortcuts">
        <h4>{manual.shortcutsTitle}</h4><p>{manual.shortcutsHint}</p>
        {shortcutGroups.map(group=><div key={group.id} className="manual-shortcut-group"><h5>{group.title}</h5><div className="manual-shortcut-grid">{group.actions.map(id=>{
          return <div className="manual-shortcut-row" key={id}><span>{locale==='es'?actionTitlesEs[id]:actionTitlesEn[id]}</span><kbd>{displayBinding(controls.shortcuts[id])||'—'}</kbd></div>;
        })}</div></div>)}
      </section>
      <h3 className="help-feature-heading" id="manual-studios">{manual.studiosTitle}</h3>
      <div className="help-feature-grid manual-guide-grid">{manual.studios.map(studio=><section className="help-feature-card manual-studio-card" key={studio.title}><h4>{studio.title}</h4><p>{studio.description}</p></section>)}</div>
      <div className="help-feature-grid manual-guide-grid">
        {section('workspace',manual.workspaceTitle,manual.workspace)}
        {section('technical',manual.technicalTitle,manual.technical)}
      </div>
      <section className="help-feature-card manual-contact" id="manual-contact">
        <h4>{manual.noticeTitle}</h4><p>{manual.notice}</p>
        <h5>{manual.linksTitle}</h5><p>{manual.contact} · Steam: <a href="https://steamcommunity.com/id/KazamiiSC" target="_blank" rel="noreferrer noopener">steamcommunity.com/id/KazamiiSC</a></p>
      </section>
    </div>
    <div className="modal-footer"><button className="primary-action" onClick={onClose}>{t('Close')}</button></div>
  </div></div>;
}
function BuildOutputModal({onClose,onCancel,onDoctor}:{onClose:()=>void;onCancel:()=>void;onDoctor:()=>void}){
  const t=useT();
  const logs=useEditor(s=>s.logs),clear=useEditor(s=>s.clearLogs),busy=useEditor(s=>s.compileBusy);
  const scrollRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight})},[logs]);
  return <div className="modal-backdrop" onMouseDown={onClose}>
    <section className="modal-card build-output-modal" role="dialog" aria-modal="true" aria-label={t('Output')} onMouseDown={e=>e.stopPropagation()}>
      <div className="modal-title"><Terminal size={19}/><span>{t('Output')} · {logs.length}</span>{busy&&<span className="building"><span className="pulse-dot"/> {t('Building...')}</span>}<button onClick={onClose} aria-label={t('Close')}>×</button></div>
      <div className="console-logs" ref={scrollRef}>
        {logs.map((line,i)=><div key={i} className={`${/error|failed|invalid|leak/i.test(line)?'error-log':/success|finished|complete|imported/i.test(line)?'good-log':''}`}><span className="log-index">{String(i+1).padStart(3,'0')}</span>{line}</div>)}
      </div>
      <div className="modal-footer"><button onClick={clear}>{t('Clear')}</button>{busy&&<button onClick={onCancel}>{t('Stop Build')}</button>}<button onClick={onDoctor}><ShieldCheck size={15}/> {t('Open Map Doctor')}</button><button className="primary-action" onClick={onClose}>{t('Close')}</button></div>
    </section>
  </div>;
}
export default function App(){
  const t=useT();
  const buildTogetherStatus=useBuildTogether(s=>s.status);
  const uiScale=useStudioLayout(s=>s.uiScale),accent=useStudioLayout(s=>s.accent),fontScale=useStudioLayout(s=>s.fontScale);
  const autoLayout=useStudioLayout(s=>s.autoLayout);
  const toolbarGroups=useStudioLayout(s=>s.toolbarGroups)??[...TOOLBAR_GROUPS];
  const reorderToolbar=useStudioLayout(s=>s.reorderToolbarGroup);
  const toolbarGroupProps=(id:ToolbarGroup)=>({
    'data-toolbar-group':id,
    style:{order:toolbarGroups.indexOf(id)},
    onDragOver:(event:React.DragEvent<HTMLDivElement>)=>{if(event.dataTransfer.types.includes('application/x-sven-toolbar-section'))event.preventDefault()},
    onDrop:(event:React.DragEvent<HTMLDivElement>)=>{
      const source=event.dataTransfer.getData('application/x-sven-toolbar-section') as ToolbarGroup;
      if(TOOLBAR_GROUPS.includes(source)){event.preventDefault();event.stopPropagation();reorderToolbar(source,id)}
    }
  });
  const toolbarGrip=(id:ToolbarGroup)=><span className="ribbon-drag-handle" draggable title={t('Drag to reorder toolbar sections')}
    aria-label={t('Drag to reorder toolbar sections')} onDragStart={event=>{
      event.stopPropagation();event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-sven-toolbar-section',id);
    }}>⠿</span>;

  const locale=useEditor(s=>s.locale),localePreference=useEditor(s=>s.localePreference),setLocale=useEditor(s=>s.setLocale);
  useEffect(()=>{document.documentElement.lang=locale},[locale]);
  const geometryMode=useEditor(s=>s.geometryMode),setGeometryMode=useEditor(s=>s.setGeometryMode);
  const measureMode=useEditor(s=>s.measureMode),toggleMeasure=useEditor(s=>s.toggleMeasure);
  const mode=useEditor(s=>s.mode),setMode=useEditor(s=>s.setMode),activateGizmoMode=useEditor(s=>s.activateGizmoMode);
  const snapping=useEditor(s=>s.snapping),toggleSnap=useEditor(s=>s.toggleSnap),snap=useEditor(s=>s.snap),setSnap=useEditor(s=>s.setSnap);
  const gridDisplayStep=useEditor(s=>s.gridDisplayStep),setGridDisplayStep=useEditor(s=>s.setGridDisplayStep);
  const faceMode=useEditor(s=>s.faceMode),setFlag=useEditor(s=>s.setFlag),showGrid=useEditor(s=>s.showGrid),wireframe=useEditor(s=>s.wireframe);
  const drawMode=useEditor(s=>s.drawMode),setDrawMode=useEditor(s=>s.setDrawMode),drawHeight=useEditor(s=>s.drawHeight),setDrawHeight=useEditor(s=>s.setDrawHeight);
  const selected=useEditor(s=>s.selected),history=useEditor(s=>s.history),future=useEditor(s=>s.future);
  const project=useEditor(s=>s.project),newProject=useEditor(s=>s.newProject),loadProject=useEditor(s=>s.loadProject),setName=useEditor(s=>s.setName);
  const [welcomeOpen,setWelcomeOpen]=useState(true);
  const [bspMap,setBspMap]=useState<BspMap|null>(null),[bspSource,setBspSource]=useState<ArrayBuffer|null>(null),[bspMode,setBspMode]=useState(false),[bspPreviewBaked,setBspPreviewBaked]=useState(false),[bspLoading,setBspLoading]=useState(false),[lastCompiled,setLastCompiled]=useState<string|null>(null);
  const [truePreviewOpen,setTruePreviewOpen]=useState(false),[truePreviewMap,setTruePreviewMap]=useState<BspMap|null>(null);
  const [truePreviewLayout,setTruePreviewLayout]=useState<'split'|'full'>('split');
  const [truePreviewSource,setTruePreviewSource]=useState<ArrayBuffer|null>(null);
  const [truePreviewStatus,setTruePreviewStatus]=useState(''),[truePreviewBusy,setTruePreviewBusy]=useState(false);
  const [truePreviewSnapshot,setTruePreviewSnapshot]=useState<typeof project|null>(null);
  const [truePreviewCompilerKey,setTruePreviewCompilerKey]=useState<string|null>(null);
  const [truePreviewCompilerLabel,setTruePreviewCompilerLabel]=useState('SC-RAD');
  const bspInput=useRef<HTMLInputElement>(null);
  const [recoveryStatus,setRecoveryStatus]=useState<'waiting'|'saved'|'error'>('waiting');
  useEffect(()=>{const listener=(event:Event)=>setRecoveryStatus((event as CustomEvent<{status:'saved'|'error'}>).detail.status);window.addEventListener('svenstudio-recovery-status',listener);return()=>window.removeEventListener('svenstudio-recovery-status',listener)},[]);
  const undo=useEditor(s=>s.undo),redo=useEditor(s=>s.redo),duplicate=useEditor(s=>s.duplicateSelected),remove=useEditor(s=>s.removeSelected);
  const appendLogs=useEditor(s=>s.appendLogs),compileBusy=useEditor(s=>s.compileBusy),setCompileBusy=useEditor(s=>s.setCompileBusy);
  const settings=useEditor(s=>s.settings);
  const fgdLoaded=useEditor(s=>s.fgdLoaded);
  // Read the installed Sven Co-op FGD once when the editor starts or the game path changes.
  // Missing/ambiguous installations leave the starter list intact.
  useEffect(()=>{if(fgdLoaded)return;void ensureSvenCoopFgd({discover:true}).catch(()=>{});},[settings.gameDir,fgdLoaded]);
  const controls=useEditor(s=>s.controls),flyMode=useEditor(s=>s.flyMode),walkMode=useEditor(s=>s.walkMode);
  const toggleFly=useEditor(s=>s.toggleFly),setFly=useEditor(s=>s.setFly),setWalk=useEditor(s=>s.setWalk),issueCameraCommand=useEditor(s=>s.issueCameraCommand);
  const toggleModal=useEditor(s=>s.toggleModalTransform),finishModal=useEditor(s=>s.finishModalTransform);
  const showEntityNames=useEditor(s=>s.showEntityNames);
  const showTransformGizmo=useEditor(s=>s.showTransformGizmo),setShowTransformGizmo=useEditor(s=>s.setShowTransformGizmo);
  const ghostHidden=useEditor(s=>s.ghostHidden),toggleGhostHidden=useEditor(s=>s.toggleGhostHidden);
  const placementShape=useEditor(s=>s.placementShape);
  // The branded home must be the first screen on *every* launch. Defer the
  // one-time onboarding guide until after Start, so it cannot cover home.
  const [extraMenu,setExtraMenu]=useState(false);
  const headerRef=useRef<HTMLElement>(null);
  const headerSize=useCssElementSize(headerRef);
  const headerMode=headerDensity(headerSize.width);
  useEffect(()=>{setExtraMenu(false)},[headerMode]);
  const [dialog,setDialog]=useState<'settings'|'controls'|'about'|'layout'|'entityAppearance'|'gameplay'|'cinematic'|'npc'|'sound'|'lighting'|'doctor'|'visibility'|'output'|'packager'|'terrain'|'buildTogether'|null>(null),[fileMenu,setFileMenu]=useState(false),[studiosMenu,setStudiosMenu]=useState(false),[workspaceMenu,setWorkspaceMenu]=useState(false);
  const btArchitectureMode=useArchitectureMode(s=>s.mode);
  useEffect(()=>{setBuildTogetherDialog(welcomeOpen?null:dialog??(btArchitectureMode!=='off'?'architecture':null));return()=>setBuildTogetherDialog(null)},[dialog,welcomeOpen,btArchitectureMode]);
  const closeHelp=()=>{try{localStorage.setItem('svenstudio:welcome-guide-v1','seen')}catch{/* private browsing */}setDialog(null)};
  useEffect(()=>{
    if(welcomeOpen)return;
    try{
      if(localStorage.getItem('svenstudio:welcome-guide-v1')!=='seen')setDialog(current=>current??'about');
    }catch{/* Incognito/private mode can disable storage */}
  },[welcomeOpen]);
  const projectInput=useRef<HTMLInputElement>(null),mapInput=useRef<HTMLInputElement>(null);
  const fileButton=useRef<HTMLButtonElement>(null),studiosButton=useRef<HTMLButtonElement>(null),workspaceButton=useRef<HTMLButtonElement>(null),extraButton=useRef<HTMLButtonElement>(null);
  const imported=async(e:React.ChangeEvent<HTMLInputElement>,type:'map'|'project')=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      // Inspect the entire file before changing editor state. MAP geometry must never
      // disappear unnoticed if an unsupported brush cannot be reconstructed.
      const inspected=type==='map'?inspectMapImport(await file.text(),file.name):null;
      const p=inspected?inspected.project:await readProject(file);
      const report=inspected?.report;
      if(report?.skippedBrushes){
        const details=report.skippedLocations.join('\n');
        const message=t('MAP import would skip {lost} of {total} brushes. The source file is unchanged. Import the incomplete map anyway?')
          .replace('{lost}',String(report.skippedBrushes)).replace('{total}',String(report.totalBrushes));
        appendLogs([`MAP import warning: ${report.skippedBrushes}/${report.totalBrushes} brushes unsupported. ${report.skippedLocations.join(' | ')}`]);
        if(!window.confirm(`${message}\n\n${details}`))return;
      }
      if(project.objects.length>0&&!window.confirm(t('Opening this file replaces the current map. Save your work first. Continue?')))return;
      try{await checkpointBeforeImport()}
      catch(error){
        appendLogs([`Backup warning: ${String(error)}`]);
        if(!window.confirm(t('The current map could not be backed up locally. Continue without a recovery checkpoint?')))return;
      }
      loadProject(p);
      appendLogs([`Opened ${file.name}: ${p.objects.length} objects${report?.skippedBrushes?` (WARNING: ${report.skippedBrushes} brushes skipped)`:''}`]);
    }
    catch(err){appendLogs([`Import error: ${String(err)}`]);window.alert(`${t('Import failed')}: ${String(err)}`)}
    finally{e.target.value='';setFileMenu(false)}
  };
  const openRecoveredMap=async(mapText:string,fileName:string,recoveredTextures:TextureAsset[]=[]):Promise<boolean>=>{
    try{
      const {project:next,report}=inspectMapImport(mapText,fileName);
      if(report.skippedBrushes){
        const message=t('MAP import would skip {lost} of {total} brushes. The source file is unchanged. Import the incomplete map anyway?')
          .replace('{lost}',String(report.skippedBrushes)).replace('{total}',String(report.totalBrushes));
        appendLogs([`BSP→MAP import warning: ${report.skippedBrushes} brushes skipped: ${report.skippedLocations.join(' | ')}`]);
        if(!window.confirm(`${message}\n\n${report.skippedLocations.join('\n')}`))return false;
      }
      if(useEditor.getState().project.objects.length>0&&!window.confirm(t('Opening this file replaces the current map. Save your work first. Continue?')))return false;
      try{await checkpointBeforeImport()}
      catch(error){
        appendLogs([`Backup warning: ${String(error)}`]);
        if(!window.confirm(t('The current map could not be backed up locally. Continue without a recovery checkpoint?')))return false;
      }
      loadProject(next);
      if(recoveredTextures.length){
        // Texture previews are session assets. Never pretend an extracted WAD is
        // installed on disk: compilation still requires the real WAD path.
        useEditor.setState(state=>{
          const merged=new Map(state.textureAssets.map(asset=>[asset.name.toLowerCase(),asset]));
          recoveredTextures.forEach(asset=>merged.set(asset.name.toLowerCase(),asset));
          return {textureAssets:[...merged.values()]};
        });
      }
      setBspMode(false);
      appendLogs([`Opened recovered MAP ${fileName}: ${next.objects.length} objects, ${report.importedBrushes} brushes, ${report.skippedBrushes} skipped.`]);
      return true;
    }catch(error){
      appendLogs([`Recovered MAP import failed: ${String(error)}`]);
      window.alert(`${t('Import failed')}: ${String(error)}`);
      return false;
    }
  };
  const openBspFile=async(file:File)=>{
    if(file.size>256*1024*1024)throw Error('BSP file exceeds the 256 MB viewer limit.');
    setBspLoading(true);
    try{
      const raw=await file.arrayBuffer();const parsed=parseBsp(raw,file.name);
      setBspSource(raw);setBspMap(parsed);setBspPreviewBaked(false);setBspMode(true);
      appendLogs([`BSP Viewer opened ${file.name}: ${parsed.faces.length} faces, ${parsed.entities.length} entities.`]);
    }finally{setBspLoading(false)}
  };
  const loadedBsp=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];if(!file)return;
    try{await openBspFile(file)}catch(err){window.alert(`${t('Unable to open BSP')}: ${String(err)}`);appendLogs([`BSP Viewer: ${String(err)}`])}
    event.target.value='';setFileMenu(false);
  };
  const openCompiledBsp=async()=>{
    setBspLoading(true);
    try{
      const response=await fetch('/api/bsp/compiled',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameDir:settings.gameDir,mapName:lastCompiled||settings.mapName})});
      if(!response.ok)throw Error((await response.json().catch(()=>({}))).error||`HTTP ${response.status}`);
      const file=new File([await response.blob()],`${lastCompiled||settings.mapName}.bsp`);
      await openBspFile(file);
    }catch(err){appendLogs([`BSP Viewer: ${String(err)}`]);window.alert(`${t('Compiled BSP unavailable')}: ${String(err)}`)}
    finally{setBspLoading(false)}
  };
  const wadPaths=settings.wadPaths.split(/[\r\n]+/).map(v=>v.trim()).filter(Boolean);
  const saveMap=()=>{
    try{const text=exportMap(project,wadPaths);downloadText(text,`${settings.mapName||'untitled'}.map`);appendLogs([`Exported ${text.length} bytes of Svengine Valve 220 .map source.`]);}
    catch(err){appendLogs([`Export error: ${String(err)}`]);alert(String(err))}
  };
  const compile=async(mode:'game'|'preview'='game',selectedCompiler?:'sc'|'sdhlt')=>{
    if(compileBusy)return;
    const gameplayIssues=[...analyzeGameplay(project.objects),...validateNpcLogic(project.objects),...validateAudio(project.objects),...validateEnvironment(project.objects)];
    const gameplayErrors=gameplayIssues.filter(x=>x.severity==='error').map(x=>x.message);
    const gameplayWarnings=gameplayIssues.filter(x=>x.severity==='warning').map(x=>x.message);
    if(gameplayWarnings.length)appendLogs(gameplayWarnings.map(x=>`Gameplay warning: ${x}`));
    const state=useEditor.getState();
    const textureWarnings=textureCompileWarnings(project,state.textureAssets,wadPaths);
    if(textureWarnings.length)appendLogs(textureWarnings.slice(0,30));
    const diagnostic=analyzeMap(project,state.textureAssets,state.fgdClasses,state.fgdLoaded);
    const preflight=diagnostic.issues.filter(x=>x.severity==='warning');
    if(preflight.length)appendLogs([`Map Doctor: ${preflight.length} advisory warnings (see Studios → Map Doctor).`,...preflight.slice(0,10).map(x=>`Map Doctor [${x.code}]: ${x.message}`)]);
    const issues=[...validateProject(project),...gameplayErrors];
    if(issues.length){setDialog('output');issues.forEach(x=>appendLogs([`Invalid geometry: ${x}`]));alert(`Compilation blocked: fix these issues first:\n\n${issues.join('\n')}`);return;}
    const requestedSettings={...settings,compilerEngine:selectedCompiler||settings.compilerEngine};
    if(!(requestedSettings.compilerEngine==='sdhlt'?requestedSettings.sdhltDir:requestedSettings.compilerDir)||!requestedSettings.gameDir){setDialog('settings');appendLogs(['Set your selected compiler folder and game directory before compiling.']);return;}
    if(!/^[a-z][a-z0-9_-]*$/i.test(settings.mapName)){setDialog('settings');alert('Invalid map name: use letters, numbers, _ or -.');return;}
    let buildName:string;
    try{buildName=lightTestMapName(settings.mapName,mode==='preview'?'off':settings.radAmbientTest||'off')}
    catch(error){setDialog('settings');alert(String(error));return;}
    const compileSettings={...requestedSettings};
    const engineLabel=lightingCompilerLabel(compileSettings.compilerEngine);
    const compilerKey=lightingCompilerKey(compileSettings);
    useMapDoctorState.getState().beginBuild(buildName);
    if(mode==='preview'){setTruePreviewOpen(true);setTruePreviewBusy(true);setTruePreviewStatus(`Preparing ${engineLabel} preview…`);setDialog(null)}
    else setDialog('output');
    setCompileBusy(true);appendLogs([`Starting ${mode==='preview'?'temporary lighting preview':'build'} ${buildName}...`]);
    if(mode==='game'&&settings.radAmbientTest!=='off'&&settings.radAmbientTest)appendLogs([`SC-RAD diagnostic -ambient ${settings.radAmbientTest} ${settings.radAmbientTest} ${settings.radAmbientTest}; original ${settings.mapName}.bsp will NOT be overwritten. Test output: ${buildName}.bsp`]);
    let error=false,completed=false,previewId:string|null=null;
    try{
      const mapData=exportMap(project,wadPaths);
      await streamCompile({mapName:settings.mapName,mapData,compilerDir:compileSettings.compilerDir,gameDir:compileSettings.gameDir,wadPaths,radAmbientTest:mode==='preview'?'off':compileSettings.radAmbientTest||'off',previewOnly:mode==='preview',compilerEngine:compileSettings.compilerEngine||'sc',sdhltDir:compileSettings.sdhltDir||'',sdhltAO:!!compileSettings.sdhltAO,sdhltPCF:compileSettings.sdhltPCF||'off'},ev=>{
        useMapDoctorState.getState().ingest(ev);
        appendLogs([ev.message]);if(mode==='preview'&&ev.type==='stage')setTruePreviewStatus(ev.message);if(ev.type==='error')error=true;if(ev.type==='complete'){completed=true;previewId=ev.previewId||null;}
      });
      if(!error&&completed&&mode==='preview'){
        if(!previewId)throw Error(`Compiler did not issue a ${engineLabel} preview identifier.`);
        setTruePreviewStatus('Loading compiled BSP lightmaps…');
        const response=await fetch('/api/lighting-preview/bsp',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({previewId})});
        if(!response.ok)throw Error((await response.json().catch(()=>({}))).error||`HTTP ${response.status}`);
        const raw=await response.arrayBuffer();
        const parsed=parseBsp(raw,`${buildName}_lighting_preview.bsp`);
        if(!parsed.stats.lightmappedFaces)throw Error(`${engineLabel} produced no lightmapped faces. Check the compile log and SKY/brush layout.`);
        setTruePreviewSource(raw);setTruePreviewMap(parsed);setTruePreviewSnapshot(project);
        setTruePreviewCompilerKey(compilerKey);setTruePreviewCompilerLabel(engineLabel);
        setTruePreviewStatus(`${engineLabel} baked ${parsed.stats.lightmappedFaces} faces. Preview is read-only.`);
        appendLogs([`True Lighting Preview: ${parsed.stats.lightmappedFaces} compiled lightmapped faces; no game BSP was installed.`]);
      }else if(!error&&completed){setLastCompiled(buildName);appendLogs([`Build completed: ${buildName}.bsp. You can open it in BSP Viewer.`])}
      else if(mode==='preview')setTruePreviewStatus(`${engineLabel} preview failed. See Output for compiler details.`);
    }catch(err){appendLogs([`Build error: ${String(err)}`]);if(mode==='preview')setTruePreviewStatus(`Build error: ${String(err)}`)}
    finally{setCompileBusy(false);if(mode==='preview')setTruePreviewBusy(false)}
  };
  // View modes live in the 3D viewport, not beside Compile or inside Studios.
  // Reopening a cached bake never overwrites the game BSP or compiles needlessly.
  const chooseVisualization=(mode:'normal'|'quick'|'baked')=>{
    if(mode==='baked'){
      useEditor.getState().setEnvironmentPreview(false);
      setTruePreviewOpen(true);
      setTruePreviewLayout('split');
      // True Lighting is launched from Studios; never start an expensive build without consent.
      return;
    }
    setTruePreviewOpen(false);
    useEditor.getState().setEnvironmentPreview(mode==='quick');
  };
  const cancelCompile=async()=>{try{await fetch('/api/cancel',{method:'POST'});appendLogs(['Cancellation requested...'])}catch(err){appendLogs([String(err)])}};
  useEffect(()=>{
    const handle=(e:KeyboardEvent)=>{
      if(bspMode||welcomeOpen)return;
      if(useHudLayout.getState().editing){
        if(e.key==='Escape'){e.preventDefault();useHudLayout.getState().setEditing(false)}
        return;
      }
      // Modal dialogs own keyboard input; earlier releases allowed editing shortcuts
      // to modify objects while a settings/diagnostics panel was open.
      // Only generic dialogs without a dedicated Escape listener are closed here.
      if(document.querySelector('.modal-backdrop')){
        // Ctrl+S remains a valid project save even when a dialog is visible.
        if((e.ctrlKey||e.metaKey)&&e.code==='KeyS'){
          e.preventDefault();saveProject(useEditor.getState().project);return;
        }
        if(e.code==='Escape'&&['settings','about','visibility','output','doctor'].includes(dialog||'')){
          e.preventDefault();if(dialog==='about')closeHelp();else setDialog(null);
        }
        return;
      }
      const target=e.target as HTMLElement;if(target?.closest('input, textarea, select, [contenteditable]'))return;
      // In expanded True Lighting the BSP camera owns navigation even before
      // pointer lock is granted; never issue MAP editing/camera shortcuts.
      if(document.querySelector('.true-light-workbench.true-light-full'))return;
      // True Lighting fly-through owns movement keys while its canvas has pointer lock.
      if(document.pointerLockElement?.closest('.true-light-body'))return;
      // A full-screen Gameplay Studio graph owns keyboard input while open.
      if(document.querySelector('.gs-backdrop, .npc-backdrop'))return;
      // Player Walk consumes ordinary movement keys; none of the editing
      // shortcuts (G/R/C, Delete, duplicating) may modify the map here.
      if(useEditor.getState().walkMode){
        if(e.code==='Escape'||e.code==='F5'||e.code==='KeyP'&&e.shiftKey){
          e.preventDefault();setWalk(false);releaseSafeWalkFullscreen();
          if(document.pointerLockElement)document.exitPointerLock?.();
        }else if(e.code==='Space')e.preventDefault();
        return;
      }
      if((e.code==='F5'||e.code==='KeyP'&&e.shiftKey)&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!document.querySelector('.modal-backdrop')){
        e.preventDefault();
        const safety=readPreviewSettings('walk-preview-2',normalizeWalkPreview);
        requestSafeWalkFullscreen(safety.safeFullscreen,message=>useEditor.getState().appendLogs([message]));
        setWalk(true);
        const canvas=document.querySelector('.viewport-frame canvas') as HTMLCanvasElement|null;
        // Fullscreen may release pointer lock while entering. In protected mode,
        // click the canvas once after fullscreen loads to recapture the mouse.
        if(!safety.safeFullscreen)canvas?.requestPointerLock?.().catch(()=>{});
        return;
      }
      // Esc releases MAP camera pointer lock without changing the chosen tool.
      // Gameplay Test / Fly have their own capture lifecycle.
      if(e.code==='Escape'&&document.pointerLockElement===document.querySelector('.viewport-frame canvas')
          &&!useEditor.getState().flyMode&&!useEditor.getState().walkMode){
        e.preventDefault();document.exitPointerLock?.();return;
      }
      if(useEditor.getState().modalTransform){
        if(e.key==='Escape'){e.preventDefault();finishModal(false);return;}
        if(e.repeat)return;
        const modalAction=shortcutAction(useEditor.getState().controls,keyEventBinding(e));
        if(modalAction==='move'||modalAction==='rotate'||modalAction==='scale'){e.preventDefault();finishModal(true);return;}
        // Modal viewport handles X/Y/Z, number entry, Enter and mouse input.
        return;
      }
      if(e.key==='Escape'&&useEditor.getState().architecturePlacement){e.preventDefault();useEditor.getState().startArchitecturePlacement(null);return;}
      // Internal brush clipboard: copy and paste work even when selection changes.
      // Do not intercept ordinary text-field/browser clipboard operations.
      if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&!e.repeat&&e.code==='KeyC'){
        if(useEditor.getState().selectedIds.some(id=>useEditor.getState().project.objects.some(o=>o.id===id&&o.kind==='brush'&&!o.locked&&!o.hidden))){
          e.preventDefault();useEditor.getState().copySelectedBrushes();
        }
        return;
      }
      if((e.ctrlKey||e.metaKey)&&!e.altKey&&!e.shiftKey&&!e.repeat&&e.code==='KeyV'){
        if(useEditor.getState().brushClipboard.length){
          e.preventDefault();useEditor.getState().pasteCopiedBrushes();
        }
        return;
      }
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject(useEditor.getState().project);return}
      if(e.code==='KeyE'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!useEditor.getState().flyMode&&useEditor.getState().geometryMode==='face'&&useEditor.getState().selectedFace!==null){
        e.preventDefault();
        try{useEditor.getState().extrudeSelected(16)}catch(error){useEditor.getState().appendLogs([`Extrusion: ${String(error)}`])}
        return;
      }
      if(!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.altKey&&e.code==='KeyH') {e.preventDefault();useEditor.getState().revealAll();return;}
      if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.code==='KeyH') {e.preventDefault();if(e.shiftKey)useEditor.getState().isolateSelection();else useEditor.getState().hideSelection();return;}
      if(!e.ctrlKey&&!e.metaKey&&!e.altKey&&!e.shiftKey&&e.code==='NumpadDivide') {e.preventDefault();useEditor.getState().toggleTemporaryIsolation();return;}
      if(e.key==='Delete'&&e.code!=='NumpadDecimal'){e.preventDefault();remove();return}
      if(e.key==='Escape'){
        e.preventDefault();
        if(useEditor.getState().activeDecal){useEditor.getState().chooseDecal(null);return;}
        if(useEditor.getState().measureMode){useEditor.getState().toggleMeasure();return;}
        if(useEditor.getState().flyMode){setFly(false);if(document.pointerLockElement)document.exitPointerLock?.();}
        else if(useEditor.getState().drawMode)setDrawMode(false);
        else useEditor.getState().setMode('select');
        return;
      }
      const action=shortcutAction(useEditor.getState().controls,keyEventBinding(e));
      if(!action)return;
      // Allow holding a numpad key to orbit/pan/zoom continuously while
      // never repeating tool toggles, modal transforms or projection changes.
      if(e.repeat&&!['orbitLeft','orbitRight','orbitUp','orbitDown','panLeft','panRight','panUp','panDown','zoomIn','zoomOut'].includes(action))return;
      e.preventDefault();
      if(action==='move')useEditor.getState().toggleShortcutGizmo('translate');
      else if(action==='rotate')useEditor.getState().toggleShortcutGizmo('rotate');
      else if(action==='scale')useEditor.getState().toggleShortcutGizmo('scale');
      else if(action==='fly'){
        const entering=!useEditor.getState().flyMode;
        toggleFly();
        if(entering){
          const canvas=document.querySelector('.viewport-frame canvas') as HTMLCanvasElement|null;
          // A genuine keyboard interaction is allowed to request pointer lock.
          canvas?.requestPointerLock?.().catch(()=>{});
        }else if(document.pointerLockElement)document.exitPointerLock?.();
      }
      else issueCameraCommand(action);
    };
    window.addEventListener('keydown',handle);return()=>window.removeEventListener('keydown',handle);
  },[undo,redo,duplicate,remove,setMode,setDrawMode,toggleFly,setFly,setWalk,issueCameraCommand,toggleModal,finishModal,bspMode,welcomeOpen,dialog]);
  // Browser shortcuts can be reserved above page JavaScript. Guard what the
  // browser allows, and ask before unloading during a live Player Walk.
  // We never attempt to capture Windows-key shortcuts or change global hotkeys.
  useEffect(()=>{
    const guard=(event:KeyboardEvent)=>{
      const state=useEditor.getState();
      if((state.walkMode||state.flyMode)&&shouldGuardNavigationKey(event))event.preventDefault();
    };
    window.addEventListener('keydown',guard,true);
    return()=>window.removeEventListener('keydown',guard,true);
  },[]);
  useEffect(()=>{
    if(!walkMode){releaseSafeWalkFullscreen();return;}
    const confirmExit=(event:BeforeUnloadEvent)=>{
      // Requires a real user interaction; the browser owns the dialog text and
      // may decline to show it. This is a safety net, not a Ctrl+W override.
      event.preventDefault();
      event.returnValue='';
    };
    window.addEventListener('beforeunload',confirmExit);
    return()=>window.removeEventListener('beforeunload',confirmExit);
  },[walkMode]);
  useEffect(()=>{
    let cancelled=false;
    fetch('/svstudio.wad').then(r=>{if(!r.ok)throw new Error('Built-in WAD unavailable');return r.blob()})
      .then(blob=>parseWad(new File([blob],'svstudio.wad')))
      .then(assets=>{if(!cancelled)useEditor.getState().setTextures(assets,'svstudio.wad')})
      .catch(err=>useEditor.getState().appendLogs([`Built-in texture pack: ${String(err)}`]));
    return()=>{cancelled=true};
  },[]);
  useEffect(()=>{
    let cancelled=false;
    void loadSavedWadFiles().then(async files=>{
      let restored=0;
      for(const file of files){
        if(cancelled)break;
        try{
          if(file.name.toLowerCase()==='decals.wad'){
            const {parseDecalWad}=await import('./engine/wad');
            const decals=await parseDecalWad(file,{remember:false});
            if(!cancelled){useEditor.getState().setDecalAssets(decals,file.name);restored++;}
          }else{const textures=await parseWad(file,{remember:false});
            if(cancelled)break;useEditor.getState().setTextures(textures,file.name);restored++;}
        }catch(error){useEditor.getState().appendLogs([`Saved WAD ${file.name}: ${String(error)}`]);}
      }
      if(!cancelled&&restored)useEditor.getState().appendLogs([`Restored ${restored} previously imported WAD file(s) from browser storage. Build WAD paths must still reference the real files.`]);
    }).catch(error=>{if(!cancelled)useEditor.getState().appendLogs([`WAD restore unavailable: ${String(error)}`]);});
    return()=>{cancelled=true};
  },[]);
  useEffect(()=>{
    const warning=(event:Event)=>useEditor.getState().appendLogs([String((event as CustomEvent<string>).detail)]);
    window.addEventListener('svenstudio:wad-cache-warning',warning);
    return()=>window.removeEventListener('svenstudio:wad-cache-warning',warning);
  },[]);
  useEffect(()=>{const handler=(event:Event)=>{const id=(event as CustomEvent<string>).detail;if(id==='npc'||id==='sound'||id==='gameplay'||id==='cinematic'||id==='lighting'||id==='doctor'||id==='visibility'||id==='output'){setDialog(id);setFileMenu(false);setStudiosMenu(false);setWorkspaceMenu(false)}};document.addEventListener('svenstudio:open-studio',handler);return()=>document.removeEventListener('svenstudio:open-studio',handler)},[]);
  useEffect(()=>{if(dialog){setFileMenu(false);setStudiosMenu(false);setWorkspaceMenu(false)}},[dialog]);
  // One authoritative entry point for Gameplay Test. Keep the existing Walk
  // store, fullscreen protection and saved preview settings unchanged.
  const exitGameplayTest=()=>{
    if(!useEditor.getState().walkMode)return;
    setWalk(false);
    releaseSafeWalkFullscreen();
    if(document.pointerLockElement)document.exitPointerLock?.();
  };
  const toggleGameplayTest=()=>{
    if(useEditor.getState().walkMode){exitGameplayTest();return;}
    if(bspLoading)return;
    setBspMode(false);
    const preferences=readPreviewSettings('walk-preview-2',normalizeWalkPreview);
    requestSafeWalkFullscreen(preferences.safeFullscreen,message=>useEditor.getState().appendLogs([message]));
    setWalk(true);
    if(!preferences.safeFullscreen){
      const canvas=document.querySelector('.viewport-frame canvas') as HTMLCanvasElement|null;
      // When returning from BSP Viewer the canvas mounts on the next render.
      // In that case clicking the viewport captures the mouse, as before.
      canvas?.requestPointerLock?.().catch(()=>{});
    }
  };
  // Keep BSP and Gameplay mutually exclusive, including file-menu opens.
  useEffect(()=>{if(bspMode&&walkMode)exitGameplayTest()},[bspMode,walkMode]);
  const openWelcome=()=>{
    // Closing only the view; never replace the editor project or recreate the viewport.
    if(document.pointerLockElement)document.exitPointerLock?.();
    if(useEditor.getState().walkMode)exitGameplayTest();
    if(useEditor.getState().flyMode)setFly(false);
    setDialog(null);setFileMenu(false);setStudiosMenu(false);setWorkspaceMenu(false);setExtraMenu(false);
    setWelcomeOpen(true);
  };
  const primitive=(type:PlaceableShape)=>useEditor.getState().setPlacementShape(placementShape===type?null:type);
  // Workspace interface scale belongs exclusively to MAP Editor. The Welcome
  // overlay and BSP Viewer are complete independent views that must use 100%
  // physical CSS pixels regardless of the user's editor UI scale (80–120%).
  // Changing modes also gives R3F the correct container size to re-measure.
  const shellScale=resolveShellScale(uiScale,welcomeOpen,bspMode);
  return <div className={`app-shell accent-${accent} ${welcomeOpen?'welcome-home-active':''} ${bspMode?'bsp-scale-isolated':''} ${autoLayout?'adaptive-ui-enabled':''}`} style={{zoom:shellScale,width:`${100/shellScale}vw`,height:`${100/shellScale}vh`,minHeight:0,'--ui-font-scale':fontScale} as React.CSSProperties}>
    <header ref={headerRef} className="titlebar" data-header-mode={headerMode}>
      <div className="titlebar-leading">
      <button type="button" className={`brand brand-home-trigger ${welcomeOpen?'brand-home-active':''}`} onClick={openWelcome} aria-pressed={welcomeOpen} title={locale==='es'?'Abrir pantalla de inicio':'Open home screen'}><span className="brand-logo"><Box size={20} strokeWidth={2.3}/></span><span>SVEN<span className="brand-light">STUDIO</span></span><span className="brand-tag">3D</span><span className="version-label">v1.7.19</span></button>
      <div className="top-divider"/>
      <div className="menu-parent"><button ref={fileButton} type="button" aria-expanded={fileMenu} aria-controls="sven-file-menu" aria-haspopup="menu" className={`top-nav ${fileMenu?'chosen':''}`} onClick={()=>{setStudiosMenu(false);setWorkspaceMenu(false);setFileMenu(v=>!v)}}>{t('File')} <ChevronDown size={12}/></button>
        <TopDropdown anchor={fileButton} open={fileMenu} onClose={()=>setFileMenu(false)} id="sven-file-menu" className="file-menu" align="left" width={240}><MenuButton onClick={()=>{if(confirm(t('Start a new project? Save existing work first.')))newProject();setFileMenu(false)}}><FilePlus2 size={15}/> {t('New project')}</MenuButton>
          <MenuButton onClick={()=>{setFileMenu(false);projectInput.current?.click()}}><FolderOpen size={15}/> {t('Open project')}</MenuButton>
          <MenuButton onClick={()=>{setFileMenu(false);mapInput.current?.click()}}><FileUp size={15}/> {t('Import .MAP')}</MenuButton>
          <MenuButton onClick={()=>{setFileMenu(false);bspInput.current?.click()}}><ScanEye size={15}/> {t('Open .BSP (read-only)')}</MenuButton>
          <MenuButton onClick={()=>{setFileMenu(false);void openCompiledBsp()}}><ScanEye size={15}/> {t('Open compiled BSP')}</MenuButton>
          <div className="menu-separator"/>
          <MenuButton onClick={()=>{saveProject(project);setFileMenu(false)}}><Save size={15}/> {t('Save project')} <span className="shortcut">Ctrl+S</span></MenuButton>
          <MenuButton onClick={async()=>{setFileMenu(false);const backup=await readRecoveryBackup();if(!backup){window.alert(t('No earlier recovery snapshot is available.'));return;}if(window.confirm(t('Restore the previous locally saved project? Your current work will be replaced.'))){loadProject(backup.project);appendLogs([`Recovered previous snapshot from ${new Date(backup.savedAt).toLocaleString()}`]);}}}><FolderOpen size={15}/> {t('Restore previous autosave')}</MenuButton>
          <MenuButton onClick={()=>{saveMap();setFileMenu(false)}}><FileDown size={15}/> {t('Export Svengine .MAP')}</MenuButton>
          <MenuButton onClick={()=>{setFileMenu(false);setDialog('packager')}}><PackagePlus size={15}/> {t('Map Packager Studio')}</MenuButton>
        </TopDropdown>
      </div>
      <button className="top-nav" onClick={()=>setDialog('about')}>{t('Help')}</button>
      <FullscreenMenuButton/><button className={`top-nav bt-top-button ${buildTogetherStatus==="online"?"chosen":""}`} title="BuildTogether — Multiplayer Mapping" onClick={()=>setDialog("buildTogether")}><Users size={15}/> BuildTogether</button>
      <div className="titlebar-more-parent"><button ref={extraButton} type="button" className="top-nav titlebar-more" title={locale==='es'?'Más acciones':'More actions'} aria-label={locale==='es'?'Más acciones':'More actions'} aria-expanded={extraMenu} aria-haspopup="menu" aria-controls="sven-extra-menu" onClick={()=>{setFileMenu(false);setStudiosMenu(false);setWorkspaceMenu(false);setExtraMenu(v=>!v)}}><Menu size={18}/><span>{locale==='es'?'Más':'More'}</span></button>
        <TopDropdown anchor={extraButton} open={extraMenu} onClose={()=>setExtraMenu(false)} id="sven-extra-menu" className="studio-menu-dropdown titlebar-extra-menu" align="left" width={265}>
          <button role="menuitem" onClick={()=>{setDialog('about');setExtraMenu(false)}}><Info size={16}/>{t('Help')}</button>
          <div className="titlebar-extra-fullscreen"><FullscreenMenuButton/></div>
          <button role="menuitem" onClick={()=>{setDialog('buildTogether');setExtraMenu(false)}}><Users size={16}/>BuildTogether</button>
          <div className="menu-separator"/>
          <button role="menuitem" onClick={()=>{setWelcomeOpen(false);exitGameplayTest();setBspMode(false);setExtraMenu(false)}}><Box size={16}/>{t('MAP Editor')}</button>
          <button role="menuitem" disabled={bspLoading} onClick={()=>{setWelcomeOpen(false);exitGameplayTest();if(bspMap)setBspMode(true);else if(lastCompiled)void openCompiledBsp();else bspInput.current?.click();setExtraMenu(false)}}><ScanEye size={16}/>{t('BSP Viewer')}</button>
          <button role="menuitem" disabled={bspLoading} onClick={()=>{setWelcomeOpen(false);toggleGameplayTest();setExtraMenu(false)}}><Play size={16}/>{t('Gameplay Test')}</button>
          <div className="menu-separator"/>
          <button role="menuitem" onClick={()=>{setDialog('layout');setExtraMenu(false)}}><LayoutTemplate size={16}/>{t('Workspace layout')}</button>
          <button role="menuitem" onClick={()=>{setDialog('settings');setExtraMenu(false)}}><Settings2 size={16}/>{t('Build configuration')}</button>
          <button role="menuitem" onClick={()=>{setDialog('visibility');setExtraMenu(false)}}><ScanEye size={16}/>{t('Visibility')}</button>
          <button role="menuitem" onClick={()=>{setDialog('cinematic');setExtraMenu(false)}}><Clapperboard size={16}/>{t('Cinematic Camera Studio')}</button>
          <button role="menuitem" onClick={()=>{setDialog('entityAppearance');setExtraMenu(false)}}><Palette size={16}/>{t('Entity visuals')}</button>
          <button role="menuitem" onClick={()=>{setDialog('controls');setExtraMenu(false)}}><Keyboard size={16}/>{t('Camera & Gizmo Controls')}</button>
          <button role="menuitem" onClick={()=>{useEditor.getState().setResourceView('decals');useStudioLayout.getState().setVisible('assets',true);setExtraMenu(false)}}><Paintbrush size={16}/>Decal Studio</button>
          <button role="menuitem" onClick={()=>{setDialog('packager');setExtraMenu(false)}}><PackagePlus size={16}/>{t('Map Packager Studio')}</button>
          <button role="menuitem" onClick={()=>{setDialog('output');setExtraMenu(false)}}><Terminal size={16}/>{t('Output')}</button>
          <button role="menuitem" disabled={walkMode||bspMode} onClick={()=>{document.dispatchEvent(new Event('svenstudio:toggle-gameplay-settings'));setExtraMenu(false)}}><Play size={16}/>{t('Gameplay Test settings')}</button>
          <button role="menuitem" onClick={()=>{setDialog('npc');setExtraMenu(false)}}><Skull size={16}/>{t('NPC & AI Studio')}</button>
          <button role="menuitem" onClick={()=>{setDialog('gameplay');setExtraMenu(false)}}><GitBranch size={16}/>{t('Gameplay Studio')}</button>
          <button role="menuitem" onClick={()=>{setDialog('lighting');setExtraMenu(false)}}><SunMoon size={16}/>{t('Lighting & Environment Studio')}</button>
          <button role="menuitem" onClick={()=>{setDialog('terrain');setExtraMenu(false)}}><Mountain size={16}/>{t('Terrain & Shape Studio')}</button>
          <button role="menuitem" onClick={()=>{setDialog('sound');setExtraMenu(false)}}><Headphones size={16}/>{t('Audio Studio')}</button>
          <button role="menuitem" onClick={()=>{setDialog('doctor');setExtraMenu(false)}}><CheckCircle2 size={16}/>{t('Map Doctor')}</button>
          <label className="titlebar-extra-language">{t('Interface language')}<select aria-label={t('Interface language')} value={localePreference} onChange={e=>{setLocale(e.target.value as typeof localePreference);setExtraMenu(false)}}><option value="auto">{t('Automatic (system language)')}</option>{LANGUAGES.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
        </TopDropdown>
      </div>
      </div>
      <div className="project-title"><span className="project-status"/><input title={t('Project display name')} value={project.name} onChange={e=>setName(e.target.value)}/><span className="version-label" title={recoveryStatus==='error'?t('Autosave failed; export a project backup.'):t('Autosave is stored in this browser. Export a project file for a portable backup.')}>{recoveryStatus==='error'?t('Autosave error'):recoveryStatus==='saved'?t('Autosaved'):lastRecoveredAt()?t('Session recovered'):t('Workspace')}</span></div>
      <div className="titlebar-right"><div className="bsp-tab-switch" role="group" aria-label="MAP / BSP / Gameplay Test">
        <button className={!bspMode&&!walkMode?'active':''} aria-pressed={!bspMode&&!walkMode} onClick={()=>{setWelcomeOpen(false);exitGameplayTest();setBspMode(false)}}>{t('MAP Editor')}</button>
        <button className={bspMode?'active':''} aria-pressed={bspMode} disabled={bspLoading} onClick={()=>{setWelcomeOpen(false);exitGameplayTest();if(bspMap)setBspMode(true);else if(lastCompiled)void openCompiledBsp();else bspInput.current?.click()}}><ScanEye size={14}/>{bspLoading?'...':t('BSP Viewer')}</button>
        <button className={walkMode?'active gameplay-tab-active':''} aria-pressed={walkMode} disabled={bspLoading} title={t('Gameplay Test')} onClick={()=>{setWelcomeOpen(false);toggleGameplayTest()}}><Play size={14}/>{t('Gameplay Test')}</button>
      </div><div className="studio-menu-parent"><button ref={studiosButton} type="button" aria-expanded={studiosMenu} aria-controls="sven-studios-menu" aria-haspopup="menu" className="studio-menu-button" onClick={()=>{setFileMenu(false);setWorkspaceMenu(false);setStudiosMenu(v=>!v)}}><Layers size={16}/>{t('Studios')}<ChevronDown size={12}/></button><TopDropdown anchor={studiosButton} open={studiosMenu} onClose={()=>setStudiosMenu(false)} id="sven-studios-menu" className="studio-menu-dropdown" align="right" width={242}><button role="menuitem" onClick={()=>{useEditor.getState().setEnvironmentPreview(false);setTruePreviewOpen(true);setTruePreviewLayout('split');setStudiosMenu(false)}}><SunMoon size={16}/>True Lighting</button><button role="menuitem" onClick={()=>{setDialog('gameplay');setStudiosMenu(false)}}><GitBranch size={16}/>{t('Gameplay Studio')}</button><button role="menuitem" onClick={()=>{setDialog('cinematic');setStudiosMenu(false)}}><Clapperboard size={16}/>{t('Cinematic Camera Studio')}</button><button role="menuitem" onClick={()=>{setDialog('npc');setStudiosMenu(false)}}><Skull size={16}/>{t('NPC & AI Studio')}</button><button role="menuitem" onClick={()=>{useEditor.getState().setResourceView('decals');useStudioLayout.getState().setVisible('assets',true);setStudiosMenu(false)}}><Paintbrush size={16}/>Decal Studio</button><button role="menuitem" onClick={()=>{setDialog('sound');setStudiosMenu(false)}}><Headphones size={16}/>{t('Audio Studio')}</button><button role="menuitem" onClick={()=>{setDialog('lighting');setStudiosMenu(false)}}><SunMoon size={16}/>{t('Lighting & Environment Studio')}</button><button role="menuitem" onClick={()=>{setDialog('terrain');setStudiosMenu(false)}}><Mountain size={16}/>{t('Terrain & Shape Studio')}</button><button role="menuitem" onClick={()=>{setDialog('doctor');setStudiosMenu(false)}}><CheckCircle2 size={16}/>{t('Map Doctor')}</button></TopDropdown></div><label className="language-picker" title={t('Interface language')}><Globe2 size={15}/><select aria-label={t('Interface language')} value={localePreference} onChange={e=>setLocale(e.target.value as typeof localePreference)}><option value="auto">{t('Automatic (system language)')} · {LANGUAGES.find(l=>l.id===locale)?.label??'English'}</option>{LANGUAGES.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label><div className="studio-menu-parent workspace-menu-parent"><button ref={workspaceButton} type="button" aria-expanded={workspaceMenu} aria-controls="sven-workspace-menu" aria-haspopup="menu" className="studio-menu-button workspace-menu-button" onClick={()=>{setFileMenu(false);setStudiosMenu(false);setWorkspaceMenu(v=>!v)}}><Settings2 size={16}/><span>{t('Workspace')}</span><ChevronDown size={12}/></button><TopDropdown anchor={workspaceButton} open={workspaceMenu} onClose={()=>setWorkspaceMenu(false)} id="sven-workspace-menu" className="studio-menu-dropdown workspace-menu-dropdown" align="right" width={266}>
        <button role="menuitem" onClick={()=>{setDialog('layout');setWorkspaceMenu(false)}}><LayoutTemplate size={16}/>{t('Workspace layout')}</button>
        <button role="menuitem" onClick={()=>{setDialog('visibility');setWorkspaceMenu(false)}}><Eye size={16}/>{t('Visibility manager')}</button>
        <button role="menuitem" onClick={()=>{setDialog('entityAppearance');setWorkspaceMenu(false)}}><Palette size={16}/>{t('Entity visuals')}</button>
        <button role="menuitem" onClick={()=>{setDialog('controls');setWorkspaceMenu(false)}}><Keyboard size={16}/>{t('Camera & Gizmo Controls')}</button>
        <div className="menu-separator"/>
        <button role="menuitem" onClick={()=>{setDialog('output');setWorkspaceMenu(false)}}><Terminal size={16}/>{t('Output')}</button>
        <button role="menuitem" disabled={walkMode||bspMode} onClick={()=>{document.dispatchEvent(new Event('svenstudio:toggle-gameplay-settings'));setWorkspaceMenu(false)}}><Play size={16}/>{t('Gameplay Test settings')}</button>
      </TopDropdown></div><button className="top-build-settings" title={t('Build configuration')} aria-label={t('Build configuration')} onClick={()=>setDialog('settings')}><Settings2 size={15}/> {t('Build configuration')}</button>{compileBusy?<button className="top-stop" onClick={cancelCompile}><StopCircle size={14}/> {t('Stop Build')}</button>:<button className="top-compile" onClick={()=>void compile('game')}><Play size={14} fill="currentColor"/> {t('Compile Map')}</button>}</div>
      <input ref={projectInput} type="file" accept=".json,.svenstudio.json" hidden onChange={e=>imported(e,'project')}/>
      <input ref={mapInput} type="file" accept=".map" hidden onChange={e=>imported(e,'map')}/>
      <input ref={bspInput} type="file" accept=".bsp" hidden onChange={loadedBsp}/>
    </header>
    <main className="sven-workstack">
    <div className={`sven-editor-workspace ${welcomeOpen?'welcome-covered':''}`} inert={welcomeOpen}>
    {bspMode&&bspMap?<div className="bsp-workspace"><BspViewer map={bspMap} source={bspSource} initialBaked={bspPreviewBaked} onBack={()=>setBspMode(false)} onOpen={()=>bspInput.current?.click()} onCompiled={()=>void openCompiledBsp()} onOpenRecoveredMap={openRecoveredMap}/></div>:<DockWorkspace toolbar={<div className="ribbon">
      <div className="ribbon-group" {...toolbarGroupProps('transform')}><div className="ribbon-tools"><ToolButton title={`${t('Move')} [${displayBinding(controls.shortcuts.move)}]`} active={mode==='translate'} onClick={()=>activateGizmoMode('translate')}><Move3D size={20}/><small>{t('Move')}</small></ToolButton><ToolButton title={`${t('Rotate')} [${displayBinding(controls.shortcuts.rotate)}]`} active={mode==='rotate'} onClick={()=>activateGizmoMode('rotate')}><Rotate3D size={20}/><small>{t('Rotate')}</small></ToolButton><ToolButton title={`${t('Scale')} [${displayBinding(controls.shortcuts.scale)}]`} active={mode==='scale'} onClick={()=>activateGizmoMode('scale')}><Scaling size={20}/><small>{t('Scale')}</small></ToolButton></div><small className="ribbon-caption">{toolbarGrip('transform')}{t('TRANSFORM')} · {t(mode==='select'?'SELECT':mode.toUpperCase())}</small></div>
      <div className="ribbon-group" {...toolbarGroupProps('view')}><div className="ribbon-tools"><ToolButton title={t('Toggle wireframe')} active={wireframe} onClick={()=>setFlag('wireframe',!wireframe)}><Eye size={20}/><small>{t('Wire')}</small></ToolButton><ToolButton title={t('Grid visibility')} active={showGrid} onClick={()=>setFlag('showGrid',!showGrid)}><Grid3x3 size={20}/><small>{t('Grid')}</small></ToolButton><ToolButton title={t('Show entity names')} active={showEntityNames} onClick={()=>setFlag('showEntityNames',!showEntityNames)}><FileCode2 size={20}/><small>{t('Labels')}</small></ToolButton><ToolButton title={t(showTransformGizmo?'Hide transform gizmo':'Show transform gizmo')} active={showTransformGizmo} onClick={()=>setShowTransformGizmo(!showTransformGizmo)}>{showTransformGizmo?<Move3D size={20}/>:<EyeOff size={20}/>}<small>{t('Gizmo')}</small></ToolButton><ToolButton title={t('Ghost mode')} active={ghostHidden} onClick={toggleGhostHidden}><Ghost size={20}/><small>{t('Ghost mode')}</small></ToolButton></div><small className="ribbon-caption">{toolbarGrip('view')}{t('VIEW')}</small></div>
      <div className="ribbon-group" {...toolbarGroupProps('geometry')}><div className="ribbon-tools">
        {(['object','vertex','edge','face'] as const).map(value=><ToolButton key={value} active={geometryMode===value} title={t(value==='object'?'Object':value==='vertex'?'Edit vertices':value==='edge'?'Edit edges':'Face selection mode')} onClick={()=>setGeometryMode(value)}>
          {value==='vertex'?<span className="large-glyph">•</span>:value==='edge'?<span className="large-glyph">╱</span>:value==='face'?<Paintbrush size={19}/>:<Box size={19}/>}<small>{t(value==='object'?'Object':value==='vertex'?'Vertex':value==='edge'?'Edge':'Face')}</small>
        </ToolButton>)}
      </div><small className="ribbon-caption">{toolbarGrip('geometry')}SVENGINE · {t('Geometry editing').toUpperCase()}</small></div>
      <div className="ribbon-group" {...toolbarGroupProps('tools')}><div className="ribbon-tools"><ToolButton active={measureMode} title="Measure distance: click two surfaces (Esc to exit)" onClick={toggleMeasure}><Ruler size={20}/><small>Measure</small></ToolButton></div><small className="ribbon-caption">{toolbarGrip('tools')}TOOLS</small></div>
      <div className="ribbon-group" {...toolbarGroupProps('grid')}><div className="ribbon-tools"><ToolButton title={t('Snap to grid')} active={snapping} onClick={toggleSnap}><Magnet size={20}/><small>{t('Snap')}</small></ToolButton><label className="snap-step-control" title={t('Visual grid')}><small>{t('Visual grid')}</small><select className="snap-select" aria-label={t('Visual grid')} value={gridDisplayStep} onChange={e=>setGridDisplayStep(Number(e.target.value))}>{[1,2,4,8,16,32,64,128,256].map(v=><option key={v} value={v}>{v}u</option>)}</select></label><label className="snap-step-control" title={t('Move / draw step')}><small>{t('Move / draw step')}</small><select className="snap-select" aria-label={t('Move / draw step')} value={snap} onChange={e=>setSnap(Number(e.target.value))}>{[1,2,4,8,16,32,64,128,256].map(v=><option key={v} value={v}>{v}u</option>)}</select></label>{drawMode&&<label className="draw-height">{t('Height')} <input type="number" min="1" max="131072" step={snap} value={drawHeight} onChange={e=>{if(Number.isFinite(e.target.valueAsNumber))setDrawHeight(e.target.valueAsNumber)}} title={t('Height of new blocks in Svengine units')}/></label>}</div><small className="ribbon-caption">{toolbarGrip('grid')}{t('Grid').toUpperCase()}</small></div>
      <div className="ribbon-group last" {...toolbarGroupProps('edit')}><div className="ribbon-tools"><ToolButton title={t('Undo')} disabled={!history.length} onClick={undo}><Undo2 size={20}/><small>{t('Undo')}</small></ToolButton><ToolButton title={t('Redo')} disabled={!future.length} onClick={redo}><Redo2 size={20}/><small>{t('Redo')}</small></ToolButton><ToolButton title={t('Clone')} disabled={!selected} onClick={duplicate}><Copy size={19}/><small>{t('Clone')}</small></ToolButton><ToolButton title={t('Delete')} disabled={!selected} onClick={remove}><Trash2 size={19}/><small>{t('Delete')}</small></ToolButton></div><small className="ribbon-caption">{toolbarGrip('edit')}{t('EDIT')}</small></div>
    <div className="ribbon-group" {...toolbarGroupProps('studios')}>
      <div className="ribbon-tools">
        <ToolButton title={t('Shapes')} onClick={()=>{if(!useHudLayout.getState().items.shapes.visible){useHudLayout.getState().update('shapes',{visible:true});return;}document.dispatchEvent(new Event('svenstudio:toggle-shapes'))}}><Box size={20}/><small>{t('Shapes')}</small></ToolButton>
        <ToolButton title={t('Visibility manager')} onClick={()=>setDialog('visibility')}><ScanEye size={20}/><small>{t('Visibility')}</small></ToolButton>
        <ToolButton title={t('Workspace layout')} onClick={()=>setDialog('layout')}><LayoutTemplate size={20}/><small>{t('Layout')}</small></ToolButton>
        <ToolButton title={t('Terrain & Shape Studio')} onClick={()=>setDialog('terrain')}><Mountain size={20}/><small>{t('Terrain')}</small></ToolButton>
        <ToolButton title={t('Gameplay Studio')} onClick={()=>setDialog('gameplay')}><GitBranch size={20}/><small>{t('Gameplay')}</small></ToolButton>
        <ToolButton title={t('NPC & AI Studio')} onClick={()=>setDialog('npc')}><Skull size={20}/><small>{t('NPC')}</small></ToolButton>
        <ToolButton title="BuildTogether — Multiplayer Mapping" onClick={()=>setDialog("buildTogether")}><Users size={20}/><small>Together</small></ToolButton>
        <ToolButton title="Decal Studio" onClick={()=>{useEditor.getState().setResourceView('decals');useStudioLayout.getState().setVisible('assets',true)}}><Paintbrush size={20}/><small>Decals</small></ToolButton>
        <ToolButton title={t('Map Doctor')} onClick={()=>setDialog('doctor')}><CheckCircle2 size={20}/><small>{t('Map Doctor')}</small></ToolButton>
        <ToolButton title={t('Map Packager Studio')} onClick={()=>setDialog('packager')}><PackagePlus size={20}/><small>{t('Package')}</small></ToolButton>
      </div><small className="ribbon-caption">{toolbarGrip('studios')}{t('Studios')}</small>
    </div>
    </div>} viewport={<div className={`true-light-workbench ${truePreviewOpen&&truePreviewLayout==='full'?'true-light-full':''}`}><div className="true-light-map"><div className="viewport-column"><ErrorBoundary label="viewport 3D" compact><Viewport trueLightingOpen={truePreviewOpen} trueLightingBusy={truePreviewBusy} onVisualizationMode={chooseVisualization}/></ErrorBoundary></div></div>{truePreviewOpen&&<ErrorBoundary label="True Lighting preview" compact><TrueLightingPreview map={truePreviewMap} compilerLabel={truePreviewCompilerLabel} working={truePreviewBusy||compileBusy} status={truePreviewStatus} stale={!!truePreviewMap&&(truePreviewSnapshot!==project||truePreviewCompilerKey!==lightingCompilerKey(settings))} layout={truePreviewLayout} onToggleLayout={()=>setTruePreviewLayout(v=>v==='split'?'full':'split')} onBuild={engine=>void compile('preview',engine)} onClose={()=>{setTruePreviewOpen(false);setTruePreviewLayout('split')}} onOpenBsp={()=>{if(!truePreviewMap)return;setBspSource(truePreviewSource);setBspMap(truePreviewMap);setBspPreviewBaked(true);setBspMode(true)}}/></ErrorBoundary>}</div>} consolePanel={null}/>}
    </div>
    {welcomeOpen&&<WelcomeScreen onStart={()=>setWelcomeOpen(false)}/>}
    </main>
    <footer className="statusbar"><div><span className="status-ok"/>{t('Ready')} <span className="status-divider"/> Svengine · Valve 220 <span className="status-divider"/> {project.objects.filter(o=>o.kind==='brush').length} {t('brushes')} <span className="status-divider"/> {project.objects.filter(o=>o.kind==='entity').length} {t('entities')}</div><div><Keyboard size={13}/> {displayBinding(controls.shortcuts.move)} {t('Move')} · {displayBinding(controls.shortcuts.rotate)} {t('Rotate')} · {displayBinding(controls.shortcuts.scale)} {t('Scale')} · {walkMode?t('Gameplay Test'):flyMode?t('Fly ON'):'RMB look · WASD · Q/E'} <span className="status-divider welcome-hide-version"/> <span className="welcome-hide-version">SvenStudio 3D v1.7.19</span></div></footer>
    {!bspMode&&<ShadingPie/>}
    {dialog==='visibility'&&<VisibilityManager onClose={()=>setDialog(null)}/>}
    {dialog==='output'&&<BuildOutputModal onClose={()=>setDialog(null)} onCancel={cancelCompile} onDoctor={()=>setDialog('doctor')}/>}
    {dialog==='settings'&&<SettingsModal onClose={()=>setDialog(null)}/>}
    {dialog==='controls'&&<ControlsModal onClose={()=>setDialog(null)}/>}
    {dialog==='about'&&<AboutModal onClose={closeHelp}/>}
    {dialog==='layout'&&<LayoutModal onClose={()=>setDialog(null)}/>}
    {dialog==='entityAppearance'&&<EntityAppearanceModal onClose={()=>setDialog(null)}/>}
    {dialog==='gameplay'&&<GameplayStudio onClose={()=>setDialog(null)}/>}
    {dialog==='cinematic'&&<CinematicCameraStudio onClose={()=>setDialog(null)}/>}
    {dialog==='npc'&&<NPCStudio onClose={()=>setDialog(null)}/>}
    {dialog==='sound'&&<SoundStudio onClose={()=>setDialog(null)}/>}
    {dialog==='lighting'&&<LightingStudio onClose={()=>setDialog(null)} onPreview={()=>void compile('preview')}/>}
    {dialog==='doctor'&&<MapDoctor onClose={()=>setDialog(null)}/>}
    {dialog==='packager'&&<MapPackagerStudio onClose={()=>setDialog(null)}/>}
    {dialog==='terrain'&&<TerrainShapeStudio onClose={()=>setDialog(null)}/>}
    {dialog==='buildTogether'&&<BuildTogetherPanel onClose={()=>setDialog(null)}/>} 
  </div>;
}
