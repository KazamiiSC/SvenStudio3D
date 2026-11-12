/** GoldSrc road, walkway, ventilation and pipe generator.
 * A single cross-section is shared at each station to prevent overlapping
 * rectangular strips and visible holes at bends. All output is convex brushes.
 * The editable controls live in the Studio; generated solids remain editable.
 */
import type {Brush,Face,Vec3} from './types';
import {uid} from './types';
import {orientFaces} from './geometry';
import {validateBrush,exportBrush} from './exportMap';
import {inspectMapImport} from './importMap';
import {Vector3} from 'three';
import {ConvexHull} from 'three-stdlib';
import type {RailwaySettings} from './railwayBuilder';

export type PathStructureKind='road'|'walkway'|'vent'|'pipe'|'cable'|'rail'|'fence'|'bridge'|'cave';
export type PathStructureOptions={
  points:Vec3[];kind:PathStructureKind;width:number;height:number;wallThickness:number;
  texture:string;name?:string;smooth?:boolean;subdivisions?:number;
  /** Only for linked thin terrain: omit roof panels at tunnel mouths. */
  surfacePortals?:boolean;
  /** Optional road details; defaults are deliberately off. */
  sidewalkWidth?:number;curbHeight?:number;
  /** Distance between supports/sleepers in game units. */
  repeatSpacing?:number;
  /** Cable-only: approximate vertical droop between consecutive anchor points (units). */
  cableSag?:number;
  /** Cable-only: parallel strands and their spacing, aligned to the transported local frame. */
  cableCount?:number; cableSpacing?:number;
  /** Rail-only optional stations, native train network and turnout generation. */
  railway?:RailwaySettings;
};
/** Project-only metadata, not serialized into GoldSrc MAP. Enables regeneration
 * with a safe signature guard when the generated brushes were edited manually. */
export type PathStructureRecord={id:string;origin:Vec3;options:PathStructureOptions;brushIds:string[];signatures:string[];
  /** Smart World route must be regenerated atomically with this terrain. */
  integratedTerrainId?:string;
  /** Optional generated native path_track, train and control entity signatures. */
  entityIds?:string[];entitySignatures?:string[];};
