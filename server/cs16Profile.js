import path from 'node:path';
import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
const files=['counter-strike.fgd','counterstrike.fgd','cs_expert.fgd','cs16expert.fgd','halflife-cs.fgd','cs.fgd','cstrike.fgd'];
export async function isCS16GameDirectory(dir){
 if(typeof dir!=='string'||!path.isAbsolute(dir)||dir.length>1024||dir.includes('\0'))return false;
 const root=path.resolve(dir);
 if(path.basename(root).toLowerCase()!=='cstrike')return false;
 try{return (await fs.stat(root)).isDirectory() &&
  (existsSync(path.join(root,'liblist.gam'))||existsSync(path.join(root,'maps'))||existsSync(path.join(root,'pak0.pak')));}
 catch{return false}
}
/** FGD is an editor resource. CS 1.6 itself does not necessarily ship one. */
export async function findCS16Fgd(dir){
 if(!await isCS16GameDirectory(dir))throw Error('Select the Counter-Strike 1.6 cstrike folder.');
 const root=path.resolve(dir),parent=path.dirname(root);
 const search=[root,path.join(parent,'valve'),path.join(parent,'mapping'),path.join(parent,'tools')];
 for(const folder of search)for(const name of files){
  const candidate=path.join(folder,name);
  if(!existsSync(candidate))continue;
  const stat=await fs.stat(candidate);
  if(stat.isFile()&&stat.size>0&&stat.size<=4*1024*1024)return candidate;
 }
 return null;
}
export async function loadCS16Fgd(dir,fallbackPath){
 const chosen=await findCS16Fgd(dir),file=chosen||fallbackPath;
 const root=path.dirname(file),seen=new Set();
 async function load(name,depth=0){
  const full=path.resolve(root,name);
  if(depth>8||!full.toLowerCase().endsWith('.fgd')||!(full===root||full.startsWith(root+path.sep))||seen.has(full))return '';
  seen.add(full);
  const text=await fs.readFile(full,'utf8');
  let combined='';
  for(const m of text.matchAll(/^\s*@include\s+"([^"\r\n]+\.fgd)"/gim)){
   try{combined+=await load(m[1],depth+1)+'\n'}catch{/* FGD includes are optional */}
  }
  return combined+text.replace(/^\s*@include\s+"[^"\r\n]+"/gim,'');
 }
 return {contents:await load(path.basename(file)),source:chosen?'local':'bundled',file};
}
