/** Sven Co-op AngelScript NPC import metadata and safe, read-only packaging.
 * No AngelScript execution or injection into existing game/map configs.
 */
import type {FgdClass} from './types';
export type CustomNpcScript={path:string;source:string};
export type CustomNpcDefinition={
  classname:string;description:string;modelPath:string;entryScript:string;registerFunction:string;
  scripts:CustomNpcScript[];fgd?:FgdClass;
};
/** Stable empty selector fallback for React 19 / Zustand 5.
 * Never construct [] inside a Zustand selector: useSyncExternalStore
 * requires identical snapshot references while state is unchanged.
 */
export const EMPTY_CUSTOM_NPCS: ReadonlyArray<CustomNpcDefinition> = Object.freeze([] as CustomNpcDefinition[]);
export type PackageFile={path:string;bytes:Uint8Array};
const classPattern=/^[A-Za-z_][A-Za-z0-9_]{0,95}$/;
const fnPattern=/^[A-Za-z_][A-Za-z0-9_]*(?:::[A-Za-z_][A-Za-z0-9_]*)*$/;
export function cleanPackagePath(raw:string):string{
  const original=raw.replace(/\\/g,'/').replace(/^\/+/, '');
  const parts=original.split('/');
  if(!original||original.length>240||parts.some(p=>!p||p==='.'||p==='..'||/[\x00-\x1F:"<>|?*]/.test(p)))throw Error(`Invalid package path: ${raw}`);
  return original;
}
export function scriptRelativePath(path:string){
  const clean=cleanPackagePath(path);const marker='scripts/maps/';const idx=clean.toLowerCase().indexOf(marker);
  return clean.slice(idx>=0?idx+marker.length:0);
}
export function assetRelativePath(path:string){
  const clean=cleanPackagePath(path);
  const marker=/(?:^|\/)(models|sound|sprites|gfx|events)\//i.exec(clean);
  if(!marker)throw Error(`Unknown asset directory: ${path}. Put resources in models/, sound/, sprites/, gfx/ or events/.`);
  return clean.slice(marker.index+(marker[0].startsWith('/')?1:0));
}
export function registeredCustomClassnames(scripts:CustomNpcScript[]):string[]{
  const names=new Set<string>();
  for(const script of scripts){
    const re=/g_CustomEntityFuncs\s*\.\s*RegisterCustomEntity\s*\(\s*["']([^"']+)["']\s*,\s*["']([^"']+)["']/g;
    for(const match of script.source.matchAll(re))if(classPattern.test(match[2]))names.add(match[2]);
  }
  return [...names];
}
export function hasMapInit(source:string){return /\bvoid\s+MapInit\s*\(\s*\)/.test(source)}
export function possibleRegistrationFunctions(source:string):string[]{
  return [...new Set([...source.matchAll(/\bvoid\s+([A-Za-z_][A-Za-z_0-9]*Register[A-Za-z_0-9]*|Register[A-Za-z_0-9]+)\s*\(\s*\)/g)].map(x=>x[1]))];
}
export function validateCustomNpc(def:CustomNpcDefinition):string[]{
  const errors:string[]=[];
  if(!classPattern.test(def.classname))errors.push('Invalid custom classname. Use letters, digits and underscores.');
  if(!def.scripts.length||def.scripts.length>40)errors.push('Select between 1 and 40 AngelScript source files.');
  if(def.scripts.some(s=>s.source.length>2_000_000)||def.scripts.reduce((n,s)=>n+s.source.length,0)>5_000_000)errors.push('AngelScript sources exceed the 5 MB project limit.');
  const paths=new Set<string>();
  for(const script of def.scripts){
    try {const path=scriptRelativePath(script.path).toLowerCase();if(!path.endsWith('.as'))errors.push(`Not an .as script: ${path}`);if(paths.has(path))errors.push(`Duplicate script path: ${path}`);paths.add(path)}
    catch(error){errors.push(String(error))}
  }
  let entry='';try{entry=scriptRelativePath(def.entryScript).toLowerCase()}catch{errors.push('Invalid entry script path.')}
  if(!paths.has(entry))errors.push('Entry script does not belong to the selected sources.');
  if(def.registerFunction&&!fnPattern.test(def.registerFunction))errors.push('Invalid register function (only Namespace::Function or Function).');
  if(def.modelPath&&(!/^(models)\/[\w.\-/]+\.mdl$/i.test(def.modelPath)||def.modelPath.split('/').includes('..')))errors.push('Model path must be models/.../*.mdl without parent traversal.');
  return errors;
}
export function customNpcToFgd(def:CustomNpcDefinition):FgdClass{
  return {name:def.classname,type:'point',description:def.description||'Custom AngelScript NPC',studio:def.modelPath||def.fgd?.studio,
    props:{...def.fgd?.props,targetname:{label:'Name',type:'string'}}};
}
export function customNpcWarnings(def:CustomNpcDefinition):string[]{
  const warnings:string[]=[];
  const src=def.scripts.find(s=>scriptRelativePath(s.path)===scriptRelativePath(def.entryScript))?.source||'';
  if(!hasMapInit(src)&&!def.registerFunction)warnings.push('Entry script has no MapInit and no registration function selected. Entity registration must be configured manually.');
  if(!registeredCustomClassnames(def.scripts).includes(def.classname))warnings.push('Could not confirm a literal RegisterCustomEntity call for this classname. The script may register it dynamically. Verify in Sven Co-op.');
  if(!def.modelPath)warnings.push('No model path configured. NPC preview will be unavailable.');
  if(def.scripts.some(s=>/\bPluginInit\s*\(/.test(s.source))&&!def.scripts.some(s=>hasMapInit(s.source)))warnings.push('PluginInit found without MapInit. Verify the script can be loaded as a map script; registration may require a wrapper.');
  if(def.scripts.some(s=>/#include\s*[<"]/i.test(s.source)))warnings.push('The scripts contain #include directives. Make sure every dependency is included and retains the expected relative path.');
  return warnings;
}
const encoder=new TextEncoder();
function textFile(path:string,text:string):PackageFile{return {path,bytes:encoder.encode(text)}}
/** Generated files are additive. Existing maps/<map>.cfg is never included or overwritten. */
export function customNpcFiles(def:CustomNpcDefinition,mapName:string,resources:PackageFile[]=[]):{files:PackageFile[];mapScript:string;warnings:string[]}{
  const errors=validateCustomNpc(def);if(errors.length)throw Error(errors.join('\n'));
  if(!/^[A-Za-z0-9_-]{1,64}$/.test(mapName))throw Error('Map name must contain letters, digits, _ or -.');
  const entry=scriptRelativePath(def.entryScript);
  const source=def.scripts.find(s=>scriptRelativePath(s.path)===entry)!.source;
  const dir=entry.includes('/')?entry.slice(0,entry.lastIndexOf('/')+1):'';
  let mapScript=entry.replace(/\.as$/i,'');
  const files:PackageFile[]=def.scripts.map(s=>textFile(`scripts/maps/${scriptRelativePath(s.path)}`,s.source));
  const warnings=customNpcWarnings(def);
  if(!hasMapInit(source)&&def.registerFunction){
    const bootstrap=`${dir}svenstudio_${def.classname}_bootstrap.as`;
    const relativeName=entry.slice(dir.length).replace(/\.as$/i,'');
    files.push(textFile(`scripts/maps/${bootstrap}`,`// Generated loader. Review before use.\n#include "${relativeName}"\n\nvoid MapInit()\n{\n    ${def.registerFunction}();\n}\n`));
    mapScript=bootstrap.replace(/\.as$/i,'');
  }
  for(const asset of resources){const path=assetRelativePath(asset.path);files.push({path,bytes:asset.bytes})}
  const unique=new Set<string>();for(const f of files){const path=cleanPackagePath(f.path).toLowerCase();if(unique.has(path))throw Error(`Duplicate output file: ${f.path}`);unique.add(path)}
  const line=`map_script ${mapScript}`;
  const instructions=`SvenStudio 3D — Custom NPC (${def.classname})\n\n1. Review the included third-party scripts, their licensing and dependencies.\n2. Extract package contents to Sven Co-op/svencoop_addon/ while preserving directory names.\n3. In your EXISTING map config, svencoop_addon/maps/${mapName}.cfg, append:\n\n${line}\n\nDO NOT overwrite an existing map CFG. The bundle intentionally does not contain one.\n4. Ensure your map contains an entity with classname ${def.classname}, export MAP, compile BSP and test on Sven Co-op.\n5. For missing classes or resources check console and as_listmapscriptinfo.\n\nLimitations: The editor DOES NOT execute, validate or compile AngelScript; registrations based on dynamic expressions cannot be verified statically. Model files are only included if explicitly supplied during export.\n`;
  files.push(textFile(`SVENSTUDIO_CUSTOM_NPC_INSTALL.txt`,instructions));
  files.push(textFile(`maps/${mapName}.cfg.ADD_THIS_LINE.txt`,line+'\n'));
  return {files,mapScript,warnings};
}
/** ZIP with STORE entries (no compression, no external library). Browser file downloads only. */
export function makeZip(files:PackageFile[]):Blob{
  if(files.length>1024)throw Error('Too many package files.');
  const u16=(view:DataView,pos:number,x:number)=>view.setUint16(pos,x,true);
  const u32=(view:DataView,pos:number,x:number)=>view.setUint32(pos,x>>>0,true);
  const crc32=(bytes:Uint8Array)=>{let crc=-1;for(const b of bytes){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0)}return (crc^(-1))>>>0};
  const chunks:BlobPart[]=[];const cd:BlobPart[]=[];let offset=0,centralSize=0;
  for(const file of files){
    const name=encoder.encode(cleanPackagePath(file.path));const data=file.bytes;
    if(name.length>65535||data.byteLength>200_000_000)throw Error('Invalid ZIP entry size.');
    const crc=crc32(data);
    const local=new ArrayBuffer(30+name.length),v=new DataView(local);u32(v,0,0x04034b50);u16(v,4,20);u16(v,6,0x0800);u16(v,8,0);u32(v,14,crc);u32(v,18,data.byteLength);u32(v,22,data.byteLength);u16(v,26,name.length);new Uint8Array(local,30).set(name);
    chunks.push(local,data.slice().buffer);
    const center=new ArrayBuffer(46+name.length),c=new DataView(center);u32(c,0,0x02014b50);u16(c,4,20);u16(c,6,20);u16(c,8,0x0800);u32(c,16,crc);u32(c,20,data.byteLength);u32(c,24,data.byteLength);u16(c,28,name.length);u32(c,42,offset);new Uint8Array(center,46).set(name);
    cd.push(center);offset+=local.byteLength+data.byteLength;centralSize+=center.byteLength;
  }
  const end=new ArrayBuffer(22),e=new DataView(end);u32(e,0,0x06054b50);u16(e,8,files.length);u16(e,10,files.length);u32(e,12,centralSize);u32(e,16,offset);
  return new Blob([...chunks,...cd,end],{type:'application/zip'});
}
