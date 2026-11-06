import {useEffect,useMemo,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';
import type {MapLabelSettings} from '../engine/mapEntityLabels';
import {layoutMapLabels,mapLabelPriority,mapLabelRefreshDue} from '../engine/mapEntityLabels';
import type {EntityAppearanceSettings} from '../engine/entityAppearance';

export type MapLabelAnchor={id:string;position:THREE.Vector3;classname:string;main:string;targetname?:string;color:string;selected:boolean;spawn:boolean};
type Props={anchors:readonly MapLabelAnchor[];appearance:EntityAppearanceSettings;settings:MapLabelSettings};
/** A single HTML overlay instead of one Drei <Html> portal and camera subscriber per entity.
 * DOM is created only for the shortlisted labels, and positions are updated without React setState.
 */
export function MapEntityLabelOverlay({anchors,appearance,settings}:Props){
 const {gl,size}=useThree();
 const layer=useRef<HTMLDivElement|null>(null);
 const nodes=useRef(new Map<string,HTMLDivElement>());
 const inputs=useRef({anchors,appearance,settings});inputs.current={anchors,appearance,settings};
 const dirty=useRef(true),pointerDirty=useRef(false),last=useRef(0);
 const previousCamera=useRef<number[]>([]),previousProjection=useRef<number[]>([]);
 const pointer=useRef({x:-10000,y:-10000});
 const projected=useMemo(()=>new THREE.Vector3(),[]);
 useEffect(()=>{dirty.current=true},[anchors,appearance,settings,size.width,size.height]);
 useEffect(()=>{
  const parent=gl.domElement.parentElement;
  if(!parent)return;
  const root=document.createElement('div');root.className='map-entity-label-overlay';root.setAttribute('data-map-label-layer','optimized');
  parent.appendChild(root);layer.current=root;

  const onMove=(event:PointerEvent)=>{const rect=gl.domElement.getBoundingClientRect();
    const x=(event.clientX-rect.left)*size.width/Math.max(1,rect.width);
    const y=(event.clientY-rect.top)*size.height/Math.max(1,rect.height);
    if(Math.abs(pointer.current.x-x)>=4||Math.abs(pointer.current.y-y)>=4)pointerDirty.current=true;
    pointer.current.x=x;pointer.current.y=y};
  const onLeave=()=>{pointer.current.x=-10000;pointer.current.y=-10000;pointerDirty.current=true};
  gl.domElement.addEventListener('pointermove',onMove,{passive:true});gl.domElement.addEventListener('pointerleave',onLeave);
  dirty.current=true;
  return()=>{
   gl.domElement.removeEventListener('pointermove',onMove);gl.domElement.removeEventListener('pointerleave',onLeave);
   nodes.current.clear();root.remove();if(layer.current===root)layer.current=null;
  };
 },[gl,size.width,size.height]);
 useFrame(({camera,clock})=>{
  const root=layer.current;if(!root)return;
  // Camera and projection matrices also detect orbit, fly, zoom and orthographic changes.
  const matrix=camera.matrixWorld.elements,proj=camera.projectionMatrix.elements;
  const changed=(arr:readonly number[],prev:readonly number[])=>arr.some((v,i)=>Math.abs(v-(prev[i]??Infinity))>1e-7);
  const cameraMoved=changed(matrix,previousCamera.current)||changed(proj,previousProjection.current);
  // No idle polling: unchanged camera, mouse and labels need no projection,
  // sorting, DOM traversal or layout. Large MAPs are capped at 18Hz.
  if(!mapLabelRefreshDue(dirty.current,cameraMoved,pointerDirty.current,
    clock.elapsedTime-last.current,last.current>0,inputs.current.anchors.length))return;
  last.current=clock.elapsedTime;dirty.current=false;pointerDirty.current=false;
  previousCamera.current=Array.from(matrix);previousProjection.current=Array.from(proj);
  const {anchors:all,appearance:style,settings:config}=inputs.current;
  const width=size.width,height=size.height;
  const c=[];
  const byId=new Map<string,{anchor:MapLabelAnchor;x:number;y:number}>();
  const farSquared=config.distance*config.distance;
  for(const anchor of all){
   const dist=anchor.position.distanceToSquared(camera.position);
   // Selected labels and player-spawn labels are not excluded by distance.
   if(!anchor.selected&&!anchor.spawn&&dist>farSquared)continue;
   projected.copy(anchor.position).project(camera);
   if(!Number.isFinite(projected.x)||!Number.isFinite(projected.y)||projected.z<=-1||projected.z>=1)continue;
   const x=(projected.x+1)*width/2,y=(1-projected.y)*height/2;
   const name=anchor.main||'',sub=anchor.targetname||'';
   const chars=Math.max(name.length,sub.length+1);
   const labelWidth=Math.min(420,Math.max(70,chars*style.labelSize*.58+52));
   const labelHeight=sub&&name?Math.max(43,style.labelSize*1.25+27):Math.max(34,style.labelSize*1.25+18);
   const hovered=Math.abs(x-pointer.current.x)<70&&Math.abs(y-pointer.current.y)<40;
   c.push({id:anchor.id,x,y,width:labelWidth,height:labelHeight,distanceSquared:dist,
    priority:mapLabelPriority(anchor.classname,anchor.targetname,anchor.spawn,hovered),selected:anchor.selected,spawn:anchor.spawn});
   byId.set(anchor.id,{anchor,x,y});
  }
  const visible=layoutMapLabels(c,{width,height,limit:config.maxLabels,avoidOverlap:config.avoidOverlap});
  const keep=new Set(visible.ids);
  for(const [id,node] of nodes.current)if(!keep.has(id)){node.remove();nodes.current.delete(id)}
  for(const id of visible.ids){
   const point=byId.get(id)!;const a=point.anchor;
   let node=nodes.current.get(id);
   if(!node){
    node=document.createElement('div');node.className='entity-world-label map-virtual-label';
    const indicator=document.createElement('span');indicator.className='entity-label-indicator';node.appendChild(indicator);
    const text=document.createElement('span');text.className='entity-label-text';
    const main=document.createElement('strong');text.appendChild(main);
    const small=document.createElement('small');text.appendChild(small);node.appendChild(text);
    root.appendChild(node);nodes.current.set(id,node);
   }
   // Use textContent, never HTML parsing: FGD/custom keyvalues are untrusted strings.
   const indicator=node.firstElementChild as HTMLElement;
   const text=node.lastElementChild as HTMLElement;
   const main=text.firstElementChild as HTMLElement;
   const small=text.lastElementChild as HTMLElement;
   const staticKey=JSON.stringify([a.main,a.targetname,a.classname,a.color,a.selected,a.spawn,style.opacity,style.labelSize,config.lightweight]);
   // Geometry/camera movement only writes transform; styles/text remain cached.
   if(node.dataset.staticKey!==staticKey){
    node.dataset.staticKey=staticKey;
    if(main.textContent!==a.main)main.textContent=a.main;
    const sub=a.targetname?`#${a.targetname}`:'';
    if(small.textContent!==sub)small.textContent=sub;
    main.hidden=!a.main;small.hidden=!a.targetname;
    node.classList.toggle('is-selected',a.selected);node.classList.toggle('is-spawn',a.spawn);
    node.classList.toggle('map-label-lightweight',config.lightweight);
    node.style.borderColor=a.color;node.style.opacity=String(style.opacity);node.style.fontSize=`${style.labelSize}px`;
    node.style.boxShadow=config.lightweight?'none':`0 4px 18px #000c,0 0 18px ${a.color}50`;
    indicator.style.background=a.color;indicator.style.boxShadow=config.lightweight?'none':`0 0 12px ${a.color}`;small.style.color=a.color;
    node.setAttribute('aria-label',a.classname);
   }
   const transform=`translate3d(${point.x.toFixed(1)}px,${point.y.toFixed(1)}px,0) translate(-50%,-50%)`;
   if(node.style.transform!==transform)node.style.transform=transform;
  }
 });
 return null;
}
