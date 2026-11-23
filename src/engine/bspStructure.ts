/** v2.6 bspguy-style structure tools for BSP30 (no decompile, no recompile).
 * - bspLumpUsage: lump counts against the SDHLT compiler limits.
 * - pruneUnusedBspModels: drops *N models no entity references and renumbers "model" keys.
 * - addBspBoxModels: appends new invisible box bmodels (triggers / clip walls) with their own
 *   hull-0 nodes and hull 1-3 clipnodes, so they collide and trigger like compiled brushes.
 * Every writer appends new lumps to a copy and re-validates; call compactBspCopy afterwards. */
import {readNativeBsp} from './bspNativeEdit';

export const LUMP={entities:0,planes:1,textures:2,vertexes:3,visibility:4,nodes:5,texinfo:6,faces:7,lighting:8,clipnodes:9,leafs:10,marksurfaces:11,edges:12,surfedges:13,models:14} as const;
const SIZE:Partial<Record<number,number>>={1:20,3:12,5:24,6:40,7:20,9:8,10:28,11:2,12:4,13:4,14:64};
/** SDHLT bspfile.h limits (the engine may accept a little more for some lumps). */
const LIMITS:{key:keyof typeof LUMP|'textureCount';label:string;max:number;bytes?:boolean}[]=[
  {key:'models',label:'Brush models',max:512},{key:'planes',label:'Planes',max:32768},{key:'clipnodes',label:'Clipnodes',max:32767},
  {key:'nodes',label:'Nodes',max:32767},{key:'leafs',label:'Leaves',max:32760},{key:'faces',label:'Faces',max:65535},
  {key:'vertexes',label:'Vertices',max:65535},{key:'texinfo',label:'Texinfo',max:32767},{key:'marksurfaces',label:'Marksurfaces',max:65535},
  {key:'edges',label:'Edges',max:256000},{key:'surfedges',label:'Surfedges',max:512000},{key:'textureCount',label:'Textures',max:512},
  {key:'lighting',label:'Lightmap data',max:0x2000000,bytes:true},{key:'visibility',label:'Visibility data',max:0x800000,bytes:true},
  {key:'entities',label:'Entity data',max:2*1024*1024,bytes:true},
];
export type BspLumpUsage={key:string;label:string;count:number;max:number;percent:number;bytes:boolean};

function header(bytes:ArrayBuffer){
  const v=new DataView(bytes);if(bytes.byteLength<124||v.getInt32(0,true)!==30)throw Error('Only BSP v30 is supported.');
  return Array.from({length:15},(_,i)=>({offset:v.getInt32(4+i*8,true),length:v.getInt32(8+i*8,true)}));
}
export function bspLumpUsage(bytes:ArrayBuffer):BspLumpUsage[]{
  const h=header(bytes),v=new DataView(bytes);
  const count=(i:number)=>SIZE[i]?Math.floor(h[i].length/SIZE[i]!):h[i].length;
  const textureCount=h[2].length>=4?v.getInt32(h[2].offset,true):0;
  return LIMITS.map(l=>{const n=l.key==='textureCount'?textureCount:count(LUMP[l.key as keyof typeof LUMP]);
    return {key:l.key,label:l.label,count:n,max:l.max,percent:Math.round(n/l.max*1000)/10,bytes:!!l.bytes};});
}

/** Copy of `bytes` with the given lumps replaced (appended, 4-byte aligned). Unlisted lumps keep their bytes. */
export function replaceBspLumps(bytes:ArrayBuffer,replace:Partial<Record<number,Uint8Array>>):ArrayBuffer{
  const entries=Object.entries(replace) as [string,Uint8Array][];
  let size=(bytes.byteLength+3)&~3;const placed:[number,number,Uint8Array][]=[];
  for(const [k,data] of entries){placed.push([Number(k),size,data]);size=(size+data.byteLength+3)&~3;}
  const out=new Uint8Array(size);out.set(new Uint8Array(bytes));const v=new DataView(out.buffer);
  for(const [i,offset,data] of placed){out.set(data,offset);v.setInt32(4+i*8,offset,true);v.setInt32(8+i*8,data.byteLength,true);}
  return out.buffer;
}
const latin1=(b:Uint8Array)=>{let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));return s;};
const toLatin1=(s:string)=>{const o=new Uint8Array(s.length+1);for(let i=0;i<s.length;i++){const c=s.charCodeAt(i);if(c>255)throw Error('Non Latin-1 entity text.');o[i]=c;}return o;};
function entityText(bytes:ArrayBuffer){const h=header(bytes);const b=new Uint8Array(bytes,h[0].offset,h[0].length);const z=b.indexOf(0);return latin1(z<0?b:b.subarray(0,z));}

