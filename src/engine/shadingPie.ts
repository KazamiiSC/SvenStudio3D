/** Transient VIEW modes only: these are never written to Valve 220 .MAP files. */
export const SHADING_MODES=['wireframe','solid','material','rendered'] as const;
export type ShadingMode=typeof SHADING_MODES[number];
export const SHADING_LABELS:Record<ShadingMode,string>={
  wireframe:'Wireframe',solid:'Solid',material:'Material Preview',rendered:'Rendered'
};
/** Blender-style cardinal pie: top, right, bottom, left. Dead zone avoids accidental changes. */
export function shadingPieChoice(dx:number,dy:number,deadZone=36):ShadingMode|null{
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<deadZone)return null;
  if(Math.abs(dx)>Math.abs(dy))return dx>0?'solid':'rendered';
  return dy>0?'material':'wireframe';
}
export function activeShadingMode(wireframe:boolean,solid:boolean,lighting:boolean):ShadingMode{
  return wireframe?'wireframe':solid?'solid':lighting?'rendered':'material';
}
