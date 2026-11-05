import * as THREE from 'three';
import type { Brush, Face, Primitive, Vec3, PlaceableShape } from './types';
import { uid } from './types';


// GoldSrc: X/Y horizontal, Z up. Three.js: X/Z horizontal, Y up.
export const gameToThree = (v: Vec3) => new THREE.Vector3(v[0],v[2],-v[1]);
export const threeToGame = (v: THREE.Vector3): Vec3 => [v.x,-v.z,v.y];
const basis = new THREE.Matrix4().set(1,0,0,0, 0,0,1,0, 0,-1,0,0, 0,0,0,1);
const basisQuaternion = new THREE.Quaternion().setFromRotationMatrix(basis);
export function toRenderQuaternion(rotation: Vec3) {
  const e = new THREE.Euler(...rotation.map(v=>THREE.MathUtils.degToRad(v)) as Vec3,'XYZ');
  return basisQuaternion.clone().multiply(new THREE.Quaternion().setFromEuler(e)).multiply(basisQuaternion.clone().invert());
}
export function fromRenderQuaternion(q: THREE.Quaternion): Vec3 {
  const g = basisQuaternion.clone().invert().multiply(q).multiply(basisQuaternion);
  const e = new THREE.Euler().setFromQuaternion(g,'XYZ');
  return [e.x,e.y,e.z].map(v=>round(THREE.MathUtils.radToDeg(v),2)) as Vec3;
}
export const round = (v: number, n=3) => Number(v.toFixed(n));
const vec = (v: Vec3) => new THREE.Vector3(...v);
const add = (a: Vec3,b:Vec3): Vec3 => [a[0]+b[0],a[1]+b[1],a[2]+b[2]];
const mul = (a: Vec3,b:Vec3): Vec3 => [a[0]*b[0],a[1]*b[1],a[2]*b[2]];

