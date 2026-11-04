/** Model Browser v0.5.1 regressions: stable inventory and MDL texture data. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import {pathToFileURL} from 'node:url';
import {listModels} from '../server/modelAssets.js';
const root=path.resolve(import.meta.dirname,'..');
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'studio-v051-'));
const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
function mainMdl(){
  const buf=new ArrayBuffer(1600),v=new DataView(buf),b=new Uint8Array(buf);
  const i=(p,n)=>v.setInt32(p,n,true),s=(p,name)=>{for(let j=0;j<name.length;j++)b[p+j]=name.charCodeAt(j)};
  s(0,'IDST');i(4,10);s(8,'fake_mesh');i(72,1600);
  i(180,0);i(192,1);i(196,1);i(200,1400);v.setUint16(1400,0,true);
  i(204,1);i(208,244);
  s(244,'body');i(244+64,1);i(244+72,320);
  s(320,'testmesh');i(320+72,1);i(320+76,432);i(320+80,3);i(320+84,488);i(320+88,452);
  i(432+4,491);i(432+8,0);
  [[0,0,0],[10,0,0],[0,10,0]].forEach((pt,j)=>pt.forEach((n,k)=>v.setFloat32(452+j*12+k*4,n,true)));
  v.setInt16(491,-3,true);
  for(let j=0;j<3;j++){v.setInt16(493+j*8,j,true);v.setInt16(493+j*8+4,j,true)}
  return buf;
}
function texMdl(){
  const buf=new ArrayBuffer(1800),v=new DataView(buf),b=new Uint8Array(buf);
  const i=(p,n)=>v.setInt32(p,n,true),s=(p,name)=>{for(let j=0;j<name.length;j++)b[p+j]=name.charCodeAt(j)};
  s(0,'IDST');i(4,10);i(72,1800);i(180,1);i(184,528);
  s(528,'embedded_mask');i(528+64,0x0040);i(528+68,2);i(528+72,2);i(528+76,608);
  b.set([1,2,3,255],608);
  for(let j=0;j<256;j++){b[612+j*3]=j;b[612+j*3+1]=255-j;b[612+j*3+2]=55}
  return buf;
}
try{
  const raw=await fs.readFile(path.join(root,'src/engine/mdl.ts'),'utf8');
  const moduleSource=ts.transpileModule(raw,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const local=path.join(root,'node_modules/three');
  const file=path.join(tmp,'mdl.mjs');
  await fs.writeFile(file,moduleSource.replace("from 'three'",`from '${path.join(local,'build/three.core.js')}'`));
  const {parseGoldSrcMdl}=await import(pathToFileURL(file).href);
  const model=parseGoldSrcMdl(mainMdl(),texMdl());
  assert(model.textures.length===1&&model.meshes.length===1,'External texture model is missing');
  assert(model.missingTextures===false,'External textures incorrectly marked missing');
  assert(model.textures[0].rgba[0]===1,'Palette color lookup is incorrect');
  assert(model.textures[0].rgba[4*3+3]===0,'Masked alpha (palette index 255) is incorrect');
  const home=path.join(tmp,'FakeGame','svencoop'),models=path.join(home,'models');
  await fs.mkdir(models,{recursive:true});
  await fs.writeFile(path.join(models,'soldier.mdl'),new Uint8Array(mainMdl()));
  await fs.writeFile(path.join(models,'soldierT.mdl'),new Uint8Array(texMdl()));
  const first=await listModels(home,'',400);
  assert(first.total===1&&first.items[0].name==='soldier.mdl','Companion T.mdl should be hidden from model browser');
  await fs.writeFile(path.join(models,'scientist.mdl'),new Uint8Array(mainMdl()));
  const cached=await listModels(home,'',400);
  assert(cached.total===1,'Inventory was rescanned without explicit refresh');
  const [search,refreshed]=await Promise.all([listModels(home,'soldier',400),listModels(home,'',400,{refresh:true})]);
  assert(search.total===1&&refreshed.total===2,'Search filter or rescan failed');
  const component=await fs.readFile(path.join(root,'src/components/ModelBrowser.tsx'),'utf8');
  const i18n=await fs.readFile(path.join(root,'src/i18n.ts'),'utf8');
  assert(component.includes('map.flipY=true'),'Indexed textures not vertically oriented for DataTexture');
  assert(component.includes('map.minFilter=THREE.LinearFilter'),'DataTexture still requires missing mipmaps');
  assert(i18n.includes('return useCallback('),'Translation callback is not memoized');
  console.log('PASS: cached model inventory, explicit refresh, T.mdl filtering, external paletted textures, mask alpha, DataTexture filter/orientation, stable language callback.');
}catch(error){console.error('FAIL:',error);process.exitCode=1}
finally{await fs.rm(tmp,{recursive:true,force:true})}
