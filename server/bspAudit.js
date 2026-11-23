import fs from 'node:fs/promises';

// Read-only GoldSrc BSP30 audit. This does not claim to simulate renderer behavior.
const LUMP_COUNT=15,SKY_CONTENTS=-6,TEX_SPECIAL=1;
const names=['entities','planes','textures','vertices','visibility','nodes','texinfo','faces','lighting','clipnodes','leaves','marksurfaces','edges','surfedges','models'];
// Classic GoldSrc compile limits (Half-Life SDK common/bspfile.h). Svengine raises several of these,
// so they are only enforced as warnings for the Counter-Strike 1.6 profile.
export const GOLDSRC_LIMITS={models:400,entities:1024,planes:32767,textures:512,vertices:65535,nodes:32767,texinfo:8192,faces:65535,clipnodes:32767,leaves:8192,marksurfaces:65535,edges:256000,surfedges:512000,lightingBytes:0x200000,visibilityBytes:0x200000,entdataBytes:0x20000};
const RECORD={planes:20,vertices:12,nodes:24,texinfo:40,faces:20,clipnodes:8,leaves:28,marksurfaces:2,edges:4,surfedges:4,models:64};
/** Percent-of-limit report, highest first. */
export function bspLimitReport(counts,limits=GOLDSRC_LIMITS){
  return Object.entries(limits).filter(([k])=>counts[k]!==undefined).map(([k,max])=>({name:k,count:counts[k],max,percent:Math.round(counts[k]/max*100)})).sort((a,b)=>b.percent-a.percent);
}
export function inspectBsp(buffer) {
  if(buffer.length<124||buffer.readInt32LE(0)!==30)throw new Error('Expected a valid GoldSrc BSP v30 file.');
  const lump=[];
  for(let i=0;i<LUMP_COUNT;i++){
    const offset=buffer.readInt32LE(4+i*8),length=buffer.readInt32LE(8+i*8);
    if(offset<0||length<0||offset+length>buffer.length)throw new Error(`Invalid BSP ${names[i]} lump`);
    lump.push({offset,length});
  }
  const text=buffer.toString('latin1',lump[0].offset,lump[0].offset+lump[0].length);
  const worldSection=text.split('}')[0];
  const worldWads=worldSection.match(/"wad"\s+"([^"]*)"/i)?.[1]||'';
  const skyname=worldSection.match(/"skyname"\s+"([^"]*)"/i)?.[1]||'';
  const tex=lump[2],texData=buffer.subarray(tex.offset,tex.offset+tex.length);
  if(texData.length<4)throw new Error('Missing BSP texture index');
  const n=texData.readInt32LE(0);
  if(n<0||n>32767||4+4*n>texData.length)throw new Error('Malformed BSP texture directory');
  const textures=[];
  for(let i=0;i<n;i++){
    const o=texData.readInt32LE(4+i*4);
    textures.push(o>=0&&o+40<=texData.length?texData.toString('latin1',o,o+16).split('\0')[0]:'');
  }
  const ti=lump[6],infos=[];
  if(ti.length%40)throw new Error('Malformed BSP texinfo length');
  for(let i=0;i<ti.length/40;i++)infos.push({miptex:buffer.readInt32LE(ti.offset+i*40+32),flags:buffer.readInt32LE(ti.offset+i*40+36)});
  const fa=lump[7];
  if(fa.length%20)throw new Error('Malformed BSP face length');
  let skyFaces=0,skySpecialFaces=0,lightmappedSkyFaces=0;
  for(let i=0;i<fa.length/20;i++){
    const index=buffer.readUInt16LE(fa.offset+i*20+10);
    const info=infos[index];if(!info)throw new Error('Face references missing texinfo');
    if(textures[info.miptex]?.toUpperCase()==='SKY'){
      skyFaces++;if(info.flags&TEX_SPECIAL)skySpecialFaces++;
      if(buffer.readInt32LE(fa.offset+i*20+16)!==-1)lightmappedSkyFaces++;
    }
  }
  const leaves=lump[10];let skyLeaves=0;
  if(leaves.length%28)throw new Error('Malformed BSP leaf length');
  for(let i=0;i<leaves.length/28;i++)if(buffer.readInt32LE(leaves.offset+i*28)===SKY_CONTENTS)skyLeaves++;
  const warnings=[];
  if(skyFaces>0&&!skyname)warnings.push('BSP has SKY faces but no worldspawn.skyname.');
  if(skyFaces>0&&!skySpecialFaces)warnings.push('BSP SKY faces lack TEX_SPECIAL; inspect compile tools.');
  if(skyFaces>0&&lightmappedSkyFaces)warnings.push('BSP SKY faces have lightmap offsets; inspect compile tools.');
  const uniqueWads=[...new Set(worldWads.split(';').map(x=>x.trim()).filter(Boolean).map(x=>x.split(/[\\/]/).at(-1)?.toLowerCase()))];
  const counts={entities:(text.match(/\{/g)||[]).length,textures:n,lightingBytes:lump[8].length,visibilityBytes:lump[4].length,entdataBytes:lump[0].length};
  for(const [name,size] of Object.entries(RECORD))counts[name]=Math.floor(lump[names.indexOf(name)].length/size);
  return {version:30,skyname,worldWads:uniqueWads,skyFaces,skySpecialFaces,lightmappedSkyFaces,skyLeaves,textures:textures.filter(Boolean),warnings,counts};
}
export async function inspectBspFile(file){return inspectBsp(await fs.readFile(file))}