// Faces are outward oriented in GoldSrc space; do not duplicate coincident triangles.
export function orientFaces(vertices: Vec3[], faces: Face[]): Face[] {
  const center = new THREE.Vector3(); vertices.forEach(v=>center.add(vec(v))); center.divideScalar(Math.max(1,vertices.length));
  return faces.map(f=>{
    const indices = [...f.indices];
    if(indices.length < 3) return {...f,indices};
    const a=vec(vertices[indices[0]]), b=vec(vertices[indices[1]]),c=vec(vertices[indices[2]]);
    const normal=b.clone().sub(a).cross(c.clone().sub(a));
    const faceCenter=new THREE.Vector3(); indices.forEach(i=>faceCenter.add(vec(vertices[i])));faceCenter.divideScalar(indices.length);
    if(normal.dot(faceCenter.sub(center)) < 0) indices.reverse();
    return {...f,indices};
  });
}
export function primitiveGeometry(kind: Primitive, size: Vec3 = [128,128,128], n=12) {
  const [w,h,d] = size;
  const x=w/2, y=h/2, z=d/2;
  let vertices:Vec3[]=[]; let faces:Face[]=[];
  if(kind==='box'){
    vertices=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]];
    faces=[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(indices=>({indices,texture:'SV_BRICK01'}));
  } else if (kind==='wedge') {
    vertices=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,y,z],[x,y,z]];
    faces=[[0,3,2,1],[3,4,5,2],[0,1,5,4],[0,4,3],[1,2,5]].map(indices=>({indices,texture:'SV_BRICK01'}));
  } else if (kind==='cylinder') {
    n=Math.max(3,Math.min(24,Math.floor(n)));
    for(let j=0;j<2;j++)for(let i=0;i<n;i++){
      const t=i*Math.PI*2/n; vertices.push([Math.cos(t)*x,Math.sin(t)*y,j?z:-z]);
    }
    faces.push({indices:Array.from({length:n},(_,i)=>n-1-i),texture:'SV_BRICK01'});
    faces.push({indices:Array.from({length:n},(_,i)=>i+n),texture:'SV_BRICK01'});
    for(let i=0;i<n;i++)faces.push({indices:[i,(i+1)%n,(i+1)%n+n,i+n],texture:'SV_BRICK01'});
  } else if(kind==='cone'||kind==='pyramid') {
    const count=kind==='pyramid'?4:Math.max(3,Math.min(24,Math.floor(n)));
    const angle=kind==='pyramid'?Math.PI/4:0;
    for(let i=0;i<count;i++){
      const a=angle+i*2*Math.PI/count;
      vertices.push([Math.cos(a)*x,Math.sin(a)*y,-z]);
    }
    vertices.push([0,0,z]);
    faces.push({indices:Array.from({length:count},(_,i)=>count-1-i),texture:'SV_BRICK01'});
    for(let i=0;i<count;i++)faces.push({indices:[i,(i+1)%count,count],texture:'SV_BRICK01'});
  } else if(kind==='icosphere') {
    // An icosahedron is a convex, closed 20-triangle GoldSrc brush. Unlike a
    // smooth UV sphere, its planar faces can be exported without triangulation.
    const sphere=new THREE.IcosahedronGeometry(1,0);
    const attr=sphere.getAttribute('position');
    const lookup=new Map<string,number>();
    const indices:number[]=[];
    for(let i=0;i<attr.count;i++){
      const point:[number,number,number]=[attr.getX(i)*x,attr.getY(i)*y,attr.getZ(i)*z];
      const key=point.map(v=>v.toFixed(5)).join(':');
      if(!lookup.has(key)){lookup.set(key,vertices.length);vertices.push(point)}
      indices.push(lookup.get(key)!);
    }
    for(let i=0;i<indices.length;i+=3)faces.push({indices:indices.slice(i,i+3),texture:'SV_BRICK01'});
    sphere.dispose();
  }
  return {vertices,faces:orientFaces(vertices,faces)};
}
export function createBrush(kind:'box'|'wedge'|'cylinder'|'cone'|'pyramid'|'icosphere', position:Vec3=[0,0,64], size:Vec3=[128,128,128],name?:string):Brush{
  const g=primitiveGeometry(kind,size);
  return {id:uid(),kind:'brush',primitive:kind,name:name??`${kind[0].toUpperCase()}${kind.slice(1)}`,position,rotation:[0,0,0],scale:[1,1,1],...g,layer:'Geometry'};
}
export function createArch(position:Vec3=[0,0,128], outer=160,inner=112,depth=64,count=8):Brush[]{
  const result:Brush[]=[];
  for(let j=0;j<count;j++){
    const a=Math.PI*j/count,b=Math.PI*(j+1)/count;
    const points:[[number,number],[number,number],[number,number],[number,number]] = [
      [inner*Math.cos(a),inner*Math.sin(a)],[outer*Math.cos(a),outer*Math.sin(a)],
      [outer*Math.cos(b),outer*Math.sin(b)],[inner*Math.cos(b),inner*Math.sin(b)]];
    const v:Vec3[]=[...points.map(([x,z])=>[x,-depth/2,z] as Vec3),...points.map(([x,z])=>[x,depth/2,z] as Vec3)];
    const faces=orientFaces(v,[[0,1,2,3],[4,5,6,7],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]].map(indices=>({indices,texture:'SV_BRICK01'})));
    result.push({id:uid(),kind:'brush',primitive:'archSegment',name:`Arch ${j+1}/${count}`,vertices:v,faces,position,rotation:[0,0,0],scale:[1,1,1],layer:'Geometry'});
  }
  return result;
}
/** A collection of closed convex brushes, never a nonconvex mesh. The ground
 *  anchor is in GoldSrc X/Y, Z up and can be placed on another surface. */
