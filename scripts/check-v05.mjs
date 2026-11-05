/** v0.5 regression: legacy studio binary parser, asset sandbox and ortho math. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import {listModels,openModel} from '../server/modelAssets.js';
const root=path.resolve(import.meta.dirname,'..');
const temp=await fs.mkdtemp(path.join(root,'.studio-v05-'));
const transpile=async(name)=>{
  const source=await fs.readFile(path.join(root,'src/engine',name+'.ts'),'utf8');
  const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
    .replace(/from ['"]\.\/(types|geometry)['"]/g,(_,f)=>`from './${f}.mjs'`);
  await fs.writeFile(path.join(temp,name+'.mjs'),js);
};
function fakeMdl(){
  const buf=new ArrayBuffer(1600),v=new DataView(buf),b=new Uint8Array(buf);
  const i=(p,value)=>v.setInt32(p,value,true),s=(p,value)=>{for(let k=0;k<value.length;k++)b[p+k]=value.charCodeAt(k)};
  s(0,'IDST');i(4,10);s(8,'test_triangle');i(72,buf.byteLength);
  i(180,1);i(184,528);i(192,1);i(196,1);i(200,1400);
  i(204,1);i(208,244);
  s(244,'body');i(244+64,1);i(244+72,320);
  s(320,'testmesh');i(320+72,1);i(320+76,432);i(320+80,3);i(320+84,488);i(320+88,452);
  i(432+4,491);i(432+8,0);
  [[0,0,0],[10,0,0],[0,10,0]].forEach((point,j)=>point.forEach((value,k)=>v.setFloat32(452+j*12+k*4,value,true)));
  v.setInt16(491,-3,true);
  for(let j=0;j<3;j++){v.setInt16(493+j*8,j,true);v.setInt16(493+j*8+4,j,true)}
  s(528,'test_skin');i(528+68,2);i(528+72,2);i(528+76,608);
  b.set([0,1,2,3],608);for(let j=0;j<256;j++){b[612+j*3]=j;b[612+j*3+1]=255-j;b[612+j*3+2]=100}
  return buf;
}
try{
  for(const n of ['types','geometry','orthoActions','mdl','fgd'])await transpile(n);
  const mdl=await import(pathToFileURL(path.join(temp,'mdl.mjs')).href);
  const fgd=await import(pathToFileURL(path.join(temp,'fgd.mjs')).href);
  const ortho=await import(pathToFileURL(path.join(temp,'orthoActions.mjs')).href);
  const v=mdl.parseGoldSrcMdl(fakeMdl());
  if(v.triangles!==1||v.meshes.length!==1||v.textures.length!==1||v.meshes[0].positions.length!==9)throw Error('Invalid MDL triangle decode');
  const classes=fgd.parseFgd('@PointClass studio("models/test.mdl") = monster_test : "Test" [ health(integer) : "HP" : 100 ]');
  if(classes[0]?.studio!=='models/test.mdl')throw Error('FGD studio model binding missing.');
  const shape={kind:'brush',id:'test',name:'test',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const rotated=ortho.orthoObjectUpdates([shape],['test'],'Z','rotate',90).test;
  if(!rotated||Math.abs(rotated.rotation[2]-90)>.01)throw Error('Top orthographic rotation should rotate around GoldSrc Z');
  const resized=ortho.orthoObjectUpdates([shape],['test'],'Z','scale',1.25).test;
  if(resized.scale[0]!==1.25)throw Error('Orthographic scaling broken');
  const gameDir=path.join(temp,'FakeGame','svencoop');const models=path.join(gameDir,'models');
  await fs.mkdir(models,{recursive:true});await fs.writeFile(path.join(models,'test.mdl'),new Uint8Array(fakeMdl()));
  const list=await listModels(gameDir,'test');
  if(list.total!==1||list.items[0].path!=='models/test.mdl')throw Error('Missing model inventory');
  const file=await openModel(gameDir,'svencoop','models/test.mdl');
  if(file.byteLength!==1600)throw Error('Read model returned wrong data');
  let blocked=false;try{await openModel(gameDir,'svencoop','models/../secret.mdl')}catch{blocked=true}
  if(!blocked)throw Error('Path traversal not blocked');
  console.log('PASS: IDST v10 textured mesh, FGD studio lookup, Top ortho rotate/scale, local Sven Co-op model inventory and traversal protection.');
}catch(e){console.error('FAIL:',e);process.exitCode=1}
finally{await fs.rm(temp,{recursive:true,force:true})}
