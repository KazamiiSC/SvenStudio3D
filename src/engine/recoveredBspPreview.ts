/** Preview-only metadata for MAPs reconstructed from a BSP.
 * The old *_recovered name/WAD heuristics remain for MAP files exported
 * before HF17 HF5. The explicit flag survives project JSON renaming/saving.
 * Neither detection nor NULL visibility alters MAP geometry or compilation.
 */
import type {Project} from './types';

export function isRecoveredBspProject(project:Pick<Project,'name'|'world'|'recoveredFromBsp'>):boolean{
  if(project.recoveredFromBsp===true)return true;
  return /_recovered(?:\.map)?$/i.test(project.name) ||
    /(?:^|[;\\/])[^;\\/]+_recovered\.wad(?:;|$)/i.test(project.world?.wad||'');
}