export function createPlaceableShape(kind:PlaceableShape,ground:Vec3,texture='SV_BRICK01'):Brush[]{
  const [x,y,z]=ground;
  let brushes:Brush[];
  if(kind==='arch'||kind==='vault') {
    brushes=kind==='vault'?createArch([x,y,z],240,188,512,16):createArch([x,y,z],160,112,64,8);
  } else if(kind==='stairs') {
    const count=6,run=192,countHeight=144,width=128;
    brushes=Array.from({length:count},(_,i)=>{
      const stepHeight=countHeight/count;
      // Non-overlapping horizontal slices, each convex. Rising staircase.
      const length=run/count;
      const cx=x-run/2+(i+.5)*length;
      const h=(i+1)*stepHeight;
      return createBrush('box',[cx,y,z+h/2],[length,width,h],`Stairs ${i+1}/${count}`);
    });
  } else if(kind==='pipe') {
    // A vertical hollow ring made from individual six-face trapezoid brushes.
    // A single concave annulus is not representable by one GoldSrc brush.
    brushes=[];
    const outer=100,inner=64,count=12,height=128;
    for(let i=0;i<count;i++){
      const a=i*2*Math.PI/count,b=(i+1)*2*Math.PI/count;
      const p=(r:number,angle:number):[number,number]=>[Math.cos(angle)*r,Math.sin(angle)*r];
      const ring=[p(inner,a),p(outer,a),p(outer,b),p(inner,b)];
      const vertices:Vec3[]=[...ring.map(([dx,dy])=>[dx,dy,-height/2] as Vec3),...ring.map(([dx,dy])=>[dx,dy,height/2] as Vec3)];
      const faces:Face[]=orientFaces(vertices,[[0,1,2,3],[4,5,6,7],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]].map(indices=>({indices,texture})));
      brushes.push({id:uid(),kind:'brush',primitive:'poly',name:`Pipe ${i+1}/${count}`,vertices,faces,position:[x,y,z+height/2],rotation:[0,0,0],scale:[1,1,1],layer:'Geometry'});
    }
  } else {
    brushes=[createBrush(kind,[x,y,z+64],[128,128,128],kind[0].toUpperCase()+kind.slice(1))];
  }
  brushes.forEach(b=>b.faces.forEach(f=>{f.texture=texture}));
  return brushes;
}

export function transformedVertices(b:Brush):Vec3[]{
  const e=new THREE.Euler(...b.rotation.map(v=>v*Math.PI/180) as Vec3,'XYZ');
  return b.vertices.map(v=>{
    const result=vec(mul(v,b.scale)).applyEuler(e);
    return add([result.x,result.y,result.z],b.position);
  });
}
export function buildMeshGeometry(b:Brush) {
  const positions:number[]=[];const uv:number[]=[];const indices:number[]=[];const trianglesToFaces:number[]=[];
  const worldVertices=transformedVertices(b);
  let base=0;
  b.faces.forEach((face,fi)=>{
    const faceVertices=face.indices.map(i=>gameToThree(b.vertices[i]));
    if(faceVertices.length<3)return;
    const {u,v}=textureAxes(worldVertices,face);
    const uScale=face.uScale||1,vScale=face.vScale||1;
    face.indices.forEach((vertexIndex,index)=>{
      const local=faceVertices[index],world=worldVertices[vertexIndex];
      positions.push(local.x,local.y,local.z);
      // World-anchored Valve 220 alignment: equal offsets line up across brushes.
      uv.push((dot3(world,u)+(face.uShift||0))/(128*uScale),(dot3(world,v)+(face.vShift||0))/(128*vScale));
    });
    for(let j=1;j<faceVertices.length-1;j++){
      indices.push(base,base+j,base+j+1);trianglesToFaces.push(fi);
    }
    base+=faceVertices.length;
  });
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  let triangle=0;
  b.faces.forEach((f,fi)=>{const count=Math.max(0,f.indices.length-2);if(count)geometry.addGroup(triangle*3,count*3,fi);triangle+=count});
  geometry.userData.trianglesToFaces=trianglesToFaces;
  return geometry;
}


