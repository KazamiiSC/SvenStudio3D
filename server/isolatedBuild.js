/** HF10: compilation is staging-only. Game directories are read-only unless
 * the user explicitly chooses the install mode, after successful compilation.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

const VALID_NAME=/^[a-z][a-z0-9_-]{0,63}$/i;
export function compileOutputMode(value){
 return value==='install'?'install':value==='folder'?'folder':value==='folder_zip'?'folder_zip':'build';
}
const within=(parent,child)=>child===parent||child.startsWith(parent+path.sep);
export async function validateBuildDestination(dir,gameDir){
 if(typeof dir!=='string'||!dir.trim()||dir.length>1024||!path.isAbsolute(dir))throw Error('Select an existing, absolute external export folder.');
 const target=await fs.realpath(dir),game=await fs.realpath(gameDir);
 if(!(await fs.stat(target)).isDirectory())throw Error('Export target is not a directory.');
 const layer=path.basename(game).toLowerCase(),base=['svencoop','svencoop_addon','svencoop_downloads'].includes(layer)?path.dirname(game):game;
 // Never export into the live game install or a parent containing the game.
 if(within(base,target)||within(target,base))throw Error('Choose a separate export folder outside Sven Co-op and its parent.');
 return target;
}
async function newFolder(base,mapName){
 for(let i=1;i<=999;i++){
  const name=`${mapName}_SvenCoop${i===1?'':`_${i}`}`,full=path.join(base,name);
  try{await fs.mkdir(full);return full}catch(e){if(e.code!=='EEXIST')throw e}
 }
 throw Error('Too many versions in output folder.');
}
/** Source & log included; isolated mode does not demand all runtime assets. */
export async function writeIsolatedBuild({gameDir,mapName,compiledBspPath,sourceMapPath,buildLog='',destinationDir=null,format='build',resourceRoots=[],inlineBinaryFiles=[],writeDistribution=null}){
 if(!VALID_NAME.test(mapName))throw Error('Invalid map name.');
 if(['folder','folder_zip'].includes(format)&&writeDistribution){
  const result=await writeDistribution({gameDir,mapName,destinationDir,format,resourceRoots,inlineBinaryFiles,
    compiledBspPath,sourceMapPath,buildLog,manualPaths:inlineBinaryFiles.filter(x=>/\.wad$/i.test(x.path)).map(x=>x.path),organizedLayout:true});
  return {...result,output:path.join(result.destination,'Distribucion','maps',`${mapName}.bsp`)};
 }
 const base=destinationDir?await validateBuildDestination(destinationDir,gameDir):path.join(os.homedir(),'SvenStudio3D','Builds');
 if(!destinationDir)await fs.mkdir(base,{recursive:true});
 const destination=await newFolder(base,mapName);
 try{
  for(const folder of ['Distribucion/maps','Fuentes','Logs'])await fs.mkdir(path.join(destination,...folder.split('/')),{recursive:true});
  const output=path.join(destination,'Distribucion','maps',`${mapName}.bsp`);
  await fs.copyFile(compiledBspPath,output,fs.constants.COPYFILE_EXCL);
  for(const file of inlineBinaryFiles){
   if(typeof file.path!=='string'||file.path.includes('..')||path.isAbsolute(file.path)||!/^(?:sound\/svstudio\/[a-z_]+\.wav|[a-z0-9_.+~()-]+\.wad)$/i.test(file.path)||!Buffer.isBuffer(file.bytes))throw Error('Unsafe isolated resource.');
   const full=path.join(destination,'Distribucion',...file.path.split('/'));
   await fs.mkdir(path.dirname(full),{recursive:true});await fs.writeFile(full,file.bytes,{flag:'wx'});
  }
  await fs.copyFile(sourceMapPath,path.join(destination,'Fuentes',`${mapName}.map`),fs.constants.COPYFILE_EXCL);
  await fs.writeFile(path.join(destination,'Logs','compilacion.log'),buildLog,{flag:'wx'});
  return {destination,output,files:inlineBinaryFiles.length+3,bytes:(await fs.stat(output)).size,warnings:[],missing:0};
 }catch(error){await fs.rm(destination,{recursive:true,force:true});throw error}
}
