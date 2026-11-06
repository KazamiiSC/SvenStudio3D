/** Read-only camera preview diagnostics. No modification of brushes or MAP export. */
import type {Brush,Vec3} from './types';
import type {CinematicScene} from './cinematic';
import {cinematicRouteLegs} from './cinematic';
import {transformedVertices} from './geometry';

const dot=(a:Vec3,b:Vec3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a:Vec3,b:Vec3):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

/** Detect a camera embedded inside a convex GoldSrc brush, including rotations.
 * An approximate editor-side warning, never a collision simulation. */
export function pointInsideCinematicBrush(brush:Brush,point:Vec3,tolerance=0.05):boolean{
  if(brush.faces.length<4||brush.vertices.length<4)return false;
  const vertices=transformedVertices(brush);
  const center:Vec3=[0,0,0];
  for(const vertex of vertices)for(let i=0;i<3;i++)center[i]+=vertex[i]/vertices.length;
  let validFaces=0;
  for(const face of brush.faces){
    if(face.indices.length<3)continue;
    const a=vertices[face.indices[0]],b=vertices[face.indices[1]],c=vertices[face.indices[2]];
    if(!a||!b||!c)return false;
    let normal=cross(sub(b,a),sub(c,a));
    const length=Math.hypot(...normal);
    if(length<1e-7)continue;
    const faceCenter:Vec3=[0,0,0];
    for(const index of face.indices){const vertex=vertices[index];if(!vertex)return false;for(let i=0;i<3;i++)faceCenter[i]+=vertex[i]/face.indices.length;}
    if(dot(normal,sub(faceCenter,center))<0)normal=normal.map(n=>-n) as Vec3;
    if(dot(normal,sub(point,a))/length>tolerance)return false;
    validFaces++;
  }
  return validFaces>=4;
}

/** Read-only, sampled path clearance warnings: may miss thin geometry and is not
 * a substitute for GoldSrc collision hulls. Hidden world brushes are included. */
export function diagnoseCinematicPath(scene:CinematicScene,brushes:Brush[]):string[]{
  const warnings:string[]=[];
  const solids=brushes.filter(b=>!b.entityId).slice(0,250);
  const legs=cinematicRouteLegs(scene);
  const target=scene.lookTarget;
  if(target&&Math.hypot(...target.position.map((n,j)=>n-scene.camera.position[j]))<8)
    warnings.push('Look target is too close to camera start.');
  if(legs.length){
    let length=0;
    for(let i=0;i<legs.length;i++){
      const leg=legs[i];length+=leg.distance;
      if(leg.distance<8){warnings.push(`Path segment ${i+1} is shorter than 8 units.`);continue;}
      const samples=Math.min(12,Math.max(2,Math.ceil(leg.distance/80)));
      let blocked:string|undefined;
      for(let sample=1;sample<samples&&!blocked;sample++){
        const t=sample/samples;
        const pos=leg.from.position.map((n,j)=>n+(leg.to.position[j]-n)*t) as Vec3;
        blocked=solids.find(brush=>pointInsideCinematicBrush(brush,pos))?.name;
      }
      if(blocked)warnings.push(`Segment ${i+1} may cross solid brush: ${blocked}.`);
      if(warnings.length>=8)break;
    }
    const speed=Number(scene.camera.props.speed);
    const hold=Number(scene.camera.props.wait);
    if(speed>0&&hold>0&&length/speed>hold+0.5)
      warnings.push(`Estimated route duration ${Math.round(length/speed*10)/10}s exceeds hold time ${hold}s (ignores native acceleration).`);
  }
  const flags=Number(scene.camera.props.spawnflags)||0;
  if(flags&1)warnings.push("Start at Player: the preview cannot reproduce the activator's starting position.");
  if(flags&2)warnings.push('Follow Player: dynamic target movement is not simulated.');
  return warnings;
}
