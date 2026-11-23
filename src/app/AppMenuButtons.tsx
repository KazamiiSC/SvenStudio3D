/** Top-bar and toolbar buttons extracted from App.tsx (v2.3 HF5). */
import {useEffect,useState} from 'react';
import type React from 'react';
import {Maximize2,Minimize2} from 'lucide-react';
import {useEditor} from '../store';
import {bindFullscreenEscapeHold} from '../engine/fullscreenEscapeHold';
import {useT} from '../i18n';

export function ToolButton({active=false,title,children,onClick,disabled=false}:{active?:boolean,title:string,children:React.ReactNode,onClick:()=>void,disabled?:boolean}){
  return <button title={title} className={`tool-button ${active?'active':''}`} onClick={onClick} disabled={disabled}>{children}</button>;
}
export function MenuButton({children,onClick}:{children:React.ReactNode,onClick:()=>void}){return <button className="menu-action" onClick={onClick}>{children}</button>}
/** Persistent top-bar entry for the app-wide fullscreen/keyboard-lock mode. */
export function FullscreenMenuButton(){
  const t=useT();
  const [fullscreen,setFullscreen]=useState(false);
  useEffect(()=>{
    const sync=()=>{
      const active=Boolean(document.fullscreenElement);
      setFullscreen(active);
      if(!active){
        try{(navigator as Navigator & {keyboard?:{unlock?:()=>void}}).keyboard?.unlock?.()}catch{/* optional API */}
      }
    };
    const guardBookmark=(event:KeyboardEvent)=>{
      // Chrome may still reserve shortcuts: prevent only if the browser delivers them.
      if(document.fullscreenElement&&(event.code==='Escape'||event.ctrlKey&&event.code==='KeyD'))event.preventDefault();
    };
    document.addEventListener('fullscreenchange',sync);
    window.addEventListener('keydown',guardBookmark,true);
    // Browser Keyboard Lock keeps short Escape available for cancelling tools.
    // Add an editor-controlled 1.5-second hold without touching Chrome's native safety exit.
    const unbindEscapeHold=bindFullscreenEscapeHold(document,window);
    sync();
    return()=>{unbindEscapeHold();document.removeEventListener('fullscreenchange',sync);window.removeEventListener('keydown',guardBookmark,true)};
  },[]);
  const toggle=async()=>{
    if(document.fullscreenElement){
      try{await document.exitFullscreen()}catch{/* browser can refuse */}
      return;
    }
    try{await document.documentElement.requestFullscreen({keyboardLock:'browser'} as FullscreenOptions)}
    catch{
      try{await document.documentElement.requestFullscreen()}catch{return}
    }
    try{
      const keyboard=(navigator as Navigator & {keyboard?:{lock?:(keys?:string[])=>Promise<void>}}).keyboard;
      if(!keyboard?.lock)throw Error('Keyboard Lock API is not supported or unavailable');
      await keyboard.lock(['Escape','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyR','KeyF','KeyP','KeyX','KeyY','KeyZ','Digit0']);
    }catch(error){
      useEditor.getState().appendLogs([`Fullscreen: Keyboard Lock (Escape) unavailable: ${String(error)}. The browser may exit fullscreen with a short Esc.`]);
    }
  };
  return <button type="button" className={`top-nav fullscreen-nav ${fullscreen?'chosen':''}`}
    title={t('Fullscreen keyboard lock (when available)')} aria-pressed={fullscreen}
    onClick={()=>void toggle()}>
    {fullscreen?<Minimize2 size={15}/>:<Maximize2 size={15}/>}
    <span>{t(fullscreen?'Exit fullscreen':'Fullscreen')}</span>
  </button>;
}
