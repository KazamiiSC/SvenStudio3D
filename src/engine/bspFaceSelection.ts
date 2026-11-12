/** BSP Editor 6A — stable compiled surface identity and diagnostic selection.
 * No binary writes happen here; never infer a lump offset from the display-array index.
 */
import type {BspFace,BspMap} from './bsp';

/** BSP7 (faces lump) index, not the position after invalid faces are skipped. */
export function bspOriginalFaceIndex(face:BspFace,parsedIndex:number):number {
  return face.bspFaceIndex??parsedIndex;
}

/** A non-indexed Three.js BufferGeometry emits one faceIndex per rendered triangle. */
export function bspTriangleFacePick(triangleFaceIds:ReadonlyArray<number>|Uint32Array,triangleIndex:number|null|undefined):number|null {
  if(triangleIndex===null||triangleIndex===undefined||!Number.isInteger(triangleIndex)||triangleIndex<0||triangleIndex>=triangleFaceIds.length)return null;
  const id=triangleFaceIds[triangleIndex];
  return Number.isInteger(id)&&id>=0?id:null;
}

/** Ctrl/Shift or toolbar multi-select toggles a face; plain click replaces. */
export function bspToggleFaceSelection(selected:readonly number[],next:number,extend:boolean,max=64):number[] {
  if(!Number.isSafeInteger(next)||next<0)return [...selected];
  if(!extend)return [next];
  if(selected.includes(next))return selected.filter(id=>id!==next);
  return selected.length>=max?[...selected.slice(1),next]:[...selected,next];
}

export interface BspFaceDiagnostic {
  index:number;
  model:number;
  textureIndex:number;
  textureName:string;
  textureSize:[number,number];
  textureExternal:boolean;
  texinfoIndex:number|null;
  sharedTexinfoFaces:number;
  flags:number;
  planeIndex:number|null;
  planeSide:number|null;
  vertices:number;
  normal:[number,number,number];
  sAxis:[number,number,number,number]|null;
  tAxis:[number,number,number,number]|null;
  uvBounds:[number,number,number,number];
  lightmapSize:[number,number];
  lightmapOffset:number|null;
  lightStyles:number[];
  hasLightmap:boolean;
}
export function bspFaceDiagnostic(map:Pick<BspMap,'faces'|'textures'>,faceIndex:number):BspFaceDiagnostic|null {
  const face=map.faces.find((item,i)=>bspOriginalFaceIndex(item,i)===faceIndex);
  if(!face)return null;
  const texture=map.textures[face.texture];
  const u=face.texels.map(uv=>uv[0]),v=face.texels.map(uv=>uv[1]);
  const texinfoIndex=face.texinfoIndex??null;
  return {
    index:faceIndex,model:face.model,textureIndex:face.texture,
    textureName:texture?.name??'(missing)',textureSize:[texture?.width??0,texture?.height??0],textureExternal:!!texture?.external,
    texinfoIndex,sharedTexinfoFaces:texinfoIndex===null?0:map.faces.filter(other=>other.texinfoIndex===texinfoIndex).length,
    flags:face.flags,planeIndex:face.planeIndex??null,planeSide:face.planeSide??null,
    vertices:face.points.length,normal:face.normal,
    sAxis:face.sTexinfo??null,tAxis:face.tTexinfo??null,
    uvBounds:[Math.min(...u),Math.max(...u),Math.min(...v),Math.max(...v)],
    lightmapSize:[face.lightWidth,face.lightHeight],lightmapOffset:face.lightmapOffset??null,
    lightStyles:face.lightStyles??[],hasLightmap:!!face.lightRgb
  };
}
