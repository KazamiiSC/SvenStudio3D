/** Read-only 3D overlays extracted from Viewport.tsx (v2.3 HF5): routes, audio radii, entity links, measurement, leak trace, co-op ghosts and architecture guides. */
import {Html,Line} from '@react-three/drei';
import {useEffect,useMemo,useRef,useState} from 'react';
import * as THREE from 'three';
import {useEditor} from '../../store';
import {translate} from '../../i18n';
import {useArchitectureMode} from '../../architectureModeState';
import {finishArchitectureMode} from '../../architectureModeController';
import {gameToThree} from '../../engine/geometry';
import type {PointEntity} from '../../engine/types';
import {traceNpcRoute,isNpcOwner} from '../../engine/npc';
import {readCinematicScene} from '../../engine/cinematic';
import {routeColor} from '../../engine/sceneOrganization';
import {soundInfluence} from '../../engine/sound';
import {useMapDoctorState} from '../../mapDoctorState';
import {useCoopPlaytestState} from '../../coopPlaytestState';
import {analyzeCoopPlaytest,COOP_HULL} from '../../engine/coopPlaytest';
import {usePlayerCheck,CLEARANCE_COLORS} from '../../playerCheckState';

export function CinematicRouteLines(){
  const objects=useEditor(s=>s.project.objects),selected=useEditor(s=>s.selected),placing=useEditor(s=>s.cinematicPlacementFor);
  const cameras=objects.filter((o):o is PointEntity=>o.kind==='entity'&&o.classname==='trigger_camera');
  const current=cameras.find(cam=>cam.id===(placing||selected))||cameras.find(cam=>{
    if(!cam.group||!selected)return false;
    return objects.some(o=>o.id===selected&&o.group===cam.group);
  });
  if(!current)return null;
  const scene=readCinematicScene(objects,current.id);
  if(!scene)return null;
  const points=scene.route.length?scene.route.map(o=>o.position):[scene.camera.position];
  const look=scene.lookTarget?.position;
  return <group>{points.slice(1).map((p,i)=><Line key={scene.route[i+1].id} points={[gameToThree(points[i]),gameToThree(p)]} color="#67d4f6" lineWidth={3} dashed dashSize={9} gapSize={5} depthTest={false}/>)}
    {look&&<Line points={[gameToThree(points[0]),gameToThree(look)]} color="#d5a8ff" lineWidth={2} dashed dashSize={5} gapSize={8} depthTest={false}/>}
    {points.map((p,i)=><mesh key={`${current.id}-${i}`} position={gameToThree(p)} raycast={()=>null}>
      <sphereGeometry args={[5,8,6]}/><meshBasicMaterial color="#6dd9f8" depthTest={false}/></mesh>)}
  </group>;
}
/** Editor-only indication; full game sound propagation requires the engine. */
export function AudioRadiusGuides(){
  const selected=useEditor(s=>s.selected),objects=useEditor(s=>s.project.objects);
  const obj=objects.find(o=>o.id===selected&&o.kind==='entity') as PointEntity|undefined;
  const radius=obj?soundInfluence(obj):null;
  if(!obj||radius===null||radius<=0)return null;
  return <group position={gameToThree(obj.position)}><mesh><sphereGeometry args={[radius,32,18]}/><meshBasicMaterial color={obj.classname==='env_sound'?'#ad9aff':'#54e4fa'} transparent opacity={.1} wireframe depthTest={false} depthWrite={false}/></mesh></group>;
}
export function NpcRouteLines(){
  const objects=useEditor(s=>s.project.objects);
  const selected=useEditor(s=>s.selected);
  const routeOwner=useEditor(s=>s.routePlacementFor);
  const routeSolo=useEditor(s=>s.routeSolo);
  const owner=objects.find(o=>o.kind==='entity'&&o.id===(routeOwner||selected));
  const candidates=objects.filter((o):o is PointEntity=>o.kind==='entity'&&isNpcOwner(o.classname));
  const activeOwner=routeSolo?candidates.find(o=>o.props.path_name===routeSolo):owner&&owner.kind==='entity'&&isNpcOwner(owner.classname)?owner:
    candidates.find(o=>traceNpcRoute(objects,o.id).nodes.some(n=>n.id===selected));
  if(!activeOwner)return null;
  const trace=traceNpcRoute(objects,activeOwner.id),nodes=[activeOwner,...trace.nodes];
  if(nodes.length<2)return null;
  return <>{nodes.slice(1).map((next,i)=>{
    const a=gameToThree(nodes[i].position),b=gameToThree(next.position);
    return <Line key={next.id} points={[a,b]} color={routeColor(activeOwner.props.path_name||'route')} lineWidth={3} dashed dashSize={9} gapSize={5} transparent opacity={.94}/>;
  })}</>;
}
export function EntityConnections(){
  const selected=useEditor(s=>s.selected);
  const objects=useEditor(s=>s.project.objects);
  const source=objects.find(o=>o.id===selected&&o.kind==='entity') as PointEntity|undefined;
  if(!source?.props.target)return null;
  const targets=objects.filter(o=>o.kind==='entity'&&o.id!==source.id&&o.props.targetname===source.props.target) as PointEntity[];
  return <>{targets.map(target=><Line key={target.id} points={[gameToThree(source.position),gameToThree(target.position)]} color="#55f0d7" lineWidth={2} dashed dashSize={12} gapSize={8} transparent opacity={.82} />)}</>;
}
export function MeasurementOverlay(){
  const active=useEditor(s=>s.measureMode),{a,b}=useEditor(s=>s.measurement);
  if(!active||!a)return null;
  const start=gameToThree(a),end=b?gameToThree(b):null;
  const mid=end?start.clone().add(end).multiplyScalar(.5):start;
  const distance=b?Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]):null;
  return <group>
    <mesh position={start} raycast={()=>null}><sphereGeometry args={[6,10,8]}/><meshBasicMaterial color="#ffdd7e" depthTest={false}/></mesh>
    {end&&<><mesh position={end} raycast={()=>null}><sphereGeometry args={[6,10,8]}/><meshBasicMaterial color="#ffdd7e" depthTest={false}/></mesh>
      <Line points={[start,end]} color="#ffde80" lineWidth={3} depthTest={false} raycast={()=>null}/>
      <Html position={mid} center style={{pointerEvents:'none'}}><div className="measurement-label"><strong>{distance!.toFixed(2)} u</strong><small>Δ {['X','Y','Z'].map((name,i)=>`${name} ${(b![i]-a[i]).toFixed(1)}`).join(' · ')}</small></div></Html>
    </>}
  </group>;
}
/** Compiler-produced leak line. Pure visualization: never makes or edits a brush. */
export function LeakTrace3D(){
  const trace=useMapDoctorState(s=>s.trace),visible=useMapDoctorState(s=>s.traceVisible);
  const walk=useEditor(s=>s.walkMode);
  if(walk||!visible||trace.length<2)return null;
  const coords=trace.map(gameToThree);
  return <group renderOrder={900}>
    <Line points={coords} color="#ff626d" lineWidth={3.5} depthTest={false} depthWrite={false} raycast={()=>null}/>
    <mesh position={coords[0]} raycast={()=>null}><sphereGeometry args={[11,12,8]}/><meshBasicMaterial color="#ffdb74" depthTest={false} depthWrite={false}/></mesh>
    <mesh position={coords[coords.length-1]} raycast={()=>null}><sphereGeometry args={[13,12,8]}/><meshBasicMaterial color="#ff5968" depthTest={false} depthWrite={false}/></mesh>
  </group>;
}
/** Compile region (cordon) box: dashed outline, never raycast or exported. */
export function CompileRegionBox(){
  const region=useEditor(s=>s.compileRegion);
  const walk=useEditor(s=>s.walkMode);
  const locale=useEditor(s=>s.locale);
  const edges=useMemo(()=>{
    if(!region)return null;
    const [x0,y0,z0]=region.min,[x1,y1,z1]=region.max;
    const c=(x:number,y:number,z:number)=>gameToThree([x,y,z]);
    const p=[c(x0,y0,z0),c(x1,y0,z0),c(x1,y1,z0),c(x0,y1,z0),c(x0,y0,z1),c(x1,y0,z1),c(x1,y1,z1),c(x0,y1,z1)];
    return {segments:[[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].map(([a,b])=>[p[a],p[b]]),top:p[7]};
  },[region]);
  if(walk||!edges)return null;
  return <group renderOrder={880}>
    {edges.segments.map((seg,i)=><Line key={i} points={seg} color="#ffb347" lineWidth={2} dashed dashSize={24} gapSize={14} depthTest={false} depthWrite={false} raycast={()=>null}/>)}
    <Html position={edges.top} className="compile-region-label" pointerEvents="none" zIndexRange={[20,0]}>{translate(locale,'Compile region')}</Html>
  </group>;
}
/** Read-only player hull markers; do not participate in raycasts or exports. */
export function CoopGhostOverlay(){
 const visible=useCoopPlaytestState(s=>s.visible);
 const count=useCoopPlaytestState(s=>s.count),anchorId=useCoopPlaytestState(s=>s.anchorId);
 const project=useEditor(s=>s.project),walk=useEditor(s=>s.walkMode);
 const manualAnchor=useCoopPlaytestState(s=>s.manualAnchor);
 const report=useMemo(()=>visible&&!walk?analyzeCoopPlaytest(project,count,anchorId,manualAnchor):null,[visible,walk,project,count,anchorId,manualAnchor]);
 if(!report?.ghosts.length)return null;
 return <group renderOrder={920} raycast={()=>null}>{report.ghosts.map((ghost,i)=>{
  const color=ghost.blocked?'#ff646e':!ghost.support?'#f0b35d':'#56e3c0';
  return <group key={`${report.anchorId}:${i}`} position={gameToThree(ghost.position)} raycast={()=>null}>
   <mesh raycast={()=>null} renderOrder={920}><boxGeometry args={[COOP_HULL.width,COOP_HULL.standingHeight,COOP_HULL.width]}/><meshBasicMaterial color={color} transparent opacity={.14} depthTest={false} depthWrite={false}/></mesh>
   <mesh raycast={()=>null} renderOrder={921}><boxGeometry args={[COOP_HULL.width,COOP_HULL.standingHeight,COOP_HULL.width]}/><meshBasicMaterial color={color} wireframe transparent opacity={.88} depthTest={false} depthWrite={false}/></mesh>
   <mesh position={[0,COOP_HULL.standingHeight/2+6,0]} raycast={()=>null}><sphereGeometry args={[4,8,6]}/><meshBasicMaterial color={color} depthTest={false} depthWrite={false}/></mesh>
  </group>;
 })}</group>;
}
/** Full-screen raycastable construction plane. It captures clicks while tracing,
 * without changing the normal selection/placement behavior outside this mode. */
export function ArchitectureDrawingPlane(){
  const mode=useArchitectureMode(s=>s.mode);
  const points=useArchitectureMode(s=>s.points),hover=useArchitectureMode(s=>s.hover);
  const opts=useArchitectureMode(s=>s.options),move=useArchitectureMode(s=>s.move),add=useArchitectureMode(s=>s.point);
  const setError=useArchitectureMode(s=>s.setError);
  if(mode==='off')return null;
  const z=opts.baseZ+1;
  const to3=(p:[number,number]):[number,number,number]=>[p[0],z,-p[1]];
  const point=(world:THREE.Vector3):[number,number]|null=>
    Number.isFinite(world.x)&&Number.isFinite(world.z)&&Math.max(Math.abs(world.x),Math.abs(world.z))<=16384?[world.x,-world.z]:null;
  const active=hover&&points.length?to3(hover):null;
  return <group>
    <mesh position={[0,opts.baseZ,0]} rotation={[-Math.PI/2,0,0]}
      onPointerMove={e=>{e.stopPropagation();const p=point(e.point);if(p)move(p)}}
      onPointerDown={e=>{
        if(e.button!==0)return;
        e.stopPropagation();e.nativeEvent.preventDefault();
        const p=point(e.point);if(!p)return;
        // A click near the initial corner closes a room; Enter works as well.
        if(mode==='room'&&points.length>=4&&Math.hypot(p[0]-points[0][0],p[1]-points[0][1])<Math.max(10,useArchitectureMode.getState().step*.7)){
          finishArchitectureMode();return;
        }
        setError('');add(p);
      }}>
      <planeGeometry args={[65536,65536]}/><meshBasicMaterial color="#58bbee" transparent opacity={0} depthWrite={false} side={THREE.DoubleSide}/>
    </mesh>
    {points.length>=2&&<Line points={points.map(to3)} color="#70dffd" lineWidth={3} depthTest={false} raycast={()=>null}/>}
    {mode==='room'&&points.length>=3&&<Line points={[to3(points[points.length-1]),to3(points[0])]} color="#60ccae" lineWidth={1.5} dashed dashScale={12} depthTest={false} raycast={()=>null}/>}
    {active&&<Line points={[to3(points[points.length-1]),active]} color="#f6c774" lineWidth={2} depthTest={false} raycast={()=>null}/>}
    {points.map((p,i)=><mesh key={i} position={to3(p)} raycast={()=>null} renderOrder={1000}>
      <sphereGeometry args={[4.5,10,8]}/><meshBasicMaterial color={i===0?'#70f5ba':'#f6c774'} depthTest={false}/>
    </mesh>)}
    {hover&&<mesh position={to3(hover)} raycast={()=>null} renderOrder={1000}>
      <sphereGeometry args={[5,10,8]}/><meshBasicMaterial color="#ffffff" depthTest={false}/>
    </mesh>}
  </group>;
}
/** Move parametric room corners in the viewport. Nothing is rebuilt on move:
 * one validated, undoable reconstruction occurs on pointer release only. */
export function ArchitectureCornerHandles(){
  const editId=useArchitectureMode(s=>s.editId);
  const record=useEditor(s=>s.project.architectureLayouts)?.find(r=>r.id===editId);
  const [draft,setDraft]=useState<[number,number][]|null>(null);
  const dragging=useRef<number|null>(null);
  const draftRef=useRef<[number,number][]|null>(null);
  const setError=useArchitectureMode(s=>s.setError);
  const edit=useEditor(s=>s.editArchitectureLayout);
  useEffect(()=>{dragging.current=null;draftRef.current=null;setDraft(null)},[editId]);
  if(!record||!editId)return null;
  const pts=draft||record.points,top=record.options.baseZ+record.options.height+(record.kind==='room'?record.options.slab:0)+8;
  const to3=(p:[number,number]):[number,number,number]=>[p[0],top,-p[1]];
  const update=(i:number,e:import('@react-three/fiber').ThreeEvent<PointerEvent>)=>{
    const at=new THREE.Vector3();
    if(!e.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-top),at))return;
    const step=useArchitectureMode.getState().step;
    const snap=(x:number)=>Math.round(x/step)*step;
    const [x,y]=[snap(at.x),snap(-at.z)],points=record.points.map(p=>[...p] as [number,number]);
    const old=record.points[i];points[i]=[x,y];
    const neighbours=[(i-1+points.length)%points.length,(i+1)%points.length];
    // An open path has no wraparound segment at its endpoints.
    for(const n of neighbours){
      if(record.kind==='walls'&&Math.abs(n-i)!==1)continue;
      if(record.points[n][0]===old[0])points[n][0]=x;
      else if(record.points[n][1]===old[1])points[n][1]=y;
    }
    if(JSON.stringify(draftRef.current||record.points)===JSON.stringify(points))return;
    draftRef.current=points;setDraft(points);
  };
  const finish=()=>{
    if(dragging.current===null)return;
    dragging.current=null;
    const pending=draftRef.current;draftRef.current=null;
    if(!pending){setDraft(null);return;}
    try{
      edit(record.id,pending,record.options);setError('');
    }catch(e){setError(e instanceof Error?e.message:String(e));}
    setDraft(null);
  };
  return <group>
    {pts.length>1&&<Line points={[...pts,...(record.kind==='room'?[pts[0]]:[])].map(to3)} color="#42d4a0" lineWidth={2.5} depthTest={false} raycast={()=>null}/>}
    {pts.map((p,i)=><mesh key={`${record.id}:${i}`} position={to3(p)} renderOrder={1100}
      onPointerDown={e=>{if(e.button!==0)return;e.stopPropagation();dragging.current=i;draftRef.current=null;setDraft(null);setError('');(e.target as {setPointerCapture?:(id:number)=>void}).setPointerCapture?.(e.pointerId)}}
      onPointerMove={e=>{if(dragging.current!==i)return;e.stopPropagation();update(i,e)}}
      onPointerUp={e=>{if(dragging.current!==i)return;e.stopPropagation();finish();(e.target as {releasePointerCapture?:(id:number)=>void}).releasePointerCapture?.(e.pointerId)}}
      onPointerCancel={e=>{e.stopPropagation();dragging.current=null;draftRef.current=null;setDraft(null)}}>
      <sphereGeometry args={[10,14,10]}/><meshBasicMaterial color={dragging.current===i?'#fff0b0':'#69f1bf'} depthTest={false}/>
    </mesh>)}
  </group>;
}

