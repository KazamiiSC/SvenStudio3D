/** SvenStudio BSP Object Extractor 8A.
 * Only fully recoverable CLOSED CONVEX BSP surface selections are converted to
 * editable Valve 220 brushes. BSP30 has no original worldspawn brush IDs.
 * Texture data is copied byte-for-byte (mips + palette) into an embedded WAD3.
 * No geometry, PVS, hulls or lightmaps of the source BSP are changed.
 */
import type {BspMap,BspFace} from './bsp.ts';
import type {Brush,Vec3} from './types';
import {uid} from './types';
import {validateBrush} from './exportMap';
import {createPrefab,validatePrefab,type Prefab} from './prefabs';
import {findMipTextureInWads,type WAD3MipTexture} from './bspWadMipTexture';
import {bspOriginalFaceIndex} from './bspFaceSelection';
import {recoverSolidSubmodelHull0} from './bspHull0Recovery';

export type BspObjectExtractionMode='exact'|'surface-shell'|'hull0-solid';
export type BspObjectExtractionOptions={mode?:BspObjectExtractionMode;thickness?:number};
export type BspObjectPrefab=Prefab&{
  format:'svenstudio-bsp-object';sourceBsp:string;wad:{filename:string;base64:string};faceIds:number[];
  /** Surface shells are explicitly approximate: they do NOT recover the original
   * solid, collision geometry, hidden surfaces, or entity behavior. */
  recovery?:{mode:'surface-shell';thickness:number;panels:number;warning:string;skippedFaces?:{faceId:number;reason:string}[]}
    |{mode:'hull0-solid';modelIndex:number;solids:number;warning:string;skippedFaces?:{faceId:number;reason:string}[]};
};
const MAX_SELECTED=256,MAX_TEXTURES=64,MAX_BYTES=24*1024*1024;
const dot=(a:readonly number[],b:readonly number[])=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a:readonly number[],b:readonly number[]):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const subtract=(a:readonly number[],b:readonly number[]):Vec3=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const pointKey=(p:readonly number[])=>p.map(v=>Math.round(v*1000)).join(':');
const sane=(v:number)=>Number.isFinite(v)&&Math.abs(v)<=131072;
/** WAD3 prefixes {, + and - are real, *visible* GoldSrc materials: masked,
 * animated/toggled and random-tiling textures. Previous extraction discarded
 * all of them, often retaining only a sticky note from an entire computer.
 * Reject tooling/liquid/sky surfaces, not valid texture-name prefixes.
 */
export function isPrefabRenderableTexture(name:string):boolean{
  if(!/^[A-Za-z0-9_$+{}~.!-]{1,16}$/.test(name))return false;
  if(/^(?:sky|clip|origin|hint|skip|null|aaatrigger|trigger|bevel|noclip)(?:$|[_\d])/i.test(name))return false;
  if(name[0]==='!' || name[0]==='}')return false; // liquid / invalid mask start
  return true;
}

const area=(p:readonly Vec3[])=>{
  if(p.length<3)return 0;
  let sum=0;const anchor=p[0];
  for(let i=1;i<p.length-1;i++)sum+=Math.hypot(...cross(subtract(p[i],anchor),subtract(p[i+1],anchor)))/2;
  return sum;
};
/** Polygon normal from ALL boundary edges (Newell's method).
 * Compiled BSP faces may have extra collinear vertices at T-junctions; using
 * only the first three vertices falsely labels those valid faces degenerate.
 * Reject truly zero-area polygons instead of inventing an extrusion/cap.
 */
