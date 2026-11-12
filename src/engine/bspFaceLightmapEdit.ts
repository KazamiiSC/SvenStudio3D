/** BSP30 face lightmap editing: keeps every original layer/style and only
 * appends replacements for explicitly edited faces. Never computes new shadows.
 * No mutation of the supplied source; caller compacts the resulting copy. */
import {parseBsp,type BspFace,type BspMap} from './bsp.ts';
import {bspOriginalFaceIndex} from './bspFaceSelection.ts';
import {readNativeBsp} from './bspNativeEdit.ts';

export interface BspLightmapAdjustment {gain:number;add:number;tint:[number,number,number];copyFrom?:number}
export type BspLightmapOverrides=Record<number,BspLightmapAdjustment>;
const MAX_EDITS=1024,MAX_APPEND=32*1024*1024,MAX_BYTES=256*1024*1024;
const eq=(a:Uint8Array,b:Uint8Array)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
const getFace=(map:BspMap,index:number)=>map.faces.find((f,i)=>bspOriginalFaceIndex(f,i)===index);
const validStyle=(face:BspFace)=>!!face.lightLayers?.length&&face.lightStyles?.length===face.lightLayers.length&&
 face.lightWidth>0&&face.lightHeight>0&&face.lightWidth<=256&&face.lightHeight<=256&&
 face.lightLayers.every(layer=>layer.length===face.lightWidth*face.lightHeight*3)&&
 Number.isInteger(face.lightmapOffset)&&face.lightmapOffset!>=0;
