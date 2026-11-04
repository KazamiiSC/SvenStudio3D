import * as THREE from 'three';
/** Read-only GoldSrc / Svengine studio v10 preview data. Svengine runtime is
 * authoritative: engine-side blending, IK, procedural bones and render flags
 * are not simulated. All offsets are bounds checked before use. */
export type StudioMesh={positions:Float32Array;localPositions:Float32Array;boneIndices:Uint8Array;uvs:Float32Array;texture:number;skinref:number};
export type StudioBodypart={name:string;base:number;models:{name:string;meshes:StudioMesh[]}[]};
export type StudioSequence={name:string;frames:number;fps:number;loop:boolean;group:number;blends:number;available:boolean};
export type StudioPreview={name:string;meshes:StudioMesh[];bodyparts:StudioBodypart[];skins:number[][];
 textures:{width:number;height:number;rgba:Uint8Array;flags:number;name:string}[];
 sequences:StudioSequence[];missingTextures:boolean;triangles:number;warnings:string[];
 samplePose:(sequence:number,frame:number)=>THREE.Matrix4[];
};
const int=(v:DataView,p:number)=>v.getInt32(p,true);
const MAX_MDL_BYTES=32*1024*1024;
export function parseGoldSrcMdl(buffer:ArrayBuffer,textureCompanion?:ArrayBuffer,sequenceGroups:Record<number,ArrayBuffer>={}):StudioPreview{
 if(buffer.byteLength<244||buffer.byteLength>MAX_MDL_BYTES)throw Error('Model must be 244 bytes to 32 MiB.');
 const v=new DataView(buffer);
 const check=(data:ArrayBuffer,offset:number,length:number)=>{if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||offset<0||length<0||offset+length>data.byteLength)throw Error('MDL data offset outside file.');};
 const text=(data:ArrayBuffer,p:number,n:number)=>{check(data,p,n);const bytes=new Uint8Array(data,p,n),end=bytes.indexOf(0);return new TextDecoder('latin1').decode(bytes.subarray(0,end<0?n:end));};
 if(text(buffer,0,4)!=='IDST'||int(v,4)!==10)throw Error('Only GoldSrc / Svengine IDST version 10 is supported.');
 const table=(data:ArrayBuffer,offset:number,count:number,stride:number,max:number)=>{if(count<0||count>max)throw Error('Too many MDL records.');check(data,offset,count*stride)};
 const nBones=int(v,140),boneIdx=int(v,144),nSeq=int(v,164),seqIdx=int(v,168);
 const nParts=int(v,204),partIdx=int(v,208),nGroups=int(v,172),groupIdx=int(v,176);
 table(buffer,boneIdx,nBones,112,256);table(buffer,partIdx,nParts,76,64);table(buffer,seqIdx,nSeq,176,2048);
 if(nGroups)table(buffer,groupIdx,nGroups,104,32);
 const bones:{parent:number;defaults:number[];scales:number[];world:THREE.Matrix4}[]=[];
 for(let i=0;i<nBones;i++){
  const p=boneIdx+i*112,parent=int(v,p+32);
  if(parent>=i||parent < -1)throw Error('Invalid bone parent hierarchy.');
  const defaults=Array.from({length:6},(_,axis)=>v.getFloat32(p+64+axis*4,true));
  const scales=Array.from({length:6},(_,axis)=>v.getFloat32(p+88+axis*4,true));
  const local=composeBone(defaults),world=parent>=0?bones[parent].world.clone().multiply(local):local;
  bones.push({parent,defaults,scales,world});
 }
 const warnings:string[]=[];
 const rawSequences:{animIndex:number;numFrames:number;group:number;blends:number}[]=[];
 const sequences:StudioSequence[]=[];
 const dataOffsets=Array.from({length:Math.max(1,nGroups)},(_,i)=>i===0&&nGroups?v.getInt32(groupIdx+100,true):0);
 for(let i=0;i<nSeq;i++){
  const p=seqIdx+i*176;check(buffer,p,176);
  const group=int(v,p+156),blends=int(v,p+120),animIndex=int(v,p+124),frames=int(v,p+56),fps=v.getFloat32(p+32,true);
  const external=group>0?sequenceGroups[group]:buffer;
  let available=false;
  if(group>=0 && group<Math.max(1,nGroups) && external && frames>0 && frames<100000 && blends>0 && blends<=4){
   const base=(group===0?dataOffsets[0]:0)+animIndex;
   available=nBones>0&&base>=0&&base+nBones*12<=external.byteLength;
  }
  rawSequences.push({group,blends,animIndex,numFrames:frames});
  sequences.push({name:text(buffer,p,32),frames:Math.max(0,frames),fps:Number.isFinite(fps)?fps:0,
   loop:(int(v,p+36)&1)!==0,group,blends,available});
 }
 if(sequences.some(seq=>seq.group>0&&!seq.available))warnings.push('Some animation sequences use external 01.mdl / 02.mdl groups that could not be loaded.');
 if(sequences.some(seq=>seq.blends>1))warnings.push('Multi-blend sequences are previewed at their first blend only.');
 if(nBones===0&&nSeq>0)warnings.push('Model has no bones; animation playback is unavailable.');
 const texBuffer=int(v,180)>0?buffer:textureCompanion;
 const textures:StudioPreview['textures']=[];let missingTextures=false;
 let skins:number[][]=[];
 if(texBuffer){
  const tv=new DataView(texBuffer);
  if(texBuffer.byteLength<244||text(texBuffer,0,4)!=='IDST'||int(tv,4)!==10)throw Error('External T.mdl file is invalid.');
  const numTex=int(tv,180),texOffset=int(tv,184);
  table(texBuffer,texOffset,numTex,80,1024);
  for(let i=0;i<numTex;i++){
   const p=texOffset+i*80,w=int(tv,p+68),h=int(tv,p+72),offset=int(tv,p+76),flags=int(tv,p+64);
   if(w<=0||h<=0||w>2048||h>2048||w*h>4_194_304)throw Error('Invalid texture dimensions.');
   check(texBuffer,offset,w*h+768);
   const pixels=new Uint8Array(texBuffer,offset,w*h),palette=new Uint8Array(texBuffer,offset+w*h,768),rgba=new Uint8Array(w*h*4);
   for(let j=0;j<pixels.length;j++){const index=pixels[j];rgba[j*4]=palette[index*3];rgba[j*4+1]=palette[index*3+1];rgba[j*4+2]=palette[index*3+2];rgba[j*4+3]=(flags&0x0040)&&index===255?0:255;}
   textures.push({width:w,height:h,rgba,flags,name:text(texBuffer,p,64)});
  }
  const readSkinTable=(data:ArrayBuffer):number[][]|null=>{
   if(data.byteLength<244)return null;
   const sv=new DataView(data),refs=int(sv,192),families=int(sv,196),offset=int(sv,200);
   if(refs<=0||refs>2048||families<=0||families>512||offset<0||offset+refs*families*2>data.byteLength)return null;
   const rows=Array.from({length:families},(_,family)=>Array.from({length:refs},(_,i)=>sv.getUint16(offset+(family*refs+i)*2,true)));
   return rows.every(row=>row.every(idx=>idx<numTex))?rows:null;
  };
  skins=readSkinTable(buffer)??readSkinTable(texBuffer)??[textures.map((_,i)=>i)];
 }else{missingTextures=true;warnings.push('Missing external texture model (*T.mdl). Textured preview is incomplete.');}
 if(textures.some(t=>(t.flags&0x0002)!==0))warnings.push('Chrome materials are approximated.');
 if(textures.some(t=>(t.flags&0x0010)!==0))warnings.push('Alpha render flags may differ from Svengine.');
 const bodyparts:StudioBodypart[]=[];let triangles=0;
 for(let b=0;b<nParts;b++){
  const p=partIdx+b*76,nModels=int(v,p+64),base=int(v,p+68),modelIdx=int(v,p+72);
  table(buffer,modelIdx,nModels,112,100);
  const models:StudioBodypart['models']=[];
  for(let mdl=0;mdl<nModels;mdl++){
   const mp=modelIdx+mdl*112,nMeshes=int(v,mp+72),meshIdx=int(v,mp+76),nVerts=int(v,mp+80);
   const boneInfo=int(v,mp+84),vertexIdx=int(v,mp+88);
   table(buffer,meshIdx,nMeshes,20,256);table(buffer,vertexIdx,nVerts,12,100000);check(buffer,boneInfo,nVerts);
   const localPoints:THREE.Vector3[]=[];const worldPoints:THREE.Vector3[]=[];const boneIds:number[]=[];
   for(let j=0;j<nVerts;j++){
    const p=vertexIdx+j*12,local=new THREE.Vector3(v.getFloat32(p,true),v.getFloat32(p+4,true),v.getFloat32(p+8,true));
    const bone=nBones?new Uint8Array(buffer,boneInfo+j,1)[0]:0;
    if(nBones&&bone>=nBones)throw Error('MDL vertex references missing bone.');
    localPoints.push(local);boneIds.push(bone);
    const world=local.clone();if(nBones)world.applyMatrix4(bones[bone].world);
    worldPoints.push(convertVertex(world));
   }
   const meshes:StudioMesh[]=[];
   for(let m=0;m<nMeshes;m++){
    const p=meshIdx+m*20,command=int(v,p+4),skinref=int(v,p+8),texture=skins[0]?.[skinref]??skinref;
    const t=textures[texture];let at=command;const positions:number[]=[],localPositions:number[]=[],uvs:number[]=[],boneIndices:number[]=[];
    let terminated=false;
    for(let safety=0;safety<30000;safety++){
     check(buffer,at,2);const n=v.getInt16(at,true);at+=2;
     if(n===0){terminated=true;break;}
     if(Math.abs(n)>10000)throw Error('MDL triangle strip too large.');
     const verts:{index:number;u:number;v:number}[]=[];
     for(let k=0;k<Math.abs(n);k++){
      check(buffer,at,8);
      const index=v.getInt16(at,true),u=v.getInt16(at+4,true),vv=v.getInt16(at+6,true);at+=8;
      if(index<0||index>=localPoints.length)throw Error('MDL vertex index outside mesh.');
      verts.push({index,u:t?u/t.width:u/64,v:t?1-vv/t.height:1-vv/64});
     }
     for(let i=2;i<verts.length;i++){
      const tri=n>0?(i%2?[i-1,i-2,i]:[i-2,i-1,i]):[0,i-1,i];
      for(const index of tri){const entry=verts[index],point=worldPoints[entry.index],local=localPoints[entry.index];
       positions.push(point.x,point.y,point.z);localPositions.push(local.x,local.y,local.z);boneIndices.push(boneIds[entry.index]);uvs.push(entry.u,entry.v);}
      if(++triangles>150000)throw Error('Model too complex for editor preview.');
     }
    }
    if(!terminated)throw Error('Unterminated MDL triangle commands.');
    if(positions.length)meshes.push({positions:new Float32Array(positions),localPositions:new Float32Array(localPositions),boneIndices:new Uint8Array(boneIndices),uvs:new Float32Array(uvs),texture,skinref});
   }
   models.push({name:text(buffer,mp,64),meshes});
  }
  bodyparts.push({name:text(buffer,p,64),base,models});
 }
 const meshes=bodyparts.flatMap(p=>p.models.find(m=>m.meshes.length)?.meshes||[]);
 if(!meshes.length)throw Error('No mesh geometry found in this MDL file.');
 const baseWorld=bones.map(b=>b.world);
 const samplePose=(sequenceIndex:number,frame:number):THREE.Matrix4[]=>{
  const seq=rawSequences[sequenceIndex],descriptor=sequences[sequenceIndex];
  if(!seq||!descriptor?.available||nBones===0)return baseWorld;
  const data=seq.group===0?buffer:sequenceGroups[seq.group];if(!data)return baseWorld;
  const sv=new DataView(data),base=(seq.group===0?dataOffsets[0]:0)+seq.animIndex;
  const bounded=Math.max(0,Math.min(seq.numFrames-1,Number.isFinite(frame)?frame:0));
  const floor=Math.floor(bounded),frac=bounded-floor;
  const world:THREE.Matrix4[]=[];
  for(let b=0;b<nBones;b++){
   const values=bones[b].defaults.slice();
   for(let axis=0;axis<6;axis++){
    const record=base+b*12,offset=sv.getUint16(record+axis*2,true);
    if(offset){const a=readRleValue(data,record+offset,floor),z=frac>0?readRleValue(data,record+offset,Math.min(floor+1,seq.numFrames-1)):a;
     values[axis]+=(a+(z-a)*frac)*bones[b].scales[axis];}
   }
   const local=composeBone(values),parent=bones[b].parent;
   world.push(parent>=0?world[parent].clone().multiply(local):local);
  }
  return world;
 };
 return {name:text(buffer,8,64),meshes,bodyparts,skins,textures,sequences,missingTextures,triangles,warnings,samplePose};
}
function composeBone(values:number[]):THREE.Matrix4{
 const xyz=new THREE.Vector3(values[0],values[1],values[2]);
 const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(values[3],values[4],values[5],'ZYX'));
 return new THREE.Matrix4().compose(xyz,rotation,new THREE.Vector3(1,1,1));
}
function convertVertex(vertex:THREE.Vector3){return new THREE.Vector3(vertex.x,vertex.z,vertex.y);}
/** GoldSrc's RLE animation stores (valid,total) runs followed by valid short values. */
function readRleValue(data:ArrayBuffer,start:number,frame:number):number{
 const v=new DataView(data);let at=start,remaining=frame;
 for(let guard=0;guard<10000;guard++){
  if(at<0||at+2>data.byteLength)throw Error('Invalid animated-bone data.');
  const valid=v.getUint8(at),total=v.getUint8(at+1);
  if(!total||!valid||valid>total||at+2+valid*2>data.byteLength)throw Error('Invalid MDL animation RLE run.');
  if(remaining<total)return v.getInt16(at+2+Math.min(remaining,valid-1)*2,true);
  remaining-=total;at+=2+valid*2;
 }
 throw Error('MDL animation RLE run limit exceeded.');
}
