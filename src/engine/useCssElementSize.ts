import {useLayoutEffect,useState,type RefObject} from 'react';
/** Stable ResizeObserver hook. Size is measured in the element's unzoomed CSS
 * coordinate system (clientWidth/clientHeight), not physical device pixels.
 * The <1 CSS pixel guard prevents ResizeObserver / React feedback loops. */
export function useCssElementSize<T extends HTMLElement>(ref:RefObject<T|null>){
  const [size,setSize]=useState({width:0,height:0});
  useLayoutEffect(()=>{
    const element=ref.current;if(!element)return;
    const update=()=>{
      const width=element.clientWidth,height=element.clientHeight;
      if(!Number.isFinite(width)||!Number.isFinite(height))return;
      setSize(old=>Math.abs(old.width-width)<1&&Math.abs(old.height-height)<1?old:{width,height});
    };
    update();
    const observer=typeof ResizeObserver==='undefined'?null:new ResizeObserver(update);
    observer?.observe(element);
    window.addEventListener('resize',update);
    return()=>{observer?.disconnect();window.removeEventListener('resize',update)};
  },[ref]);
  return size;
}
