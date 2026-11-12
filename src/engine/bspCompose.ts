/** Safe first stage of BSP composition: point-entity transplantation only.
 * Never copies BSP model pointers, geometry, collision hulls, PVS or lightmaps.
 */
import {nativeProperty,readNativeBsp,type NativeBsp,type NativeEntity} from './bspNativeEdit';

const MAX_IMPORT = 4096;
const TARGET_KEYS = new Set(['target','killtarget','master','netname']);
const POSITION_KEYS = new Set(['origin']);
const formatNum = (n:number) => Object.is(n,-0)?'0':Number(n.toFixed(4)).toString();
const field = (ent:NativeEntity,key:string)=>nativeProperty(ent,key);
const hasBrushModel = (ent:NativeEntity)=>ent.pairs.some(p=>p.key==='model'&&/^\*\d+$/.test(p.value));
function vec(text:string):number[]|null{
 const parts=text.trim().split(/\s+/).map(Number);
 return parts.length===3&&parts.every(Number.isFinite)?parts:null;
}
function esc(text:string){return text.replaceAll('\\','\\\\').replaceAll('"','\\"')}
function validOffset(offset:readonly number[]){
 if(offset.length!==3||!offset.every(n=>Number.isFinite(n)&&Math.abs(n)<=32768))throw Error('Invalid offset; use three finite coordinates within ±32768.');
}
export interface BspComposePreview {eligible:number;skippedModels:number;skippedWorld:number;badOrigins:number;renamedTargets:number;conflicts:number;warnings:string[]}
/** In preview mode no data is mutated. Entity limit and output size are checked again on export. */
export function previewPointImport(dest:NativeBsp,source:NativeBsp,offset:readonly number[],prefix:string):BspComposePreview{
 validOffset(offset);
 if(!/^[A-Za-z0-9_]{0,32}$/.test(prefix))throw Error('Prefix must contain up to 32 ASCII letters, digits or underscores.');
 const occupied=new Set(dest.entities.flatMap(e=>e.pairs.filter(p=>p.key==='targetname').map(p=>p.value)));
 const incoming=source.entities.slice(1).filter(e=>!hasBrushModel(e));
 const sourceNames=new Set(incoming.map(e=>field(e,'targetname')).filter(Boolean));
 const duplicates=new Set<string>();
 const names=new Set<string>();let conflicts=0;
 for(const name of sourceNames){const result=prefix+name;if(occupied.has(result))conflicts++;if(names.has(result))duplicates.add(result);names.add(result)}
 const badOrigins=incoming.filter(e=>{const o=field(e,'origin');return o&&!vec(o)}).length;
 const warnings:string[]=[];
 if(conflicts)warnings.push('Imported targetnames collide with destination targetnames. Use a unique prefix.');
 if(badOrigins)warnings.push('Some point entities have nonnumeric origin values and cannot be moved safely.');
 if(dest.entities.length+incoming.length>32768)warnings.push('Combined entity count exceeds the BSP safety limit.');
 if(!prefix&&sourceNames.size)warnings.push('No prefix: connections may resolve to entities already present in the destination.');
 return {eligible:incoming.length,skippedModels:source.entities.slice(1).filter(hasBrushModel).length,skippedWorld:1,badOrigins,renamedTargets:sourceNames.size,conflicts,warnings};
}
export function importPointEntities(dest:NativeBsp,source:NativeBsp,offset:readonly number[],prefix:string):NativeBsp{
 const report=previewPointImport(dest,source,offset,prefix);
 if(report.eligible>MAX_IMPORT)throw Error('Import limit is 4096 point entities per operation.');
 if(report.conflicts||report.badOrigins||dest.entities.length+report.eligible>32768)throw Error(report.warnings.join(' '));
 const imported=source.entities.slice(1).filter(e=>!hasBrushModel(e));
 const internalNames=new Set(imported.map(e=>field(e,'targetname')).filter(Boolean));
 const additions=imported.map(ent=>{
  const pairs=ent.pairs.map(p=>{
   let value=p.value;
   if(POSITION_KEYS.has(p.key)&&value){
    const v=vec(value);if(!v)throw Error('Invalid point origin.');
    const moved=v.map((n,i)=>n+offset[i]);
    if(moved.some(n=>!Number.isFinite(n)||Math.abs(n)>131072))throw Error('Point origin exceeds safe map coordinate bounds.');
    value=moved.map(formatNum).join(' ');
   }
   if(p.key==='targetname'&&internalNames.has(value))value=prefix+value;
   else if(TARGET_KEYS.has(p.key)&&internalNames.has(value))value=prefix+value;
   if(/["\r\n\0]/.test(value)||value.length>1024)throw Error('Invalid imported value.');
   return `"${esc(p.key)}" "${esc(value)}"`;
  });
  // Re-parse using the existing strict BSP entity parser; prevents invalid imported keys.
  return '{\n'+pairs.join('\n')+'\n}';
 });
 // Temporary entity lump, passed through the strict BSP parser and exporter.
 const text=dest.entities.map(e=>e.leading+e.raw).join('')+additions.map(raw=>'\n'+raw).join('')+dest.trailing;
 const encoder=new Uint8Array(text.length+1);
 for(let i=0;i<text.length;i++){
  const n=text.charCodeAt(i);if(n>255)throw Error('BSP contains non-Latin-1 entity text.');encoder[i]=n;
 }
 // Preserve original BSP lumps: append a new entity lump and load it via the canonical parser.
 const aligned=(dest.source.byteLength+3)&~3;
 if(encoder.length>2*1024*1024||aligned+encoder.length>256*1024*1024)throw Error('Combined BSP exceeds entity or file size limit.');
 const bytes=new Uint8Array(aligned+encoder.length);bytes.set(new Uint8Array(dest.source));bytes.set(encoder,aligned);
 const dv=new DataView(bytes.buffer);dv.setInt32(4,aligned,true);dv.setInt32(8,encoder.length,true);
 const parsed=readNativeBsp(bytes.buffer);
 // Keep source unchanged; the exported BSP carries the modified entities as canonical baseline.
 // Mark baseline changed by keeping the initial dest source, with the parsed entity set.
 return {...dest,entities:parsed.entities,trailing:parsed.trailing};
}
