/** BSP Viewer/Editor panel widths. Bounds reserve a usable 3D viewport on
 * narrow windows and tolerate browsers where persistent storage is blocked. */
export type BspPaneSide='left'|'right';
const MIN_WIDTH:Record<BspPaneSide,number>={left:165,right:220};
const MAX_WIDTH:Record<BspPaneSide,number>={left:470,right:480};
const DEFAULT_WIDTH:Record<BspPaneSide,number>={left:222,right:328};
export function bspPaneWidth(side:BspPaneSide,requested:number,containerWidth:number,otherPaneWidth:number):number{
  const min=MIN_WIDTH[side];
  const viewport=Math.max(320,Number.isFinite(containerWidth)?containerWidth:1280);
  const other=Math.max(0,Number.isFinite(otherPaneWidth)?otherPaneWidth:0);
  const max=Math.max(min,Math.min(MAX_WIDTH[side],viewport-other-340-16));
  return Math.round(Math.min(max,Math.max(min,Number.isFinite(requested)?requested:DEFAULT_WIDTH[side])));
}
export function readBspPaneWidth(side:BspPaneSide):number{
  try{
    const width=Number(localStorage.getItem(`sven-bsp-${side}-pane-width`));
    return Number.isFinite(width)&&width>=MIN_WIDTH[side]&&width<=MAX_WIDTH[side]
      ?Math.round(width):DEFAULT_WIDTH[side];
  }catch{return DEFAULT_WIDTH[side]}
}
