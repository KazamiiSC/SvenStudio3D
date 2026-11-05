/** One-shot navigation intent. Survives the Explorer being unmounted when a
 * floating-rail shortcut first opens the dock, without persisting UI state. */
let pendingRouteFocus = false;
export function requestRouteFocus(dispatch:(type:string)=>void):void {
  pendingRouteFocus = true;
  dispatch('svenstudio:focus-routes');
}
export function consumeRouteFocus():boolean {
  const pending=pendingRouteFocus;
  pendingRouteFocus=false;
  return pending;
}
