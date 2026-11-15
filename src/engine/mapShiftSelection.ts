/** HF20 HF1: select real MAP objects beneath additive pointer clicks.
 * Dedicated to object mode; UV face selection and gizmo gestures keep their
 * existing pointer handlers. Traverses only Three.js hit ancestors, not meshes.
 */
export type SelectableMapObject={id:string;hidden?:boolean;locked?:boolean};
export type MapSelectionHit={object:{userData:Record<string,unknown>;parent?:unknown;visible?:boolean}};
export function firstSelectableMapHit(hits:readonly MapSelectionHit[],objects:readonly SelectableMapObject[]):string|null{
  const allowed=new Set(objects.filter(object=>!object.hidden&&!object.locked).map(object=>object.id));
  for(const hit of hits){
    let node:unknown=hit.object;
    while(node&&typeof node==='object'){
      const data=node as {userData?:Record<string,unknown>;parent?:unknown;visible?:boolean};
      if(data.visible===false)break;
      const id=data.userData?.entityPickerId??data.userData?.brushId??data.userData?.entityId;
      if(typeof id==='string'&&allowed.has(id))return id;
      node=data.parent;
    }
  }
  return null;
}
export function canShiftSelectMapObjects(state:{geometryMode:string;faceMode:boolean;walkMode:boolean;drawMode:boolean;measureMode:boolean;modalTransform:unknown;placementShape:unknown;placementPrefabId:unknown;activeDecal:unknown;texturePickerActive:boolean;audioPlacement:unknown;environmentPlacement:unknown;architecturePlacement:unknown;pendingNpcClass:unknown},button:number,shiftKey:boolean):boolean{
  return button===0&&shiftKey&&state.geometryMode==='object'&&!state.faceMode&&!state.walkMode&&!state.drawMode&&!state.measureMode&&!state.modalTransform&&!state.placementShape&&!state.placementPrefabId&&!state.activeDecal&&!state.texturePickerActive&&!state.audioPlacement&&!state.environmentPlacement&&!state.architecturePlacement&&!state.pendingNpcClass;
}
