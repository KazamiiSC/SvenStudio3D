/** Conservative recovery of VISIBLE BSP surface textures into a decompiled MAP.
 * SurfDecomp may use NULL for compiler-generated / invisible faces. We must NOT
 * paint those blindly: restore only when an actual BSP polygon overlaps the
 * recovered brush face in the same plane. The original BSP is never mutated.
 */
import type {BspMap,BspFace} from './bsp';
import type {Brush,Vec3} from './types';
import type {MapImportResult} from './importMap';
import {transformedVertices} from './geometry';

type V3=[number,number,number];
type V2=[number,number];
const sub=(a:V3,b:V3):V3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const cross=(a:V3,b:V3):V3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a:V3,b:V3)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const normal=(points:V3[]):V3|null=>{
  if(points.length<3)return null;
  const n=cross(sub(points[1],points[0]),sub(points[2],points[0]));
  const d=Math.hypot(...n);return d>1e-7?n.map(x=>x/d) as V3:null;
};
function canonical(points:V3[]):{n:V3;d:number}|null{
  const n=normal(points);if(!n)return null;
  const axis=n.findIndex(x=>Math.abs(x)>1e-5);
  if(axis>=0&&n[axis]<0)for(let i=0;i<3;i++)n[i]=-n[i];
  return {n,d:dot(n,points[0])};
}
const key=(n:V3,d:number)=>`${n.map(x=>Math.round(x*100)).join(':')}:${Math.round(d*2)}`;
const project=(p:V3,drop:number):V2=>drop===0?[p[1],p[2]]:drop===1?[p[0],p[2]]:[p[0],p[1]];
const area2=(poly:V2[])=>poly.reduce((sum,p,i)=>sum+p[0]*poly[(i+1)%poly.length][1]-p[1]*poly[(i+1)%poly.length][0],0);
const area=(poly:V2[])=>Math.abs(area2(poly))*.5;
function clipPolygon(subject:V2[],clip:V2[]):V2[]{
  let output=subject.slice(),sign=area2(clip)>=0?1:-1;
  for(let j=0;j<clip.length;j++){
    const a=clip[j],b=clip[(j+1)%clip.length],inside=(p:V2)=>sign*((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]));
    const input=output;output=[];
    for(let k=0;k<input.length;k++){
      const current=input[k],previous=input[(k+input.length-1)%input.length];
      const da=inside(previous),db=inside(current);
      if((da>=-1e-6)!==(db>=-1e-6)){
        const denom=da-db,t=Math.abs(denom)<1e-12?0:da/denom;
        output.push([previous[0]+t*(current[0]-previous[0]),previous[1]+t*(current[1]-previous[1])]);
      }
      if(db>=-1e-6)output.push(current);
    }
    if(output.length<3)return [];
  }
  return output;
}
function overlap(a:V3[],b:V3[],n:V3){
  const axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
  const p=a.map(x=>project(x,axis)),q=b.map(x=>project(x,axis));
  if(area(p)<.05||area(q)<.05)return 0;
  const minmax=(poly:V2[])=>[Math.min(...poly.map(p=>p[0])),Math.max(...poly.map(p=>p[0])),Math.min(...poly.map(p=>p[1])),Math.max(...poly.map(p=>p[1]))];
  const x=minmax(p),y=minmax(q);
  if(x[1]<y[0]+.01||y[1]<x[0]+.01||x[3]<y[2]+.01||y[3]<x[2]+.01)return 0;
  return area(clipPolygon(p,q));
}
function originalBrushLines(mapText:string):number[][]{
  const lines=mapText.split(/\r?\n/),brushLines:number[][]=[];
  let depth=0,active:number[]|null=null;
  for(let i=0;i<lines.length;i++){
    const s=lines[i].trim();
    if(s==='{'){
      if(depth===1){active=[];brushLines.push(active)}
      depth++;continue;
    }
    if(s==='}') {depth=Math.max(0,depth-1);if(depth===1)active=null;continue}
    if(depth===2&&active&&/^\s*\(\s*-?[\d.]/.test(s))active.push(i);
  }
  return brushLines;
}
const originalSurfaceName=(map:BspMap,f:BspFace):string=>map.textures[f.texture]?.name||'';
const allowed=(name:string)=>!!name&&!/^MISSING_\d+$/i.test(name)&&name.toUpperCase()!=='NULL';
const fmt=(n:number)=>Number(n.toFixed(6)).toString();
function replaceNullFaceLine(line:string,face:BspFace,name:string):string|null{
  const matches=[...line.matchAll(/\(\s*-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s*\)/g)];
  if(matches.length!==3||!face.sTexinfo||!face.tTexinfo)return null;
  const end=(matches[2].index??0)+matches[2][0].length;
  const tail=line.slice(end);
  if(!/^\s+NULL(?:\s|$)/i.test(tail))return null;
  const a=face.sTexinfo,b=face.tTexinfo;
  return `${line.slice(0,end)} ${name} [ ${fmt(a[0])} ${fmt(a[1])} ${fmt(a[2])} ${fmt(a[3])} ] [ ${fmt(b[0])} ${fmt(b[1])} ${fmt(b[2])} ${fmt(b[3])} ] 0 1 1`;
}
export type SurfaceRestoreReport={sourceNullFaces:number;restoredFaces:number;ambiguousFaces:number;unmatchedFaces:number;skippedBrushes:number};
export function restoreVisibleBspTextures(source:string,bsp:BspMap,inspected:MapImportResult):{source:string;report:SurfaceRestoreReport}{
  const index=new Map<string,BspFace[]>();
  for(const f of bsp.faces){
    const name=originalSurfaceName(bsp,f),plane=canonical(f.points);
    if(!allowed(name)||!plane||!f.sTexinfo||!f.tTexinfo||!f.sTexinfo.every(Number.isFinite)||!f.tTexinfo.every(Number.isFinite))continue;
    const k=key(plane.n,plane.d),list=index.get(k)||[];
    list.push(f);index.set(k,list);
  }
  const lines=source.split(/\r?\n/),brushLines=originalBrushLines(source);
  const report:SurfaceRestoreReport={sourceNullFaces:0,restoredFaces:0,ambiguousFaces:0,unmatchedFaces:0,skippedBrushes:inspected.report.skippedBrushes};
  for(const {sourceBrushIndex,brush} of inspected.importedBrushes){
    const indices=brushLines[sourceBrushIndex];
    if(!indices||indices.length!==brush.faces.length)continue;
    const verts=transformedVertices(brush);
    for(let fi=0;fi<brush.faces.length;fi++){
      const face=brush.faces[fi],lineId=indices[fi],line=lines[lineId];
      if(!/^\s*\(.*?\)\s*\(.*?\)\s*\(.*?\)\s+NULL(?:\s|$)/i.test(line))continue;
      report.sourceNullFaces++;
      const polygon=face.indices.map(i=>verts[i]).filter(Boolean) as V3[],plane=canonical(polygon);
      if(!plane){report.unmatchedFaces++;continue}
      const candidates:BspFace[]=[];
      for(const delta of [-1,0,1]){
        const search=index.get(key(plane.n,plane.d+delta*.5))||[];
        for(const f of search){
          const p=canonical(f.points);
          if(!p||dot(plane.n,p.n)<.9999||Math.abs(plane.d-p.d)>.35)continue;
          if(overlap(polygon,f.points,plane.n)>.1)candidates.push(f);
        }
      }
      if(!candidates.length){report.unmatchedFaces++;continue}
      const names=new Set(candidates.map(f=>originalSurfaceName(bsp,f).toLowerCase()));
      // A split BSP polygon may use the same material but a different UV basis.
      // Such a face cannot be represented faithfully by one MAP face.
      const ref=candidates[0],sameTexinfo=(a:BspFace,b:BspFace)=>
        !!a.sTexinfo&&!!b.sTexinfo&&!!a.tTexinfo&&!!b.tTexinfo&&
        [...a.sTexinfo,...a.tTexinfo].every((x,i)=>Math.abs(x-[...b.sTexinfo!,...b.tTexinfo!][i])<.001);
      if(names.size!==1||candidates.some(f=>!sameTexinfo(ref,f))){report.ambiguousFaces++;continue}
      const candidate=ref,name=originalSurfaceName(bsp,candidate);
      const replacement=replaceNullFaceLine(line,candidate,name);
      if(!replacement){report.unmatchedFaces++;continue}
      lines[lineId]=replacement;report.restoredFaces++;
    }
  }
  return {source:lines.join(source.includes('\r\n')?'\r\n':'\n'),report};
}
