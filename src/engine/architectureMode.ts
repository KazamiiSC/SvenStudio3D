/** Architecture Mode — editable, orthogonal wall paths and rooms for GoldSrc.
 * Persistent outline is editor-only; MAP export sees only closed convex brushes.
 * Coordinates are in GoldSrc world X/Y, Z up.  No BSP compiler modification.
 */
import {createBrush,orientFaces} from './geometry';
import {validateBrush} from './exportMap';
import {architecturePartSignature} from './architecture';
import {uid,type Brush,type Project,type Vec3} from './types';

export type ArchitecturePoint=[number,number];
export type ArchitectureLayoutOptions={baseZ:number;height:number;thickness:number;slab:number;ceiling:boolean};
export type ArchitectureLayoutRecord={
  id:string;kind:'walls'|'room';points:ArchitecturePoint[];options:ArchitectureLayoutOptions;
  texture:string;memberIds:string[];signatures:string[];
};
export const DEFAULT_LAYOUT_OPTIONS:ArchitectureLayoutOptions={baseZ:0,height:224,thickness:16,slab:16,ceiling:false};
const clone=<T>(o:T):T=>structuredClone(o);
const cross=(a:ArchitecturePoint,b:ArchitecturePoint,c:ArchitecturePoint)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const same=(a:ArchitecturePoint,b:ArchitecturePoint)=>a[0]===b[0]&&a[1]===b[1];
const signedArea=(pts:ArchitecturePoint[])=>pts.reduce((sum,p,i)=>{const q=pts[(i+1)%pts.length];return sum+p[0]*q[1]-p[1]*q[0]},0)/2;
const between=(a:number,b:number,c:number)=>c>=Math.min(a,b)&&c<=Math.max(a,b);
const onSegment=(a:ArchitecturePoint,b:ArchitecturePoint,c:ArchitecturePoint)=>Math.abs(cross(a,b,c))<.001&&between(a[0],b[0],c[0])&&between(a[1],b[1],c[1]);
function intersects(a:ArchitecturePoint,b:ArchitecturePoint,c:ArchitecturePoint,d:ArchitecturePoint){
  const abC=cross(a,b,c),abD=cross(a,b,d),cdA=cross(c,d,a),cdB=cross(c,d,b);
  return abC*abD<0&&cdA*cdB<0||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);
}
/** Returns normalized outline or throws before any editor state mutation. */
export function validateArchitectureOutline(kind:'walls'|'room',points:ArchitecturePoint[],opts:ArchitectureLayoutOptions):ArchitecturePoint[]{
  if(!Array.isArray(points)||points.length<(kind==='room'?4:2)||points.length>48)throw Error('El contorno necesita 2-48 vértices (habitación: 4 como mínimo).');
  if(!Number.isFinite(opts.baseZ)||Math.abs(opts.baseZ)>32768)throw Error('Altura base fuera de límites.');
  if(!Number.isFinite(opts.height)||opts.height<32||opts.height>4096||!Number.isFinite(opts.thickness)||opts.thickness<4||opts.thickness>256||
     !Number.isFinite(opts.slab)||opts.slab<4||opts.slab>256||typeof opts.ceiling!=='boolean')throw Error('Medidas inválidas: revisá altura, espesor y losas.');
  const pts=points.map(p=>{
    if(!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||Math.abs(v)>16384))throw Error('Coordenadas fuera de límites.');
    return [...p] as ArchitecturePoint;
  });
  if(kind==='room'&&same(pts[0],pts[pts.length-1]))pts.pop();
  if(pts.length<(kind==='room'?4:2))throw Error('El contorno necesita más esquinas.');
  for(let i=0;i<pts.length-(kind==='room'?0:1);i++){
    const a=pts[i],b=pts[(i+1)%pts.length];
    if(a[0]!==b[0]&&a[1]!==b[1])throw Error('Solo trazados ortogonales: alineá el siguiente punto en X o Y.');
    if(Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])<opts.thickness*2)throw Error('Un tramo es demasiado corto para el espesor elegido.');
  }
  const edges=kind==='room'?pts.length:pts.length-1;
  for(let i=0;i<edges;i++)for(let j=i+1;j<edges;j++){
    if(j===i+1||kind==='room'&&i===0&&j===edges-1)continue;
    const a=pts[i],b=pts[(i+1)%pts.length],c=pts[j],d=pts[(j+1)%pts.length];
    if(intersects(a,b,c,d))throw Error('El trazado se cruza o se superpone.');
    // Even nonintersecting parallel segments can overlap after extrusion.
    const dx=Math.max(0,Math.min(c[0],d[0])-Math.max(a[0],b[0]),Math.min(a[0],b[0])-Math.max(c[0],d[0]));
    const dy=Math.max(0,Math.min(c[1],d[1])-Math.max(a[1],b[1]),Math.min(a[1],b[1])-Math.max(c[1],d[1]));
    if(Math.hypot(dx,dy)<opts.thickness-.001)throw Error('Dos muros están demasiado cerca: se superpondrían los brushes.');
  }
  if(kind==='room'&&Math.abs(signedArea(pts))<opts.thickness**2*4)throw Error('La habitación debe encerrar una superficie real.');
  return pts;
}
/** Snap the cursor to an orthogonal direction from the preceding corner. */
export function snapArchitecturePoint(pointer:ArchitecturePoint,last:ArchitecturePoint|null,step=16,orthogonal=true):ArchitecturePoint{
  const snap=(n:number)=>Math.round(n/Math.max(1,step))*Math.max(1,step);
  const p:ArchitecturePoint=[snap(pointer[0]),snap(pointer[1])];
  if(last&&orthogonal){
    if(Math.abs(p[0]-last[0])>=Math.abs(p[1]-last[1]))p[1]=last[1];
    else p[0]=last[0];
  }
  return p;
}
function wallBox(name:string,center:Vec3,size:Vec3,texture:string,group:string):Brush{
  const b=createBrush('box',center,size,name);b.layer='Architecture';b.group=group;
  b.faces=b.faces.map(f=>({...f,texture}));return b;
}
/** A convex vertical triangular slab; each face has valid GoldSrc winding. */
function prism(name:string,triangle:ArchitecturePoint[],z:number,depth:number,texture:string,group:string):Brush{
  const center:Vec3=[(triangle[0][0]+triangle[1][0]+triangle[2][0])/3,(triangle[0][1]+triangle[1][1]+triangle[2][1])/3,z+depth/2];
  const vertices:Vec3[]=[...triangle.map(p=>[p[0]-center[0],p[1]-center[1],-depth/2] as Vec3),
    ...triangle.map(p=>[p[0]-center[0],p[1]-center[1],depth/2] as Vec3)];
  const faces=orientFaces(vertices,[[0,2,1],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]].map(indices=>({indices,texture})));
  return {id:uid(),kind:'brush',name,primitive:'poly',position:center,rotation:[0,0,0],scale:[1,1,1],vertices,faces,layer:'Architecture',group};
}
/** Ear clipping of a simple axis-aligned polygon; never export a concave brush. */
export function triangulateArchitectureFloor(points:ArchitecturePoint[]):ArchitecturePoint[][]{
  const pts=signedArea(points)>0?points:[...points].reverse();
  const ids=pts.map((_,i)=>i),triangles:ArchitecturePoint[][]=[];
  const inside=(p:ArchitecturePoint,a:ArchitecturePoint,b:ArchitecturePoint,c:ArchitecturePoint)=>cross(a,b,p)>=0&&cross(b,c,p)>=0&&cross(c,a,p)>=0;
  for(let attempts=0;ids.length>3&&attempts<500;attempts++){
    let removed=false;
    for(let i=0;i<ids.length;i++){
      const a=pts[ids[(i-1+ids.length)%ids.length]],b=pts[ids[i]],c=pts[ids[(i+1)%ids.length]];
      if(cross(a,b,c)<=.001)continue;
      if(ids.some((id,j)=>j!==i&&j!==(i-1+ids.length)%ids.length&&j!==(i+1)%ids.length&&inside(pts[id],a,b,c)))continue;
      triangles.push([a,b,c]);ids.splice(i,1);removed=true;break;
    }
    if(!removed)break;
  }
  if(ids.length!==3)throw Error('No se pudo dividir el suelo. Revisá las esquinas del contorno.');
  triangles.push(ids.map(i=>pts[i]));return triangles;
}
export function buildArchitectureLayout(kind:'walls'|'room',points:ArchitecturePoint[],options:ArchitectureLayoutOptions,texture:string):{record:ArchitectureLayoutRecord;objects:Brush[]}{
  const outline=validateArchitectureOutline(kind,points,options);
  if(!/^[^\s"()[\]]{1,32}$/.test(texture))throw Error('Nombre de textura WAD inválido.');
  const id=uid(),group=`Architecture Mode ${id.slice(0,8)}`,walls:Brush[]=[];
  const {baseZ,height,thickness:t,slab,ceiling}=options;
  const wallBottom=baseZ+(kind==='room'?slab:0),edges=kind==='room'?outline.length:outline.length-1;
  // Separate corner posts and trimmed straight spans: no overlapping brushes.
  for(let i=0;i<outline.length;i++){
    const p=outline[i];
    walls.push(wallBox(`Corner ${i+1}`,[p[0],p[1],wallBottom+height/2],[t,t,height],texture,group));
  }
  for(let i=0;i<edges;i++){
    const a=outline[i],b=outline[(i+1)%outline.length],dx=b[0]-a[0],dy=b[1]-a[1];
    const length=Math.abs(dx+dy)-t;
    if(length<=0)throw Error('Los tramos deben superar el grosor del muro.');
    walls.push(wallBox(`Wall ${i+1}` ,[(a[0]+b[0])/2,(a[1]+b[1])/2,wallBottom+height/2],
      dx!==0?[length,t,height]:[t,length,height],texture,group));
  }
  if(kind==='room'){
    const triangles=triangulateArchitectureFloor(outline);
    triangles.forEach((tri,i)=>walls.push(prism(`Floor ${i+1}`,tri,baseZ,slab,texture,group)));
    if(ceiling)triangles.forEach((tri,i)=>walls.push(prism(`Ceiling ${i+1}`,tri,wallBottom+height,slab,texture,group)));
  }
  if(walls.length>192)throw Error('Demasiados brushes para un único trazado.');
  for(const b of walls){const errors=validateBrush(b);if(errors.length)throw Error(`${b.name}: ${errors.join('; ')}`)}
  return {objects:walls,record:{id,kind,points:clone(outline),options:clone(options),texture,
    memberIds:walls.map(b=>b.id),signatures:walls.map(architecturePartSignature)}};
}
export function assertArchitectureLayoutUnmodified(project:Project,record:ArchitectureLayoutRecord){
  if(record.memberIds.length!==record.signatures.length||!record.memberIds.length)throw Error('Los datos de la estructura están incompletos.');
  record.memberIds.forEach((id,i)=>{
    const b=project.objects.find(o=>o.id===id);
    if(!b||b.kind!=='brush'||architecturePartSignature(b)!==record.signatures[i])
      throw Error('Hay brushes modificados manualmente. Convertí la estructura a brushes normales antes de regenerarla.');
  });
}
export function replaceArchitectureLayout(project:Project,id:string,points:ArchitecturePoint[],options:ArchitectureLayoutOptions):{project:Project;memberIds:string[]}{
  const record=(project.architectureLayouts||[]).find(r=>r.id===id);
  if(!record)throw Error('No se encontró la construcción.');
  assertArchitectureLayoutUnmodified(project,record);
  const built=buildArchitectureLayout(record.kind,points,options,record.texture),obsolete=new Set(record.memberIds);
  return {project:{...project,objects:[...project.objects.filter(o=>!obsolete.has(o.id)),...built.objects],
    architectureLayouts:(project.architectureLayouts||[]).map(r=>r.id===id?{...built.record,id}:r)},memberIds:built.record.memberIds};
}
export function removeArchitectureLayout(project:Project,id:string):Project{
  const record=(project.architectureLayouts||[]).find(r=>r.id===id);
  if(!record)throw Error('No se encontró la construcción.');
  assertArchitectureLayoutUnmodified(project,record);const obsolete=new Set(record.memberIds);
  return {...project,objects:project.objects.filter(o=>!obsolete.has(o.id)),architectureLayouts:(project.architectureLayouts||[]).filter(r=>r.id!==id)};
}
export function detachArchitectureLayout(project:Project,id:string):Project{
  return {...project,architectureLayouts:(project.architectureLayouts||[]).filter(r=>r.id!==id)};
}
