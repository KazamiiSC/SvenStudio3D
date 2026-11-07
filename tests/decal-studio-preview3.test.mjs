import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseWad,parseDecalWad} from '../src/engine/wad.ts';
const read=(name)=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
function sampleDecalWad(type=0x40){
  // One intact 16x16 miptex with a 256-color palette.
  const w=16,h=16,off=12,size=1150,dir=off+size;
  const b=Buffer.alloc(dir+32);const v=new DataView(b.buffer,b.byteOffset,b.length);
  b.write('WAD3',0);v.setInt32(4,1,true);v.setInt32(8,dir,true);
  b.write('SPLAT',off,'ascii');v.setUint32(off+16,w,true);v.setUint32(off+20,h,true);
  [40,296,360,376].forEach((val,i)=>v.setUint32(off+24+4*i,val,true));
  b.fill(128,off+40,off+40+w*h);v.setUint16(off+380,256,true);
  // Make index 255 red, it is the decal tint.
  b[off+382+255*3]=255;b[off+382+255*3+1]=30;b[off+382+255*3+2]=20;
  v.setInt32(dir,off,true);v.setInt32(dir+4,size,true);v.setInt32(dir+8,size,true);
  v.setUint8(dir+12,type);v.setUint8(dir+13,0);b.write('SPLAT',dir+16,'ascii');
  return new File([b],'decals.wad');
}
test('Preview 3: native 0x40 decal lumps are parsed without mixing into ordinary WAD3 surface textures',async()=>{
  const file=sampleDecalWad();const d=await parseDecalWad(file,{remember:false});
  assert.equal(d.length,1);assert.equal(d[0].name,'SPLAT');assert.equal(d[0].width,16);assert.equal(d[0].height,16);
  await assert.rejects(parseWad(file,{remember:false}),/No readable WAD3/);
});
test('Preview 3: 0x43 standard WAD3 lumps are compatible with decal library',async()=>{
  const d=await parseDecalWad(sampleDecalWad(0x43),{remember:false});assert.equal(d.length,1);
});
test('Preview 3: decoder tint and transparency match native index-alpha convention',async()=>{
  let data;
  const ctx={createImageData:(w,h)=>({width:w,height:h,data:new Uint8ClampedArray(w*h*4)}),putImageData:(im)=>{data=im.data}};
  const orig=globalThis.document;
  globalThis.document={createElement:()=>({getContext:()=>ctx,toDataURL:()=>"data:image/png;base64,preview"})};
  try{const d=await parseDecalWad(sampleDecalWad(),{remember:false});assert.match(d[0].thumbUrl,/^data:image\/png/);assert.deepEqual([...data.slice(0,4)],[255,30,20,128]);}
  finally{globalThis.document=orig;}
});
test('Preview 3: decals create undoable native infodecal entities; surface normals stay editor-only',()=>{
  const store=read('src/store.ts'),types=read('src/engine/types.ts'),map=read('src/engine/exportMap.ts');
  assert.match(store,/placeDecal:\(position,normal,brushId\)=>set\(s=>/);
  assert.match(store,/classname:'infodecal'/);
  assert.match(store,/props:\{texture:s.activeDecal\}/);
  assert.match(store,/mutate\(s,\[\.\.\.s.project.objects,decal\]\)/);
  assert.match(types,/decalNormal\?:Vec3/);
  assert.match(map,/props:Record<string,string>=\{\.\.\.e.props,classname:e.classname\}/);
  assert.doesNotMatch(map,/decalNormal|decalBrushId/);
});
test('Preview 3: viewport places decals at the clicked surface normal and previews them separately',()=>{
  const viewport=read('src/components/Viewport.tsx');
  assert.match(viewport,/getNormalMatrix\(e.object.matrixWorld\)/);
  assert.match(viewport,/placeDecal\(threeToGame\(at\),threeToGame\(normal\),object.id\)/);
  assert.match(viewport,/classname==='infodecal'\)return <DecalVisual/);
  assert.match(viewport,/const decalPreviewTextures=new Map/);
});
test('Preview 3: Decal Studio reachable in Asset Library and Studios; Escape ends brush painting',()=>{
  const app=read('src/App.tsx'),asset=read('src/components/Panels.tsx'),studio=read('src/components/DecalStudio.tsx');
  assert.match(app,/setResourceView\('decals'\)/);
  assert.match(app,/activeDecal\)\{useEditor.getState\(\).chooseDecal\(null\)/);
  assert.match(asset,/resource==='decals'&&<DecalStudio\/>/);
  assert.match(studio,/\/api\/assets\/decals/);
  assert.match(studio,/parseDecalWad\(file/);
});
test('Preview 3: server only serves a fixed WAD file from the explicitly configured game directory',()=>{
  const api=read('server/index.js');assert.match(api,/app.post\('\/api\/assets\/decals'/);assert.match(api,/path.join\(gameDir,'decals.wad'\)/);assert.match(api,/32\*1024\*1024/);
});
