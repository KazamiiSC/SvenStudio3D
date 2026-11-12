/** Optional external BSP30 -> Valve 220 MAP conversion.
 * The executable is supplied by the user, never bundled or auto-executed.
 * Original BSP files are read only; every conversion lives in a private temp dir.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execFileAsync=promisify(execFile);
const MAX_BSP=256*1024*1024, MAX_MAP=20_000_000;
export const SURFDECOMP_MAP_LIMIT=MAX_MAP;
function validateBsp(bytes){
  if(!Buffer.isBuffer(bytes)||bytes.length<124||bytes.length>MAX_BSP)throw Error('BSP is empty, incomplete or exceeds 256 MB.');
  if(bytes.readInt32LE(0)!==30)throw Error('Only GoldSrc/Svengine BSP version 30 is supported.');
  const lumps=[];
  for(let i=0;i<15;i++){
    const offset=bytes.readInt32LE(4+i*8),size=bytes.readInt32LE(8+i*8);
    if(offset<0||size<0||offset>bytes.length||size>bytes.length-offset||(size&&offset<124))throw Error(`Invalid BSP lump ${i}.`);
    lumps.push({offset,size});
  }
  for(let i=0;i<lumps.length;i++)for(let j=i+1;j<lumps.length;j++){
    const a=lumps[i],b=lumps[j];
    if(a.size&&b.size&&a.offset<b.offset+b.size&&b.offset<a.offset+a.size)throw Error(`BSP lumps ${i}/${j} overlap.`);
  }
}
function normalizedToolPath(candidate,root){
  if(typeof candidate!=='string'||candidate.length>1024||/[\r\n\0]/.test(candidate))throw Error('Invalid SurfDecomp path.');
  const trimmed=candidate.trim().replace(/^"|"$/g,'');
  const selected=trimmed||path.join(root,'tools','surfdecomp.exe');
  if(path.win32.basename(selected).toLowerCase()!=='surfdecomp.exe')throw Error('Select a program named surfdecomp.exe.');
  if(!path.isAbsolute(selected))throw Error('Provide the absolute path to surfdecomp.exe on the local PC.');
  return selected;
}
export async function decompileBspToMap({bsp,toolPath='',root=process.cwd(),signal}){
  validateBsp(bsp);
  const executable=normalizedToolPath(toolPath,root);
  let stat;
  try{stat=await fs.stat(executable)}catch{throw Error('SurfDecomp not found. Set its full path or place it in SvenStudio3D/tools/surfdecomp.exe.');}
  if(!stat.isFile())throw Error('SurfDecomp path must point to an executable file.');
  const work=await fs.mkdtemp(path.join(os.tmpdir(),'svenstudio-bsp-recovery-'));
  try{
    const source=path.join(work,'source.bsp'),output=path.join(work,'reconstructed.map');
    await fs.writeFile(source,bsp,{flag:'wx'});
    let stdout='',stderr='';
    try{
      const result=await execFileAsync(executable,['decompile',source,'-o',output],{
        cwd:work,timeout:120_000,maxBuffer:4*1024*1024,windowsHide:true,encoding:'utf8',shell:false,signal
      });stdout=result.stdout||'';stderr=result.stderr||'';
    }catch(error){
      const summary=[signal?.aborted?'Decompilation cancelled.':error.killed||error.code==='ETIMEDOUT'?'SurfDecomp exceeded the 120-second limit for this BSP.':`SurfDecomp failed: ${error.message}`,error.stderr?.slice(-2000),error.stdout?.slice(-1500)].filter(Boolean).join('\n');
      throw Error(summary);
    }
    const resultStat=await fs.stat(output).catch(()=>null);
    if(!resultStat||resultStat.size<35||resultStat.size>MAX_MAP)throw Error('Decompiled MAP was not created or exceeds the 20 MB safe-import limit.');
    const mapText=await fs.readFile(output,'utf8');
    if(!/"classname"\s+"worldspawn"/i.test(mapText)||!mapText.includes('(')||!mapText.includes('{'))
      throw Error('SurfDecomp output is not a recognizable editable Valve 220 MAP.');
    return {mapText,log:[stdout,stderr].filter(Boolean).join('\n').slice(-6000),size:resultStat.size};
  }finally{await fs.rm(work,{recursive:true,force:true}).catch(()=>{});}
}
