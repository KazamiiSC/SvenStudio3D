import {create} from 'zustand';
import type {Vec3} from './engine/types';
import {validateTrace,type CompileEvent} from './engine/compileDiagnostics';
const MAX_LOG=2000;
export interface DoctorCompileState{
 mapName:string;lines:string[];trace:Vec3[];traceVisible:boolean;traceOrigin:string;
 focus:Vec3|null;focusSerial:number;
 beginBuild:(name:string)=>void;ingest:(event:CompileEvent)=>void;
 loadTrace:(points:Vec3[],origin:string)=>void;setTraceVisible:(visible:boolean)=>void;clearTrace:()=>void;
 focusTrace:(index:number)=>void;
}
export const useMapDoctorState=create<DoctorCompileState>((set,get)=>({
 mapName:'',lines:[],trace:[],traceVisible:false,traceOrigin:'',focus:null,focusSerial:0,
 beginBuild:mapName=>set({mapName,lines:[],trace:[],traceVisible:false,traceOrigin:'',focus:null}),
 ingest:event=>set(state=>{
  if(event.type==='diagnostic'&&event.kind==='leak'){
    const points=validateTrace(event.points);
    return points.length?{trace:points,traceVisible:true,traceOrigin:'compiler',lines:[...state.lines,event.message].slice(-MAX_LOG)}:{};
  }
  if(event.type==='log'||event.type==='error'||event.type==='warning'||event.type==='stage')return {lines:[...state.lines,event.message].slice(-MAX_LOG)};
  return {};
 }),
 loadTrace:(points,origin)=>{
  const valid=validateTrace(points);
  if(!valid.length)return;
  set({trace:valid,traceVisible:true,traceOrigin:origin});
 },
 setTraceVisible:traceVisible=>set({traceVisible}),
 clearTrace:()=>set({trace:[],traceVisible:false,traceOrigin:'',focus:null}),
 focusTrace:index=>{
  const point=get().trace[index];if(point)set(state=>({focus:[...point],focusSerial:state.focusSerial+1}));
 }
}));