/** Removes *N models that no entity references. Geometry stays in the file (unreferenced); the model
 * count drops, which matters for the brush-model / precache limits. */
export function pruneUnusedBspModels(bytes:ArrayBuffer):{bytes:ArrayBuffer;removed:number[]}{
  const h=header(bytes);const count=Math.floor(h[14].length/64);
  const text=entityText(bytes);
  const used=new Set<number>([0]);for(const m of text.matchAll(/"model"\s+"\*(\d+)"/g))used.add(Number(m[1]));
  const removed=[...Array(count).keys()].filter(i=>!used.has(i));
  if(!removed.length)return {bytes:bytes.slice(0),removed};
  const map=new Map<number,number>();let next=0;
  const models=new Uint8Array((count-removed.length)*64),src=new Uint8Array(bytes,h[14].offset,h[14].length);
  for(let i=0;i<count;i++){if(!used.has(i))continue;map.set(i,next);models.set(src.subarray(i*64,i*64+64),next*64);next++;}
  const newText=text.replace(/("model"\s+")\*(\d+)(")/g,(all,a,n,b)=>map.has(Number(n))?`${a}*${map.get(Number(n))}${b}`:all);
  const out=replaceBspLumps(bytes,{[LUMP.models]:models,[LUMP.entities]:toLatin1(newText)});
  readNativeBsp(out);
  return {bytes:out,removed};
}

export type BspBoxModel={classname:string;mins:[number,number,number];maxs:[number,number,number];props:Record<string,string>};
/** Hull sizes used by GoldSrc for players (1 standing, 3 crouched) and large monsters (2). */
const HULLS:[[number,number,number],[number,number,number]][]=[[[0,0,0],[0,0,0]],[[-16,-16,-36],[16,16,36]],[[-32,-32,-32],[32,32,32]],[[-16,-16,-18],[16,16,18]]];
export const BSP_BOX_CLASSES=['trigger_once','trigger_multiple','trigger_hurt','trigger_push','trigger_teleport','trigger_changelevel','trigger_gravity','func_wall'] as const;

