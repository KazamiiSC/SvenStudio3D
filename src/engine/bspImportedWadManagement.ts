/** Stage 6E: remove a session-imported WAD without destabilizing temporary
 * texture indices in pending BSP surface edits or the undo/redo history.
 * A WAD that is referenced by ANY history state cannot be removed.
 */
import type {BspSurfaceOverrides} from './bspSurfaceEdit.ts';
export interface SessionWadTexture {name:string;width:number;height:number;wad:string}
export interface BspWadRemovalPlan {
  retained:SessionWadTexture[];
  states:BspSurfaceOverrides[];
  selectedTexture:number;
  removedTextures:number;
}
const sameWad=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
/** Throws if removing the WAD could break a pending or undoable edit. */
export function planBspImportedWadRemoval(
  originalCount:number, choices:readonly SessionWadTexture[], targetWad:string,
  states:readonly BspSurfaceOverrides[], selectedTexture=-1, replacementChoices?:readonly SessionWadTexture[],
):BspWadRemovalPlan {
  if(!Number.isSafeInteger(originalCount)||originalCount<0||!targetWad.trim())throw Error('Invalid WAD library state.');
  const retained=replacementChoices?[...replacementChoices]:choices.filter(choice=>!sameWad(choice.wad,targetWad));
  if(retained.some(choice=>sameWad(choice.wad,targetWad)))throw Error('Removed WAD is still present in the replacement texture directory.');
  const removedTextures=choices.filter(choice=>sameWad(choice.wad,targetWad)).length;
  const remap=(index:number,strict:boolean)=>{
    if(index<originalCount)return index;
    const old=choices[index-originalCount];
    if(!old)throw Error('An edit references an unknown imported texture.');
    const replacement=retained.findIndex(choice=>choice.name===old.name&&choice.width===old.width&&choice.height===old.height&&sameWad(choice.wad,old.wad));
    if(replacement<0){
      if(strict)throw Error(`WAD ${targetWad} is used by pending or undoable surface edits. Revert those edits before removing it.`);
      return -1;
    }
    return originalCount+replacement;
  };
  const corrected=states.map(state=>Object.fromEntries(Object.entries(state).map(([face,edit])=>[face,{...edit,texture:remap(edit.texture,true)}])));
  return {retained,states:corrected,selectedTexture:selectedTexture<0?-1:remap(selectedTexture,false),removedTextures};
}
