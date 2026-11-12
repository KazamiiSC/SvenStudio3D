/** Native BSP30 entity-lump editor. Does NOT decompile, reorder or rewrite geometry lumps.
 * Strict input validation, lossless retention of untouched entity blocks, and copy-on-export.
 */
export interface NativePair {key:string;value:string;valueStart:number;valueEnd:number;pairStart:number;pairEnd:number}
export interface NativeEntity {leading:string;raw:string;pairs:NativePair[]}
export interface NativeBsp {source:ArrayBuffer;entities:NativeEntity[];trailing:string;originalText:string;lumps:{offset:number;length:number}[]}
const MAX_SIZE=256*1024*1024,MAX_ENTITY_LUMP=2*1024*1024,MAX_ENTITIES=32768;
const latin1=(bytes:Uint8Array)=>{let result='';for(let p=0;p<bytes.length;p+=8192)result+=String.fromCharCode(...bytes.subarray(p,p+8192));return result};
function quoted(raw:string,pos:number):{value:string;start:number;end:number;next:number}{
  if(raw[pos]!=='"')throw Error(`BSP keyvalue syntax error at ${pos}: expected quote.`);
  const start=pos+1;let val='';pos++;
  for(;pos<raw.length;pos++){
    const c=raw[pos];if(c==='"')return {value:val,start,end:pos,next:pos+1};
    if(c==='\\'&&(raw[pos+1]==='"'||raw[pos+1]==='\\')){val+=raw[++pos];continue}
    if(c==='\0'||c==='\n'||c==='\r')throw Error('Invalid newline / NUL inside BSP keyvalue.');
    val+=c;
  }
  throw Error('Unterminated BSP keyvalue string.');
}
function whitespace(s:string,from:number){let i=from;for(;;){
  while(i<s.length&&/\s/.test(s[i]))i++;
  if(s.slice(i,i+2)==='//'){const end=s.indexOf('\n',i+2);i=end<0?s.length:end+1;continue}
  return i;
}}
function parseEntity(raw:string):NativePair[]{
  if(!raw.startsWith('{')||!raw.endsWith('}'))throw Error('Malformed BSP entity braces.');
  let pos=1;const pairs:NativePair[]=[];
  while((pos=whitespace(raw,pos))<raw.length-1){
    const pairStart=pos, key=quoted(raw,pos);pos=whitespace(raw,key.next);
    const val=quoted(raw,pos);pos=val.next;
    pairs.push({key:key.value,value:val.value,valueStart:val.start,valueEnd:val.end,pairStart,pairEnd:pos});
    if(pairs.length>2048)throw Error('Too many keyvalues in BSP entity.');
  }
  if(!pairs.some(pair=>pair.key==='classname'))throw Error('BSP entity without classname.');
  return pairs;
}
function parseText(text:string):{entities:NativeEntity[];trailing:string}{
  const entities:NativeEntity[]=[];let pos=0;
  while(true){
    const start=whitespace(text,pos);if(start===text.length)return {entities,trailing:text.slice(pos)};
    if(text[start]!=='{')throw Error('BSP entity lump contains unexpected text.');
    let i=start+1,inQuote=false,escaped=false;
    for(;i<text.length;i++){
      const c=text[i];
      if(inQuote){if(escaped){escaped=false;continue}if(c==='\\'&&(text[i+1]==='"'||text[i+1]==='\\')){escaped=true;continue}if(c==='"')inQuote=false;continue}
      if(c==='"'){inQuote=true;continue}if(c==='}')break;
      if(c==='{')throw Error('Nested BSP entity block.');
    }
    if(i>=text.length)throw Error('Unclosed BSP entity.');
    const raw=text.slice(start,i+1);
    entities.push({leading:text.slice(pos,start),raw,pairs:parseEntity(raw)});
    if(entities.length>MAX_ENTITIES)throw Error('BSP entity count exceeds safe limit.');
    pos=i+1;
  }
}
function toByteArray(text:string):Uint8Array{
  const out=new Uint8Array(text.length);for(let i=0;i<text.length;i++){
    const code=text.charCodeAt(i);if(code>255)throw Error('BSP entity text cannot encode Unicode above Latin-1; use ASCII identifiers.');
    out[i]=code;
  }return out;
}
function checkUserField(text:string,isKey:boolean){
  if((isKey?!/^[A-Za-z_][A-Za-z0-9_.$-]{0,63}$/.test(text):text.length>1024||/["\r\n\0]/.test(text)))
    throw Error(isKey?'Property keys must be 1–64 ASCII letters, digits or _. $ - characters.':'Property values must be at most 1024 Latin-1 characters without quotes or line breaks.');
  toByteArray(text);
}
function checkEditAllowed(entity:NativeEntity,key:string){
  const cls=entity.pairs.find(p=>p.key==='classname')?.value;
  const compiledBrush=entity.pairs.some(p=>p.key==='model'&&/^\*\d+$/.test(p.value));
  if(compiledBrush&&['model','classname','origin','angles','angle','mins','maxs'].includes(key))throw Error('Compiled brush geometry references and transforms cannot be changed safely.');
  if(key==='classname'&&cls==='worldspawn')throw Error('Cannot change worldspawn classname.');
}
export function readNativeBsp(source:ArrayBuffer):NativeBsp{
  if(source.byteLength<124||source.byteLength>MAX_SIZE)throw Error('Unsupported BSP size (max 256 MB).');
  const view=new DataView(source);if(view.getInt32(0,true)!==30)throw Error('Only standard GoldSrc / Svengine BSP v30 is supported.');
  const lumps=Array.from({length:15},(_,i)=>{
    const offset=view.getInt32(4+i*8,true),length=view.getInt32(8+i*8,true);
    if(offset<0||length<0||offset>source.byteLength||length>source.byteLength-offset||(length>0&&offset<124))throw Error(`Invalid BSP lump ${i}.`);
    return {offset,length};
  });
  for(let i=0;i<15;i++)for(let j=i+1;j<15;j++){
    const a=lumps[i],b=lumps[j];if(a.length&&b.length&&a.offset<b.offset+b.length&&b.offset<a.offset+a.length)throw Error(`BSP lumps ${i}/${j} overlap; refusing to edit.`);
  }
  const end=Math.max(124,...lumps.map(l=>l.offset+l.length));
  if(source.byteLength>end+16){
    const tail=new Uint8Array(source,end);
    if(tail.some(byte=>byte!==0))throw Error('BSP contains unrecognized trailing extension data; editing is disabled to prevent corruption.');
  }
  const entity=lumps[0];if(!entity.length||entity.length>MAX_ENTITY_LUMP)throw Error('Unsupported BSP entity lump length.');
  const bytes=new Uint8Array(source,entity.offset,entity.length);
  const zero=bytes.indexOf(0),textEnd=zero<0?bytes.length:zero;
  if(zero>=0&&bytes.subarray(zero).some(byte=>byte!==0))throw Error('Unexpected nonzero data after BSP entity terminator.');
  const originalText=latin1(bytes.subarray(0,textEnd));
  const {entities,trailing}=parseText(originalText);
  if(!entities.length||entities[0].pairs.find(p=>p.key==='classname')?.value!=='worldspawn')throw Error('BSP does not start with worldspawn.');
  return {source,entities,trailing,originalText,lumps};
}
function setEntity(doc:NativeBsp,index:number,entity:NativeEntity):NativeBsp{
  return {...doc,entities:doc.entities.map((e,i)=>i===index?entity:e)};
}
export function setNativeValue(doc:NativeBsp,index:number,pairIndex:number,value:string):NativeBsp{
  checkUserField(value,false);
  const ent=doc.entities[index],pair=ent?.pairs[pairIndex];if(!pair)throw Error('Property not found.');
  checkEditAllowed(ent,pair.key);
  if(value===pair.value)return doc;
  const raw=ent.raw.slice(0,pair.valueStart)+value.replaceAll('\\','\\\\')+ent.raw.slice(pair.valueEnd);
  return setEntity(doc,index,{...ent,raw,pairs:parseEntity(raw)});
}
export function addNativeProperty(doc:NativeBsp,index:number,key:string,value:string):NativeBsp{
  checkUserField(key,true);checkUserField(value,false);
  const ent=doc.entities[index];if(!ent)throw Error('Entity not found.');
  if(key==='classname'&&ent.pairs.some(p=>p.key==='classname'))throw Error('Entity already has a classname.');
  if(key==='model'&&value.startsWith('*'))throw Error('Adding compiled brush-model references is unsafe.');
  checkEditAllowed(ent,key);
  const raw=ent.raw.slice(0,-1)+`\n"${key}" "${value.replaceAll('\\','\\\\')}"\n}`;
  return setEntity(doc,index,{...ent,raw,pairs:parseEntity(raw)});
}
export function removeNativeProperty(doc:NativeBsp,index:number,pairIndex:number):NativeBsp{
  const ent=doc.entities[index],pair=ent?.pairs[pairIndex];if(!pair)throw Error('Property not found.');
  if(pair.key==='classname')throw Error('Cannot delete classname.');checkEditAllowed(ent,pair.key);
  const raw=ent.raw.slice(0,pair.pairStart)+ent.raw.slice(pair.pairEnd);
  return setEntity(doc,index,{...ent,raw,pairs:parseEntity(raw)});
}
export function addNativeEntity(doc:NativeBsp,classname:string,origin:string='0 0 0'):NativeBsp{
  checkUserField(classname,true);checkUserField(origin,false);
  if(classname==='worldspawn')throw Error('A BSP can contain only one worldspawn.');
  if(doc.entities.length>=MAX_ENTITIES)throw Error('Entity limit reached.');
  if(origin.trim().split(/\s+/).length!==3||!origin.trim().split(/\s+/).every(v=>Number.isFinite(Number(v))))throw Error('Origin must have 3 numeric coordinates.');
  const raw=`{\n"classname" "${classname}"\n"origin" "${origin.replaceAll('\\','\\\\')}"\n}`;
  return {...doc,entities:[...doc.entities,{leading:'\n',raw,pairs:parseEntity(raw)}]};
}
export function removeNativeEntity(doc:NativeBsp,index:number):NativeBsp{
  if(index<1||index>=doc.entities.length)throw Error('Cannot remove worldspawn.');
  const entity=doc.entities[index];
  if(entity.pairs.some(p=>p.key==='model'&&/^\*\d+$/.test(p.value)))throw Error('Cannot remove a compiled brush entity without reconstructing the model.');
  return {...doc,entities:doc.entities.filter((_,i)=>i!==index)};
}
export function nativeClassname(entity:NativeEntity){return entity.pairs.find(p=>p.key==='classname')?.value||'unknown'}
export function nativeProperty(entity:NativeEntity,key:string){return entity.pairs.find(p=>p.key===key)?.value||''}
export function nativeChanged(doc:NativeBsp){return doc.entities.map(e=>e.leading+e.raw).join('')+doc.trailing!==doc.originalText}
export function writeNativeBsp(doc:NativeBsp):ArrayBuffer{
  const source=doc.source;readNativeBsp(source); // re-validate source on every export
  const text=doc.entities.map(e=>e.leading+e.raw).join('')+doc.trailing;
  if(text===doc.originalText)return source.slice(0);
  const {entities}=parseText(text);
  if(!entities.length||nativeClassname(entities[0])!=='worldspawn')throw Error('Missing worldspawn.');
  const payload=toByteArray(text+'\0');
  if(payload.byteLength>MAX_ENTITY_LUMP)throw Error('Edited entity lump exceeds the 2 MB safety limit.');
  const aligned=(source.byteLength+3)&~3;
  if(aligned+payload.byteLength>MAX_SIZE)throw Error('Edited BSP exceeds 256 MB.');
  const output=new ArrayBuffer(aligned+payload.byteLength),result=new Uint8Array(output);
  result.set(new Uint8Array(source));result.set(payload,aligned);
  const view=new DataView(output);view.setInt32(4,aligned,true);view.setInt32(8,payload.byteLength,true);
  const check=readNativeBsp(output);
  if(check.entities.length!==entities.length)throw Error('Edited BSP did not pass entity verification.');
  for(let i=1;i<15;i++){
    const {offset,length}=doc.lumps[i];
    if(check.lumps[i].offset!==offset||check.lumps[i].length!==length)throw Error(`BSP lump ${i} location changed.`);
    const before=new Uint8Array(source,offset,length),after=new Uint8Array(output,offset,length);
    for(let n=0;n<length;n++)if(before[n]!==after[n])throw Error(`BSP lump ${i} data changed unexpectedly.`);
  }
  return output;
}

/** Guarded bmodel instance copy. This is deliberately separate from point
 * duplication: a clone reuses the source model=*N and never changes BSP trees.
 * The caller must validate model limits and static class before using it. */
export function appendNativeBrushInstance(doc:NativeBsp,index:number,origin:string):NativeBsp{
  const src=doc.entities[index];
  if(!src||index<1)throw Error('Cannot copy worldspawn as a brush instance.');
  if(doc.entities.length>=MAX_ENTITIES)throw Error('Maximum BSP entity count reached.');
  const classname=nativeClassname(src);
  if(!['func_wall','func_illusionary'].includes(classname))throw Error('Only static func_wall / func_illusionary models can be instanced safely.');
  const model=nativeProperty(src,'model');
  if(!/^\*[1-9]\d*$/.test(model))throw Error('Source must reference a compiled BSP submodel, not worldspawn.');
  const numbers=origin.trim().split(/\s+/).map(Number);
  if(numbers.length!==3||numbers.some(v=>!Number.isFinite(v)||Math.abs(v)>131072))throw Error('Paste position exceeds safe BSP coordinate range.');
  const nextPairs=src.pairs.map(pair=>({key:pair.key,value:pair.key==='origin'?origin:
    pair.key==='targetname'?`${pair.value.slice(0,56)}_copy${doc.entities.length}`:pair.value}));
  if(!nextPairs.some(pair=>pair.key==='origin'))nextPairs.push({key:'origin',value:origin});
  for(const pair of nextPairs){checkUserField(pair.key,true);checkUserField(pair.value,false)}
  const raw=`{\n${nextPairs.map(pair=>`"${pair.key}" "${pair.value.replaceAll('\\','\\\\')}"`).join('\n')}\n}`;
  return {...doc,entities:[...doc.entities,{leading:'\n',raw,pairs:parseEntity(raw)}]};
}
