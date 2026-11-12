import {useLayoutEffect,useState,type RefObject} from 'react';
import type {HeaderDensity} from '../engine/adaptiveUiGeometry';

const densities:HeaderDensity[]=['wide','compact','tight','minimal'];
/** Width breakpoints are a starting point; translated labels and theme fonts
 * can require more space. Collapse existing actions into the existing menu
 * when their measured bounds would leave the header. */
export function useFittingHeaderDensity(ref:RefObject<HTMLElement|null>,preferred:HeaderDensity,resetKey:string){
 const [fit,setFit]=useState(preferred);
 useLayoutEffect(()=>setFit(preferred),[preferred,resetKey]);
 useLayoutEffect(()=>{
  const header=ref.current;if(!header)return;
  const check=()=>{
   const bounds=header.getBoundingClientRect();
   const overflowing=Array.from(header.querySelectorAll<HTMLElement>('.titlebar-leading,.titlebar-right')).some(region=>{
    const r=region.getBoundingClientRect();return r.right>bounds.right-2||r.left<bounds.left||region.scrollWidth>region.clientWidth+1;
   });
   if(overflowing)setFit(current=>densities[Math.min(densities.length-1,densities.indexOf(current)+1)]);
  };
  check();const observer=new ResizeObserver(check);
  observer.observe(header);header.querySelectorAll('.titlebar-leading,.titlebar-right').forEach(el=>observer.observe(el));
  return()=>observer.disconnect();
 },[ref,fit,preferred,resetKey]);
 return fit;
}