/** Dimensions are measured in local brush axes, before its rotation.
 * A brush always remains a closed convex solid: resizing changes its transform,
 * not the winding, vertex topology, or source texture coordinates. */
export function brushDimensions(brush:Brush):Vec3 {
  const minimum:Vec3=[Infinity,Infinity,Infinity],maximum:Vec3=[-Infinity,-Infinity,-Infinity];
  for(const vertex of brush.vertices)for(let axis=0;axis<3;axis++){
    minimum[axis]=Math.min(minimum[axis],vertex[axis]);
    maximum[axis]=Math.max(maximum[axis],vertex[axis]);
  }
  return minimum.map((value,i)=>round((maximum[i]-value)*Math.abs(brush.scale[i]),2)) as Vec3;
}
export function resizeBrush(brush:Brush,requested:Vec3):Brush {
  if(requested.some(v=>!Number.isFinite(v)||v<1||v>131072))
    throw new Error('Dimensions must be finite numbers between 1 and 131072 units.');
  const current=brushDimensions(brush);
  if(current.some(v=>v<=0))throw new Error('Cannot resize a degenerate brush.');
  return {...brush,scale:brush.scale.map((s,i)=>round(Math.abs(s)*requested[i]/current[i],6)) as Vec3};
}

/** Creates a GoldSrc-compatible convex box between two X/Y floor-plane points. */
export function boxFromGroundDrag(from:Vec3,to:Vec3,height:number,grid:number,texture:string):Brush {
  if(!Number.isFinite(height)||height<1||height>131072)throw new Error('Invalid box height.');
  const step=Math.max(1,grid);
  const snap=(n:number)=>Math.round(n/step)*step;
  const x0=snap(from[0]),x1=snap(to[0]),y0=snap(from[1]),y1=snap(to[1]);
  const size:Vec3=[Math.max(step,Math.abs(x1-x0)),Math.max(step,Math.abs(y1-y0)),height];
  const center:Vec3=[(x0+x1)/2,(y0+y1)/2,height/2];
  const brush=createBrush('box',center,size,'Drawn Block');
  brush.faces.forEach(face=>{face.texture=texture});
  return brush;
}

/** Valve 220 axes are in game coordinates. Keep these consistent in preview and MAP output. */
export function textureAxes(vertices:Vec3[],face:Face):{u:Vec3;v:Vec3}{
 const [p,q,r]=face.indices.slice(0,3).map(i=>new THREE.Vector3(...vertices[i]));
 const normal=q.clone().sub(p).cross(r.clone().sub(p)).normalize();
 const [nx,ny,nz]=normal.toArray().map(Math.abs);
 let u:Vec3,v:Vec3;
 if(nz>=nx&&nz>=ny){u=[1,0,0];v=[0,-1,0]}
 else if(nx>=ny){u=[0,1,0];v=[0,0,-1]}
 else {u=[1,0,0];v=[0,0,-1]}
 if(face.uAxis)u=face.uAxis;
 if(face.vAxis)v=face.vAxis;
 const angle=(face.rotation||0)*Math.PI/180;
 if(angle){const c=Math.cos(angle),s=Math.sin(angle),a=[...u] as Vec3,b=[...v] as Vec3;
   u=a.map((n,i)=>n*c-b[i]*s) as Vec3;v=a.map((n,i)=>n*s+b[i]*c) as Vec3;
 }
 return {u,v};
}
export const dot3=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export const textureSettings=(f:Face):Pick<Face,'texture'|'uShift'|'vShift'|'uScale'|'vScale'|'rotation'|'uAxis'|'vAxis'>=>({texture:f.texture,uShift:f.uShift||0,vShift:f.vShift||0,uScale:f.uScale??1,vScale:f.vScale??1,rotation:f.rotation||0,...(f.uAxis?{uAxis:[...f.uAxis]}:{}),...(f.vAxis?{vAxis:[...f.vAxis]}:{})});
