/** Small orbitable 3D preview of brushes that are about to be created (v2.4).
 * Same look as the World Builder previews; never touches the map.
 * v2.6: tight framing (the whole object fills the view) and point-entity markers
 * (brushes textured NULL from kitPreviewBrushes) drawn in a separate accent colour. */
import {useEffect,useMemo} from 'react';
import {Canvas} from '@react-three/fiber';
import {OrbitControls} from '@react-three/drei';
import * as THREE from 'three';
import {transformedVertices} from '../engine/geometry';
import type {Brush} from '../engine/types';

const FOV=40;
/** Brushes are drawn centred on X/Y with their lowest point on the grid, wherever they are in the map. */
function frameOf(brushes:Brush[]){
  let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity,z0=Infinity,z1=-Infinity;
  for(const b of brushes)for(const v of transformedVertices(b)){x0=Math.min(x0,v[0]);x1=Math.max(x1,v[0]);y0=Math.min(y0,v[1]);y1=Math.max(y1,v[1]);z0=Math.min(z0,v[2]);z1=Math.max(z1,v[2]);}
  if(!Number.isFinite(x0))return {cx:0,cy:0,z0:0,h:0,r:64};
  const cx=(x0+x1)/2,cy=(y0+y1)/2,cz=(z0+z1)/2;let r=24;
  for(const b of brushes)for(const v of transformedVertices(b))r=Math.max(r,Math.hypot(v[0]-cx,v[1]-cy,v[2]-cz));
  return {cx,cy,z0,h:z1-z0,r};
}
const isMarker=(b:Brush)=>b.faces.length>0&&b.faces.every(f=>f.texture==='NULL');
function Solid({brushes,frame,color='#b9a58a',edge='#20303f'}:{brushes:Brush[];frame:{cx:number;cy:number;z0:number};color?:string;edge?:string}){
  const geometry=useMemo(()=>{
    const positions:number[]=[];
    for(const brush of brushes){
      const p=transformedVertices(brush);
      for(const face of brush.faces)for(let k=1;k<face.indices.length-1;k++)for(const i of [face.indices[0],face.indices[k],face.indices[k+1]]){const v=p[i];positions.push(v[0]-frame.cx,v[2]-frame.z0,-(v[1]-frame.cy));}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
  },[brushes,frame]);
  const edges=useMemo(()=>new THREE.EdgesGeometry(geometry,20),[geometry]);
  useEffect(()=>()=>{geometry.dispose();edges.dispose();},[geometry,edges]);
  return <group>
    <mesh geometry={geometry}><meshStandardMaterial color={color} roughness={1} flatShading side={THREE.DoubleSide}/></mesh>
    <lineSegments geometry={edges}><lineBasicMaterial color={edge}/></lineSegments>
  </group>;
}
const NONE:Brush[]=[];
export function BrushPreview({brushes,highlight=NONE,height=210,label,className}:{brushes:Brush[];highlight?:Brush[];height?:number|string;label?:string;className?:string}){
  const frame=useMemo(()=>frameOf([...brushes,...highlight]),[brushes,highlight]);
  const [solids,markers]=useMemo(()=>[brushes.filter(b=>!isMarker(b)),brushes.filter(isMarker)],[brushes]);
  const radius=frame.r;
  // Distance at which the bounding sphere just fits the vertical field of view, plus a small margin.
  const distance=radius/Math.sin(FOV/2*Math.PI/180)*1.08;
  const dir=new THREE.Vector3(1,.72,1).normalize().multiplyScalar(distance);
  const ty=frame.h/2;
  const gridSize=Math.max(256,Math.ceil(radius*4/64)*64);
  return <div className={`brush-preview${className?' '+className:''}`} style={{height}} onPointerDown={e=>e.stopPropagation()} onWheel={e=>e.stopPropagation()}>
    <Canvas key={`${Math.round(radius/16)}:${Math.round(ty/16)}`} camera={{position:[dir.x,dir.y+ty,dir.z],fov:FOV,near:1,far:distance*12}} dpr={[1,1.5]}>
      <color attach="background" args={['#172431']}/>
      <ambientLight intensity={1.4}/><directionalLight position={[200,500,300]} intensity={2}/>
      <gridHelper args={[gridSize,Math.max(8,Math.round(gridSize/32)),'#4d7182','#2c4555']}/>
      {solids.length>0&&<Solid brushes={solids} frame={frame}/>}
      {markers.length>0&&<Solid brushes={markers} frame={frame} color="#4fd1e8" edge="#0b4c5a"/>}
      {highlight.length>0&&<Solid brushes={highlight} frame={frame} color="#f3c55a"/>}
      <OrbitControls makeDefault target={[0,ty,0]} enablePan={false} minDistance={16} maxDistance={distance*5}/>
    </Canvas>
    {label&&<small className="brush-preview-label">{label}</small>}
  </div>;
}
