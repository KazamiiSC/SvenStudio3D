// Read-only sound inventory for Sven Co-op. Paths never escape configured game folders.
import fs from 'node:fs/promises';
import path from 'node:path';
import {createReadStream} from 'node:fs';
const SEARCH_FOLDERS=['svencoop_addon','svencoop_downloads','svencoop'];
const EXTENSIONS=new Set(['.wav','.mp3','.ogg','.flac','.aif','.aiff','.wma','.mid','.midi','.mod','.xm','.it','.s3m']);
const CACHE_TTL=5*60*1000;
const cache=new Map();
export function validSoundPath(value){
  return typeof value==='string'&&value.length>0&&value.length<=320&&
    !value.includes('\\')&&!value.startsWith('/')&&!value.includes('\0')&&
    value.split('/').every(part=>part&&part!=='.'&&part!=='..'&&!part.startsWith('.'))&&
    EXTENSIONS.has(path.posix.extname(value).toLowerCase());
}
export async function soundRoots(gameDir){
  if(typeof gameDir!=='string'||!gameDir||gameDir.length>1024)throw Error('Configure Sven Co-op game directory first.');
  const resolved=path.resolve(gameDir);
  const name=path.basename(resolved).toLowerCase();
  const parent=SEARCH_FOLDERS.includes(name)?path.dirname(resolved):resolved;
  const roots=[];
  for(const source of SEARCH_FOLDERS){
    const folder=path.join(parent,source,'sound');
    try{const real=await fs.realpath(folder);if((await fs.stat(real)).isDirectory())roots.push({source,root:real});}catch{}
  }
  if(!roots.length)throw Error('No Sven Co-op sound directory found. Check Build Settings.');
  return roots;
}
async function scan(roots){
  const items=[];let inspected=0;
  for(const {source,root} of roots){
    const stack=[{dir:root,relative:'',depth:0}];
    while(stack.length&&inspected<40000){
      const current=stack.pop();let entries;
      try{entries=await fs.readdir(current.dir,{withFileTypes:true})}catch{continue}
      for(const entry of entries){
        if(++inspected>40000)break;
        if(entry.isSymbolicLink())continue;
        const rel=current.relative?current.relative+'/'+entry.name:entry.name;
        if(entry.isDirectory()&&current.depth<9){stack.push({dir:path.join(current.dir,entry.name),relative:rel,depth:current.depth+1});continue}
        if(!entry.isFile()||!validSoundPath(rel))continue;
        items.push({source,path:rel,name:entry.name,extension:path.extname(entry.name).slice(1).toLowerCase(),category:rel.split('/')[0]||'root'});
      }
    }
  }
  items.sort((a,b)=>a.path.localeCompare(b.path)||a.source.localeCompare(b.source));
  return {items,limited:inspected>40000};
}
export async function listSounds(gameDir,query='',limit=300,{refresh=false}={}){
  const roots=await soundRoots(gameDir);
  const key=roots.map(r=>r.source+':'+r.root).join('|');const now=Date.now();
  let entry=cache.get(key);
  if(refresh||!entry||(!entry.pending&&now-entry.at>CACHE_TTL)){
    entry={pending:scan(roots),at:now};cache.set(key,entry);
    try{entry.data=await entry.pending;entry.pending=null;entry.at=Date.now()}catch(e){cache.delete(key);throw e}
  }
  while(cache.size>5)cache.delete(cache.keys().next().value);
  const inventory=entry.data||await entry.pending;
  const q=String(query).trim().toLowerCase().slice(0,128);
  const filtered=q?inventory.items.filter(i=>(i.path+' '+i.source).toLowerCase().includes(q)):inventory.items;
  const max=Math.max(10,Math.min(1000,Number(limit)||300));
  return {items:filtered.slice(0,max),total:filtered.length,limited:inventory.limited||filtered.length>max,scanComplete:true};
}
export async function soundFile(gameDir,source,soundPath){
  const roots=await soundRoots(gameDir);
  const root=roots.find(item=>item.source===source)?.root;
  if(!root||!validSoundPath(soundPath))throw Error('Invalid source or sound path.');
  const candidate=path.resolve(root,...soundPath.split('/'));
  if(!candidate.startsWith(root+path.sep))throw Error('Sound path is outside Sven Co-op directory.');
  const real=await fs.realpath(candidate);
  if(!real.startsWith(root+path.sep))throw Error('Sound symlink escapes configured directory.');
  const stat=await fs.stat(real);
  if(!stat.isFile()||stat.size>100*1024*1024)throw Error('Sound is too large or not a file.');
  return {real,size:stat.size};
}
const CONTENT_TYPES={wav:'audio/wav',mp3:'audio/mpeg',ogg:'audio/ogg',flac:'audio/flac',aif:'audio/aiff',aiff:'audio/aiff',wma:'audio/x-ms-wma',mid:'audio/midi',midi:'audio/midi'};
export async function streamSound(req,res){
  try{
    const {gameDir,source,path:soundPath}=req.query;
    const {real,size}=await soundFile(gameDir,source,soundPath);
    const ext=path.extname(real).slice(1).toLowerCase();
    let start=0,end=size-1;const range=req.headers.range;
    if(range){const match=/^bytes=(\d*)-(\d*)$/.exec(range);
      if(!match) return res.status(416).end();
      const a=match[1],b=match[2];
      if(!a&&!b)return res.status(416).end();
      if(!a){const n=Number(b);start=Math.max(0,size-n)}
      else{start=Number(a);if(b)end=Math.min(size-1,Number(b));}
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>end||start>=size)return res.status(416).end();
    }
    res.setHeader('Content-Type',CONTENT_TYPES[ext]||'application/octet-stream');
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Accept-Ranges','bytes');
    res.setHeader('Cache-Control','private, max-age=60');
    res.setHeader('Content-Length',end-start+1);
    if(range){res.status(206);res.setHeader('Content-Range',`bytes ${start}-${end}/${size}`)}
    if(req.method==='HEAD')return res.end();
    const stream=createReadStream(real,{start,end});
    stream.on('error',()=>{if(!res.headersSent)res.status(500);res.end()});
    res.on('close',()=>stream.destroy());stream.pipe(res);
  }catch(error){return res.status(400).json({error:String(error.message||error)})}
}
