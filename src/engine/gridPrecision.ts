/** HF15: the *visible* ground grid is independent from the *editing* snap.
 * Values are in Svengine / GoldSrc world units and never change MAP geometry
 * until the user actually edits a brush, vertex, entity or placement. */
export const GRID_STEPS:readonly number[]=[1,2,4,8,16,32,64,128,256];
export const DEFAULT_VISIBLE_GRID=16;
export const DEFAULT_EDIT_STEP=1;
const VISIBLE_GRID_STORAGE='svenstudio:grid-visible-step-v1';
const EDIT_STEP_STORAGE='svenstudio:grid-edit-step-v1';
export function normalizeGridStep(value:number,fallback=DEFAULT_VISIBLE_GRID):number{
  return GRID_STEPS.includes(value)?value:fallback;
}
export function loadVisibleGridStep():number{
  try{const raw=localStorage.getItem(VISIBLE_GRID_STORAGE);
    return raw===null?DEFAULT_VISIBLE_GRID:normalizeGridStep(Number(raw));
  }catch{return DEFAULT_VISIBLE_GRID}
}
export function saveVisibleGridStep(value:number):void{
  try{localStorage.setItem(VISIBLE_GRID_STORAGE,String(normalizeGridStep(value)))}catch{/* Browser private-mode safe. */}
}

export function loadEditStep():number{
  try{const raw=localStorage.getItem(EDIT_STEP_STORAGE);
    return raw===null?DEFAULT_EDIT_STEP:normalizeGridStep(Number(raw),DEFAULT_EDIT_STEP);
  }catch{return DEFAULT_EDIT_STEP}
}
export function saveEditStep(value:number):void{
  try{localStorage.setItem(EDIT_STEP_STORAGE,String(normalizeGridStep(value,DEFAULT_EDIT_STEP)))}catch{/* Browser private-mode safe. */}
}
