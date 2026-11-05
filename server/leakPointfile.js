import fs from 'node:fs/promises';

const MAX_BYTES=1024*1024;
const MAX_POINTS=4096;
// GoldSrc/ZHLT pointfiles are whitespace-separated 3D coordinates; some
// variants wrap points in parentheses. Never interpret diagnostic metadata as
// a coordinate and never trust arbitrary filesystem paths from the browser.
const NUMBER='[+-]?(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?';
const POINT=new RegExp(`^\\s*\\(?\\s*(${NUMBER})\\s+(${NUMBER})\\s+(${NUMBER})\\s*\\)?\\s*$`);
export function parseLeakPointfile(content){
  if(typeof content!=='string'||content.length>MAX_BYTES)return [];
  const points=[];
  for(const line of content.split(/\r?\n/)){
    const match=POINT.exec(line);if(!match)continue;
    const coordinates=match.slice(1).map(Number);
    if(coordinates.some(value=>!Number.isFinite(value)||Math.abs(value)>1e7))continue;
    const last=points[points.length-1];
    if(last?.every((value,index)=>value===coordinates[index]))continue;
    points.push(coordinates);
    if(points.length>20000)break;
  }
  if(points.length<2)return [];
  if(points.length<=MAX_POINTS)return points;
  const sampled=[];
  for(let i=0;i<MAX_POINTS;i++)sampled.push(points[Math.floor(i*(points.length-1)/(MAX_POINTS-1))]);
  return sampled;
}
export async function readBuildLeakPointfile(mapBase){
  // mapBase is created server-side by mkdtemp + a validated map name. No
  // client-supplied absolute path is used here.
  for(const extension of ['.pts','.lin']){
    try{
      const file=mapBase+extension;
      const stat=await fs.stat(file);
      if(!stat.isFile()||stat.size>MAX_BYTES||stat.size<12)continue;
      const points=parseLeakPointfile(await fs.readFile(file,'utf8'));
      if(points.length>1)return {points,extension};
    }catch(error){if(error?.code!=='ENOENT')continue;}
  }
  return null;
}
