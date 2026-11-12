// Sven Co-op-only, read-only model inventory. Nothing outside the configured
// game's models folders is reachable, and asset paths are not used as OS paths.
import fs from 'node:fs/promises';
import path from 'node:path';

export async function modelRoots(gameDir) {
  if (typeof gameDir !== 'string' || !gameDir || gameDir.length > 1024) throw new Error('Configure the Sven Co-op game directory in Build Settings.');
  const resolved=path.resolve(gameDir);
  const base=path.basename(resolved).toLowerCase();
  const parent=['svencoop','svencoop_addon','svencoop_downloads','svencoop_hd'].includes(base)?path.dirname(resolved):resolved;
  const roots=[];
  for(const folder of ['svencoop_addon','svencoop_downloads','svencoop','svencoop_hd','valve']){
    const root=path.join(parent,folder,'models');
    try{if((await fs.stat(root)).isDirectory())roots.push({folder,root:await fs.realpath(root)})}catch{}
  }
  if(!roots.length)throw new Error('No models folder found. Choose the Sven Co-op/ svencoop game directory.');
  return roots;
}
export function validModelName(value){return typeof value==='string'&&value.length>0&&value.length<300&&value.toLowerCase().endsWith('.mdl')&&
  !value.includes('\\')&&!value.startsWith('/')&&!value.split('/').some(s=>!s||s==='.'||s==='..'||s.startsWith('.'));}
// Full directory inventory is intentionally independent of the search query.
// Multiple pending requests share a single scan; typing in the browser only
// filters in-memory paths instead of rescanning 5,000+ files on every keystroke.
const INVENTORY_TTL_MS=5*60*1000;
const inventoryCache=new Map();
async function scanInventory(roots){
  const results=[];let scanned=0;
  for(const {folder,root} of roots){
    const stack=[{dir:root,relative:'',depth:0}];
    while(stack.length&&scanned<18000){
      const item=stack.pop();let entries;
      try{entries=await fs.readdir(item.dir,{withFileTypes:true})}catch{continue}
      for(const entry of entries){
        if(++scanned>=18000)break;
        if(entry.isSymbolicLink())continue;
        const rel=item.relative?item.relative+'/'+entry.name:entry.name;
        if(entry.isDirectory()&&item.depth<7){stack.push({dir:path.join(item.dir,entry.name),relative:rel,depth:item.depth+1});continue}
        if(!entry.isFile()||!/\.mdl$/i.test(entry.name))continue;
        results.push({source:folder,path:'models/'+rel.replaceAll('\\','/'),name:entry.name});
      }
    }
  }
  // Companion *T.mdl files contain texture data rather than standalone
  // visible objects. Hide only those with a matching source model alongside.
  const known=new Set(results.map(item=>item.source+'|'+item.path.toLowerCase()));
  const visible=results.filter(item=>!(/t\.mdl$/i.test(item.name) &&
    known.has(item.source+'|'+item.path.replace(/t\.mdl$/i,'.mdl').toLowerCase())));
  visible.sort((a,b)=>a.path.localeCompare(b.path)||a.source.localeCompare(b.source));
  return {items:visible,scanLimited:scanned>=18000};
}
export async function listModels(gameDir,query='',limit=300,{refresh=false}={}){
  const roots=await modelRoots(gameDir);
  const key=roots.map(({folder,root})=>folder+':'+root).join('|');
  const q=String(query).toLowerCase().trim().slice(0,128);
  const safeLimit=Math.max(10,Math.min(800,Number(limit)||300));
  const now=Date.now();
  let entry=inventoryCache.get(key);
  if(refresh||!entry||(!entry.pending&&now-entry.at>INVENTORY_TTL_MS)){
    const pending=scanInventory(roots);
    entry={pending,at:now};inventoryCache.set(key,entry);
    try{
      const inventory=await pending;
      if(inventoryCache.get(key)===entry){entry.data=inventory;entry.pending=null;entry.at=Date.now();}
    }catch(error){if(inventoryCache.get(key)===entry)inventoryCache.delete(key);throw error}
  }
  // Do not retain unbounded inventories for every historical game directory.
  while(inventoryCache.size>5)inventoryCache.delete(inventoryCache.keys().next().value);
  const inventory=entry.data||await entry.pending;
  const filtered=q?inventory.items.filter(f=>f.path.toLowerCase().includes(q)):inventory.items;
  return {items:filtered.slice(0,safeLimit),total:filtered.length,
    limited:inventory.scanLimited||filtered.length>safeLimit,scanComplete:true};
}
export async function openModel(gameDir,source,modelPath){
  const roots=await modelRoots(gameDir);
  if(!roots.some(root=>root.folder===source)||!validModelName(modelPath)||!modelPath.startsWith('models/'))throw Error('Invalid model source or path.');
  const root=roots.find(r=>r.folder===source).root;
  const relative=modelPath.slice('models/'.length);
  const full=path.resolve(root,...relative.split('/'));
  const real=await fs.realpath(full);
  if(!real.startsWith(root+path.sep))throw Error('Model path escapes configured Sven Co-op folder.');
  const stat=await fs.stat(real);
  if(!stat.isFile()||stat.size>32*1024*1024)throw Error('Model is not a regular file, or exceeds 32 MiB.');
  return fs.readFile(real);
}
