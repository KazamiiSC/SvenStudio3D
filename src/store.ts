import { create } from 'zustand';
import type {ShadingMode} from './engine/shadingPie';
import { DEFAULT_CONTROLS,readControls,saveControls } from './engine/controls';
import type { ControlSettings,ShortcutAction } from './engine/controls';
import { createBrush, createPlaceableShape, boxFromGroundDrag, resizeBrush } from './engine/geometry';
import { uid } from './engine/types';
import {makeBrushEntity,makeRelay,connectGameplay,disconnectGameplay} from './engine/gameplay';
import {createWaypoint,makeNpcSpawner,DEFAULT_SPAWNER,type SpawnerOptions} from './engine/npc';
import {makeAudioEntity,type AudioEntityKind,type SoundOptions} from './engine/sound';
import {makeEnvironment,type EnvironmentKind} from './engine/environment';
import type { Brush,Face,FgdClass,MapObject,PointEntity,Project,TextureAsset,Vec3,PlaceableShape } from './engine/types';
import { starterEntities } from './engine/fgd';
import {editBrushVertices,splitBrush,hollowBox,pushPullFace} from './engine/modeling';
import {intersectConvex,subtractConvex,unionConvex,bevelEdge,taperInsetFace,extrudeFaceBrush} from './engine/advancedModeling';
import {createSkyEnclosure,type SkyEnclosureOptions} from './engine/skyEnclosure';
import {createMultipleWallOpenings,createArchitecture,type ArchitectureKind,type ArchitectureOptions,type OpeningPlacement} from './engine/architecture';
import {mergeIntoConvexBrush} from './engine/smartMerge';
import {createPrefab,placePrefab,validatePrefab,readPrefabLibrary,writePrefabLibrary,type Prefab} from './engine/prefabs';
import {preferredLocale,readLocalePreference,saveLocalePreference,systemLocale,type Locale,type LocalePreference} from './i18n';
import {textureSettings} from './engine/geometry';
import {DEFAULT_ENTITY_APPEARANCE,loadEntityAppearance,saveEntityAppearance,normalizeEntityAppearance,type EntityAppearanceSettings,type EntityColorKind} from './engine/entityAppearance';
export type ToolMode='select'|'translate'|'rotate'|'scale';
export type ResourceView='objects'|'entities'|'textures'|'models'|'npcs'|'sounds'|'layers';
export type Settings={compilerDir:string;gameDir:string;wadPaths:string;mapName:string};
export const DEFAULT_SETTINGS:Settings={compilerDir:'',gameDir:'',wadPaths:'',mapName:'svstudio_test'};
const BOX='SV_BRICK01';
function texBrush(b:Brush,t=BOX){return {...b,faces:b.faces.map(f=>({...f,texture:t}))};}
export function demoProject():Project{
  const floor=texBrush(createBrush('box',[0,0,-16],[544,544,32],'Floor'),'SV_TILE01');
  const roof=texBrush(createBrush('box',[0,0,288],[544,544,32],'Ceiling'),'SV_CONCRET');
  roof.hidden=true; // Hide only in editor so the room can be viewed from above; exported brush remains solid.
  const left=texBrush(createBrush('box',[-272,0,136],[32,544,288],'West Wall'));
  const right=texBrush(createBrush('box',[272,0,136],[32,544,288],'East Wall'));
  const north=texBrush(createBrush('box',[0,272,136],[512,32,288],'North Wall'));
  const south=texBrush(createBrush('box',[0,-272,136],[512,32,288],'South Wall'));
  const spawn:PointEntity={id:uid(),kind:'entity',name:'info_player_start',classname:'info_player_start',position:[0,0,48],props:{angles:'0 0 0'},layer:'Gameplay'};
  const light:PointEntity={id:uid(),kind:'entity',name:'light',classname:'light',position:[0,0,208],props:{_light:'255 240 210 350'},layer:'Lighting'};
  return {version:1,target:'svengine',name:'Untitled Map',world:{classname:'worldspawn',mapversion:'220',message:'Created with SvenStudio 3D',skyname:'desert'},wadNames:['svstudio.wad'],objects:[floor,roof,left,right,north,south,spawn,light]};
}
const clone=<T>(v:T):T=>structuredClone(v);
interface State{
  locale:Locale;localePreference:LocalePreference;setLocale:(locale:LocalePreference)=>void;
  geometryMode:'object'|'vertex'|'edge'|'face';editIndices:number[];setGeometryMode:(mode:'object'|'vertex'|'edge'|'face')=>void;selectEditIndices:(indices:number[])=>void;
  editVertices:(id:string,indices:number[],delta:Vec3)=>void;pushPullFace:(id:string,face:number,distance:number)=>void;clipSelected:(axis:0|1|2,at:number,side:'both'|'positive'|'negative')=>void;hollowSelected:(thickness:number)=>void;
  booleanSelected:(operation:'union'|'subtract'|'intersect')=>void;bevelSelected:(width:number)=>void;insetSelected:(width:number)=>void;extrudeSelected:(distance:number)=>void;
  groupSelected:(name:string)=>void;ungroupSelected:()=>void;selectGroup:(name:string)=>void;toggleGroupVisibility:(name:string)=>void;toggleGroupLocked:(name:string)=>void;
  prefabs:Prefab[];saveSelectedPrefab:(name:string)=>void;addPrefab:(prefab:Prefab)=>void;removePrefab:(id:string)=>void;instantiatePrefab:(id:string,position:Vec3)=>void;
  faceClipboard:Partial<Face>|null;copyFaceSettings:(id:string,index:number)=>void;pasteFaceSettings:(id:string,index:number)=>void;alignFaceTexture:(id:string,index:number)=>void;snapSelectionToGrid:()=>void;
  textureDragSnapshot:Project|null;beginTextureDrag:(id:string,faceIndex:number)=>void;updateTextureDrag:(id:string,faceIndex:number,u:number,v:number)=>void;updateTextureTransform:(id:string,faceIndex:number,mode:'rotate'|'scale',dx:number,dy:number)=>void;finishTextureDrag:(commit:boolean)=>void;
  project:Project; selected:string|null; selectedIds:string[]; selectedFace:number|null; mode:ToolMode;showTransformGizmo:boolean;setShowTransformGizmo:(enabled:boolean)=>void;activateGizmoMode:(mode:Exclude<ToolMode,'select'>)=>void;toggleShortcutGizmo:(mode:'rotate'|'scale')=>void; snap:number; snapping:boolean;
  scaleAnchor:'center'|'xmin'|'xmax'|'ymin'|'ymax'|'zmin'|'zmax';setScaleAnchor:(anchor:State['scaleAnchor'])=>void;
  modalTransform:{mode:Exclude<ToolMode,'select'>;serial:number}|null;modalFinish:{serial:number;commit:boolean}|null;
  toggleModalTransform:(mode:Exclude<ToolMode,'select'>)=>void;finishModalTransform:(commit:boolean)=>void;completeModalTransform:()=>void;
  showEntityNames:boolean;
  entityAppearance:EntityAppearanceSettings;
  setEntityAppearance:(changes:Partial<EntityAppearanceSettings>)=>void;
  setEntityColor:(kind:EntityColorKind,color:string)=>void;
  resetEntityAppearance:()=>void;
  environmentPlacement:{kind:EnvironmentKind;props:Record<string,string>}|null; environmentPreview:boolean; fogPreview:boolean; previewShadows:boolean;showLightRanges:boolean;
  setPreviewShadows:(enabled:boolean)=>void;setShowLightRanges:(enabled:boolean)=>void;
  setEnvironmentPreview:(enabled:boolean)=>void;setFogPreview:(enabled:boolean)=>void;
  startEnvironmentPlacement:(kind:EnvironmentKind|null,props?:Record<string,string>)=>void;placePendingEnvironment:(position:Vec3)=>void;
  audioPlacement:{classname:AudioEntityKind;file:string;options:Partial<SoundOptions>}|null;
  startAudioPlacement:(classname:AudioEntityKind|null,file?:string,options?:Partial<SoundOptions>)=>void;
  placePendingAudio:(position:Vec3)=>void;
  createAudioAt:(classname:AudioEntityKind,file:string,position:Vec3,options?:Partial<SoundOptions>)=>void;
  pendingNpcClass:string|null;routePlacementFor:string|null;routeSolo:string|null;setRouteSolo:(name:string|null)=>void;
  startNpcPlacement:(classname:string|null)=>void;startWaypointPlacement:(ownerId:string|null)=>void;
  placePendingNpc:(position:Vec3)=>void;placeWaypoint:(ownerId:string,position:Vec3)=>void;
  spawnFromNpc:(npcId:string,options?:SpawnerOptions)=>void;
  placementShape:PlaceableShape|null;
  setPlacementShape:(kind:PlaceableShape|null)=>void;
  placeShapeAt:(position:Vec3)=>void;
  drawMode:boolean; drawHeight:number;
  measureMode:boolean;measurement:{a:Vec3|null;b:Vec3|null};toggleMeasure:()=>void;measurePoint:(at:Vec3)=>void;
  controls:ControlSettings; flyMode:boolean; walkMode:boolean; cameraCommand:{action:ShortcutAction;serial:number}|null; cameraLabel:string;
  wireframe:boolean; solidShading:boolean; setShadingMode:(mode:ShadingMode)=>void; faceMode:boolean; showGrid:boolean; showLights:boolean; ghostHidden:boolean; toggleGhostHidden:()=>void; isolationSnapshot:Record<string,boolean>|null; toggleTemporaryIsolation:()=>void; hideSelection:()=>void;
  resourceView:ResourceView; textureAssets:TextureAsset[]; currentTexture:string;
  fgdClasses:FgdClass[]; fgdLoaded:boolean; history:Project[]; future:Project[];
  logs:string[]; compileBusy:boolean; settings:Settings;
  setMode:(m:ToolMode)=>void;setControls:(update:Partial<ControlSettings>)=>void;setShortcut:(action:ShortcutAction,binding:string)=>void;resetControls:()=>void;toggleFly:()=>void;setFly:(enabled:boolean)=>void;toggleWalk:()=>void;setWalk:(enabled:boolean)=>void;issueCameraCommand:(action:ShortcutAction)=>void;setSelected:(id:string|null,face?:number|null)=>void;selectObject:(id:string,additive:boolean,face?:number|null)=>void;
  setDrawMode:(enabled:boolean)=>void;setDrawHeight:(height:number)=>void;addDrawnBox:(from:Vec3,to:Vec3)=>void;
  moveSelection:(delta:Vec3)=>void;transformSelection:(updates:Record<string,{position:Vec3;rotation?:Vec3;scale?:Vec3}>)=>void;setCameraLabel:(label:string)=>void;changeDimensions:(id:string,size:Vec3)=>void;
  setSnap:(v:number)=>void;toggleSnap:()=>void;setFlag:(k:'wireframe'|'faceMode'|'showGrid'|'showLights'|'showEntityNames',v:boolean)=>void;
  setResourceView:(v:ResourceView)=>void;
  addBrush:(type:PlaceableShape)=>void;addEntity:(cls:FgdClass,position?:Vec3)=>void;
  buildArchitecture:(kind:ArchitectureKind,options:ArchitectureOptions)=>void;
  architecturePlacement:{kind:'door'|'window';options:ArchitectureOptions}|null;architectureHoverTarget:string|null;architecturePreviousMode:ToolMode|null;setArchitectureHoverTarget:(id:string|null)=>void;startArchitecturePlacement:(kind:'door'|'window'|null,options?:ArchitectureOptions)=>void;placeArchitectureOnWall:(wallId:string,at:Vec3,override?:ArchitectureOptions)=>void;
  smartMergeSelected:()=>void;mergeIntoOneSelected:()=>void;unmergeSmartSelected:()=>void;updateSelectedOpening:(options:ArchitectureOptions)=>void;createSelectedBrushEntity:(type:'func_wall'|'func_door')=>void;
  generateSkyEnclosure:(options:SkyEnclosureOptions)=>void;
  addObjects:(o:MapObject[])=>void;updateObject:(id:string,changes:Partial<MapObject>)=>void;
  changeFace:(id:string,face:number,changes:Partial<Face>)=>void;paintSelected:(texture:string)=>void;
  removeSelected:()=>void;duplicateSelected:()=>void;setObjectProp:(id:string,key:string,value:string)=>void;
  tieGameplayBrush:(id:string,type:'func_door'|'func_button')=>void;createGameplayRelay:(position:Vec3)=>void;addGameplayDemo:()=>void;
  connectGameplay:(from:string,to:string,replace?:boolean)=>void;disconnectGameplay:(from:string)=>void;setGraphPosition:(id:string,position:[number,number])=>void;
  changeWorld:(key:string,value:string)=>void;newProject:()=>void;loadProject:(p:Project)=>void;setName:(name:string)=>void;
  toggleVisibility:(id:string)=>void;toggleLocked:(id:string)=>void;toggleLayerVisibility:(layer:string)=>void;  setLayer:(id:string,layer:string)=>void;
  selectSameClass:(classname:string)=>void;selectSameLayer:(layer:string)=>void;isolateSelection:()=>void;revealAll:()=>void;unlockAll:()=>void;
  undo:()=>void;redo:()=>void;setTextures:(textures:TextureAsset[],wad:string)=>void;setFgd:(classes:FgdClass[])=>void;
  appendLogs:(lines:string[])=>void;clearLogs:()=>void;setCompileBusy:(b:boolean)=>void;setSettings:(s:Partial<Settings>)=>void;
}
const mutate=(state:State,objects:MapObject[]):Pick<State,'project'|'history'|'future'>=>({
  project:{...state.project,objects},history:[...state.history.slice(-70),clone(state.project)],future:[]
});
export const useEditor=create<State>((set,get)=>({
  locale:preferredLocale(),localePreference:readLocalePreference(),
  setLocale:localePreference=>set(()=>{saveLocalePreference(localePreference);return {localePreference,locale:localePreference==='auto'?systemLocale():localePreference}}),
  geometryMode:'object',editIndices:[],
  setGeometryMode:mode=>set({geometryMode:mode,faceMode:mode==='face',editIndices:[],selectedFace:null,mode:'select',drawMode:false}),
  selectEditIndices:editIndices=>set({editIndices,mode:'translate'}),
  editVertices:(id,indices,delta)=>set(s=>{
    const obj=s.project.objects.find(o=>o.id===id);
    if(!obj||obj.kind!=='brush'||obj.locked)throw Error('Select an unlocked brush.');
    const edited=editBrushVertices(obj,indices,delta);
    return {...mutate(s,s.project.objects.map(o=>o.id===id?edited:o)),editIndices:indices};
  }),
  pushPullFace:(id,face,distance)=>set(s=>{
    const obj=s.project.objects.find(o=>o.id===id);
    if(!obj||obj.kind!=='brush'||obj.locked)throw Error('Select an unlocked brush.');
    const edited=pushPullFace(obj,face,distance);
    return {...mutate(s,s.project.objects.map(o=>o.id===id?edited:o))};
  }),
  clipSelected:(axis,at,side)=>set(s=>{
    const obj=s.project.objects.find(o=>o.id===s.selected);
    if(!obj||obj.kind!=='brush'||obj.locked)throw Error('Select an unlocked brush.');
    const parts=splitBrush(obj,axis,at,side);
    return {...mutate(s,s.project.objects.flatMap(o=>o.id===obj.id?parts:[o])),selected:parts[0].id,selectedIds:parts.map(o=>o.id),selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false};
  }),
  hollowSelected:thickness=>set(s=>{
    const obj=s.project.objects.find(o=>o.id===s.selected);
    if(!obj||obj.kind!=='brush'||obj.locked)throw Error('Select an unlocked brush.');
    const parts=hollowBox(obj,thickness);
    return {...mutate(s,s.project.objects.flatMap(o=>o.id===obj.id?parts:[o])),selected:parts[0].id,selectedIds:parts.map(o=>o.id),selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false};
  }),
  booleanSelected:operation=>set(s=>{
    if(s.selectedIds.length!==2)throw Error('Select exactly two brushes with Shift+click. First = target; second = cutter.');
    const [a,b]=s.selectedIds.map(id=>s.project.objects.find(o=>o.id===id));
    if(!a||!b||a.kind!=='brush'||b.kind!=='brush'||a.locked||b.locked)throw Error('Select two unlocked brushes.');
    if(operation!=='subtract'&&a.entityId!==b.entityId)throw Error('Union/Intersect requires both brushes in the same world/entity.');
    const overlap=intersectConvex(a,b);
    if(!overlap)throw Error('These brushes do not intersect.');
    const result=operation==='union'?unionConvex(a,b):operation==='subtract'?subtractConvex(a,b):[{...overlap,name:`${a.name} Intersect`,entityId:a.entityId,layer:a.layer}];
    const removal=new Set([a.id,b.id]);
    return {...mutate(s,[...s.project.objects.filter(o=>!removal.has(o.id)),...result]),selected:result[0]?.id??null,selectedIds:result.map(o=>o.id),selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false};
  }),
  bevelSelected:width=>set(s=>{
    const brush=s.project.objects.find(o=>o.id===s.selected);
    if(!brush||brush.kind!=='brush'||brush.locked||s.editIndices.length!==2)throw Error('Select an unlocked brush edge in Edge mode.');
    const next=bevelEdge(brush,s.editIndices[0],s.editIndices[1],width);
    return {...mutate(s,s.project.objects.map(o=>o.id===brush.id?next:o)),selected:next.id,selectedIds:[next.id],editIndices:[],selectedFace:null,geometryMode:'object',faceMode:false};
  }),
  insetSelected:width=>set(s=>{
    const brush=s.project.objects.find(o=>o.id===s.selected);
    if(!brush||brush.kind!=='brush'||brush.locked||s.selectedFace===null)throw Error('Select an unlocked face in Face mode.');
    const next=taperInsetFace(brush,s.selectedFace,width);
    return {...mutate(s,s.project.objects.map(o=>o.id===brush.id?next:o)),selected:next.id,selectedIds:[next.id],editIndices:[],selectedFace:null,geometryMode:'object',faceMode:false};
  }),
  extrudeSelected:distance=>set(s=>{
    const brush=s.project.objects.find(o=>o.id===s.selected);
    if(!brush||brush.kind!=='brush'||brush.locked||s.selectedFace===null)throw Error('Select an unlocked brush face in Face mode.');
    const added=extrudeFaceBrush(brush,s.selectedFace,distance);
    return {...mutate(s,[...s.project.objects,added]),selected:added.id,selectedIds:[added.id],editIndices:[],selectedFace:null,geometryMode:'object',faceMode:false};
  }),
  groupSelected:name=>set(s=>{
    const label=name.trim().slice(0,64);
    if(!label||!s.selectedIds.length)throw Error('Select objects and enter a group name.');
    const selected=new Set(s.selectedIds);
    return {...mutate(s,s.project.objects.map(o=>selected.has(o.id)&&!o.locked?{...o,group:label}:o))};
  }),
  ungroupSelected:()=>set(s=>{
    if(!s.selectedIds.length)throw Error('Select one or more grouped objects.');
    const selected=new Set(s.selectedIds);
    return {...mutate(s,s.project.objects.map(o=>selected.has(o.id)&&!o.locked?{...o,group:undefined}:o))};
  }),
  selectGroup:name=>set(s=>{const ids=s.project.objects.filter(o=>o.group===name).map(o=>o.id);return {selected:ids.at(-1)??null,selectedIds:ids,selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false};}),
  toggleGroupVisibility:name=>set(s=>{
    const members=s.project.objects.filter(o=>o.group===name);
    const hidden=members.some(o=>!o.hidden);
    return {...mutate(s,s.project.objects.map(o=>o.group===name?{...o,hidden}:o))};
  }),
  toggleGroupLocked:name=>set(s=>{
    const members=s.project.objects.filter(o=>o.group===name);
    const locked=members.some(o=>!o.locked);
    return {...mutate(s,s.project.objects.map(o=>o.group===name?{...o,locked}:o))};
  }),
  faceClipboard:null,
  copyFaceSettings:(id,index)=>set(s=>{const obj=s.project.objects.find(o=>o.id===id);if(obj?.kind!=='brush'||!obj.faces[index])throw Error('Select a brush face.');return {faceClipboard:textureSettings(obj.faces[index])}}),
  pasteFaceSettings:(id,index)=>set(s=>{
    if(!s.faceClipboard)throw Error('Copy a face first.');
    const obj=s.project.objects.find(o=>o.id===id);if(obj?.kind!=='brush'||obj.locked||!obj.faces[index])throw Error('Select an unlocked brush face.');
    return {...mutate(s,s.project.objects.map(o=>o.id===id&&o.kind==='brush'?{...o,faces:o.faces.map((f,i)=>i===index?{...f,...clone(s.faceClipboard!)}:f)}:o))};
  }),
  alignFaceTexture:(id,index)=>set(s=>{
    const obj=s.project.objects.find(o=>o.id===id);
    if(obj?.kind!=='brush'||obj.locked||!obj.faces[index])throw Error('Select an unlocked brush face.');
    // Same offset on neighboring coplanar faces gives continuous Valve 220 world-space mapping.
    return {...mutate(s,s.project.objects.map(o=>o.id===id&&o.kind==='brush'?{...o,faces:o.faces.map((f,i)=>i===index?{...f,uShift:0,vShift:0}:f)}:o))};
  }),
  snapSelectionToGrid:()=>set(s=>{
    const grid=s.snap;if(!Number.isFinite(grid)||grid<=0)throw Error('Invalid grid size.');
    const ids=new Set(s.selectedIds);if(!ids.size)throw Error('Select one or more objects.');
    return {...mutate(s,s.project.objects.map(o=>ids.has(o.id)&&!o.locked?{...o,position:o.position.map(n=>Math.round(n/grid)*grid) as Vec3}:o))};
  }),
  textureDragSnapshot:null,
  beginTextureDrag:(id,faceIndex)=>set(s=>{
    const brush=s.project.objects.find(o=>o.id===id);
    if(!brush||brush.kind!=='brush'||brush.locked||!brush.faces[faceIndex])return {};
    return {textureDragSnapshot:clone(s.project)};
  }),
  updateTextureDrag:(id,faceIndex,u,v)=>set(s=>{
    const original=s.textureDragSnapshot?.objects.find(o=>o.id===id);
    if(!original||original.kind!=='brush'||!Number.isFinite(u)||!Number.isFinite(v))return {};
    const texture=original.faces[faceIndex];if(!texture)return {};
    const nextU=Math.round((texture.uShift??0)+u),nextV=Math.round((texture.vShift??0)+v);
    return {project:{...s.project,objects:s.project.objects.map(o=>o.id===id&&o.kind==='brush'?{...o,faces:o.faces.map((f,i)=>i===faceIndex?{...f,uShift:nextU,vShift:nextV}:f)}:o)}};
  }),
  updateTextureTransform:(id,faceIndex,mode,dx,dy)=>set(s=>{
    const original=s.textureDragSnapshot?.objects.find(o=>o.id===id);
    if(original?.kind!=='brush'||!Number.isFinite(dx)||!Number.isFinite(dy)||!original.faces[faceIndex])return {};
    const previous=original.faces[faceIndex];
    const settings=mode==='rotate'?{rotation:Math.round(((previous.rotation||0)+dx*.6)*10)/10}:{
      uScale:Math.max(.05,Math.min(32,Math.round((previous.uScale||1)*Math.exp(dx/220)*1000)/1000)),
      vScale:Math.max(.05,Math.min(32,Math.round((previous.vScale||1)*Math.exp(-dy/220)*1000)/1000))};
    return {project:{...s.project,objects:s.project.objects.map(o=>o.id===id&&o.kind==='brush'?{...o,faces:o.faces.map((f,i)=>i===faceIndex?{...f,...settings}:f)}:o)}};
  }),
  finishTextureDrag:commit=>set(s=>{
    const before=s.textureDragSnapshot;
    if(!before)return {};
    if(!commit)return {project:before,textureDragSnapshot:null};
    const changed=s.project.objects.some(o=>{
      if(o.kind!=='brush')return false;
      const previous=before.objects.find(b=>b.id===o.id);
      return previous?.kind==='brush'&&o.faces.some((f,i)=>f.uShift!==previous.faces[i]?.uShift||f.vShift!==previous.faces[i]?.vShift||f.rotation!==previous.faces[i]?.rotation||f.uScale!==previous.faces[i]?.uScale||f.vScale!==previous.faces[i]?.vScale);
    });
    return changed?{history:[...s.history.slice(-70),before],future:[],textureDragSnapshot:null}:{project:before,textureDragSnapshot:null};
  }),
  prefabs:readPrefabLibrary(),
  saveSelectedPrefab:name=>set(s=>{
    const selected=new Set(s.selectedIds);
    const prefab=createPrefab(s.project.objects.filter(o=>selected.has(o.id)),name);
    const prefabs=[...s.prefabs,prefab];writePrefabLibrary(prefabs);return {prefabs};
  }),
  addPrefab:prefab=>set(s=>{
    const valid=validatePrefab(prefab);
    const prefabs=[...s.prefabs,{...valid,id:uid()}];writePrefabLibrary(prefabs);return {prefabs};
  }),
  removePrefab:id=>set(s=>{const prefabs=s.prefabs.filter(p=>p.id!==id);writePrefabLibrary(prefabs);return {prefabs};}),
  instantiatePrefab:(id,position)=>set(s=>{
    const prefab=s.prefabs.find(p=>p.id===id);if(!prefab)throw Error('Prefab not found.');
    const copies=placePrefab(prefab,position);
    return {...mutate(s,[...s.project.objects,...copies]),selected:copies.at(-1)!.id,selectedIds:copies.map(o=>o.id),selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false};
  }),
  measureMode:false,measurement:{a:null,b:null},
  toggleMeasure:()=>set(s=>({measureMode:!s.measureMode,drawMode:false,placementShape:null,mode:'select',flyMode:false,geometryMode:'object',faceMode:false})),
  measurePoint:at=>set(s=>{
    if(!s.measureMode||at.some(n=>!Number.isFinite(n)))return {};
    const point=at.map(n=>s.snapping?Math.round(n/s.snap)*s.snap:Math.round(n*100)/100) as Vec3;
    return {measurement:!s.measurement.a||s.measurement.b?{a:point,b:null}:{a:s.measurement.a,b:point}};
  }),
  project:demoProject(),selected:null,selectedIds:[],selectedFace:null,mode:'select',showTransformGizmo:(()=>{try{return localStorage.getItem('svenstudio:gizmo-visible')!=='false'}catch{return true}})(),setShowTransformGizmo:enabled=>set(()=>{try{localStorage.setItem('svenstudio:gizmo-visible',String(enabled))}catch{}return {showTransformGizmo:enabled}}),activateGizmoMode:mode=>set({mode,walkMode:false,measureMode:false,showTransformGizmo:true,geometryMode:'object',faceMode:false,editIndices:[],drawMode:false,placementShape:null,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,flyMode:false,modalTransform:null,modalFinish:null,architecturePlacement:null,architectureHoverTarget:null,architecturePreviousMode:null}),
  // Keyboard R/C uses the *persistent* gizmo, not the mouse-follow modal tool.
  // Pressing the same shortcut again returns to normal selection and hides it.
  // No project/history mutation is performed until the user drags a gizmo handle.
  toggleShortcutGizmo:requested=>set(s=>{
    if(s.mode===requested&&s.showTransformGizmo&&!s.modalTransform)return {mode:'select',showTransformGizmo:false};
    return {mode:requested,showTransformGizmo:true,walkMode:false,measureMode:false,geometryMode:'object',faceMode:false,editIndices:[],drawMode:false,placementShape:null,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,flyMode:false,modalTransform:null,modalFinish:null,architecturePlacement:null,architectureHoverTarget:null,architecturePreviousMode:null};
  }),snap:16,snapping:true,scaleAnchor:(()=>{try{const stored=localStorage.getItem('svenstudio:scale-anchor');return ['center','xmin','xmax','ymin','ymax','zmin','zmax'].includes(stored||'')?stored as State['scaleAnchor']:'center'}catch{return 'center'}})(),setScaleAnchor:scaleAnchor=>set(()=>{try{localStorage.setItem('svenstudio:scale-anchor',scaleAnchor)}catch{}return {scaleAnchor}}),drawMode:false,drawHeight:128,
  environmentPlacement:null,environmentPreview:false,fogPreview:true,previewShadows:false,showLightRanges:false,
  setEnvironmentPreview:enabled=>set({environmentPreview:enabled,solidShading:enabled?false:get().solidShading}),setFogPreview:enabled=>set({fogPreview:enabled}),
  setPreviewShadows:enabled=>set({previewShadows:enabled}),setShowLightRanges:enabled=>set({showLightRanges:enabled}),
  startEnvironmentPlacement:(kind,props={})=>set({environmentPlacement:kind?{kind,props}:null,audioPlacement:null,placementShape:null,pendingNpcClass:null,routePlacementFor:null,drawMode:false,mode:'select',flyMode:false}),
  placePendingEnvironment:position=>set(s=>{if(!s.environmentPlacement)return {};const entity=makeEnvironment(s.environmentPlacement.kind,position,s.environmentPlacement.props);return {...mutate(s,[...s.project.objects,entity]),selected:entity.id,selectedIds:[entity.id],environmentPlacement:null}}),
  wireframe:false,solidShading:false,setShadingMode:mode=>set({
    wireframe:mode==='wireframe',solidShading:mode==='solid',environmentPreview:mode==='rendered'
  }),faceMode:false,showGrid:true,showLights:true,showEntityNames:true,entityAppearance:loadEntityAppearance(),placementShape:null,pendingNpcClass:null,routePlacementFor:null,routeSolo:null,audioPlacement:null,
  modalTransform:null,modalFinish:null,
  controls:readControls(),flyMode:false,walkMode:false,cameraCommand:null,cameraLabel:'Perspective',
  resourceView:'objects',textureAssets:[],currentTexture:BOX,fgdClasses:starterEntities,fgdLoaded:false,
  history:[],future:[],logs:['SvenStudio 3D initialized.','Import a real .WAD and .FGD for full texture/entity access.'],compileBusy:false,
  settings:(()=>{try{return {...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem('svenstudio-settings')||'{}')}}catch{return DEFAULT_SETTINGS}})(),
  setEntityAppearance:changes=>set(s=>{const settings=normalizeEntityAppearance({...s.entityAppearance,...changes});saveEntityAppearance(settings);return {entityAppearance:settings}}),
  setEntityColor:(kind,color)=>set(s=>{const settings=normalizeEntityAppearance({...s.entityAppearance,colors:{...s.entityAppearance.colors,[kind]:color}});saveEntityAppearance(settings);return {entityAppearance:settings}}),
  resetEntityAppearance:()=>set(()=>{const entityAppearance=structuredClone(DEFAULT_ENTITY_APPEARANCE);saveEntityAppearance(entityAppearance);return {entityAppearance}}),
  setPlacementShape:placementShape=>set({measureMode:false,walkMode:false,placementShape,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,drawMode:false,mode:'select',flyMode:false,modalTransform:null,modalFinish:null,geometryMode:'object',faceMode:false}),
  placeShapeAt:ground=>set(s=>{
    if(!s.placementShape||ground.some(v=>!Number.isFinite(v)))return {};
    const snap=s.snapping?s.snap:1;
    const position=ground.map(v=>Math.round(v/snap)*snap) as Vec3;
    const additions=createPlaceableShape(s.placementShape,position,s.currentTexture);
    return {...mutate(s,[...s.project.objects,...additions]),selected:additions[0].id,selectedIds:additions.map(b=>b.id),selectedFace:null,placementShape:null};
  }),
  setMode:mode=>set(s=>({mode:s.mode===mode?'select':mode,walkMode:false,measureMode:false,drawMode:false,placementShape:null,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,flyMode:false,modalTransform:null,modalFinish:null,architecturePlacement:null,architectureHoverTarget:null,architecturePreviousMode:null})),
  toggleModalTransform:mode=>set(s=>{
    if(s.modalTransform)return {modalFinish:{serial:(s.modalFinish?.serial||0)+1,commit:s.modalTransform.mode===mode}};
    if(!s.selectedIds.some(id=>s.project.objects.some(o=>o.id===id&&!o.locked&&!o.hidden))||s.geometryMode!=='object')return {};
    return {modalTransform:{mode,serial:Date.now()},modalFinish:null,mode:'select',flyMode:false,drawMode:false};
  }),
  finishModalTransform:commit=>set(s=>s.modalTransform?{modalFinish:{serial:(s.modalFinish?.serial||0)+1,commit}}:{}),
  completeModalTransform:()=>set({modalTransform:null,modalFinish:null}),
  setControls:update=>set(s=>{const controls={...s.controls,...update};saveControls(controls);return {controls}}),
  setShortcut:(action,binding)=>set(s=>{
    const shortcuts={...s.controls.shortcuts};
    // Keep bindings unambiguous: reassigning a key clears its old command.
    for(const id of Object.keys(shortcuts) as ShortcutAction[])if(id!==action&&shortcuts[id]===binding)shortcuts[id]='';
    shortcuts[action]=binding;
    const controls={...s.controls,shortcuts};saveControls(controls);return {controls};
  }),
  resetControls:()=>set(()=>{const controls=structuredClone(DEFAULT_CONTROLS);saveControls(controls);return {controls,flyMode:false}}),
  toggleFly:()=>set(s=>({flyMode:!s.flyMode,walkMode:false,mode:'select',drawMode:false})),
  setFly:flyMode=>set(s=>({flyMode,walkMode:flyMode?false:s.walkMode})),
  toggleWalk:()=>useEditor.getState().setWalk(!useEditor.getState().walkMode),
  setWalk:walkMode=>set(walkMode?{
    walkMode:true,flyMode:false,modalTransform:null,modalFinish:null,
    drawMode:false,measureMode:false,placementShape:null,architecturePlacement:null,
    audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,
    mode:'select',geometryMode:'object',faceMode:false
  }:{walkMode:false}),
  issueCameraCommand:action=>set(s=>({cameraCommand:{action,serial:(s.cameraCommand?.serial||0)+1}})),
  setCameraLabel:cameraLabel=>set({cameraLabel}),
  setSelected:(selected,selectedFace=null)=>set({selected,selectedIds:selected?[selected]:[],selectedFace,editIndices:[]}),
  selectObject:(id,additive,selectedFace=null)=>set(s=>{
    // Preserve an existing multi-selection while grabbing a selected brush or
    // the group gizmo. Click an unselected object or empty space to reset it.
    if(!additive){
      // Re-clicking the already-selected brush must not remount/reset the
      // transform gizmo under the pointer on mouseDown.
      if(s.selectedIds.length===1&&s.selected===id&&s.selectedFace===selectedFace)return {};
      if(s.selectedIds.length>1&&s.selectedIds.includes(id))return {};
      const target=s.project.objects.find(o=>o.id===id);
      if(target?.group?.startsWith('Smart Merge ')&&s.geometryMode==='object'){
        const ids=s.project.objects.filter(o=>o.group===target.group).map(o=>o.id);
        return {selected:id,selectedIds:ids,selectedFace:null,editIndices:[]};
      }
      return {selected:id,selectedIds:[id],selectedFace,editIndices:[]};
    }
    const ids=s.selectedIds.includes(id)?s.selectedIds.filter(x=>x!==id):[...s.selectedIds,id];
    return {selected:ids.at(-1)??null,selectedIds:ids,selectedFace:ids.length===1?selectedFace:null,editIndices:[]};
  }),
  setDrawMode:drawMode=>set({measureMode:false,walkMode:false,drawMode,placementShape:null,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,mode:'select',flyMode:false,selected:null,selectedIds:[],selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false}),
  setDrawHeight:height=>set({drawHeight:Math.max(1,Math.min(131072,height))}),
  addDrawnBox:(from,to)=>set(s=>{
    const brush=boxFromGroundDrag(from,to,s.drawHeight,s.snapping?s.snap:1,s.currentTexture);
    return {...mutate(s,[...s.project.objects,brush]),selected:brush.id,selectedIds:[brush.id],selectedFace:null};
  }),
  moveSelection:delta=>set(s=>{
    const ids=new Set(s.selectedIds);
    if(!ids.size||!delta.every(Number.isFinite)||delta.every(v=>Math.abs(v)<0.001))return {};
    const objects=s.project.objects.map(o=>ids.has(o.id)&&!o.locked?{...o,position:o.position.map((v,i)=>v+delta[i]) as Vec3}:o);
    return {...mutate(s,objects)};
  }),
  transformSelection:updates=>set(s=>{
    const ids=new Set(s.selectedIds);let modified=false;
    const objects=s.project.objects.map(o=>{
      const change=updates[o.id];if(!ids.has(o.id)||o.locked||!change)return o;
      if(!change.position.every(Number.isFinite)||change.rotation?.some(x=>!Number.isFinite(x))||change.scale?.some(x=>!Number.isFinite(x)||x<.05))return o;
      modified=true;
      return {...o,position:change.position,...(o.kind==='brush'&&change.rotation?{rotation:change.rotation}:{}),...(o.kind==='brush'&&change.scale?{scale:change.scale}:{})};
    });
    return modified?{...mutate(s,objects)}:{};
  }),
  changeDimensions:(id,size)=>set(s=>({...mutate(s,s.project.objects.map(o=>o.id===id&&o.kind==='brush'?resizeBrush(o,size):o))})),
  setSnap:snap=>set({snap:[1,2,4,8,16,32,64,128,256].includes(snap)?snap:16}),toggleSnap:()=>set(s=>({snapping:!s.snapping})),
  setFlag:(key,value)=>set(key==='faceMode'?{faceMode:value,geometryMode:value?'face':'object',editIndices:[]}:key==='wireframe'?{wireframe:value,solidShading:value?false:get().solidShading}:{[key]:value}),setResourceView:resourceView=>set({resourceView}),
  startAudioPlacement:(classname,file='',options={})=>set({environmentPlacement:null,audioPlacement:classname?{classname,file,options}:null,pendingNpcClass:null,routePlacementFor:null,placementShape:null,drawMode:false,mode:'select',geometryMode:'object',flyMode:false}),
  placePendingAudio:position=>set(s=>{
    if(!s.audioPlacement)return {};
    const {classname,file,options}=s.audioPlacement;
    const entity=makeAudioEntity(classname,position,file,options);
    return {...mutate(s,[...s.project.objects,entity]),selected:entity.id,selectedIds:[entity.id],audioPlacement:null};
  }),
  createAudioAt:(classname,file,position,options={})=>set(s=>{
    const entity=makeAudioEntity(classname,position,file,options);
    return {...mutate(s,[...s.project.objects,entity]),selected:entity.id,selectedIds:[entity.id]};
  }),
  startNpcPlacement:classname=>set({environmentPlacement:null,pendingNpcClass:classname,routePlacementFor:null,audioPlacement:null,placementShape:null,drawMode:false,mode:'select',geometryMode:'object',flyMode:false}),
  setRouteSolo:routeSolo=>set({routeSolo}),
  startWaypointPlacement:ownerId=>set({environmentPlacement:null,routePlacementFor:ownerId,pendingNpcClass:null,audioPlacement:null,placementShape:null,drawMode:false,mode:'select',geometryMode:'object',flyMode:false}),
  placePendingNpc:position=>{const s=get();const classname=s.pendingNpcClass;const def=s.fgdClasses.find(c=>c.name===classname);if(!def||def.type!=='point')throw Error('This NPC is not in the loaded FGD.');s.addEntity(def,position);set({pendingNpcClass:null});},
  placeWaypoint:(ownerId,position)=>set(s=>{const result=createWaypoint(s.project.objects,ownerId,position);return {...mutate(s,result.objects),selected:result.id,selectedIds:[result.id],resourceView:'npcs'};}),
  spawnFromNpc:(npcId,options=DEFAULT_SPAWNER)=>set(s=>{const result=makeNpcSpawner(s.project.objects,npcId,options);return {...mutate(s,result.objects),selected:result.id,selectedIds:[result.id],resourceView:'npcs'};}),
  // Backwards-compatible entry point: clicking any shape enters placement
  // rather than spawning geometry at the world origin.
  addBrush:type=>set({placementShape:type,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,drawMode:false,mode:'select',flyMode:false,geometryMode:'object',faceMode:false}),
  addEntity:(cls,position)=>set(s=>{
    if(cls.type==='solid'){
      const brush=s.project.objects.find(o=>o.id===s.selected&&o.kind==='brush') as Brush|undefined;
      if(!brush){alert(`Select a brush first, then click ${cls.name} to tie it to a brush entity.`);return {};}
      const e:PointEntity={id:uid(),kind:'entity',name:cls.name,classname:cls.name,position:[...brush.position],props:Object.fromEntries(Object.entries(cls.props).filter(([,v])=>v.defaultValue!==undefined).map(([k,v])=>[k,v.defaultValue!])),layer:'Gameplay'};
      return {...mutate(s,[...s.project.objects.map(o=>o.id===brush.id?{...o,entityId:e.id}:o),e]),selected:brush.id,selectedIds:[brush.id],selectedFace:null};
    }
    const p:PointEntity={id:uid(),kind:'entity',name:cls.name,classname:cls.name,position:position||[0,0,64],props:Object.fromEntries(Object.entries(cls.props).filter(([,v])=>v.defaultValue!==undefined).map(([k,v])=>[k,v.defaultValue!])),layer:'Gameplay'};
    return {...mutate(s,[...s.project.objects,p]),selected:p.id,selectedIds:[p.id],selectedFace:null};
  }),
  architecturePlacement:null,
  architectureHoverTarget:null,
  architecturePreviousMode:null,
  setArchitectureHoverTarget:id=>set(s=>s.architectureHoverTarget===id?{}:{architectureHoverTarget:id}),
  startArchitecturePlacement:(kind,options)=>set(s=>({
    architecturePlacement:kind?{kind,options:clone(options??{width:96,height:128,depth:24,frame:8,steps:8,cutOnly:false,doorLeaf:false})}:null,
    architecturePreviousMode:kind?(s.architecturePreviousMode??s.mode):null,
    architectureHoverTarget:null,
    placementShape:null,drawMode:false,geometryMode:'object',faceMode:false,
    mode:kind?'select':(s.architecturePreviousMode??'translate')
  })),
  placeArchitectureOnWall:(wallId,at,override)=>set(s=>{
    if(!s.architecturePlacement)throw Error('Choose Door or Window placement first.');
    const hit=s.project.objects.find(o=>o.id===wallId);
    if(!hit||hit.kind!=='brush')throw Error('Point to a wall brush.');
    const oldRecords=s.project.architectureOpenings||[];
    const related=oldRecords.filter(r=>r.memberIds.includes(wallId));
    const original=related.length?related[0].wall:hit;
    const sameWall=oldRecords.filter(r=>r.wall.id===original.id);
    const options=override??s.architecturePlacement.options;
    const opening={id:uid(),kind:s.architecturePlacement.kind,wall:clone(original),center:[...at] as Vec3,options:clone(options)};
    const all=[...sameWall,opening];
    const rebuilt=createMultipleWallOpenings(original,all,s.currentTexture||'SV_BRICK01');
    const removed=new Set(sameWall.flatMap(r=>r.memberIds));
    if(!sameWall.length)removed.add(hit.id);
    const base=mutate(s,[...s.project.objects.filter(o=>!removed.has(o.id)),...rebuilt.objects]);
    const newRecords=all.map((record,index)=>({...record,wall:clone(original),memberIds:rebuilt.memberIds[index]}));
    const preserved=oldRecords.filter(r=>r.wall.id!==original.id);
    const selectedIds=rebuilt.memberIds.at(-1)||[];
    return {...base,project:{...base.project,architectureOpenings:[...preserved,...newRecords]},
      selected:selectedIds[0]||null,selectedIds,architecturePlacement:null,
      architectureHoverTarget:null,architecturePreviousMode:null,
      mode:s.architecturePreviousMode==='rotate'||s.architecturePreviousMode==='scale'?s.architecturePreviousMode:'translate',selectedFace:null};
  }),
  updateSelectedOpening:(options)=>set(s=>{
    const existing=s.project.architectureOpenings||[];
    const record=[...existing].reverse().find(r=>r.memberIds.includes(s.selected||''));
    if(!record)throw Error('Select a part of an interactively placed door or window.');
    const sameWall=existing.filter(r=>r.wall.id===record.wall.id);
    const updated=sameWall.map(r=>r.id===record.id?{...r,options:clone(options)}:r);
    const rebuilt=createMultipleWallOpenings(record.wall,updated,s.currentTexture||'SV_BRICK01');
    const removed=new Set(sameWall.flatMap(r=>r.memberIds));
    const base=mutate(s,[...s.project.objects.filter(o=>!removed.has(o.id)),...rebuilt.objects]);
    const newRecords=updated.map((r,index)=>({...r,memberIds:rebuilt.memberIds[index]}));
    const selectedIds=rebuilt.memberIds[updated.findIndex(r=>r.id===record.id)]||[];
    return {...base,project:{...base.project,architectureOpenings:[...existing.filter(r=>r.wall.id!==record.wall.id),...newRecords]},
      selected:selectedIds[0]||null,selectedIds,selectedFace:null};
  }),
  createSelectedBrushEntity:(type)=>set(s=>{
    const ids=new Set(s.selectedIds);
    const brushes=s.project.objects.filter((o):o is Brush=>ids.has(o.id)&&o.kind==='brush');
    if(brushes.length!==ids.size||!brushes.length||brushes.some(b=>b.locked||b.entityId))throw Error('Select unlocked world brushes only.');
    const id=uid();const position:Vec3=[0,1,2].map(i=>brushes.reduce((sum,b)=>sum+b.position[i],0)/brushes.length) as Vec3;
    const e:PointEntity={id,kind:'entity',name:type,classname:type,position,props:{classname:type},layer:'Gameplay'};
    const objects=s.project.objects.map(o=>ids.has(o.id)&&o.kind==='brush'?{...o,entityId:id}:o);
    return {...mutate(s,[...objects,e]),selected:id,selectedIds:[id],selectedFace:null};
  }),
  smartMergeSelected:()=>set(s=>{
    const ids=new Set(s.selectedIds);const members=s.project.objects.filter(o=>ids.has(o.id));
    if(members.length<2||members.some(o=>o.kind!=='brush'||o.locked))throw Error('Select at least two unlocked brushes.');
    const group=`Smart Merge ${uid().slice(0,8)}`;
    return {...mutate(s,s.project.objects.map(o=>ids.has(o.id)?{...o,group}:o))};
  }),
  unmergeSmartSelected:()=>set(s=>{
    const group=s.project.objects.find(o=>o.id===s.selected)?.group;
    if(!group||!group.startsWith('Smart Merge '))throw Error('Select a Smart Merge member.');
    return {...mutate(s,s.project.objects.map(o=>o.group===group?{...o,group:undefined}:o))};
  }),
  mergeIntoOneSelected:()=>set(s=>{
    const ids=new Set(s.selectedIds);const members=s.project.objects.filter((o):o is Brush=>ids.has(o.id)&&o.kind==='brush');
    if(members.length!==ids.size)throw Error('Select only brushes.');
    const merged=mergeIntoConvexBrush(members);
    return {...mutate(s,[...s.project.objects.filter(o=>!ids.has(o.id)),merged]),selected:merged.id,selectedIds:[merged.id],selectedFace:null,geometryMode:'object',faceMode:false};
  }),
  buildArchitecture:(kind,options)=>set(s=>{
    const obj=s.project.objects.find(o=>o.id===s.selected);
    const wall=obj?.kind==='brush'?obj:null;
    const outcome=createArchitecture(kind,options,wall,s.currentTexture||'SV_BRICK01');
    const next=[...s.project.objects.filter(o=>o.id!==outcome.removeId),...outcome.objects];
    const ids=outcome.objects.map(o=>o.id);
    return {...mutate(s,next),selected:ids.at(-1)||null,selectedIds:ids,
      selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false};
  }),
  generateSkyEnclosure:options=>set(s=>{
    const output=createSkyEnclosure(s.project.objects,options);
    return {...mutate(s,output.objects),selected:null,selectedIds:[],selectedFace:null};
  }),
  addObjects:objects=>set(s=>({...mutate(s,[...s.project.objects,...objects]),selected:objects[0]?.id||s.selected,selectedIds:objects.length?[objects[0].id]:s.selectedIds})),
  updateObject:(id,changes)=>set(s=>({...mutate(s,s.project.objects.map(o=>o.id===id?{...o,...changes} as MapObject:o))})),
  changeFace:(id,index,changes)=>set(s=>({...mutate(s,s.project.objects.map(o=>o.id===id&&o.kind==='brush'?{...o,faces:o.faces.map((f,i)=>i===index?{...f,...changes}:f)}:o))})),
  paintSelected:texture=>set(s=>{
    if(!s.selected)return {currentTexture:texture};
    const objects=s.project.objects.map(o=>{
      if(o.id!==s.selected||o.kind!=='brush')return o;
      return {...o,faces:o.faces.map((f,i)=>s.faceMode&&s.selectedFace!==null&&s.selectedFace!==i?f:{...f,texture})};
    });
    return {...mutate(s,objects),currentTexture:texture};
  }),
  removeSelected:()=>set(s=>!s.selectedIds.length?{}:(()=>{
    const ids=new Set(s.selectedIds);
    const base=mutate(s,s.project.objects.filter(o=>!ids.has(o.id)&&!(o.kind==='brush'&&o.entityId&&ids.has(o.entityId))));
    return {...base,project:{...base.project,architectureOpenings:s.project.architectureOpenings?.filter(r=>!r.memberIds.some(id=>ids.has(id)))},selected:null,selectedIds:[],selectedFace:null};
  })()),
  duplicateSelected:()=>set(s=>{
    const originals=s.project.objects.filter(o=>s.selectedIds.includes(o.id)&&!o.locked);
    if(!originals.length)return {};
    const idMap=new Map(originals.map(o=>[o.id,uid()]));
    const copies=originals.map(original=>{
      const copy=clone(original);
      copy.id=idMap.get(original.id)!;copy.name+=' Copy';
      copy.position=[copy.position[0]+32,copy.position[1]+32,copy.position[2]];
      if(copy.kind==='brush'&&copy.entityId&&idMap.has(copy.entityId))copy.entityId=idMap.get(copy.entityId);
      return copy;
    });
    return {...mutate(s,[...s.project.objects,...copies]),selected:copies.at(-1)!.id,selectedIds:copies.map(o=>o.id),selectedFace:null};
  }),
  setObjectProp:(id,key,value)=>set(s=>({...mutate(s,s.project.objects.map(o=>o.id===id&&o.kind==='entity'?{...o,props:{...o.props,[key]:value}}:o))})),
  tieGameplayBrush:(id,type)=>set(s=>{const result=makeBrushEntity(s.project.objects,id,type);return {...mutate(s,result.objects),selected:result.id,selectedIds:[result.id],resourceView:'entities'};}),
  createGameplayRelay:position=>set(s=>{const result=makeRelay(s.project.objects,position);return {...mutate(s,result.objects),selected:result.id,selectedIds:[result.id]};}),
  addGameplayDemo:()=>set(s=>{
    const door=texBrush(createBrush('box',[130,80,64],[64,16,128],'Gameplay Door'),'SV_METAL01');door.layer='Gameplay';
    const button=texBrush(createBrush('box',[-130,80,56],[32,12,32],'Gameplay Button'),'SV_METAL01');button.layer='Gameplay';
    let objects:MapObject[]=[...s.project.objects,door,button];
    const d=makeBrushEntity(objects,door.id,'func_door');objects=d.objects;
    const b=makeBrushEntity(objects,button.id,'func_button');objects=b.objects;
    const r=makeRelay(objects,[0,80,96]);objects=r.objects;
    objects=connectGameplay(objects,b.id,r.id);objects=connectGameplay(objects,r.id,d.id);
    return {...mutate(s,objects),selected:button.id,selectedIds:[button.id],resourceView:'entities'};
  }),
  connectGameplay:(from,to,replace=false)=>set(s=>({...mutate(s,connectGameplay(s.project.objects,from,to,replace)),selected:from,selectedIds:[from]})),
  disconnectGameplay:from=>set(s=>({...mutate(s,disconnectGameplay(s.project.objects,from)),selected:from,selectedIds:[from]})),
  setGraphPosition:(id,position)=>set(s=>({project:{...s.project,graphPositions:{...s.project.graphPositions,[id]:position}}})),
  changeWorld:(key,value)=>set(s=>({project:{...s.project,world:{...s.project.world,[key]:value}},history:[...s.history.slice(-70),clone(s.project)],future:[]})),
  newProject:()=>set({isolationSnapshot:null,project:demoProject(),placementShape:null,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,routeSolo:null,selected:null,selectedIds:[],selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false,history:[],future:[]}),
  loadProject:project=>set({walkMode:false,flyMode:false,architecturePlacement:null,architectureHoverTarget:null,architecturePreviousMode:null,isolationSnapshot:null,project:clone(project),placementShape:null,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,routeSolo:null,selected:null,selectedIds:[],selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false,history:[],future:[]}),
  setName:name=>set(s=>({project:{...s.project,name}})),
  toggleVisibility:id=>set(s=>({...mutate(s,s.project.objects.map(o=>o.id===id?{...o,hidden:!o.hidden}:o))})),
  toggleLocked:id=>set(s=>({...mutate(s,s.project.objects.map(o=>o.id===id?{...o,locked:!o.locked}:o))})),
  toggleLayerVisibility:layer=>set(s=>{
    const layerObjects=s.project.objects.filter(o=>(o.layer||'Geometry')===layer);
    const shouldHide=layerObjects.some(o=>!o.hidden);
    return {...mutate(s,s.project.objects.map(o=>(o.layer||'Geometry')===layer?{...o,hidden:shouldHide}:o))};
  }),
  setLayer:(id,layer)=>set(s=>({...mutate(s,s.project.objects.map(o=>o.id===id?{...o,layer}:o))})),
  selectSameClass:classname=>set(s=>{
    const ids=s.project.objects.filter(o=>o.kind==='entity'&&o.classname===classname).map(o=>o.id);
    return {selected:ids.at(-1)??null,selectedIds:ids,selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false};
  }),
  selectSameLayer:layer=>set(s=>{
    const ids=s.project.objects.filter(o=>(o.layer||'Geometry')===layer).map(o=>o.id);
    return {selected:ids.at(-1)??null,selectedIds:ids,selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false};
  }),
  ghostHidden:false, isolationSnapshot:null,
  toggleGhostHidden:()=>set(s=>({ghostHidden:!s.ghostHidden})),
  hideSelection:()=>set(s=>s.selectedIds.length?{...mutate(s,s.project.objects.map(o=>s.selectedIds.includes(o.id)?{...o,hidden:true}:o)),selected:null,selectedIds:[]}:{}),
  toggleTemporaryIsolation:()=>set(s=>{
    if(s.isolationSnapshot){const snapshot=s.isolationSnapshot;return {...mutate(s,s.project.objects.map(o=>({...o,hidden:snapshot[o.id]??!!o.hidden}))),isolationSnapshot:null};}
    if(!s.selectedIds.length)return {};
    const ids=new Set(s.selectedIds),snapshot=Object.fromEntries(s.project.objects.map(o=>[o.id,!!o.hidden]));
    return {...mutate(s,s.project.objects.map(o=>({...o,hidden:!ids.has(o.id)}))),isolationSnapshot:snapshot};
  }),
  isolateSelection:()=>set(s=>{
    if(!s.selectedIds.length)return {};
    const ids=new Set(s.selectedIds);
    if(s.project.objects.every(o=>!!o.hidden===!ids.has(o.id)))return {};
    return {...mutate(s,s.project.objects.map(o=>({...o,hidden:!ids.has(o.id)})))};
  }),
  revealAll:()=>set(s=>s.project.objects.some(o=>o.hidden)?{
    ...mutate(s,s.project.objects.map(o=>o.hidden?{...o,hidden:false}:o)),isolationSnapshot:null}:{}),
  unlockAll:()=>set(s=>s.project.objects.some(o=>o.locked)?{
    ...mutate(s,s.project.objects.map(o=>o.locked?{...o,locked:false}:o))}:{}),
  undo:()=>set(s=>!s.history.length?{}:{project:s.history.at(-1)!,history:s.history.slice(0,-1),future:[clone(s.project),...s.future.slice(0,70)]}),
  redo:()=>set(s=>!s.future.length?{}:{project:s.future[0],future:s.future.slice(1),history:[...s.history,clone(s.project)]}),
  setTextures:(assets,wad)=>set(s=>({textureAssets:[...s.textureAssets.filter(t=>t.wad!==wad),...assets],project:{...s.project,wadNames:[...new Set([...s.project.wadNames,wad])]}})),
  setFgd:classes=>set({fgdClasses:classes,fgdLoaded:true}),
  appendLogs:lines=>set(s=>({logs:[...s.logs,...lines].slice(-1500)})),clearLogs:()=>set({logs:[]}),
  setCompileBusy:compileBusy=>set({compileBusy}),
  setSettings:changes=>set(s=>{const settings={...s.settings,...changes};localStorage.setItem('svenstudio-settings',JSON.stringify(settings));return {settings}})
}));

