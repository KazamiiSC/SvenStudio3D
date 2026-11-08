/** SvenStudio 3D Map Packager — read-only Sven Co-op dependency inventory.
 * No compiler invocation, configuration edits or filesystem writes.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const MAX_BYTES=220*1024*1024,MAX_FILE=128*1024*1024,MAX_ITEMS=480;
const SAFE_ROOTS=['maps/','models/','sound/','sprites/','gfx/','scripts/maps/','events/'];
const GAME_LAYERS=['svencoop_addon','svencoop_downloads','svencoop'];
const MAP_NAME=/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const SKY_SIDES=['bk','dn','ft','lf','rt','up'];
export function cleanRelative(raw){
  if(typeof raw!=='string')throw Error('Resource path must be text.');
  const name=raw.replaceAll('\\','/').trim();
  if(!name||name.length>240||name.startsWith('/')||/^[a-z]:/i.test(name))throw Error(`Invalid resource path: ${raw}`);
  if(name.split('/').some(part=>!part||part==='.'||part==='..'||/[\x00-\x1f:*?"<>|]/.test(part)))throw Error(`Invalid resource path: ${raw}`);
  if(!SAFE_ROOTS.some(prefix=>name.toLowerCase().startsWith(prefix))&&!/^[a-z0-9_.-]+\.wad$/i.test(name))throw Error(`Resource not in a Sven Co-op asset folder: ${raw}`);
  if(!/\.(?:bsp|cfg|txt|res|gmr|gsr|mdl|wav|mp3|ogg|spr|bmp|tga|wad|as|json|dat)$/i.test(name))throw Error(`Unsupported resource extension: ${raw}`);
  return name;
}
function parseEntities(data){
  const text=data.replace(/\/\/[^\n]*/g,'');
  const matches=[...text.matchAll(/\{([^{}]{0,20000})\}/g)];
  return matches.slice(0,8192).map(match=>{
    const kv={};for(const m of match[1].matchAll(/"([^"\n]{1,128})"\s*"([^"\n]{0,2048})"/g))kv[m[1].toLowerCase()]=m[2];return kv;
  });
}
export function bspEntities(buffer){
  if(buffer.length<124)throw Error('Invalid BSP: truncated header.');
  const version=buffer.readInt32LE(0);if(![30,31].includes(version))throw Error(`Unsupported BSP version ${version}.`);
  const offset=buffer.readInt32LE(4),len=buffer.readInt32LE(8);
  if(offset<124||len<0||len>4*1024*1024||offset+len>buffer.length)throw Error('Invalid BSP entity lump.');
  return parseEntities(buffer.toString('latin1',offset,offset+len));
}
function externalTextures(buffer){
  const o=buffer.readInt32LE(4+2*8),l=buffer.readInt32LE(8+2*8);
  if(o<124||l<4||l>12*1024*1024||o+l>buffer.length)return true;
  const n=buffer.readInt32LE(o);if(n<0||n>16384||4+4*n>l)return true;
  for(let i=0;i<n;i++){
    const pos=buffer.readInt32LE(o+4+i*4);
    if(pos<0)continue;
    if(pos+40>l)return true;
    // MIPTEX image offset 0 indicates an external texture not embedded in the BSP.
    if(buffer.readUInt32LE(o+pos+24)===0)return true;
  }
  return false;
}
async function gameRoots(gameDir){
  if(typeof gameDir!=='string'||gameDir.length>1024)throw Error('Configure the Sven Co-op game folder first.');
  const real=await fs.realpath(gameDir);if(!(await fs.stat(real)).isDirectory())throw Error('Game folder not found.');
  const base=path.basename(real).toLowerCase();
  const parent=GAME_LAYERS.includes(base)?path.dirname(real):real;
  const roots=[];
  for(const layer of GAME_LAYERS){try{const root=await fs.realpath(path.join(parent,layer));if((await fs.stat(root)).isDirectory())roots.push({layer,root})}catch{}}
  if(!roots.length)roots.push({layer:'local',root:real});
  return roots;
}
async function locate(roots,rel){
  for(const r of roots){
    const candidate=path.join(r.root,...rel.split('/'));
    try{
      const real=await fs.realpath(candidate);
      if(!real.startsWith(r.root+path.sep))continue;
      const st=await fs.stat(real);if(!st.isFile())continue;
      return {full:real,layer:r.layer,size:st.size};
    }catch{/* missing */}
  }
  return null;
}
function refCandidates(entities){
  const refs=new Map(),warn=[];
  const add=(p,reason,required=false)=>{
    try{const name=cleanRelative(p);const k=name.toLowerCase();if(!refs.has(k))refs.set(k,{path:name,reason,required});else if(required)refs.get(k).required=true;}
    catch(e){warn.push(`Ignored reference (${reason}): ${String(e.message)}`)}
  };
  for(const e of entities){
    const cls=e.classname||'entity';
    for(const [key,v] of Object.entries(e)){
      const raw=v.trim();if(!raw||raw.startsWith('*'))continue;
      // Native worldspawn material sounds: include the map-specific TXT file.
      if(key==='materials_file'&&/^sound\/[a-z0-9_/-]+\.txt$/i.test(raw)){
        add(raw,`${cls}.materials_file`,true);continue;
      }
      if(key==='skyname'){if(!/^[\w-]{1,48}$/.test(raw)){warn.push('Invalid skyname in BSP.');continue}for(const side of SKY_SIDES)add(`gfx/env/${raw}${side}.tga`,'Skybox '+raw);continue}
      if(/(?:\.mdl|\.spr)$/i.test(raw)&&(/model|sprite|view|weapon|effect|gib|beam|custom|spawn|target/i.test(key)||raw.startsWith('models/')||raw.startsWith('sprites/'))){add(raw.startsWith('models/')||raw.startsWith('sprites/')?raw:`models/${raw}`,`${cls}.${key}`);continue}
      if(/\.(wav|mp3|ogg)$/i.test(raw)){add(raw.startsWith('sound/')?raw:`sound/${raw}`,`${cls}.${key}`);continue}
      if(/\.(?:gmr|gsr)$/i.test(raw)){add(raw.startsWith('maps/')?raw:`maps/${raw}`,`${cls}.${key}`);continue}
      if(key==='wad'&&raw){ // external WAD handling is decided using MIPTEX headers below
        for(const wad of raw.split(';').filter(Boolean)){const basename=wad.replaceAll('\\','/').split('/').pop();if(basename&&/^[\w.-]+\.wad$/i.test(basename))add(basename,`worldspawn.wad (review)`)}
      }
    }
  }
  return {refs,warn,add};
}
async function parseReferencedText(bytes,filename,add,warnings){
  if(bytes.length>2*1024*1024){warnings.push(`${filename}: text file exceeds scan limit; inspect manually.`);return}
  const data=bytes.toString('utf8');
  if(filename.endsWith('.res')){
    for(const row of data.split(/\r?\n/)){
      const value=row.trim().replace(/^"([^"]+)"$/, '$1');
      if(!value||value.startsWith('//')||value.startsWith('#'))continue;
      if(/^(maps|models|sound|sprites|gfx|scripts\/maps|events)\//i.test(value))add(value,`${filename}: RES manifest`);
    }
  }
  if(filename.endsWith('.cfg')){
    for(const match of data.matchAll(/^\s*map_script\s+([^\s"']+)/gim))add(`scripts/maps/${match[1].replace(/\.as$/i,'')}.as`,`${filename}: map_script`);
    for(const match of data.matchAll(/^\s*(globalmodellist|globalsoundlist)\s+([^\s"']+)/gim)){
      const p=match[2].replace(/^\.\.\/\.\.\//,'').replace(/^\.\.\//,'');add(p.startsWith('maps/')?p:`maps/${p}`,`${filename}: ${match[1]}`);
    }
  }
  if(filename.endsWith('.as')){
    for(const match of data.matchAll(/^\s*#include\s+["<]([^">]+)[">]/gim)){
      const parent=filename.slice('scripts/maps/'.length).split('/');parent.pop();
      const segments=[...parent,...match[1].replaceAll('\\','/').split('/')];const result=[];
      for(const segment of segments){if(segment==='.')continue;if(segment==='..'){if(!result.length){warnings.push(`Script include outside scripts/maps: ${match[1]}`);continue}result.pop()}else result.push(segment)}
      add(`scripts/maps/${result.join('/').replace(/\.as$/i,'')}.as`,`${filename}: #include`);
    }
    if(/\bPrecache\w*\s*\(|\bGetModel\s*\(/i.test(data))warnings.push(`${filename}: dynamic AngelScript resources might be missed; review manually.`);
  }
  if(filename.endsWith('.gmr')||filename.endsWith('.gsr')){
    for(const m of data.matchAll(/"([^"\n]+)"\s+"([^"\n]+)"/g))if(/^(models|sound|sprites)\//i.test(m[2]))add(m[2],`${filename}: replacement`);
  }
  if(filename.endsWith('.txt')&&/sentences|soundlist|modellist/i.test(filename)){
    for(const m of data.matchAll(/(?:models|sound|sprites)\/[\w./-]+\.(?:mdl|wav|mp3|spr)/gi))add(m[0],`${filename}: list`);
  }
}
function virtualFiles(input){
  if(!Array.isArray(input)||input.length>90)throw Error('Too many project scripts.');
  let total=0;const map=new Map();
  for(const file of input){const p=cleanRelative(file?.path);if(!p.startsWith('scripts/maps/')&&!/\.txt$/i.test(p))throw Error('Only map scripts or guide TXT can be supplied from project data.');
    if(typeof file.content!=='string'||file.content.length>2_000_000)throw Error('Invalid AngelScript content.');
    const data=Buffer.from(file.content,'utf8');total+=data.length;
    if(total>8_000_000)throw Error('Project scripts exceed the 8 MB limit.');
    const k=p.toLowerCase();if(map.has(k))throw Error(`Duplicate virtual file ${p}`);map.set(k,{path:p,data});
  }return map;
}
/** User-provided manual paths and source scripts never reach arbitrary file reads. */
export async function inspectMapPackage(input={}){
  const {gameDir,mapName}=input;
  if(typeof mapName!=='string'||!MAP_NAME.test(mapName))throw Error('Invalid map name. Use letters, numbers, - or _.');
  const roots=await gameRoots(gameDir),manual=input.manualPaths||[];
  if(!Array.isArray(manual)||manual.length>120)throw Error('Too many manual resources.');
  const virtual=virtualFiles(input.inlineFiles||[]);
  const mapPath=`maps/${mapName}.bsp`,bspFile=await locate(roots,mapPath);
  if(!bspFile||bspFile.size<124||bspFile.size>MAX_FILE)throw Error(`Compiled BSP not found or too large: ${mapPath}. Compile this map first.`);
  const bsp=await fs.readFile(bspFile.full);const entities=bspEntities(bsp),{refs,warn,add}=refCandidates(entities);
  const warnings=[...warn];refs.delete(mapPath.toLowerCase());
  const put=(p,reason,required=false)=>add(p,reason,required);
  for(const p of manual)put(cleanRelative(p),'Manual resource',true);
  for(const p of [`maps/${mapName}.cfg`,`maps/${mapName}.gmr`,`maps/${mapName}.gsr`,`maps/${mapName}.res`]){
    if(await locate(roots,p))put(p,'Companion map file');
  }
  for(const f of virtual.values())put(f.path,'Custom NPC Importer script');
  // Remove compiler-era WAD paths if textures are already embedded in the BSP.
  const external=externalTextures(bsp);if(!external){for(const [k,r] of refs)if(r.reason==='worldspawn.wad (review)'&&!r.required)refs.delete(k)}
  else if([...refs.values()].some(r=>r.reason==='worldspawn.wad (review)'))warnings.push('BSP contains external texture references. Review WAD requirements; source wad paths may be compiler-only.');
  // Try standard formats for skybox faces if the .tga is absent.
  const queue=[...refs.values()];const seen=new Set();const entries=[];
  const pushEntry=(entry)=>{if(entries.length>=MAX_ITEMS)throw Error('Resource inventory exceeds the 480-file limit.');entries.push(entry)};
  pushEntry({path:mapPath,status:'ready',layer:bspFile.layer,size:bspFile.size,reason:'Compiled BSP',required:true});
  for(let i=0;i<queue.length&&i<MAX_ITEMS;i++){
    let ref=queue[i],key=ref.path.toLowerCase();if(seen.has(key))continue;seen.add(key);
    if(key===mapPath.toLowerCase())continue;
    let virtualFile=virtual.get(key),found=await locate(roots,ref.path);
    if(virtualFile&&found){
      const stored=await fs.readFile(found.full);
      if(!stored.equals(virtualFile.data)){
        warnings.push(`${ref.path}: project script differs from installed file; choose one version before packaging.`);
        pushEntry({...ref,status:'conflict',size:virtualFile.data.length,layer:'project / installed'});
        continue;
      }
    }
    if(!found&&!virtualFile&&/gfx\/env\/.*\.tga$/i.test(ref.path)){
      const alt=ref.path.slice(0,-4)+'.bmp';found=await locate(roots,alt);
      if(found){ref={...ref,path:alt};key=alt.toLowerCase();if(seen.has(key))continue;seen.add(key)}
    }
    if(!found&&!virtualFile){pushEntry({...ref,status:'missing',size:0,layer:''});continue}
    const size=virtualFile?.data.length??found.size;
    if(size>MAX_FILE){warnings.push(`${ref.path}: file exceeds per-file limit.`);pushEntry({...ref,status:'oversize',size,layer:found?.layer||'project'});continue}
    const isBase=found?.layer==='svencoop';
    pushEntry({...ref,status:isBase?'builtin':'ready',size,layer:virtualFile?'project':found.layer});
    if((/\.(as|cfg|gmr|gsr|txt|res)$/i).test(ref.path)&&!isBase){
      const data=virtualFile?.data??await fs.readFile(found.full);
      const newly=[];await parseReferencedText(data,ref.path,(name,reason)=>{const prev=refs.size;put(name,reason);if(refs.size>prev)newly.push([...refs.values()].at(-1))},warnings);
      queue.push(...newly);
    }
    if(/\.mdl$/i.test(ref.path)&&!isBase){
      const base=ref.path.slice(0,-4);for(const extra of [`${base}T.mdl`,`${base}01.mdl`]){
        if(await locate(roots,extra)&&!seen.has(extra.toLowerCase()))queue.push({path:extra,reason:`Auxiliary model for ${ref.path}`});
      }
    }
  }
  const missing=entries.filter(e=>['missing','conflict','oversize'].includes(e.status)).length;
  const warningsUnique=[...new Set(warnings)].slice(0,120);
  return {mapName,entities:entities.length,externalTextures:external,entries,warnings:warningsUnique,missing,ready:entries.filter(e=>e.status==='ready').length,builtin:entries.filter(e=>e.status==='builtin').length};
}

const crcTable=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;crcTable[n]=c>>>0}
function crc32(buf){let c=0xffffffff;for(let i=0;i<buf.length;i++)c=crcTable[(c^buf[i])&255]^(c>>>8);return (c^0xffffffff)>>>0}
function archiveZip(files){
  let offset=0;const local=[],central=[];
  for(const {path:name,bytes} of files){const label=Buffer.from(name,'utf8');if(label.length>240)throw Error('ZIP entry name too long.');
    const crc=crc32(bytes),head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50,0);head.writeUInt16LE(20,4);head.writeUInt16LE(0x800,6);head.writeUInt32LE(crc,14);head.writeUInt32LE(bytes.length,18);head.writeUInt32LE(bytes.length,22);head.writeUInt16LE(label.length,26);
    local.push(head,label,bytes);
    const cd=Buffer.alloc(46);cd.writeUInt32LE(0x02014b50,0);cd.writeUInt16LE(20,4);cd.writeUInt16LE(20,6);cd.writeUInt16LE(0x800,8);cd.writeUInt32LE(crc,16);cd.writeUInt32LE(bytes.length,20);cd.writeUInt32LE(bytes.length,24);cd.writeUInt16LE(label.length,28);cd.writeUInt32LE(offset,42);central.push(cd,label);offset+=head.length+label.length+bytes.length;
  }
  const centralSize=central.reduce((n,b)=>n+b.length,0),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(centralSize,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,...central,end]);
}
/** Re-scans everything on packaging; never trust paths from an old browser manifest. */
export async function createMapPackage(input={}){
  const inventory=await inspectMapPackage(input);
  if(inventory.missing&&!input.acknowledgeMissing)throw Error(`${inventory.missing} resources missing. Confirm the warning before packaging.`);
  const roots=await gameRoots(input.gameDir),virtual=virtualFiles(input.inlineFiles||[]);
  const included=Array.isArray(input.selectedPaths)?new Set(input.selectedPaths.map(cleanRelative).map(p=>p.toLowerCase())):null;
  const files=[],checked=new Set();let size=0;
  for(const entry of inventory.entries){
    if(entry.status!=='ready')continue;
    const name=entry.path,key=name.toLowerCase();if(key!==`maps/${inventory.mapName}.bsp`.toLowerCase()&&included&&!included.has(key))continue;
    if(checked.has(key))throw Error(`Duplicate archive member: ${name}`);checked.add(key);
    let bytes=virtual.get(key)?.data;
    if(!bytes){const candidate=await locate(roots,name);if(!candidate||candidate.size>MAX_FILE||candidate.layer==='svencoop'&&key!==`maps/${inventory.mapName}.bsp`.toLowerCase())throw Error(`File changed while preparing ZIP: ${name}`);bytes=await fs.readFile(candidate.full)}
    size+=bytes.length;if(size>MAX_BYTES)throw Error('Package exceeds 220 MB uncompressed. Reduce resources.');
    files.push({path:name,bytes});
  }
  const missing=inventory.entries.filter(e=>['missing','conflict','oversize'].includes(e.status)).map(e=>e.path);
  const requestedLines=input.scriptLines||[];
  if(!Array.isArray(requestedLines)||requestedLines.length>40||requestedLines.some(x=>typeof x!=='string'||!/^[ ]*map_script[ ]+[a-z0-9_/-]{1,190}[ ]*$/i.test(x)||x.includes('..')))throw Error('Invalid map_script setup instructions.');
  const scriptLines=[...new Set(requestedLines.map(x=>x.trim()))];
  if(scriptLines.length){
    const setup=`SvenStudio 3D — Custom NPC script setup\n\nThe scripts are included as source files, but Sven Co-op must load them from a map CFG.\nEdit your EXISTING maps/${inventory.mapName}.cfg (or create it manually if needed) and add any lines not already present:\n\n${scriptLines.join('\n')}\n\nDo not replace an existing map CFG or run unknown AngelScript without inspecting it first.\n`;
    files.push({path:'SVENSTUDIO_CUSTOM_NPC_SETUP.txt',bytes:Buffer.from(setup)});
  }
  const guide=`SVENSTUDIO 3D — MAP PACKAGER\nMap: ${inventory.mapName}\n\nExtract the archive contents into Sven Co-op/svencoop_addon/ (folder names are at ZIP root).\nDo not extract third-party assets into svencoop/.\nVerify third-party licenses before redistributing models, sounds, WADs or AngelScript.\nMissing references detected: ${missing.length}\n${missing.join('\n')}\n\nDetected by static scanning of BSP, CFG and selected resources.\nAngelScript dynamic dependencies and in-game runtime behavior cannot be guaranteed.\nMap configurations and scripts have not been edited.\n`;
  files.push({path:'SVENSTUDIO_PACKAGING_REPORT.txt',bytes:Buffer.from(guide)});
  const hash=createHash('sha256');for(const f of files){hash.update(f.path).update(f.bytes)}
  return {zip:archiveZip(files),count:files.length,checksum:hash.digest('hex'),inventory};
}
