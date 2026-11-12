import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {preferredTextureAssets} from '../src/engine/textureWadSelection.ts';
import {fitFace,faceUvBounds,alignFaceToReference,faceTextureAxes,brushWorldVertices} from '../src/engine/textureStudio.ts';
import {texelAt} from '../src/engine/valve220UV.ts';
import {textureBasisQuality} from '../src/engine/textureAxisSafety.ts';
import {parseWad} from '../src/engine/wad.ts';
const near=(a,b,eps=1e-6)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const box=(id,position=[0,0,0])=>({id,kind:'brush',name:id,primitive:'box',position,
 rotation:[0,0,0],scale:[1,1,1],
 vertices:[[-64,-64,-64],[64,-64,-64],[64,64,-64],[-64,64,-64],[-64,-64,64],[64,-64,64],[64,64,64],[-64,64,64]],
 faces:[[0,3,2,1],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]].map(indices=>({indices,texture:'BRICK',uScale:1,vScale:1}))});

test('WAD texture selection matches compiler order even with duplicate names and Windows paths',()=>{
 const assets=[{name:'BRICK',wad:'other.wad',width:32,height:32},
  {name:'BRICK',wad:'main.wad',width:256,height:128},
  {name:'BRICK',wad:'main.wad',width:256,height:256}];
 const result=preferredTextureAssets(assets,['C:\\GoldSrc\\main.wad','D:/other.wad']);
 assert.equal(result.get('brick').width,256);
 assert.equal(result.get('brick').height,256,'reimport of a configured WAD refreshes its data');
 assert.equal(preferredTextureAssets(assets,[]).get('brick').wad,'main.wad','without priority newest WAD keeps historical precedence');
 assert.equal(preferredTextureAssets(assets,[],['main.wad','other.wad']).get('brick').wad,'main.wad');
 assert.equal(preferredTextureAssets(assets,['C:/main.wad','C:/main.wad','D:/other.wad']).get('brick').wad,'main.wad');
});

test('Fit preserves both negative scales, exact tile count and phase',()=>{
 const b=box('f');const f=b.faces[4];
 f.uAxis=[1.5,.5,.25];f.vAxis=[.15,-2,.3];f.rotation=0;
 f.uScale=-.75;f.vScale=-.375;f.uShift=100.75;f.vShift=-38.5;
 const patch=fitFace(b,4,256,128,2,3),bounds=faceUvBounds(b,4);
 assert.ok(patch.uScale<0&&patch.vScale<0);
 near((bounds.maxU-bounds.minU)/(Math.abs(patch.uScale)*256),2);
 near((bounds.maxV-bounds.minV)/(Math.abs(patch.vScale)*128),3);
 near(bounds.maxU/patch.uScale+patch.uShift,0);
 near(bounds.maxV/patch.vScale+patch.vShift,0);
 near(bounds.minU/patch.uScale+patch.uShift,512);
 near(bounds.minV/patch.vScale+patch.vShift,384);
});

test('Align preserves non-unit Valve 220 axes and pixel phase across coplanar brushes',()=>{
 const src=box('src',[33,-42,15]),dst=box('dst',[161,-42,15]);
 const f=src.faces[4];f.uAxis=[1.25,.35,.3];f.vAxis=[-.2,-1.8,.6];
 f.uScale=-.5;f.vScale=.75;f.uShift=24.125;f.vShift=-99.5;f.rotation=14;
 const patch=alignFaceToReference(src,4,dst,4);
 const before=faceTextureAxes(brushWorldVertices(src),f);
 const after=faceTextureAxes(brushWorldVertices(dst),{...dst.faces[4],...patch});
 for(let i=0;i<3;i++){
   near(before.u[i],after.u[i]);near(before.v[i],after.v[i]);
 }
 near(patch.uShift,f.uShift);near(patch.vShift,f.vShift);
 const point=[62,-11,79];
 near(texelAt(point,before.u,f.uScale,f.uShift),texelAt(point,after.u,patch.uScale,patch.uShift));
 near(texelAt(point,before.v,f.vScale,f.vShift),texelAt(point,after.v,patch.vScale,patch.vShift));
});

test('Align across perpendicular faces safely repairs collapsed axes',()=>{
 const b=box('corner');const f=b.faces[4];f.uAxis=[1,0,0];f.vAxis=[0,1,0];
 const patch=alignFaceToReference(b,4,b,2),world=brushWorldVertices(b);
 const axes=faceTextureAxes(world,{...b.faces[2],...patch});
 assert.ok(textureBasisQuality(faceTextureAxes(world,b.faces[2]).n,axes.u,axes.v)>=.20);
 assert.ok([patch.uShift,patch.vShift].every(Number.isFinite));
});

// A minimal 16x16 WAD3 MIPTEX (one 256-color palette). No canvas is needed to parse metadata.
function makeWad(invalidFirst=false){
 const width=16,height=16,mip0=40,mip1=296,mip2=360,mip3=376,lumpSize=1150;
 const firstLen=invalidFirst?40:0,firstPos=12,goodPos=firstPos+firstLen;
 const dirOffset=goodPos+lumpSize,entries=invalidFirst?2:1;
 const bytes=Buffer.alloc(dirOffset+entries*32),v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 bytes.write('WAD3',0);v.setInt32(4,entries,true);v.setInt32(8,dirOffset,true);
 const putMip=(pos,name)=>{
  bytes.write(name,pos,'ascii');v.setUint32(pos+16,width,true);v.setUint32(pos+20,height,true);
  for(const [i,off] of [mip0,mip1,mip2,mip3].entries())v.setUint32(pos+24+i*4,off,true);
  v.setUint16(pos+380,256,true);
 };
 const dir=(index,pos,size,name)=>{
  const o=dirOffset+index*32;v.setInt32(o,pos,true);v.setInt32(o+4,size,true);
  v.setInt32(o+8,size,true);v.setUint8(o+12,0x43);v.setUint8(o+13,0);
  bytes.write(name,o+16,'ascii');
 };
 if(invalidFirst){putMip(firstPos,'BROKEN');dir(0,firstPos,firstLen,'BROKEN');}
 putMip(goodPos,'VALID');dir(entries-1,goodPos,lumpSize,'VALID');
 return new File([bytes],'textures.wad');
}
test('WAD3 lazy metadata reads intact textures',async()=>{
 const items=await parseWad(makeWad(),{remember:false});
 assert.equal(items.length,1);assert.equal(items[0].name,'VALID');
 assert.equal(items[0].width,16);assert.equal(items[0].height,16);
});
test('WAD3 does not read invalid lump palette or pixels from the next entry',async()=>{
 const items=await parseWad(makeWad(true),{remember:false});
 assert.deepEqual(items.map(x=>x.name),['VALID']);
});
test('UI fits and centers through the viewport WAD resolver rather than first imported texture',()=>{
 const store=readFileSync(new URL('../src/store.ts',import.meta.url),'utf8');
 assert.match(store,/const assets=textureStudioAssetSizes\(s\)/);
 assert.match(store,/preferredTextureAssets\(state\.textureAssets,paths,state\.project\.wadNames\)/);
 assert.doesNotMatch(store,/textureAssets\.find\(a=>a\.name\.toUpperCase\(\)===face\.texture/);
});
