/** BSP Object Extractor — preflight for the opt-in Hull 0 operation.
 * The BSP worldspawn tree cannot identify an individual authored brush/door.
 * Only an entire, separate *N brush submodel may be recovered this way.
 * Do not modify the selection or silently fall back to surface panels here.
 */
import type {BspMap} from './bsp.ts';
import {bspOriginalFaceIndex} from './bspFaceSelection.ts';

export type BspHull0SelectionPlan=
  |{kind:'empty'|'missing'|'worldspawn'|'mixed'|'too-many'|'too-few';faceIds:[]}
  |{kind:'ready'|'expand';modelIndex:number;faceIds:number[];selectedCount:number;totalFaces:number};

/** Derive the complete face set from the parsed BSP, not only the clicked
 * polygon. The actual BSP lump/tree is still validated by the extractor.
 */
export function bspHull0SelectionPlan(map:Pick<BspMap,'faces'>,selectedFaceIds:readonly number[]):BspHull0SelectionPlan{
  if(!selectedFaceIds.length)return {kind:'empty',faceIds:[]};
  const byId=new Map(map.faces.map((face,index)=>[bspOriginalFaceIndex(face,index),face]));
  const selected=selectedFaceIds.map(id=>byId.get(id));
  if(selected.some(face=>!face)||new Set(selectedFaceIds).size!==selectedFaceIds.length)return {kind:'missing',faceIds:[]};
  const models=new Set(selected.map(face=>face!.model));
  if(models.size!==1)return {kind:'mixed',faceIds:[]};
  const [modelIndex]=models;
  if(!Number.isSafeInteger(modelIndex)||modelIndex<1)return {kind:'worldspawn',faceIds:[]};
  const allFaces=map.faces.flatMap((face,index)=>face.model===modelIndex?[bspOriginalFaceIndex(face,index)]:[]);
  if(allFaces.length>256)return {kind:'too-many',faceIds:[]};
  if(allFaces.length<4)return {kind:'too-few',faceIds:[]};
  return {kind:selectedFaceIds.length===allFaces.length?'ready':'expand',modelIndex,
    faceIds:allFaces,selectedCount:selectedFaceIds.length,totalFaces:allFaces.length};
}
