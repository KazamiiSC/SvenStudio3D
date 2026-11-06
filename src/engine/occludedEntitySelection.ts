/** Select an entity marker behind solid geometry using R3F's existing ray hits.
 * No second raycast or geometry clone is required; runs only on pointer-down.
 * Visual-only markers carry entityPickerId; helper meshes and models do not.
 */
export type EntityMarkerHit={object:{userData:Record<string,unknown>}};
export function entityBehindBrushHit(
  intersections:readonly EntityMarkerHit[],
  valid:(id:string)=>boolean
):string|null{
  for(const hit of intersections){
    const id=hit.object.userData?.entityPickerId;
    if(typeof id==='string'&&id&&valid(id))return id;
  }
  return null;
}