type P2=[number,number];
const round=(n:number)=>Math.round(n*1000)/1000;
const d2=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const d3=(a:Vec3,b:Vec3)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const isSweep3D=(kind:PathStructureKind)=>kind==='vent'||kind==='pipe'||kind==='cable'||kind==='cave';
const subtract=(a:P2,b:P2):P2=>[a[0]-b[0],a[1]-b[1]];
const cross=(a:P2,b:P2)=>a[0]*b[1]-a[1]*b[0];
const unit=(a:P2):P2=>{const l=Math.hypot(...a);return l>1e-7?[a[0]/l,a[1]/l]:[1,0]};
const left=(a:P2):P2=>[-a[1],a[0]];
const segmentIntersect=(a:Vec3,b:Vec3,c:Vec3,d:Vec3)=>{
  const ab:P2=[b[0]-a[0],b[1]-a[1]],cd:P2=[d[0]-c[0],d[1]-c[1]],ca:P2=[c[0]-a[0],c[1]-a[1]],det=cross(ab,cd);
  if(Math.abs(det)<1e-7)return false;
  const t=cross(ca,cd)/det,u=cross(ca,ab)/det;
  return t>1e-5&&t<1-1e-5&&u>1e-5&&u<1-1e-5;
};
export function validatePathStructure(o:PathStructureOptions):string[]{
  const problems:string[]=[];
  if(!Array.isArray(o.points)||o.points.length<2||o.points.length>48||o.points.some(p=>p.length!==3||p.some(n=>!Number.isFinite(n)||Math.abs(n)>120000)))return ['Path needs 2–48 valid control points.'];
  if(o.surfacePortals!==undefined&&(o.kind!=='cave'||typeof o.surfacePortals!=='boolean'))problems.push('Surface portals require a cave tunnel.');
  if(!Number.isFinite(o.width)||o.width<(o.kind==='cable'?4:16)||o.width>(o.kind==='cable'?32:768))problems.push(o.kind==='cable'?'Cable diameter must be 4–32 units.':'Width must be 16–768 units.');
  if(!Number.isFinite(o.height)||o.height<16||o.height>512)problems.push('Height must be 16–512 units.');
  if(!Number.isFinite(o.wallThickness)||o.wallThickness<2||o.wallThickness>64||(['vent','pipe'].includes(o.kind)&&o.wallThickness*2>=Math.min(o.width,o.height)))problems.push('Wall thickness too large for profile.');
  if(!/^[^\s"()[\]]{1,32}$/.test(o.texture))problems.push('Invalid GoldSrc texture name.');
  if((o.subdivisions??6)<1||(o.subdivisions??6)>16||!Number.isInteger(o.subdivisions??6))problems.push('Curve quality must be between 1 and 16.');
  if(o.repeatSpacing!==undefined&&(!Number.isFinite(o.repeatSpacing)||o.repeatSpacing<32||o.repeatSpacing>512))problems.push('Support spacing must be 32–512 units.');
  if(o.cableSag!==undefined&&(!Number.isFinite(o.cableSag)||o.cableSag<0||o.cableSag>256))problems.push('Cable droop must be 0–256 units.');
  if(o.cableCount!==undefined&&(!Number.isInteger(o.cableCount)||o.cableCount<1||o.cableCount>4))problems.push('Cable strand count must be 1–4.');
  if(o.cableSpacing!==undefined&&(!Number.isFinite(o.cableSpacing)||o.cableSpacing<4||o.cableSpacing>64))problems.push('Cable strand spacing must be 4–64 units.');
  if(o.kind==='cable'&&(o.cableCount??1)>1&&(o.cableSpacing??12)<o.width)problems.push('Cable strands would overlap; increase spacing or reduce diameter.');
  if((o.sidewalkWidth??0)<0||(o.sidewalkWidth??0)>128||!Number.isFinite(o.sidewalkWidth??0))problems.push('Invalid sidewalk width.');
  if((o.curbHeight??0)<0||(o.curbHeight??0)>24||!Number.isFinite(o.curbHeight??0))problems.push('Invalid curb height.');
  for(let i=1;i<o.points.length;i++)if((isSweep3D(o.kind)?d3:d2)(o.points[i-1],o.points[i])<12)problems.push(isSweep3D(o.kind)?'Path control points must be at least 12 units apart.':'Path control points must be at least 12 horizontal units apart.');
  return problems;
}
/** Centripetal Catmull-Rom sampling prevents the large overshoots of a uniform spline.
 * Short straight sections are kept simple; curved sections gain more samples. */
export function samplePath(o:PathStructureOptions):Vec3[]{
  if(o.kind==='cable'&&(o.cableSag??0)>0)return sampleCableSag(o.points,o.cableSag??0);
  if(!o.smooth||o.points.length<3)return o.points.map(p=>[...p]);
  const p=o.points,quality=o.subdivisions??6,out:Vec3[]=[];
  const distance=isSweep3D(o.kind)?d3:d2;
  const tj=(a:Vec3,b:Vec3)=>Math.max(0.01,Math.sqrt(Math.max(1e-6,distance(a,b))));
  for(let i=0;i<p.length-1;i++){
    const p0=p[Math.max(0,i-1)],p1=p[i],p2=p[i+1],p3=p[Math.min(p.length-1,i+2)];
    const t0=0,t1=t0+tj(p0,p1),t2=t1+tj(p1,p2),t3=t2+tj(p2,p3);
    const tangent=(a:Vec3,b:Vec3,c:Vec3,ta:number,tb:number,tc:number,axis:number)=>{
      const ab=(b[axis]-a[axis])/(tb-ta),bc=(c[axis]-b[axis])/(tc-tb);
      return (ab*(tc-tb)+bc*(tb-ta))/(tc-ta)*(tc-tb);
    };
    const m1=[0,1,2].map(axis=>tangent(p0,p1,p2,t0,t1,t2,axis));
    const m2=[0,1,2].map(axis=>tangent(p1,p2,p3,t1,t2,t3,axis));
    const a=P2From(p1,p0),b=P2From(p2,p1),c=P2From(p3,p2);
    const deflection=Math.abs(Math.atan2(cross(a,b),a[0]*b[0]+a[1]*b[1]))+Math.abs(Math.atan2(cross(b,c),b[0]*c[0]+b[1]*c[1]));
    const steps=Math.max(2,Math.min(32,Math.ceil(distance(p1,p2)/64)+Math.ceil(deflection*quality/2)));
    for(let k=0;k<steps;k++){
      const u=k/steps,u2=u*u,u3=u2*u;
      out.push([0,1,2].map(axis=>round((2*u3-3*u2+1)*p1[axis]+(u3-2*u2+u)*m1[axis]+(-2*u3+3*u2)*p2[axis]+(u3-u2)*m2[axis])) as Vec3);
    }
  }
  out.push([...p[p.length-1]]);
  // Remove undersized samples; prevents near-zero BSP brushes at smooth joins.
  const clean:Vec3[]=[out[0]];
  for(let i=1;i<out.length-1;i++)if(distance(out[i],clean[clean.length-1])>=10)clean.push(out[i]);
  if(distance(out[out.length-1],clean[clean.length-1])<10)clean.pop();
  clean.push(out[out.length-1]);
  return clean;
}
/** Hanging cable between real anchors. This is a controllable parabolic approximation,
 * not a physics simulation; the original control points stay fixed and editable. */
export function sampleCableSag(anchors:Vec3[],droop:number):Vec3[]{
  const samples:Vec3[]=[];
  for(let i=0;i<anchors.length-1;i++){
    const a=anchors[i],b=anchors[i+1],length=d3(a,b);
    const steps=Math.min(40,Math.max(4,Math.ceil(length/24)));
    for(let j=0;j<steps;j++){
      const u=j/steps;
      samples.push([round(a[0]+(b[0]-a[0])*u),round(a[1]+(b[1]-a[1])*u),round(a[2]+(b[2]-a[2])*u-4*droop*u*(1-u))]);
    }
  }
  samples.push([...anchors[anchors.length-1]]);
  return samples;
}

/** Stable local frames transported along a true XYZ route. Unlike the legacy
 * horizontal construction, a vertical segment has a valid cross-section. */
type SweepFrame={center:Vector3;right:Vector3;up:Vector3;tangent:Vector3};
export function sweepFrames3D(points:Vec3[]):SweepFrame[]{
  if(points.length<2)throw Error('A 3D sweep needs at least two stations.');
  const positions=points.map(p=>new Vector3(...p));
  const directions=positions.slice(1).map((p,i)=>p.clone().sub(positions[i]).normalize());
  const tangents=positions.map((_,i)=>{
    if(i===0)return directions[0].clone();
    if(i===positions.length-1)return directions[directions.length-1].clone();
    const pair=directions[i-1].clone().add(directions[i]);
    if(pair.lengthSq()<0.04)throw Error('180-degree reversal in 3D path. Add a wider corner.');
    return pair.normalize();
  });
  const firstUp=Math.abs(tangents[0].z)>0.92?new Vector3(0,1,0):new Vector3(0,0,1);
  let right=new Vector3().crossVectors(tangents[0],firstUp).normalize();
  const frames:SweepFrame[]=[];
  for(let i=0;i<positions.length;i++){
    if(i){
      const axis=new Vector3().crossVectors(tangents[i-1],tangents[i]);
      const sin=axis.length(),cos=Math.max(-1,Math.min(1,tangents[i-1].dot(tangents[i])));
      if(sin>1e-8)right.applyAxisAngle(axis.multiplyScalar(1/sin),Math.atan2(sin,cos));
      right.addScaledVector(tangents[i],-right.dot(tangents[i])).normalize();
    }
    const up=new Vector3().crossVectors(right,tangents[i]).normalize();
    frames.push({center:positions[i],right:right.clone(),up,tangent:tangents[i]});
  }
  return frames;
}
const framePoint=(frame:SweepFrame,side:number,height:number,offset=0):Vec3=>{
  const v=frame.center.clone().addScaledVector(frame.right,side+offset).addScaledVector(frame.up,height);
  return [round(v.x),round(v.y),round(v.z)];
};
/** Each hollow wall is a closed convex GoldSrc brush: ring sections have the
 * same vertices at their shared station, so corners do not create loose caps. */
function sweepHollowPanel(a:SweepFrame,b:SweepFrame,outer:{side:number;z:number}[],inner:{side:number;z:number}[],k:number,texture:string,name:string,group:string):Brush[]{
  const j=(k+1)%outer.length;
  const pts=[outer[k],outer[j],inner[j],inner[k]];
  const verts=[...pts.map(p=>framePoint(a,p.side,p.z)),...pts.map(p=>framePoint(b,p.side,p.z))];
  return panelBrushes(verts,texture,`${name} wall ${k+1}`,group);
}
/** A convex tetrahedron has four planar triangular faces, so twisted 3D
 * sweep panels can be divided without producing invalid GoldSrc planes. */
function tetraBrush(vertices:Vec3[],texture:string,name:string,group:string):Brush{
  const faces:Face[]=orientFaces(vertices,[[0,1,2],[0,3,1],[1,3,2],[2,3,0]].map(indices=>({indices,texture})));
  const b:Brush={id:uid(),kind:'brush',name,primitive:'poly',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices,faces,group,layer:'Paths'};
  const issues=validateBrush(b);if(issues.length)throw Error(`${name}: ${issues[0]}`);
  return b;
}
/** Standard 5-tet decomposition of a cross-section quad extruded to the next
 * station. It handles twisting quads by triangulating their non-planar sides. */
function panelBrushes(verts:Vec3[],texture:string,name:string,group:string):Brush[]{
  try{return [makeBrush(verts,texture,name,group)];}
  catch{
    const sets=[[0,1,3,4],[1,2,3,6],[1,3,4,6],[1,4,5,6],[3,4,6,7]];
    return sets.map((ids,i)=>tetraBrush(ids.map(k=>verts[k]),texture,`${name} part ${i+1}`,group));
  }
}
/** A faceted solid cable segment: use a single section frame at both ends to
 * guarantee planar sides. Adjacent short segments have practically continuous
 * edges at ordinary cable thicknesses. */
function sweepSolidSection(a:SweepFrame,b:SweepFrame,radius:number,offset:number,texture:string,name:string,group:string):Brush{
  const tangent=b.center.clone().sub(a.center).normalize();
  const right=a.right.clone().addScaledVector(tangent,-a.right.dot(tangent)).normalize();
  const up=new Vector3().crossVectors(right,tangent).normalize();
  const sides=6,verts:Vec3[]=[];
  for(const center of [a.center,b.center])for(let j=0;j<sides;j++){
    const theta=2*Math.PI*j/sides;
    const v=center.clone().addScaledVector(right,offset+radius*Math.cos(theta)).addScaledVector(up,radius*Math.sin(theta));
    verts.push([round(v.x),round(v.y),round(v.z)]);
  }
  const indices=[Array.from({length:sides},(_,i)=>sides-1-i),Array.from({length:sides},(_,i)=>i+sides)];
  for(let j=0;j<sides;j++)indices.push([j,(j+1)%sides,(j+1)%sides+sides,j+sides]);
  const brush:Brush={id:uid(),kind:'brush',name,primitive:'poly',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices:verts,faces:orientFaces(verts,indices.map(ids=>({indices:ids,texture}))),group,layer:'Paths'};
  const issues=validateBrush(brush);if(issues.length)throw Error(`${name}: ${issues[0]}`);
  return brush;
}
function buildSwept3D(o:PathStructureOptions,samples:Vec3[]):Brush[]{
  const frames=sweepFrames3D(samples),group=o.name||'3D Path Structure',out:Brush[]=[];
  const t=o.wallThickness;
  // Rounded, walkable cave: eight-sided rock shell with a broad flat floor.
  // The paired cross-section is extruded by convex sweep panels, never an open mesh.
  const caveRing=(w:number,h:number):{side:number;z:number}[]=>{
    const half=w/2;
    return [
      {side:-half*.55,z:-h*.5},{side:half*.55,z:-h*.5},
      {side:half,z:-h*.25},{side:half*.95,z:h*.19},
      {side:half*.38,z:h*.5},{side:-half*.38,z:h*.5},
      {side:-half*.95,z:h*.19},{side:-half,z:-h*.25},
    ].map(p=>({side:round(p.side),z:round(p.z)}));
  };
  const outer=o.kind==='cave'?caveRing(o.width,o.height):o.kind==='vent'
    ?[{side:-o.width/2,z:-o.height/2},{side:o.width/2,z:-o.height/2},{side:o.width/2,z:o.height/2},{side:-o.width/2,z:o.height/2}]
    :Array.from({length:8},(_,j)=>({side:round(Math.cos(j*Math.PI/4)*o.width/2),z:round(Math.sin(j*Math.PI/4)*o.width/2)}));
  const inner=o.kind==='cave'?caveRing(o.width-2*t,o.height-2*t):o.kind==='vent'
    ?[{side:-o.width/2+t,z:-o.height/2+t},{side:o.width/2-t,z:-o.height/2+t},{side:o.width/2-t,z:o.height/2-t},{side:-o.width/2+t,z:o.height/2-t}]
    :Array.from({length:8},(_,j)=>({side:round(Math.cos(j*Math.PI/4)*(o.width/2-t)),z:round(Math.sin(j*Math.PI/4)*(o.width/2-t))}));
  if(o.kind==='pipe'&&o.width/2-t<=1)throw Error('Pipe wall thickness exceeds the pipe radius.');
  if(o.kind==='cave'&&Math.min(o.width,o.height)<=2*t+16)throw Error('Cave tunnel interior is too narrow for its walls.');
  for(let i=0;i<frames.length-1;i++){
    const a=frames[i],b=frames[i+1];
    if(a.center.distanceTo(b.center)<0.1)throw Error('Repeated sample points in 3D path.');
    if(o.kind==='cable'){
      const count=o.cableCount??1,spacing=o.cableSpacing??12;
      for(let strand=0;strand<count;strand++){
        out.push(sweepSolidSection(a,b,o.width/2,(strand-(count-1)/2)*spacing,o.texture,`${group} · cable ${strand+1} · ${i+1}`,group));
      }
    }else{
      for(let k=0;k<outer.length;k++){
        // A thin-terrain cutout must actually open into the cave interior;
        // otherwise the arched roof would block the vertical access.
        const isMouth=i===0||i===frames.length-2;
        if(o.kind==='cave'&&o.surfacePortals&&isMouth&&(k===3||k===4||k===5))continue;
        out.push(...sweepHollowPanel(a,b,outer,inner,k,o.texture,`${group} · section ${i+1}`,group));
      }
    }
    if(out.length>640)throw Error('More than 640 brushes: reduce cable strands, curve detail or path length.');
  }
  return out;
}

const P2From=(a:Vec3,b:Vec3):P2=>[a[0]-b[0],a[1]-b[1]];
/** Mitered cross-sections meet at exactly the same point on either side of a bend.
 * A path too tight for its width is rejected rather than producing a crossing. */
export function pathStations(points:Vec3[],width:number):{points:Vec3[];directions:P2[];normals:P2[];miters:number[]}{
  const dirs=points.slice(1).map((p,i)=>unit(P2From(p,points[i])));
  const normals:P2[]=[],miters:number[]=[];
  for(let i=0;i<points.length;i++){
    if(i===0||i===points.length-1){normals.push(left(dirs[i===0?0:dirs.length-1]));miters.push(1);continue;}
    const n0=left(dirs[i-1]),n1=left(dirs[i]);
    const summed:P2=[n0[0]+n1[0],n0[1]+n1[1]];
    const len=Math.hypot(...summed);
    if(len<0.2)throw Error('180-degree reversal: add points to make a wider turn.');
    const m:P2=[summed[0]/len,summed[1]/len];
    const divisor=m[0]*n1[0]+m[1]*n1[1];
    const scale=1/divisor;
    if(!Number.isFinite(scale)||scale>3.2)throw Error('Turn is too tight for this road width. Increase the radius.');
    normals.push(m);miters.push(scale);
  }
  return {points,directions:dirs,normals,miters};
}
const stationPoint=(s:ReturnType<typeof pathStations>,i:number,side:number,z:number):Vec3=>[
  round(s.points[i][0]+s.normals[i][0]*s.miters[i]*side),
  round(s.points[i][1]+s.normals[i][1]*s.miters[i]*side),
  round(s.points[i][2]+z),
];
const makeBrush=(vertices:Vec3[],texture:string,name:string,group:string,triangular=false):Brush=>{
  const index=triangular?[[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]]:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
  const faces:Face[]=orientFaces(vertices,index.map(indices=>({indices,texture})));
  const brush:Brush={id:uid(),kind:'brush',name,primitive:'poly',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices,faces,group,layer:'Paths'};
  const errors=validateBrush(brush);
  if(errors.length)throw Error(`${name}: ${errors[0]}`);
  return brush;
};
function buildStrip(s:ReturnType<typeof pathStations>,i:number,lo:number,hi:number,z0:number,z1:number,texture:string,name:string,group:string):Brush[]{
  const p=(station:number,side:number,z:number)=>stationPoint(s,station,side,z);
  const verts:Vec3[]=[p(i,lo,z0),p(i+1,lo,z0),p(i+1,hi,z0),p(i,hi,z0),p(i,lo,z1),p(i+1,lo,z1),p(i+1,hi,z1),p(i,hi,z1)];
  try{return [makeBrush(verts,texture,name,group)];}
  catch{
    // A gradient plus an XY bend can make the top quad nonplanar. Split into
    // two closed triangular prisms instead of exporting invalid BSP faces.
    const first=[verts[0],verts[1],verts[2],verts[4],verts[5],verts[6]];
    const second=[verts[0],verts[2],verts[3],verts[4],verts[6],verts[7]];
    return [makeBrush(first,texture,name+' A',group,true),makeBrush(second,texture,name+' B',group,true)];
  }
}
/** Planar convex hull fallback for a twisted sweep panel. Small diagonally
 * oriented pipe wall panels can have non-planar quads at turns; a convex hull
 * produces real planar GoldSrc faces without pretending they are quads. */
function hullBrush(vertices:Vec3[],texture:string,name:string,group:string):Brush{
  const points=vertices.map(v=>new Vector3(...v));
  const hull=new ConvexHull().setFromPoints(points);
  const indices=(p:Vector3)=>{
    const index=points.findIndex(v=>v.distanceToSquared(p)<0.000001);
    if(index<0)throw Error(`${name}: cannot resolve convex hull vertex.`);
    return index;
  };
  const faces:Face[]=hull.faces.map(face=>{
    const edge=face.edge;
    return {indices:[indices(edge.head().point),indices(edge.next.head().point),indices(edge.next.next.head().point)],texture};
  });
  if(faces.length<4)throw Error(`${name}: cannot construct convex panel.`);
  // Three's ConvexHull triangulates each planar side. MAP expects *one* face
  // per unique plane; duplicate coplanar triangle planes make it unreconstructable.
  const oriented=orientFaces(vertices,faces),unique:Face[]=[];
  const planes:{normal:Vector3;constant:number}[]=[];
  for(const face of oriented){
    const [i,j,k]=face.indices;const a=points[i],b=points[j],c=points[k];
    const normal=new Vector3().subVectors(b,a).cross(new Vector3().subVectors(c,a));
    if(normal.lengthSq()<1e-10)continue;
    normal.normalize();const constant=normal.dot(a);
    if(planes.some(p=>p.normal.dot(normal)>0.99999&&Math.abs(p.constant-constant)<0.002))continue;
    planes.push({normal,constant});
    const coplanar=points.map((v,index)=>({v,index})).filter(item=>Math.abs(normal.dot(item.v)-constant)<0.002);
    const center=new Vector3();for(const item of coplanar)center.add(item.v);center.multiplyScalar(1/coplanar.length);
    const axisX=Math.abs(normal.z)<0.9?new Vector3(0,0,1):new Vector3(0,1,0);
    axisX.addScaledVector(normal,-normal.dot(axisX)).normalize();
    const axisY=new Vector3().crossVectors(normal,axisX).normalize();
    const ordered=coplanar.sort((a,b)=>{
      const da=a.v.clone().sub(center),db=b.v.clone().sub(center);
      return Math.atan2(da.dot(axisY),da.dot(axisX))-Math.atan2(db.dot(axisY),db.dot(axisX));
    });
    unique.push({indices:ordered.map(item=>item.index),texture});
  }
  const brush:Brush={id:uid(),kind:'brush',name,primitive:'poly',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices,faces:unique,group,layer:'Paths'};
  const invalid=validateBrush(brush);
  if(invalid.length)throw Error(`${name}: ${invalid[0]}`);
  return brush;
}
/** A small upright, oriented cuboid around a path station. Uses the same
 * tangent/normal frame as the full swept structure; no overlapping vertex
 * planes or non-planar brush faces. */
function stationBlock(s:ReturnType<typeof pathStations>,i:number,side:number,along:number,across:number,z0:number,z1:number,texture:string,name:string,group:string):Brush{
  const center=s.points[i],heading=s.directions[Math.min(i,s.directions.length-1)]||[1,0] as P2,normal=s.normals[i];
  const corner=(a:number,b:number,z:number):Vec3=>[
    round(center[0]+heading[0]*a+normal[0]*(side+b)),
    round(center[1]+heading[1]*a+normal[1]*(side+b)),
    round(center[2]+z),
  ];
  const v:Vec3[]=[corner(-along/2,-across/2,z0),corner(along/2,-across/2,z0),corner(along/2,across/2,z0),corner(-along/2,across/2,z0),corner(-along/2,-across/2,z1),corner(along/2,-across/2,z1),corner(along/2,across/2,z1),corner(-along/2,across/2,z1)];
  return makeBrush(v,texture,name,group);
}
/** Uniform arc-distance repeats. Consecutive nearly coincident stations are
 * skipped, while the final endpoint is always present. */
function spacedStations(points:Vec3[],spacing:number):number[]{
  const indices=[0];let next=spacing,travel=0;
  for(let i=1;i<points.length;i++){
    travel+=Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1],points[i][2]-points[i-1][2]);
    if(travel>=next){indices.push(i);next=travel+spacing;}
  }
  if(indices.at(-1)!==points.length-1)indices.push(points.length-1);
  return indices;
}
function buildProfile(s:ReturnType<typeof pathStations>,i:number,outer:{side:number;z:number}[],inner:{side:number;z:number}[],texture:string,name:string,group:string):Brush[]{
  const result:Brush[]=[];
  for(let k=0;k<outer.length;k++){
    const j=(k+1)%outer.length;
    const a=outer[k],b=outer[j],c=inner[j],d=inner[k];
    const v=(station:number,p:{side:number;z:number})=>stationPoint(s,station,p.side,p.z);
    const verts=[v(i,a),v(i+1,a),v(i+1,b),v(i,b),v(i,d),v(i+1,d),v(i+1,c),v(i,c)];
    try{result.push(makeBrush(verts,texture,`${name} panel ${k+1}`,group));}
    catch{result.push(hullBrush(verts,texture,`${name} panel ${k+1}`,group));}
  }
  return result;
}
/** Verify the exact serialized Valve 220 planes before committing geometry. */
export function verifyPathMapBrushes(brushes:Brush[]):void{
  const map=`{\n"classname" "worldspawn"\n${brushes.map(exportBrush).join('\n')}\n}`;
  const result=inspectMapImport(map,'path_qa.map');
  if(result.report.skippedBrushes)throw Error(`${result.report.skippedBrushes} segments do not survive a Valve 220 MAP round-trip. Increase the turn radius or reduce curve detail.`);
}
/** Preserve a roof over the body of short cave routes. Without this, a
 * three-point unsmoothed path would remove both roof sections along its full
 * length instead of creating small entry and exit portals. */
