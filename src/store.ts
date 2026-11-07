import { create } from 'zustand';
import {loadEditStep,saveEditStep,loadVisibleGridStep,saveVisibleGridStep,normalizeGridStep} from './engine/gridPrecision';
import {createRockCluster,createTerrainBrushes,terrainBrushSignature,terrainRecord,type TerrainDraft,type RockOptions} from './engine/terrain';
import {constrainDecalToBrush} from './engine/decalSurface';
import type {ShadingMode} from './engine/shadingPie';
import { DEFAULT_CONTROLS,readControls,saveControls } from './engine/controls';
import type { ControlSettings,ShortcutAction } from './engine/controls';
import { createBrush, createPlaceableShape, createSizedPlaceableShape, defaultShapeSize, boxFromGroundDrag,boxFromPlaneDrag, resizeBrush,rotateBrushTextureLock } from './engine/geometry';
import { uid } from './engine/types';
import {makeBrushEntity,makeRelay,connectGameplay,disconnectGameplay} from './engine/gameplay';
import {createCinematicScene,readCinematicScene,appendCinematicWaypoint,removeLastCinematicWaypoint,updateCinematicCamera,type CinematicOptions,type CameraSettings} from './engine/cinematic';
import {createWaypoint,makeNpcSpawner,DEFAULT_SPAWNER,type SpawnerOptions} from './engine/npc';
import {makeAudioEntity,type AudioEntityKind,type SoundOptions} from './engine/sound';
import {makeEnvironment,type EnvironmentKind} from './engine/environment';
import type { Brush,Face,FgdClass,MapObject,PointEntity,Project,TextureAsset,Vec3,PlaceableShape } from './engine/types';
import { starterEntities } from './engine/fgd';
import {customNpcToFgd,validateCustomNpc,type CustomNpcDefinition} from './engine/customNpc';
import {editBrushVertices,splitBrush,hollowBox,pushPullFace} from './engine/modeling';
import {intersectConvex,subtractConvex,unionConvex,bevelEdge,taperInsetFace,extrudeFaceBrush} from './engine/advancedModeling';
import {createSkyEnclosure,type SkyEnclosureOptions} from './engine/skyEnclosure';
import {createMultipleWallOpenings,createArchitecture,type ArchitectureKind,type ArchitectureOptions,type OpeningPlacement} from './engine/architecture';
import {mergeIntoConvexBrush} from './engine/smartMerge';
import {createPrefab,placePrefab,validatePrefab,readPrefabLibrary,writePrefabLibrary,type Prefab} from './engine/prefabs';
import {rotateObjectsForPlacement} from './engine/smartPlacement';
import {detachBrushEntities as detachBrushEntityObjects} from './engine/brushEntityDetach';
import type {PlacementAxis,DrawPlane} from './engine/smartPlacementMath';
import {readShapeDimensions,rememberShapeDimensions} from './engine/shapeDimensions';
import {preferredLocale,readLocalePreference,saveLocalePreference,systemLocale,type Locale,type LocalePreference} from './i18n';
import {textureSettings} from './engine/geometry';
import {fitFace,centerFace,flipFace,alignFaceToReference,gesturePatch,faceTexturePatch,sanitizeTexturePatch,isTextureFaceRef,readTexturePresets,writeTexturePresets,type TextureFaceRef,type TextureFacePatch,type TexturePreset,type UvHandle} from './engine/textureStudio';
import {preferredTextureAssets} from './engine/textureWadSelection';
import {DEFAULT_ENTITY_APPEARANCE,loadEntityAppearance,saveEntityAppearance,normalizeEntityAppearance,type EntityAppearanceSettings,type EntityColorKind} from './engine/entityAppearance';
import {DEFAULT_MAP_LABEL_SETTINGS,loadMapLabelSettings,saveMapLabelSettings,normalizeMapLabelSettings,type MapLabelSettings} from './engine/mapEntityLabels';
export type ToolMode='select'|'translate'|'rotate'|'scale';
export type ResourceView='objects'|'entities'|'textures'|'decals'|'models'|'npcs'|'sounds'|'layers';
export type RadAmbientTest='off'|'0.08'|'0.15'|'0.25';
export type Settings={compilerDir:string;gameDir:string;wadPaths:string;mapName:string;radAmbientTest:RadAmbientTest};
export const DEFAULT_SETTINGS:Settings={compilerDir:'',gameDir:'',wadPaths:'',mapName:'svstudio_test',radAmbientTest:'off'};
const BOX='SV_BRICK01';
function texBrush(b:Brush,t=BOX){return {...b,faces:b.faces.map(f=>({...f,texture:t}))};}
/** UV tools must use the identical texture dimensions and WAD priority as
 * the actual viewport. A name can exist with different sizes in two WADs. */
function textureStudioAssetSizes(state:Pick<State,'settings'|'project'|'textureAssets'>){
  const paths=state.settings.wadPaths.split(/[\r\n]+/).map(path=>path.trim()).filter(Boolean);
  return preferredTextureAssets(state.textureAssets,paths,state.project.wadNames);
}
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
/** Shared position update for keyboard, grid snap and other direct movements.
 * Gizmo/modal transforms use rotateBrushTextureLock through transformSelection. */
function moveObjectWithTextureLock(object:MapObject,position:Vec3):MapObject{
  if(position.every((value,axis)=>value===object.position[axis]))return object;
  if(object.kind!=='brush')return {...object,position};
  return {...object,position,faces:rotateBrushTextureLock(object,{position,rotation:object.rotation,scale:object.scale})};
}

