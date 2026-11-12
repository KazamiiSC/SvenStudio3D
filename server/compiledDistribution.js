/** HF8 Smart Build distribution: reuses Map Packager's BSP dependency scanner.
 * No duplicate dependency parser. Nothing in the original game is deleted.
 * Writes only under an explicit existing destination folder, into a fresh child.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createMapPackage} from './mapPackager.js';
import {validateExternalRoots} from './externalResources.js';
import {validateBuildDestination} from './isolatedBuild.js';

const VALID_NAME=/^[A-Za-z][A-Za-z0-9_-]{0,63}$/;
const MAX_FILES=500;

export function distributionOptions({mapName,destinationDir,format='folder'}={}){
  if(!VALID_NAME.test(mapName||''))throw Error('Invalid map name for distribution.');
  if(!['folder','folder_zip','install'].includes(format))throw Error('Invalid distribution format.');
  if(typeof destinationDir!=='string'||!destinationDir.trim()||destinationDir.length>1024||!path.isAbsolute(destinationDir))throw Error('Choose an absolute destination folder.');
  return {mapName,destinationDir:path.resolve(destinationDir),format};
}
function safePackageRelative(name){
  if(typeof name!=='string'||name.length>240||name.startsWith('/')||name.startsWith('\\')||/^[a-z]:/i.test(name)||name.split(/[\\/]/).some(s=>!s||s==='..'||s==='.')||/[\x00-\x1f:*?"<>|]/.test(name))throw Error(`Unsafe packaged path: ${name}`);
  return name;
}
/** Create a new folder, never merge with or overwrite files in a previous export. */
export async function writeDistribution({gameDir,mapName,destinationDir,format='folder',manualPaths=[],resourceRoots=[],compiledBspPath=null,inlineBinaryFiles=[],sourceMapPath=null,buildLog='',organizedLayout=false}={}){
  const options=distributionOptions({mapName,destinationDir,format});
  const sources=await validateExternalRoots(resourceRoots);
  const stat=await fs.stat(options.destinationDir);
  if(!stat.isDirectory())throw Error('Distribution destination is not a folder.');
  const realDestination=await fs.realpath(options.destinationDir);
  const gameReal=await fs.realpath(gameDir);
  if(format!=='install')await validateBuildDestination(realDestination,gameDir);
  // Do not create nested output folders in the live game data tree.
  if(format!=='install'&&(realDestination===gameReal||realDestination.startsWith(gameReal+path.sep)))throw Error('Choose a separate export folder, not a Sven Co-op game directory. The BSP is installed in maps/ separately.');
  const result=await createMapPackage({gameDir,mapName,manualPaths,resourceRoots:sources,compiledBspPath,inlineBinaryFiles,generateRes:true,acknowledgeMissing:false,returnFiles:true});
  if(!Array.isArray(result.files)||!result.files.length||result.files.length>MAX_FILES)throw Error('Package file count is outside allowed bounds.');
  if(format==='install'){
    // Explicit install, after a complete dependency preflight. Never overwrite
    // resources or BSPs already in the user's game. Source files stay untouched.
    const realGame=await fs.realpath(gameDir);
    const base=['svencoop','svencoop_addon','svencoop_downloads'].includes(path.basename(realGame).toLowerCase())?path.dirname(realGame):realGame;
    const addon=path.join(base,'svencoop_addon');
    await fs.mkdir(addon,{recursive:true});const addonReal=await fs.realpath(addon);
    const actions=[];
    for(const file of result.files){
      const relative=safePackageRelative(file.path);
      if(relative==='SVENSTUDIO_PACKAGING_REPORT.txt')continue;
      const target=path.resolve(addonReal,...relative.replaceAll('\\','/').split('/'));
      if(!target.startsWith(addonReal+path.sep))throw Error('Resource install path escapes svencoop_addon.');
      try{const current=await fs.readFile(target);
        if(!current.equals(file.bytes))throw Error(`Cannot install ${relative}: a different file already exists. No resources installed.`);
      }catch(e){if(e.code!=='ENOENT')throw e;actions.push({target,data:file.bytes})}
    }
    const created=[];
    try{for(const a of actions){await fs.mkdir(path.dirname(a.target),{recursive:true});const parent=await fs.realpath(path.dirname(a.target));if(!(parent===addonReal||parent.startsWith(addonReal+path.sep)))throw Error('Installation path escapes svencoop_addon through a symlink.');await fs.writeFile(a.target,a.data,{flag:'wx'});created.push(a.target)}}
    catch(e){for(const f of created)await fs.unlink(f).catch(()=>{});throw e}
    return {destination:addonReal,files:actions.length,bytes:actions.reduce((n,a)=>n+a.data.length,0),warnings:result.inventory.warnings,missing:0};
  }
  let destination;
  for(let i=1;i<=999;i++){
    const folder=path.join(realDestination,`${mapName}_SvenCoop${i===1?'':`_${i}`}`);
    try{await fs.mkdir(folder);destination=folder;break;}catch(error){if(error.code!=='EEXIST')throw error;}
  }
  if(!destination)throw Error('Too many exported versions in this folder.');
  try{
    const distributionRoot=organizedLayout?path.join(destination,'Distribucion'):destination;
    if(organizedLayout)await fs.mkdir(distributionRoot);
    for(const file of result.files){
      const relative=safePackageRelative(file.path);
      const full=path.resolve(distributionRoot,...relative.replaceAll('\\','/').split('/'));
      if(!full.startsWith(distributionRoot+path.sep))throw Error('Packaging path escaped destination.');
      await fs.mkdir(path.dirname(full),{recursive:true});
      await fs.writeFile(full,file.bytes,{flag:'wx'});
    }
    if(organizedLayout){
      if(sourceMapPath){await fs.mkdir(path.join(destination,'Fuentes'));await fs.copyFile(sourceMapPath,path.join(destination,'Fuentes',`${mapName}.map`),fs.constants.COPYFILE_EXCL)}
      await fs.mkdir(path.join(destination,'Logs'));
      await fs.writeFile(path.join(destination,'Logs','compilacion.log'),buildLog||'Compile finished; no stdout captured.\n',{flag:'wx'});
    }
    if(format==='folder_zip')await fs.writeFile(path.join(destination,`${mapName}_SvenCoop.zip`),result.zip,{flag:'wx'});
    return {destination,files:result.files.length,bytes:result.files.reduce((n,f)=>n+f.bytes.length,0),warnings:result.inventory.warnings,missing:result.inventory.missing};
  }catch(error){await fs.rm(destination,{recursive:true,force:true});throw error;}
}
