import {create} from 'zustand';
import type {Vec3} from './engine/types';
import {cs16ApplyBatch} from './engine/csMapStudio';
import {cs16CreateAt,type CS16PlacementRequest} from './engine/csMapPlacement';
import {useEditor} from './store';

type Feedback={key:'placed'|'invalid'|'profile';count?:number};
type PlacementState={
 studioOpen:boolean;showMarkers:boolean;setStudioOpen:(open:boolean)=>void;setShowMarkers:(enabled:boolean)=>void;
 request:CS16PlacementRequest|null;hover:Vec3|null;picked:{at:Vec3;seq:number}|null;
 feedback:Feedback|null;
 arm:(request:CS16PlacementRequest)=>void;rotate:(degrees:number)=>void;cancel:()=>void;
 hoverAt:(point:Vec3|null)=>void;commit:(at:Vec3)=>void;
};
/** Transient placement mode deliberately lives outside the saved project. */
export const useCSMapPlacement=create<PlacementState>((set,get)=>({
 studioOpen:false,showMarkers:true,setStudioOpen:open=>set({studioOpen:open}),setShowMarkers:enabled=>set({showMarkers:enabled}),
 request:null,hover:null,picked:null,feedback:null,
 arm:request=>set({request,hover:null,feedback:null}),
 rotate:degrees=>set(s=>s.request&&s.request.action==='paint'&&s.request.tool!=='zone'&&Number.isFinite(degrees)
  ?{request:{...s.request,yaw:((s.request.yaw+degrees)%360+360)%360}}:{}),
 cancel:()=>set({request:null,hover:null,feedback:null}),
 hoverAt:point=>set(s=>{
  if((!point&&!s.hover)||(point&&s.hover&&point.every((v,i)=>v===s.hover![i])))return s;
  return {hover:point};
 }),
 commit:at=>{
  const {request}=get();if(!request)return;
  const editor=useEditor.getState();
  if(editor.settings.gameProfile!=='cs16'||editor.walkMode){set({request:null,hover:null,feedback:{key:'profile'}});return}
  if(request.action==='pick'){
   set(s=>({picked:{at:[...at],seq:(s.picked?.seq||0)+1},request:null,hover:null,feedback:null}));return;
  }
  try{
   const objects=cs16CreateAt(request,at);
   cs16ApplyBatch(editor.project.objects,objects);
   editor.addObjects(objects);
   set({feedback:{key:'placed',count:objects.length},request:request.repeat?request:null,hover:request.repeat?at:null});
  }catch{set({feedback:{key:'invalid'},request:null,hover:null})}
 }
}));
