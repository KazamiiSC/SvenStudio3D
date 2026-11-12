/** BSP Editor 6D: isolated BSP30 texinfo edits with guarded baked-lightmap reprojection.
 * Each modified face gets a private texinfo record. When a UV change alters its
 * baked-lighting coordinates, resample ALL of its existing lightstyle RGB layers
 * into a new lighting lump. This approximates existing lighting; it cannot compute
 * new shadows/occlusion, change VIS, or recalculate RAD.
 */
import {parseBsp,type BspFace,type BspMap} from './bsp.ts';
import {bspOriginalFaceIndex} from './bspFaceSelection.ts';
import {readNativeBsp} from './bspNativeEdit.ts';

type Axis=[number,number,number,number];
export interface BspSurfaceOverride {s:Axis;t:Axis;texture:number}
export type BspSurfaceOverrides=Record<number,BspSurfaceOverride>;
export interface BspSurfaceOperation {
  /** Texture index from existing or session-imported WAD3 directory; -1 retains the current texture. */
  texture:number;
  offsetU:number;offsetV:number;
  rotation:number;
  scaleU:number;scaleV:number;
}
const MAX_BSP_BYTES=256*1024*1024;
const MAX_CHANGES=2048;
const equal=(a:readonly number[],b:readonly number[])=>a.length===b.length&&a.every((value,i)=>Math.abs(value-b[i])<0.00001);
const f32=(value:number)=>Math.fround(value);
const dot=(axis:readonly number[],point:readonly number[])=>axis[0]*point[0]+axis[1]*point[1]+axis[2]*point[2]+axis[3];
const originalFace=(map:BspMap,id:number):BspFace=>{
  const face=map.faces.find((entry,i)=>bspOriginalFaceIndex(entry,i)===id);
  if(!face||!face.sTexinfo||!face.tTexinfo||face.texinfoIndex===undefined)throw Error(`Original BSP face #${id} is unavailable or malformed.`);
  return face;
};
const faceSampleGrid=(face:BspFace,s:Axis,t:Axis)=>{
  const texels=face.points.map(point=>[dot(s,point),dot(t,point)]);
  const mins:[number,number]=[Math.floor(Math.min(...texels.map(uv=>uv[0]))/16),Math.floor(Math.min(...texels.map(uv=>uv[1]))/16)];
  const maxs:[number,number]=[Math.ceil(Math.max(...texels.map(uv=>uv[0]))/16),Math.ceil(Math.max(...texels.map(uv=>uv[1]))/16)];
  return {texels,mins,size:[maxs[0]-mins[0]+1,maxs[1]-mins[1]+1]};
};
/** Conservative family: don't turn ordinary materials into special rendering/physics textures. */
export function bspEditableTextureName(name:string):boolean {
  return /^[a-zA-Z0-9_$.-]{1,15}$/.test(name)&&!/^MISSING_\d+$/i.test(name)&&
    !/^(sky|clip|origin|hint|skip|null|aaatrigger|bevel|solidhint|trigger|black|scroll|water|lava|slime)(?:$|[_\d])/i.test(name)&&
    !/^[+!{~\-]/.test(name);
}
export function bspCanEditSelectedFaces(map:BspMap,ids:readonly number[]):boolean {
  if(!ids.length||ids.length>64||new Set(ids).size!==ids.length)return false;
  try{return ids.every(id=>{
    const face=originalFace(map,id);
    return face.flags===0&&bspEditableTextureName(map.textures[face.texture]?.name||'');
  })}catch{return false}
}
export function bspAllowedFaceTextureIndices(map:BspMap,ids:readonly number[]):number[]{
  if(!bspCanEditSelectedFaces(map,ids))return [];
  return map.textures.flatMap((tex,index)=>bspEditableTextureName(tex.name)&&tex.width>=16&&tex.height>=16&&tex.width<=4096&&tex.height<=4096?[index]:[]);
}
export function bspFaceIsLightmapped(face:BspFace):boolean{return (face.lightmapOffset??-1)>=0;}
/** Compute whether edited UVs preserve the exact original baked-sample mapping. */
function sameLightmapSampling(face:BspFace,base:ReturnType<typeof faceSampleGrid>,mapped:ReturnType<typeof faceSampleGrid>):boolean {
  if(mapped.size.some((size,i)=>size!==base.size[i]))return false;
  return face.points.every((_,i)=>[0,1].every(k=>
    Math.abs((mapped.texels[i][k]-16*mapped.mins[k])-(base.texels[i][k]-16*base.mins[k]))<=0.0005));
}
export interface BspLightmapReprojection {width:number;height:number;layers:Uint8Array[]}
/**
 * Existing baked RGB values are an illumination FIELD on the surface. For a new
 * texture coordinate system, reproject this field into the new lightmap grid.
 * 3 source polygon points give an affine inverse between old and new UVs.
 * No artificial new lighting is computed, and every active style is retained.
 */
export function bspReprojectFaceLightmap(face:BspFace,edit:BspSurfaceOverride):BspLightmapReprojection|null {
  if(!bspFaceIsLightmapped(face))return null;
  if(!face.sTexinfo||!face.tTexinfo||!face.lightLayers?.length||!face.lightStyles?.length||
    face.lightLayers.length!==face.lightStyles.length)throw Error('Incomplete baked lightmap; recompilation required.');
  const base=faceSampleGrid(face,face.sTexinfo,face.tTexinfo);
  const mapped=faceSampleGrid(face,edit.s,edit.t);
  const [w,h]=mapped.size;
  if(w<1||h<1||w>256||h>256||w*h>32768)throw Error('New lightmap exceeds safe 256×256 / 32768-sample budget; recompilation required.');
  if(base.size[0]!==face.lightWidth||base.size[1]!==face.lightHeight)throw Error('Original baked-sample dimensions are inconsistent.');
  if(face.lightLayers.some(layer=>layer.length!==base.size[0]*base.size[1]*3))throw Error('Original lightstyle RGB data are incomplete.');
  if(sameLightmapSampling(face,base,mapped))return null;
  const sourceUV=base.texels,newUV=mapped.texels;
  // Find three noncollinear vertices in NEW UV space, using maximal area for
  // numerical stability (degenerate / overlaid axes are rejected).
  let choice:[number,number,number]=[0,1,2],greatest=0;
  for(let i=0;i<newUV.length;i++)for(let j=i+1;j<newUV.length;j++)for(let k=j+1;k<newUV.length;k++){
    const area=Math.abs((newUV[j][0]-newUV[i][0])*(newUV[k][1]-newUV[i][1])-(newUV[j][1]-newUV[i][1])*(newUV[k][0]-newUV[i][0]));
    if(area>greatest){greatest=area;choice=[i,j,k]}
  }
  if(greatest<1e-5)throw Error('UV axes collapsed or are degenerate; lightmap cannot be reprojected.');
  const [i,j,k]=choice,a=newUV[i],b=newUV[j],c=newUV[k],det=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const originalWidth=base.size[0],originalHeight=base.size[1];
  const layers=face.lightLayers.map(layer=>{
    const output=new Uint8Array(w*h*3);
    for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const u=16*(mapped.mins[0]+x)-a[0],v=16*(mapped.mins[1]+y)-a[1];
      const alpha=(u*(c[1]-a[1])-v*(c[0]-a[0]))/det;
      const beta=(v*(b[0]-a[0])-u*(b[1]-a[1]))/det;
      const oldS=sourceUV[i][0]+alpha*(sourceUV[j][0]-sourceUV[i][0])+beta*(sourceUV[k][0]-sourceUV[i][0]);
      const oldT=sourceUV[i][1]+alpha*(sourceUV[j][1]-sourceUV[i][1])+beta*(sourceUV[k][1]-sourceUV[i][1]);
      const fx=Math.max(0,Math.min(originalWidth-1,oldS/16-base.mins[0]));
      const fy=Math.max(0,Math.min(originalHeight-1,oldT/16-base.mins[1]));
      const left=Math.floor(fx),top=Math.floor(fy),right=Math.min(left+1,originalWidth-1),bottom=Math.min(top+1,originalHeight-1);
      const sx=fx-left,sy=fy-top,out=(y*w+x)*3;
      for(let channel=0;channel<3;channel++){
        const aa=layer[(top*originalWidth+left)*3+channel],bb=layer[(top*originalWidth+right)*3+channel];
        const cc=layer[(bottom*originalWidth+left)*3+channel],dd=layer[(bottom*originalWidth+right)*3+channel];
        output[out+channel]=Math.round((aa*(1-sx)+bb*sx)*(1-sy)+(cc*(1-sx)+dd*sx)*sy);
      }
    }
    return output;
  });
  return {width:w,height:h,layers};
}
function validatedFaceEdit(map:BspMap,id:number,edit:BspSurfaceOverride):void {
  const face=originalFace(map,id),original=map.textures[face.texture],next=map.textures[edit.texture];
  if(!original||!next||face.flags!==0||!bspEditableTextureName(original.name)||!bspEditableTextureName(next.name))throw Error(`Face #${id}: special or unsupported material; refusing binary edit.`);
  if(!Number.isInteger(edit.texture)||edit.texture<0||edit.texture>=map.textures.length)throw Error('Replacement texture index is outside the compiled BSP directory.');
  if(edit.s.length!==4||edit.t.length!==4||![...edit.s,...edit.t].every(v=>Number.isFinite(v)&&Math.abs(v)<=1_000_000))throw Error(`Face #${id}: texinfo axis is invalid or out of range.`);
  const mapped=faceSampleGrid(face,edit.s,edit.t);
  if(mapped.texels.some(pair=>pair.some(v=>!Number.isFinite(v)||Math.abs(v)>16_000_000)))throw Error(`Face #${id}: UV coordinates exceed safe bounds.`);
  if(bspFaceIsLightmapped(face)){
    if(!face.lightRgb||!face.lightLayers?.length||!face.lightStyles?.length)throw Error(`Face #${id}: lightmap samples are missing; edit requires recompilation.`);
    // Validate sizes and planar inverse, without resampling every luxel during
    // mouse movement. Reprojection runs only when committing/exporting.
    const base=faceSampleGrid(face,face.sTexinfo!,face.tTexinfo!);
    if(base.size[0]!==face.lightWidth||base.size[1]!==face.lightHeight)throw Error(`Face #${id}: source lightmap size is inconsistent.`);
    const [w,h]=mapped.size;
    if(w<1||h<1||w>256||h>256||w*h>32768)throw Error(`Face #${id}: transformed lightmap exceeds safe limits; recompilation required.`);
    const v=face.points,uv=mapped.texels;
    if(v.length<3||!uv.some((p,i)=>uv.some((q,j)=>j>i&&uv.some((r,k)=>k>j&&Math.abs((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]))>1e-5))))throw Error(`Face #${id}: invalid degenerate UV basis.`);
    if(face.lightLayers.some(layer=>layer.length!==face.lightWidth*face.lightHeight*3))throw Error(`Face #${id}: lightstyle data are incomplete.`);
  }
}
export function bspApplySurfaceOperation(map:BspMap,current:BspSurfaceOverrides,ids:readonly number[],op:BspSurfaceOperation):BspSurfaceOverrides {
  if(!ids.length||ids.length>64||new Set(ids).size!==ids.length)throw Error('Select between 1 and 64 unique BSP faces.');
  if(![op.offsetU,op.offsetV,op.rotation,op.scaleU,op.scaleV].every(Number.isFinite)||Math.abs(op.offsetU)>16384||Math.abs(op.offsetV)>16384||Math.abs(op.rotation)>360||Math.abs(op.scaleU)<0.125||Math.abs(op.scaleU)>8||Math.abs(op.scaleV)<0.125||Math.abs(op.scaleV)>8)throw Error('UV controls exceed safe limits (offset ±16384, rotation ±360°, |scale| 0.125–8).');
  if(!bspCanEditSelectedFaces(map,ids))throw Error('One or more selected faces have special textures or unsupported texinfo flags.');
  const eligible=op.texture===-1?[]:bspAllowedFaceTextureIndices(map,ids);
  if(op.texture!==-1&&!eligible.includes(op.texture))throw Error('Texture replacement must be an ordinary compatible BSP/WAD3 material.');
  const next={...current};
  for(const id of ids){
    const face=originalFace(map,id),old=next[id]??{s:face.sTexinfo!,t:face.tTexinfo!,texture:face.texture};
    const s=old.s,t=old.t,cos=Math.cos(op.rotation*Math.PI/180),sin=Math.sin(op.rotation*Math.PI/180);
    const su=s.slice(0,3).map(v=>v/op.scaleU),tv=t.slice(0,3).map(v=>v/op.scaleV);
    const nextS=[0,1,2].map(i=>f32(cos*su[i]-sin*tv[i]));
    const nextT=[0,1,2].map(i=>f32(sin*su[i]+cos*tv[i]));
    const center=[0,1,2].map(axis=>face.points.reduce((sum,p)=>sum+p[axis],0)/face.points.length);
    const newS:Axis=[nextS[0],nextS[1],nextS[2],f32(dot(s,center)-nextS.reduce((sum,n,i)=>sum+n*center[i],0)+op.offsetU)];
    const newT:Axis=[nextT[0],nextT[1],nextT[2],f32(dot(t,center)-nextT.reduce((sum,n,i)=>sum+n*center[i],0)+op.offsetV)];
    // Preserve original f32 values on shift-only operations to avoid baked-sample jitter.
    if(op.rotation===0&&op.scaleU===1&&op.scaleV===1){newS[0]=s[0];newS[1]=s[1];newS[2]=s[2];newS[3]=f32(s[3]+op.offsetU);newT[0]=t[0];newT[1]=t[1];newT[2]=t[2];newT[3]=f32(t[3]+op.offsetV);}
    const candidate={s:newS,t:newT,texture:op.texture===-1?old.texture:op.texture};
    validatedFaceEdit(map,id,candidate);
    if(equal(candidate.s,face.sTexinfo!)&&equal(candidate.t,face.tTexinfo!)&&candidate.texture===face.texture)delete next[id];
    else next[id]=candidate;
  }
  if(Object.keys(next).length>MAX_CHANGES)throw Error('The 2048-face edit safety limit was reached.');
  return next;
}
/** Preview uses exact parsed BSP geometry; only texinfo and texture references change. */
export function bspPreviewSurfaceMap(map:BspMap,changes:BspSurfaceOverrides):BspMap {
  if(!Object.keys(changes).length)return map;
  const faces=map.faces.map((face,i)=>{
    const edit=changes[bspOriginalFaceIndex(face,i)];if(!edit)return face;
    validatedFaceEdit(map,bspOriginalFaceIndex(face,i),edit);
    const grid=faceSampleGrid(face,edit.s,edit.t);
    return {...face,texture:edit.texture,sTexinfo:edit.s,tTexinfo:edit.t,texels:grid.texels.map(v=>[v[0],v[1]] as [number,number]),lightMin:grid.mins,lightWidth:grid.size[0],lightHeight:grid.size[1]};
  });
  return {...map,faces};
}
function arraysEqual(a:Uint8Array,b:Uint8Array):boolean{return a.byteLength===b.byteLength&&a.every((v,i)=>v===b[i]);}
function asBytes(buffer:ArrayBuffer,offset:number,length:number){return new Uint8Array(buffer,offset,length);}
/** Binary write. Must be called on entity-export output if entity edits are pending. */
export function writeBspSurfaceEdits(source:ArrayBuffer,changes:BspSurfaceOverrides):ArrayBuffer {
  const ids=Object.keys(changes).map(Number).sort((a,b)=>a-b);
  if(!ids.length)return source.slice(0);
  if(ids.length>MAX_CHANGES||ids.some(id=>!Number.isSafeInteger(id)||id<0))throw Error('Too many or invalid selected face IDs.');
  const native=readNativeBsp(source),map=parseBsp(source,'verification.bsp');
  if(map.warnings.some(w=>/malformed faces were skipped/i.test(w)))throw Error('Malformed BSP faces: binary surface editing is disabled for this map.');
  const view=new DataView(source),faceLump=native.lumps[7],infoLump=native.lumps[6];
  if(faceLump.length%20||infoLump.length%40)throw Error('Malformed BSP face or texinfo directory.');
  const oldCount=infoLump.length/40;
  if(oldCount+ids.length>65535)throw Error('BSP texinfo indices exceed GoldSrc 16-bit face limits.');
  for(const id of ids){
    if(id>=faceLump.length/20)throw Error('BSP face ID is outside the original faces lump.');
    const face=originalFace(map,id),at=faceLump.offset+id*20;
    if(view.getUint16(at+10,true)!==face.texinfoIndex)throw Error(`Face #${id}: texinfo reference changed unexpectedly.`);
    validatedFaceEdit(map,id,changes[id]);
  }
  // Only resample changed faces whose coordinates alter the baked sample grid.
  const patches=new Map<number,BspLightmapReprojection>();let extraBytes=0;
  for(const id of ids){
    const patch=bspReprojectFaceLightmap(originalFace(map,id),changes[id]);
    if(!patch)continue;
    const length=patch.layers.reduce((sum,layer)=>sum+layer.length,0);
    extraBytes+=length;if(extraBytes>24*1024*1024)throw Error('Reprojected lighting exceeds the 24 MB safety budget.');
    patches.set(id,patch);
  }
  const appendedAt=(source.byteLength+3)&~3,appendedLength=infoLump.length+ids.length*40;
  const lightLump=native.lumps[8];
  const newLightAt=(appendedAt+appendedLength+3)&~3;
  const lightSize=lightLump.length+extraBytes;
  const resultSize=patches.size?newLightAt+lightSize:appendedAt+appendedLength;
  if(resultSize>MAX_BSP_BYTES)throw Error('BSP copy exceeds the 256 MB maximum.');
  const result=new ArrayBuffer(resultSize),out=new Uint8Array(result),v=new DataView(result);
  out.set(new Uint8Array(source));out.set(asBytes(source,infoLump.offset,infoLump.length),appendedAt);
  if(patches.size)out.set(asBytes(source,lightLump.offset,lightLump.length),newLightAt);
  const clones=new Map<number,number>();let nextLighting=lightLump.length;
  ids.forEach((id,i)=>{
    const face=originalFace(map,id),edit=changes[id],start=appendedAt+infoLump.length+i*40;
    for(let j=0;j<4;j++){v.setFloat32(start+j*4,edit.s[j],true);v.setFloat32(start+16+j*4,edit.t[j],true);}
    v.setInt32(start+32,edit.texture,true);v.setInt32(start+36,face.flags,true);
    const at=faceLump.offset+id*20;
    const texinfoIndex=oldCount+i;v.setUint16(at+10,texinfoIndex,true);clones.set(id,texinfoIndex);
    const patch=patches.get(id);
    if(patch){
      v.setInt32(at+16,nextLighting,true);
      for(const layer of patch.layers){out.set(layer,newLightAt+nextLighting);nextLighting+=layer.length;}
    }
  });
  v.setInt32(4+6*8,appendedAt,true);v.setInt32(8+6*8,appendedLength,true);
  if(patches.size){v.setInt32(4+8*8,newLightAt,true);v.setInt32(8+8*8,lightSize,true);}
  const verified=readNativeBsp(result),parsed=parseBsp(result,'verified.bsp');
  for(let lump=0;lump<15;lump++){
    if(lump===6||lump===7||(lump===8&&patches.size))continue;
    if(verified.lumps[lump].length!==native.lumps[lump].length||verified.lumps[lump].offset!==native.lumps[lump].offset||
      !arraysEqual(asBytes(result,verified.lumps[lump].offset,verified.lumps[lump].length),asBytes(source,native.lumps[lump].offset,native.lumps[lump].length)))throw Error(`BSP lump #${lump} was modified unexpectedly.`);
  }
  if(patches.size&&!arraysEqual(asBytes(result,verified.lumps[8].offset,lightLump.length),asBytes(source,lightLump.offset,lightLump.length)))
    throw Error('Original lightmap data changed during append.');
  for(let faceIndex=0;faceIndex<faceLump.length/20;faceIndex++){
    if(clones.has(faceIndex))continue;
    if(!arraysEqual(asBytes(source,faceLump.offset+faceIndex*20,20),asBytes(result,faceLump.offset+faceIndex*20,20)))throw Error(`Unselected face #${faceIndex} changed.`);
  }
  const byId=new Map(parsed.faces.map((face,i)=>[bspOriginalFaceIndex(face,i),face]));
  for(const id of ids){
    const next=byId.get(id),old=originalFace(map,id),edit=changes[id],patch=patches.get(id);
    if(!next||next.texinfoIndex!==clones.get(id)||next.texture!==edit.texture||!next.sTexinfo||!next.tTexinfo||!equal(next.sTexinfo,edit.s)||!equal(next.tTexinfo,edit.t))throw Error(`Face #${id} did not survive binary export/reimport.`);
    if(patch){
      if(next.lightWidth!==patch.width||next.lightHeight!==patch.height||next.lightLayers?.length!==patch.layers.length||
        patch.layers.some((layer,i)=>!arraysEqual(layer,next.lightLayers![i])))throw Error(`Face #${id}: transformed lightstyles failed binary verification.`);
    }else if(next.lightmapOffset!==old.lightmapOffset||
      (bspFaceIsLightmapped(old)&&(next.lightWidth!==old.lightWidth||next.lightHeight!==old.lightHeight||
        !arraysEqual(next.lightRgb??new Uint8Array(),old.lightRgb??new Uint8Array()))))
      throw Error(`Face #${id}: reimported lightmap was altered.`);
  }
  return result;
}
