/** BSP30 binary brush-submodel transplantation (single func_* model, no worldspawn).
 * Fail-closed first stage: relocates dependency graphs and verifies a new *N reference.
 * This is NOT world BSP merging, VIS rebuilding, coordinate relocation or decompilation.
 */
import {nativeClassname,nativeProperty,readNativeBsp,writeNativeBsp,type NativeBsp} from './bspNativeEdit';
import {parseBsp} from './bsp';
import {findMipTextureInWads,MissingBspWadTextureError} from './bspWadMipTexture';

const STRIDES=[0,20,0,12,0,24,40,20,0,8,28,2,4,4,64];
const LIMIT=64*1024*1024, MAX_RECORDS=8192, MAX_FACES=2048;
const MAX_FILE=256*1024*1024, MAX_TEXTURES=512;
const ENTI=0,PLANE=1,TEXTURE=2,VERT=3,NODE=5,INFO=6,FACE=7,LIGHT=8,CLIP=9,LEAF=10,MARK=11,EDGE=12,SURF=13,MODEL=14;
const u16max=65535, signedMax=32767;
const fail=(message:string):never=>{throw new Error(`Binary BSP transfer: ${message}`)};
/** Diagnostic data for an invalid style sequence (no valid in-game interpretation after a 255 slot). */
export class InvalidBspLightstylesError extends Error {
 constructor(readonly faceIndex:number,readonly styles:readonly number[],readonly lightofs:number){
  super(`Binary BSP transfer: Invalid face lightstyle sequence at face #${faceIndex}: [${styles.join(',')}], lightofs=${lightofs}.`);
  this.name='InvalidBspLightstylesError';
 }
}
const align=(n:number)=>(n+3)&~3;
const dv=(bytes:Uint8Array)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
const utf8=(bytes:Uint8Array)=>{let r='';for(const x of bytes){if(!x)break;r+=String.fromCharCode(x)}return r};
const latin1=(text:string)=>{const out=new Uint8Array(text.length);for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c>255)fail('Entity text must remain Latin-1.');out[i]=c}return out};
const same=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((byte,i)=>byte===b[i]);

