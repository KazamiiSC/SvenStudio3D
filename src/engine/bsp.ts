/** Read-only GoldSrc / Svengine BSP30 reader. No BSP data is ever written back. */
import type {Vec3} from './types';

export interface BspTexture {name:string;width:number;height:number;rgba?:Uint8Array;external:boolean}
export interface BspEntity {classname:string;origin?:Vec3;properties:Record<string,string>}
export interface BspFace {
  texture:number; flags:number; model:number; points:Vec3[];
  /** Stable source indices in BSP30 lumps. Never use the filtered array index for writes. */
  bspFaceIndex?:number;texinfoIndex?:number;planeIndex?:number;planeSide?:number;lightmapOffset?:number;
  texels:[number,number][]; normal:Vec3;
  /** Raw compiled texinfo axes and shifts for loss-minimizing MAP recovery. */
  sTexinfo?:[number,number,number,number];tTexinfo?:[number,number,number,number];
  lightWidth:number; lightHeight:number; lightRgb?:Uint8Array;
  /** All compiled face lightstyle numbers and their individual RGB layers. */
  lightStyles?:number[];lightLayers?:Uint8Array[];
  lightMin:[number,number];
}
export interface BspMap {
  name:string;version:30;entities:BspEntity[];textures:BspTexture[];faces:BspFace[];
  skyname:string;wadNames:string[];warnings:string[];
  stats:{vertices:number;faces:number;models:number;leaves:number;entities:number;lightmappedFaces:number;embeddedTextures:number};
  bounds:{min:Vec3;max:Vec3};
}
const MAX_FILE=256*1024*1024;
const ascii=(v:DataView,at:number,len:number)=>{
  let text='';for(let i=0;i<len;i++){const c=v.getUint8(at+i);if(c===0)break;text+=String.fromCharCode(c)}return text;
};
const getOrigin=(value:string|undefined):Vec3|undefined=>{
  if(!value)return;
  const coords=value.trim().split(/\s+/).map(Number);
  return coords.length===3&&coords.every(Number.isFinite)?coords as Vec3:undefined;
};
export function parseBspEntities(text:string):BspEntity[]{
  const entities:BspEntity[]=[];
  // GoldSrc uses brace-delimited blocks of quoted key/value pairs; support escaped quotes.
  const unescape=(str:string)=>str.replace(/\\([\\"])/g,'$1');
  const entityRegex=/\{([^{}]*)\}/g;
  for(const match of text.matchAll(entityRegex)){
    const properties:Record<string,string>={};
    const keyValue=/"((?:\\.|[^"\\])*)"\s*"((?:\\.|[^"\\])*)"/g;
    for(const kv of match[1].matchAll(keyValue))properties[unescape(kv[1])]=unescape(kv[2]);
    if(Object.keys(properties).length)entities.push({classname:properties.classname||'unknown',origin:getOrigin(properties.origin),properties});
    if(entities.length>100000)throw Error('BSP entity limit exceeded.');
  }
  return entities;
}
export function parseBsp(buffer:ArrayBuffer,name='map.bsp'):BspMap{
  if(buffer.byteLength<124||buffer.byteLength>MAX_FILE)throw Error('BSP file is empty, incomplete or exceeds 256 MB.');
  const v=new DataView(buffer);
  if(v.getInt32(0,true)!==30)throw Error('Only GoldSrc / Svengine BSP version 30 is supported.');
  const lumps=Array.from({length:15},(_,i)=>{
    const start=v.getInt32(4+i*8,true),size=v.getInt32(8+i*8,true);
    if(start<0||size<0||start>buffer.byteLength||size>buffer.byteLength-start)throw Error(`Invalid BSP lump #${i}.`);
    return {start,size};
  });
  const count=(id:number,stride:number,max:number)=>{
    const n=lumps[id].size/stride;
    if(!Number.isInteger(n)||n>max)throw Error(`Malformed or oversized BSP lump #${id}.`);
    return n;
  };
  const vertexCount=count(3,12,300000),edgeCount=count(12,4,400000),surfedgeCount=count(13,4,800000);
  const faceCount=count(7,20,200000),texinfoCount=count(6,40,100000),modelCount=count(14,64,4096);
  const leafCount=count(10,28,200000);
  const warnings:string[]=[];
  const vertices:Vec3[]=Array.from({length:vertexCount},(_,i)=>{
    const p=lumps[3].start+i*12;
    return [v.getFloat32(p,true),v.getFloat32(p+4,true),v.getFloat32(p+8,true)];
  });
  const edges:Array<[number,number]>=Array.from({length:edgeCount},(_,i)=>{
    const p=lumps[12].start+i*4;return [v.getUint16(p,true),v.getUint16(p+2,true)];
  });
  const surfedges=Int32Array.from({length:surfedgeCount},(_,i)=>v.getInt32(lumps[13].start+i*4,true));
  const infos=Array.from({length:texinfoCount},(_,i)=>{
    const p=lumps[6].start+i*40;
    const s:[number,number,number,number]=[0,4,8,12].map(o=>v.getFloat32(p+o,true)) as [number,number,number,number];
    const t:[number,number,number,number]=[16,20,24,28].map(o=>v.getFloat32(p+o,true)) as [number,number,number,number];
    return {s,t,index:v.getInt32(p+32,true),flags:v.getInt32(p+36,true)};
  });
  const textures:BspTexture[]=[];
  const tex=lumps[2];
  if(tex.size>=4){
    const n=v.getInt32(tex.start,true);
    if(n<0||n>32768||4+n*4>tex.size)throw Error('Invalid BSP miptexture directory.');
    for(let i=0;i<n;i++){
      const rel=v.getInt32(tex.start+4+i*4,true);
      if(rel<0||rel+40>tex.size){textures.push({name:`MISSING_${i}`,width:16,height:16,external:true});continue}
      const pos=tex.start+rel,name=ascii(v,pos,16)||`MISSING_${i}`;
      const width=v.getUint32(pos+16,true),height=v.getUint32(pos+20,true),mip=v.getUint32(pos+24,true);
      if(width<1||height<1||width>4096||height>4096||width*height>4194304){
        warnings.push(`Invalid texture size: ${name}`);textures.push({name,width:16,height:16,external:true});continue;
      }
      const entry:BspTexture={name,width,height,external:!mip};
      if(mip>=40&&rel+mip+width*height<=tex.size){
        const mip3=v.getUint32(pos+36,true);
        const paletteAt=pos+mip3+Math.max(1,width>>3)*Math.max(1,height>>3);
        if(mip3>0&&paletteAt+2<=tex.start+tex.size){
          const colors=v.getUint16(paletteAt,true),pal=paletteAt+2;
          if(colors>=1&&colors<=256&&pal+colors*3<=tex.start+tex.size){
            const pixels=new Uint8Array(width*height*4),idx=new Uint8Array(buffer,pos+mip,width*height);
            for(let px=0;px<idx.length;px++){
              const ci=idx[px],c=pal+Math.min(ci,colors-1)*3,o=px*4;
              pixels[o]=v.getUint8(c);pixels[o+1]=v.getUint8(c+1);pixels[o+2]=v.getUint8(c+2);
              pixels[o+3]=name[0]==='{'&&ci===255?0:255;
            }
            entry.rgba=pixels;entry.external=false;
          }
        }
      }
      textures.push(entry);
    }
  }
  const models=Array.from({length:modelCount},(_,i)=>{
    const p=lumps[14].start+i*64;
    return {first:v.getInt32(p+56,true),count:v.getInt32(p+60,true)};
  });
  const faces:BspFace[]=[];
  let lightmappedFaces=0,skipped=0;
  for(let index=0;index<faceCount;index++){
    const p=lumps[7].start+index*20,first=v.getInt32(p+4,true),n=v.getUint16(p+8,true);
    const texinfoIndex=v.getUint16(p+10,true),info=infos[texinfoIndex];
    if(!info||n<3||n>512||first<0||first+n>surfedges.length){skipped++;continue}
    const points:Vec3[]=[];
    for(let i=0;i<n;i++){
      const signed=surfedges[first+i],edge=edges[Math.abs(signed)];
      const vertex=edge&&vertices[edge[signed<0?1:0]];
      if(!vertex){points.length=0;break}
      points.push(vertex);
    }
    if(points.length!==n){skipped++;continue}
    const texels=points.map(point=>[
      point[0]*info.s[0]+point[1]*info.s[1]+point[2]*info.s[2]+info.s[3],
      point[0]*info.t[0]+point[1]*info.t[1]+point[2]*info.t[2]+info.t[3]
    ] as [number,number]);
    const side=v.getUint16(p+2,true),planeId=v.getUint16(p,true),planeAt=lumps[1].start+planeId*20;
    let normal:Vec3=[0,0,1];
    if(planeAt+12<=lumps[1].start+lumps[1].size){
      const sign=side?-1:1;
      normal=[v.getFloat32(planeAt,true)*sign,v.getFloat32(planeAt+4,true)*sign,v.getFloat32(planeAt+8,true)*sign];
    }
    const minU=Math.floor(Math.min(...texels.map(t=>t[0]))/16),maxU=Math.ceil(Math.max(...texels.map(t=>t[0]))/16);
    const minV=Math.floor(Math.min(...texels.map(t=>t[1]))/16),maxV=Math.ceil(Math.max(...texels.map(t=>t[1]))/16);
    const lightWidth=maxU-minU+1,lightHeight=maxV-minV+1;
    const offset=v.getInt32(p+16,true),light=lumps[8];
    const lightCount=lightWidth*lightHeight*3;
    const lightStyles=[0,1,2,3].map(i=>v.getUint8(p+12+i)).filter(style=>style!==255);
    let lightRgb:Uint8Array|undefined;let lightLayers:Uint8Array[]|undefined;
    if(offset>=0&&lightWidth>0&&lightHeight>0&&lightWidth<=256&&lightHeight<=256&&lightStyles.length&&lightCount*lightStyles.length<=light.size-offset){
      // GoldSrc stores consecutive RGB lightmap layers for each active face style.
      lightLayers=lightStyles.map((_,styleIndex)=>new Uint8Array(buffer,light.start+offset+styleIndex*lightCount,lightCount).slice());
      lightRgb=lightLayers[lightStyles.indexOf(0)>=0?lightStyles.indexOf(0):0];
      lightmappedFaces++;
    }
    const model=Math.max(0,models.findIndex(m=>index>=m.first&&index<m.first+m.count));
    faces.push({bspFaceIndex:index,texinfoIndex,planeIndex:planeId,planeSide:side,lightmapOffset:offset,texture:info.index,flags:info.flags,model,points,texels,normal,sTexinfo:info.s,tTexinfo:info.t,lightWidth,lightHeight,lightRgb,lightStyles,lightLayers,lightMin:[minU,minV]});
  }
  if(skipped)warnings.push(`${skipped} malformed faces were skipped.`);
  const entitiesText=new TextDecoder('latin1').decode(new Uint8Array(buffer,lumps[0].start,lumps[0].size));
  const entities=parseBspEntities(entitiesText);
  const world=entities.find(e=>e.classname==='worldspawn')?.properties||{};
  const wadNames=[...new Set((world.wad||'').split(';').map(s=>s.trim().split(/[\\/]/).pop()||'').filter(Boolean))];
  if(textures.some(t=>t.external))warnings.push('Some textures are external; import their WAD3 files in BSP Viewer.');
  if(!modelCount)warnings.push('No model table was found.');
  const min:Vec3=[Infinity,Infinity,Infinity],max:Vec3=[-Infinity,-Infinity,-Infinity];
  for(const face of faces)for(const pt of face.points)for(let ax=0;ax<3;ax++){min[ax]=Math.min(min[ax],pt[ax]);max[ax]=Math.max(max[ax],pt[ax]);}
  if(!Number.isFinite(min[0])){min.fill(0);max.fill(0)}
  return {name,version:30,faces,textures,entities,skyname:world.skyname||'',wadNames,warnings,
    stats:{vertices:vertexCount,faces:faceCount,models:modelCount,leaves:leafCount,entities:entities.length,lightmappedFaces,embeddedTextures:textures.filter(t=>!!t.rgba).length},bounds:{min,max}};
}
