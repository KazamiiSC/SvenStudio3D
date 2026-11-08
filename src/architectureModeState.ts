/** Transient draw state, intentionally outside the editable Project/history.
 * No selector returns a freshly allocated []: compatible with Zustand 5. */
import {create} from 'zustand';
import {snapArchitecturePoint,type ArchitecturePoint,type ArchitectureLayoutOptions,DEFAULT_LAYOUT_OPTIONS} from './engine/architectureMode';

type Mode='off'|'walls'|'room';
interface DrawState{
  mode:Mode;editId:string|null;points:ArchitecturePoint[];hover:ArchitecturePoint|null;options:ArchitectureLayoutOptions;step:number;error:string;
  edit:(id:string|null)=>void;
  start:(mode:Exclude<Mode,'off'>)=>void;cancel:()=>void;setOptions:(options:Partial<ArchitectureLayoutOptions>)=>void;
  setStep:(step:number)=>void;move:(point:ArchitecturePoint)=>void;point:(point:ArchitecturePoint)=>void;undoPoint:()=>void;setError:(error:string)=>void;
}
const EMPTY_POINTS:ArchitecturePoint[]=[];
export const useArchitectureMode=create<DrawState>((set,get)=>({
  mode:'off',editId:null,points:EMPTY_POINTS,hover:null,options:{...DEFAULT_LAYOUT_OPTIONS},step:16,error:'',
  edit:editId=>set({mode:'off',editId,error:'',points:EMPTY_POINTS,hover:null}),
  start:mode=>set({mode,editId:null,points:EMPTY_POINTS,hover:null,error:''}),
  cancel:()=>set({mode:'off',points:EMPTY_POINTS,hover:null,error:''}),
  setOptions:options=>set(s=>({options:{...s.options,...options}})),
  setStep:step=>set({step:Math.max(1,Math.min(256,step))}),
  move:point=>set(s=>{
    if(s.mode==='off')return s;
    const snapped=snapArchitecturePoint(point,s.points.at(-1)||null,s.step);
    if(s.hover?.[0]===snapped[0]&&s.hover[1]===snapped[1])return s;
    return {hover:snapped};
  }),
  point:point=>set(s=>{
    if(s.mode==='off')return s;
    const p=snapArchitecturePoint(point,s.points.at(-1)||null,s.step);
    if(s.points.length&&s.points.at(-1)![0]===p[0]&&s.points.at(-1)![1]===p[1])return s;
    if(s.points.length>=48)return {error:'Límite de 48 esquinas por trazado.'};
    return {points:[...s.points,p],hover:null,error:''};
  }),
  undoPoint:()=>set(s=>({points:s.points.slice(0,-1),error:''})),
  setError:error=>set({error})
}));
/** Disable conflicting placement modes only when the user activates drawing. */
export function beginArchitectureDrawing(mode:'walls'|'room'){
  const app=useArchitectureMode.getState();app.start(mode);
}
