/** Volatile UI-only state. Not stored in project, history or Valve 220 export. */
import {create} from 'zustand';
export type MotionPreviewState={sourceId:string|null;progress:number;playing:boolean;speed:number;showPath:boolean;open:(id:string)=>void;close:()=>void;setProgress:(n:number)=>void;setPlaying:(v:boolean)=>void;setSpeed:(n:number)=>void;togglePath:()=>void};
export const useMotionPreview=create<MotionPreviewState>((set)=>({
 sourceId:null,progress:0,playing:false,speed:1,showPath:true,
 open:(sourceId)=>set({sourceId,progress:0,playing:false}),close:()=>set({sourceId:null,progress:0,playing:false}),
 setProgress:(n)=>set({progress:Math.max(0,Math.min(1,Number.isFinite(n)?n:0))}),setPlaying:(playing)=>set({playing}),
 setSpeed:(speed)=>set({speed:Math.max(.25,Math.min(4,Number.isFinite(speed)?speed:1))}),
 togglePath:()=>set(s=>({showPath:!s.showPath})),
}));