interface Tex {name:string;width:number;height:number;external:boolean;raw:Uint8Array|null}
function readTextures(bytes:Uint8Array):Tex[]{
 if(bytes.length<4)fail('Missing miptexture directory.');
 const v=dv(bytes),n=v.getInt32(0,true);
 if(n<0||n>MAX_TEXTURES||4+n*4>bytes.length)fail('Invalid texture directory.');
 const base=4+n*4,offsets=Array.from({length:n},(_,i)=>v.getInt32(4+4*i,true));
 const nonempty=offsets.filter(p=>p>=0).sort((a,b)=>a-b);
 if(new Set(nonempty).size!==nonempty.length)fail('Duplicated miptexture offset.');
 for(const p of offsets)if(p!==-1&&(p<base||p+40>bytes.length))fail('Out-of-bounds miptexture entry.');
 return offsets.map(p=>{
  if(p===-1)return {name:'',width:0,height:0,external:true,raw:null};
  const end=nonempty.find(next=>next>p)??bytes.length,raw=bytes.slice(p,end),r=dv(raw);
  const name=utf8(raw.subarray(0,16)),width=r.getUint32(16,true),height=r.getUint32(20,true),mip=r.getUint32(24,true);
  if(!name||width<1||height<1||width>2048||height>2048||width*height>4_194_304)fail(`Invalid miptexture ${name||'(empty)'}.`);
  if(mip>0){
   const mip3=r.getUint32(36,true),palsize=Math.max(1,width>>3)*Math.max(1,height>>3),at=mip3+palsize;
   if(mip<40||mip+width*height>raw.length||mip3<40||at+2>raw.length)fail(`Truncated embedded miptexture ${name}.`);
   const colors=r.getUint16(at,true);
   if(colors<1||colors>256||at+2+colors*3>raw.length)fail(`Invalid palette for texture ${name}.`);
  }
  return {name,width,height,external:mip===0,raw};
 });
}
function packTextures(entries:Tex[]):Uint8Array{
 const n=entries.length,head=4+n*4;let cursor=align(head);
 const positions=entries.map(t=>{if(!t.raw)return -1;const at=cursor;cursor=align(cursor+t.raw.length);return at});
 if(cursor>16*1024*1024)fail('Texture lump exceeds 16 MB for this stage.');
 const output=new Uint8Array(cursor),v=dv(output);v.setInt32(0,n,true);
 entries.forEach((t,i)=>{v.setInt32(4+4*i,positions[i],true);if(t.raw)output.set(t.raw,positions[i])});
 return output;
}
class Image {
 chunks:Uint8Array[][];
 lengths:number[];
 original:Uint8Array[];
 constructor(readonly document:NativeBsp){
  this.original=document.lumps.map(l=>new Uint8Array(document.source,l.offset,l.length).slice());
  this.chunks=this.original.map(x=>[x]);
  this.lengths=this.original.map(x=>x.length);
 }
 get(id:number){return this.original[id]}
 count(id:number){const stride=STRIDES[id];if(!stride)fail(`No fixed-size record for lump ${id}.`);const len=this.lengths[id];if(len%stride)fail(`Lump ${id} has invalid record size.`);return len/stride}
 originalCount(id:number){if(this.get(id).length%STRIDES[id])fail(`Source lump ${id} has invalid stride.`);return this.get(id).length/STRIDES[id]}
 record(id:number,index:number){const stride=STRIDES[id];if(!stride||!Number.isInteger(index)||index<0||index>=this.originalCount(id))fail(`Invalid reference ${id}[${index}].`);return this.get(id).slice(index*stride,(index+1)*stride)}
 append(id:number,record:Uint8Array){if(record.length!==STRIDES[id])fail('Wrong BSP record width.');const index=this.count(id);this.chunks[id].push(record);this.lengths[id]+=record.length;return index}
 appendRaw(id:number,bytes:Uint8Array){if(bytes.length){this.chunks[id].push(bytes);this.lengths[id]+=bytes.length}}
 replace(id:number,bytes:Uint8Array){this.chunks[id]=[bytes];this.lengths[id]=bytes.length}
 getBytes(id:number){const pieces=this.chunks[id],len=this.lengths[id];const bytes=new Uint8Array(len);let p=0;for(const part of pieces){bytes.set(part,p);p+=part.length}return bytes}
 write():ArrayBuffer{
  const parts=this.chunks.map((_,i)=>this.getBytes(i));let length=124;
  const headers=parts.map(p=>{length=align(length);const at=length;length+=p.length;return {at,len:p.length}});
  if(length>MAX_FILE)fail('BSP output exceeds 256 MB.');
  const out=new Uint8Array(length),v=dv(out);v.setInt32(0,30,true);
  headers.forEach((h,i)=>{v.setInt32(4+i*8,h.at,true);v.setInt32(8+i*8,h.len,true);out.set(parts[i],h.at)});
  return out.buffer;
 }
}
const checkCount=(image:Image,id:number,max:number)=>{const n=image.count(id);if(n>max)fail(`BSP lump ${id} index capacity exceeded (${n}/${max}).`);return n};
const copyF32Valid=(b:Uint8Array,n:number)=>{const v=dv(b);for(let i=0;i<n;i++)if(!Number.isFinite(v.getFloat32(4*i,true)))fail('Non-finite geometry coordinate.');};

