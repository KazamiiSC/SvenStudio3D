import * as THREE from 'three';
import { transformedVertices,round,textureAxes } from './geometry';
import type { Brush,PointEntity,Project,Vec3 } from './types';

const safe = (s: string) => s.replace(/["\r\n]/g,' ').trim();
const fmt = (n:number) => String(round(n,3));
const point = (p:Vec3) => `( ${p.map(fmt).join(' ')} )`;
const kv = (key:string,value:string) => `"${safe(key)}" "${safe(value)}"`;
const pairs = (props:Record<string,string>) => Object.entries(props).map(([k,v])=>kv(k,v)).join('\n');

// GoldSrc/Valve 220: each brush plane MUST point INTO the solid.
// The 3D mesh uses outward faces; writing those points unchanged causes
// SC-CSG "Illegal Brush (edge without opposite face)" and SC-BSP MAX_LEAF_FACES.
// Choose winding from transformed geometry (handles negative / mirrored scale).
export function exportBrush(b:Brush):string {
  // Never serialize only the surviving faces of a malformed brush: that could
  // silently turn a sealed room into a leak when compiled.
  const invalid=validateBrush(b);
  if(invalid.length)throw new Error(`Cannot export brush: ${invalid.join(' | ')}`);
  const vertices=transformedVertices(b);
  const center=new THREE.Vector3();
  vertices.forEach(p=>center.add(new THREE.Vector3(...p)));
  center.divideScalar(Math.max(vertices.length,1));
  const lines=b.faces.map(face=>{
    if(face.indices.length<3)return null;
    const ids=face.indices;
    const a=vertices[ids[0]],c=vertices[ids[1]],d=vertices[ids[2]];
    if(!a||!c||!d)return null;
    const normal=new THREE.Vector3(...c).sub(new THREE.Vector3(...a))
      .cross(new THREE.Vector3(...d).sub(new THREE.Vector3(...a)));
    if(normal.lengthSq()<0.0001)return null;
    const faceCenter=new THREE.Vector3();
    ids.forEach(i=>{if(vertices[i])faceCenter.add(new THREE.Vector3(...vertices[i]))});
    faceCenter.divideScalar(ids.length);
    // The mesh's cross-product points out of the solid; the .MAP plane
    // winding goes inwards. Never reverse the stored face itself (viewport).
    const inward=normal.dot(faceCenter.sub(center))>0;
    const second=inward?d:c,third=inward?c:d;
    normal.normalize();
    const {u,v}=textureAxes(vertices,face);
    const texture=safe(face.texture||'NULL').toUpperCase();
    // Valve 220 compiler reads explicit axes; the rotation is baked in above.
    return `${point(a)} ${point(second)} ${point(third)} ${texture} [ ${u.map(fmt).join(' ')} ${fmt(face.uShift||0)} ] [ ${v.map(fmt).join(' ')} ${fmt(face.vShift||0)} ] 0 ${fmt(face.uScale||1)} ${fmt(face.vScale||1)}`;
  }).filter(Boolean);
  if(lines.length<4)throw new Error(`${b.name}: brush has fewer than 4 valid faces`);
  return `{\n${lines.join('\n')}\n}`;
}

// Geometry checks before exporting: closed convex solids only.
// This catches invalid transformed faces instead of letting the BSP step fail.
export function validateBrush(b:Brush):string[]{
  const errors:string[]=[];
  const v=transformedVertices(b).map(p=>new THREE.Vector3(...p));
  if(v.length<4||b.faces.length<4)return [`${b.name}: brush needs >=4 vertices and >=4 faces.`];
  if(v.some(p=>p.toArray().some(x=>!Number.isFinite(x))))return [`${b.name}: invalid coordinates.`];
  if(v.some(p=>p.toArray().some(x=>Math.abs(x)>131072)))errors.push(`${b.name}: exceeds Svengine world coordinate limit (±131072).`);
  const centroid=new THREE.Vector3();v.forEach(p=>centroid.add(p));centroid.divideScalar(v.length);
  const edges=new Map<string,{count:number;direction:number}>();
  for(const [fi,face] of b.faces.entries()){
    const ids=face.indices;
    const label=`${b.name}, face ${fi+1}`;
    if(ids.length<3||new Set(ids).size!==ids.length||ids.some(i=>!Number.isInteger(i)||i<0||i>=v.length)){
      errors.push(`${label}: invalid vertex indices.`);continue;
    }
    const [a,c,d]=ids.map(i=>v[i]);
    const n=c.clone().sub(a).cross(d.clone().sub(a));
    const len=n.length();
    if(len<0.01){errors.push(`${label}: degenerate plane.`);continue;}
    n.divideScalar(len);
    // Canonical outward normal independent of face winding / negative scale.
    const fc=new THREE.Vector3();ids.forEach(i=>fc.add(v[i]));fc.divideScalar(ids.length);
    if(n.dot(fc.sub(centroid))<0)n.negate();
    for(const idx of ids){
      if(Math.abs(n.dot(v[idx].clone().sub(a)))>0.1){
        errors.push(`${label}: non-planar polygon; GoldSrc requires planar faces.`);break;
      }
    }
    // Every vertex must lie on the inward side of an outward-facing plane.
    if(v.some(p=>n.dot(p.clone().sub(a))>0.1)){
      errors.push(`${label}: brush is non-convex or has an incorrectly defined face.`);
    }
    if(!Number.isFinite(face.uScale??1)||Math.abs(face.uScale??1)<0.001||
       !Number.isFinite(face.vScale??1)||Math.abs(face.vScale??1)<0.001){
      errors.push(`${label}: invalid texture scale.`);
    }
    if(!face.texture||!/^[^\s"()[\]]{1,32}$/.test(face.texture))
      errors.push(`${label}: invalid texture name.`);
    for(const [key,value] of Object.entries({rotation:face.rotation,uShift:face.uShift,vShift:face.vShift}))
      if(value!==undefined&&!Number.isFinite(value))errors.push(`${label}: invalid ${key}.`);
    for(const [key,axis] of [['uAxis',face.uAxis],['vAxis',face.vAxis]] as const)
      if(axis&&(axis.length!==3||axis.some(n=>!Number.isFinite(n))||Math.hypot(...axis)<.000001))
        errors.push(`${label}: invalid ${key}.`);
    for(let i=0;i<ids.length;i++){
      const from=ids[i],to=ids[(i+1)%ids.length];
      const key=`${Math.min(from,to)}:${Math.max(from,to)}`;
      const edge=edges.get(key)??{count:0,direction:0};
      edge.count++;edge.direction+=from<to?1:-1;edges.set(key,edge);
    }
  }
  if([...edges.values()].some(e=>e.count!==2||e.direction!==0))
    errors.push(`${b.name}: open or non-manifold brush (unpaired edges).`);
  return errors;
}

/** Structural integrity: prevent silent data loss in a Valve 220 MAP export.
 * Entity target/targetname references are intentionally not required here:
 * Sven Co-op supports script-driven and late-bound targets. */
export function validateExportIntegrity(project:Project):string[]{
  const errors:string[]=[];
  const objects=project.objects;
  const entities=new Set(objects.filter((o):o is PointEntity=>o.kind==='entity').map(o=>o.id));
  const ids=new Set<string>();
  for(const object of objects){
    if(ids.has(object.id))errors.push(`Duplicate object ID: ${object.id}.`);
    ids.add(object.id);
    if(object.kind==='brush'){
      if(object.entityId&&!entities.has(object.entityId))
        errors.push(`${object.name}: brush entity reference ${object.entityId} is missing. Export stopped to prevent losing this brush.`);
      errors.push(...validateBrush(object));
    }else{
      if(!object.classname||!/^[a-z_][a-z0-9_]*$/i.test(object.classname))
        errors.push(`${object.name}: invalid entity classname.`);
      if(object.position.length!==3||object.position.some(n=>!Number.isFinite(n)||Math.abs(n)>131072))
        errors.push(`${object.name}: invalid entity origin.`);
    }
  }
  return errors;
}

export function validateProject(project:Project):string[]{
  const errors:string[]=[];
  if(project.target&&project.target!=='svengine')errors.push('Project target must be Svengine / Sven Co-op.');
  if(!project.objects.some(o=>o.kind==='entity'&&o.classname==='info_player_start'))errors.push('Add at least one info_player_start before compiling.');
  if(!project.objects.some(o=>o.kind==='brush'))errors.push('Map has no solid brushes.');
  errors.push(...validateExportIntegrity(project));
  return errors;
}

export function exportMap(project:Project,wadPaths:string[]=[]):string{
  const issues=validateExportIntegrity(project);
  if(issues.length)throw new Error(`MAP export blocked to prevent data loss:\n${issues.slice(0,30).join('\n')}`);
  const brushes=project.objects.filter((o):o is Brush=>o.kind==='brush'&&!o.entityId);
  const pointEntities=project.objects.filter((o):o is PointEntity=>o.kind==='entity');
  const groups:Record<string,Brush[]>={};
  for(const o of project.objects)if(o.kind==='brush'&&o.entityId)(groups[o.entityId]??=[]).push(o);
  const world:Record<string,string>={...project.world,classname:'worldspawn',mapversion:'220'};
  if(wadPaths.length)world.wad=wadPaths.join(';')+';';
  else if(project.wadNames.length&&!world.wad)world.wad=project.wadNames.join(';')+';';
  const sections=[`{\n${pairs(world)}\n${brushes.map(exportBrush).join('\n')}\n}`];
  for(const e of pointEntities){
    const props:Record<string,string>={...e.props,classname:e.classname};
    if(!(groups[e.id]||[]).length)props.origin=e.position.map(fmt).join(' ');
    sections.push(`{\n${pairs(props)}\n${(groups[e.id]||[]).map(exportBrush).join('\n')}\n}`);
  }
  return `// SvenStudio 3D - Svengine / Sven Co-op 5.x - Valve 220 map\n${sections.join('\n')}\n`;
}
