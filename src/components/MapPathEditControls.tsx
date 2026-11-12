/** Optional control-point layer inside the real MAP viewport. The active route
 * remains an ordinary collection of brushes until a complete, valid route is
 * committed at the end of a drag. No geometry is mutated per pointer frame. */
import {useEffect,useRef,useState} from 'react';
import {useEditor} from '../store';
import type {Vec3} from '../engine/types';
import {Path3DControls} from './Path3DControls';
export function MapPathEditControls(){
  const editId=useEditor(s=>s.pathEditingId);
  const group=useEditor(s=>s.project.pathGroups?.find(item=>item.id===s.pathEditingId));
  const axis=useEditor(s=>s.pathEditAxis);
  const commit=useEditor(s=>s.updatePathStructure);
  const [selected,setSelected]=useState(0);
  const [points,setPoints]=useState<Vec3[]>([]);
  const current=useRef<Vec3[]>([]);
  const [dragging,setDragging]=useState(false);
  useEffect(()=>{
    current.current=group?.options.points?.map(p=>[...p] as Vec3)||[];
    setPoints(current.current);setSelected(index=>Math.min(index,Math.max(0,current.current.length-1)));
  },[group?.id,group?.options]);
  useEffect(()=>{
    if(!editId)return;
    const onKey=(event:KeyboardEvent)=>{
      if(event.key!=='Escape')return;
      event.preventDefault();event.stopImmediatePropagation();useEditor.getState().setPathEditing(null);
    };
    window.addEventListener('keydown',onKey,true);
    return()=>window.removeEventListener('keydown',onKey,true);
  },[editId]);
  if(!editId||!group||points.length<2)return null;
  const update=(next:Vec3[])=>{
    try{commit(group.id,{...group.options,points:next});return true}
    catch(error){
      const message=String(error instanceof Error?error.message:error);
      useEditor.getState().appendLogs([`Path & Structure Studio: ${message}`]);
      window.alert(message);return false;
    }
  };
  return <Path3DControls points={points} axis={axis} activePoint={selected}
    onSelect={setSelected} onBeginDrag={()=>{}} onDraggingChange={setDragging}
    onMove={(index,point)=>{const next=current.current.map((old,i)=>i===index?point:old);current.current=next;setPoints(next)}}
    onEndDrag={()=>{
      if(!group.options.points.some((p,i)=>p.some((v,j)=>v!==current.current[i]?.[j])))return;
      if(!update(current.current)){current.current=group.options.points.map(p=>[...p] as Vec3);setPoints(current.current)}
    }}
    onInsertAfter={index=>{
      if(points.length>=48)return;
      const a=current.current[index],b=current.current[index+1];
      const mid=a.map((v,i)=>Math.round((v+b[i])/16)*8) as Vec3;
      const next=[...current.current.slice(0,index+1),mid,...current.current.slice(index+1)];
      if(update(next)){current.current=next;setPoints(next);setSelected(index+1)}
    }}/>
}
