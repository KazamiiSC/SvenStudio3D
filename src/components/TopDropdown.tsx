import {useLayoutEffect,useRef,useState,type ReactNode,type RefObject,type CSSProperties} from 'react';
import {createPortal} from 'react-dom';

/**
 * Header dropdown rendered in document.body so overflow:hidden/auto in the
 * zoomed app, toolbar and viewport cannot clip or cover the menu.
 * getBoundingClientRect gives physical screen coordinates after CSS zoom;
 * the portal is outside the zoomed app and uses those coordinates directly.
 */
export function TopDropdown({anchor,open,onClose,align='left',width=240,id,children,className=''}:{
  anchor:RefObject<HTMLButtonElement|null>;
  open:boolean;
  onClose:()=>void;
  align?:'left'|'right';
  width?:number;
  id:string;
  children:ReactNode;
  className?:string;
}){
  const [position,setPosition]=useState({left:0,top:0});
  // Preserve the latest close callback without rerunning the positioning effect
  // on every parent render (which would otherwise cause a render loop).
  const closeRef=useRef(onClose);closeRef.current=onClose;
  useLayoutEffect(()=>{
    if(!open)return;
    const update=()=>{
      const button=anchor.current;
      if(!button)return;
      const rect=button.getBoundingClientRect();
      const available=Math.max(0,window.innerWidth-width-8);
      const rawLeft=align==='right'?rect.right-width:rect.left;
      const left=Math.max(8,Math.min(available,rawLeft));
      const top=Math.min(window.innerHeight-12,rect.bottom+6);
      setPosition(previous=>previous.left===left&&previous.top===top?previous:{left,top});
    };
    update();
    // Docks and the titlebar can scroll/resize while the dropdown is open.
    window.addEventListener('resize',update);
    document.addEventListener('scroll',update,true);
    const outside=(event:PointerEvent)=>{
      const target=event.target;
      if(!(target instanceof Node))return;
      if(anchor.current?.contains(target)||document.getElementById(id)?.contains(target))return;
      closeRef.current();
    };
    const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();closeRef.current();anchor.current?.focus();}};
    document.addEventListener('pointerdown',outside,true);
    document.addEventListener('keydown',keyboard,true);
    return()=>{
      window.removeEventListener('resize',update);
      document.removeEventListener('scroll',update,true);
      document.removeEventListener('pointerdown',outside,true);
      document.removeEventListener('keydown',keyboard,true);
    };
  },[open,anchor,align,width,id]);
  if(!open)return null;
  return createPortal(<div id={id} className={`topbar-floating-menu ${className}`} role="menu" style={{position:'fixed',left:position.left,top:position.top,width,maxWidth:'calc(100vw - 16px)','--menu-top':`${position.top}px`} as CSSProperties}>{children}</div>,document.body);
}
