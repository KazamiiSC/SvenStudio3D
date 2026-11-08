/** Presentation-only measurements for the MAP editor. Coordinates are CSS layout
 * pixels *inside* the scaled workspace, not physical monitor pixels. This is
 * intentionally independent of devicePixelRatio (which is for canvas resolution).
 * Saved dock sizes are not changed when the browser/DPI changes. */
export type AdaptiveDockInput = {
  width:number;height:number;left:number;right:number;top:number;bottom:number;
  enabled?:boolean;
};
export type AdaptiveDockResult = {
  left:number;right:number;top:number;bottom:number;
  compact:boolean;tight:boolean;short:boolean;
};
const finite=(n:number)=>Number.isFinite(n)?Math.max(0,n):0;
export function measureAdaptiveDocks(input:AdaptiveDockInput):AdaptiveDockResult {
  const width=finite(input.width),height=finite(input.height);
  const requestedLeft=finite(input.left),requestedRight=finite(input.right);
  const requestedTop=finite(input.top),requestedBottom=finite(input.bottom);
  // Allow a large modeling viewport without forcing fixed minimum panel widths.
  // On narrower screens, preserve access to both panels, including their dock
  // controls; presentation alone shrinks, persisted preferences remain intact.
  const reservedWidth=input.enabled===false?270:Math.min(640,Math.max(300,width*.48));
  const budgetWidth=Math.max(0,width-reservedWidth-24); // splitters + padding
  const totalWidth=requestedLeft+requestedRight;
  const widthFactor=totalWidth>0?Math.min(1,budgetWidth/totalWidth):1;
  const reservedHeight=input.enabled===false?240:Math.min(400,Math.max(200,height*.42));
  const budgetHeight=Math.max(0,height-reservedHeight-20);
  const totalHeight=requestedTop+requestedBottom;
  const heightFactor=totalHeight>0?Math.min(1,budgetHeight/totalHeight):1;
  return {
    left:Math.floor(requestedLeft*widthFactor),
    right:Math.floor(requestedRight*widthFactor),
    top:Math.floor(requestedTop*heightFactor),
    bottom:Math.floor(requestedBottom*heightFactor),
    compact:input.enabled!==false&&width<1650,
    tight:input.enabled!==false&&width<1100,
    short:input.enabled!==false&&height<660
  };
}
