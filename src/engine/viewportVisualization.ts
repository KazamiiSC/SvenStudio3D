/** Viewport visual modes. A cached SC-RAD bake is read-only and may be reused. */
export type VisualizationMode='normal'|'quick'|'baked';

export function resolveVisualizationMode(trueLightingOpen:boolean,approximateLighting:boolean):VisualizationMode{
  return trueLightingOpen?'baked':approximateLighting?'quick':'normal';
}

/** Do not start a second SC-RAD job or overwrite a cached bake just by reopening. */
export function shouldBuildLightingPreview(hasBakedMap:boolean,previewBusy:boolean,compileBusy:boolean):boolean{
  return !hasBakedMap&&!previewBusy&&!compileBusy;
}