function polygonNormal(points:readonly Vec3[]):Vec3|null{
  if(points.length<3)return null;
  const result:Vec3=[0,0,0];
  for(let i=0;i<points.length;i++){
    const p=points[i],q=points[(i+1)%points.length];
    result[0]+=(p[1]-q[1])*(p[2]+q[2]);
    result[1]+=(p[2]-q[2])*(p[0]+q[0]);
    result[2]+=(p[0]-q[0])*(p[1]+q[1]);
  }
  const length=Math.hypot(...result);
  return length>.02?result.map(x=>x/length) as Vec3:null;
}
function components(faces:BspFace[]):BspFace[][]{
  // The source BSP may split a plane at T-junctions. Two polygons must share
  // a real edge (not merely a corner) to be considered part of one object.
  const groups:number[][]=[],used=new Set<number>();
  const verts=faces.map(f=>new Set(f.points.map(pointKey)));
  for(let i=0;i<faces.length;i++){
    if(used.has(i))continue;
    const group:number[]=[i];used.add(i);
    for(let h=0;h<group.length;h++){
      const a=group[h];
      for(let b=0;b<faces.length;b++){
        if(used.has(b)||faces[a].model!==faces[b].model)continue;
        let shared=0;for(const key of verts[a])if(verts[b].has(key)&&++shared>=2)break;
        if(shared>=2){used.add(b);group.push(b)}
      }
    }
    groups.push(group);
  }
  return groups.map(group=>group.map(i=>faces[i]));
}
type Plane={n:Vec3;d:number;texture:number;s:[number,number,number,number];t:[number,number,number,number];faces:BspFace[]};
function reconstructConvex(group:BspFace[],map:BspMap,name:string):Brush{
  const sourcePoints=group.flatMap(f=>f.points);
  const center:Vec3=[0,1,2].map(j=>sourcePoints.reduce((s,p)=>s+p[j],0)/sourcePoints.length) as Vec3;
  const planes:Plane[]=[];
  for(const face of group){
    if(face.flags!==0)throw Error('A selected face has special BSP surface flags and cannot be exported as an ordinary brush.');
    if(face.points.length<3||!face.sTexinfo||!face.tTexinfo)throw Error('A selected face has incomplete polygon or Valve 220 UV data.');
    if(face.points.some(p=>p.some(v=>!sane(v))))throw Error('Object contains invalid BSP coordinates.');
    const faceId=face.bspFaceIndex===undefined?'unknown':`#${face.bspFaceIndex}`;
    const normal=polygonNormal(face.points);
    if(!normal)throw Error(`BSP face ${faceId} has zero area or a malformed polygon; it cannot define an editable brush side. This is different from having three collinear starting vertices.`);
    let n=normal,d=dot(n,face.points[0]);
    // The object center must be in the negative half-space of every face.
    if(dot(n,center)>d){n=n.map(x=>-x) as Vec3;d=-d}
    const old=planes.find(p=>dot(p.n,n)>.99999&&Math.abs(p.d-d)<.02);
    if(old){
      if(old.texture!==face.texture||old.s.some((x,i)=>Math.abs(x-face.sTexinfo![i])>.001)||old.t.some((x,i)=>Math.abs(x-face.tTexinfo![i])>.001))
        throw Error('The selected object has multiple textures or UV alignments on one plane. Split/convert it through BSP Recovery first.');
      old.faces.push(face);
    }else planes.push({n,d,texture:face.texture,s:face.sTexinfo,t:face.tTexinfo,faces:[face]});
  }
  if(planes.length<4||planes.length>64)throw Error('Select the complete closed object (at least four distinct sides, maximum 64).');
  // Intersect triplets of half-spaces. This rebuilds the convex volume from
  // actual compiled planes; it never closes missing faces with invented caps.
  const vertices:Vec3[]=[],seen=new Set<string>();
  for(let a=0;a<planes.length;a++)for(let b=a+1;b<planes.length;b++)for(let c=b+1;c<planes.length;c++){
    const A=planes[a],B=planes[b],C=planes[c],bc=cross(B.n,C.n),ca=cross(C.n,A.n),ab=cross(A.n,B.n),det=dot(A.n,bc);
    if(Math.abs(det)<1e-7)continue;
    const p:Vec3=[0,1,2].map(i=>(A.d*bc[i]+B.d*ca[i]+C.d*ab[i])/det) as Vec3;
    if(p.some(v=>!sane(v))||planes.some(plane=>dot(plane.n,p)>plane.d+.08))continue;
    const key=pointKey(p);if(!seen.has(key)){seen.add(key);vertices.push(p)}
  }
  if(vertices.length<4||vertices.length>256)throw Error('Could not reconstruct a finite, bounded convex solid. Select more sides or a smaller object.');
  const origin:Vec3=[0,1,2].map(j=>vertices.reduce((s,p)=>s+p[j],0)/vertices.length) as Vec3;
  const faceData=planes.map(plane=>{
    const ids=vertices.map((p,i)=>Math.abs(dot(plane.n,p)-plane.d)<.08?i:-1).filter(i=>i>=0);
    if(ids.length<3)throw Error('The selected planes do not enclose a valid brush.');
    const pc:Vec3=[0,1,2].map(j=>ids.reduce((s,i)=>s+vertices[i][j],0)/ids.length) as Vec3;
    let u=cross(plane.n,Math.abs(plane.n[2])<.9?[0,0,1]:[0,1,0]);const len=Math.hypot(...u);u=u.map(x=>x/len) as Vec3;
    const v=cross(plane.n,u);
    ids.sort((i,j)=>Math.atan2(dot(subtract(vertices[i],pc),v),dot(subtract(vertices[i],pc),u))-Math.atan2(dot(subtract(vertices[j],pc),v),dot(subtract(vertices[j],pc),u)));
    const expected=plane.faces.reduce((s,f)=>s+area(f.points),0),actual=area(ids.map(i=>vertices[i]));
    // A missing or partially selected face is not an editable closed brush.
    if(!Number.isFinite(expected)||expected<1||Math.abs(actual-expected)>Math.max(1,actual*.012))
      throw Error(`Incomplete BSP face selection: expected ${Math.round(actual)} u² but selected ${Math.round(expected)} u² on one side. Select all sides; no automatic caps were added.`);
    const texture=map.textures[plane.texture];
    if(!texture||!isPrefabRenderableTexture(texture.name))
      throw Error(`Texture '${texture?.name??'<missing>'}' cannot be reconstructed as an ordinary closed brush.`);
    return {indices:ids,texture:texture.name,uAxis:plane.s.slice(0,3) as Vec3,vAxis:plane.t.slice(0,3) as Vec3,uShift:plane.s[3],vShift:plane.t[3],uScale:1,vScale:1};
  });
  // The exporter expects *local* vertices, preserving the BSP world coordinates
  // through a normal editor object position at the recovered pivot.
  const brush:Brush={id:uid(),kind:'brush',primitive:'poly',name,position:origin,rotation:[0,0,0],scale:[1,1,1],vertices:vertices.map(p=>subtract(p,origin)),faces:faceData,layer:'Imported BSP',group:name};
  const problems=validateBrush(brush);
  if(problems.length)throw Error(`Recovery rejected by MAP brush validator: ${problems[0]}`);
  return brush;
}

