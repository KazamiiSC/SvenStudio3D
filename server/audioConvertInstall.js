// Save browser-converted PCM WAVs only under Sven Co-op's addon sound folder.
// No arbitrary destination paths and no overwrite of existing files.
import fs from 'node:fs/promises';
import path from 'node:path';
import {soundRoots} from './soundAssets.js';
function validPcmWav(data){
  if(!Buffer.isBuffer(data)||data.length<44||data.length>39*1024*1024||data.toString('ascii',0,4)!=='RIFF'||data.toString('ascii',8,12)!=='WAVE')return false;
  let i=12,fmt=null,soundBytes=0;
  while(i+8<=data.length){
    const id=data.toString('ascii',i,i+4),length=data.readUInt32LE(i+4);
    if(length>data.length-i-8)return false;
    if(id==='fmt '&&length>=16){fmt={format:data.readUInt16LE(i+8),channels:data.readUInt16LE(i+10),rate:data.readUInt32LE(i+12),depth:data.readUInt16LE(i+22)}};
    if(id==='data')soundBytes=length;
    i+=8+length+(length%2);
  }
  return Boolean(fmt&&fmt.format===1&&[1,2].includes(fmt.channels)&&[11025,22050,44100].includes(fmt.rate)&&[8,16].includes(fmt.depth)&&soundBytes>0&&soundBytes%(fmt.channels*fmt.depth/8)===0);
}
export async function installConvertedSound(req,res){
  try{
    const gameDir=String(req.query.gameDir||'');
    const incoming=String(req.query.name||'');
    if(!/^[a-zA-Z0-9_-]{1,65}\.wav$/.test(incoming))throw Error('Invalid WAV filename.');
    if(!validPcmWav(req.body))throw Error('Only valid PCM WAV, 8/16-bit, 11/22/44 kHz is accepted.');
    const roots=await soundRoots(gameDir);
    const addon=roots.find(r=>r.source==='svencoop_addon');
    if(!addon)throw Error('svencoop_addon/sound directory not found. Configure Sven Co-op in Settings.');
    const destinationDir=path.join(addon.root,'svenstudio_imports');
    await fs.mkdir(destinationDir,{recursive:true});
    const realDir=await fs.realpath(destinationDir);
    if(!realDir.startsWith(addon.root+path.sep))throw Error('Invalid destination directory.');
    const extension=path.extname(incoming),base=path.basename(incoming,extension);
    let name=incoming,dest;
    for(let n=0;n<=99;n++){
      name=n?`${base.slice(0,58)}_${n}${extension}`:incoming;
      dest=path.join(realDir,name);
      try{await fs.writeFile(dest,req.body,{flag:'wx'});return res.json({path:`svenstudio_imports/${name}`,name,bytes:req.body.length});}
      catch(err){if(err.code!=='EEXIST')throw err}
    }
    throw Error('Too many files with the same name.');
  }catch(err){res.status(400).json({error:String(err.message||err)})}
}
