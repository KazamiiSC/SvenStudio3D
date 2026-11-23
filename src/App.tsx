import {StudioOverlayRoot} from './components/StudioOverlayRoot';
import {useEffect,useLayoutEffect,useRef,useState,lazy,Suspense} from 'react';
import type React from 'react';
import {Box,Move3D,Rotate3D,Scaling,Magnet,Grid3x3,Paintbrush,Eye,Undo2,Redo2,Save,FolderOpen,FilePlus2,PackagePlus,Play,StopCircle,Settings2,ChevronDown,Layers,Boxes,Mountain,FileDown,FileUp,Info,Clapperboard,CheckCircle2,SunMoon,ShieldCheck,Copy,Trash2,Keyboard,Globe2,Menu,FileCode2,Palette,GitBranch,Skull,Headphones,Ruler,Users,ScanEye,Ghost,History,EyeOff,Flag,PenTool,Waypoints,ListTree,SquarePlus} from 'lucide-react';
import {useEditor} from './store';
import {ensureSvenCoopFgd} from './engine/svenFgdLoader';
import {inspectCS16Project} from './engine/gameProfiles';
import {useArchitectureMode} from './architectureModeState';
import {DockWorkspace} from './components/DockWorkspace';
import {PreferencesStudio,type PreferencesSection} from './components/PreferencesStudio';
import {SlidersHorizontal} from 'lucide-react';
import {useStudioLayout,TOOLBAR_GROUPS,TOOLBAR_GROUP_LABELS,type ToolbarGroup} from './layout';
import {useHudLayout} from './hudLayout';
import {Viewport} from './components/Viewport';
import {WelcomeScreen} from './components/WelcomeScreen';
import type {HomeAction} from './engine/homeV23';

import {resolveShellScale} from './engine/shellScale';
import {useCssElementSize} from './engine/useCssElementSize';
import {headerDensity} from './engine/adaptiveUiGeometry';
import {useFittingHeaderDensity} from './components/useFittingHeaderDensity';

import {lightingCompilerKey,lightingCompilerLabel} from './engine/trueLightingCompiler';
import {ShadingPie} from './components/ShadingPie';
import {parseBsp} from './engine/bsp';
import type {BspMap} from './engine/bsp';
import type {TextureAsset} from './engine/types';
import {TopDropdown} from './components/TopDropdown';
import {analyzeGameplay} from './engine/gameplay';
import {validateNpcLogic} from './engine/npc';
import {SoundStudio} from './components/SoundStudio';
import {MapDoctor} from './components/MapDoctor';
import {CS16CompatibilityStudio} from './components/CS16CompatibilityStudio';
import {CS16FeatureNotice} from './components/CS16FeatureNotice';
import './uiPreview2.css';
import {browserWadsForSmartBuild} from './engine/smartBuildBrowserWads';
import type {StudioPrefab} from './engine/prefabStudioFolder';
import {StudioResetDialog} from './components/StudioResetDialog';

import {useBuildTogether,setBuildTogetherDialog} from './engine/buildTogetherClient';
import {useMapDoctorState} from './mapDoctorState';
import {analyzeMap} from './engine/mapDiagnostics';
import {validateEnvironment} from './engine/environment';
import {validateAudio} from './engine/sound';
import type {PlaceableShape} from './engine/types';
import {ErrorBoundary} from './components/ErrorBoundary';
import {exportMap,validateProject} from './engine/exportMap';
import {EntityReport} from './components/EntityReport';
import {TextureReplaceDialog} from './components/TextureReplaceDialog';
import {OrthoViews} from './components/OrthoViews';
import {ModelingRibbonGroup,TexturesRibbonGroup} from './app/RibbonToolGroups';
import {MapToolsHost} from './components/MapToolsDialogs';
import {DesktopWindowControls} from './components/DesktopWindowControls';
import {FirstRunTour} from './components/FirstRunTour';
import {validRegion,regionMapName,buildRegionProject,regionSealTexture} from './engine/compileRegion';
import {inspectMapImport} from './engine/importMap';
import {validateBspObjectPrefab} from './engine/bspObjectExtractor';
import {decodePrefabTextures,downloadPrefabWad} from './engine/prefabWadDependencies';
import {placePrefab} from './engine/prefabs';
import {parseStudioPrefab} from './engine/prefabStudioFolder';
import {inspectRmfImport} from './engine/importRmf';
import {lightTestMapName} from './engine/lightTest';
import {parseWad} from './engine/wad';
import {textureCompileWarnings} from './engine/textureCompileDiagnostics';
import {loadSavedWadFiles,rememberWadFile,wasWadRemovedInSession} from './engine/wadPersistence';
import {downloadText,readProject,saveProject} from './engine/paths';

import {displayBinding,keyEventBinding,shortcutAction,shouldGuardNavigationKey} from './engine/controls';
import {readPreviewSettings,normalizeWalkPreview} from './engine/previewEnhancements';
import {requestSafeWalkFullscreen,releaseSafeWalkFullscreen} from './engine/walkKeyboardLock';

import {useT,LANGUAGES,translate} from './i18n';
import {useSaveState} from './engine/saveState';
import {buildCsOverview} from './engine/csOverview';
/** Chunked base64 (String.fromCharCode on a whole MB-sized array overflows the call stack). */
function bytesToBase64(bytes:Uint8Array):string{let out='';for(let i=0;i<bytes.length;i+=0x8000)out+=String.fromCharCode(...bytes.subarray(i,i+0x8000));return btoa(out);}

import {lastRecoveredAt,checkpointBeforeImport} from './engine/sessionManager';
import {readRecoveryBackup} from './engine/sessionRecovery';
import './style.css';
import './interfaceThemes.css';
import {AboutModal,BuildOutputModal} from './app/AppDialogs';
import {ToolButton,MenuButton,FullscreenMenuButton} from './app/AppMenuButtons';
// Studios load on first use: they are not part of the startup bundle.
// Each one gets its own Suspense boundary, so opening a studio never blanks the editor.
function deferred<P extends object>(load:()=>Promise<Record<string,unknown>>,name:string){
  const Component=lazy(async()=>({default:(await load())[name] as React.ComponentType<P>}));
  const Deferred=(props:P)=><Suspense fallback={null}><Component {...props}/></Suspense>;
  Deferred.displayName=`Deferred(${name})`;
  return Deferred;
}
const BspViewer=deferred<React.ComponentProps<typeof import('./components/BspViewer').BspViewer>>(()=>import('./components/BspViewer'),'BspViewer');
const BlueprintToMapStudio=deferred<React.ComponentProps<typeof import('./components/BlueprintToMapStudio').BlueprintToMapStudio>>(()=>import('./components/BlueprintToMapStudio'),'BlueprintToMapStudio');
const TerrainShapeStudio=deferred<React.ComponentProps<typeof import('./components/TerrainShapeStudio').TerrainShapeStudio>>(()=>import('./components/TerrainShapeStudio'),'TerrainShapeStudio');
const SmartConnectPanel=deferred<React.ComponentProps<typeof import('./components/SmartConnectPanel').SmartConnectPanel>>(()=>import('./components/SmartConnectPanel'),'SmartConnectPanel');
const MissionEventsStudio=deferred<React.ComponentProps<typeof import('./components/MissionEventsStudio').MissionEventsStudio>>(()=>import('./components/MissionEventsStudio'),'MissionEventsStudio');
const CSMapStudio=deferred<React.ComponentProps<typeof import('./components/CSMapStudio').CSMapStudio>>(()=>import('./components/CSMapStudio'),'CSMapStudio');
const GameplayStudio=deferred<React.ComponentProps<typeof import('./components/GameplayStudio').GameplayStudio>>(()=>import('./components/GameplayStudio'),'GameplayStudio');
const PrefabStudio=deferred<React.ComponentProps<typeof import('./components/PrefabStudio').PrefabStudio>>(()=>import('./components/PrefabStudio'),'PrefabStudio');
const CinematicCameraStudio=deferred<React.ComponentProps<typeof import('./components/CinematicCameraStudio').CinematicCameraStudio>>(()=>import('./components/CinematicCameraStudio'),'CinematicCameraStudio');
const LightingStudio=deferred<React.ComponentProps<typeof import('./components/LightingStudio').LightingStudio>>(()=>import('./components/LightingStudio'),'LightingStudio');
const NPCStudio=deferred<React.ComponentProps<typeof import('./components/NpcStudio').NPCStudio>>(()=>import('./components/NpcStudio'),'NPCStudio');
const ProjectHistoryModal=deferred<React.ComponentProps<typeof import('./components/ProjectHistoryModal').ProjectHistoryModal>>(()=>import('./components/ProjectHistoryModal'),'ProjectHistoryModal');
const MapPackagerStudio=deferred<React.ComponentProps<typeof import('./components/MapPackagerStudio').MapPackagerStudio>>(()=>import('./components/MapPackagerStudio'),'MapPackagerStudio');
const BrushWorkshop=deferred<React.ComponentProps<typeof import('./components/BrushWorkshop').BrushWorkshop>>(()=>import('./components/BrushWorkshop'),'BrushWorkshop');
const CoopPuzzleStudio=deferred<React.ComponentProps<typeof import('./components/CoopPuzzleStudio').CoopPuzzleStudio>>(()=>import('./components/CoopPuzzleStudio'),'CoopPuzzleStudio');
const TrueLightingPreview=deferred<React.ComponentProps<typeof import('./components/TrueLightingPreview').TrueLightingPreview>>(()=>import('./components/TrueLightingPreview'),'TrueLightingPreview');
const SmartBuildSettingsModal=deferred<React.ComponentProps<typeof import('./components/SmartBuildSettingsModal').SmartBuildSettingsModal>>(()=>import('./components/SmartBuildSettingsModal'),'SmartBuildSettingsModal');
const BuildTogetherPanel=deferred<React.ComponentProps<typeof import('./components/BuildTogether').BuildTogetherPanel>>(()=>import('./components/BuildTogether'),'BuildTogetherPanel');

