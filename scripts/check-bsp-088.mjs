import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
const input=fs.readFileSync(new URL('../src/engine/bsp.ts',import.meta.url),'utf8');
const transformed=ts.transpileModule(input,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {parseBsp,parseBspEntities}=await import(`data:text/javascript;base64,${Buffer.from(transformed).toString('base64')}`);

function makeTestBsp({external=false}={}){
  const lumps=new Map();const put=(id,data)=>lumps.set(id,Buffer.from(data));
  const entity=Buffer.from('{\n"classname" "worldspawn"\n"wad" "C:\\\\games\\\\halflife.wad;"\n"skyname" "desert"\n}\n{\n"classname" "info_player_start"\n"origin" "32 64 16"\n}\n\0');
  put(0,entity);
  const plane=Buffer.alloc(20);plane.writeFloatLE(0,0);plane.writeFloatLE(-1,4);plane.writeFloatLE(0,8);put(1,plane);
  const tex=Buffer.alloc(4+4+40+256+64+16+4+2+768);
  tex.writeInt32LE(1,0);tex.writeInt32LE(8,4);tex.write('TEST_WALL',8,'latin1');tex.writeUInt32LE(16,24);tex.writeUInt32LE(16,28);
  if(!external){tex.writeUInt32LE(40,32);tex.writeUInt32LE(296,36);tex.writeUInt32LE(360,40);tex.writeUInt32LE(376,44);
    for(let j=0;j<256;j++)tex[48+j]=j%2?1:2;
    const pal=8+40+256+64+16+4;tex.writeUInt16LE(256,pal);
    tex[pal+2+3]=200;tex[pal+2+3+1]=80;tex[pal+2+3+2]=40;
  }
  put(2,tex);
  const vertex=Buffer.alloc(4*12);[[0,0,0],[128,0,0],[128,0,128],[0,0,128]].forEach((a,i)=>a.forEach((x,k)=>vertex.writeFloatLE(x,i*12+k*4)));put(3,vertex);
  put(4,Buffer.alloc(0));put(5,Buffer.alloc(0));
  const info=Buffer.alloc(40);info.writeFloatLE(1,0);info.writeFloatLE(1,24);info.writeInt32LE(0,32);put(6,info);
  const face=Buffer.alloc(20);face.writeUInt16LE(0,0);face.writeUInt16LE(0,2);face.writeInt32LE(0,4);face.writeUInt16LE(4,8);face.writeUInt16LE(0,10);face[12]=0;face[13]=255;face[14]=255;face[15]=255;face.writeInt32LE(0,16);put(7,face);
  put(8,Buffer.alloc(9*9*3,128));put(9,Buffer.alloc(0));put(10,Buffer.alloc(28));put(11,Buffer.alloc(0));
  const edges=Buffer.alloc(4*4);[[0,1],[1,2],[2,3],[3,0]].forEach((e,i)=>{edges.writeUInt16LE(e[0],i*4);edges.writeUInt16LE(e[1],i*4+2)});put(12,edges);
  const surf=Buffer.alloc(16);for(let i=0;i<4;i++)surf.writeInt32LE(i,i*4);put(13,surf);
  const models=Buffer.alloc(64);models.writeInt32LE(0,56);models.writeInt32LE(1,60);put(14,models);
  const header=Buffer.alloc(124);header.writeInt32LE(30,0);let offset=124;const parts=[header];
  for(let id=0;id<15;id++){
    const chunk=lumps.get(id)||Buffer.alloc(0);header.writeInt32LE(offset,4+id*8);header.writeInt32LE(chunk.length,8+id*8);offset+=chunk.length;parts.push(chunk);
  }
  return Buffer.concat(parts);
}
function check(){
  const file=makeTestBsp();const map=parseBsp(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength),'sample.bsp');
  assert.equal(map.version,30);assert.equal(map.name,'sample.bsp');assert.equal(map.faces.length,1);
  assert.equal(map.faces[0].points.length,4);assert.deepEqual(map.faces[0].texels,[[0,0],[128,0],[128,128],[0,128]]);
  assert.equal(map.faces[0].lightWidth,9);assert.equal(map.faces[0].lightHeight,9);assert.equal(map.faces[0].lightRgb.length,9*9*3);
  assert.equal(map.textures[0].name,'TEST_WALL');assert.equal(map.textures[0].rgba.length,16*16*4);
  assert.equal(map.stats.embeddedTextures,1);assert.equal(map.skyname,'desert');assert.equal(map.entities.length,2);
  assert.deepEqual(map.entities[1].origin,[32,64,16]);
  const ext=makeTestBsp({external:true});const b=parseBsp(ext.buffer.slice(ext.byteOffset,ext.byteOffset+ext.byteLength));
  assert.equal(b.textures[0].external,true);assert.equal(b.stats.embeddedTextures,0);
  assert.equal(b.faces.length,1);assert.ok(b.warnings.some(x=>x.includes('external')));
  const badVersion=Buffer.from(file);badVersion.writeInt32LE(29,0);
  assert.throws(()=>parseBsp(badVersion.buffer.slice(badVersion.byteOffset,badVersion.byteOffset+badVersion.byteLength)),/version 30/);
  const badOffset=Buffer.from(file);badOffset.writeInt32LE(-100,4+7*8);
  assert.throws(()=>parseBsp(badOffset.buffer.slice(badOffset.byteOffset,badOffset.byteOffset+badOffset.byteLength)),/Invalid BSP lump/);
  assert.equal(parseBspEntities('{ "classname" "light" "targetname" "test" }')[0].properties.targetname,'test');
  console.log('BSP v0.8.8: 11 structural checks passed (header, lumps, face, texels, lightmaps, miptex, entities, invalid data).');
}
check();