/** v2.4 player-size check: coloured floor marks (one merged mesh) plus the focused issue's box.
 * Editor-only, never raycast or exported. */
export function PlayerClearanceOverlay(){
  const report=usePlayerCheck(s=>s.report),visible=usePlayerCheck(s=>s.visible),focus=usePlayerCheck(s=>s.focus);
  const walk=useEditor(s=>s.walkMode);
  const geometry=useMemo(()=>{
    if(!report?.cells.length)return null;
    const cells=report.cells.filter(c=>visible[c.kind]);if(!cells.length)return null;
    const half=report.step*.42,positions=new Float32Array(cells.length*18),colors=new Float32Array(cells.length*18);
    const color=new THREE.Color();
    cells.forEach((c,k)=>{
      color.set(CLEARANCE_COLORS[c.kind]);
      const z=c.z+1.5,corners=[[c.x-half,c.y-half],[c.x+half,c.y-half],[c.x+half,c.y+half],[c.x-half,c.y-half],[c.x+half,c.y+half],[c.x-half,c.y+half]];
      corners.forEach(([x,y],v)=>{const p=gameToThree([x,y,z]);positions.set([p.x,p.y,p.z],k*18+v*3);colors.set([color.r,color.g,color.b],k*18+v*3);});
    });
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));
    return g;
  },[report,visible]);
  useEffect(()=>()=>geometry?.dispose(),[geometry]);
  const issue=focus!==null?report?.issues[focus]:undefined;
  const box=useMemo(()=>{
    if(!issue)return null;
    const [x0,y0,z0]=issue.min,[x1,y1,z1]=issue.max,c=(x:number,y:number,z:number)=>gameToThree([x,y,z]);
    const p=[c(x0,y0,z0),c(x1,y0,z0),c(x1,y1,z0),c(x0,y1,z0),c(x0,y0,z1),c(x1,y0,z1),c(x1,y1,z1),c(x0,y1,z1)];
    return [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].map(([a,b])=>[p[a],p[b]]);
  },[issue]);
  if(walk||(!geometry&&!box))return null;
  return <group renderOrder={870}>
    {geometry&&<mesh geometry={geometry} raycast={()=>null}><meshBasicMaterial vertexColors transparent opacity={.55} side={THREE.DoubleSide} depthWrite={false} polygonOffset polygonOffsetFactor={-2}/></mesh>}
    {box&&issue&&box.map((seg,i)=><Line key={i} points={seg} color={CLEARANCE_COLORS[issue.kind]} lineWidth={2.5} depthTest={false} depthWrite={false} raycast={()=>null}/>)}
  </group>;
}