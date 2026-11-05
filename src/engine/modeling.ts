/** Svengine brush modeling. Always produces closed convex planar solids for SC-CSG. */
import * as THREE from 'three';
import {ConvexHull} from 'three/examples/jsm/math/ConvexHull.js';
import type {Brush,Face,Vec3} from './types';
import {uid} from './types';
import {createBrush,round,transformedVertices} from './geometry';
import {validateBrush} from './exportMap';
const v=(p:Vec3)=>new THREE.Vector3(...p);
const vec=(p:THREE.Vector3)=>p.toArray().map(a=>round(a,5)) as Vec3;
const EPS=0.001;
export function uniqueBrushEdges(brush:Brush):[number,number][]{
  const seen=new Set<string>(), result:[number,number][]=[];
  for(const face of brush.faces)for(let j=0;j<face.indices.length;j++){
    const a=face.indices[j],b=face.indices[(j+1)%face.indices.length];
    const key=`${Math.min(a,b)}:${Math.max(a,b)}`;
    if(!seen.has(key)){seen.add(key);result.push([a,b]);}
  }
  return result;
}
/** Rebuild all planar hull polygons after vertex editing, keeping texture metadata
 * from the nearest original plane. Prevents non-planar quads and duplicate CSG planes. */
export function rebuildConvexBrush(brush:Brush,points:Vec3[],options:{requireAllVertices?:boolean}={}):Brush{
  if(points.length<4||points.some(p=>p.some(n=>!Number.isFinite(n))))throw Error('Invalid vertex coordinates.');
  const pts=points.map(v);
  const hull=new ConvexHull().setFromPoints(pts);
  if(hull.faces.length<4)throw Error('Brush is flat or degenerate.');
  const sourceFaces=brush.faces.map(face=>{
    const [ia,ib,ic]=face.indices;
    const a=v(brush.vertices[ia]),b=v(brush.vertices[ib]),c=v(brush.vertices[ic]);
    const normal=b.sub(a).cross(c.sub(a)).normalize();
    return {face,normal};
  });
  type PlaneGroup={normal:THREE.Vector3;constant:number;indices:Set<number>};
  const groups:PlaneGroup[]=[];
  for(const f of hull.faces){
    const normal=f.normal,constant=f.constant;
    let g=groups.find(p=>p.normal.dot(normal)>1-1e-6&&Math.abs(p.constant-constant)<.03);
    if(!g){g={normal:normal.clone(),constant,indices:new Set<number>()};groups.push(g)}
    let edge=f.edge;
    for(let i=0;i<3;i++){
      const pt=edge.head().point;
      const index=pts.findIndex(p=>p.distanceToSquared(pt)<1e-8);
      if(index<0)throw Error('Convex hull vertex mismatch.');
      g.indices.add(index);
      edge=edge.next;
    }
  }
  const used=new Set([...groups.flatMap(g=>[...g.indices])]);
  if(options.requireAllVertices!==false&&used.size!==points.length)
    throw Error('The edit would move a vertex inside the solid. Move it outward or along a visible plane.');
  const faces:Face[]=groups.map(g=>{
    const indices=[...g.indices],center=new THREE.Vector3();
    indices.forEach(i=>center.add(pts[i]));center.divideScalar(indices.length);
    const base=Math.abs(g.normal.z)<.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
    const u=base.cross(g.normal).normalize(),w=g.normal.clone().cross(u).normalize();
    indices.sort((a,b)=>{
      const pa=pts[a].clone().sub(center),pb=pts[b].clone().sub(center);
      return Math.atan2(pa.dot(w),pa.dot(u))-Math.atan2(pb.dot(w),pb.dot(u));
    });
    let match=sourceFaces[0],score=-Infinity;
    for(const sf of sourceFaces){const dot=sf.normal.dot(g.normal);if(dot>score){score=dot;match=sf}}
    return {...match.face,indices};
  });
  const updated={...brush,primitive:'poly' as const,vertices:points,faces};
  const errors=validateBrush(updated);
  if(errors.length)throw Error(`Svengine geometry rejected: ${errors[0]}`);
  return updated;
}
export function editBrushVertices(brush:Brush,indices:number[],delta:Vec3):Brush{
  if(!indices.length||delta.some(n=>!Number.isFinite(n)))throw Error('Invalid edit.');
  const changed=brush.vertices.map((p,i)=>indices.includes(i)?p.map((n,j)=>round(n+delta[j],5)) as Vec3:[...p] as Vec3);
  return rebuildConvexBrush(brush,changed);
}
function clipHalf(brush:Brush,axis:0|1|2,at:number,positive:boolean):Brush|null{
  const old=transformedVertices(brush);
  const keep=(p:Vec3)=>positive?p[axis]>=at-EPS:p[axis]<=at+EPS;
  const pts:Vec3[]=old.filter(keep).map(p=>[...p] as Vec3);
  const addUnique=(p:Vec3)=>{if(!pts.some(q=>q.every((x,i)=>Math.abs(x-p[i])<EPS)))pts.push(p)};
  for(const [a,b] of uniqueBrushEdges(brush)){
    const p=old[a],q=old[b],da=p[axis]-at,db=q[axis]-at;
    if(da*db>=0)continue;
    const ratio=da/(da-db);
    addUnique(p.map((n,i)=>round(n+(q[i]-n)*ratio,5)) as Vec3);
  }
  if(pts.length<4)return null;
  // Source planes must refer to the COMPLETE original vertex array, not the
  // reduced clipped point set. Otherwise clipping a cylinder/wedge can access
  // invalid vertex indices and crash or assign incorrect face materials.
  const originals={...brush,vertices:old,position:[0,0,0] as Vec3,rotation:[0,0,0] as Vec3,scale:[1,1,1] as Vec3};
  const result=rebuildConvexBrush(originals,pts);
  result.id=uid();
  result.name=`${brush.name} ${positive?'(+)' :'(-)'}`;
  result.layer=brush.layer;result.entityId=brush.entityId;
  return result;
}
/** Axis-aligned Svengine clipping in game coordinates; returns existing halves only. */
export function splitBrush(brush:Brush,axis:0|1|2,at:number,side:'both'|'positive'|'negative'='both'):Brush[]{
  if(!Number.isFinite(at))throw Error('Invalid cutting plane.');
  const result=[...(side!=='negative'?[clipHalf(brush,axis,at,true)]:[]),...(side!=='positive'?[clipHalf(brush,axis,at,false)]:[])].filter((b):b is Brush=>!!b);
  if(side==='both'&&result.length!==2)throw Error('Cutting plane must cross the brush interior.');
  if(!result.length)throw Error('Cutting plane misses the brush.');
  return result;
}
/** Six convex shells for a regular box, including rotated boxes. */
export function hollowBox(brush:Brush,thickness:number):Brush[]{
  if(brush.primitive!=='box')throw Error('Hollow currently requires a Box brush.');
  if(!Number.isFinite(thickness)||thickness<=0)throw Error('Thickness must be positive.');
  const local=brush.vertices.map(p=>p.map((x,i)=>x*brush.scale[i]) as Vec3);
  const min=[0,1,2].map(i=>Math.min(...local.map(p=>p[i]))) as Vec3;
  const max=[0,1,2].map(i=>Math.max(...local.map(p=>p[i]))) as Vec3;
  if([0,1,2].some(i=>max[i]-min[i]<=thickness*2+1))throw Error('Wall thickness exceeds brush dimensions.');
  const [x0,y0,z0]=min,[x1,y1,z1]=max,t=thickness;
  const extents:[Vec3,Vec3][]=[
    [[x0,y0,z0],[x1,y1,z0+t]],[[x0,y0,z1-t],[x1,y1,z1]],
    [[x0,y0,z0+t],[x0+t,y1,z1-t]],[[x1-t,y0,z0+t],[x1,y1,z1-t]],
    [[x0+t,y0,z0+t],[x1-t,y0+t,z1-t]],[[x0+t,y1-t,z0+t],[x1-t,y1,z1-t]]
  ];
  const rotation=new THREE.Euler(...brush.rotation.map(THREE.MathUtils.degToRad) as Vec3,'XYZ');
  return extents.map(([mn,mx],i)=>{
    const middle=mn.map((n,axis)=>(n+mx[axis])/2) as Vec3;
    const p=v(middle).applyEuler(rotation).add(v(brush.position));
    const dims=mn.map((n,axis)=>mx[axis]-n) as Vec3;
    const wall=createBrush('box',vec(p),dims,`${brush.name} / Shell ${i+1}`);
    wall.rotation=[...brush.rotation];wall.layer=brush.layer;wall.entityId=brush.entityId;
    const tex=brush.faces[Math.min(brush.faces.length-1,i)]?.texture||'NULL';
    wall.faces=wall.faces.map(f=>({...f,texture:tex}));
    const issues=validateBrush(wall);if(issues.length)throw Error(issues[0]);
    return wall;
  });
}
/** Face push/pull, not Blender mesh extrusion: move a supporting plane while
 * retaining a single convex, closed Svengine brush. */
export function pushPullFace(brush:Brush,faceIndex:number,distance:number):Brush{
  const face=brush.faces[faceIndex];
  if(!face||!Number.isFinite(distance))throw Error('Select a valid face and distance.');
  const a=v(brush.vertices[face.indices[0]]),b=v(brush.vertices[face.indices[1]]),c=v(brush.vertices[face.indices[2]]);
  const outward=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
  if(outward.lengthSq()<.5)throw Error('Face is degenerate.');
  const delta=vec(outward.multiplyScalar(distance));
  return editBrushVertices(brush,face.indices,delta);
}
