import {useEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import type {MapLabelMode} from '../engine/mapEntityLabels';
type Props={labelsEnabled:boolean;mode:MapLabelMode};

/** FPS-only MAP monitor. DOM lives inside the movable HUD widget, not above
 * the viewport's mouse hints or scene labels. Never updates React/store. */
export function MapPerformanceMonitor(_props:Props){
  const {gl}=useThree();
  const element=useRef<HTMLDivElement|null>(null);
  const values=useRef({frames:0,start:0});
  useEffect(()=>{
    const parent=gl.domElement.closest('.viewport-frame')?.querySelector<HTMLElement>('[data-map-fps-mount]');
    if(!parent)return;
    const node=document.createElement('div');
    node.className='map-performance-monitor';
    node.setAttribute('role','status');
    node.setAttribute('aria-label','FPS');
    node.setAttribute('aria-live','off');
    node.setAttribute('data-map-performance','true');
    node.textContent='— FPS';
    parent.appendChild(node);element.current=node;
    values.current={frames:0,start:0};
    return()=>{node.remove();if(element.current===node)element.current=null};
  },[gl]);
  useFrame(({clock})=>{
    const node=element.current;if(!node)return;
    const v=values.current;
    if(v.start===0)v.start=clock.elapsedTime;
    v.frames++;
    const elapsed=clock.elapsedTime-v.start;
    if(elapsed<1)return;
    const fps=Math.round(v.frames/Math.max(.01,elapsed));
    node.textContent=`${fps} FPS`;
    v.frames=0;v.start=clock.elapsedTime;
  });
  return null;
}
