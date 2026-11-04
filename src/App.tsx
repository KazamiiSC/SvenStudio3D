import {useEffect,useRef,useState} from 'react';
import type React from 'react';
import {Hammer,Box,Move3D,Rotate3D,Scaling,Magnet,Grid3x3,Paintbrush,Eye,Undo2,Redo2,Save,FolderOpen,FilePlus2,PackagePlus,Play,StopCircle,Settings2,ChevronDown,Layers,MonitorCog,FileDown,FileUp,Info,CheckCircle2,AlertTriangle,Terminal,SunMoon,Copy,Trash2,Keyboard,Globe2,Menu,FileCode2,LayoutTemplate,Palette,GitBranch,Skull,Headphones,Ruler} from 'lucide-react';
import {useEditor} from './store';
import {DockWorkspace,LayoutModal} from './components/DockWorkspace';
import {useStudioLayout} from './layout';
import {Viewport} from './components/Viewport';
import {EntityAppearanceModal} from './components/EntityAppearanceModal';
import {GameplayStudio} from './components/GameplayStudio';
import {TopDropdown} from './components/TopDropdown';
import {analyzeGameplay} from './engine/gameplay';
import {validateNpcLogic} from './engine/npc';
import {NPCStudio} from './components/NpcStudio';
import {SoundStudio} from './components/SoundStudio';
import {LightingStudio} from './components/LightingStudio';
import {MapDoctor} from './components/MapDoctor';
import {analyzeMap} from './engine/mapDiagnostics';
import {validateEnvironment} from './engine/environment';
import {validateAudio} from './engine/sound';
import type {PlaceableShape} from './engine/types';
import {ErrorBoundary} from './components/ErrorBoundary';
import {exportMap,validateProject} from './engine/exportMap';
import {importMap} from './engine/importMap';
import {parseWad} from './engine/wad';
import {downloadText,readProject,saveProject} from './engine/paths';
import type {ToolMode} from './store';
import {CONTROL_ACTIONS,displayBinding,keyEventBinding,shortcutAction} from './engine/controls';
import type {ShortcutAction} from './engine/controls';
import {useT,LANGUAGES} from './i18n';
import {lastRecoveredAt} from './engine/sessionManager';
import {readRecoveryBackup} from './engine/sessionRecovery';
import './style.css';
function ToolButton({active=false,title,children,onClick,disabled=false}:{active?:boolean,title:string,children:React.ReactNode,onClick:()=>void,disabled?:boolean}){
  return <button title={title} className={`tool-button ${active?'active':''}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
function MenuButton({children,onClick}:{children:React.ReactNode,onClick:()=>void}){return <button className="menu-action" onClick={onClick}>{children}</button>}
async function streamCompile(payload:object,callback:(event:{type:string;message:string;output?:string})=>void){
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
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-title"><Settings2 size={20}/><span>{t('Build configuration')}</span><button onClick={onClose}>×</button></div>
    <p className="modal-subtext">{t('Point to your installed Sven Co-op SDK compiler folder and Sven Co-op game directory. Paths must be on the PC running the editor.')}</p>
    <label>{t('Map name')}<input value={settings.mapName} onChange={e=>setSettings({mapName:e.target.value})} placeholder="my_sven_map"/><small>{t('Letters, numbers, underscores and hyphens only.')}</small></label>
    <label>{t('Compiler folder')}<input value={settings.compilerDir} onChange={e=>setSettings({compilerDir:e.target.value})} placeholder="C:\Program Files (x86)\Steam\steamapps\common\Sven Co-op SDK\mapping\compilers"/></label>
    <label>{t('Sven Co-op game data folder')}<input value={settings.gameDir} onChange={e=>setSettings({gameDir:e.target.value})} placeholder="C:\Program Files (x86)\Steam\steamapps\common\Sven Co-op\svencoop"/></label>
    <label>{t('WAD full paths (one per line)')}<textarea rows={4} value={settings.wadPaths} onChange={e=>setSettings({wadPaths:e.target.value})} placeholder={'C:\\Steam\\steamapps\\common\\Sven Co-op\\svencoop\\halflife.wad'}/><small>{t('These file paths are written to the worldspawn wad key for the compilers. Import a matching .WAD in the Texture Browser for previews.')}</small></label>
    <div className="modal-footer"><button className="primary-action" onClick={onClose}><CheckCircle2 size={16}/> {t('Save settings')}</button></div>
  </div></div>;
}
function ControlsModal({onClose}:{onClose:()=>void}){
  const t=useT();
  const controls=useEditor(s=>s.controls),setControls=useEditor(s=>s.setControls);
  const setShortcut=useEditor(s=>s.setShortcut),resetControls=useEditor(s=>s.resetControls);
  const [capture,setCapture]=useState<ShortcutAction|null>(null);
  const [notice,setNotice]=useState('');
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.code==='Escape'&&capture===null){e.stopPropagation();onClose()}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[capture,onClose]);
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card controls-card" onMouseDown={e=>e.stopPropagation()}>
    <div className="modal-title"><Keyboard size={20}/><span>{t('Camera & Gizmo Controls')}</span><button onClick={onClose}>×</button></div>
    <div className="controls-scroll">
      <h4>{t('Camera navigation')}</h4>
      <label>{t('Navigation preset')}<select value={controls.cameraPreset} onChange={e=>setControls({cameraPreset:e.target.value as 'blender'|'classic'})}>
        <option value="blender">{t('Blender — MMB orbit · Shift+MMB pan · Ctrl+MMB zoom')}</option>
        <option value="classic">{t('Classic — RMB orbit · MMB zoom · LMB pan')}</option>
      </select></label>
      <p className="modal-subtext">{t('Wheel: zoom. Blender preset uses WASD only in Fly/Walk mode; Classic keeps WASD always available. Esc exits Fly or the active transform tool.')}</p><p className="modal-subtext">{t('G/R/C follow the mouse: repeat the same shortcut or click to confirm; Esc or right click cancels. Use X/Y/Z for global axis constraints and number keys for precise values.')}</p>
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
      <h4>{t('Gizmo / Transform')}</h4>
      <div className="controls-sliders">
        <label>{t('Gizmo orientation')}<select value={controls.gizmoSpace} onChange={e=>setControls({gizmoSpace:e.target.value as 'local'|'world'})}><option value="world">{t('Global / World')}</option><option value="local">{t('Local / Object')}</option></select></label>
        {([['rotationSnapDegrees','Rotation snap (0 = off)',0,90,5],['scaleSnapStep','Scale snap (0 = off)',0,1,.05],['gizmoSize','Gizmo size',.5,2,.1]] as const).map(([id,label,min,max,step])=><label key={id}>{t(label)}<div className="controls-range"><input type="range" min={min} max={max} step={step} value={controls[id]} onChange={e=>setControls({[id]:Number(e.target.value)})}/><output>{controls[id]}</output></div></label>)}
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
  const sections:[string,string][]=[
    ['Quick start','Help quick start'],
    ['Camera and views','Help camera'],
    ['Building geometry','Help geometry'],
    ['Advanced modeling','Help advanced'],
    ['Texture browser','Help textures'],
    ['Entity browser and FGD','Help entities'],
    ['Groups, layers and prefabs','Help organization'],
    ['Lighting and sky','Help lighting'],
    ['Saving and compiling','Help compiling'],
    ['Automatic recovery','Help recovery'],
    ['Map Doctor and errors','Help diagnosis'],
    ['Large map performance','Help performance'],
    ['Useful shortcuts','Help shortcuts'],
  ];
  return <div className="modal-backdrop" onMouseDown={onClose}><div className="modal-card about-card help-dialog" onMouseDown={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label={t('Help')}>
    <div className="modal-title"><Info size={20}/><span>{t('Sven Studio guide')} · v0.8.4</span><button title={t('Close')} onClick={onClose}>×</button></div>
    <div className="help-scroll" tabIndex={0}>
      <div className="help-credits" role="group" aria-label={t('Project credits')}>
        <div className="help-credits-logos">
          <div className="help-astra-logo" aria-label="GPT-6 Astra"><span className="astra-symbol" aria-hidden="true">✦</span><div><b>GPT-6</b><strong>ASTRA</strong></div></div>
          <img className="help-kz-logo" src="/kz-sheez-logo.png" alt="KZ-Sheez"/>
        </div>
        <p>{t('This project was made with the help of ChatGPT.')}</p>
      </div>
      <p className="help-intro">{t('Svengine-only editor for Sven Co-op 5.x.')} {t('Help introduction')}</p>
      <nav className="help-index">{sections.map(([name])=><a key={name} href={`#help-${name.replaceAll(' ','-')}`}>{t(name)}</a>)}</nav>
      {sections.map(([title,body],index)=><section key={title} className="help-section" id={`help-${title.replaceAll(' ','-')}`}>
        <h4><span>{index+1}.</span> {t(title)}</h4><p>{t(body)}</p>
      </section>)}
      <p className="help-intro">{t('Compiler logs remain in their original language. No proprietary Sven Co-op assets or SDK executables are distributed.')}</p>
    </div>
    <div className="modal-footer"><button className="primary-action" onClick={onClose}>{t('Close')}</button></div>
  </div></div>;
}
function ConsolePanel(){
  const t=useT();
  const logs=useEditor(s=>s.logs),clear=useEditor(s=>s.clearLogs),busy=useEditor(s=>s.compileBusy);
  const [collapsed,setCollapsed]=useState(false);
  const scrollRef=useRef<HTMLDivElement>(null);
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight})},[logs,collapsed]);
  return <section className={`console-panel ${collapsed?'collapsed':''}`}>
    <div className="console-header"><div><Terminal size={15}/> {t('Output')} <span className="console-count">{logs.length}</span>{busy&&<span className="building"><span className="pulse-dot"/> {t('Building...')}</span>}</div><div><button onClick={clear}>{t('Clear')}</button><button onClick={()=>setCollapsed(v=>!v)}>{t(collapsed?'Show':'Hide')} <ChevronDown size={13} className={collapsed?'up':''}/></button></div></div>
    {!collapsed&&<div className="console-logs" ref={scrollRef}>{logs.map((line,i)=><div key={i} className={`${/error|failed|invalid|leak/i.test(line)?'error-log':/success|finished|complete|imported/i.test(line)?'good-log':''}`}><span className="log-index">{String(i+1).padStart(3,'0')}</span>{line}</div>)}</div>}
  </section>;
}
export default function App(){
  const t=useT();
  const uiScale=useStudioLayout(s=>s.uiScale),accent=useStudioLayout(s=>s.accent),fontScale=useStudioLayout(s=>s.fontScale);
  const locale=useEditor(s=>s.locale),setLocale=useEditor(s=>s.setLocale);
  const geometryMode=useEditor(s=>s.geometryMode),setGeometryMode=useEditor(s=>s.setGeometryMode);
  const measureMode=useEditor(s=>s.measureMode),toggleMeasure=useEditor(s=>s.toggleMeasure);
  const mode=useEditor(s=>s.mode),setMode=useEditor(s=>s.setMode);
  const snapping=useEditor(s=>s.snapping),toggleSnap=useEditor(s=>s.toggleSnap),snap=useEditor(s=>s.snap),setSnap=useEditor(s=>s.setSnap);
  const faceMode=useEditor(s=>s.faceMode),setFlag=useEditor(s=>s.setFlag),showGrid=useEditor(s=>s.showGrid),wireframe=useEditor(s=>s.wireframe);
  const drawMode=useEditor(s=>s.drawMode),setDrawMode=useEditor(s=>s.setDrawMode),drawHeight=useEditor(s=>s.drawHeight),setDrawHeight=useEditor(s=>s.setDrawHeight);
  const selected=useEditor(s=>s.selected),history=useEditor(s=>s.history),future=useEditor(s=>s.future);
  const project=useEditor(s=>s.project),newProject=useEditor(s=>s.newProject),loadProject=useEditor(s=>s.loadProject),setName=useEditor(s=>s.setName);
  const [recoveryStatus,setRecoveryStatus]=useState<'waiting'|'saved'|'error'>('waiting');
  useEffect(()=>{const listener=(event:Event)=>setRecoveryStatus((event as CustomEvent<{status:'saved'|'error'}>).detail.status);window.addEventListener('svenstudio-recovery-status',listener);return()=>window.removeEventListener('svenstudio-recovery-status',listener)},[]);
  const undo=useEditor(s=>s.undo),redo=useEditor(s=>s.redo),duplicate=useEditor(s=>s.duplicateSelected),remove=useEditor(s=>s.removeSelected);
  const appendLogs=useEditor(s=>s.appendLogs),compileBusy=useEditor(s=>s.compileBusy),setCompileBusy=useEditor(s=>s.setCompileBusy);
  const settings=useEditor(s=>s.settings);
  const controls=useEditor(s=>s.controls),flyMode=useEditor(s=>s.flyMode);
  const toggleFly=useEditor(s=>s.toggleFly),setFly=useEditor(s=>s.setFly),issueCameraCommand=useEditor(s=>s.issueCameraCommand);
  const toggleModal=useEditor(s=>s.toggleModalTransform),finishModal=useEditor(s=>s.finishModalTransform);
  const showEntityNames=useEditor(s=>s.showEntityNames);
  const placementShape=useEditor(s=>s.placementShape);
  const [dialog,setDialog]=useState<'settings'|'controls'|'about'|'layout'|'entityAppearance'|'gameplay'|'npc'|'sound'|'lighting'|'doctor'|null>(null),[fileMenu,setFileMenu]=useState(false),[studiosMenu,setStudiosMenu]=useState(false);
  const projectInput=useRef<HTMLInputElement>(null),mapInput=useRef<HTMLInputElement>(null);
  const fileButton=useRef<HTMLButtonElement>(null),studiosButton=useRef<HTMLButtonElement>(null);
  const imported=async(e:React.ChangeEvent<HTMLInputElement>,type:'map'|'project')=>{
    const file=e.target.files?.[0];if(!file)return;
    try{const p=type==='map'?importMap(await file.text(),file.name):await readProject(file);loadProject(p);appendLogs([`Opened ${file.name}: ${p.objects.length} objects`]);}
    catch(err){appendLogs([`Import error: ${String(err)}`]);alert(`Import failed: ${String(err)}`)}
    e.target.value='';setFileMenu(false);
  };
  const wadPaths=settings.wadPaths.split(/[\r\n]+/).map(v=>v.trim()).filter(Boolean);
  const saveMap=()=>{
    try{const text=exportMap(project,wadPaths);downloadText(text,`${settings.mapName||'untitled'}.map`);appendLogs([`Exported ${text.length} bytes of Svengine Valve 220 .map source.`]);}
    catch(err){appendLogs([`Export error: ${String(err)}`]);alert(String(err))}
  };
  const compile=async()=>{
    if(compileBusy)return;
    const gameplayIssues=[...analyzeGameplay(project.objects),...validateNpcLogic(project.objects),...validateAudio(project.objects),...validateEnvironment(project.objects)];
    const gameplayErrors=gameplayIssues.filter(x=>x.severity==='error').map(x=>x.message);
    const gameplayWarnings=gameplayIssues.filter(x=>x.severity==='warning').map(x=>x.message);
    if(gameplayWarnings.length)appendLogs(gameplayWarnings.map(x=>`Gameplay warning: ${x}`));
    const state=useEditor.getState();
    const diagnostic=analyzeMap(project,state.textureAssets,state.fgdClasses,state.fgdLoaded);
    const preflight=diagnostic.issues.filter(x=>x.severity==='warning');
    if(preflight.length)appendLogs([`Map Doctor: ${preflight.length} advisory warnings (see Studios → Map Doctor).`,...preflight.slice(0,10).map(x=>`Map Doctor [${x.code}]: ${x.message}`)]);
    const issues=[...validateProject(project),...gameplayErrors];
    if(issues.length){issues.forEach(x=>appendLogs([`Invalid geometry: ${x}`]));alert(`Compilation blocked: fix these issues first:\n\n${issues.join('\n')}`);return;}
    if(!settings.compilerDir||!settings.gameDir){setDialog('settings');appendLogs(['Set your SDK compiler folder and game directory before compiling.']);return;}
    if(!/^[a-z][a-z0-9_-]*$/i.test(settings.mapName)){setDialog('settings');alert('Invalid map name: use letters, numbers, _ or -.');return;}
    setCompileBusy(true);appendLogs([`Starting build ${settings.mapName}...`]);
    let error=false;
    try{
      const mapData=exportMap(project,wadPaths);
      await streamCompile({mapName:settings.mapName,mapData,compilerDir:settings.compilerDir,gameDir:settings.gameDir,wadPaths},ev=>{
        appendLogs([ev.message]);if(ev.type==='error')error=true;
      });
      if(!error)appendLogs(['Build process completed.']);
    }catch(err){appendLogs([`Build error: ${String(err)}`])}
    finally{setCompileBusy(false)}
  };
  const cancelCompile=async()=>{try{await fetch('/api/cancel',{method:'POST'});appendLogs(['Cancellation requested...'])}catch(err){appendLogs([String(err)])}};
  useEffect(()=>{
    const handle=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement;if(target?.closest('input, textarea, select, [contenteditable]'))return;
      // A full-screen Gameplay Studio graph owns keyboard input while open.
      if(document.querySelector('.gs-backdrop, .npc-backdrop'))return;
      if(useEditor.getState().modalTransform){
        if(e.key==='Escape'){e.preventDefault();finishModal(false);return;}
        if(e.repeat)return;
        const modalAction=shortcutAction(useEditor.getState().controls,keyEventBinding(e));
        if(modalAction==='move'||modalAction==='rotate'||modalAction==='scale'){e.preventDefault();finishModal(true);return;}
        // Modal viewport handles X/Y/Z, number entry, Enter and mouse input.
        return;
      }
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();return}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();return}
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();saveProject(useEditor.getState().project);return}
      if(document.querySelector('.modal-backdrop'))return;
      if(e.code==='KeyE'&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&useEditor.getState().geometryMode==='face'&&useEditor.getState().selectedFace!==null){
        e.preventDefault();
        try{useEditor.getState().extrudeSelected(16)}catch(error){useEditor.getState().appendLogs([`Extrusion: ${String(error)}`])}
        return;
      }
      if(e.key==='Delete'&&e.code!=='NumpadDecimal'){e.preventDefault();remove();return}
      if(e.key==='Escape'){
        e.preventDefault();
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
      if(action==='move')toggleModal('translate');
      else if(action==='rotate')toggleModal('rotate');
      else if(action==='scale')toggleModal('scale');
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
  },[undo,redo,duplicate,remove,setMode,setDrawMode,toggleFly,setFly,issueCameraCommand,toggleModal,finishModal]);
  useEffect(()=>{
    let cancelled=false;
    fetch('/svstudio.wad').then(r=>{if(!r.ok)throw new Error('Built-in WAD unavailable');return r.blob()})
      .then(blob=>parseWad(new File([blob],'svstudio.wad')))
      .then(assets=>{if(!cancelled)useEditor.getState().setTextures(assets,'svstudio.wad')})
      .catch(err=>useEditor.getState().appendLogs([`Built-in texture pack: ${String(err)}`]));
    return()=>{cancelled=true};
  },[]);
  useEffect(()=>{const handler=(event:Event)=>{const id=(event as CustomEvent<string>).detail;if(id==='npc'||id==='sound'||id==='gameplay'||id==='lighting'||id==='doctor'){setDialog(id);setFileMenu(false);setStudiosMenu(false)}};document.addEventListener('svenstudio:open-studio',handler);return()=>document.removeEventListener('svenstudio:open-studio',handler)},[]);
  useEffect(()=>{if(dialog){setFileMenu(false);setStudiosMenu(false)}},[dialog]);
  const primitive=(type:PlaceableShape)=>useEditor.getState().setPlacementShape(placementShape===type?null:type);
  // Scale the interface chrome while compensating the root dimensions. The
  // WebGL viewport applies inverse zoom separately to keep R3F pixel sizing correct.
  return <div className={`app-shell accent-${accent}`} style={{zoom:uiScale,width:`${100/uiScale}vw`,height:`${100/uiScale}vh`,minHeight:0,'--ui-font-scale':fontScale} as React.CSSProperties}>
    <header className="titlebar">
      <div className="brand"><span className="brand-logo"><Box size={20} strokeWidth={2.3}/></span><span>SVEN<span className="brand-light">STUDIO</span></span><span className="brand-tag">3D</span><span className="version-label">v0.8.4</span></div>
      <div className="top-divider"/>
      <div className="menu-parent"><button ref={fileButton} type="button" aria-expanded={fileMenu} aria-controls="sven-file-menu" aria-haspopup="menu" className={`top-nav ${fileMenu?'chosen':''}`} onClick={()=>{setStudiosMenu(false);setFileMenu(v=>!v)}}>{t('File')} <ChevronDown size={12}/></button>
        <TopDropdown anchor={fileButton} open={fileMenu} onClose={()=>setFileMenu(false)} id="sven-file-menu" className="file-menu" align="left" width={240}><MenuButton onClick={()=>{if(confirm(t('Start a new project? Save existing work first.')))newProject();setFileMenu(false)}}><FilePlus2 size={15}/> {t('New project')}</MenuButton>
          <MenuButton onClick={()=>projectInput.current?.click()}><FolderOpen size={15}/> {t('Open project')}</MenuButton>
          <MenuButton onClick={()=>mapInput.current?.click()}><FileUp size={15}/> {t('Import .MAP')}</MenuButton>
          <div className="menu-separator"/>
          <MenuButton onClick={()=>{saveProject(project);setFileMenu(false)}}><Save size={15}/> {t('Save project')} <span className="shortcut">Ctrl+S</span></MenuButton>
          <MenuButton onClick={async()=>{setFileMenu(false);const backup=await readRecoveryBackup();if(!backup){window.alert(t('No earlier recovery snapshot is available.'));return;}if(window.confirm(t('Restore the previous locally saved project? Your current work will be replaced.'))){loadProject(backup.project);appendLogs([`Recovered previous snapshot from ${new Date(backup.savedAt).toLocaleString()}`]);}}}><FolderOpen size={15}/> {t('Restore previous autosave')}</MenuButton>
          <MenuButton onClick={()=>{saveMap();setFileMenu(false)}}><FileDown size={15}/> {t('Export Svengine .MAP')}</MenuButton>
        </TopDropdown>
      </div>
      <button className="top-nav" onClick={()=>setDialog('about')}>{t('Help')}</button>
      <div className="project-title"><span className="project-status"/><input title={t('Project display name')} value={project.name} onChange={e=>setName(e.target.value)}/><span className="version-label" title={recoveryStatus==='error'?t('Autosave failed; export a project backup.'):t('Autosave is stored in this browser. Export a project file for a portable backup.')}>{recoveryStatus==='error'?t('Autosave error'):recoveryStatus==='saved'?t('Autosaved'):lastRecoveredAt()?t('Session recovered'):t('Workspace')}</span></div>
      <div className="titlebar-right"><div className="studio-menu-parent"><button ref={studiosButton} type="button" aria-expanded={studiosMenu} aria-controls="sven-studios-menu" aria-haspopup="menu" className="studio-menu-button" onClick={()=>{setFileMenu(false);setStudiosMenu(v=>!v)}}><Layers size={16}/>{t('Studios')}<ChevronDown size={12}/></button><TopDropdown anchor={studiosButton} open={studiosMenu} onClose={()=>setStudiosMenu(false)} id="sven-studios-menu" className="studio-menu-dropdown" align="right" width={242}><button role="menuitem" onClick={()=>{setDialog('gameplay');setStudiosMenu(false)}}><GitBranch size={16}/>{t('Gameplay Studio')}</button><button role="menuitem" onClick={()=>{setDialog('npc');setStudiosMenu(false)}}><Skull size={16}/>{t('NPC & AI Studio')}</button><button role="menuitem" onClick={()=>{setDialog('sound');setStudiosMenu(false)}}><Headphones size={16}/>{t('Audio Studio')}</button><button role="menuitem" onClick={()=>{setDialog('lighting');setStudiosMenu(false)}}><SunMoon size={16}/>{t('Lighting & Environment Studio')}</button><button role="menuitem" onClick={()=>{setDialog('doctor');setStudiosMenu(false)}}><CheckCircle2 size={16}/>{t('Map Doctor')}</button></TopDropdown></div><label className="language-picker" title={t('Interface language')}><Globe2 size={15}/><select aria-label={t('Interface language')} value={locale} onChange={e=>setLocale(e.target.value as typeof locale)}>{LANGUAGES.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label><button title={t('Workspace layout')} onClick={()=>setDialog('layout')}><LayoutTemplate size={17}/><span className="layout-nav-name">{t('Layout')}</span></button><button title={t('Entity visuals')} onClick={()=>setDialog('entityAppearance')}><Palette size={17}/></button><button title={t('Camera & Gizmo Controls')} onClick={()=>setDialog('controls')}><Keyboard size={17}/></button><button title={t('Build configuration')} onClick={()=>setDialog('settings')}><Settings2 size={17}/></button><button className="top-save" onClick={()=>saveProject(project)}><Save size={15}/> {t('Save')}</button>{compileBusy?<button className="top-stop" onClick={cancelCompile}><StopCircle size={14}/> {t('Stop Build')}</button>:<button className="top-compile" onClick={compile}><Play size={14} fill="currentColor"/> {t('Compile Map')}</button>}</div>
      <input ref={projectInput} type="file" accept=".json,.svenstudio.json" hidden onChange={e=>imported(e,'project')}/>
      <input ref={mapInput} type="file" accept=".map" hidden onChange={e=>imported(e,'map')}/>
    </header>
    <DockWorkspace toolbar={<div className="ribbon">
      <div className="ribbon-group"><div className="ribbon-tools"><ToolButton title={`${t('Move')} [${displayBinding(controls.shortcuts.move)}]`} active={mode==='translate'} onClick={()=>setMode('translate')}><Move3D size={20}/><small>{t('Move')}</small></ToolButton><ToolButton title={`${t('Rotate')} [${displayBinding(controls.shortcuts.rotate)}]`} active={mode==='rotate'} onClick={()=>setMode('rotate')}><Rotate3D size={20}/><small>{t('Rotate')}</small></ToolButton><ToolButton title={`${t('Scale')} [${displayBinding(controls.shortcuts.scale)}]`} active={mode==='scale'} onClick={()=>setMode('scale')}><Scaling size={20}/><small>{t('Scale')}</small></ToolButton></div><small className="ribbon-caption">{t('TRANSFORM')} · {t(mode==='select'?'SELECT':mode.toUpperCase())}</small></div>
      <div className="ribbon-group"><div className="ribbon-tools">
        <ToolButton title={t('Draw')} active={drawMode} onClick={()=>setDrawMode(!drawMode)}><Box size={20}/><small>{t('Draw')}</small></ToolButton>
        {(['box','wedge','cylinder','arch','vault','cone','pyramid','icosphere','stairs','pipe'] as PlaceableShape[]).map(type=><ToolButton key={type} active={placementShape===type} title={`${t(type[0].toUpperCase()+type.slice(1))} — ${t('Click a surface to place')}`} onClick={()=>primitive(type)}><span className="large-glyph">{({box:'▣',wedge:'◭',cylinder:'⬡',arch:'⌒',vault:'◠',cone:'▲',pyramid:'◆',icosphere:'◉',stairs:'▥',pipe:'◎'} as Record<PlaceableShape,string>)[type]}</span><small>{t(type[0].toUpperCase()+type.slice(1))}</small></ToolButton>)}
      </div><small className="ribbon-caption">{t('CREATE')} · {t(placementShape?'Click a surface to place':drawMode?'DRAW ACTIVE':'PRIMITIVES')}</small></div>
      <div className="ribbon-group"><div className="ribbon-tools"><ToolButton title={t('Toggle wireframe')} active={wireframe} onClick={()=>setFlag('wireframe',!wireframe)}><Eye size={20}/><small>{t('Wire')}</small></ToolButton><ToolButton title={t('Grid visibility')} active={showGrid} onClick={()=>setFlag('showGrid',!showGrid)}><Grid3x3 size={20}/><small>{t('Grid')}</small></ToolButton><ToolButton title={t('Show entity names')} active={showEntityNames} onClick={()=>setFlag('showEntityNames',!showEntityNames)}><FileCode2 size={20}/><small>{t('Labels')}</small></ToolButton></div><small className="ribbon-caption">{t('VIEW')}</small></div>
      <div className="ribbon-group"><div className="ribbon-tools">
        {(['object','vertex','edge','face'] as const).map(value=><ToolButton key={value} active={geometryMode===value} title={t(value==='object'?'Object':value==='vertex'?'Edit vertices':value==='edge'?'Edit edges':'Face selection mode')} onClick={()=>setGeometryMode(value)}>
          {value==='vertex'?<span className="large-glyph">•</span>:value==='edge'?<span className="large-glyph">╱</span>:value==='face'?<Paintbrush size={19}/>:<Box size={19}/>}<small>{t(value==='object'?'Object':value==='vertex'?'Vertex':value==='edge'?'Edge':'Face')}</small>
        </ToolButton>)}
      </div><small className="ribbon-caption">SVENGINE · {t('Geometry editing').toUpperCase()}</small></div>
      <div className="ribbon-group"><div className="ribbon-tools"><ToolButton active={measureMode} title="Measure distance: click two surfaces (Esc to exit)" onClick={toggleMeasure}><Ruler size={20}/><small>Measure</small></ToolButton></div><small className="ribbon-caption">TOOLS</small></div>
      <div className="ribbon-group"><div className="ribbon-tools"><ToolButton title={t('Snap to grid')} active={snapping} onClick={toggleSnap}><Magnet size={20}/><small>{t('Snap')}</small></ToolButton><select className="snap-select" title={t('Grid size')} value={snap} onChange={e=>setSnap(Number(e.target.value))}>{[1,2,4,8,16,32,64,128].map(v=><option key={v} value={v}>{v}u</option>)}</select>{drawMode&&<label className="draw-height">{t('Height')} <input type="number" min="1" max="131072" step={snap} value={drawHeight} onChange={e=>{if(Number.isFinite(e.target.valueAsNumber))setDrawHeight(e.target.valueAsNumber)}} title={t('Height of new blocks in Svengine units')}/></label>}</div><small className="ribbon-caption">{t('Grid').toUpperCase()}</small></div>
      <div className="ribbon-group last"><div className="ribbon-tools"><ToolButton title={t('Undo')} disabled={!history.length} onClick={undo}><Undo2 size={20}/><small>{t('Undo')}</small></ToolButton><ToolButton title={t('Redo')} disabled={!future.length} onClick={redo}><Redo2 size={20}/><small>{t('Redo')}</small></ToolButton><ToolButton title={t('Clone')} disabled={!selected} onClick={duplicate}><Copy size={19}/><small>{t('Clone')}</small></ToolButton><ToolButton title={t('Delete')} disabled={!selected} onClick={remove}><Trash2 size={19}/><small>{t('Delete')}</small></ToolButton></div><small className="ribbon-caption">{t('EDIT')}</small></div>
    </div>} viewport={<div className="viewport-column"><ErrorBoundary label="viewport 3D" compact><Viewport/></ErrorBoundary></div>} consolePanel={<ConsolePanel/>}/>
    <footer className="statusbar"><div><span className="status-ok"/>{t('Ready')} <span className="status-divider"/> Svengine · Valve 220 <span className="status-divider"/> {project.objects.filter(o=>o.kind==='brush').length} {t('brushes')} <span className="status-divider"/> {project.objects.filter(o=>o.kind==='entity').length} {t('entities')}</div><div><Keyboard size={13}/> {displayBinding(controls.shortcuts.move)} {t('Move')} · {displayBinding(controls.shortcuts.rotate)} {t('Rotate')} · {displayBinding(controls.shortcuts.scale)} {t('Scale')} · {flyMode?t('Fly ON'):controls.cameraPreset==='blender'?t('MMB orbit'):t('RMB orbit')} <span className="status-divider"/> Sven Studio 3D v0.8.4</div></footer>
    {dialog==='settings'&&<SettingsModal onClose={()=>setDialog(null)}/>}
    {dialog==='controls'&&<ControlsModal onClose={()=>setDialog(null)}/>}
    {dialog==='about'&&<AboutModal onClose={()=>setDialog(null)}/>}
    {dialog==='layout'&&<LayoutModal onClose={()=>setDialog(null)}/>}
    {dialog==='entityAppearance'&&<EntityAppearanceModal onClose={()=>setDialog(null)}/>}
    {dialog==='gameplay'&&<GameplayStudio onClose={()=>setDialog(null)}/>}
    {dialog==='npc'&&<NPCStudio onClose={()=>setDialog(null)}/>}
    {dialog==='sound'&&<SoundStudio onClose={()=>setDialog(null)}/>}
    {dialog==='lighting'&&<LightingStudio onClose={()=>setDialog(null)}/>}
    {dialog==='doctor'&&<MapDoctor onClose={()=>setDialog(null)}/>}
  </div>;
}
