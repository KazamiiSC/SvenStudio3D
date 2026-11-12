import {useEffect,useId,useMemo,useRef,useState} from 'react';
import {Crosshair,Hand,Minus,Plus} from 'lucide-react';
import type {Vec3} from '../engine/types';
import {planFitPoints,planPanFromDrag,planScreenToWorld,planViewBox,planZoomAt,type PlanCamera,type PlanSize} from '../engine/pathPlanCamera';
import {useT} from '../i18n';

export type PathOutline={road:string;left:string;right:string;center:string}|null;
type Props={points:Vec3[];outline:PathOutline;kind:string;sidewalkWidth:number;profileWidth:number;activePoint:number;onSelect:(index:number)=>void;onBeginDrag:()=>void;onMove:(index:number,x:number,y:number)=>void;onEndDrag:()=>void;onDelete:(index:number)=>void;onAdd:(x:number,y:number)=>void};
const snap=(v:number)=>Math.round(v/8)*8;
const initial:PlanCamera={centerX:0,centerY:0,spanY:512};
export function PathPlanEditor({points,outline,kind,sidewalkWidth,profileWidth,activePoint,onSelect,onBeginDrag,onMove,onEndDrag,onDelete,onAdd}:Props){
  const t=useT();
  const svgRef=useRef<SVGSVGElement|null>(null);
  const [size,setSize]=useState<PlanSize>({width:0,height:0});
  const [camera,setCamera]=useState<PlanCamera>(initial);
  const [cursor,setCursor]=useState<[number,number]|null>(null);
  const [panning,setPanning]=useState(false);
  const panRef=useRef<{startX:number;startY:number;camera:PlanCamera}|null>(null);
  const dragRef=useRef<number|null>(null);
  const ignoreClick=useRef(false);
  const firstFit=useRef(false);
  const patternId=useId().replace(/:/g,'');
  const boundsRadius=profileWidth/2+(kind==='road'?sidewalkWidth:0)+24;
  useEffect(()=>{
    const element=svgRef.current;if(!element)return;
    const update=()=>setSize({width:Math.max(1,element.clientWidth),height:Math.max(1,element.clientHeight)});
    update();
    const observer=new ResizeObserver(update);observer.observe(element);return()=>observer.disconnect();
  },[]);
  useEffect(()=>{
    if(firstFit.current||size.width<100||size.height<100)return;
    firstFit.current=true;
    setCamera(planFitPoints(points.map(p=>[p[0],p[1]]),boundsRadius,size));
  },[size.width,size.height,points,boundsRadius]);
  // React delegates wheel handlers as passive in some browsers. Use a native
  // non-passive listener so zoom never scrolls the surrounding studio panel.
  useEffect(()=>{
    const element=svgRef.current;if(!element)return;
    const wheel=(event:WheelEvent)=>{
      event.preventDefault();
      const rect=element.getBoundingClientRect();
      setCamera(current=>planZoomAt(current,{width:rect.width,height:rect.height},event.clientX-rect.left,event.clientY-rect.top,event.deltaY>0?1.18:1/1.18));
    };
    element.addEventListener('wheel',wheel,{passive:false});
    return()=>element.removeEventListener('wheel',wheel);
  },[]);
  const box=useMemo(()=>planViewBox(camera,size),[camera,size]);
  const fromEvent=(event:{clientX:number;clientY:number})=>{
    const rect=svgRef.current!.getBoundingClientRect();
    return planScreenToWorld(camera,{width:rect.width,height:rect.height},event.clientX-rect.left,event.clientY-rect.top);
  };
  const pointerMove=(event:React.PointerEvent<SVGSVGElement>)=>{
    if(panRef.current){
      const {startX,startY,camera:original}=panRef.current;
      setCamera(planPanFromDrag(original,size,event.clientX-startX,event.clientY-startY));
      return;
    }
    setCursor(fromEvent(event));
  };
  const fit=()=>setCamera(planFitPoints(points.map(p=>[p[0],p[1]]),boundsRadius,size));
  const scale=Math.max(1,Math.round(box.width/Math.max(1,size.width)*100)/100);
  const beginPan=(event:React.PointerEvent<SVGSVGElement>)=>{
    if(event.button!==1&&!(event.button===0&&event.shiftKey))return;
    event.preventDefault();event.stopPropagation();if(event.button===0)ignoreClick.current=true;
    panRef.current={startX:event.clientX,startY:event.clientY,camera};setPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const endPan=(event:React.PointerEvent<SVGSVGElement>)=>{
    if(!panRef.current)return;
    panRef.current=null;setPanning(false);
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return <div className="path-plan-editor">
    <div className="path-plan-toolbar" role="toolbar" aria-label={t('Route navigation')}>
      <span><Hand size={13}/>{t('Wheel to zoom · Middle-drag or Shift-drag to pan')}</span>
      <button type="button" title={t('Zoom out')} aria-label={t('Zoom out')} onClick={()=>setCamera(v=>planZoomAt(v,size,size.width/2,size.height/2,1.25))}><Minus size={15}/></button>
      <span className="path-plan-scale">{scale} u/px</span>
      <button type="button" title={t('Zoom in')} aria-label={t('Zoom in')} onClick={()=>setCamera(v=>planZoomAt(v,size,size.width/2,size.height/2,0.8))}><Plus size={15}/></button>
      <button type="button" onClick={fit} title={t('Fit entire route')}><Crosshair size={15}/>{t('Fit route')}</button>
    </div>
    <svg ref={svgRef} className="path-plan-svg" viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} preserveAspectRatio="none"
      aria-label={t('Draw and drag path control points')} role="img" style={{cursor:panning?'grabbing':'crosshair',touchAction:'none'}}
      onPointerDown={beginPan} onPointerMove={pointerMove} onPointerUp={endPan} onPointerCancel={endPan}
      onContextMenu={e=>e.preventDefault()}
      onClick={e=>{if(ignoreClick.current){ignoreClick.current=false;return;}if(e.shiftKey||e.button!==0)return;const [x,y]=fromEvent(e);onAdd(snap(x),snap(y));}}>
      <defs>
        <pattern id={`${patternId}-minor`} x="0" y="0" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0 H0 V32" stroke="#2c465b" strokeWidth="1" fill="none"/></pattern>
        <pattern id={`${patternId}-major`} x="0" y="0" width="128" height="128" patternUnits="userSpaceOnUse"><rect width="128" height="128" fill={`url(#${patternId}-minor)`}/><path d="M128 0 H0 V128" stroke="#51728a" strokeWidth="1.5" fill="none"/></pattern>
      </defs>
      <rect x={box.x} y={box.y} width={box.width} height={box.height} fill="#152632"/>
      <rect x={box.x} y={box.y} width={box.width} height={box.height} fill={`url(#${patternId}-major)`}/>
      <g pointerEvents="none">
        <line x1="0" x2="0" y1={box.y} y2={box.y+box.height} stroke="#76b9a3" strokeWidth="1.2" strokeDasharray="8 6" opacity=".48"/>
        <line y1="0" y2="0" x1={box.x} x2={box.x+box.width} stroke="#76b9a3" strokeWidth="1.2" strokeDasharray="8 6" opacity=".48"/>
        {outline&&<>
          {kind==='road'&&sidewalkWidth>0&&<><polygon points={outline.left} fill="#8c9da6" stroke="#b7c7ce" strokeWidth="1"/><polygon points={outline.right} fill="#8c9da6" stroke="#b7c7ce" strokeWidth="1"/></>}
          {outline.road&&<polygon points={outline.road} fill={kind==='vent'?'#3e8599':kind==='pipe'?'#758c9f':'#444f60'} stroke="#64d9fa" strokeWidth="2"/>}
          <polyline points={outline.center} fill="none" stroke="#d9e6eb" strokeDasharray="10 9" strokeWidth="1.8"/>
        </>}
      </g>
      {points.map(([x,y,z],index)=><g key={index}>
        <circle cx={x} cy={y} r={activePoint===index?14:11} fill={activePoint===index?'#ffdb78':'#ffad58'} stroke="#122333" strokeWidth="2" style={{cursor:'grab',touchAction:'none'}}
          onClick={e=>{e.stopPropagation();onSelect(index)}}
          onPointerDown={e=>{if(e.button!==0||e.shiftKey)return;e.stopPropagation();onBeginDrag();dragRef.current=index;onSelect(index);e.currentTarget.setPointerCapture(e.pointerId)}}
          onPointerMove={e=>{if(dragRef.current!==index)return;e.stopPropagation();const [px,py]=fromEvent(e);onMove(index,snap(px),snap(py));}}
          onPointerUp={e=>{if(dragRef.current!==index)return;e.stopPropagation();dragRef.current=null;onEndDrag();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
          onPointerCancel={e=>{if(dragRef.current!==index)return;dragRef.current=null;onEndDrag();if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId)}}
          onContextMenu={e=>{e.preventDefault();e.stopPropagation();onDelete(index)}}/>
        <text x={x+12} y={y-11} fill="#fff" fontSize="13" style={{pointerEvents:'none'}}>{index+1} <tspan fill="#9ed4e5">{z!==0?`Z:${Math.round(z)}`:''}</tspan></text>
      </g>)}
    </svg>
    <div className="path-plan-status"><span>{t('Click to add point · Drag handles to edit')}</span><span>{cursor?`X ${Math.round(cursor[0])} · Y ${Math.round(cursor[1])}`:'X — · Y —'} · {points.length}/48 {t('points')}</span></div>
  </div>;
}