const BLUEPRINT_MENU_LABELS={es:'Blueprint to Map · Planos',en:'Blueprint to Map',ru:'Blueprint to Map · Чертежи',ko:'Blueprint to Map · 평면도',zh:'Blueprint to Map · 平面图',pt:'Blueprint to Map · Plantas'} as const;
const BSP_PREFAB_LABELS={
  es:{coords:'Importar objeto BSP — posición X Y Z (unidades GoldSrc)',invalid:'Ingresá tres coordenadas válidas entre ±32768.',confirm:'¿Importar {n} brush(es) editables en {xyz}? Se cargarán las texturas del WAD3 {wad}. Para compilar, usá Smart WAD o prepará su archivo desde Estudio de Prefabricados.',save:'¿Guardar el objeto en la Biblioteca de Prefabs para colocarlo con el mouse en otros mapas? El WAD es necesario para compilar.',download:'¿Descargar {wad} con la paleta y los mipmaps originales? Es necesario para compilar el objeto en otras PC.'},
  en:{coords:'Import BSP object — X Y Z placement (GoldSrc units)',invalid:'Enter three valid coordinates within ±32768.',confirm:'Import {n} editable brush(es) at {xyz}? Textures from {wad} will be loaded for preview. For compilation use Smart WAD or prepare its WAD in Prefab Studio.',save:'Save this BSP object to the Prefab Library for mouse placement in other maps? The original WAD is needed for compilation.',download:'Download {wad} with the original palette and mipmaps? It is required to compile the object on other PCs.'},
  ru:{coords:'Импорт BSP объекта — координаты X Y Z (GoldSrc)',invalid:'Укажите три допустимые координаты в пределах ±32768.',confirm:'Импортировать {n} брашей в {xyz}? WAD3 {wad} загрузится для просмотра. Для сборки используйте Smart WAD либо подготовьте WAD в студии префабов.',save:'Сохранить объект в библиотеке префабов для размещения мышью в других картах? Для компиляции нужен WAD.',download:'Скачать WAD3 {wad} с оригинальной палитрой и mipmaps? Он нужен для компиляции.'},
  ko:{coords:'BSP 오브젝트 가져오기 — 배치 좌표 X Y Z (GoldSrc)',invalid:'±32768 이내의 좌표 세 개를 입력하세요.',confirm:'{xyz}에 브러시 {n}개를 가져올까요? {wad} WAD3 텍스처를 미리보기에 불러옵니다. 컴파일할 때는 Smart WAD 또는 프리팹 스튜디오의 WAD 준비 기능을 사용하세요.',save:'다른 맵에서 마우스로 배치하도록 프리팹 라이브러리에 저장할까요? 컴파일에는 WAD가 필요합니다.',download:'원본 팔레트 및 mipmap을 담은 {wad}를 다운로드할까요? 다른 PC에서 컴파일할 때 필요합니다.'},
  zh:{coords:'导入 BSP 对象 — 放置坐标 X Y Z (GoldSrc 单位)',invalid:'请输入 ±32768 范围内的三个有效坐标。',confirm:'在 {xyz} 导入 {n} 个可编辑笔刷？将加载 WAD3 {wad} 供预览。编译时请使用 Smart WAD 或在预制件工作室准备 WAD。',save:'保存到预制件库，以便在其他地图中用鼠标放置？编译时仍需 WAD。',download:'下载包含原始调色板与 mipmap 的 {wad}？其他电脑编译时需要。'},
  pt:{coords:'Importar objeto BSP — posição X Y Z (unidades GoldSrc)',invalid:'Digite três coordenadas válidas dentro de ±32768.',confirm:'Importar {n} brushes editáveis em {xyz}? As texturas WAD3 {wad} serão carregadas para prévia. Para compilar use Smart WAD ou prepare o WAD no Estúdio de Prefabs.',save:'Salvar este objeto na Biblioteca de Prefabs para posicionar com o mouse em outros mapas? O WAD ainda é necessário para compilar.',download:'Baixar {wad} com paleta e mipmaps originais? É necessário para compilar em outros computadores.'},
} as const;

