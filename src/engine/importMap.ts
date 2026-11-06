import * as THREE from 'three';
import type { Brush,Face,PointEntity,Project,Vec3 } from './types';
import {uid} from './types';
import { orientFaces } from './geometry';
import { validateBrush } from './exportMap';
const vec=(a:Vec3)=>new THREE.Vector3(...a);
const rawVec=(v:THREE.Vector3):Vec3=>[v.x,v.y,v.z];
type Plane={n:THREE.Vector3; d:number; texture:string; uShift:number;vShift:number;uScale:number;vScale:number;rotation:number;uAxis?:Vec3;vAxis?:Vec3};
/** GoldSrc masked textures begin with '{' (e.g. {FENCE). Braces that
 * delimit MAP entities/brushes appear alone on a line; never scan plane
 * texture names as if their characters were structural tokens. */
function mapLines(source:string):string[]{return source.match(/[^\n]*\n|[^\n]+$/g)??[];}
function structuralBrace(line:string):'{'|'}'|null{
  const text=line.trim();
  return text==='{'||text==='}'?text:null;
}
function blocks(source:string){
  const out:string[]=[];let depth=0,start=-1,offset=0;
  for(const line of mapLines(source)){
    const brace=structuralBrace(line);
    if(brace==='{'){
      if(depth===0)start=offset+line.indexOf('{')+1;
      depth++;
    }else if(brace==='}'){
      if(depth===0)throw Error('Unbalanced MAP braces.');
      depth--;
      if(depth===0&&start>=0)out.push(source.slice(start,offset+line.indexOf('}')));
    }
    offset+=line.length;
  }
  let inQuote=false,escaped=false;
  for(const c of source){
    if(c==='\"'&&!escaped)inQuote=!inQuote;
    if(c==='\\')escaped=!escaped;else escaped=false;
  }
  if(depth!==0||inQuote)throw Error('Incomplete MAP file (unclosed entity, brush, or quote).');
  return out;
}
function outsideBrushBlocks(source:string):string{
  let depth=0;const lines:string[]=[];
  for(const line of mapLines(source)){
    const brace=structuralBrace(line);
    if(brace==='{'){depth++;continue;}
    if(brace==='}'){depth--;continue;}
    if(depth===0)lines.push(line);
  }
  return lines.join('');
}
function parsePlane(line:string):Plane|null{
  const pointRegex=/\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)/g;
  const matches=[...line.matchAll(pointRegex)];if(matches.length<3)return null;
  const p=matches.slice(0,3).map(m=>new THREE.Vector3(Number(m[1]),Number(m[2]),Number(m[3])));
  const n=p[1].clone().sub(p[0]).cross(p[2].clone().sub(p[0]));if(n.lengthSq()<.00001)return null;n.normalize();
  const tail=line.slice((matches[2].index||0)+matches[2][0].length).trim();
  const tex=tail.match(/^(\S+)/)?.[1]||'C1A0_WALL1';
  const axes=[...tail.matchAll(/\[\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s*\]/g)];
  if(axes.length>=2){
    const suffix=tail.slice((axes[1].index||0)+axes[1][0].length).trim().split(/\s+/).map(Number);
    return {n,d:n.dot(p[0]),texture:tex,uAxis:axes[0].slice(1,4).map(Number) as Vec3,vAxis:axes[1].slice(1,4).map(Number) as Vec3,
      uShift:Number(axes[0][4]),vShift:Number(axes[1][4]),rotation:suffix[0]||0,uScale:suffix[1]||1,vScale:suffix[2]||1};
  }
  const tailParts=tail.split(/\s+/);
  return {n,d:n.dot(p[0]),texture:tex,uShift:Number(tailParts[1])||0,vShift:Number(tailParts[2])||0,rotation:Number(tailParts[3])||0,uScale:Number(tailParts[4])||1,vScale:Number(tailParts[5])||1};
}
function reconstruct(planes:Plane[],flipped=false,tolerance=.1):{verts:Vec3[];faces:Face[]}|null{
  if(planes.length<4||planes.length>96)return null;
  const ps=planes.map(p=>flipped?{...p,n:p.n.clone().negate(),d:-p.d}:p);
  const candidates:THREE.Vector3[]=[];
  for(let a=0;a<ps.length;a++)for(let b=a+1;b<ps.length;b++)for(let c=b+1;c<ps.length;c++){
    const x=ps[a],y=ps[b],z=ps[c];const cross=y.n.clone().cross(z.n),det=x.n.dot(cross);
    if(Math.abs(det)<.000001)continue;
    const v=cross.multiplyScalar(x.d).add(z.n.clone().cross(x.n).multiplyScalar(y.d)).add(x.n.clone().cross(y.n).multiplyScalar(z.d)).divideScalar(det);
    if(!v.toArray().every(Number.isFinite))continue;
    if(ps.some(p=>p.n.dot(v)-p.d>tolerance*.75))continue;
    if(!candidates.some(old=>old.distanceToSquared(v)<tolerance*tolerance*.5))candidates.push(v);
  }
  if(candidates.length<4)return null;
  const faces:Face[]=[];
  for(const p of ps){
    const vertices=candidates.map((v,i)=>({v,i})).filter(({v})=>Math.abs(p.n.dot(v)-p.d)<tolerance);
    if(vertices.length<3)continue;
    const center=new THREE.Vector3();vertices.forEach(({v})=>center.add(v));center.divideScalar(vertices.length);
    const ref=Math.abs(p.n.z)<.9?new THREE.Vector3(0,0,1):new THREE.Vector3(0,1,0);
    const u=ref.clone().cross(p.n).normalize(),v=p.n.clone().cross(u).normalize();
    const ordered=vertices.map(x=>({...x,angle:Math.atan2(x.v.clone().sub(center).dot(v),x.v.clone().sub(center).dot(u))})).sort((a,b)=>a.angle-b.angle);
    faces.push({indices:ordered.map(x=>x.i),texture:p.texture,uShift:p.uShift,vShift:p.vShift,uScale:p.uScale,vScale:p.vScale,rotation:p.rotation,uAxis:p.uAxis,vAxis:p.vAxis});
  }
  if(faces.length<4)return null;
  return {verts:candidates.map(rawVec),faces};
}
export type MapImportReport={totalBrushes:number; importedBrushes:number; skippedBrushes:number; skippedLocations:string[]};
export type MapImportResult={project:Project;report:MapImportReport; importedBrushes: Array<{sourceBrushIndex:number;brush:Brush}>};
/** Always report skipped brushes. Callers must explicitly confirm partial imports. */
export function inspectMapImport(contents:string,fileName='Imported Map'):MapImportResult{
  if(contents.length>20_000_000)throw Error('MAP file too large for current importer.');
  const entities=blocks(contents),objects:(Brush|PointEntity)[]=[];
  if(!entities.length)throw Error('No entities found in .map file.');
  let world:Record<string,string>={classname:'worldspawn'};let missing=0,totalBrushes=0;
  const skippedLocations:string[]=[];
  const importedBrushes: Array<{sourceBrushIndex:number;brush:Brush}>=[];
  entities.forEach((part,index)=>{
    const childBlocks=blocks(part);
    const outside=outsideBrushBlocks(part);
    const kv=Object.fromEntries([...outside.matchAll(/"([^"\n]+)"\s+"([^"\n]*)"/g)].map(m=>[m[1],m[2]]));
    const classname=kv.classname|| (index===0?'worldspawn':'info_target');
    const objId=uid();
    if(classname==='worldspawn'){world=kv;}else{
      const origin=kv.origin?.trim().split(/\s+/).map(Number);
      const position:Vec3=origin?.length===3&&origin.every(Number.isFinite)?origin as Vec3:[0,0,0];
      const {classname:_,origin:__, ...props}=kv;
      objects.push({id:objId,kind:'entity',name:classname,classname,position,props,layer:'Gameplay'});
    }
    for(const [brushIndex,b] of childBlocks.entries()){
      totalBrushes++;
      const lines=b.split(/\r?\n/).map(line=>line.replace(/\/\/.*$/,'').trim()).filter(Boolean);
      const parsed=lines.map(parsePlane);
      // A malformed plane must not be discarded while the remainder is reconstructed.
      const planes=parsed.filter((x):x is Plane=>x!==null);
      // Decompilers may produce nearly coincident planes. The old .1-unit
      // membership tolerance could include vertices from a different plane,
      // producing non-planar/open solids that only failed at compile time.
      // Try stricter reconstruction, and never import an invalid solid silently.
      let brush:Brush|null=null;
      if(lines.length===planes.length){
        for(const tolerance of [.1,.025,.006]){
          for(const flip of [true,false]){
            const built=reconstruct(planes,flip,tolerance);
            if(!built)continue;
            const center=new THREE.Vector3();built.verts.forEach(v=>center.add(vec(v)));center.divideScalar(built.verts.length);
            const position=rawVec(center),vertices=built.verts.map(v=>rawVec(vec(v).sub(center)));
            const candidate:Brush={id:uid(),kind:'brush',name:`Imported Brush ${objects.length+1}`,primitive:'poly',position,rotation:[0,0,0],scale:[1,1,1],vertices,faces:orientFaces(vertices,built.faces),layer:'Geometry',...(classname!=='worldspawn'?{entityId:objId}:{})};
            if(validateBrush(candidate).length===0){brush=candidate;break;}
          }
          if(brush)break;
        }
      }
      if(!brush){
        missing++;
        if(skippedLocations.length<25)skippedLocations.push(`${classname}, entity ${index+1}, brush ${brushIndex+1} (invalid or unreconstructable solid)`);
        continue;
      }
      importedBrushes.push({sourceBrushIndex:totalBrushes-1,brush});
      objects.push(brush);
    }
  });
  const wadNames=(world.wad||'').split(';').filter(Boolean).map(p=>p.split(/[\\/]/).at(-1)||p);
  return {project:{version:1,target:'svengine',name:fileName.replace(/\.map$/i,''),objects,world,wadNames},
    report:{totalBrushes,importedBrushes:totalBrushes-missing,skippedBrushes:missing,skippedLocations},importedBrushes};
}
/** Safe default: do not allow silent geometry loss through the public importer. */
export function importMap(contents:string,fileName='Imported Map'):Project{
  const result=inspectMapImport(contents,fileName);
  if(result.report.skippedBrushes)throw Error(`MAP import is incomplete: ${result.report.skippedBrushes} of ${result.report.totalBrushes} brushes could not be reconstructed. The current map was not changed.`);
  return result.project;
}

