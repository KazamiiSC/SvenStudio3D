import path from 'node:path';
import fs from 'node:fs/promises';

// Sven Studio v0.6.4.2: preserve the user's WAD precedence. Older builds
// unconditionally PREPENDED svstudio.wad and could silently mask custom WADs.
const bundledNames = new Set(['SV_BRICK01','SV_CONCRET','SV_TILE01','SV_METAL01','SV_GRID01']);
const normalizePath = p => p.replaceAll('\\','/').trim();
const wadBase = p => path.win32.basename(normalizePath(p)).toLowerCase();

export function worldHeaderRange(source) {
  const first = source.indexOf('{');
  if (first < 0) throw new Error('No worldspawn section found in MAP source.');
  const next = source.indexOf('{',first+1);
  const closing = source.indexOf('}',first+1);
  const end = Math.min(next<0?source.length:next,closing<0?source.length:closing);
  const header = source.slice(first,end);
  if (!/"classname"\s+"worldspawn"/i.test(header))
    throw new Error('First MAP entity is not worldspawn; refusing to rewrite WAD keyvalues.');
  return {first,end,header};
}
export function referencedTextures(mapData) {
  // Only Valve 220 brush face lines are inspected, never entity keyvalues.
  const names = new Set();
  for (const line of mapData.split(/\r?\n/)) {
    const match=line.match(/^\s*\(\s*[-\d.]+\s+[-\d.]+\s+[-\d.]+\s*\)\s*\(\s*[-\d.]+\s+[-\d.]+\s+[-\d.]+\s*\)\s*\(\s*[-\d.]+\s+[-\d.]+\s+[-\d.]+\s*\)\s+([^\s]+)/);
    if(match) names.add(match[1].toUpperCase());
  }
  return names;
}
export function readWorldWadList(source) {
  const {header}=worldHeaderRange(source);
  const match=header.match(/^\s*"wad"\s+"([^"]*)"/im);
  return (match?.[1]||'').split(';').map(normalizePath).filter(Boolean);
}
export function patchWorldWads(source,list) {
  const {first,end,header}=worldHeaderRange(source);
  const replacement=`"wad" "${list.join(';')}${list.length?';':''}"`;
  const existing=/^\s*"wad"\s+"[^"]*"/im;
  const next=existing.test(header) ? header.replace(existing,replacement) : header.replace(/"classname"\s+"worldspawn"/i,m=>`${m}\n${replacement}`);
  return source.slice(0,first)+next+source.slice(end);
}
export function uniqueWads(list) {
  const seen=new Set();
  return list.filter(entry=>{ const key=wadBase(entry);if(!key||seen.has(key))return false;seen.add(key);return true; });
}
export function wadTextureNames(buffer) {
  if(buffer.length<12||buffer.toString('ascii',0,4)!=='WAD3')throw new Error('Invalid WAD3 header');
  const n=buffer.readInt32LE(4),start=buffer.readInt32LE(8);
  if(n<0||n>10000||start<12||start+n*32>buffer.length)throw new Error('Invalid WAD directory');
  const out=new Set();
  for(let i=0;i<n;i++){
    const off=start+i*32;
    const name=buffer.toString('latin1',off+16,off+32).split('\0')[0].toUpperCase();
    if(name)out.add(name);
  }
  return out;
}
const statSafe=async p=>{try{const s=await fs.stat(p);return s.isFile()}catch{return false}};
const lookupWad=async(name,gameDir,compilerDir)=>{
  const clean=normalizePath(name);
  const file=path.win32.basename(clean);
  const candidates=[clean,path.resolve(clean),path.join(gameDir, file),path.join(gameDir,'..','svencoop',file),path.join(gameDir,'..','svencoop_addon',file),path.join(compilerDir,file)];
  for(const candidate of candidates)if(await statSafe(candidate))return candidate;
  return null;
};

export async function prepareCompileWads(source,{gameDir,compilerDir,builtInWad}) {
  const textures=referencedTextures(source),warnings=[];
  const old=readWorldWadList(source);
  let list=uniqueWads(old);
  if(list.length!==old.length)warnings.push(`Removed ${old.length-list.length} duplicate WAD reference(s) (case-insensitive basename).`);
  const available=[];
  for(const entry of list){
    const file=await lookupWad(entry,gameDir,compilerDir);
    if(!file){warnings.push(`Cannot inspect WAD ${entry}; verify it is installed on the compiler PC.`);continue}
    try{available.push({entry,file,names:wadTextureNames(await fs.readFile(file))})}
    catch(e){warnings.push(`Cannot inspect WAD ${entry}: ${e.message}`)}
  }
  const bundledNeeded=[...textures].filter(name=>bundledNames.has(name));
  const missingBundled=bundledNeeded.filter(t=>!available.some(w=>w.names.has(t)));
  const hadBuiltIn=list.some(x=>wadBase(x)==='svstudio.wad');
  if(missingBundled.length && !hadBuiltIn && await statSafe(builtInWad)){
    // Append, never prepend. Custom WADs retain precedence.
    list=[...list,normalizePath(builtInWad)];
    warnings.push(`Appended bundled svstudio.wad only for missing editor textures: ${missingBundled.join(', ')}`);
  }
  else if(!missingBundled.length && hadBuiltIn && !bundledNeeded.length){
    // An old compiled MAP may carry a leftover svstudio reference.
    list=list.filter(x=>wadBase(x)!=='svstudio.wad');
    warnings.push('Removed unnecessary bundled svstudio.wad from this build.');
  }
  const providerList=[];
  for(const entry of list){
    const file=await lookupWad(entry,gameDir,compilerDir);
    if(!file)continue;
    try{providerList.push({entry,names:wadTextureNames(await fs.readFile(file))})}catch{/* warning above */}
  }
  const skyProviders=providerList.filter(w=>w.names.has('SKY')).map(w=>w.entry);
  if(textures.has('SKY')){
    if(skyProviders.length>1)warnings.push(`Conflicting SKY textures in multiple WADs: ${skyProviders.join(', ')}. Use one authoritative SKY source.`);
    if(skyProviders.length===0)warnings.push('SKY is referenced but none of the inspected WADs contains a SKY miptexture. Add a valid SKY tool texture WAD.');
  }
  const map=patchWorldWads(source,list);
  return {map,wadList:list,warnings,skyProviders,usesSky:textures.has('SKY'),usesBundled:bundledNeeded.length>0,textureCount:textures.size};
}