function portalMouthStations(samples:Vec3[]):Vec3[]{
  if(samples.length<3)throw Error('A cave with surface portals needs at least three stations.');
  const output=samples.map(p=>[...p] as Vec3);
  const point=(a:Vec3,b:Vec3,dist:number):Vec3=>{
    const length=d3(a,b),f=dist/length;
    return [round(a[0]+(b[0]-a[0])*f),round(a[1]+(b[1]-a[1])*f),round(a[2]+(b[2]-a[2])*f)];
  };
  const head=d3(output[0],output[1]);
  if(head>56)output.splice(1,0,point(output[0],output[1],Math.min(32,head*.3)));
  const count=output.length,tail=d3(output[count-2],output[count-1]);
  if(tail>56)output.splice(count-1,0,point(output[count-1],output[count-2],Math.min(32,tail*.3)));
  return output;
}
export function createPathStructureBrushes(o:PathStructureOptions,verifyMap=false):Brush[]{
  const errors=validatePathStructure(o);if(errors.length)throw Error(errors.join(' '));
  const samples=o.kind==='cave'&&o.surfacePortals?portalMouthStations(samplePath(o)):samplePath(o);
  if(samples.length>240)throw Error('Too many sampled segments; reduce curve quality.');
  for(let i=0;i<samples.length-1;i++)for(let j=i+2;j<samples.length-1;j++){
    // A pipe crossing itself in the XY projection may be at a different Z.
    if(segmentIntersect(samples[i],samples[i+1],samples[j],samples[j+1])&&!isSweep3D(o.kind))throw Error('Path intersects itself. Move the control points apart.');
  }
  // 3D pipes, ducts, caves and cables use parallel-transported local cross-sections.
  // Other structures retain their original horizontal brush-generation workflow.
  if(isSweep3D(o.kind)){
    const out=buildSwept3D(o,samples);
    if(verifyMap)verifyPathMapBrushes(out);
    return out;
  }
  const s=pathStations(samples,o.width+(o.sidewalkWidth??0)*2),group=o.name||'Path Structure',out:Brush[]=[];
  const hw=o.width/2,t=o.wallThickness,h=o.height,sidewalk=o.kind==='road'?(o.sidewalkWidth??0):0;
  const newModes=['rail','fence','bridge'].includes(o.kind);
  const spacing=o.repeatSpacing??(o.kind==='rail'?64:128);
  for(let i=0;i<samples.length-1;i++){
    const name=`${group} · ${i+1}`;
    if(o.kind==='walkway'||o.kind==='road'||o.kind==='bridge'){
      out.push(...buildStrip(s,i,-hw,hw,-t,0,o.texture,`${name} roadway`,group));
      if(sidewalk){
        const z=o.curbHeight??8;
        out.push(...buildStrip(s,i,-hw-sidewalk,-hw,-t,z,o.texture,`${name} left sidewalk`,group));
        out.push(...buildStrip(s,i,hw,hw+sidewalk,-t,z,o.texture,`${name} right sidewalk`,group));
      }
      if(o.kind==='bridge'){
        const side=hw-3,railZ=48;
        for(const offset of [-side,side]){
          out.push(...buildStrip(s,i,offset-3,offset+3,railZ,railZ+7,o.texture,`${name} guardrail`,group));
        }
      }
    }else if(o.kind==='rail'){
      // Two continuous rails follow exactly the same station normals.
      const gauge=hw*.75;
      for(const offset of [-gauge,gauge]){
        out.push(...buildStrip(s,i,offset-4,offset+4,6,16,o.texture,`${name} rail`,group));
      }
    }else if(o.kind==='fence'){
      // Vertical posts are generated after the strips at fixed intervals.
      for(const z of [h*.3,h*.76]){
        out.push(...buildStrip(s,i,-3,3,z,z+6,o.texture,`${name} fence rail`,group));
      }
    }else if(o.kind==='vent'){
      const outer=[{side:-hw,z:0},{side:hw,z:0},{side:hw,z:h},{side:-hw,z:h}];
      const inner=[{side:-hw+t,z:t},{side:hw-t,z:t},{side:hw-t,z:h-t},{side:-hw+t,z:h-t}];
      out.push(...buildProfile(s,i,outer,inner,o.texture,name,group));
    }else{
      const n=8,r=hw,ir=r-t,z=h/2;
      if(ir<=1)throw Error('Pipe wall thickness exceeds the pipe radius.');
      const outer=Array.from({length:n},(_,j)=>({side:round(Math.cos(j*2*Math.PI/n)*r),z:round(Math.sin(j*2*Math.PI/n)*r+z)}));
      const inner=Array.from({length:n},(_,j)=>({side:round(Math.cos(j*2*Math.PI/n)*ir),z:round(Math.sin(j*2*Math.PI/n)*ir+z)}));
      out.push(...buildProfile(s,i,outer,inner,o.texture,name,group));
    }
    if(out.length>640)throw Error('More than 640 brushes: simplify the path or reduce curve quality.');
  }
  if(newModes){
    // Repetitions are limited independently from spline sampling so a detailed
    // bend does not create a support at every tiny segment.
    for(const index of spacedStations(samples,spacing)){
      const label=`${group} · station ${index+1}`;
      if(o.kind==='rail'){
        out.push(stationBlock(s,index,0,10,o.width+24,-5,4,o.texture,`${label} sleeper`,group));
      }else if(o.kind==='fence'){
        out.push(stationBlock(s,index,0,10,10,-8,h+8,o.texture,`${label} post`,group));
      }else if(o.kind==='bridge'){
        // Guardrail posts on both sides; optional bridge columns extend down
        // from the deck, not necessarily all the way to the terrain.
        for(const offset of [-hw+3,hw-3])out.push(stationBlock(s,index,offset,10,10,0,56,o.texture,`${label} guard post`,group));
        if(index!==0&&index!==samples.length-1){
          out.push(stationBlock(s,index,0,12,Math.max(16,o.width/2),-Math.max(48,h),-t,o.texture,`${label} pier`,group));
        }
      }
      if(out.length>640)throw Error('More than 640 brushes: increase support spacing or reduce curve quality.');
    }
  }
  if(!out.length)throw Error('Path did not generate any brushes.');
  if(verifyMap)verifyPathMapBrushes(out);
  return out;
}