export interface BspBrushModelOption {entityIndex:number;modelIndex:number;classname:string;targetname:string;faces:number}
export interface BspSubmodelReport {
 sourceEntityIndex:number; sourceModel:number; destModel:number; classname:string; targetname:string;
 faces:number; planes:number; vertices:number; edges:number; surfedges:number; nodes:number; leaves:number;
 clipnodes:number; marksurfaces:number; texinfo:number; addedTextures:number; wadTextures:number; lightmapBytes:number; unlitOffsetCorrections:number;
 warning:string;
}
/** List candidates only; final analysis may reject unsupported trees, resources or collisions. */
export function listBspBrushModels(source:NativeBsp):BspBrushModelOption[]{
 const modelLump=source.lumps[MODEL];if(modelLump.length%64)return [];
 const models=new DataView(source.source,modelLump.offset,modelLump.length),total=modelLump.length/64;
 return source.entities.flatMap((e,i)=>{
  if(i===0||nativeClassname(e)==='worldspawn')return [];
  const ref=nativeProperty(e,'model'),match=/^\*(\d+)$/.exec(ref);
  if(!match)return [];
  const number=Number(match[1]);if(number<1||number>=total)return [];
  return [{entityIndex:i,modelIndex:number,classname:nativeClassname(e),targetname:nativeProperty(e,'targetname'),faces:models.getInt32(number*64+60,true)}];
 });
}
/** Analyze/copy one compiled submodel. Produces a verified new BSP; both inputs are untouched. */
export function transferBspSubmodel(dest:NativeBsp,source:NativeBsp,entityIndex:number,options:{wadFiles?:readonly Uint8Array[]}={}):{bytes:ArrayBuffer;report:BspSubmodelReport}{
 if(dest.source.byteLength>LIMIT||source.source.byteLength>LIMIT)fail('This first stage accepts BSP files up to 64 MB each.');
 // Re-check both inputs, including custom BSPX/trailing data and edited entity state.
 readNativeBsp(source.source);
 const current=readNativeBsp(writeNativeBsp(dest));
 const input=readNativeBsp(source.source),s=new Image(input),d=new Image(current);
 if(!Number.isInteger(entityIndex)||entityIndex<1||entityIndex>=input.entities.length)fail('Select a source brush-model entity.');
 for(const id of [PLANE,VERT,NODE,INFO,FACE,CLIP,LEAF,MARK,EDGE,SURF,MODEL]){s.count(id);d.count(id)}
 if(!d.count(MODEL)||!s.count(MODEL))fail('Missing BSP models.');
 const ent=input.entities[entityIndex],ref=nativeProperty(ent,'model'),match=/^\*(\d+)$/.exec(ref);
 if(nativeClassname(ent)==='worldspawn')fail('Worldspawn may never be transferred as a submodel.');
 if(!match)fail('Selected entity is not a compiled brush model.');
 const sourceModel=Number(match![1]),destModel=d.count(MODEL);
 if(!sourceModel||sourceModel>=s.count(MODEL))fail('Cannot transfer worldspawn or an invalid model index.');
 if(input.entities.filter(e=>nativeProperty(e,'model')===ref).length!==1)fail('Shared source brush-model references are not supported.');
 if(ent.pairs.filter(p=>p.key==='model').length!==1)fail('Model key must be unique.');
 if(current.entities.length>=32768)fail('Entity limit reached.');
 const target=nativeProperty(ent,'targetname');
 if(target&&current.entities.some(e=>nativeProperty(e,'targetname')===target))fail(`Duplicate targetname "${target}". Rename it in the source before transfer.`);
 const originalModel=s.record(MODEL,sourceModel),mv=dv(originalModel);
 copyF32Valid(originalModel,9);
 const firstFace=mv.getInt32(56,true),faceCount=mv.getInt32(60,true);
 if(firstFace<0||faceCount<1||faceCount>MAX_FACES||firstFace+faceCount>s.count(FACE))fail('Model face range is empty or exceeds the 2,048-face transfer limit.');
 if(destModel>4095||d.count(FACE)+faceCount>u16max)fail('Model or face index limit exceeded.');
 const sourceTextures=readTextures(s.get(TEXTURE)),destTextures=readTextures(d.get(TEXTURE)),extraTextures:Tex[]=[];
 const textureMap=new Map<number,number>();
 const providedWads=options.wadFiles??[];
 let wadTextures=0;
 const useTexture=(index:number)=>{
  const prev=textureMap.get(index);if(prev!==undefined)return prev;
  const src=sourceTextures[index];if(!src?.raw)fail(`Face references invalid texture #${index}.`);
  const sameName=destTextures.findIndex(t=>t.raw&&t.name.toLowerCase()===src.name.toLowerCase());
  const priorAdded=extraTextures.findIndex(t=>t.name.toLowerCase()===src.name.toLowerCase());
  let result:number;
  if(sameName>=0){
   const old=destTextures[sameName];
   if(old.width!==src.width||old.height!==src.height||old.external!==src.external||(!old.external&&!same(old.raw!,src.raw!)))fail(`Texture name collision with different contents: ${src.name}.`);
   result=sameName;
  }else if(priorAdded>=0){result=destTextures.length+priorAdded}
  else{
   let selected=src;
   if(src.external){
    const found=findMipTextureInWads(providedWads,src.name,src.width,src.height);
    if(!found)throw new MissingBspWadTextureError(src.name,providedWads.length>0);
    selected={name:src.name,width:src.width,height:src.height,external:false,raw:found.raw};
    wadTextures++;
   }
   if(destTextures.length+extraTextures.length>=MAX_TEXTURES)fail('Miptexture limit exceeded.');
   extraTextures.push(selected);result=destTextures.length+extraTextures.length-1;
  }
  textureMap.set(index,result);return result;
 };
 const maps=new Map<number,Map<number,number>>();
 const getMap=(id:number)=>{let m=maps.get(id);if(!m){m=new Map();maps.set(id,m)}return m};
 const reserve=(id:number,old:number,update?:(copy:Uint8Array)=>void)=>{
  const m=getMap(id),hit=m.get(old);if(hit!==undefined)return hit;
  const r=s.record(id,old);update?.(r);const next=d.append(id,r);m.set(old,next);
  return next;
 };
 const plane=(idx:number)=>{
  const p=s.record(PLANE,idx);copyF32Valid(p,4);
  const n=reserve(PLANE,idx);if(n>u16max)fail('Face plane index exceeds 16-bit capacity.');return n;
 };
 const vertex=(idx:number)=>reserve(VERT,idx,copy=>copyF32Valid(copy,3));
 const edge=(idx:number)=>reserve(EDGE,idx,copy=>{
  const v=dv(copy),a=vertex(v.getUint16(0,true)),b=vertex(v.getUint16(2,true));
  if(a>u16max||b>u16max)fail('Vertex index exceeds 16-bit capacity.');
  v.setUint16(0,a,true);v.setUint16(2,b,true);
 });
 const texinfo=(idx:number)=>reserve(INFO,idx,copy=>{
  copyF32Valid(copy,8);
  const v=dv(copy);v.setInt32(32,useTexture(v.getInt32(32,true)),true);
 });
 let lightmapBytes=0,unlitOffsetCorrections=0;
 const moveLight=(face:Uint8Array,oldFace:Uint8Array,infoIdx:number,edgeValues:number[],faceIdx:number)=>{
  const old=dv(oldFace),out=dv(face),ofs=old.getInt32(16,true);
  const styles=Array.from({length:4},(_,i)=>old.getUint8(12+i));
  // In GoldSrc 255 means "unused style"; the engine stops at the FIRST 255.
  // Some compiler output has an unused (non--1) lightofs even when all four
  // styles are 255. That offset is not live data and must NEVER be copied or
  // left pointing into the *destination* lighting lump.
  if(ofs< -1)fail(`Invalid lighting offset at face #${faceIdx}: ${ofs}.`);
  if(styles[0]===255&&styles.every(style=>style===255)){
   if(ofs!==-1){out.setInt32(16,-1,true);unlitOffsetCorrections++}
   return;
  }
  if(styles.some((val,i)=>val!==255&&styles.slice(0,i).includes(255)))
   throw new InvalidBspLightstylesError(faceIdx,styles,ofs);
  if(ofs===-1)return; // Compiled unlit face: no lightmap to transplant.
  const active=styles.filter(n=>n!==255).length;
  const srcInfo=dv(s.record(INFO,infoIdx));
  const min=[Infinity,Infinity],max=[-Infinity,-Infinity];
  for(const signedEdge of edgeValues){
   const edgeBytes=s.record(EDGE,Math.abs(signedEdge)),ev=dv(edgeBytes);
   const pos=s.record(VERT,ev.getUint16(signedEdge<0?2:0,true)),p=dv(pos);
   for(let axis=0;axis<2;axis++){
    const base=axis*16;
    const val=p.getFloat32(0,true)*srcInfo.getFloat32(base,true)+p.getFloat32(4,true)*srcInfo.getFloat32(base+4,true)+p.getFloat32(8,true)*srcInfo.getFloat32(base+8,true)+srcInfo.getFloat32(base+12,true);
    if(!Number.isFinite(val))fail('Non-finite lightmap texture coordinates.');
    min[axis]=Math.min(min[axis],val);max[axis]=Math.max(max[axis],val);
   }
  }
  const w=Math.ceil(max[0]/16)-Math.floor(min[0]/16)+1,h=Math.ceil(max[1]/16)-Math.floor(min[1]/16)+1;
  if(w<1||h<1||w>256||h>256||w*h*3*active>2*1024*1024)fail('Unsupported lightmap extents.');
  const size=w*h*3*active,lit=s.get(LIGHT);
  if(ofs+size>lit.length)fail('Truncated face lightmap.');
  const newOffset=d.lengths[LIGHT];
  d.appendRaw(LIGHT,lit.slice(ofs,ofs+size));out.setInt32(16,newOffset,true);lightmapBytes+=size;
 };
 const firstNewFace=d.count(FACE),faceIndex=(sourceIdx:number)=>{
  if(sourceIdx<firstFace||sourceIdx>=firstFace+faceCount)fail('Hull references a face outside the selected model.');
  return firstNewFace+sourceIdx-firstFace;
 };
 for(let faceIdx=firstFace;faceIdx<firstFace+faceCount;faceIdx++){
  const raw=s.record(FACE,faceIdx),copy=raw.slice(),f=dv(raw),v=dv(copy);
  const first=f.getInt32(4,true),count=f.getUint16(8,true),oldInfo=f.getUint16(10,true);
  if(count<3||count>512||first<0||first+count>s.count(SURF))fail(`Malformed face ${faceIdx}.`);
  v.setUint16(0,plane(f.getUint16(0,true)),true);
  v.setUint16(10,texinfo(oldInfo),true);
  const startNewSurf=d.count(SURF),signedEdges:number[]=[];
  for(let i=0;i<count;i++){
   const signed=dv(s.record(SURF,first+i)).getInt32(0,true);
   if(signed===-2147483648)fail('Invalid signed edge index.');
   signedEdges.push(signed);
   const moved=edge(Math.abs(signed));
   if(moved>2147483647)fail('Too many edges.');
   const bytes=new Uint8Array(4);dv(bytes).setInt32(0,signed<0?-moved:moved,true);d.append(SURF,bytes);
  }
  v.setInt32(4,startNewSurf,true);
  moveLight(copy,raw,oldInfo,signedEdges,faceIdx);
  d.append(FACE,copy);
 }
 const mapLeaf=getMap(LEAF),mapNode=getMap(NODE),mapClip=getMap(CLIP);
 const inNode=new Set<number>(),inClip=new Set<number>();
 const leaf=(index:number):number=>{
  const prior=mapLeaf.get(index);if(prior!==undefined)return prior;
  if(mapLeaf.size>=MAX_RECORDS)fail('Leaf graph exceeds safe size.');
  const bytes=s.record(LEAF,index),v=dv(bytes),first=v.getUint16(20,true),count=v.getUint16(22,true);
  if(first+count>s.count(MARK))fail('Invalid leaf marksurface span.');
  const start=d.count(MARK);
  for(let i=0;i<count;i++){
   const face=dv(s.record(MARK,first+i)).getUint16(0,true);
   const destFace=faceIndex(face),b=new Uint8Array(2);dv(b).setUint16(0,destFace,true);d.append(MARK,b);
  }
  if(start>u16max)fail('Marksurface index overflow.');
  v.setUint16(20,start,true);v.setInt32(4,-1,true); // PVS is world-scoped: do not reuse source vis offsets.
  const idx=d.append(LEAF,bytes);if(idx>signedMax)fail('Leaf child reference exceeds signed 16-bit capacity.');
  mapLeaf.set(index,idx);return idx;
 };
 const node=(index:number):number=>{
  if(inNode.has(index))fail('Cyclic BSP node graph.');
  const prior=mapNode.get(index);if(prior!==undefined)return prior;
  if(mapNode.size>=MAX_RECORDS)fail('Node graph exceeds safe size.');
  inNode.add(index);
  const bytes=s.record(NODE,index),v=dv(bytes),pl=v.getInt32(0,true),first=v.getUint16(20,true),count=v.getUint16(22,true);
  if(count&& (first<firstFace||first+count>firstFace+faceCount))fail('Node faces extend outside selected model.');
  const idx=d.append(NODE,bytes);mapNode.set(index,idx);if(idx>signedMax)fail('Node child reference exceeds signed 16-bit capacity.');
  v.setInt32(0,plane(pl),true);v.setUint16(20,count?faceIndex(first):firstNewFace,true);
  for(const off of [4,6]){
   const child=v.getInt16(off,true),moved=child>=0?node(child):-leaf(-child-1)-1;
   if(moved<-32768||moved>32767)fail('Node child index overflow.');v.setInt16(off,moved,true);
  }
  inNode.delete(index);return idx;
 };
 const clip=(index:number):number=>{
  if(inClip.has(index))fail('Cyclic collision hull.');
  const prior=mapClip.get(index);if(prior!==undefined)return prior;
  if(mapClip.size>=MAX_RECORDS)fail('Collision graph exceeds safe size.');
  inClip.add(index);
  const bytes=s.record(CLIP,index),v=dv(bytes),idx=d.append(CLIP,bytes);
  mapClip.set(index,idx);if(idx>signedMax)fail('Collision clipnode index overflow.');
  v.setInt32(0,plane(v.getInt32(0,true)),true);
  for(const off of [4,6]){
   const child=v.getInt16(off,true),moved=child<0?child:clip(child);
   if(moved>signedMax)fail('Collision child index overflow.');v.setInt16(off,moved,true);
  }
  inClip.delete(index);return idx;
 };
 const newModel=originalModel.slice(),newMV=dv(newModel),hull0=mv.getInt32(36,true);
 if(hull0<0)fail('Model hull 0 has no BSP node tree.');
 newMV.setInt32(36,node(hull0),true);
 for(const off of [40,44,48]){
  const root=mv.getInt32(off,true);newMV.setInt32(off,root<0?root:clip(root),true);
 }
 newMV.setInt32(56,firstNewFace,true);newMV.setInt32(60,faceCount,true);
 d.append(MODEL,newModel);
 if(extraTextures.length)d.replace(TEXTURE,packTextures([...destTextures,...extraTextures]));
 const modelPair=ent.pairs.find(p=>p.key==='model')!;
 const cloned=ent.raw.slice(0,modelPair.valueStart)+`*${destModel}`+ent.raw.slice(modelPair.valueEnd);
 const entityText=current.entities.map(e=>e.leading+e.raw).join('')+'\n'+cloned+current.trailing+'\0';
 const bytes=latin1(entityText);
 if(bytes.length>2*1024*1024)fail('Entity lump exceeds 2 MB.');
 d.replace(ENTI,bytes);
 checkCount(d,VERT,u16max+1);checkCount(d,EDGE,1_000_000);checkCount(d,PLANE,u16max+1);
 checkCount(d,INFO,u16max+1);checkCount(d,FACE,u16max+1);checkCount(d,NODE,signedMax+1);
 checkCount(d,CLIP,signedMax+1);checkCount(d,LEAF,signedMax+1);checkCount(d,MARK,u16max+1);
 checkCount(d,SURF,800_000);checkCount(d,MODEL,4096);
 const output=d.write(),verified=readNativeBsp(output);
 const newEntity=verified.entities.at(-1);
 if(verified.entities.length!==current.entities.length+1||!newEntity||nativeProperty(newEntity,'model')!==`*${destModel}`)fail('New entity/model reference failed verification.');
 for(const id of [4])if(!same(d.get(id),new Uint8Array(output,verified.lumps[id].offset,verified.lumps[id].length)))fail(`Unrelated lump ${id} changed.`);
 const view=parseBsp(output,'transferred.bsp');
 if(view.stats.models!==destModel+1||view.faces.filter(f=>f.model===destModel).length!==faceCount)fail('BSP Viewer could not read all transplanted faces.');
 const report:BspSubmodelReport={sourceEntityIndex:entityIndex,sourceModel,destModel,classname:nativeClassname(ent),targetname:target,faces:faceCount,
  planes:getMap(PLANE).size,vertices:getMap(VERT).size,edges:getMap(EDGE).size,surfedges:d.count(SURF)-d.originalCount(SURF),
  nodes:mapNode.size,leaves:mapLeaf.size,clipnodes:mapClip.size,marksurfaces:d.count(MARK)-d.originalCount(MARK),
  texinfo:getMap(INFO).size,addedTextures:extraTextures.length,wadTextures,lightmapBytes,unlitOffsetCorrections,
  warning:'Worldspawn, source PVS/visibility and point entities were not transferred. The model stays at its original coordinates. Source leaf VIS offsets are reset; world VIS lump is unchanged. Verify the copy in Sven Co-op.'};
 return {bytes:output,report};
}
