/** Safe multi-brush fusion. GoldSrc allows a single solid only when the
 * union is convex; non-convex constructions become editor composites.
 * Composite members remain ordinary brushes in MAP/BSP and are reversible.
 */
import {mergeIntoConvexBrush} from './smartMerge';
import type {Brush} from './types';
export type FusionMode='auto'|'single'|'composite';
export type FusionPlan={kind:'single'|'composite';merged?:Brush;reason:string;inputCount:number;outputCount:number};
const metadata=(b:Brush)=>b.faces.map(f=>JSON.stringify({texture:f.texture,uShift:f.uShift??0,vShift:f.vShift??0,uScale:f.uScale??1,vScale:f.vScale??1,rotation:f.rotation??0,uAxis:f.uAxis,vAxis:f.vAxis}));
/** When each face has different WAD/UV metadata, a reduction to a single
 * brush would silently erase details. Keep the originals as a composite. */
function sameFaceMaterial(brushes:Brush[]):boolean{
  const values=brushes.flatMap(metadata);return values.every(x=>x===values[0]);
}
export function previewFusion(brushes:Brush[],mode:FusionMode='auto'):FusionPlan{
  if(brushes.length<2)throw Error('Select two or more brushes.');
  if(brushes.length>512)throw Error('Limit the operation to 512 brushes at once.');
  const first=brushes[0];
  if(brushes.some(b=>b.hidden||b.locked||b.entityId!==first.entityId))
    throw Error('Select visible, unlocked brushes from the same world or brush entity.');
  if(mode==='single'&&brushes.length>32)throw Error('Merging more than 32 solids into one could freeze the editor. Use a composite.');
  if(mode==='auto'&&brushes.length>32)return {kind:'composite',reason:'More than 32 brushes: keeping a safe composite without expensive geometry operations.',inputCount:brushes.length,outputCount:brushes.length};
  if(mode==='composite')return {kind:'composite',reason:'Editable composite: original brushes and textures remain intact.',inputCount:brushes.length,outputCount:brushes.length};
  if(!sameFaceMaterial(brushes)){
    if(mode==='single')throw Error('Different visible face textures or UV settings cannot be preserved as one brush. Use a composite.');
    return {kind:'composite',reason:'Surface materials differ; keeping the originals avoids texture/UV loss.',inputCount:brushes.length,outputCount:brushes.length};
  }
  try{
    const merged=mergeIntoConvexBrush(brushes);
    return {kind:'single',merged,reason:'The union is convex. One GoldSrc brush can represent the selected solids.',inputCount:brushes.length,outputCount:1};
  }catch(e){
    if(mode==='single')throw e;
    return {kind:'composite',reason:'Non-convex or disconnected geometry: the individual solids must remain.',inputCount:brushes.length,outputCount:brushes.length};
  }
}