const MISSION_STUDIO_LABELS={
  es:['Misiones y campañas','Eventos dinámicos'],en:['Mission & Campaign Studio','Dynamic Events Studio'],
  ru:['Миссии и кампании','Динамические события'],ko:['미션 및 캠페인','동적 이벤트'],
  zh:['任务与战役','动态事件'],pt:['Missões e campanhas','Eventos dinâmicos']
} as const;
async function streamCompile(payload:object,callback:(event:{type:string;message:string;output?:string;destination?:string;previewId?:string;installed?:boolean;stage?:string;kind?:string;points?:number[][]})=>void){
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
function SettingsModal({onClose,onOpenPackager,onOpenOutput}:{onClose:()=>void;onOpenPackager?:()=>void;onOpenOutput:()=>void}){return <SmartBuildSettingsModal onClose={onClose} onOpenPackager={onOpenPackager} onOpenOutput={onOpenOutput}/>;}
export default function App(){
  const t=useT();
  const buildTogetherStatus=useBuildTogether(s=>s.status);
  const uiScale=useStudioLayout(s=>s.uiScale),accent=useStudioLayout(s=>s.accent),appearance=useStudioLayout(s=>s.appearance),fontScale=useStudioLayout(s=>s.fontScale);
  const autoLayout=useStudioLayout(s=>s.autoLayout);
  const interfaceTheme=useStudioLayout(s=>s.interfaceTheme);
  useLayoutEffect(()=>{
    // Portaled menus, floating UV editors and dialogs belong to document.body.
    // A root-level theme ensures that they inherit the same tokens as the app.
    document.documentElement.dataset.svenTheme=interfaceTheme;
    document.documentElement.dataset.svenAccent=accent;
    return ()=>{delete document.documentElement.dataset.svenTheme;delete document.documentElement.dataset.svenAccent};
  },[interfaceTheme,accent]);
  useEffect(()=>{document.body.classList.remove('sven-light-ui')},[]);
  const toolbarGroups=useStudioLayout(s=>s.toolbarGroups)??[...TOOLBAR_GROUPS];
  const toolbarPinned=useStudioLayout(s=>s.pinnedToolbarGroups);
  const togglePinnedToolbar=useStudioLayout(s=>s.togglePinnedToolbarGroup);
  const hiddenToolbarGroups=useStudioLayout(s=>s.hiddenToolbarGroups)??[];
  const toggleToolbarGroupHidden=useStudioLayout(s=>s.toggleToolbarGroupHidden);
  const reorderToolbar=useStudioLayout(s=>s.reorderToolbarGroup);
  const toolbarGroupProps=(id:ToolbarGroup)=>({
    'data-toolbar-group':id,
    style:{order:toolbarPinned.includes(id)?-100+toolbarPinned.indexOf(id):toolbarGroups.indexOf(id),...(hiddenToolbarGroups.includes(id)?{display:'none'}:{})},
    onDragOver:(event:React.DragEvent<HTMLDivElement>)=>{if(event.dataTransfer.types.includes('application/x-sven-toolbar-section'))event.preventDefault()},
    onDrop:(event:React.DragEvent<HTMLDivElement>)=>{
      const source=event.dataTransfer.getData('application/x-sven-toolbar-section') as ToolbarGroup;
      if(TOOLBAR_GROUPS.includes(source)){event.preventDefault();event.stopPropagation();reorderToolbar(source,id)}
    }
  });
  const toolbarPin=(id:ToolbarGroup)=><button type="button" className={`ui3-toolbar-pin ${toolbarPinned.includes(id)?'active':''}`}
    aria-label={`${t('Pin or unpin toolbar group')}: ${id}`} aria-pressed={toolbarPinned.includes(id)}
    title={t('Pin or unpin toolbar group')} onClick={()=>togglePinnedToolbar(id)}>{toolbarPinned.includes(id)?'★':'☆'}</button>;
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
  // Short non-blocking notices (ribbon actions and others): document event 'svenstudio:toast'.
  const [toast,setToast]=useState<{message:string;kind:'info'|'error';id:number}|null>(null);
  useEffect(()=>{
    let timer=0;
    const show=(event:Event)=>{const detail=(event as CustomEvent<{message:string;kind?:'info'|'error'}>).detail;if(!detail?.message)return;window.clearTimeout(timer);setToast({message:detail.message,kind:detail.kind??'info',id:Date.now()});timer=window.setTimeout(()=>setToast(null),detail.kind==='error'?5000:2500);};
    document.addEventListener('svenstudio:toast',show);
    return()=>{document.removeEventListener('svenstudio:toast',show);window.clearTimeout(timer);};
  },[]);
  // Texture find & replace is owned here so the shortcut, the Texture Browser and the help can all open it.
  const [textureReplace,setTextureReplace]=useState<{find:string;replace:string}|null>(null);
  useEffect(()=>{
    const open=(event:Event)=>{
      const detail=(event as CustomEvent<{find?:string;replace?:string}>).detail??{};
      const st=useEditor.getState();const brush=st.project.objects.find(o=>o.id===st.selected);
      const face=brush?.kind==='brush'?brush.faces[st.selectedFace??0]:undefined;
      setTextureReplace({find:detail.find??face?.texture??'',replace:detail.replace??st.currentTexture??''});
    };
    document.addEventListener('svenstudio:open-texture-replace',open);
    return()=>document.removeEventListener('svenstudio:open-texture-replace',open);
  },[]);
  const [lastBuildDestination,setLastBuildDestination]=useState<string|null>(null);
  // True once the last compiled map is installed in the game (needed for "Test in game").
  const [lastInstalled,setLastInstalled]=useState(false);
  const [bspMap,setBspMap]=useState<BspMap|null>(null),[bspSource,setBspSource]=useState<ArrayBuffer|null>(null),[bspMode,setBspMode]=useState(false),[bspEditorActive,setBspEditorActive]=useState(false),[bspPreviewBaked,setBspPreviewBaked]=useState(false),[bspLoading,setBspLoading]=useState(false),[lastCompiled,setLastCompiled]=useState<string|null>(null);
  const [truePreviewOpen,setTruePreviewOpen]=useState(false),[truePreviewMap,setTruePreviewMap]=useState<BspMap|null>(null);
  const [truePreviewLayout,setTruePreviewLayout]=useState<'split'|'full'>('split');
  const [truePreviewSource,setTruePreviewSource]=useState<ArrayBuffer|null>(null);
  const [truePreviewStatus,setTruePreviewStatus]=useState(''),[truePreviewBusy,setTruePreviewBusy]=useState(false);
  const [truePreviewSnapshot,setTruePreviewSnapshot]=useState<typeof project|null>(null);
  const [truePreviewCompilerKey,setTruePreviewCompilerKey]=useState<string|null>(null);
  const [truePreviewCompilerLabel,setTruePreviewCompilerLabel]=useState('SC-RAD');
  const bspInput=useRef<HTMLInputElement>(null);
  const [recoveryStatus,setRecoveryStatus]=useState<'waiting'|'saved'|'error'>('waiting');
  const saveDirty=useSaveState(s=>s.dirty);
  const lastBackupAt=useSaveState(s=>s.lastBackupAt);
  const backupNote=lastBackupAt?` ${t('Last backup in Documents')}: ${new Date(lastBackupAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}.`:'';
  // v2.6: Help → Entity guide can be opened from the entity assistant (mini guide) with a class preselected.
  const [helpStart,setHelpStart]=useState<{tab:'manual'|'entities';cls?:string}>({tab:'manual'});
  useEffect(()=>{const open=(event:Event)=>{setHelpStart({tab:'entities',cls:(event as CustomEvent<string>).detail||undefined});setDialog('about');};document.addEventListener('svenstudio:entity-guide',open);return()=>document.removeEventListener('svenstudio:entity-guide',open);},[]);
  useEffect(()=>{const listener=(event:Event)=>setRecoveryStatus((event as CustomEvent<{status:'saved'|'error'}>).detail.status);window.addEventListener('svenstudio-recovery-status',listener);return()=>window.removeEventListener('svenstudio-recovery-status',listener)},[]);
  const undo=useEditor(s=>s.undo),redo=useEditor(s=>s.redo),duplicate=useEditor(s=>s.duplicateSelected),remove=useEditor(s=>s.removeSelected);
  const appendLogs=useEditor(s=>s.appendLogs),compileBusy=useEditor(s=>s.compileBusy),setCompileBusy=useEditor(s=>s.setCompileBusy);
  const settings=useEditor(s=>s.settings);
  const isCS16=settings.gameProfile==='cs16';
  const fgdLoaded=useEditor(s=>s.fgdLoaded);
  // Read the installed Sven Co-op FGD once when the editor starts or the game path changes.
  // Missing/ambiguous installations leave the starter list intact.
  useEffect(()=>{if(fgdLoaded)return;void ensureSvenCoopFgd({discover:true}).catch(()=>{});},[settings.gameDir,settings.gameProfile,fgdLoaded]);
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
  const headerMode=useFittingHeaderDensity(headerRef,headerDensity(headerSize.width),`${headerSize.width}:${interfaceTheme}:${locale}:${fontScale}`);
  useEffect(()=>{setExtraMenu(false)},[headerMode]);
  const [dialog,setDialog]=useState<'entityReport'|'settings'|'controls'|'about'|'layout'|'entityAppearance'|'gameplay'|'cinematic'|'npc'|'sound'|'lighting'|'doctor'|'csMap'|'visibility'|'output'|'packager'|'terrain'|'blueprint'|'mission'|'events'|'puzzle'|'buildTogether'|'workshop'|'smartConnect'|'prefabs'|'reset'|'history'|null>(null),[fileMenu,setFileMenu]=useState(false),[studiosMenu,setStudiosMenu]=useState(false),[workspaceMenu,setWorkspaceMenu]=useState(false);
  const btArchitectureMode=useArchitectureMode(s=>s.mode);
  useEffect(()=>{setBuildTogetherDialog(welcomeOpen?null:dialog??(btArchitectureMode!=='off'?'architecture':null));return()=>setBuildTogetherDialog(null)},[dialog,welcomeOpen,btArchitectureMode]);
  const closeHelp=()=>{try{localStorage.setItem('svenstudio:welcome-guide-v1','seen')}catch{/* private browsing */}setDialog(null)};
  useEffect(()=>{
    if(welcomeOpen)return;
    try{
      if(localStorage.getItem('svenstudio:welcome-guide-v1')!=='seen')setDialog(current=>current??'about');
    }catch{/* Incognito/private mode can disable storage */}
  },[welcomeOpen]);
  const projectInput=useRef<HTMLInputElement>(null),mapInput=useRef<HTMLInputElement>(null),rmfInput=useRef<HTMLInputElement>(null),objectPrefabInput=useRef<HTMLInputElement>(null);
  const fileButton=useRef<HTMLButtonElement>(null),studiosButton=useRef<HTMLButtonElement>(null),workspaceButton=useRef<HTMLButtonElement>(null),extraButton=useRef<HTMLButtonElement>(null);
  const imported=async(e:React.ChangeEvent<HTMLInputElement>,type:'map'|'rmf'|'project')=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      // Inspect the entire file before changing editor state. MAP geometry must never
      // disappear unnoticed if an unsupported brush cannot be reconstructed.
      const rmfInspected=type==='rmf'?inspectRmfImport(await file.arrayBuffer(),file.name):null;
      const inspected=type==='map'?inspectMapImport(await file.text(),file.name):rmfInspected;
      const p=inspected?inspected.project:await readProject(file);
      if(rmfInspected){
        const info=rmfInspected.summary;
        const summary=locale==='es'
          ?`Importar RMF ${info.version} de Hammer/SvenCraft\n\nBrushes: ${info.brushes}\nEntidades: ${info.entities}\nGrupos: ${info.groups}\nVisGroups: ${info.visgroups}\nCámaras: ${info.cameras}\nRutas: ${info.paths}\n\nSe conservará la metadata del editor en el proyecto SvenStudio. Los WAD y demás recursos externos deben estar disponibles. ¿Continuar?`
          :`Import Hammer/SvenCraft RMF ${info.version}\n\nBrushes: ${info.brushes}\nEntities: ${info.entities}\nGroups: ${info.groups}\nVisGroups: ${info.visgroups}\nCameras: ${info.cameras}\nPaths: ${info.paths}\n\nEditor metadata will be kept in the SvenStudio project. WADs and other external resources must be available. Continue?`;
        if(!window.confirm(summary))return;
      }
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
      loadProject(inspected?{...p,target:settings.gameProfile==='cs16'?'cs16':'svengine'}:p);
      appendLogs([`Opened ${file.name}: ${p.objects.length} objects${report?.skippedBrushes?` (WARNING: ${report.skippedBrushes} brushes skipped)`:''}`]);
    }
    catch(err){appendLogs([`Import error: ${String(err)}`]);window.alert(`${t('Import failed')}: ${String(err)}`)}
    finally{e.target.value='';setFileMenu(false)}
  };
  const importPrefabFile=async(file:File)=>{
    try{
      if(file.size>40*1024*1024)throw Error('Prefab file exceeds 40 MB.');
      const anyPrefab=parseStudioPrefab(await file.text());
      const words=BSP_PREFAB_LABELS[locale];
      if(anyPrefab.format!=='svenstudio-bsp-object'){
        const coords=window.prompt(words.coords,'0 0 64');if(coords===null)return;
        const parsed=coords.trim().split(/[,\s]+/).map(Number);
        if(parsed.length!==3||parsed.some(n=>!Number.isFinite(n)||Math.abs(n)>32768))throw Error(words.invalid);
        const placed=placePrefab(anyPrefab,parsed as [number,number,number]);
        if(!window.confirm(`Import ${placed.length} MAP objects at ${parsed.join(' ')}?`))return;
        useEditor.getState().addObjects(placed);
        setWelcomeOpen(false);exitGameplayTest();setBspMode(false);setBspEditorActive(false);
        appendLogs([`Prefab Studio: imported ${placed.length} objects from ${file.name}. Ensure their external WADs are available for compilation.`]);return;
      }
      const prefab=validateBspObjectPrefab(anyPrefab);
      const coords=window.prompt(words.coords,'0 0 64');
      if(coords===null)return;
      const parsed=coords.trim().split(/[,\s]+/).map(Number);
      if(parsed.length!==3||parsed.some(n=>!Number.isFinite(n)||Math.abs(n)>32768))throw Error(words.invalid);
      const placed=placePrefab(prefab,parsed as [number,number,number]);
      // Shared validation with mouse placement: decode before modifying the project.
      const {file:wadFile,textures:decoded}=await decodePrefabTextures(prefab,useEditor.getState().textureAssets);
      if(!window.confirm(words.confirm.replace('{n}',String(placed.length)).replace('{xyz}',parsed.join(' ')).replace('{wad}',prefab.wad.filename)))return;
      // Add textures to the active MAP (not a stale BSP session) and make
      // every brush a real editor object with Undo/Redo support.
      useEditor.getState().setTextures(decoded,prefab.wad.filename);
      useEditor.getState().addObjects(placed);
      try{await rememberWadFile(wadFile)}catch(error){appendLogs([`Could not cache prefab WAD for next session: ${String(error)}`])}
      if(window.confirm(words.save)){
        try{useEditor.getState().addPrefab(prefab)}catch(error){appendLogs([`Prefab library: ${String(error)}`]);window.alert(String(error))}
      }
      if(window.confirm(words.download.replace('{wad}',prefab.wad.filename))){
        const wadPath=await downloadPrefabWad(prefab);appendLogs([`Prefab WAD saved: ${wadPath}`]);
      }
      setWelcomeOpen(false);exitGameplayTest();setBspMode(false);setBspEditorActive(false);
      appendLogs([`BSP Object Extractor: imported ${placed.length} brushes from ${file.name}; companion WAD: ${prefab.wad.filename}. Configure WAD path before compile.`]);
    }catch(error){appendLogs([`Prefab import: ${String(error)}`]);window.alert(`BSP Object Extractor: ${String(error)}`)}
  };
  const importBspObjectPrefab=async(event:React.ChangeEvent<HTMLInputElement>)=>{const file=event.target.files?.[0];event.target.value='';if(file)await importPrefabFile(file)};
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
      // Mark BSP→MAP origin even if the user later renames the project.
      // This editor-only flag is saved in the .svenstudio.json project,
      // never in Valve 220 MAP exports or compiled BSPs.
      loadProject({...next,recoveredFromBsp:true,target:settings.gameProfile==='cs16'?'cs16':'svengine'});
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
  const saveProjectToDocuments=async()=>{
    try{const saved=await saveProject(useEditor.getState().project);appendLogs([`Project saved: ${saved.path}`]);}
    catch(error){appendLogs([`Save project error: ${String(error)}`]);window.alert(String(error))}
  };
  const saveMap=async()=>{
    try{const text=exportMap(project,wadPaths);const saved=await downloadText(text,`${settings.mapName||'untitled'}.map`);appendLogs([`Exported ${text.length} bytes of ${project.target==='cs16'?'Counter-Strike 1.6':'Svengine'} Valve 220 .map source → ${saved.path}`]);}
    catch(err){appendLogs([`Export error: ${String(err)}`]);alert(String(err))}
  };
  const compile=async(mode:'game'|'preview'='game',selectedCompiler?:'sc'|'sdhlt')=>{
    const cs16=settings.gameProfile==='cs16';
    if(cs16&&settings.compilerEngine!=='zhlt'){setDialog('settings');appendLogs(['CS 1.6 requires ZHLT compilers.']);return;}
    if(cs16){const issues=inspectCS16Project(project);if(issues.length)appendLogs(issues.map(i=>`CS 1.6 [${i.code}] ${i.message}`));}
    if(compileBusy)return;
    const gameplayIssues=cs16?[]:[...analyzeGameplay(project.objects),...validateNpcLogic(project.objects),...validateAudio(project.objects),...validateEnvironment(project.objects)];
    const gameplayErrors=gameplayIssues.filter(x=>x.severity==='error').map(x=>x.message);
    const gameplayWarnings=gameplayIssues.filter(x=>x.severity==='warning').map(x=>x.message);
    if(gameplayWarnings.length)appendLogs(gameplayWarnings.map(x=>`Gameplay warning: ${x}`));
    const state=useEditor.getState();
    const textureWarnings=textureCompileWarnings(project,state.textureAssets,wadPaths);
    if(textureWarnings.length)appendLogs(textureWarnings.slice(0,30));
    const diagnostic=cs16?{issues:[]}:analyzeMap(project,state.textureAssets,state.fgdClasses,state.fgdLoaded);
    const preflight=diagnostic.issues.filter(x=>x.severity==='warning');
    if(preflight.length)appendLogs([`Map Doctor: ${preflight.length} advisory warnings (see Studios → Map Doctor).`,...preflight.slice(0,10).map(x=>`Map Doctor [${x.code}]: ${x.message}`)]);
    const issues=[...validateProject(project),...gameplayErrors];
    if(issues.length){setDialog('output');issues.forEach(x=>appendLogs([`Invalid geometry: ${x}`]));alert(`Compilation blocked: fix these issues first:\n\n${issues.join('\n')}`);return;}
    const requestedSettings={...settings,compilerEngine:cs16?'zhlt':selectedCompiler||settings.compilerEngine};
    if((!cs16&&!(requestedSettings.compilerEngine==='sdhlt'?requestedSettings.sdhltDir:requestedSettings.compilerDir))||!requestedSettings.gameDir){setDialog('settings');appendLogs(['Set your selected compiler folder and game directory before compiling.']);return;}
    if(!/^[a-z][a-z0-9_-]*$/i.test(settings.mapName)){setDialog('settings');alert('Invalid map name: use letters, numbers, _ or -.');return;}
    // Compile region (cordon): build only the boxed part as <map>_region; the real map is never overwritten.
    const region=validRegion(state.compileRegion)?state.compileRegion:null;
    let buildName:string,baseMapName=settings.mapName;
    try{if(region)baseMapName=regionMapName(settings.mapName);buildName=lightTestMapName(baseMapName,mode==='preview'?'off':settings.radAmbientTest||'off')}
    catch(error){setDialog('settings');alert(String(error));return;}
    if(mode==='game'&&requestedSettings.distributionFormat==='install'){
      const target=cs16?'Counter-Strike 1.6 (cstrike_downloads)':'Sven Co-op (svencoop_addon)';
      const note=locale==='es'?`Se instalarán el BSP y sus recursos en ${target}. Si ya existe un archivo distinto, se rechazará la instalación. ¿Continuar?`:
        `This build will install its BSP and resources into ${target}. Different existing files will not be overwritten. Continue?`;
      if(!window.confirm(note))return;
    }
    const compileSettings={...requestedSettings};
    const engineLabel=cs16?'ZHLT':lightingCompilerLabel(compileSettings.compilerEngine);
    const compilerKey=lightingCompilerKey(compileSettings);
    useMapDoctorState.getState().beginBuild(buildName);
    if(mode==='preview'){setTruePreviewOpen(true);setTruePreviewBusy(true);setTruePreviewStatus(`Preparing ${engineLabel} preview…`);setDialog(null)}
    else setDialog('output');
    if(mode==='game'){setLastBuildDestination(null);setLastInstalled(false);}
    setCompileBusy(true);appendLogs([`Starting ${mode==='preview'?'temporary lighting preview':'build'} ${buildName}...`]);
    if(mode==='game'&&!cs16&&settings.radAmbientTest!=='off'&&settings.radAmbientTest)appendLogs([`SC-RAD diagnostic -ambient ${settings.radAmbientTest} ${settings.radAmbientTest} ${settings.radAmbientTest}; original ${settings.mapName}.bsp will NOT be overwritten. Test output: ${buildName}.bsp`]);
    let error=false,completed=false,previewId:string|null=null;
    try{
      let buildProject=project;
      if(region){
        const regionBuild=buildRegionProject(project,region,regionSealTexture(project,state.textureAssets.map(a=>a.name)));
        buildProject=regionBuild.project;
        appendLogs([`Compile region: ${regionBuild.kept} of ${regionBuild.total} objects, sealed with 6 '${regionBuild.sealTexture}' brushes → ${baseMapName}.bsp (the real map is not touched).`,...(regionBuild.spawnInside?[]:['Compile region: no player spawn inside the box; the map compiles but you cannot spawn in it.'])]);
      }
      const mapData=exportMap(buildProject,wadPaths);
      // CS 1.6: spectator overview (overviews/<map>.bmp/.txt) generated from the editable geometry.
      const overviewFiles=cs16&&mode==='game'&&!region&&compileSettings.csOverview!==false?buildCsOverview(settings.mapName,project.objects):null;
      if(cs16&&mode==='game'&&!region&&compileSettings.csOverview!==false)appendLogs([overviewFiles?`Overview: overviews/${settings.mapName}.bmp (ZOOM ${overviewFiles.params.zoom.toFixed(2)}) will be included.`:'Overview skipped: the map has no floors yet.']);
      const browserWads=compileSettings.smartWadMode&&compileSettings.smartWadMode!=='off'
        ?await browserWadsForSmartBuild(project,state.textureAssets,state.prefabs as StudioPrefab[]):[];
      await streamCompile({mapName:baseMapName,mapData,buildQuality:compileSettings.buildQuality||'final',overview:overviewFiles?{bmpBase64:bytesToBase64(overviewFiles.bmp),txt:overviewFiles.txt}:null,gameProfile:cs16?'cs16':'svengine',compilerDir:compileSettings.compilerDir,gameDir:compileSettings.gameDir,wadPaths,radAmbientTest:mode==='preview'?'off':compileSettings.radAmbientTest||'off',previewOnly:mode==='preview',compilerEngine:compileSettings.compilerEngine||'sc',sdhltDir:compileSettings.sdhltDir||'',sdhltAO:!!compileSettings.sdhltAO,sdhltPCF:compileSettings.sdhltPCF||'off',smartWadMode:compileSettings.smartWadMode||'off',smartWadName:compileSettings.smartWadName||'',browserWads,distributionDir:mode==='game'?compileSettings.distributionDir||'':'',distributionFormat:mode==='game'?compileSettings.distributionFormat||'off':'off',resourceRoots:compileSettings.resourceRoots||[]},ev=>{
        useMapDoctorState.getState().ingest(ev);
        appendLogs([ev.message]);if(mode==='game'&&ev.type==='package'&&ev.destination)setLastBuildDestination(ev.destination);if(mode==='preview'&&ev.type==='stage')setTruePreviewStatus(ev.message);if(ev.type==='error')error=true;if(ev.type==='complete'){completed=true;if(mode==='game'&&ev.installed)setLastInstalled(true);previewId=ev.previewId||null;}
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
  const installCompiledWithoutRebuild=async():Promise<boolean>=>{
    if(!lastCompiled||!lastBuildDestination)return false;
    const target=settings.gameProfile==='cs16'?'Counter-Strike 1.6 (cstrike_downloads)':'Sven Co-op (svencoop_addon)';
    const confirmText=locale==='es'?`¿Instalar ${lastCompiled}.bsp y sus recursos en ${target}? Se rechazarán los archivos existentes que tengan contenido diferente.`:`Install ${lastCompiled}.bsp and its resources into ${target}? Different existing files will not be overwritten.`;
    if(!window.confirm(confirmText))return false;
    try{const response=await fetch('/api/compile/install-last',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mapName:lastCompiled,gameDir:settings.gameDir,resourceRoots:settings.resourceRoots||[],confirm:true})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Installation rejected.');
      appendLogs([`Installed without recompiling: ${result.files} file(s) -> ${result.destination}`]);
      setLastInstalled(true);return true;
    }catch(error){appendLogs([`Installation: ${String(error)}`]);return false;}
  };
  // Test in game: install first when needed, then start the game on this map.
  const playInGame=async()=>{
    if(!lastCompiled)return;
    if(!lastInstalled&&!(await installCompiledWithoutRebuild()))return;
    try{const response=await fetch('/api/game/launch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({gameProfile:settings.gameProfile==='cs16'?'cs16':'svengine',gameDir:settings.gameDir,mapName:lastCompiled})});
      const result=await response.json();if(!response.ok)throw Error(result.error||`HTTP ${response.status}`);
      appendLogs([`Test in game: ${result.game} started on ${result.map}.`]);
    }catch(error){appendLogs([`Test in game: ${String(error instanceof Error?error.message:error)}`]);window.alert(String(error instanceof Error?error.message:error));}
  };
  const openLastBuildFolder=async()=>{
    if(!lastCompiled||!lastBuildDestination)return;
    try{const response=await fetch('/api/compile/open-output',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mapName:lastCompiled,gameDir:settings.gameDir})});
      const result=await response.json();if(!response.ok)throw Error(result.error||'Cannot open output folder.');
      appendLogs([`Build folder: ${result.destination}`]);
    }catch(error){appendLogs([`Open folder: ${String(error)}`])}
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
      // Ctrl+S saves the project from the home screen too (the editor stays mounted behind it).
      if(welcomeOpen&&!bspMode&&(e.ctrlKey||e.metaKey)&&!e.altKey&&e.code==='KeyS'){e.preventDefault();void saveProjectToDocuments();return;}
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
          e.preventDefault();void saveProjectToDocuments();return;
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
        if(useEditor.getState().settings.gameProfile==='cs16'){
          useEditor.getState().appendLogs(['CS 1.6: Gameplay Test simulates Sven Co-op mechanics and is disabled. Compile the BSP with ZHLT and test it in Counter-Strike 1.6.']);return;
        }
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
      if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void saveProjectToDocuments();return}
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
      // v2.3 HF9: editor tools with configurable shortcuts (same actions as their buttons).
      else if(action==='quadView'){const s=useEditor.getState();s.setSettings({quadView:!s.settings.quadView});}
      else if(action==='skybox'){const s=useEditor.getState();s.setSettings({editorSkybox:!s.settings.editorSkybox});}
      else if(action==='entityReport')setDialog(current=>current==='entityReport'?null:'entityReport');
      else if(action==='textureReplace')document.dispatchEvent(new CustomEvent('svenstudio:open-texture-replace',{detail:{}}));
      else if(action==='compileRegion'){const s=useEditor.getState();if(s.compileRegion)s.clearCompileRegion();else if(!s.setCompileRegionFromSelection())s.appendLogs(['Compile region: select something first.']);}
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
      .then(assets=>{if(!cancelled)useEditor.getState().setTextures(assets,'svstudio.wad',{trackProject:false})})
      .catch(err=>useEditor.getState().appendLogs([`Built-in texture pack: ${String(err)}`]));
    return()=>{cancelled=true};
  },[]);
  useEffect(()=>{
    let cancelled=false;
    void loadSavedWadFiles().then(async files=>{
      let restored=0;
      for(const file of files){
        if(cancelled)break;
        if(wasWadRemovedInSession(file.name))continue;
        try{
          if(file.name.toLowerCase()==='decals.wad'){
            const {parseDecalWad}=await import('./engine/wad');
            const decals=await parseDecalWad(file,{remember:false});
            if(!cancelled){useEditor.getState().setDecalAssets(decals,file.name);restored++;}
          }else{const textures=await parseWad(file,{remember:false});
            if(cancelled)break;if(wasWadRemovedInSession(file.name))continue;useEditor.getState().setTextures(textures,file.name,{trackProject:false});restored++;}
        }catch(error){useEditor.getState().appendLogs([`Saved WAD ${file.name}: ${String(error)}`]);}
      }
      if(!cancelled&&restored)useEditor.getState().appendLogs([`Restored ${restored} previously imported WAD file(s) from browser storage. Build WAD paths must still reference the real files.`]);
    }).catch(error=>{if(!cancelled)useEditor.getState().appendLogs([`WAD restore unavailable: ${String(error)}`]);});
    return()=>{cancelled=true};
  },[]);
  // v2.5: full-screen studios pause the 3D view behind them (big FPS win on heavy maps, e.g. Gameplay Studio).
  useEffect(()=>{const covering=!!dialog&&!['output','buildTogether','reset'].includes(dialog);if(useEditor.getState().viewportPaused!==covering)useEditor.setState({viewportPaused:covering});},[dialog]);
  // v2.4: opening a project also brings back the textures it uses from the game WADs.
  useEffect(()=>{
    let timer=0;
    const onLoaded=()=>{window.clearTimeout(timer);timer=window.setTimeout(()=>{void import('./engine/projectWadRestore').then(m=>m.restoreProjectTextures());},400);};
    document.addEventListener('svenstudio:project-loaded',onLoaded);
    return()=>{window.clearTimeout(timer);document.removeEventListener('svenstudio:project-loaded',onLoaded);};
  },[]);
  useEffect(()=>{
    const warning=(event:Event)=>useEditor.getState().appendLogs([String((event as CustomEvent<string>).detail)]);
    window.addEventListener('svenstudio:wad-cache-warning',warning);
    return()=>window.removeEventListener('svenstudio:wad-cache-warning',warning);
  },[]);
  const [worldBuilderStart,setWorldBuilderStart]=useState<'terrain'|'curves'>('terrain');
  useEffect(()=>{const handler=(event:Event)=>{const id=(event as CustomEvent<string>).detail;if(id==='curves'||id==='terrain'){setWorldBuilderStart(id==='curves'?'curves':'terrain');setDialog('terrain');}else if(id==='npc'||id==='sound'||id==='gameplay'||id==='cinematic'||id==='lighting'||id==='doctor'||id==='visibility'||id==='output'||id==='workshop'){setDialog(id);}else return;setFileMenu(false);setStudiosMenu(false);setWorkspaceMenu(false)};document.addEventListener('svenstudio:open-studio',handler);return()=>document.removeEventListener('svenstudio:open-studio',handler)},[]);
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
    if(useEditor.getState().settings.gameProfile==='cs16'){appendLogs(['CS 1.6: Gameplay Test is unavailable. Compile with ZHLT and play the BSP in Counter-Strike 1.6.']);return;}
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
  // Share the same safe snapshot-restoration path between the welcome screen
  // and Project History modal. Reset BSP/editor modes before loading a MAP.
  const restoreProjectFromHistory=(restored:import('./engine/types').Project)=>{
    setWelcomeOpen(false);exitGameplayTest();setBspMode(false);setBspMap(null);
    setBspSource(null);setBspEditorActive(false);setLastCompiled(null);
    setLastBuildDestination(null);loadProject(restored);
    appendLogs([`Project History: restored ${restored.name} (${restored.objects.length} objects).`]);
  };
  // v2.3 unified home: route to EXISTING tools, never create parallel modules.
  const handleHomeAction=(action:HomeAction)=>{
    switch(action){
      case 'editor':setWelcomeOpen(false);exitGameplayTest();setBspMode(false);return;
      case 'new':
        if(!window.confirm(t('Start a new project? Save existing work first.')))return;
        newProject();setLastCompiled(null);setLastBuildDestination(null);setBspMode(false);setBspMap(null);setBspSource(null);setBspEditorActive(false);setWelcomeOpen(false);return;
      case 'open':setWelcomeOpen(false);projectInput.current?.click();return;
      case 'import':setWelcomeOpen(false);mapInput.current?.click();return;
      case 'settings':setWelcomeOpen(false);setDialog('settings');return;
      case 'history':setWelcomeOpen(false);setDialog('history');return;
      case 'csMap':setWelcomeOpen(false);setDialog(isCS16?'csMap':'settings');return;
      case 'bspViewer':
      case 'bspEditor':
        setWelcomeOpen(false);exitGameplayTest();
        if(bspMap){setBspMode(true);setBspEditorActive(action==='bspEditor');}
        else if(lastCompiled){void openCompiledBsp();}
        else bspInput.current?.click();
        return;
      case 'world':setWelcomeOpen(false);setWorldBuilderStart('terrain');setDialog('terrain');return;
      case 'connect':setWelcomeOpen(false);setDialog('smartConnect');return;
      case 'texture':setWelcomeOpen(false);useEditor.getState().setResourceView('textures');useStudioLayout.getState().setVisible('assets',true);return;
      case 'decals':setWelcomeOpen(false);useEditor.getState().setResourceView('decals');useStudioLayout.getState().setVisible('assets',true);return;
      case 'sound':setWelcomeOpen(false);setDialog('sound');return;
      case 'prefabs':setWelcomeOpen(false);setDialog('prefabs');return;
      case 'doctor':setWelcomeOpen(false);setDialog('doctor');return;
      case 'together':setWelcomeOpen(false);setDialog('buildTogether');return;
      case 'build':setWelcomeOpen(false);void compile('game');return;
      case 'resources':setWelcomeOpen(false);useStudioLayout.getState().setVisible('assets',true);return;
      case 'help':setWelcomeOpen(false);setHelpStart({tab:'manual'});setDialog('about');return;
      case 'appearance':setWelcomeOpen(false);setDialog('layout');return;
    }
  };
  const primitive=(type:PlaceableShape)=>useEditor.getState().setPlacementShape(placementShape===type?null:type);
  // Workspace interface scale belongs exclusively to MAP Editor. The Welcome
  // overlay and BSP Viewer are complete independent views that must use 100%
  // physical CSS pixels regardless of the user's editor UI scale (80–120%).
  // Changing modes also gives R3F the correct container size to re-measure.
  const shellScale=resolveShellScale(uiScale,welcomeOpen,bspMode);
  return <div className={`app-shell accent-${accent} appearance-${appearance} studio-theme-${interfaceTheme} ${welcomeOpen?'welcome-home-active':''} ${bspMode?'bsp-scale-isolated':''} ${autoLayout?'adaptive-ui-enabled':''}`} style={{zoom:shellScale,width:`${100/shellScale}vw`,height:`${100/shellScale}vh`,minHeight:0,'--ui-font-scale':fontScale} as React.CSSProperties}>
    <header ref={headerRef} className="titlebar" data-header-mode={headerMode}>
      <div className="titlebar-leading">
      <button type="button" className={`brand brand-home-trigger ${welcomeOpen?'brand-home-active':''}`} onClick={openWelcome} aria-pressed={welcomeOpen} title={translate(locale,'Open home screen')}><span className="brand-logo"><Box size={20} strokeWidth={2.3}/></span><span>SVEN<span className="brand-light">STUDIO</span></span><span className="brand-tag">3D</span><span className="version-label">v2.5</span></button>
      <div className="top-divider"/>
      <div className="menu-parent"><button ref={fileButton} type="button" aria-expanded={fileMenu} aria-controls="sven-file-menu" aria-haspopup="menu" className={`top-nav ${fileMenu?'chosen':''}`} onClick={()=>{setStudiosMenu(false);setWorkspaceMenu(false);setFileMenu(v=>!v)}}>{t('File')} <ChevronDown size={12}/></button>
        <TopDropdown anchor={fileButton} open={fileMenu} onClose={()=>setFileMenu(false)} id="sven-file-menu" className="file-menu" align="left" width={288}><MenuButton onClick={()=>{if(confirm(t('Start a new project? Save existing work first.'))){newProject();setLastCompiled(null);setLastBuildDestination(null);setBspMode(false);setBspMap(null);setBspSource(null);setBspEditorActive(false);setDialog(null)}setFileMenu(false)}}><FilePlus2 size={15}/> {t('New project')}</MenuButton>
          <MenuButton onClick={()=>{setFileMenu(false);projectInput.current?.click()}}><FolderOpen size={15}/> {t('Open project')}</MenuButton>
          <MenuButton onClick={()=>{setFileMenu(false);mapInput.current?.click()}}><FileUp size={15}/> {t('Import .MAP')}</MenuButton>
          <MenuButton onClick={()=>{setFileMenu(false);objectPrefabInput.current?.click()}}><PackagePlus size={15}/> {({es:'Importar objeto BSP (.svprefab)',en:'Import BSP object (.svprefab)',ru:'Импорт BSP объекта (.svprefab)',ko:'BSP 오브젝트 가져오기 (.svprefab)',zh:'导入 BSP 对象 (.svprefab)',pt:'Importar objeto BSP (.svprefab)'} as Record<string,string>)[locale]}</MenuButton>
          <MenuButton onClick={()=>{setFileMenu(false);rmfInput.current?.click()}}><FileUp size={15}/> {locale==='es'?'Importar .RMF (Hammer/SvenCraft)':locale==='ru'?'Импорт .RMF (Hammer/SvenCraft)':locale==='ko'?'Hammer/SvenCraft .RMF 가져오기':'Import .RMF (Hammer/SvenCraft)'}</MenuButton>
          <MenuButton onClick={()=>{setFileMenu(false);bspInput.current?.click()}}><ScanEye size={15}/> {t('Open .BSP (read-only)')}</MenuButton>
          <MenuButton onClick={()=>{setFileMenu(false);void openCompiledBsp()}}><ScanEye size={15}/> {t('Open compiled BSP')}</MenuButton>
          <div className="menu-separator"/>
          <MenuButton onClick={()=>{void saveProjectToDocuments();setFileMenu(false)}}><Save size={15}/> {t('Save project')} <span className="shortcut">Ctrl+S</span></MenuButton>
          <MenuButton onClick={async()=>{setFileMenu(false);const backup=await readRecoveryBackup();if(!backup){window.alert(t('No earlier recovery snapshot is available.'));return;}if(window.confirm(t('Restore the previous locally saved project? Your current work will be replaced.'))){loadProject(backup.project);appendLogs([`Recovered previous snapshot from ${new Date(backup.savedAt).toLocaleString()}`]);}}}><FolderOpen size={15}/> {t('Restore previous autosave')}</MenuButton>
          <MenuButton onClick={()=>{setFileMenu(false);setDialog('history')}}><History size={15}/> {({es:'Historial y recuperación',en:'Project History & Recovery',ru:'История и восстановление',ko:'프로젝트 기록 및 복구',zh:'项目历史与恢复',pt:'Histórico e recuperação'} as Record<string,string>)[locale]}</MenuButton>
          <MenuButton onClick={()=>{saveMap();setFileMenu(false)}}><FileDown size={15}/> {isCS16?'Export GoldSrc .MAP (Valve 220)':t('Export Svengine .MAP')}</MenuButton>
          <MenuButton onClick={()=>{setFileMenu(false);setDialog('packager')}}><PackagePlus size={15}/> {t('Map Packager Studio')}</MenuButton>
          <div className="menu-separator"/>
          <MenuButton onClick={()=>{setFileMenu(false);setDialog('reset')}}><Trash2 size={15}/> CLEAN</MenuButton>
        </TopDropdown>
      </div>
      <button className="top-nav" onClick={()=>{setHelpStart({tab:'manual'});setDialog('about')}}>{t('Help')}</button>
      <FullscreenMenuButton/><button className={`top-nav bt-top-button ${buildTogetherStatus==="online"?"chosen":""}`} title="BuildTogether — Multiplayer Mapping" onClick={()=>setDialog("buildTogether")}><Users size={15}/> BuildTogether</button>
      <div className="titlebar-more-parent"><button ref={extraButton} type="button" className="top-nav titlebar-more" title={translate(locale,'More actions')} aria-label={translate(locale,'More actions')} aria-expanded={extraMenu} aria-haspopup="menu" aria-controls="sven-extra-menu" onClick={()=>{setFileMenu(false);setStudiosMenu(false);setWorkspaceMenu(false);setExtraMenu(v=>!v)}}><Menu size={18}/><span>{translate(locale,'More')}</span></button>
        <TopDropdown anchor={extraButton} open={extraMenu} onClose={()=>setExtraMenu(false)} id="sven-extra-menu" className="studio-menu-dropdown titlebar-extra-menu" align="left" width={265}>
          {/* v2.3 HF8: grouped, and only what the header had to hide for lack of space (no duplicates). */}
          <div className="workspace-menu-caption">{t('Help and window')}</div>
          <button role="menuitem" onClick={()=>{setHelpStart({tab:'manual'});setDialog('about');setExtraMenu(false)}}><Info size={16}/>{t('Help')}</button>
          <button role="menuitem" onClick={()=>{setHelpStart({tab:'entities'});setDialog('about');setExtraMenu(false)}}><Info size={16}/>{t('Entity guide')}</button>
          <div className="titlebar-extra-fullscreen"><FullscreenMenuButton/></div>
          <button role="menuitem" onClick={()=>{setDialog('layout');setExtraMenu(false)}}><SunMoon size={16}/>{t('Editor preferences')}</button>
          <button role="menuitem" onClick={()=>{setDialog('buildTogether');setExtraMenu(false)}}><Users size={16}/>BuildTogether</button>
          <label className="titlebar-extra-language">{t('Interface language')}<select aria-label={t('Interface language')} value={localePreference} onChange={e=>{setLocale(e.target.value as typeof localePreference);setExtraMenu(false)}}><option value="auto">{t('Automatic (system language)')}</option>{LANGUAGES.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
          {headerMode==='minimal'&&<><div className="menu-separator"/><div className="workspace-menu-caption">{t('Mode')}</div>
          <button role="menuitem" onClick={()=>{setWelcomeOpen(false);exitGameplayTest();setBspMode(false);setExtraMenu(false)}}><Box size={16}/>{t('MAP Editor')}</button>
          <button role="menuitem" disabled={bspLoading} onClick={()=>{setWelcomeOpen(false);exitGameplayTest();if(bspMap)setBspMode(true);else if(lastCompiled)void openCompiledBsp();else bspInput.current?.click();setExtraMenu(false)}}><ScanEye size={16}/>{t('BSP Viewer')}</button>
          <button role="menuitem" disabled={bspLoading||isCS16} onClick={()=>{setWelcomeOpen(false);toggleGameplayTest();setExtraMenu(false)}}><Play size={16}/>{t('Gameplay Test')}</button></>}
          <div className="menu-separator"/><div className="workspace-menu-caption">{t('Compile and package')}</div>
          <button role="menuitem" onClick={()=>{setDialog('settings');setExtraMenu(false)}}><Settings2 size={16}/>{t('Build configuration')}</button>
          <button role="menuitem" onClick={()=>{setDialog('packager');setExtraMenu(false)}}><PackagePlus size={16}/>{t('Map Packager Studio')}</button>
          {(headerMode==='tight'||headerMode==='minimal')&&<><div className="menu-separator"/><div className="workspace-menu-caption">{t('Workspace')}</div>
          <button role="menuitem" onClick={()=>{setDialog('layout');setExtraMenu(false)}}><SlidersHorizontal size={16}/>{t('Editor preferences')}</button>
          
          
          <button role="menuitem" disabled={walkMode||bspMode||isCS16} onClick={()=>{document.dispatchEvent(new Event('svenstudio:toggle-gameplay-settings'));setExtraMenu(false)}}><Play size={16}/>{t('Gameplay Test settings')}</button>
          <div className="workspace-menu-caption">{t('Toolbar groups')}</div>
          {TOOLBAR_GROUPS.map(id=><button key={id} role="menuitemcheckbox" aria-checked={!hiddenToolbarGroups.includes(id)} className="workspace-toolbar-toggle" onClick={()=>toggleToolbarGroupHidden(id)}><span className="workspace-check" aria-hidden="true">{hiddenToolbarGroups.includes(id)?'':'✓'}</span>{t(TOOLBAR_GROUP_LABELS[id])}</button>)}</>}
          {headerMode==='minimal'&&<><div className="menu-separator"/><div className="workspace-menu-caption">{t('Studios')}</div>
          <button role="menuitem" onClick={()=>{setWorldBuilderStart('terrain');setDialog('terrain');setExtraMenu(false)}}><Mountain size={16}/>{t('World Builder Studio')}</button><button role="menuitem" onClick={()=>{setDialog('blueprint');setExtraMenu(false)}}><Ruler size={16}/>{BLUEPRINT_MENU_LABELS[locale]}</button>
          <button role="menuitem" onClick={()=>{setDialog('npc');setExtraMenu(false)}}><Skull size={16}/>{t('NPC & AI Studio')}</button>
          <button role="menuitem" onClick={()=>{setDialog('gameplay');setExtraMenu(false)}}><GitBranch size={16}/>{t('Gameplay Studio')}</button>
          <button role="menuitem" onClick={()=>{setDialog('mission');setExtraMenu(false)}}><Flag size={16}/>{MISSION_STUDIO_LABELS[locale][0]}</button>
          <button role="menuitem" onClick={()=>{setDialog('lighting');setExtraMenu(false)}}><SunMoon size={16}/>{t('Lighting & Environment Studio')}</button>
          <button role="menuitem" onClick={()=>{setDialog('sound');setExtraMenu(false)}}><Headphones size={16}/>{t('Audio Studio')}</button>
          <button role="menuitem" onClick={()=>{setDialog('cinematic');setExtraMenu(false)}}><Clapperboard size={16}/>{t('Cinematic Camera Studio')}</button>
          <button role="menuitem" onClick={()=>{useEditor.getState().setResourceView('decals');useStudioLayout.getState().setVisible('assets',true);setExtraMenu(false)}}><Paintbrush size={16}/>Decal Studio</button>
          {isCS16&&<button role="menuitem" onClick={()=>{setDialog('csMap');setExtraMenu(false)}}><ShieldCheck size={16}/>CS Map Studio</button>}<button role="menuitem" onClick={()=>{setDialog('doctor');setExtraMenu(false)}}><CheckCircle2 size={16}/>{t('Map Doctor')}</button></>}
        </TopDropdown>
      </div>
      </div>
      <div className="project-title"><span className={`project-status save-state-${saveDirty?'dirty':recoveryStatus==='error'?'error':'clean'}`} role="status" title={(saveDirty?t('Unsaved changes. Press Ctrl+S to save the project file.'):recoveryStatus==='error'?t('Autosave failed; export a project backup.'):t('All changes saved. Autosave also keeps a copy in this browser.'))+backupNote}/><input title={t('Project display name')} value={project.name} onChange={e=>setName(e.target.value)}/>{saveDirty&&<button type="button" className="save-state-chip" onClick={()=>void saveProjectToDocuments()} title={t('Unsaved changes. Press Ctrl+S to save the project file.')}>{t('Unsaved')}</button>}<span className="version-label" title={recoveryStatus==='error'?t('Autosave failed; export a project backup.'):t('Autosave is stored in this browser. Export a project file for a portable backup.')}>{recoveryStatus==='error'?t('Autosave error'):recoveryStatus==='saved'?t('Autosaved'):lastRecoveredAt()?t('Session recovered'):t('Workspace')}</span></div>
      <div className="titlebar-right"><div className="bsp-tab-switch" role="group" aria-label="MAP / BSP / Gameplay Test">
        <button className={!bspMode&&!walkMode?'active':''} aria-pressed={!bspMode&&!walkMode} onClick={()=>{setWelcomeOpen(false);exitGameplayTest();setBspMode(false);setBspEditorActive(false)}}>{t('MAP Editor')}</button>
        <button className={bspMode&&!bspEditorActive?'active':''} aria-pressed={bspMode&&!bspEditorActive} disabled={bspLoading} onClick={()=>{setWelcomeOpen(false);exitGameplayTest();setBspEditorActive(false);if(bspMap)setBspMode(true);else if(lastCompiled)void openCompiledBsp();else bspInput.current?.click()}}><ScanEye size={14}/>{bspLoading?'...':t('BSP Viewer')}</button>
        <button className={bspMode&&bspEditorActive?'active bsp-editor-global-tab':''} aria-pressed={bspMode&&bspEditorActive} disabled={bspLoading} title={t('Edit BSP entities in 3D')} onClick={()=>{setWelcomeOpen(false);exitGameplayTest();setBspEditorActive(true);if(bspMap)setBspMode(true);else if(lastCompiled)void openCompiledBsp();else bspInput.current?.click()}}><PenTool size={14}/>{t('BSP Editor')}</button>
        <button className={walkMode?'active gameplay-tab-active':''} aria-pressed={walkMode} disabled={bspLoading||isCS16} title={t('Gameplay Test')} onClick={()=>{setWelcomeOpen(false);toggleGameplayTest()}}><Play size={14}/>{t('Gameplay Test')}</button>
      </div><div className="studio-menu-parent"><button ref={studiosButton} type="button" aria-expanded={studiosMenu} aria-controls="sven-studios-menu" aria-haspopup="menu" className="studio-menu-button studios-main-button" onClick={()=>{setFileMenu(false);setWorkspaceMenu(false);setStudiosMenu(v=>!v)}}><Layers size={16}/>{t('Studios')}<ChevronDown size={12}/></button><TopDropdown anchor={studiosButton} open={studiosMenu} onClose={()=>setStudiosMenu(false)} id="sven-studios-menu" className="studio-menu-dropdown" align="right" width={242}>{isCS16&&<button role="menuitem" onClick={()=>{setDialog('csMap');setStudiosMenu(false)}}><ShieldCheck size={16}/>CS Map Studio</button>}<div className="workspace-menu-caption">{t('Construction')}</div><button role="menuitem" onClick={()=>{setDialog('prefabs');setStudiosMenu(false)}}><Boxes size={16}/>{({es:'Estudio de Prefabricados',en:'Prefab Studio',ru:'Студия префабов',ko:'프리팹 스튜디오',zh:'预制件工作室',pt:'Estúdio de Prefabs'} as Record<string,string>)[locale]}</button><button role="menuitem" onClick={()=>{setWorldBuilderStart('terrain');setDialog('terrain');setStudiosMenu(false)}}><Mountain size={16}/>{t('World Builder Studio')}</button><button role="menuitem" onClick={()=>{setDialog('blueprint');setStudiosMenu(false)}}><Ruler size={16}/>{BLUEPRINT_MENU_LABELS[locale]}</button><button role="menuitem" disabled={bspMode||walkMode} onClick={()=>{setDialog('smartConnect');setStudiosMenu(false)}}><Waypoints size={16}/>Smart Connect 3D</button><div className="workspace-menu-caption">{t('Gameplay')}</div><button role="menuitem" onClick={()=>{setDialog('gameplay');setStudiosMenu(false)}}><GitBranch size={16}/>{t('Gameplay Studio')}</button><button role="menuitem" onClick={()=>{setDialog('mission');setStudiosMenu(false)}}><Flag size={16}/>{MISSION_STUDIO_LABELS[locale][0]}</button><button role="menuitem" onClick={()=>{setDialog('npc');setStudiosMenu(false)}}><Skull size={16}/>{t('NPC & AI Studio')}</button><button role="menuitem" onClick={()=>{setDialog('cinematic');setStudiosMenu(false)}}><Clapperboard size={16}/>{t('Cinematic Camera Studio')}</button><div className="workspace-menu-caption">{t('Lighting & sound')}</div><button role="menuitem" onClick={()=>{useEditor.getState().setEnvironmentPreview(false);setTruePreviewOpen(true);setTruePreviewLayout('split');setStudiosMenu(false)}}><SunMoon size={16}/>True Lighting</button><button role="menuitem" onClick={()=>{setDialog('lighting');setStudiosMenu(false)}}><SunMoon size={16}/>{t('Lighting & Environment Studio')}</button><button role="menuitem" onClick={()=>{setDialog('sound');setStudiosMenu(false)}}><Headphones size={16}/>{t('Audio Studio')}</button><button role="menuitem" onClick={()=>{useEditor.getState().setResourceView('decals');useStudioLayout.getState().setVisible('assets',true);setStudiosMenu(false)}}><Paintbrush size={16}/>Decal Studio</button><div className="workspace-menu-caption">{t('Check')}</div><button role="menuitem" onClick={()=>{setDialog('doctor');setStudiosMenu(false)}}><CheckCircle2 size={16}/>{t('Map Doctor')}</button><button role="menuitem" onClick={()=>{setDialog('entityReport');setStudiosMenu(false)}}><ListTree size={16}/>{t('Entity report')}</button></TopDropdown></div><label className="language-picker" title={t('Interface language')}><Globe2 size={15}/><select aria-label={t('Interface language')} value={localePreference} onChange={e=>setLocale(e.target.value as typeof localePreference)}><option value="auto">{t('Automatic (system language)')} · {LANGUAGES.find(l=>l.id===locale)?.label??'English'}</option>{LANGUAGES.map(l=><option key={l.id} value={l.id}>{l.label}</option>)}</select></label><div className="studio-menu-parent workspace-menu-parent"><button ref={workspaceButton} type="button" aria-expanded={workspaceMenu} aria-controls="sven-workspace-menu" aria-haspopup="menu" className="studio-menu-button workspace-menu-button" onClick={()=>{setFileMenu(false);setStudiosMenu(false);setWorkspaceMenu(v=>!v)}}><Settings2 size={16}/><span>{t('Workspace')}</span><ChevronDown size={12}/></button><TopDropdown anchor={workspaceButton} open={workspaceMenu} onClose={()=>setWorkspaceMenu(false)} id="sven-workspace-menu" className="studio-menu-dropdown workspace-menu-dropdown" align="right" width={266}>
        <button role="menuitem" onClick={()=>{setDialog('layout');setWorkspaceMenu(false)}}><SlidersHorizontal size={16}/>{t('Editor preferences')}</button>
        
        
        <div className="menu-separator"/>
        <div className="workspace-menu-caption">{t('Toolbar groups')}</div>
        {TOOLBAR_GROUPS.map(id=><button key={id} role="menuitemcheckbox" aria-checked={!hiddenToolbarGroups.includes(id)} className="workspace-toolbar-toggle" onClick={()=>toggleToolbarGroupHidden(id)}><span className="workspace-check" aria-hidden="true">{hiddenToolbarGroups.includes(id)?'':'✓'}</span>{t(TOOLBAR_GROUP_LABELS[id])}</button>)}
        <div className="menu-separator"/>
        <button role="menuitem" disabled={walkMode||bspMode||isCS16} onClick={()=>{document.dispatchEvent(new Event('svenstudio:toggle-gameplay-settings'));setWorkspaceMenu(false)}}><Play size={16}/>{t('Gameplay Test settings')}</button>
      </TopDropdown></div><button type="button" className="top-appearance-button" title={t('Editor preferences')} aria-label={t('Editor preferences')} onClick={()=>setDialog('layout')}><SunMoon size={17}/></button><button className="top-build-settings" title={t('Build configuration')} aria-label={t('Build configuration')} onClick={()=>setDialog('settings')}><Settings2 size={15}/> {t('Build configuration')}</button>{compileBusy?<button className="top-stop" onClick={cancelCompile}><StopCircle size={14}/> {t('Stop Build')}</button>:<button className="top-compile" onClick={()=>void compile('game')}><Play size={14} fill="currentColor"/> {t('Compile Map')}</button>}<DesktopWindowControls/></div>
      <input ref={projectInput} type="file" accept=".json,.svenstudio.json" hidden onChange={e=>imported(e,'project')}/>
      <input ref={mapInput} type="file" accept=".map" hidden onChange={e=>imported(e,'map')}/>
      <input ref={rmfInput} type="file" accept=".rmf" hidden onChange={e=>imported(e,'rmf')}/>
      <input ref={objectPrefabInput} type="file" accept=".svprefab" hidden onChange={importBspObjectPrefab}/>
      <input ref={bspInput} type="file" accept=".bsp" hidden onChange={loadedBsp}/>
    </header>
    <main className="sven-workstack">
    <div className={`sven-editor-workspace ${welcomeOpen?'welcome-covered':''}`} inert={welcomeOpen}>
    {bspMode&&bspMap?<div className="bsp-workspace"><BspViewer map={bspMap} source={bspSource} initialBaked={bspPreviewBaked} editingRequested={bspEditorActive} onEditingChange={setBspEditorActive} onBack={()=>{setBspMode(false);setBspEditorActive(false)}} onOpen={()=>bspInput.current?.click()} onCompiled={()=>void openCompiledBsp()} onOpenRecoveredMap={openRecoveredMap}/></div>:<DockWorkspace toolbar={<div className="ribbon">
      <div className="ribbon-group" {...toolbarGroupProps('transform')}><div className="ribbon-tools"><ToolButton title={`${t('Move')} [${displayBinding(controls.shortcuts.move)}]`} active={mode==='translate'} onClick={()=>activateGizmoMode('translate')}><Move3D size={20}/><small>{t('Move')}</small></ToolButton><ToolButton title={`${t('Rotate')} [${displayBinding(controls.shortcuts.rotate)}]`} active={mode==='rotate'} onClick={()=>activateGizmoMode('rotate')}><Rotate3D size={20}/><small>{t('Rotate')}</small></ToolButton><ToolButton title={`${t('Scale')} [${displayBinding(controls.shortcuts.scale)}]`} active={mode==='scale'} onClick={()=>activateGizmoMode('scale')}><Scaling size={20}/><small>{t('Scale')}</small></ToolButton></div><small className="ribbon-caption">{toolbarPin('transform')}{toolbarGrip('transform')}{t('TRANSFORM')} · {t(mode==='select'?'SELECT':mode.toUpperCase())}</small></div>
      <div className="ribbon-group" {...toolbarGroupProps('view')}><div className="ribbon-tools"><ToolButton title={t('Toggle wireframe')} active={wireframe} onClick={()=>setFlag('wireframe',!wireframe)}><Eye size={20}/><small>{t('Wire')}</small></ToolButton><ToolButton title={t('Grid visibility')} active={showGrid} onClick={()=>setFlag('showGrid',!showGrid)}><Grid3x3 size={20}/><small>{t('Grid')}</small></ToolButton><ToolButton title={t('Show entity names')} active={showEntityNames} onClick={()=>setFlag('showEntityNames',!showEntityNames)}><FileCode2 size={20}/><small>{t('Labels')}</small></ToolButton><ToolButton title={t(showTransformGizmo?'Hide transform gizmo':'Show transform gizmo')} active={showTransformGizmo} onClick={()=>setShowTransformGizmo(!showTransformGizmo)}>{showTransformGizmo?<Move3D size={20}/>:<EyeOff size={20}/>}<small>{t('Gizmo')}</small></ToolButton><ToolButton title={t('Ghost mode')} active={ghostHidden} onClick={toggleGhostHidden}><Ghost size={20}/><small>{t('Ghost mode')}</small></ToolButton></div><small className="ribbon-caption">{toolbarPin('view')}{toolbarGrip('view')}{t('VIEW')}</small></div>
      <div className="ribbon-group" {...toolbarGroupProps('geometry')}><div className="ribbon-tools">
        {(['object','vertex','edge','face'] as const).map(value=><ToolButton key={value} active={geometryMode===value} title={t(value==='object'?'Object':value==='vertex'?'Edit vertices':value==='edge'?'Edit edges':'Face selection mode')} onClick={()=>setGeometryMode(value)}>
          {value==='vertex'?<span className="large-glyph">•</span>:value==='edge'?<span className="large-glyph">╱</span>:value==='face'?<Paintbrush size={19}/>:<Box size={19}/>}<small>{t(value==='object'?'Object':value==='vertex'?'Vertex':value==='edge'?'Edge':'Face')}</small>
        </ToolButton>)}
        {/* v2.4: the 3D draw-box tool existed but had lost its button. */}
        <ToolButton active={drawMode} title={t('Draw box: drag on the grid or a surface (X/Y/Z change the plane, Esc ends)')} onClick={()=>setDrawMode(!drawMode)}><SquarePlus size={19}/><small>{t('Draw box')}</small></ToolButton>
      </div><small className="ribbon-caption">{toolbarPin('geometry')}{toolbarGrip('geometry')} {isCS16?'GOLDSRC · CS 1.6':'SVENGINE'} · {t('Geometry editing').toUpperCase()}</small></div>
      <ModelingRibbonGroup groupProps={toolbarGroupProps('modeling')} caption={<>{toolbarPin('modeling')}{toolbarGrip('modeling')}{t('Modeling').toUpperCase()}</>}/>
      <TexturesRibbonGroup groupProps={toolbarGroupProps('textures')} caption={<>{toolbarPin('textures')}{toolbarGrip('textures')}{t('Textures').toUpperCase()}</>}/>
      <div className="ribbon-group" {...toolbarGroupProps('tools')}><div className="ribbon-tools"><ToolButton active={measureMode} title={t('Measure distance: click two surfaces (Esc to exit)')} onClick={toggleMeasure}><Ruler size={20}/><small>{t('Measure')}</small></ToolButton></div><small className="ribbon-caption">{toolbarPin('tools')}{toolbarGrip('tools')}{t('Tools').toUpperCase()}</small></div>
      <div className="ribbon-group" {...toolbarGroupProps('grid')}><div className="ribbon-tools"><ToolButton title={t('Snap to grid')} active={snapping} onClick={toggleSnap}><Magnet size={20}/><small>{t('Snap')}</small></ToolButton><label className="snap-step-control" title={t('Visual grid')}><small>{t('Visual grid')}</small><select className="snap-select" aria-label={t('Visual grid')} value={gridDisplayStep} onChange={e=>setGridDisplayStep(Number(e.target.value))}>{[1,2,4,8,16,32,64,128,256].map(v=><option key={v} value={v}>{v}u</option>)}</select></label><label className="snap-step-control" title={t('Move / draw step')}><small>{t('Move / draw step')}</small><select className="snap-select" aria-label={t('Move / draw step')} value={snap} onChange={e=>setSnap(Number(e.target.value))}>{[1,2,4,8,16,32,64,128,256].map(v=><option key={v} value={v}>{v}u</option>)}</select></label>{drawMode&&<label className="draw-height">{t('Height')} <input type="number" min="1" max="131072" step={snap} value={drawHeight} onChange={e=>{if(Number.isFinite(e.target.valueAsNumber))setDrawHeight(e.target.valueAsNumber)}} title={t('Height of new blocks in Svengine units')}/></label>}</div><small className="ribbon-caption">{toolbarPin('grid')}{toolbarGrip('grid')}{t('Grid').toUpperCase()}</small></div>
      <div className="ribbon-group last" {...toolbarGroupProps('edit')}><div className="ribbon-tools"><ToolButton title={t('Undo')} disabled={!history.length} onClick={undo}><Undo2 size={20}/><small>{t('Undo')}</small></ToolButton><ToolButton title={t('Redo')} disabled={!future.length} onClick={redo}><Redo2 size={20}/><small>{t('Redo')}</small></ToolButton><ToolButton title={t('Clone')} disabled={!selected} onClick={duplicate}><Copy size={19}/><small>{t('Clone')}</small></ToolButton><ToolButton title={t('Delete')} disabled={!selected} onClick={remove}><Trash2 size={19}/><small>{t('Delete')}</small></ToolButton></div><small className="ribbon-caption">{toolbarPin('edit')}{toolbarGrip('edit')}{t('EDIT')}</small></div>
    <div className="ribbon-group" {...toolbarGroupProps('studios')}>
      <div className="ribbon-tools">
        <ToolButton title={t('Shapes')} onClick={()=>{if(!useHudLayout.getState().items.shapes.visible){useHudLayout.getState().update('shapes',{visible:true});return;}document.dispatchEvent(new Event('svenstudio:toggle-shapes'))}}><Box size={20}/><small>{t('Shapes')}</small></ToolButton>
        <ToolButton title="Smart Connect 3D · Universal geometry" onClick={()=>setDialog('smartConnect')}><Waypoints size={20}/><small>Connect</small></ToolButton><ToolButton title={t('Visibility manager')} onClick={()=>setDialog('visibility')}><ScanEye size={20}/><small>{t('Visibility')}</small></ToolButton>
                <ToolButton title={t('World Builder Studio')} onClick={()=>{setWorldBuilderStart('terrain');setDialog('terrain')}}><Mountain size={20}/><small>World</small></ToolButton>
        {!isCS16&&<ToolButton title={t('Gameplay Studio')} onClick={()=>setDialog('gameplay')}><GitBranch size={20}/><small>{t('Gameplay')}</small></ToolButton>}
        {!isCS16&&<ToolButton title={t('NPC & AI Studio')} onClick={()=>setDialog('npc')}><Skull size={20}/><small>{t('NPC')}</small></ToolButton>}
        <ToolButton title="BuildTogether — Multiplayer Mapping" onClick={()=>setDialog("buildTogether")}><Users size={20}/><small>Together</small></ToolButton>
        <ToolButton title="Decal Studio" onClick={()=>{useEditor.getState().setResourceView('decals');useStudioLayout.getState().setVisible('assets',true)}}><Paintbrush size={20}/><small>Decals</small></ToolButton>
        {isCS16&&<ToolButton title="CS Map Studio" onClick={()=>setDialog('csMap')}><ShieldCheck size={20}/><small>CS Map</small></ToolButton>}<ToolButton title={t('Map Doctor')} onClick={()=>setDialog('doctor')}><CheckCircle2 size={20}/><small>{t('Map Doctor')}</small></ToolButton>
        <ToolButton title={t('Map Packager Studio')} onClick={()=>setDialog('packager')}><PackagePlus size={20}/><small>{t('Package')}</small></ToolButton>
      </div><small className="ribbon-caption">{toolbarPin('studios')}{toolbarGrip('studios')}{t('Studios')}</small>
    </div>
    </div>} viewport={<div className={`true-light-workbench ${truePreviewOpen&&truePreviewLayout==='full'?'true-light-full':''}`}><div className={`true-light-map${settings.quadView&&!walkMode?' quad-view':''}`}><div className="viewport-column"><ErrorBoundary label="viewport 3D" compact><Viewport trueLightingOpen={truePreviewOpen} trueLightingBusy={truePreviewBusy} onVisualizationMode={chooseVisualization}/></ErrorBoundary></div>{settings.quadView&&!walkMode&&<ErrorBoundary label="4 views" compact><OrthoViews/></ErrorBoundary>}</div>{truePreviewOpen&&<ErrorBoundary label="True Lighting preview" compact><TrueLightingPreview map={truePreviewMap} compilerLabel={truePreviewCompilerLabel} working={truePreviewBusy||compileBusy} status={truePreviewStatus} stale={!!truePreviewMap&&(truePreviewSnapshot!==project||truePreviewCompilerKey!==lightingCompilerKey(settings))} layout={truePreviewLayout} onToggleLayout={()=>setTruePreviewLayout(v=>v==='split'?'full':'split')} onBuild={engine=>void compile('preview',engine)} onClose={()=>{setTruePreviewOpen(false);setTruePreviewLayout('split')}} onOpenBsp={()=>{if(!truePreviewMap)return;setBspSource(truePreviewSource);setBspMap(truePreviewMap);setBspPreviewBaked(true);setBspMode(true)}}/></ErrorBoundary>}</div>} consolePanel={null}/>}
    </div>
    {welcomeOpen&&<WelcomeScreen onStart={()=>setWelcomeOpen(false)} onAction={handleHomeAction} onRestoreProject={restoreProjectFromHistory}/>}
      <FirstRunTour blocked={welcomeOpen||bspMode||walkMode}/><MapToolsHost/>
      {toast&&<div key={toast.id} className={`app-toast app-toast-${toast.kind}`} role={toast.kind==='error'?'alert':'status'}>{toast.message}</div>}
    </main>
    <footer className="statusbar"><div><span className="status-ok"/>{t('Ready')} <span className="status-divider"/> {isCS16?'Counter-Strike 1.6 · GoldSrc':'Sven Co-op · Svengine'} · Valve 220 <span className="status-divider"/> {project.objects.filter(o=>o.kind==='brush').length} {t('brushes')} <span className="status-divider"/> {project.objects.filter(o=>o.kind==='entity').length} {t('entities')}</div><div><Keyboard size={13}/> {displayBinding(controls.shortcuts.move)} {t('Move')} · {displayBinding(controls.shortcuts.rotate)} {t('Rotate')} · {displayBinding(controls.shortcuts.scale)} {t('Scale')} · {walkMode?t('Gameplay Test'):flyMode?t('Fly ON'):'RMB look · WASD · Q/E'} <span className="status-divider welcome-hide-version"/> <span className="welcome-hide-version">SvenStudio 3D v2.5</span></div></footer>
    {!bspMode&&<ShadingPie/>}
    <StudioOverlayRoot fontScale={fontScale}>
    {(dialog==='layout'||dialog==='entityAppearance'||dialog==='controls'||dialog==='visibility')&&<PreferencesStudio initial={({layout:'theme',entityAppearance:'entities',controls:'camera',visibility:'hidden'} as Record<string,PreferencesSection>)[dialog]} onClose={()=>setDialog(null)}/>}
{dialog==='entityReport'&&<EntityReport onClose={()=>setDialog(null)}/>}
{textureReplace&&<TextureReplaceDialog initialFind={textureReplace.find} initialReplace={textureReplace.replace} onClose={()=>setTextureReplace(null)}/>}
    {dialog==='output'&&<BuildOutputModal onClose={()=>setDialog(null)} onCancel={cancelCompile} onDoctor={()=>setDialog('doctor')} hasOutput={!!lastBuildDestination&&!!lastCompiled} onOpenFolder={()=>void openLastBuildFolder()} onInstall={()=>void installCompiledWithoutRebuild()} onPlay={()=>void playInGame()} installed={lastInstalled}/>}
    {dialog==='settings'&&<SettingsModal onClose={()=>setDialog(null)} onOpenPackager={()=>setDialog('packager')} onOpenOutput={()=>setDialog('output')}/>}
    {dialog==='reset'&&<StudioResetDialog onClose={()=>setDialog(null)}/>}
    
    {dialog==='about'&&<AboutModal key={helpStart.tab+(helpStart.cls??'')} onClose={closeHelp} initialTab={helpStart.tab} initialClass={helpStart.cls}/>}
    
    
    {dialog==='gameplay'&&(!isCS16?<GameplayStudio onClose={()=>setDialog(null)}/>:<CS16FeatureNotice onClose={()=>setDialog(null)}/>)}
    {dialog==='cinematic'&&(!isCS16?<CinematicCameraStudio onClose={()=>setDialog(null)}/>:<CS16FeatureNotice onClose={()=>setDialog(null)}/>)}
    {dialog==='npc'&&(!isCS16?<NPCStudio onClose={()=>setDialog(null)}/>:<CS16FeatureNotice onClose={()=>setDialog(null)}/>)}
    {dialog==='sound'&&(!isCS16?<SoundStudio onClose={()=>setDialog(null)}/>:<CS16FeatureNotice onClose={()=>setDialog(null)}/>)}
    {dialog==='lighting'&&(!isCS16?<LightingStudio onClose={()=>setDialog(null)} onPreview={()=>void compile('preview')}/>:<CS16FeatureNotice onClose={()=>setDialog(null)}/>)}
    {dialog==='doctor'&&(isCS16?<CS16CompatibilityStudio onClose={()=>setDialog(null)}/>:<MapDoctor onClose={()=>setDialog(null)}/>)}
    {dialog==='csMap'&&<CSMapStudio onClose={()=>setDialog(null)} bspMode={bspMode} walkMode={walkMode} onDoctor={()=>setDialog('doctor')}/>}
    {dialog==='packager'&&<MapPackagerStudio onClose={()=>setDialog(null)}/>}
    {dialog==='terrain'&&<TerrainShapeStudio initialTab={worldBuilderStart} onClose={()=>setDialog(null)}/>}
    {dialog==='workshop'&&<BrushWorkshop onClose={()=>setDialog(null)}/>}
    {dialog==='smartConnect'&&!bspMode&&!walkMode&&<SmartConnectPanel onClose={()=>setDialog(null)}/>}
    {dialog==='history'&&<ProjectHistoryModal onClose={()=>setDialog(null)} onRestore={restoreProjectFromHistory}/>}
    {dialog==='prefabs'&&<PrefabStudio onClose={()=>setDialog(null)} onImportPrefab={importPrefabFile} onStartPlacement={id=>{setWelcomeOpen(false);exitGameplayTest();setBspMode(false);setBspEditorActive(false);useEditor.getState().setPlacementPrefab(id)}}/>}
    {dialog==='blueprint'&&<BlueprintToMapStudio onClose={()=>setDialog(null)}/>}
    {dialog==='mission'&&(isCS16?<CS16FeatureNotice onClose={()=>setDialog(null)}/>:<MissionEventsStudio initialMode="mission" onClose={()=>setDialog(null)} onOpenPuzzle={()=>setDialog('puzzle')}/>)}
    {dialog==='events'&&(isCS16?<CS16FeatureNotice onClose={()=>setDialog(null)}/>:<MissionEventsStudio initialMode="events" onClose={()=>setDialog(null)}/>)}
    {dialog==='puzzle'&&(isCS16?<CS16FeatureNotice onClose={()=>setDialog(null)}/>:<CoopPuzzleStudio onClose={()=>setDialog('mission')}/>)}
    {dialog==='buildTogether'&&<BuildTogetherPanel onClose={()=>setDialog(null)}/>}
    </StudioOverlayRoot>
  </div>;
}