export function addBspBoxModels(bytes:ArrayBuffer,boxes:readonly BspBoxModel[]):ArrayBuffer{
  if(!boxes.length)return bytes.slice(0);
  const h=header(bytes);
  for(const b of boxes){
    if(!/^[a-z_][a-z0-9_]{0,63}$/i.test(b.classname)||b.classname==='worldspawn')throw Error('Invalid box entity classname.');
    if(b.mins.some((m,i)=>!Number.isFinite(m)||!Number.isFinite(b.maxs[i])||b.maxs[i]-m<1||Math.abs(m)>32000||Math.abs(b.maxs[i])>32000))throw Error('Box must be at least 1 unit on each axis and inside ±32000.');
  }
  const planes0=new Uint8Array(bytes,h[1].offset,h[1].length),nodes0=new Uint8Array(bytes,h[5].offset,h[5].length);
  const clip0=new Uint8Array(bytes,h[9].offset,h[9].length),leafs0=new Uint8Array(bytes,h[10].offset,h[10].length),models0=new Uint8Array(bytes,h[14].offset,h[14].length);
  let planeCount=planes0.length/20,nodeCount=nodes0.length/24,clipCount=clip0.length/8,modelCount=models0.length/64;
  const leafCount=leafs0.length/28;
  if(modelCount+boxes.length>4096)throw Error('Too many brush models.');
  const planes:number[][]=[],nodes:number[][]=[],clips:number[][]=[],models:{mins:number[];maxs:number[];heads:number[]}[]=[];
  // One shared EMPTY leaf for every new hull-0 tree (leaf 0 is always the SOLID leaf).
  const emptyLeaf=leafCount;
  const addPlane=(axis:number,dist:number)=>{planes.push([axis,dist]);return planeCount+planes.length-1;};
  for(const b of boxes){
    const heads:number[]=[];
    for(let hull=0;hull<4;hull++){
      const [hmin,hmax]=HULLS[hull];
      const lo=b.mins.map((m,i)=>m-hmax[i]),hi=b.maxs.map((m,i)=>m-hmin[i]);
      const steps:{plane:number;inside:'back'|'front'}[]=[];
      for(let axis=0;axis<3;axis++){steps.push({plane:addPlane(axis,hi[axis]),inside:'back'});steps.push({plane:addPlane(axis,lo[axis]),inside:'front'});}
      if(hull===0){
        const start=nodeCount+nodes.length;heads.push(start);
        steps.forEach((s,k)=>{const inner=k===steps.length-1?-1:start+k+1;const outer=-(emptyLeaf+1);
          nodes.push([s.plane,s.inside==='front'?inner:outer,s.inside==='front'?outer:inner,...b.mins.map(Math.floor),...b.maxs.map(Math.ceil)]);});
      }else{
        const start=clipCount+clips.length;heads.push(start);
        steps.forEach((s,k)=>{const inner=k===steps.length-1?-2:start+k+1;clips.push([s.plane,s.inside==='front'?inner:-1,s.inside==='front'?-1:inner]);});
      }
    }
    models.push({mins:b.mins,maxs:b.maxs,heads});
  }
  const cat=(a:Uint8Array,size:number)=>{const o=new Uint8Array(a.length+size);o.set(a);return o;};
  const P=cat(planes0,planes.length*20),pv=new DataView(P.buffer);
  planes.forEach(([axis,dist],k)=>{const o=planes0.length+k*20;pv.setFloat32(o+axis*4,1,true);pv.setFloat32(o+12,dist,true);pv.setInt32(o+16,axis,true);});
  const N=cat(nodes0,nodes.length*24),nv=new DataView(N.buffer);
  nodes.forEach((n,k)=>{const o=nodes0.length+k*24;nv.setInt32(o,n[0],true);nv.setInt16(o+4,n[1],true);nv.setInt16(o+6,n[2],true);for(let i=0;i<6;i++)nv.setInt16(o+8+i*2,Math.max(-32768,Math.min(32767,n[3+i])),true);nv.setUint16(o+20,0,true);nv.setUint16(o+22,0,true);});
  const C=cat(clip0,clips.length*8),cv=new DataView(C.buffer);
  clips.forEach((c,k)=>{const o=clip0.length+k*8;cv.setInt32(o,c[0],true);cv.setInt16(o+4,c[1],true);cv.setInt16(o+6,c[2],true);});
  const L=cat(leafs0,28),lv=new DataView(L.buffer);{const o=leafs0.length;lv.setInt32(o,-1,true);lv.setInt32(o+4,-1,true);}
  const M=cat(models0,models.length*64),mv=new DataView(M.buffer);
  models.forEach((m,k)=>{const o=models0.length+k*64;for(let i=0;i<3;i++){mv.setFloat32(o+i*4,m.mins[i],true);mv.setFloat32(o+12+i*4,m.maxs[i],true);mv.setFloat32(o+24+i*4,0,true);}
    m.heads.forEach((hd,i)=>mv.setInt32(o+36+i*4,hd,true));mv.setInt32(o+52,0,true);mv.setInt32(o+56,0,true);mv.setInt32(o+60,0,true);});
  if(nodeCount+nodes.length>32767||clipCount+clips.length>32767||planeCount+planes.length>65535)throw Error('Adding these boxes would exceed the node, clipnode or plane limit.');
  let text=entityText(bytes);
  boxes.forEach((b,k)=>{const props=Object.entries(b.props).filter(([key,v])=>key&&v!==''&&!['classname','model','origin'].includes(key));
    for(const [key,v] of props)if(!/^[A-Za-z_][A-Za-z0-9_.$-]{0,63}$/.test(key)||/["\r\n\0]/.test(v)||v.length>1024)throw Error(`Invalid keyvalue ${key}.`);
    text+=`{\n"classname" "${b.classname}"\n"model" "*${modelCount+k}"\n${props.map(([key,v])=>`"${key}" "${v}"\n`).join('')}}\n`;});
  const out=replaceBspLumps(bytes,{[LUMP.planes]:P,[LUMP.nodes]:N,[LUMP.clipnodes]:C,[LUMP.leafs]:L,[LUMP.models]:M,[LUMP.entities]:toLatin1(text)});
  readNativeBsp(out);
  return out;
}
/** Point-in-hull test used by tests and previews: walks a clip hull like the engine does. */
export function bspHullContents(bytes:ArrayBuffer,model:number,hull:1|2|3,point:[number,number,number]):number{
  const h=header(bytes),v=new DataView(bytes);
  let node=v.getInt32(h[14].offset+model*64+36+hull*4,true);
  while(node>=0){const o=h[9].offset+node*8;const plane=v.getInt32(o,true);const po=h[1].offset+plane*20;
    const n=[v.getFloat32(po,true),v.getFloat32(po+4,true),v.getFloat32(po+8,true)],d=v.getFloat32(po+12,true);
    const side=n[0]*point[0]+n[1]*point[1]+n[2]*point[2]-d>=0?0:1;node=v.getInt16(o+4+side*2,true);}
  return node;
}
