/** Tracks whether the live project has changes not yet saved as a .svenstudio.json file.
 * Browser autosave (IndexedDB) protects against crashes; this tracks the user's explicit saves.
 * A project replaced by New/Open/Restore starts clean: those actions reset the undo history.
 */
import {create} from 'zustand';
import type {Project} from './types';

type SaveState={dirty:boolean;lastSavedAt:number|null;savedProject:Project|null;
  /** Last automatic Project History checkpoint written to Documents/SvenStudio3D/Projects/History. */
  lastBackupAt:number|null};
export const useSaveState=create<SaveState>(()=>({dirty:false,lastSavedAt:null,savedProject:null,lastBackupAt:null}));

export function markProjectSaved(project:Project){
  useSaveState.setState({dirty:false,lastSavedAt:Date.now(),savedProject:project});
}

type EditorSlice={project:Project;history:unknown[];future:unknown[]};
type Subscribable<T>={getState:()=>T;subscribe:(listener:(state:T,previous:T)=>void)=>()=>void};

/** Call once at startup with the editor store. Returns an unsubscribe function. */
export function startSaveTracking<T extends EditorSlice>(store:Subscribable<T>):()=>void{
  useSaveState.setState({savedProject:store.getState().project,dirty:false});
  const unsubscribe=store.subscribe((state,previous)=>{
    if(state.project===previous.project)return;
    if(state.history.length===0&&state.future.length===0){
      // New project, opened file or restored snapshot: nothing to save yet.
      useSaveState.setState({savedProject:state.project,dirty:false});
      return;
    }
    const dirty=state.project!==useSaveState.getState().savedProject;
    if(dirty!==useSaveState.getState().dirty)useSaveState.setState({dirty});
  });
  // Ask before closing the tab with unsaved work (the browser shows its own generic text).
  const beforeUnload=(event:BeforeUnloadEvent)=>{
    if(!useSaveState.getState().dirty)return;
    event.preventDefault();event.returnValue='';
  };
  window.addEventListener('beforeunload',beforeUnload);
  return ()=>{unsubscribe();window.removeEventListener('beforeunload',beforeUnload);};
}
