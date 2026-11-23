import {useLayoutEffect,useRef,useState,type RefObject} from 'react';
import type {HeaderDensity} from '../engine/adaptiveUiGeometry';

const densities:HeaderDensity[]=['wide','compact','tight','minimal'];
/** Width breakpoints are a starting point; translated labels and theme fonts
 * can require more space. Collapse existing actions into the existing menu
 * when their measured bounds would leave the header.
 *
 * v2.3 HF8: the density used to only ever grow. One transient overflow (web font
 * not loaded yet, welcome screen closing, a panel resizing) left the header stuck in
 * "tight"/"minimal" until reload, which looked random at 125–175% Windows scaling.
 * Now it self-heals: when nothing overflows and a fuller density has not already
 * failed at this exact header width, it tries one step fuller after a short pause.
 * A density that overflowed at this width is retried with a growing delay (1.5 s, 3 s, 6 s… up to
 * 30 s): transient overflows during loading heal on their own, real ones are not re-checked in a loop.
 * The retry happens inside layout effects, so a failed attempt never paints. */
export function useFittingHeaderDensity(ref:RefObject<HTMLElement|null>,preferred:HeaderDensity,resetKey:string){
 const [fit,setFit]=useState(preferred);
 const failed=useRef(new Map<HeaderDensity,{width:number;at:number;delay:number}>());
 useLayoutEffect(()=>{failed.current.clear();setFit(preferred);},[preferred,resetKey]);
 useLayoutEffect(()=>{
  const header=ref.current;if(!header)return;
  let timer=0;
  const check=()=>{
   window.clearTimeout(timer);
   const bounds=header.getBoundingClientRect();
   const width=Math.round(bounds.width);
   // The usable area ends before the right padding: in the desktop app that padding holds the
   // native minimize/maximize/close buttons, which must never cover header controls.
   const style=getComputedStyle(header);
   const right=bounds.right-(parseFloat(style.paddingRight)||0),left=bounds.left+(parseFloat(style.paddingLeft)||0);
   const overflowing=Array.from(header.querySelectorAll<HTMLElement>('.titlebar-leading,.titlebar-right')).some(region=>{
    const r=region.getBoundingClientRect();
    // Touching the edge is fine (the right group is aligned to it); only going past it is an overflow.
    return r.right>right+1||r.left<left-1||region.scrollWidth>region.clientWidth+1;
   });
   if(overflowing){
    const previous=failed.current.get(fit);
    const delay=previous&&previous.width===width?Math.min(30000,previous.delay*2):1500;
    failed.current.set(fit,{width,at:Date.now(),delay});
    if(fit!=='minimal')setFit(densities[densities.indexOf(fit)+1]);
    return;
   }
   const index=densities.indexOf(fit),floor=densities.indexOf(preferred);
   if(index<=floor)return;
   const fuller=densities[index-1];
   const record=failed.current.get(fuller);
   const wait=record&&record.width===width?Math.max(180,record.at+record.delay-Date.now()):180;
   timer=window.setTimeout(()=>setFit(fuller),wait);
  };
  check();
  const observer=new ResizeObserver(check);
  observer.observe(header);
  header.querySelectorAll('.titlebar-leading,.titlebar-right').forEach(el=>observer.observe(el));
  let alive=true;
  void document.fonts?.ready?.then(()=>{if(alive)check();});
  return()=>{alive=false;window.clearTimeout(timer);observer.disconnect();};
 },[ref,fit,preferred,resetKey]);
 return fit;
}
