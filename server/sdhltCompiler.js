import path from 'node:path';
import {existsSync} from 'node:fs';
import {locateZhltCompilers} from './compilerDiscovery.js';

export const compileStages=['CSG','BSP','VIS','RAD'];

/** Select compilers by exact filenames; never run an arbitrary executable path from the client. */
export function resolveCompilerProfile({compilerEngine='sc',compilerDir='',sdhltDir='',sdhltAO=false,sdhltPCF='off'}={}){
  if(!['sc','sdhlt','zhlt'].includes(compilerEngine))throw new Error('Unknown compiler engine.');
  if(!['off','1','2','4'].includes(String(sdhltPCF)))throw new Error('Invalid SDHLT PCF setting.');
  if(typeof sdhltAO!=='boolean')throw new Error('Invalid SDHLT AO setting.');
  let selectedDir=compilerEngine==='sdhlt'?sdhltDir:compilerDir;
  if(typeof selectedDir!=='string'||selectedDir.length>2048)throw new Error('Invalid compiler folder.');
  if(compilerEngine==='zhlt'){
    const found=locateZhltCompilers({selectedDir});
    if(found.found)selectedDir=found.found.directory;
    else if(!selectedDir.trim())throw new Error(found.partial
      ?`ZHLT found in tools but incomplete: missing ${found.partial.missing.join(', ')} in ${found.partial.directory}.`
      :'No complete ZHLT installation found in tools. Add hlcsg.exe, hlbsp.exe, hlvis.exe and hlrad.exe to tools or select a folder.');
    else if(found.partial)throw new Error(`ZHLT compiler missing: ${found.partial.missing.map(n=>n.slice(2,5).toUpperCase()).join(', ')} (${found.partial.missing.join(', ')}) in ${found.partial.directory}.`);
  }
  if(!selectedDir.trim())throw new Error('Set the selected compiler folder.');
  const executablePaths=compileStages.map(stage=>{
    const names=compilerEngine==='sc'
      ?[`SC-${stage}_x64.exe`,`SC-${stage}.exe`,`SC_${stage}_x64.exe`,`SC_${stage}.exe`]
      :compilerEngine==='zhlt'?[`hl${stage.toLowerCase()}.exe`,`ZHLT-${stage}.exe`,`HL${stage}.exe`]
      :[`sdHL${stage}_x64.exe`,`sdHL${stage}.exe`,`sdhl${stage}_x64.exe`,`sdhl${stage}.exe`];
    const file=names.map(name=>path.join(selectedDir,name)).find(existsSync);
    if(!file)throw new Error(`${compilerEngine==='sc'?'SC':compilerEngine==='zhlt'?'ZHLT':'SDHLT'} compiler missing: ${stage} in ${selectedDir}. Expected ${names[0]} or ${names[1]}.`);
    return file;
  });
  return {
    engine:compilerEngine,dir:selectedDir,executablePaths,
    radArgs:compilerEngine==='sdhlt'?[...(sdhltAO?['-ao']:[]),...(sdhltPCF==='off'?[]:['-pcf',String(sdhltPCF)])]:[],
    requiredWad:compilerEngine==='sdhlt'?path.join(selectedDir,'sdhlt.wad'):null,
  };
}