export function bspCanEditFaceLightmap(face:BspFace|undefined):boolean{return !!face&&validStyle(face)}
export function bspValidateLightmapAdjustment(map:BspMap,id:number,adjustment:BspLightmapAdjustment):void{
 const f=getFace(map,id);
 if(!bspCanEditFaceLightmap(f))throw Error(`Face #${id} has no readable RGB lightmap layers.`);
 if(!Number.isFinite(adjustment.gain)||adjustment.gain<0||adjustment.gain>4||
   !Number.isFinite(adjustment.add)||adjustment.add< -64||adjustment.add>64||
   !Array.isArray(adjustment.tint)||adjustment.tint.length!==3||adjustment.tint.some(v=>!Number.isFinite(v)||v<0||v>1))
   throw Error('Invalid lightmap color, gain or brightness offset.');
 if(adjustment.copyFrom!==undefined){
   const from=getFace(map,adjustment.copyFrom);
   if(!bspCanEditFaceLightmap(from)||!from||!f)throw Error('Source face has no readable lightmap.');
   if(from.lightWidth!==f.lightWidth||from.lightHeight!==f.lightHeight||
     from.lightStyles?.length!==f.lightStyles?.length||
     from.lightStyles?.some((style,i)=>style!==f.lightStyles?.[i]))
     throw Error('Pasted lightmap must have identical sample dimensions and lightstyles.');
 }
}
export function bspLightmapLayersForFace(map:BspMap,id:number,adjustment:BspLightmapAdjustment):Uint8Array[]{
 bspValidateLightmapAdjustment(map,id,adjustment);
 const face=getFace(map,id)!;
 const source=adjustment.copyFrom===undefined?face:getFace(map,adjustment.copyFrom)!;
 return source.lightLayers!.map(layer=>{
   const out=new Uint8Array(layer.length);
   for(let p=0;p<layer.length;p++){
     const channel=p%3;
     out[p]=Math.max(0,Math.min(255,Math.round(layer[p]*adjustment.gain*adjustment.tint[channel]+adjustment.add)));
   }
   return out;
 });
}
export function bspPreviewFaceLightmaps(map:BspMap,changes:BspLightmapOverrides):BspMap{
 if(!Object.keys(changes).length)return map;
 return {...map,faces:map.faces.map((face,i)=>{
   const adjustment=changes[bspOriginalFaceIndex(face,i)];if(!adjustment)return face;
   const layers=bspLightmapLayersForFace(map,bspOriginalFaceIndex(face,i),adjustment);
   const zero=face.lightStyles?.indexOf(0)??-1;
   return {...face,lightLayers:layers,lightRgb:layers[zero>=0?zero:0]};
 })};
}
export function bspLightmapAdjustmentDefault():BspLightmapAdjustment{return {gain:1,add:0,tint:[1,1,1]}}
export function writeBspFaceLightmaps(input:ArrayBuffer,changes:BspLightmapOverrides):ArrayBuffer{
 const ids=Object.keys(changes).map(Number).sort((a,b)=>a-b);
 if(!ids.length)return input.slice(0);
 if(ids.length>MAX_EDITS||ids.some(id=>!Number.isSafeInteger(id)||id<0))throw Error('Too many edited BSP lightmap faces.');
 const native=readNativeBsp(input),map=parseBsp(input,'lightmap-before.bsp'),faces=native.lumps[7],light=native.lumps[8];
 if(map.warnings.some(w=>/malformed faces were skipped/i.test(w))||faces.length%20)throw Error('Malformed BSP faces: cannot edit lightmaps.');
 const payloads=ids.map(id=>({id,layers:bspLightmapLayersForFace(map,id,changes[id])}));
 const total=payloads.reduce((sum,item)=>sum+item.layers.reduce((n,a)=>n+a.length,0),0);
 if(total>MAX_APPEND)throw Error('Lightmap edit exceeds the 32 MiB safety limit.');
 const at=(input.byteLength+3)&~3,bytes=new ArrayBuffer(at+light.length+total);
 if(bytes.byteLength>MAX_BYTES)throw Error('BSP exceeds the 256 MiB size limit.');
 const dst=new Uint8Array(bytes),dv=new DataView(bytes),original=new DataView(input);
 dst.set(new Uint8Array(input));dst.set(new Uint8Array(input,light.offset,light.length),at);
 let pos=light.length;
 for(const {id,layers} of payloads){
   const face=getFace(map,id)!;
   if(id>=faces.length/20||original.getInt32(faces.offset+id*20+16,true)!==face.lightmapOffset)
     throw Error(`Face #${id} lightmap pointer differs from parsed source.`);
   dv.setInt32(faces.offset+id*20+16,pos,true);
   for(const layer of layers){dst.set(layer,at+pos);pos+=layer.length;}
 }
 dv.setInt32(4+8*8,at,true);dv.setInt32(8+8*8,light.length+total,true);
 const verified=readNativeBsp(bytes),reopen=parseBsp(bytes,'lightmap-after.bsp');
 for(let i=0;i<15;i++)if(i!==7&&i!==8){
   const old=native.lumps[i],next=verified.lumps[i];
   if(old.length!==next.length||!eq(new Uint8Array(input,old.offset,old.length),new Uint8Array(bytes,next.offset,next.length)))
     throw Error(`Unedited BSP lump #${i} was modified.`);
 }
 if(!eq(new Uint8Array(input,light.offset,light.length),new Uint8Array(bytes,verified.lumps[8].offset,light.length)))
   throw Error('Original lightmap samples changed.');
 const edits=new Set(ids);
 for(let i=0;i<faces.length/20;i++){
   const old=new Uint8Array(input,faces.offset+i*20,20),next=new Uint8Array(bytes,faces.offset+i*20,20);
   if(!edits.has(i)&&!eq(old,next))throw Error(`Unselected face #${i} was modified.`);
   if(edits.has(i)&&!eq(old.subarray(0,16),next.subarray(0,16)))throw Error(`Face #${i} geometry/styles were modified.`);
 }
 for(const {id,layers} of payloads){
   const face=getFace(reopen,id);
   if(!face||face.lightLayers?.length!==layers.length||layers.some((a,j)=>!eq(a,face.lightLayers![j])))
     throw Error(`Face #${id} lightmap did not survive BSP reimport.`);
 }
 return bytes;
}