/** BSP *N submodels can be multi-brush or open after CSG. A selected surface
 * need not bound a single convex solid. This deliberate, opt-in fallback makes
 * editable thin panels from the ORIGINAL visible polygons. Unlike a full solid
 * recovery, it never claims to reproduce missing geometry or collision hulls.
 * The face's original Valve 220 axes/shifts and raw WAD pixels are preserved.
 */
function surfaceShellPanels(face:BspFace,map:BspMap,name:string,thickness:number):Brush[]{
  if(face.flags & ~1)throw Error(`BSP face #${face.bspFaceIndex??'?'} has unsupported texinfo flags ${face.flags}.`);
  if(!face.sTexinfo||!face.tTexinfo)throw Error(`BSP face #${face.bspFaceIndex??'?'} has no valid Valve 220 UV axes.`);
  if(face.points.some(p=>p.some(v=>!sane(v))))throw Error('Selected face contains invalid coordinates.');
  const faceId=face.bspFaceIndex??'?';
  // GoldSrc splits surface edges at T-junctions. Strip collinear and coincident
  // points before generating solid brushes (first three may be collinear).
  const polygon:Vec3[]=face.points.map(p=>[...p] as Vec3);
  for(let k=0;k<polygon.length&&polygon.length>3;){
    const prev=polygon[(k+polygon.length-1)%polygon.length],cur=polygon[k],next=polygon[(k+1)%polygon.length];
    const a=subtract(cur,prev),b=subtract(next,cur);
    const lenA=Math.hypot(...a),lenB=Math.hypot(...b);
    if(lenA<.005||lenB<.005||(Math.hypot(...cross(a,b))<Math.max(.00001,lenA*lenB*.0001)&&dot(a,b)>=0)){
      polygon.splice(k,1);k=Math.max(0,k-1);
    }else k++;
  }
  let normal=polygonNormal(polygon);
  if(!normal||area(polygon)<.5)throw Error(`BSP face #${faceId} has zero area; even an approximate panel cannot be exported.`);
  // The BSP face has an authoritative outward plane normal. Winding in the
  // surfedge chain can be reversed. Extrude behind the *visible* side instead
  // of producing reversed front/back panels and incorrect masked textures.
  const sourceNormal=face.normal;
  if(sourceNormal?.length===3&&sourceNormal.every(Number.isFinite)){
    const magnitude=Math.hypot(...sourceNormal);
    const alignment=magnitude>.5?dot(normal,sourceNormal)/magnitude:0;
    if(alignment<-.95){polygon.reverse();normal=normal.map(v=>-v) as Vec3}
  }
  if(polygon.some(p=>Math.abs(dot(normal,subtract(p,polygon[0])))>.08))throw Error(`BSP face #${faceId} is nonplanar.`);
  const texture=map.textures[face.texture];
  if(!texture||!isPrefabRenderableTexture(texture.name))
    throw Error(`BSP face #${faceId} uses a non-renderable/tool texture '${texture?.name??'<missing>'}' (flags=${face.flags}); panel omitted.`);

  // Check convexity. Most compiled BSP face polygons are convex, but a
  // malformed/concave polygon must be triangulated instead of exported as an
  // invalid MAP brush. Ear clipping keeps the original visible area intact.
  const axis=Math.abs(normal[0])>Math.abs(normal[1])&&Math.abs(normal[0])>Math.abs(normal[2])?0:(Math.abs(normal[1])>Math.abs(normal[2])?1:2);
  const project=(p:Vec3):[number,number]=>axis===0?[p[1],p[2]]:axis===1?[p[0],p[2]]:[p[0],p[1]];
  const points2=polygon.map(project);
  const orient=(a:number,b:number,c:number)=>{
    const p=points2[a],q=points2[b],r=points2[c];return (q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
  };
  const signed=points2.reduce((sum,p,i)=>{const q=points2[(i+1)%points2.length];return sum+p[0]*q[1]-p[1]*q[0]},0);
  if(Math.abs(signed)<.01)throw Error(`BSP face #${faceId} has a degenerate projected contour.`);
  const sign=Math.sign(signed),all=polygon.map((_,i)=>i);
  const convex=all.every((_,i)=>orient(all[i],all[(i+1)%all.length],all[(i+2)%all.length])*sign>=-.001);
  const polygons:number[][]=[];
  if(convex)polygons.push(all);
  else{
    const remaining=[...all];
    while(remaining.length>3){
      let found=false;
      for(let k=0;k<remaining.length;k++){
        const a=remaining[(k+remaining.length-1)%remaining.length],b=remaining[k],c=remaining[(k+1)%remaining.length];
        if(orient(a,b,c)*sign<.001)continue;
        const triangleContains=(p:number)=>{
          const a1=orient(a,b,p)*sign,a2=orient(b,c,p)*sign,a3=orient(c,a,p)*sign;
          return a1>=-.0001&&a2>=-.0001&&a3>=-.0001;
        };
        if(remaining.some(p=>p!==a&&p!==b&&p!==c&&triangleContains(p)))continue;
        polygons.push([a,b,c]);remaining.splice(k,1);found=true;break;
      }
      if(!found)throw Error(`BSP face #${faceId} cannot be triangulated safely; it may self-intersect.`);
    }
    polygons.push(remaining);
  }
  // Valve 220 and validateBrush read the FIRST THREE indices to define a
  // plane. Even a sound BSP polygon can contain nearly-collinear consecutive
  // vertices (T-junctions). Rotate winding cyclically so its first three
  // span the largest possible triangle, without changing UV or orientation.
  const stableStart=(ids:number[]):number[]=>{
    let best=0,largest=0;
    for(let i=0;i<ids.length;i++){
      const a=polygon[ids[i]%polygon.length],b=polygon[ids[(i+1)%ids.length]%polygon.length],c=polygon[ids[(i+2)%ids.length]%polygon.length];
      const magnitude=Math.hypot(...cross(subtract(b,a),subtract(c,a)));
      if(magnitude>largest){largest=magnitude;best=i}
    }
    if(largest<.01)throw Error(`BSP face #${faceId} contains a zero-area panel after simplification.`);
    return [...ids.slice(best),...ids.slice(0,best)];
  };
  return polygons.map((ids,index)=>{
    const front=ids.map(i=>polygon[i]);
    const back=front.map(p=>subtract(p,normal.map(v=>v*thickness)));
    const world=[...front,...back],n=front.length;
    const center:Vec3=[0,1,2].map(j=>world.reduce((sum,p)=>sum+p[j],0)/world.length) as Vec3;
    const texFace=(indices:number[])=>({indices,texture:texture.name,uAxis:face.sTexinfo!.slice(0,3) as Vec3,vAxis:face.tTexinfo!.slice(0,3) as Vec3,uShift:face.sTexinfo![3],vShift:face.tTexinfo![3],uScale:1,vScale:1});
    const faces=[texFace(stableStart(Array.from({length:n},(_,i)=>i))),texFace(stableStart(Array.from({length:n},(_,i)=>n+(n-1-i))))];
    for(let i=0;i<n;i++)faces.push(texFace([i,n+i,n+(i+1)%n,(i+1)%n]));
    const brush:Brush={id:uid(),kind:'brush',primitive:'poly',name:`${name} panel ${index+1}`,position:center,rotation:[0,0,0],scale:[1,1,1],vertices:world.map(p=>subtract(p,center)),faces,layer:'Imported BSP',group:name};
    const problems=validateBrush(brush);
    if(problems.length)throw Error(`BSP face #${faceId} cannot form a valid editable panel: ${problems[0]}`);
    return brush;
  });
}
function readEmbeddedMip(source:ArrayBuffer,name:string,width:number,height:number):WAD3MipTexture|null{
  const bytes=new Uint8Array(source),v=new DataView(source);
  if(v.getInt32(0,true)!==30)return null;
  const at=v.getInt32(4+2*8,true),size=v.getInt32(8+2*8,true);
  if(at<124||size<4||at+size>bytes.length)return null;
  const n=v.getInt32(at,true);
  if(n<1||n>32768||n*4+4>size)return null;
  for(let i=0;i<n;i++){
    const offset=v.getInt32(at+4+i*4,true);if(offset<4+n*4||offset+40>size)continue;
    const begin=at+offset;
    const label=Array.from(bytes.subarray(begin,begin+16)).map(x=>x?String.fromCharCode(x):'\0').join('').split('\0')[0];
    if(label.toLowerCase()!==name.toLowerCase())continue;
    if(v.getUint32(begin+16,true)!==width||v.getUint32(begin+20,true)!==height)return null;
    const offsets=[0,1,2,3].map(j=>v.getUint32(begin+24+j*4,true));
    const mipSizes=[width*height,...[1,2,3].map(k=>Math.max(1,width>>k)*Math.max(1,height>>k))];
    if(offsets[0]<40||offsets.some((o,j)=>o<40||offset+o+mipSizes[j]>size))return null;
    const paletteOffset=offsets[3]+mipSizes[3];
    if(offset+paletteOffset+2>size)return null;
    const colors=v.getUint16(begin+paletteOffset,true),end=paletteOffset+2+colors*3;
    if(colors<1||colors>256||offset+end>size)return null;
    return {name:label,width,height,raw:bytes.slice(begin,begin+end)};
  }
  return null;
}
function makeWad3(textures:WAD3MipTexture[]):Uint8Array{
  const total=12+textures.reduce((n,tex)=>n+tex.raw.length,0)+textures.length*32;
  if(total>MAX_BYTES)throw Error('Extracted WAD3 would exceed the 24 MB prefab texture limit.');
  const out=new Uint8Array(total),view=new DataView(out.buffer);
  out.set([87,65,68,51]);view.setInt32(4,textures.length,true);view.setInt32(8,total-textures.length*32,true);
  let pos=12;
  for(const [i,tex] of textures.entries()){
    out.set(tex.raw,pos);const entry=total-textures.length*32+i*32;
    view.setInt32(entry,pos,true);view.setInt32(entry+4,tex.raw.length,true);view.setInt32(entry+8,tex.raw.length,true);
    out[entry+12]=0x43;for(let j=0;j<Math.min(16,tex.name.length);j++)out[entry+16+j]=tex.name.charCodeAt(j);
    pos+=tex.raw.length;
  }
  return out;
}
const toBase64=(bytes:Uint8Array)=>{let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(text)};
export const decodePrefabWad=(base64:string):Uint8Array=>{
  if(typeof base64!=='string'||base64.length>Math.ceil(MAX_BYTES*4/3)+8||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw Error('Invalid or oversized prefab WAD data.');
  const raw=atob(base64);if(raw.length>MAX_BYTES)throw Error('Prefab WAD exceeds size limit.');
  return Uint8Array.from(raw,ch=>ch.charCodeAt(0));
};
export function extractBspObjectPrefab(map:BspMap,source:ArrayBuffer,faceIds:readonly number[],label:string,externalWads:readonly Uint8Array[]=[],options:BspObjectExtractionOptions={}):BspObjectPrefab{
  const mode=options.mode??'exact',thickness=options.thickness??2;
  if(mode!=='exact'&&mode!=='surface-shell'&&mode!=='hull0-solid')throw Error('Unknown BSP prefab extraction mode.');
  if(mode==='surface-shell'&&(!Number.isFinite(thickness)||thickness<1||thickness>16))throw Error('Panel thickness must be between 1 and 16 units.');
  if(faceIds.length<(mode==='surface-shell'?1:4)||faceIds.length>MAX_SELECTED||new Set(faceIds).size!==faceIds.length)throw Error(mode==='exact'?'Select 4–256 distinct BSP faces belonging to complete solids.':'Select 1–256 distinct visible BSP faces.');
  const byId=new Map(map.faces.map((f,i)=>[bspOriginalFaceIndex(f,i),f]));
  const faces=faceIds.map(id=>byId.get(id));if(faces.some(f=>!f))throw Error('One or more selected BSP faces are missing.');
  const groups=mode==='exact'?components(faces as BspFace[]):[];
  if(groups.length>64)throw Error('Too many disconnected object pieces (limit 64).');
  // Approximate recovery is explicitly opt-in. A tiny clipped/sliver BSP
  // polygon must not make 83 otherwise recoverable chair faces fail together.
  // Keep ALL rejected face IDs in the prefab manifest and require explicit UI
  // confirmation before downloading a visibly incomplete object.
  const skippedFaces:{faceId:number;reason:string}[]=[];
  const hull=mode==='hull0-solid'?recoverSolidSubmodelHull0(map,source,faceIds,label):null;
  const brushes=mode==='hull0-solid'?hull!.brushes:mode==='exact'?groups.map((g,i)=>reconstructConvex(g,map,`${label} ${i+1}`)):(faces as BspFace[]).flatMap((face,i)=>{
    try{return surfaceShellPanels(face,map,label,thickness)}
    catch(error){
      skippedFaces.push({faceId:faceIds[i],reason:String(error instanceof Error?error.message:error).slice(0,220)});
      return [];
    }
  });
  if(mode==='surface-shell'&&!brushes.length)throw Error(`No exportable panels remain (${skippedFaces.length} selected BSP faces rejected). First: ${skippedFaces[0]?.reason||'invalid selection'}`);
  if(brushes.length>256)throw Error('Surface shell requires more than 256 editable panels. Select fewer faces.');
  const textureNames=[...new Set(brushes.flatMap(b=>b.faces.map(f=>f.texture.toLowerCase())))];
  if(textureNames.length>MAX_TEXTURES)throw Error('Too many textures in selected object.');
  // Preserve animation/random-tiling variants referenced by the compiled
  // BSP, not just the first visible +0 / -0 frame. All pixels remain original.
  // Do not fabricate missing frames that are not present in the source.
  const expandedTextureNames=new Set(textureNames);
  for(const name of textureNames){
    if((name.startsWith('+')||name.startsWith('-'))&&name.length>2){
      const rest=name.slice(2);
      for(const sibling of map.textures){
        const key=sibling.name.toLowerCase();
        if(key.length===name.length&&key[0]===name[0]&&key.slice(2)===rest&&/^[0-9a-j]$/i.test(key[1]))expandedTextureNames.add(key);
      }
    }
  }
  if(expandedTextureNames.size>MAX_TEXTURES)throw Error('Too many referenced texture animation frames for the prefab.');
  const textures=[...expandedTextureNames].map(name=>{
    const descriptor=map.textures.find(t=>t.name.toLowerCase()===name);
    if(!descriptor)throw Error(`Missing BSP texture ${name}`);
    const mip=readEmbeddedMip(source,descriptor.name,descriptor.width,descriptor.height)||findMipTextureInWads(externalWads,descriptor.name,descriptor.width,descriptor.height);
    if(!mip)throw Error(`Texture ${descriptor.name} is external and its original WAD3 bytes are not loaded. Import the source WAD3 in BSP Texture Studio first; image previews alone do not preserve palette/mipmaps.`);
    return mip;
  });
  const wad=makeWad3(textures),safeLabel=label.trim().replace(/[^A-Za-z0-9_-]+/g,'_').slice(0,42)||'extracted';
  let fingerprint=2166136261;for(const byte of wad){fingerprint=Math.imul(fingerprint^byte,16777619)>>>0}
  const wadName=`${safeLabel}_${fingerprint.toString(16).padStart(8,'0')}.wad`;
  const base=createPrefab(brushes,label);
  return {...base,format:'svenstudio-bsp-object',sourceBsp:map.name,wad:{filename:wadName,base64:toBase64(wad)},faceIds:[...faceIds],...(mode==='surface-shell'?{recovery:{mode:'surface-shell' as const,thickness,panels:brushes.length,skippedFaces,warning:'Approximate visible surface panels only. Original brush volumes, collision hulls, hidden faces, scripts and lighting are not recovered. Any skipped BSP faces are recorded.'}}:mode==='hull0-solid'?{recovery:{mode:'hull0-solid' as const,modelIndex:hull!.modelIndex,solids:brushes.length,warning:'Convex solid BSP hull-0 leaf cells; NOT original brushes. Face texture assignment can be approximate. Original collision hulls, scripts and baked lighting are not recovered.'}}:{})};
}
export function validateBspObjectPrefab(value:unknown):BspObjectPrefab{
  if(!value||typeof value!=='object')throw Error('Invalid BSP object prefab.');
  const obj=value as Partial<BspObjectPrefab>;
  if(obj.format!=='svenstudio-bsp-object'||typeof obj.sourceBsp!=='string'||!obj.wad||typeof obj.wad.filename!=='string'||!/^[a-zA-Z0-9_-]+\.wad$/.test(obj.wad.filename))throw Error('Unsupported BSP object prefab format.');
  const validated=validatePrefab(obj);
  if(obj.recovery&&(obj.recovery.mode==='surface-shell' ? (!Number.isFinite(obj.recovery.thickness)||obj.recovery.thickness<1||obj.recovery.thickness>16||obj.recovery.panels!==validated.objects.length) : obj.recovery.mode==='hull0-solid' ? (!Number.isInteger(obj.recovery.modelIndex)||obj.recovery.modelIndex<1||!Number.isInteger(obj.recovery.solids)||obj.recovery.solids!==validated.objects.length) : true))throw Error('Invalid approximate BSP prefab recovery metadata.');
  if(obj.recovery?.skippedFaces&&( !Array.isArray(obj.recovery.skippedFaces)||obj.recovery.skippedFaces.length>MAX_SELECTED||obj.recovery.skippedFaces.some(f=>!Number.isSafeInteger(f.faceId)||f.faceId<0||typeof f.reason!=='string'||f.reason.length>220||!obj.faceIds?.includes(f.faceId))))throw Error('Invalid skipped BSP faces in prefab recovery metadata.');
  if(validated.objects.some(o=>o.kind!=='brush')||!Array.isArray(obj.faceIds)||obj.faceIds.length>MAX_SELECTED)throw Error('BSP object prefab contains invalid geometry metadata.');
  const archive=decodePrefabWad(obj.wad.base64);
  for(const brush of validated.objects){if(brush.kind!=='brush')continue;for(const face of brush.faces){
    const w=new DataView(archive.buffer),count=w.getInt32(4,true),dir=w.getInt32(8,true);
    let present=false;
    if(count>MAX_TEXTURES||dir<12||dir+32*count>archive.length)throw Error('Malformed texture archive.');
    for(let i=0;i<count;i++){const p=dir+32*i;let name='';for(let k=0;k<16&&archive[p+16+k];k++)name+=String.fromCharCode(archive[p+16+k]);if(name.toLowerCase()===face.texture.toLowerCase())present=true;}
    if(!present)throw Error(`Missing texture ${face.texture} in the prefab archive.`);
  }}
  return obj as BspObjectPrefab;
}
