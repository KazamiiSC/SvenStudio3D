/** HF9 external, read-only resource sources for the *existing* map packager.
 * A source is a user-selected directory. Files are never moved or changed.
 * Match exact game-relative paths first; allow a unique filename fallback for
 * unpacked archives with maps/models/ rather than models/. Ambiguity rejects.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';

const MAX_SOURCES=8, MAX_FILE_COUNT=4500, MAX_DEPTH=7;
const ASSET_EXT=/\.(?:wad|mdl|wav|mp3|ogg|spr|bmp|tga|as|cfg|gmr|gsr|txt|res)$/i;
export async function validateExternalRoots(input=[]){
 if(!Array.isArray(input)||input.length>MAX_SOURCES)throw Error('Choose up to 8 external resource folders.');
 const result=[],seen=new Set();
 for(const raw of input){
  if(typeof raw!=='string'||raw.length>1024||!path.isAbsolute(raw))throw Error('Resource source must be an absolute local folder.');
  let real;try{real=await fs.realpath(raw)}catch{throw Error(`Resource folder not found: ${raw}`)}
  if(!(await fs.stat(real)).isDirectory()||path.parse(real).root===real)throw Error('Choose a resource project folder, not an entire drive.');
  const id=process.platform==='win32'?real.toLowerCase():real;
  if(!seen.has(id)){seen.add(id);result.push(real)}
 }
 return result;
}
export function externalWadSearchFolders(roots){
 const dirs=[];
 for(const root of roots){for(const folder of [root,path.join(root,'maps'),...['svencoop','svencoop_addon','svencoop_downloads'].map(x=>path.join(root,x)),path.join(root,'svencoop_addon','maps')])dirs.push(folder)}
 return [...new Set(dirs)];
}
async function fileInRoot(full,root){
 try{const real=await fs.realpath(full);const st=await fs.stat(real);
  if(!st.isFile()||!(real.startsWith(root+path.sep)))return null;
  return {full:real,size:st.size,layer:`external: ${path.basename(root)}`,actual:path.relative(root,real).replaceAll('\\','/'),sourceRoot:root};
 }catch{return null}
}
async function caseWalk(root,parts){
 try{let current=root;for(const part of parts){const names=await fs.readdir(current);const exact=names.find(x=>x===part);const matches=names.filter(x=>x.toLowerCase()===part.toLowerCase());if(!exact&&matches.length!==1)return null;current=path.join(current,exact||matches[0]);}return await fileInRoot(current,root)}catch{return null}
}
async function directCandidates(root,rel){
 // Nested archive cases: package root, maps/models, maps/maps, addon/..., etc.
 const prefixes=['','maps','svencoop_addon','svencoop','svencoop_downloads','svencoop_addon/maps','svencoop/maps'];
 const list=[];for(const prefix of prefixes){const parts=[...prefix.split('/').filter(Boolean),...rel.split('/')];const match=await caseWalk(root,parts);if(match&&!list.some(x=>x.full===match.full))list.push({...match,relocated:!!prefix,via:prefix||'root'})}
 return list;
}
async function recursiveCandidates(root,basename){
 const found=[];let seen=0;const queue=[{dir:root,depth:0}];
 while(queue.length){const {dir,depth}=queue.shift();let items;try{items=await fs.readdir(dir,{withFileTypes:true})}catch{continue}
  for(const item of items){if(++seen>MAX_FILE_COUNT)return {found,truncated:true};
   if(item.name.startsWith('.')||item.name==='node_modules')continue;
   const full=path.join(dir,item.name);
   if(item.isDirectory()&&depth<MAX_DEPTH)queue.push({dir:full,depth:depth+1});
   else if(item.isFile()&&item.name.toLowerCase()===basename.toLowerCase()){
    const match=await fileInRoot(full,root);if(match)found.push({...match,relocated:true,via:'filename match'});
   }
  }
 }
 return {found,truncated:false};
}
async function fileHash(file){if(file.size>128*1024*1024)throw Error('External resource exceeds 128 MiB safety limit.');const bytes=await fs.readFile(file.full);return createHash('sha256').update(bytes).digest('hex')}
/** Returns match, conflict and source origin, or null. Never guesses between
 * ambiguous same-name files; identical duplicates are safe to deduplicate.
 */
export async function locateExternalResource(roots,relative){
 if(!roots?.length||typeof relative!=='string'||relative.includes('..')||path.isAbsolute(relative))return null;
 const direct=[];for(const root of roots)direct.push(...await directCandidates(root,relative));
 let choices=direct,truncated=false;
 if(!choices.length&&ASSET_EXT.test(relative)&&/^(models|sound|sprites|gfx|scripts|events|maps)\//i.test(relative)){
  for(const root of roots){const result=await recursiveCandidates(root,relative.split('/').at(-1));choices.push(...result.found);truncated ||= result.truncated;}
 }
 const uniq=[...new Map(choices.map(x=>[x.full,x])).values()];
 if(!uniq.length)return truncated?{conflict:'Resource search reached its file limit; select a narrower folder.'}:null;
 if(uniq.length>1){
  if(uniq.some(x=>x.size!==uniq[0].size))return {conflict:`Ambiguous ${relative}: multiple different-size files found in external folders.`};
  const hashes=await Promise.all(uniq.map(fileHash));
  if(new Set(hashes).size!==1)return {conflict:`Ambiguous ${relative}: multiple files with different content. Use a narrower resource folder.`};
 }
 return {...uniq[0],caseMismatch:uniq[0].actual!==relative,warning:uniq[0].relocated?`${relative} found at ${uniq[0].actual}; packaged under the path requested by the BSP.`:null};
}
