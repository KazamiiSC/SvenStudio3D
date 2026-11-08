import {useEditor} from './store';
import {useArchitectureMode} from './architectureModeState';
import {validateArchitectureOutline} from './engine/architectureMode';

/** Shared one-shot actions for the viewport buttons and keyboard shortcuts. */
export function startArchitectureMode(mode:'walls'|'room'){
  const editor=useEditor.getState();
  if(editor.walkMode||editor.compileBusy)throw Error('Terminá primero la compilación o la prueba de juego.');
  editor.setDrawMode(false);
  editor.setPlacementShape(null);
  editor.startArchitecturePlacement(null);
  editor.setSelected(null);
  useArchitectureMode.getState().start(mode);
}
export function finishArchitectureMode(){
  const s=useArchitectureMode.getState();
  if(s.mode==='off')return false;
  try{
    const points=validateArchitectureOutline(s.mode,s.points,s.options);
    useEditor.getState().addArchitectureLayout(s.mode,points,s.options);
    s.cancel();return true;
  }catch(e){
    useArchitectureMode.getState().setError(e instanceof Error?e.message:String(e));
    return false;
  }
}
