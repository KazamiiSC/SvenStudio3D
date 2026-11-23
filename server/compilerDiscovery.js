/** Read-only ZHLT detection for the portable SvenStudio 3D tools folder.
 * Never recurse through drives or execute a binary to verify its identity.
 * Only the known compiler basename variants are accepted, and all 4 stages
 * must exist in the same folder. A manual compiler folder always wins.
 */
import fs from 'node:fs';
import path from 'node:path';
import {PROJECT_ROOT} from './paths.js';

const STAGES=['CSG','BSP','VIS','RAD'];
export const ZHLT_NAMES=Object.freeze(STAGES.map(stage=>[
  `hl${stage.toLowerCase()}.exe`,`ZHLT-${stage}.exe`,`HL${stage}.exe`
]));
const isDir=p=>{try{return fs.statSync(p).isDirectory()}catch{return false}};
const isFile=p=>{try{return fs.statSync(p).isFile()}catch{return false}};
const unique=values=>[...new Set(values.map(p=>path.resolve(p)))];
/** Direct folder or up to 2 directory levels inside <project>/tools. */
export function zhltCandidateFolders({projectRoot=PROJECT_ROOT,selectedDir=''}={}){
 const candidates=[];
 const add=root=>{
  if(!isDir(root))return;
  candidates.push(root);
  // Detect tools/ZHLT, tools/CS16, tools/compilers/ZHLT, etc.
  let children=[];try{children=fs.readdirSync(root,{withFileTypes:true}).filter(e=>e.isDirectory()&&!e.isSymbolicLink()).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,70)}catch{}
  for(const child of children){
   const first=path.join(root,child.name);candidates.push(first);
   if(path.basename(root).toLowerCase()!=='tools')continue;
   let nested=[];try{nested=fs.readdirSync(first,{withFileTypes:true}).filter(e=>e.isDirectory()&&!e.isSymbolicLink()).slice(0,70)}catch{}
   for(const sub of nested)candidates.push(path.join(first,sub.name));
  }
 };
 if(typeof selectedDir==='string'&&selectedDir.trim())add(selectedDir.trim());
 else add(path.join(projectRoot,'tools'));
 return unique(candidates);
}
export function inspectZhltFolder(folder){
 const paths=ZHLT_NAMES.map(names=>names.map(name=>path.join(folder,name)).find(isFile)||null);
 return {directory:path.resolve(folder),ready:paths.every(Boolean),executablePaths:paths,
  missing:STAGES.filter((_,i)=>!paths[i]).map(stage=>`hl${stage.toLowerCase()}.exe`)};
}
export function locateZhltCompilers(options={}){
 const folders=zhltCandidateFolders(options),inspections=folders.map(inspectZhltFolder);
 const complete=inspections.find(v=>v.ready);
 return {found:complete||null,complete:inspections.filter(v=>v.ready),
  // Prefer the most complete installation when reporting a missing file.
  partial:inspections.filter(v=>!v.ready&&v.missing.length<4).sort((a,b)=>a.missing.length-b.missing.length)[0]||null,
  inspectedCount:folders.length};
}
