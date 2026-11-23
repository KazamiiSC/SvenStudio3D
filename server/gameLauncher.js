/** "Test in game": start the user's installed game directly on a compiled map.
 * Only fixed executable names inside the configured game folder are started
 * (svencoop.exe for Sven Co-op, hl.exe -game cstrike for Counter-Strike 1.6),
 * and only when the map BSP is already installed in one of the game's map folders.
 * Nothing is written; the game is started detached so the editor keeps running.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';

const VALID_MAP=/^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
export const GAME_LAUNCH={
  svengine:{layers:['svencoop_addon','svencoop_downloads','svencoop'],exe:'svencoop.exe',args:[],name:'Sven Co-op'},
  cs16:{layers:['cstrike_addon','cstrike_downloads','cstrike'],exe:'hl.exe',args:['-game','cstrike'],name:'Counter-Strike 1.6'},
};
const isFile=async p=>{try{return (await fs.stat(p)).isFile()}catch{return false}};

/** Resolve the game root, executable and installed BSP. Pure filesystem reads. */
export async function resolveGameLaunch({gameProfile='svengine',gameDir,mapName}){
  const profile=GAME_LAUNCH[gameProfile==='cs16'?'cs16':'svengine'];
  if(!VALID_MAP.test(String(mapName||'')))throw Error('Invalid map name.');
  if(typeof gameDir!=='string'||!gameDir||gameDir.length>1024||!path.isAbsolute(gameDir))throw Error(`Configure the ${profile.name} game folder first.`);
  const real=await fs.realpath(gameDir).catch(()=>{throw Error(`${profile.name} game folder not found.`)});
  const layer=path.basename(real).toLowerCase();
  const root=profile.layers.includes(layer)?path.dirname(real):real;
  const exe=path.join(root,profile.exe);
  if(!await isFile(exe))throw Error(`${profile.exe} was not found in ${root}.`);
  let installed=null;
  for(const name of profile.layers){
    const bsp=path.join(root,name,'maps',`${mapName}.bsp`);
    if(await isFile(bsp)){installed=bsp;break;}
  }
  if(!installed)throw Error(`${mapName}.bsp is not installed in ${profile.name}. Install the build first.`);
  return {exe,root,args:[...profile.args,'+map',mapName],installed,game:profile.name};
}

export async function launchGame(options,{spawnProcess=spawn}={}){
  const plan=await resolveGameLaunch(options);
  const child=spawnProcess(plan.exe,plan.args,{cwd:plan.root,detached:true,stdio:'ignore',windowsHide:false});
  child.on?.('error',()=>{});
  child.unref?.();
  return {launched:true,game:plan.game,map:options.mapName,bsp:plan.installed};
}
