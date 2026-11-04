/** v0.5.2: verify genuine GoldSrc IDST v10 skeletal animation, skin families and submodels. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const dir=await fs.mkdtemp(path.join(os.tmpdir(),'sven-studio-052-'));
const root=path.resolve(import.meta.dirname,'..');
function fixture(){
 const data=new ArrayBuffer(5200),v=new DataView(data),b=new Uint8Array(data);
 const i=(at,n)=>v.setInt32(at,n,true),s=(at,name)=>{for(let j=0;j<name.length;j++)b[at+j]=name.charCodeAt(j)};
 s(0,'IDST');i(4,10);s(8,'animated_test');i(72,data.byteLength);
 i(140,1);i(144,400); // Bone table
 i(164,1);i(168,600); // Sequence table
 i(204,1);i(208,1000); // Bodyparts
 i(180,2);i(184,1760);i(192,2);i(196,2);i(200,3600); // Textures, 2 families
 i(400+32,-1);s(400,'root'); // rest bone at origin
 s(600,'walk');v.setFloat32(600+32,10,true);i(600+36,1);i(600+56,2);i(600+120,1);i(600+124,3700);
 s(1000,'hat');i(1000+64,2);i(1000+68,1);i(1000+72,1100);
 for(let m=0;m<2;m++){
  const mp=1100+m*112,mesh=1360+m*20,vertices=1450+m*40,boneData=1540+m*10,command=1600+m*40;
  s(mp,m?'helmet':'base');i(mp+72,1);i(mp+76,mesh);i(mp+80,3);i(mp+84,boneData);i(mp+88,vertices);
  i(mesh+4,command);i(mesh+8,0);
  const points=[[m*60,0,0],[m*60+10,0,0],[m*60,10,0]];
  points.forEach((pt,j)=>pt.forEach((n,k)=>v.setFloat32(vertices+j*12+k*4,n,true)));
  v.setInt16(command,-3,true);
  for(let j=0;j<3;j++){v.setInt16(command+2+j*8,j,true);v.setInt16(command+2+j*8+4,j,true)}
 }
 for(let t=0;t<2;t++){
  const p=1760+t*80,offset=1980+t*900;s(p,`skin_${t}`);i(p+68,2);i(p+72,2);i(p+76,offset);
  b.set([1,1,1,1],offset);
  for(let c=0;c<256;c++){b[offset+4+c*3]=t?255:10;b[offset+4+c*3+1]=t?10:255;b[offset+4+c*3+2]=10}
 }
 [0,1,1,0].forEach((index,n)=>v.setUint16(3600+n*2,index,true));
 v.setUint16(3700,12,true); // bone anim X channel offset
 b[3712]=2;b[3713]=2;v.setInt16(3714,0,true);v.setInt16(3716,10,true);
 v.setFloat32(400+88,1,true); // translation X compression scale
 return data;
}
let failure=false;
try{
 const source=await fs.readFile(path.join(root,'src/engine/mdl.ts'),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 const three=path.join(root,'node_modules/three/build/three.core.js');
 const file=path.join(dir,'mdl.mjs');
 await fs.writeFile(file,compiled.replace("from 'three'",`from '${three}'`));
 const {parseGoldSrcMdl}=await import(pathToFileURL(file).href);
 const data=parseGoldSrcMdl(fixture());
 const expect=(ok,message)=>{if(!ok)throw Error(message)};
 expect(data.bodyparts.length===1&&data.bodyparts[0].models.length===2,'Bodygroups were not read');
 expect(data.bodyparts[0].models[1].meshes.length===1,'Second submodel missing');
 expect(data.skins.length===2&&data.skins[1][0]===1,'Skin family mapping invalid');
 expect(data.sequences[0].available&&data.sequences[0].frames===2,'Animation missing');
 expect(Math.abs(data.samplePose(0,1)[0].elements[12]-10)<1e-6,'Compressed animated root X at frame 1 is wrong');
 expect(Math.abs(data.samplePose(0,.5)[0].elements[12]-5)<1e-6,'Half frame interpolation is wrong');
 expect(data.meshes[0].boneIndices.every(index=>index===0),'Vertices are not bound to the root bone');
 expect(data.bodyparts[0].models[1].meshes[0].positions[0]===60,'Second bodygroup geometry invalid');
 console.log('PASS: GoldSrc RLE animation, interpolated bone pose, bodygroups, skin family switching, triangle data.');
}catch(err){console.error('FAIL v0.5.2:',err);failure=true}
finally{await fs.rm(dir,{recursive:true,force:true});if(failure)process.exitCode=1}
