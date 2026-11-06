import type {MapObject} from '../engine/types';
import {planBrushEntityDetach} from '../engine/brushEntityDetach';

/** Ask before discarding the last linked entity's keyvalues. Geometry is always preserved. */
export function confirmBrushDetach(objects:readonly MapObject[],ids:readonly string[],wholeEntity:boolean,t:(key:string)=>string):boolean{
  try{
    const plan=planBrushEntityDetach(objects,ids,wholeEntity);
    if(!plan.brushIds.length)return false;
    if(plan.removedEntities.length){
      const names=plan.removedEntities.map(e=>`${e.classname}${e.props.targetname?` (${e.props.targetname})`:''}`).join(', ');
      return window.confirm(`${t('Convert brushes to worldspawn?')}\n\n${plan.brushIds.length} ${t('brushes')}\n${t('The last brush of these entities will be detached, so their keyvalues and connections will be removed:')}\n${names}\n\n${t('You can undo this operation with Ctrl+Z.')}`);
    }
    return true;
  }catch(error){window.alert(String(error instanceof Error?error.message:error));return false;}
}