interface State{
  locale:Locale;localePreference:LocalePreference;setLocale:(locale:LocalePreference)=>void;
  geometryMode:'object'|'vertex'|'edge'|'face';editIndices:number[];setGeometryMode:(mode:'object'|'vertex'|'edge'|'face')=>void;selectEditIndices:(indices:number[])=>void;
  editVertices:(id:string,indices:number[],delta:Vec3)=>void;pushPullFace:(id:string,face:number,distance:number)=>void;clipSelected:(axis:0|1|2,at:number,side:'both'|'positive'|'negative')=>void;hollowSelected:(thickness:number)=>void;
  booleanSelected:(operation:'union'|'subtract'|'intersect')=>void;bevelSelected:(width:number)=>void;insetSelected:(width:number)=>void;extrudeSelected:(distance:number)=>void;
  groupSelected:(name:string)=>void;ungroupSelected:()=>void;selectGroup:(name:string)=>void;toggleGroupVisibility:(name:string)=>void;toggleGroupLocked:(name:string)=>void;
  prefabs:Prefab[];saveSelectedPrefab:(name:string)=>void;addPrefab:(prefab:Prefab)=>void;removePrefab:(id:string)=>void;instantiatePrefab:(id:string,position:Vec3)=>void;
  placementPrefabId:string|null;setPlacementPrefab:(id:string|null)=>void;placePrefabAt:(position:Vec3,autoYaw?:number)=>void;
  placementAxis:PlacementAxis;placementAngle:number;placementAutoAlign:boolean;placementRepeat:boolean;
  setPlacementAxis:(axis:PlacementAxis)=>void;stepPlacementAngle:(degrees:number)=>void;resetPlacementAngle:()=>void;togglePlacementAutoAlign:()=>void;togglePlacementRepeat:()=>void;
  faceClipboard:Partial<Face>|null;copyFaceSettings:(id:string,index:number)=>void;pasteFaceSettings:(id:string,index:number)=>void;alignFaceTexture:(id:string,index:number)=>void;snapSelectionToGrid:()=>void;
  textureStudioOpen:boolean;setTextureStudioOpen:(open:boolean)=>void;texturePickerActive:boolean;setTexturePickerActive:(enabled:boolean)=>void;sampleTextureStudioFace:(id:string,face:number)=>void;textureFaceSelection:TextureFaceRef[];selectTextureStudioFace:(id:string,face:number,additive:boolean)=>void;selectAllTextureFaces:()=>void;clearTextureFaces:()=>void;
  texturePresets:TexturePreset[];saveTexturePreset:(name:string)=>void;removeTexturePreset:(id:string)=>void;applyTexturePreset:(id:string)=>void;
  applyTextureStudioPatch:(patch:TextureFacePatch)=>void;fitTextureStudio:(tilesU:number,tilesV:number)=>void;alignTextureStudio:()=>void;centerTextureStudio:()=>void;flipTextureStudio:(axis:'u'|'v')=>void;
  beginTextureStudioGesture:()=>void;updateTextureStudioGesture:(handle:UvHandle,dx:number,dy:number,keepRatio:boolean)=>void;
  textureDragSnapshot:Project|null;beginTextureDrag:(id:string,faceIndex:number)=>void;updateTextureDrag:(id:string,faceIndex:number,u:number,v:number)=>void;updateTextureTransform:(id:string,faceIndex:number,mode:'rotate'|'scale',dx:number,dy:number)=>void;finishTextureDrag:(commit:boolean)=>void;
  registerCustomNpc:(definition:CustomNpcDefinition)=>void;removeCustomNpc:(classname:string)=>void;
  project:Project; selected:string|null; selectedIds:string[]; selectedFace:number|null; mode:ToolMode;showTransformGizmo:boolean;setShowTransformGizmo:(enabled:boolean)=>void;activateGizmoMode:(mode:Exclude<ToolMode,'select'>)=>void;toggleShortcutGizmo:(mode:'translate'|'rotate'|'scale')=>void; snap:number; snapping:boolean; gridDisplayStep:number;
  scaleAnchor:'center'|'xmin'|'xmax'|'ymin'|'ymax'|'zmin'|'zmax';setScaleAnchor:(anchor:State['scaleAnchor'])=>void;
  modalTransform:{mode:Exclude<ToolMode,'select'>;serial:number}|null;modalFinish:{serial:number;commit:boolean}|null;
  toggleModalTransform:(mode:Exclude<ToolMode,'select'>)=>void;finishModalTransform:(commit:boolean)=>void;completeModalTransform:()=>void;
  showEntityNames:boolean;
  entityAppearance:EntityAppearanceSettings;
  mapLabelSettings:MapLabelSettings;
  setMapLabelSettings:(changes:Partial<MapLabelSettings>)=>void;
  resetMapLabelSettings:()=>void;
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
  cinematicPlacementFor:string|null;startCinematicPlacement:(cameraId:string|null)=>void;placeCinematicPoint:(position:Vec3)=>void;createCinematic:(options:CinematicOptions)=>string;updateCinematic:(cameraId:string,settings:CameraSettings)=>void;setCinematicPreviewSpeed:(pointId:string,speed:number|null)=>void;removeLastCinematicPoint:(cameraId:string)=>void;
  pendingNpcClass:string|null;routePlacementFor:string|null;routeSolo:string|null;setRouteSolo:(name:string|null)=>void;
  startNpcPlacement:(classname:string|null)=>void;startWaypointPlacement:(ownerId:string|null)=>void;
  placePendingNpc:(position:Vec3)=>void;placeWaypoint:(ownerId:string,position:Vec3)=>void;
  spawnFromNpc:(npcId:string,options?:SpawnerOptions)=>void;
  placementShape:PlaceableShape|null;shapeSize:Vec3;setShapeSize:(size:Vec3)=>void;
  setPlacementShape:(kind:PlaceableShape|null)=>void;
  placeShapeAt:(position:Vec3,autoYaw?:number)=>void;
  drawMode:boolean; drawHeight:number;drawPlane:DrawPlane;setDrawPlane:(plane:DrawPlane)=>void;drawSign:1|-1;setDrawSign:(sign:1|-1)=>void;
  measureMode:boolean;measurement:{a:Vec3|null;b:Vec3|null};toggleMeasure:()=>void;measurePoint:(at:Vec3)=>void;
  controls:ControlSettings; flyMode:boolean; walkMode:boolean; cameraCommand:{action:ShortcutAction;serial:number}|null; cameraLabel:string;
  wireframe:boolean; solidShading:boolean; setShadingMode:(mode:ShadingMode)=>void; faceMode:boolean; showGrid:boolean; showLights:boolean; ghostHidden:boolean; toggleGhostHidden:()=>void;visibilityListIds:string[];focusHiddenId:string|null;focusHidden:(id:string)=>void; isolationSnapshot:Record<string,boolean>|null; toggleTemporaryIsolation:()=>void; hideSelection:()=>void;
  resourceView:ResourceView; textureAssets:TextureAsset[]; currentTexture:string;
  decalAssets:TextureAsset[]; activeDecal:string|null;
  setDecalAssets:(assets:TextureAsset[],wad:string)=>void;
  chooseDecal:(texture:string|null)=>void;
  placeDecal:(position:Vec3,normal:Vec3,brushId:string)=>void;
  moveDecalOnSurface:(id:string,position:Vec3)=>void;
  fgdClasses:FgdClass[]; fgdLoaded:boolean; history:Project[]; future:Project[];
  logs:string[]; compileBusy:boolean; settings:Settings;
  setMode:(m:ToolMode)=>void;setControls:(update:Partial<ControlSettings>)=>void;setShortcut:(action:ShortcutAction,binding:string)=>void;resetControls:()=>void;toggleFly:()=>void;setFly:(enabled:boolean)=>void;toggleWalk:()=>void;setWalk:(enabled:boolean)=>void;issueCameraCommand:(action:ShortcutAction)=>void;setSelected:(id:string|null,face?:number|null)=>void;selectObject:(id:string,additive:boolean,face?:number|null)=>void;
  setDrawMode:(enabled:boolean)=>void;setDrawHeight:(height:number)=>void;addDrawnBox:(from:Vec3,to:Vec3)=>void;
  moveSelection:(delta:Vec3)=>void;transformSelection:(updates:Record<string,{position:Vec3;rotation?:Vec3;scale?:Vec3}>)=>void;setCameraLabel:(label:string)=>void;changeDimensions:(id:string,size:Vec3)=>void;
  setSnap:(v:number)=>void;setGridDisplayStep:(v:number)=>void;toggleSnap:()=>void;setFlag:(k:'wireframe'|'faceMode'|'showGrid'|'showLights'|'showEntityNames',v:boolean)=>void;
  setResourceView:(v:ResourceView)=>void;
  addBrush:(type:PlaceableShape)=>void;addEntity:(cls:FgdClass,position?:Vec3)=>void;
  buildArchitecture:(kind:ArchitectureKind,options:ArchitectureOptions)=>void;
  architecturePlacement:{kind:'door'|'window';options:ArchitectureOptions}|null;architectureHoverTarget:string|null;architecturePreviousMode:ToolMode|null;setArchitectureHoverTarget:(id:string|null)=>void;startArchitecturePlacement:(kind:'door'|'window'|null,options?:ArchitectureOptions)=>void;placeArchitectureOnWall:(wallId:string,at:Vec3,override?:ArchitectureOptions)=>void;
  smartMergeSelected:()=>void;mergeIntoOneSelected:()=>void;unmergeSmartSelected:()=>void;updateSelectedOpening:(options:ArchitectureOptions)=>void;createSelectedBrushEntity:(type:'func_wall'|'func_door')=>void;
  generateSkyEnclosure:(options:SkyEnclosureOptions)=>void;
  applyTerrain:(draft:TerrainDraft)=>void;
  terrainPlacement:{kind:'terrain'|'rocks';draft:TerrainDraft;rocks?:Omit<RockOptions,'origin'|'texture'>}|null;
  startTerrainPlacement:(request:State['terrainPlacement'])=>void;placePendingTerrain:(origin:Vec3)=>void;
  addObjects:(o:MapObject[])=>void;updateObject:(id:string,changes:Partial<MapObject>)=>void;
  changeFace:(id:string,face:number,changes:Partial<Face>)=>void;paintSelected:(texture:string)=>void;
  removeSelected:()=>void;duplicateSelected:()=>void;brushClipboard:Brush[];brushPasteCount:number;copySelectedBrushes:()=>void;pasteCopiedBrushes:()=>void;setObjectProp:(id:string,key:string,value:string)=>void;
  detachBrushEntities:(ids:string[],wholeEntity?:boolean)=>void;
  tieGameplayBrush:(id:string,type:'func_door'|'func_button')=>void;createGameplayRelay:(position:Vec3)=>void;addGameplayDemo:()=>void;
  connectGameplay:(from:string,to:string,replace?:boolean)=>void;disconnectGameplay:(from:string)=>void;setGraphPosition:(id:string,position:[number,number])=>void;setGraphPositions:(positions:Record<string,[number,number]>)=>void;
  changeWorld:(key:string,value:string)=>void;newProject:()=>void;loadProject:(p:Project)=>void;setName:(name:string)=>void;
  toggleVisibility:(id:string)=>void;toggleLocked:(id:string)=>void;toggleLayerVisibility:(layer:string)=>void;  setLayer:(id:string,layer:string)=>void;
  selectSameClass:(classname:string)=>void;selectSameLayer:(layer:string)=>void;isolateSelection:()=>void;revealAll:()=>void;unlockAll:()=>void;
  undo:()=>void;redo:()=>void;setTextures:(textures:TextureAsset[],wad:string)=>void;setFgd:(classes:FgdClass[])=>void;
  appendLogs:(lines:string[])=>void;clearLogs:()=>void;setCompileBusy:(b:boolean)=>void;setSettings:(s:Partial<Settings>)=>void;
}
/** No hidden/locked brush is ever edited. One batch is one undo step. */
export function textureStudioTargets(s:Pick<State,'project'|'selected'|'selectedIds'|'selectedFace'|'faceMode'|'textureFaceSelection'>):TextureFaceRef[]{
  const valid=s.textureFaceSelection.filter(ref=>isTextureFaceRef(ref,s.project.objects));
  if(valid.length)return valid;
  const objects=s.project.objects.filter(o=>s.selectedIds.includes(o.id)&&o.kind==='brush'&&!o.locked&&!o.hidden) as Brush[];
  return objects.flatMap(o=>s.faceMode&&s.selected===o.id&&s.selectedFace!==null&&objects.length===1?[{id:o.id,face:s.selectedFace}]:o.faces.map((_,face)=>({id:o.id,face})));
}
function applyTexturePatches(s:State,patches:Map<string,Map<number,TextureFacePatch>>){
  if(!patches.size)return {};
  let changed=false;
  const objects=s.project.objects.map(o=>{
    const changedFaces=patches.get(o.id);
    if(o.kind!=='brush'||o.locked||o.hidden||!changedFaces)return o;
    const faces=o.faces.map((f,i)=>{const patch=changedFaces.get(i);if(!patch)return f;const validated=sanitizeTexturePatch(patch);if(!Object.entries(validated).some(([key,val])=>JSON.stringify((f as unknown as Record<string,unknown>)[key])!==JSON.stringify(val)))return f;changed=true;return {...f,...validated}});
    return faces.some((f,i)=>f!==o.faces[i])?{...o,faces}:o;
  });
  return changed?mutate(s,objects):{};
}
const mutate=(state:State,objects:MapObject[]):Pick<State,'project'|'history'|'future'>=>({
  project:{...state.project,objects},history:[...state.history.slice(-70),clone(state.project)],future:[]
});
export const useEditor=create<State>((set,get)=>({
  locale:preferredLocale(),localePreference:readLocalePreference(),
  setLocale:localePreference=>set(()=>{saveLocalePreference(localePreference);return {localePreference,locale:localePreference==='auto'?systemLocale():localePreference}}),
  geometryMode:'object',editIndices:[],
  setGeometryMode:mode=>set({geometryMode:mode,faceMode:mode==='face',editIndices:[],selectedFace:null,textureFaceSelection:[],mode:'select',drawMode:false}),
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
  textureStudioOpen:false,texturePickerActive:false,textureFaceSelection:[],texturePresets:readTexturePresets(),
  setTextureStudioOpen:textureStudioOpen=>set({textureStudioOpen,texturePickerActive:textureStudioOpen?get().texturePickerActive:false}),
  setTexturePickerActive:texturePickerActive=>set({texturePickerActive}),
  sampleTextureStudioFace:(id,face)=>set(s=>{
    if(!s.texturePickerActive)return {};
    const source=s.project.objects.find(o=>o.id===id);if(source?.kind!=='brush'||!source.faces[face])return {texturePickerActive:false};
    const patch=faceTexturePatch(source.faces[face]);
    const targets=textureStudioTargets(s);
    const updates=new Map<string,Map<number,TextureFacePatch>>();
    for(const ref of targets){if(!updates.has(ref.id))updates.set(ref.id,new Map());updates.get(ref.id)!.set(ref.face,patch)}
    return {...applyTexturePatches(s,updates),texturePickerActive:false,faceClipboard:patch};
  }),
  selectTextureStudioFace:(id,face,additive)=>set(s=>{
    if(!isTextureFaceRef({id,face},s.project.objects))return {};
    const ref={id,face};const prior=s.textureFaceSelection.filter(r=>isTextureFaceRef(r,s.project.objects));
    const exists=prior.some(r=>r.id===id&&r.face===face);
    const next=additive?(exists?prior.filter(r=>r.id!==id||r.face!==face):[...prior,ref]):[ref];
    const selected=next.at(-1)||ref;
    const selectedIds=[...new Set(next.map(r=>r.id))];
    return {textureFaceSelection:next,selected:selected.id,selectedIds,selectedFace:next.length===1?selected.face:null,editIndices:[]};
  }),
  clearTextureFaces:()=>set({textureFaceSelection:[]}),
  selectAllTextureFaces:()=>set(s=>({textureFaceSelection:s.project.objects.filter(o=>s.selectedIds.includes(o.id)&&o.kind==='brush'&&!o.locked&&!o.hidden).flatMap(o=>o.kind==='brush'?o.faces.map((_,face)=>({id:o.id,face})):[]),selectedFace:null})),
  applyTextureStudioPatch:patch=>set(s=>{
    const changes=sanitizeTexturePatch(patch);const targets=textureStudioTargets(s);
    const updates=new Map<string,Map<number,TextureFacePatch>>();
    for(const ref of targets){if(!updates.has(ref.id))updates.set(ref.id,new Map());updates.get(ref.id)!.set(ref.face,changes)}
    return applyTexturePatches(s,updates);
  }),
  fitTextureStudio:(tilesU,tilesV)=>set(s=>{
    const assets=textureStudioAssetSizes(s);
    const updates=new Map<string,Map<number,TextureFacePatch>>();
    for(const ref of textureStudioTargets(s)){
      const b=s.project.objects.find(o=>o.id===ref.id);if(!b||b.kind!=='brush')continue;
      const face=b.faces[ref.face];const asset=assets.get(face.texture.toLowerCase());
      const patch=fitFace(b,ref.face,asset?.width||128,asset?.height||128,tilesU,tilesV);
      if(!updates.has(ref.id))updates.set(ref.id,new Map());updates.get(ref.id)!.set(ref.face,patch);
    }
    return applyTexturePatches(s,updates);
  }),
  centerTextureStudio:()=>set(s=>{
    const assets=textureStudioAssetSizes(s);
    const updates=new Map<string,Map<number,TextureFacePatch>>();
    for(const ref of textureStudioTargets(s)){
      const b=s.project.objects.find(o=>o.id===ref.id);if(b?.kind!=='brush')continue;
      const face=b.faces[ref.face];const a=assets.get(face.texture.toLowerCase());
      if(!updates.has(ref.id))updates.set(ref.id,new Map());updates.get(ref.id)!.set(ref.face,centerFace(b,ref.face,a?.width||128,a?.height||128));
    }
    return applyTexturePatches(s,updates);
  }),
  flipTextureStudio:axis=>set(s=>{
    const updates=new Map<string,Map<number,TextureFacePatch>>();
    for(const ref of textureStudioTargets(s)){const b=s.project.objects.find(o=>o.id===ref.id);if(b?.kind!=='brush')continue;
      if(!updates.has(ref.id))updates.set(ref.id,new Map());updates.get(ref.id)!.set(ref.face,flipFace(b,ref.face,axis));
    }
    return applyTexturePatches(s,updates);
  }),
  alignTextureStudio:()=>set(s=>{
    const targets=textureStudioTargets(s);if(targets.length<2)return {};
    const first=targets[0],source=s.project.objects.find(o=>o.id===first.id);if(source?.kind!=='brush')return {};
    const patches=new Map<string,Map<number,TextureFacePatch>>();
    for(const ref of targets.slice(1)){const b=s.project.objects.find(o=>o.id===ref.id);if(b?.kind!=='brush')continue;
      if(!patches.has(ref.id))patches.set(ref.id,new Map());patches.get(ref.id)!.set(ref.face,alignFaceToReference(source,first.face,b,ref.face));
    }
    return applyTexturePatches(s,patches);
  }),
  saveTexturePreset:name=>set(s=>{
    const ref=textureStudioTargets(s)[0];const brush=s.project.objects.find(o=>o.id===ref?.id);
    if(!ref||brush?.kind!=='brush'||!name.trim())return {};
    const preset:TexturePreset={id:uid(),name:name.trim().slice(0,60),settings:faceTexturePatch(brush.faces[ref.face])};
    const presets=[...s.texturePresets.slice(-99),preset];writeTexturePresets(presets);return {texturePresets:presets};
  }),
  removeTexturePreset:id=>set(s=>{const presets=s.texturePresets.filter(p=>p.id!==id);writeTexturePresets(presets);return {texturePresets:presets}}),
  applyTexturePreset:id=>{const preset=get().texturePresets.find(p=>p.id===id);if(preset)get().applyTextureStudioPatch(preset.settings)},
  beginTextureStudioGesture:()=>set(s=>s.textureDragSnapshot?{}:{textureDragSnapshot:clone(s.project)}),
  updateTextureStudioGesture:(handle,dx,dy,keepRatio)=>set(s=>{
    if(!s.textureDragSnapshot)return {};
    const targets=textureStudioTargets(s);
    const updates=new Map<string,Map<number,TextureFacePatch>>();
    for(const ref of targets){const before=s.textureDragSnapshot.objects.find(o=>o.id===ref.id);if(before?.kind!=='brush'||!before.faces[ref.face])continue;
      if(!updates.has(ref.id))updates.set(ref.id,new Map());updates.get(ref.id)!.set(ref.face,gesturePatch(before.faces[ref.face],handle,dx,dy,keepRatio));
    }
    // Preview only: do not push to history until finishTextureDrag(true).
    const objects=s.project.objects.map(o=>{const patches=updates.get(o.id);if(o.kind!=='brush'||!patches||o.locked)return o;
      return {...o,faces:o.faces.map((face,i)=>patches.has(i)?{...face,...patches.get(i)}:face)};
    });
    return {project:{...s.project,objects}};
  }),
  faceClipboard:null,
  copyFaceSettings:(id,index)=>set(s=>{const obj=s.project.objects.find(o=>o.id===id);if(obj?.kind!=='brush'||!obj.faces[index])throw Error('Select a brush face.');return {faceClipboard:faceTexturePatch(obj.faces[index])}}),
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
    const next=s.project.objects.map(o=>{
      if(!ids.has(o.id)||o.locked)return o;
      const target=o.position.map(n=>Math.round(n/grid)*grid) as Vec3;
      if(o.kind==='entity'&&o.classname==='infodecal'&&o.decalNormal&&o.decalBrushId){
        const brush=s.project.objects.find(b=>b.id===o.decalBrushId);
        const position=brush?.kind==='brush'?constrainDecalToBrush(brush,o.decalNormal,o.position,target):null;
        return position&&position.some((v,i)=>Math.abs(v-o.position[i])>.0001)?{...o,position}:o;
      }
      return moveObjectWithTextureLock(o,target);
    });
    return next.every((o,i)=>o===s.project.objects[i])?{}:{...mutate(s,next)};
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
  placementAxis:'z',placementAngle:0,placementAutoAlign:true,placementRepeat:false,
  setPlacementAxis:placementAxis=>set({placementAxis}),
  stepPlacementAngle:delta=>set(s=>({placementAngle:(s.placementAngle+delta)%360})),
  resetPlacementAngle:()=>set({placementAngle:0,placementAxis:'z'}),
  togglePlacementAutoAlign:()=>set(s=>({placementAutoAlign:!s.placementAutoAlign})),
  togglePlacementRepeat:()=>set(s=>({placementRepeat:!s.placementRepeat})),
  saveSelectedPrefab:name=>set(s=>{
    const selected=new Set(s.selectedIds);
    const prefab=createPrefab(s.project.objects.filter(o=>selected.has(o.id)),name);
    const prefabs=[...s.prefabs,prefab];writePrefabLibrary(prefabs);return {prefabs};
  }),
  addPrefab:prefab=>set(s=>{
    const valid=validatePrefab(prefab);
    const prefabs=[...s.prefabs,{...valid,id:uid()}];writePrefabLibrary(prefabs);return {prefabs};
  }),
  removePrefab:id=>set(s=>{const prefabs=s.prefabs.filter(p=>p.id!==id);writePrefabLibrary(prefabs);return {prefabs,placementPrefabId:s.placementPrefabId===id?null:s.placementPrefabId};}),
  instantiatePrefab:(id,position)=>set(s=>{
    const prefab=s.prefabs.find(p=>p.id===id);if(!prefab)throw Error('Prefab not found.');
    const copies=placePrefab(prefab,position);
    return {...mutate(s,[...s.project.objects,...copies]),selected:copies.at(-1)!.id,selectedIds:copies.map(o=>o.id),selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false};
  }),
  placementPrefabId:null,
  setPlacementPrefab:id=>set(s=>{
    if(id&&!s.prefabs.some(p=>p.id===id))throw Error('Prefab not found.');
    return {placementPrefabId:id,placementShape:null,placementAngle:0,placementAxis:'z',terrainPlacement:null,architecturePlacement:null,
      measureMode:false,walkMode:false,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,
      routePlacementFor:null,drawMode:false,mode:'select',flyMode:false,modalTransform:null,
      modalFinish:null,geometryMode:'object',faceMode:false};
  }),
  placePrefabAt:(position,autoYaw=0)=>set(s=>{
    if(!s.placementPrefabId||position.some(value=>!Number.isFinite(value)))return {};
    const prefab=s.prefabs.find(item=>item.id===s.placementPrefabId);
    if(!prefab)return {placementPrefabId:null};
    const step=s.snapping?s.snap:1;
    const at=position.map(value=>Math.round(value/step)*step) as Vec3;
    const copies=placePrefab(prefab,at,s.placementAxis,s.placementAngle,autoYaw);
    return {...mutate(s,[...s.project.objects,...copies]),selected:copies.at(-1)!.id,
      selectedIds:copies.map(o=>o.id),selectedFace:null,editIndices:[],
      geometryMode:'object',faceMode:false,placementPrefabId:s.placementRepeat?s.placementPrefabId:null};
  }),
  measureMode:false,measurement:{a:null,b:null},
  toggleMeasure:()=>set(s=>({measureMode:!s.measureMode,placementPrefabId:null,drawMode:false,placementShape:null,mode:'select',flyMode:false,geometryMode:'object',faceMode:false})),
  measurePoint:at=>set(s=>{
    if(!s.measureMode||at.some(n=>!Number.isFinite(n)))return {};
    const point=at.map(n=>s.snapping?Math.round(n/s.snap)*s.snap:Math.round(n*100)/100) as Vec3;
    return {measurement:!s.measurement.a||s.measurement.b?{a:point,b:null}:{a:s.measurement.a,b:point}};
  }),
  project:demoProject(),selected:null,selectedIds:[],selectedFace:null,brushClipboard:[],brushPasteCount:0,mode:'select',showTransformGizmo:(()=>{try{return localStorage.getItem('svenstudio:gizmo-visible')!=='false'}catch{return true}})(),setShowTransformGizmo:enabled=>set(()=>{try{localStorage.setItem('svenstudio:gizmo-visible',String(enabled))}catch{}return {showTransformGizmo:enabled}}),activateGizmoMode:mode=>set({mode,placementPrefabId:null,walkMode:false,measureMode:false,showTransformGizmo:true,geometryMode:'object',faceMode:false,editIndices:[],drawMode:false,placementShape:null,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,flyMode:false,modalTransform:null,modalFinish:null,architecturePlacement:null,architectureHoverTarget:null,architecturePreviousMode:null}),
  // Keyboard R/C uses the *persistent* gizmo, not the mouse-follow modal tool.
  // Pressing the same shortcut again returns to normal selection and hides it.
  // No project/history mutation is performed until the user drags a gizmo handle.
  toggleShortcutGizmo:requested=>set(s=>{
    if(s.mode===requested&&s.showTransformGizmo&&!s.modalTransform)return {mode:'select',showTransformGizmo:false};
    return {mode:requested,placementPrefabId:null,showTransformGizmo:true,walkMode:false,measureMode:false,geometryMode:'object',faceMode:false,editIndices:[],drawMode:false,placementShape:null,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,flyMode:false,modalTransform:null,modalFinish:null,architecturePlacement:null,architectureHoverTarget:null,architecturePreviousMode:null};
   }),snap:loadEditStep(),snapping:true,gridDisplayStep:loadVisibleGridStep(),scaleAnchor:(()=>{try{const stored=localStorage.getItem('svenstudio:scale-anchor');return ['center','xmin','xmax','ymin','ymax','zmin','zmax'].includes(stored||'')?stored as State['scaleAnchor']:'center'}catch{return 'center'}})(),setScaleAnchor:scaleAnchor=>set(()=>{try{localStorage.setItem('svenstudio:scale-anchor',scaleAnchor)}catch{}return {scaleAnchor}}),drawMode:false,drawHeight:128,drawPlane:'xy',drawSign:1,setDrawPlane:drawPlane=>set({drawPlane,drawSign:1}),setDrawSign:drawSign=>set({drawSign}),
  environmentPlacement:null,environmentPreview:false,fogPreview:true,previewShadows:false,showLightRanges:false,
  setEnvironmentPreview:enabled=>set({environmentPreview:enabled,solidShading:enabled?false:get().solidShading}),setFogPreview:enabled=>set({fogPreview:enabled}),
  setPreviewShadows:enabled=>set({previewShadows:enabled}),setShowLightRanges:enabled=>set({showLightRanges:enabled}),
  startEnvironmentPlacement:(kind,props={})=>set({placementPrefabId:null,terrainPlacement:null,cinematicPlacementFor:null,environmentPlacement:kind?{kind,props}:null,audioPlacement:null,placementShape:null,pendingNpcClass:null,routePlacementFor:null,drawMode:false,mode:'select',flyMode:false}),
  placePendingEnvironment:position=>set(s=>{if(!s.environmentPlacement)return {};const entity=makeEnvironment(s.environmentPlacement.kind,position,s.environmentPlacement.props);return {...mutate(s,[...s.project.objects,entity]),selected:entity.id,selectedIds:[entity.id],environmentPlacement:null}}),
  wireframe:false,solidShading:false,setShadingMode:mode=>set({
    wireframe:mode==='wireframe',solidShading:mode==='solid',environmentPreview:mode==='rendered'
  }),faceMode:false,showGrid:true,showLights:true,showEntityNames:true,entityAppearance:loadEntityAppearance(),mapLabelSettings:loadMapLabelSettings(),placementShape:null,shapeSize:[128,128,128],pendingNpcClass:null,routePlacementFor:null,routeSolo:null,audioPlacement:null,
  modalTransform:null,modalFinish:null,
  controls:readControls(),flyMode:false,walkMode:false,cameraCommand:null,cameraLabel:'Perspective',
  resourceView:'entities',textureAssets:[],currentTexture:BOX,decalAssets:[],activeDecal:null,fgdClasses:starterEntities,fgdLoaded:false,
  history:[],future:[],logs:['SvenStudio 3D initialized.','Import a real .WAD and .FGD for full texture/entity access.'],compileBusy:false,
  settings:(()=>{try{return {...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem('svenstudio-settings')||'{}')}}catch{return DEFAULT_SETTINGS}})(),
  setEntityAppearance:changes=>set(s=>{const settings=normalizeEntityAppearance({...s.entityAppearance,...changes});saveEntityAppearance(settings);return {entityAppearance:settings}}),
  setEntityColor:(kind,color)=>set(s=>{const settings=normalizeEntityAppearance({...s.entityAppearance,colors:{...s.entityAppearance.colors,[kind]:color}});saveEntityAppearance(settings);return {entityAppearance:settings}}),
  resetEntityAppearance:()=>set(()=>{const entityAppearance=structuredClone(DEFAULT_ENTITY_APPEARANCE);saveEntityAppearance(entityAppearance);return {entityAppearance}}),
  setMapLabelSettings:changes=>set(s=>{const mapLabelSettings=normalizeMapLabelSettings({...s.mapLabelSettings,...changes});saveMapLabelSettings(mapLabelSettings);return {mapLabelSettings}}),
  resetMapLabelSettings:()=>set(()=>{const mapLabelSettings={...DEFAULT_MAP_LABEL_SETTINGS};saveMapLabelSettings(mapLabelSettings);return {mapLabelSettings}}),
  setShapeSize:shapeSize=>set(s=>{const size=shapeSize.map(v=>Math.max(1,Math.min(16384,Number.isFinite(v)?v:128))) as Vec3;
    if(s.placementShape)rememberShapeDimensions(s.placementShape,size);
    return {shapeSize:size};}),
  setPlacementShape:placementShape=>set({placementAngle:0,placementAxis:'z',shapeSize:placementShape?(readShapeDimensions(placementShape)||defaultShapeSize(placementShape)):get().shapeSize,placementPrefabId:null,terrainPlacement:null,measureMode:false,walkMode:false,placementShape,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,drawMode:false,mode:'select',flyMode:false,modalTransform:null,modalFinish:null,geometryMode:'object',faceMode:false}),
  placeShapeAt:(ground,autoYaw=0)=>set(s=>{
    if(!s.placementShape||ground.some(v=>!Number.isFinite(v)))return {};
    const snap=s.snapping?s.snap:1;
    const position=ground.map(v=>Math.round(v/snap)*snap) as Vec3;
    const shape=createSizedPlaceableShape(s.placementShape,position,s.shapeSize,s.currentTexture);
    const additions=rotateObjectsForPlacement(shape,position,s.placementAxis,s.placementAngle,autoYaw);
    return {...mutate(s,[...s.project.objects,...additions]),selected:additions[0].id,selectedIds:additions.map(b=>b.id),selectedFace:null,placementShape:s.placementRepeat?s.placementShape:null};
  }),
  setMode:mode=>set(s=>({mode:s.mode===mode?'select':mode,placementPrefabId:null,walkMode:false,measureMode:false,drawMode:false,placementShape:null,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,flyMode:false,modalTransform:null,modalFinish:null,architecturePlacement:null,architectureHoverTarget:null,architecturePreviousMode:null})),
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
    audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,terrainPlacement:null,
    mode:'select',geometryMode:'object',faceMode:false
  }:{walkMode:false}),
  issueCameraCommand:action=>set(s=>({cameraCommand:{action,serial:(s.cameraCommand?.serial||0)+1}})),
  setCameraLabel:cameraLabel=>set({cameraLabel}),
  setSelected:(selected,selectedFace=null)=>set({selected,selectedIds:selected?[selected]:[],selectedFace,textureFaceSelection:[],editIndices:[],focusHiddenId:null}),
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
        return {selected:id,selectedIds:ids,selectedFace:null,textureFaceSelection:[],editIndices:[]};
      }
      return {selected:id,selectedIds:[id],selectedFace,textureFaceSelection:[],editIndices:[]};
    }
    const ids=s.selectedIds.includes(id)?s.selectedIds.filter(x=>x!==id):[...s.selectedIds,id];
    return {selected:ids.at(-1)??null,selectedIds:ids,selectedFace:ids.length===1?selectedFace:null,textureFaceSelection:[],editIndices:[]};
  }),
  setDrawMode:drawMode=>set({measureMode:false,placementPrefabId:null,walkMode:false,drawMode,placementShape:null,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,mode:'select',flyMode:false,selected:null,selectedIds:[],selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false}),
  setDrawHeight:height=>set({drawHeight:Math.max(1,Math.min(131072,height))}),
  addDrawnBox:(from,to)=>set(s=>{
    const brush=s.drawPlane==='xy'&&from[2]===0&&s.drawSign===1?boxFromGroundDrag(from,to,s.drawHeight,s.snapping?s.snap:1,s.currentTexture):boxFromPlaneDrag(from,to,s.drawHeight,s.drawPlane,s.snapping?s.snap:1,s.currentTexture,s.drawSign);
    return {...mutate(s,[...s.project.objects,brush]),selected:brush.id,selectedIds:[brush.id],selectedFace:null};
  }),
  moveSelection:delta=>set(s=>{
    const ids=new Set(s.selectedIds);
    if(!ids.size||!delta.every(Number.isFinite)||delta.every(v=>Math.abs(v)<0.001))return {};
    const objects=s.project.objects.map(o=>{
      if(!ids.has(o.id)||o.locked)return o;
      const target=o.position.map((v,i)=>v+delta[i]) as Vec3;
      if(o.kind==='entity'&&o.classname==='infodecal'&&o.decalNormal&&o.decalBrushId){
        const brush=s.project.objects.find(b=>b.id===o.decalBrushId);
        const position=brush?.kind==='brush'?constrainDecalToBrush(brush,o.decalNormal,o.position,target):null;
        return position&&position.some((v,i)=>Math.abs(v-o.position[i])>.0001)?{...o,position}:o;
      }
      return moveObjectWithTextureLock(o,target);
    });
    return objects.every((o,i)=>o===s.project.objects[i])?{}:{...mutate(s,objects)};
  }),
  transformSelection:updates=>set(s=>{
    const ids=new Set(s.selectedIds);let modified=false;
    const objects=s.project.objects.map(o=>{
      const change=updates[o.id];if(!ids.has(o.id)||o.locked||!change)return o;
      if(!change.position.every(Number.isFinite)||change.rotation?.some(x=>!Number.isFinite(x))||change.scale?.some(x=>!Number.isFinite(x)||x<.05))return o;
      modified=true;
      if(o.kind==='brush'){
        const next={position:change.position,rotation:change.rotation??o.rotation,scale:change.scale??o.scale};
        return {...o,...next,faces:rotateBrushTextureLock(o,next)};
      }
      if(o.classname==='infodecal'&&o.decalNormal&&o.decalBrushId){
        const brush=s.project.objects.find(b=>b.id===o.decalBrushId);
        const position=brush?.kind==='brush'?constrainDecalToBrush(brush,o.decalNormal,o.position,change.position):null;
        return position?{...o,position}:o;
      }
      return {...o,position:change.position};
    });
    return modified?{...mutate(s,objects)}:{};
  }),
  changeDimensions:(id,size)=>set(s=>({...mutate(s,s.project.objects.map(o=>o.id===id&&o.kind==='brush'?resizeBrush(o,size):o))})),
  setSnap:value=>set(()=>{const snap=normalizeGridStep(value,1);saveEditStep(snap);return {snap}}),
  setGridDisplayStep:value=>set(()=>{const gridDisplayStep=normalizeGridStep(value);saveVisibleGridStep(gridDisplayStep);return {gridDisplayStep}}),
  toggleSnap:()=>set(s=>({snapping:!s.snapping})),
  setFlag:(key,value)=>set(key==='faceMode'?{faceMode:value,geometryMode:value?'face':'object',editIndices:[]}:key==='wireframe'?{wireframe:value,solidShading:value?false:get().solidShading}:{[key]:value}),setResourceView:resourceView=>set({resourceView}),
  startAudioPlacement:(classname,file='',options={})=>set({placementPrefabId:null,terrainPlacement:null,cinematicPlacementFor:null,environmentPlacement:null,audioPlacement:classname?{classname,file,options}:null,pendingNpcClass:null,routePlacementFor:null,placementShape:null,drawMode:false,mode:'select',geometryMode:'object',flyMode:false}),
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
  cinematicPlacementFor:null,
  createCinematic:(options)=>{
    let cameraId='';
    set(s=>{const result=createCinematicScene(s.project.objects,options);cameraId=result.cameraId;
      return {...mutate(s,result.objects),selected:cameraId,selectedIds:[cameraId],selectedFace:null};});
    return cameraId;
  },
  updateCinematic:(cameraId,options)=>set(s=>({...mutate(s,updateCinematicCamera(s.project.objects,cameraId,options))})),
  removeLastCinematicPoint:cameraId=>set(s=>{
    const current=readCinematicScene(s.project.objects,cameraId);
    const removedId=current?.route.at(-1)?.id;
    const change=mutate(s,removeLastCinematicWaypoint(s.project.objects,cameraId));
    if(!removedId||!s.project.cinematicPreviewSpeeds?.[removedId])return change;
    const speeds={...s.project.cinematicPreviewSpeeds};delete speeds[removedId];
    return {...change,project:{...change.project,cinematicPreviewSpeeds:speeds}};
  }),
  setCinematicPreviewSpeed:(pointId,speed)=>set(s=>{
    if(!s.project.objects.some(o=>o.id===pointId&&o.kind==='entity'&&o.classname==='path_corner'))throw Error('Path point not found.');
    if(speed!==null&&(!Number.isFinite(speed)||speed<1||speed>2000))throw Error('Preview speed must be between 1 and 2000.');
    const current=s.project.cinematicPreviewSpeeds||{};
    if((current[pointId]??null)===speed)return {};
    const next={...current};if(speed===null)delete next[pointId];else next[pointId]=speed;
    return {project:{...s.project,cinematicPreviewSpeeds:next},history:[...s.history.slice(-70),clone(s.project)],future:[]};
  }),
  startCinematicPlacement:cameraId=>set({placementPrefabId:null,terrainPlacement:null,cinematicPlacementFor:cameraId,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,audioPlacement:null,placementShape:null,drawMode:false,mode:'select',geometryMode:'object',flyMode:false}),
  placeCinematicPoint:position=>set(s=>{
    if(!s.cinematicPlacementFor)throw Error('No cinematic camera selected.');
    const result=appendCinematicWaypoint(s.project.objects,s.cinematicPlacementFor,position);
    return {...mutate(s,result.objects),selected:result.pointId,selectedIds:[result.pointId],selectedFace:null};
  }),
  startNpcPlacement:classname=>set({placementPrefabId:null,terrainPlacement:null,cinematicPlacementFor:null,environmentPlacement:null,pendingNpcClass:classname,routePlacementFor:null,audioPlacement:null,placementShape:null,drawMode:false,mode:'select',geometryMode:'object',flyMode:false}),
  setRouteSolo:routeSolo=>set({routeSolo}),
  startWaypointPlacement:ownerId=>set({terrainPlacement:null,cinematicPlacementFor:null,environmentPlacement:null,routePlacementFor:ownerId,pendingNpcClass:null,audioPlacement:null,placementShape:null,drawMode:false,mode:'select',geometryMode:'object',flyMode:false}),
  placePendingNpc:position=>{const s=get();const classname=s.pendingNpcClass;const def=s.project.customNpcs?.find(c=>c.classname===classname);const npcDef=def?customNpcToFgd(def):s.fgdClasses.find(c=>c.name===classname);if(!npcDef||npcDef.type!=='point')throw Error('This NPC is not in the loaded FGD.');s.addEntity(npcDef,position);set({pendingNpcClass:null});},
  placeWaypoint:(ownerId,position)=>set(s=>{const result=createWaypoint(s.project.objects,ownerId,position);return {...mutate(s,result.objects),selected:result.id,selectedIds:[result.id],resourceView:'npcs'};}),
  spawnFromNpc:(npcId,options=DEFAULT_SPAWNER)=>set(s=>{const result=makeNpcSpawner(s.project.objects,npcId,options);return {...mutate(s,result.objects),selected:result.id,selectedIds:[result.id],resourceView:'npcs'};}),
  // Backwards-compatible entry point: clicking any shape enters placement
  // rather than spawning geometry at the world origin.
  addBrush:type=>set({cinematicPlacementFor:null,placementShape:type,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,drawMode:false,mode:'select',flyMode:false,geometryMode:'object',faceMode:false}),
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
    placementPrefabId:null,placementShape:null,drawMode:false,geometryMode:'object',faceMode:false,
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
  terrainPlacement:null,
  startTerrainPlacement:request=>set({
    terrainPlacement:request?clone(request):null,walkMode:false,flyMode:false,measureMode:false,
    cinematicPlacementFor:null,placementShape:null,audioPlacement:null,environmentPlacement:null,
    pendingNpcClass:null,routePlacementFor:null,architecturePlacement:null,drawMode:false,
    mode:'select',geometryMode:'object',faceMode:false,modalTransform:null,modalFinish:null
  }),
  placePendingTerrain:origin=>{
    const s=get(),request=s.terrainPlacement;
    if(!request||s.compileBusy||origin.some(v=>!Number.isFinite(v)))return;
    const draft={...request.draft,origin:[...origin] as Vec3};
    if(request.kind==='terrain')s.applyTerrain(draft);
    else{
      if(!request.rocks)throw Error('Rock placement configuration missing.');
      s.addObjects(createRockCluster({...request.rocks,origin,texture:draft.texture}));
    }
    set({terrainPlacement:null});
  },
  applyTerrain:draft=>set(s=>{
    const previous=s.project.terrainGroups?.find(g=>g.id===draft.id);
    if(previous){
      if(previous.brushIds.length!==previous.brushSignatures.length)throw Error('Terrain source metadata is incomplete.');
      for(let i=0;i<previous.brushIds.length;i++){
        const obj=s.project.objects.find(o=>o.id===previous.brushIds[i]);
        if(!obj||obj.kind!=='brush'||obj.locked||terrainBrushSignature(obj)!==previous.brushSignatures[i])
          throw Error('This terrain was edited, locked or partially removed. Your changes were preserved; create a new terrain instead.');
      }
    }
    const brushes=createTerrainBrushes(draft,previous?.brushIds);
    const ids=new Set(previous?.brushIds||[]);
    const next=[...s.project.objects.filter(o=>!ids.has(o.id)),...brushes];
    const history=[...s.history.slice(-70),clone(s.project)];
    return {project:{...s.project,objects:next,terrainGroups:[...(s.project.terrainGroups||[]).filter(g=>g.id!==draft.id),terrainRecord(draft,brushes)]},history,future:[],selected:brushes[0]?.id||null,selectedIds:brushes[0]?[brushes[0].id]:[],selectedFace:null};
  }),
  addObjects:objects=>set(s=>({...mutate(s,[...s.project.objects,...objects]),selected:objects[0]?.id||s.selected,selectedIds:objects.length?[objects[0].id]:s.selectedIds})),
  updateObject:(id,changes)=>set(s=>({...mutate(s,s.project.objects.map(o=>{
    if(o.id!==id)return o;
    // Respect explicit face edits from Texture Studio. All position updates,
    // including the Properties panel, must otherwise preserve mapped UVs.
    if(o.kind==='entity'&&o.classname==='infodecal'&&'position' in changes&&o.decalNormal&&o.decalBrushId){
      const brush=s.project.objects.find(b=>b.id===o.decalBrushId);
      const target=(changes as Partial<PointEntity>).position;
      const position=brush?.kind==='brush'&&target?constrainDecalToBrush(brush,o.decalNormal,o.position,target):null;
      return position?{...o,...changes,position} as PointEntity:o;
    }
    if(o.kind!=='brush'||'faces' in changes)return {...o,...changes} as MapObject;
    const brushChanges=changes as Partial<Brush>;
    if(!('position' in changes)&&!('rotation' in changes)&&!('scale' in changes))return {...o,...changes} as Brush;
    const next={position:(brushChanges.position??o.position) as Vec3,rotation:(brushChanges.rotation??o.rotation) as Vec3,scale:(brushChanges.scale??o.scale) as Vec3};
    return {...o,...changes,faces:rotateBrushTextureLock(o,next)} as Brush;
  }))})),
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
  detachBrushEntities:(ids,wholeEntity=false)=>set(s=>{
    const {objects,plan}=detachBrushEntityObjects(s.project.objects,ids,wholeEntity);
    if(!plan.brushIds.length)return {};
    // Keep the selected brushes active; if the sole selected entity was removed,
    // select its former brushes instead. One operation = one undoable history entry.
    const valid=new Set(objects.map(o=>o.id));
    const kept=s.selectedIds.filter(id=>valid.has(id));
    const selectedIds=kept.length?kept:plan.brushIds;
    return {...mutate(s,objects),selected:selectedIds.at(-1)??null,selectedIds,
      selectedFace:null,textureFaceSelection:[],editIndices:[],geometryMode:'object',faceMode:false};
  }),
  // Keep a snapshot in the editor's own clipboard, not in the browser text clipboard.
  // One paste = one Undo entry. Repeated pastes offset copies so they remain selectable.
  copySelectedBrushes:()=>set(s=>{
    const copied=s.project.objects.filter((o):o is Brush=>
      o.kind==='brush'&&s.selectedIds.includes(o.id)&&!o.locked&&!o.hidden);
    if(!copied.length)return {};
    return {brushClipboard:clone(copied),brushPasteCount:0};
  }),
  pasteCopiedBrushes:()=>set(s=>{
    if(!s.brushClipboard.length)return {};
    const distance=32*(s.brushPasteCount+1);
    const copies=s.brushClipboard.map(original=>{
      const copy=clone(original);
      copy.id=uid();copy.name=`${original.name} Copy`;
      const position:Vec3=[original.position[0]+distance,original.position[1]+distance,original.position[2]];
      copy.faces=rotateBrushTextureLock(copy,{position,rotation:copy.rotation,scale:copy.scale});
      copy.position=position;
      // Pasted brushes are standalone: don't silently add geometry to an
      // existing func_door or another entity from the original selection.
      copy.entityId=undefined;
      return copy;
    });
    return {...mutate(s,[...s.project.objects,...copies]),brushPasteCount:s.brushPasteCount+1,
      selected:copies.at(-1)!.id,selectedIds:copies.map(copy=>copy.id),selectedFace:null,
      textureFaceSelection:[],geometryMode:'object',faceMode:false,editIndices:[],mode:'select'};
  }),
  duplicateSelected:()=>set(s=>{
    const originals=s.project.objects.filter(o=>s.selectedIds.includes(o.id)&&!o.locked);
    if(!originals.length)return {};
    const idMap=new Map(originals.map(o=>[o.id,uid()]));
    const copies=originals.map(original=>{
      const copy=clone(original);
      copy.id=idMap.get(original.id)!;copy.name+=' Copy';
      const nextPosition:Vec3=copy.kind==='entity'&&copy.classname==='infodecal'&&copy.decalNormal
        ?(Math.abs(copy.decalNormal[2])>.75?[copy.position[0]+16,copy.position[1]+16,copy.position[2]]:
           Math.abs(copy.decalNormal[0])>.75?[copy.position[0],copy.position[1]+16,copy.position[2]+16]:
           [copy.position[0]+16,copy.position[1],copy.position[2]+16]) as Vec3
        :[copy.position[0]+32,copy.position[1]+32,copy.position[2]];
      if(copy.kind==='brush')copy.faces=rotateBrushTextureLock(copy,{position:nextPosition,rotation:copy.rotation,scale:copy.scale});
      copy.position=nextPosition;
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
  setGraphPositions:positions=>set(s=>({project:{...s.project,graphPositions:{...s.project.graphPositions,...positions}}})),
  changeWorld:(key,value)=>set(s=>({project:{...s.project,world:{...s.project.world,[key]:value}},history:[...s.history.slice(-70),clone(s.project)],future:[]})),
  newProject:()=>set({textureFaceSelection:[],textureStudioOpen:false,texturePickerActive:false,terrainPlacement:null,cinematicPlacementFor:null,isolationSnapshot:null,project:demoProject(),placementShape:null,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,routeSolo:null,selected:null,selectedIds:[],selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false,history:[],future:[]}),
  loadProject:project=>set({textureFaceSelection:[],textureStudioOpen:false,texturePickerActive:false,terrainPlacement:null,cinematicPlacementFor:null,walkMode:false,flyMode:false,architecturePlacement:null,architectureHoverTarget:null,architecturePreviousMode:null,isolationSnapshot:null,project:clone(project),placementShape:null,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,routePlacementFor:null,routeSolo:null,selected:null,selectedIds:[],selectedFace:null,editIndices:[],geometryMode:'object',faceMode:false,history:[],future:[]}),
  setName:name=>set(s=>({project:{...s.project,name}})),
  toggleVisibility:id=>set(s=>({...mutate(s,s.project.objects.map(o=>o.id===id?{...o,hidden:!o.hidden}:o)),visibilityListIds:s.visibilityListIds.includes(id)?s.visibilityListIds:[...s.visibilityListIds,id]})),
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
  ghostHidden:false,visibilityListIds:[],focusHiddenId:null,focusHidden:id=>set({focusHiddenId:id,selected:id,selectedIds:[id],selectedFace:null,editIndices:[],cameraCommand:{action:'frame',serial:(get().cameraCommand?.serial||0)+1}}), isolationSnapshot:null,
  toggleGhostHidden:()=>set(s=>({ghostHidden:!s.ghostHidden})),
  hideSelection:()=>set(s=>s.selectedIds.length?{...mutate(s,s.project.objects.map(o=>s.selectedIds.includes(o.id)?{...o,hidden:true}:o)),visibilityListIds:[...new Set([...s.visibilityListIds,...s.selectedIds])],selected:null,selectedIds:[]}:{}),
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
    ...mutate(s,s.project.objects.map(o=>o.hidden?{...o,hidden:false}:o)),
    visibilityListIds:[...new Set([...s.visibilityListIds,...s.project.objects.filter(o=>o.hidden).map(o=>o.id)])],isolationSnapshot:null}:{}),
  unlockAll:()=>set(s=>s.project.objects.some(o=>o.locked)?{
    ...mutate(s,s.project.objects.map(o=>o.locked?{...o,locked:false}:o))}:{}),
  undo:()=>set(s=>!s.history.length?{}:{project:s.history.at(-1)!,history:s.history.slice(0,-1),future:[clone(s.project),...s.future.slice(0,70)]}),
  redo:()=>set(s=>!s.future.length?{}:{project:s.future[0],future:s.future.slice(1),history:[...s.history,clone(s.project)]}),
  setDecalAssets:(assets,wad)=>set(s=>({decalAssets:[...s.decalAssets.filter(t=>t.wad.toLowerCase()!==wad.toLowerCase()),...assets]})),
  chooseDecal:texture=>set({activeDecal:texture,resourceView:'decals',placementShape:null,placementPrefabId:null,audioPlacement:null,environmentPlacement:null,pendingNpcClass:null,drawMode:false,measureMode:false,faceMode:false,geometryMode:'object',mode:'select',flyMode:false}),
  placeDecal:(position,normal,brushId)=>set(s=>{
    if(!s.activeDecal||!s.decalAssets.some(a=>a.name===s.activeDecal))return {};
    if(position.some(v=>!Number.isFinite(v))||normal.some(v=>!Number.isFinite(v)))return {};
    const brush=s.project.objects.find(o=>o.id===brushId);
    if(!brush||brush.kind!=='brush'||brush.hidden||brush.locked)return {};
    const decal:PointEntity={id:uid(),kind:'entity',name:`Decal: ${s.activeDecal}`,classname:'infodecal',position:[...position],props:{texture:s.activeDecal},decalNormal:[...normal],decalBrushId:brushId,layer:'Decals'};
    return {...mutate(s,[...s.project.objects,decal]),selected:decal.id,selectedIds:[decal.id],selectedFace:null};
  }),
  moveDecalOnSurface:(id,position)=>set(s=>{
    const obj=s.project.objects.find(o=>o.id===id);
    if(!obj||obj.kind!=='entity'||obj.classname!=='infodecal'||obj.locked||obj.hidden||!obj.decalNormal||!obj.decalBrushId)return {};
    const brush=s.project.objects.find(b=>b.id===obj.decalBrushId);
    if(!brush||brush.kind!=='brush'||brush.hidden||brush.locked)return {};
    const valid=constrainDecalToBrush(brush,obj.decalNormal,obj.position,position);
    if(!valid||valid.every((v,i)=>Math.abs(v-obj.position[i])<.0001))return {};
    return {...mutate(s,s.project.objects.map(o=>o.id===id?{...obj,position:valid}:o)),selected:id,selectedIds:[id],selectedFace:null};
  }),
  setTextures:(assets,wad)=>set(s=>({textureAssets:[...s.textureAssets.filter(t=>t.wad!==wad),...assets],project:{...s.project,wadNames:[...new Set([...s.project.wadNames,wad])]}})),
  registerCustomNpc:definition=>set(s=>{
    const issues=validateCustomNpc(definition);if(issues.length)throw Error(issues.join('\n'));
    const list=[...(s.project.customNpcs||[]).filter(c=>c.classname!==definition.classname),structuredClone(definition)];
    return {project:{...s.project,customNpcs:list},history:[...s.history.slice(-70),clone(s.project)],future:[]};
  }),
  removeCustomNpc:classname=>set(s=>({project:{...s.project,customNpcs:(s.project.customNpcs||[]).filter(c=>c.classname!==classname)},history:[...s.history.slice(-70),clone(s.project)],future:[]})),
  setFgd:classes=>set({fgdClasses:classes,fgdLoaded:true}),
  appendLogs:lines=>set(s=>({logs:[...s.logs,...lines].slice(-1500)})),clearLogs:()=>set({logs:[]}),
  setCompileBusy:compileBusy=>set({compileBusy}),
  setSettings:changes=>set(s=>{const settings={...s.settings,...changes};localStorage.setItem('svenstudio-settings',JSON.stringify(settings));return {settings}})
}));

