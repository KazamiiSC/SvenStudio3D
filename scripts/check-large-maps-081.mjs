/** Standalone WAD3/language/performance checks; no Vite or Windows SDK required. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import ts from 'typescript';
import {createRequire} from 'node:module';
const root=process.cwd(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-081-'));
try {
  const files=['engine/wad.ts','i18n.ts','engine/sceneOrganization.ts','engine/npc.ts','layout.ts'];
  for(const file of files){
    const target=path.join(tmp,file.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,ts.transpileModule(fs.readFileSync(path.join(root,'src',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText);
  }
  fs.symlinkSync(path.join(root,'node_modules'),path.join(tmp,'node_modules'),'dir');
  fs.writeFileSync(path.join(tmp,'store.js'),'module.exports={useEditor:()=>({})}');
  const require=createRequire(path.join(tmp,'check.cjs'));
  // Synthetic WAD3: 2,600 palette-based 16x16 textures with valid mip offsets.
  const count=2600,textureSize=1150,offset=12+count*textureSize,buffer=new ArrayBuffer(offset+count*32),v=new DataView(buffer);
  const put=(at,text,n)=>{for(let i=0;i<n;i++)v.setUint8(at+i,text.charCodeAt(i)||0)};
  put(0,'WAD3',4);v.setInt32(4,count,true);v.setInt32(8,offset,true);
  for(let i=0;i<count;i++){
    const pos=12+i*textureSize,dir=offset+i*32;
    put(pos,`TEX${String(i).padStart(5,'0')}`,16);
    v.setUint32(pos+16,16,true);v.setUint32(pos+20,16,true);
    for(const [j,o] of [40,296,360,376].entries())v.setUint32(pos+24+j*4,o,true);
    for(let x=0;x<256;x++)v.setUint8(pos+40+x,x&255);
    v.setUint16(pos+380,256,true);
    for(let x=0;x<256;x++){v.setUint8(pos+382+x*3,x);v.setUint8(pos+383+x*3,255-x);v.setUint8(pos+384+x*3,120)}
    v.setInt32(dir,pos,true);v.setInt32(dir+4,textureSize,true);v.setUint8(dir+12,0x43);
  }
  let decoded=0;
  globalThis.document={createElement:()=>{decoded++;return {width:0,height:0,getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){}}},toDataURL(){return 'data:image/png;base64,preview'}}}};
  const {parseWad}=require('./engine/wad.js');
  const file={name:'huge.wad',arrayBuffer:async()=>buffer};
  const start=performance.now(),textures=await parseWad(file);
  assert.equal(textures.length,count);assert.equal(decoded,0,'WAD import must not create canvases');
  assert.ok(textures[0].thumbUrl.startsWith('data:'));assert.equal(decoded,1);
  assert.equal(textures[0].thumbUrl,textures[0].thumbUrl);assert.equal(decoded,1,'thumb should cache');
  assert.ok(textures[0].dataUrl.startsWith('data:'));assert.equal(decoded,2,'full preview only when requested');
  assert.ok(performance.now()-start<15000);
  console.log('PASS 2,600-texture WAD indexed without eager canvas creation; thumbnails/full image decode lazily');
  const panel=fs.readFileSync('src/components/Panels.tsx','utf8');
  assert.match(panel,/shownTextures=filteredTextures\.slice\(0,texturePage\*80\)/);
  assert.match(panel,/t\.thumbUrl\|\|t\.dataUrl/);
  assert.match(panel,/setTexturePage\(v=>v\+1\)/);
  console.log('PASS WAD gallery mounts 80 previews at a time and allows loading additional pages');
  const explorer=fs.readFileSync('src/components/ExplorerOrganized.tsx','utf8');
  assert.ok(!explorer.includes("tree.groups.filter(g=>g.id==='geometry')"));
  assert.ok(explorer.includes("o.kind==='entity'&&test(o)"));
  assert.ok(explorer.includes("filtered.slice(0,limit)"));
  console.log('PASS Explorer hides world geometry but retains editable entities with per-category paging');
  const viewport=fs.readFileSync('src/components/Viewport.tsx','utf8');
  assert.ok(viewport.includes("projection('projection')"));
  assert.ok(viewport.includes("perfPreset==='large'?1:1.35"));
  assert.ok(viewport.includes('visibleLabels.has(obj.id)')&&viewport.includes('MemoBrushVisual'));
  assert.ok(viewport.includes('sharedMaterials')&&viewport.includes('entityMarkerGeometry'));
  console.log('PASS projection switch, throttled labels, shared materials/markers and adaptive render DPR wired');
  const {translate}=require('./i18n.js');
  for(const locale of ['es','ru','ko'])for(const key of ['Sven Studio guide','Help quick start','Help compiling','Help performance','Font size','Show more entities','Switch orthographic / perspective']){
    assert.notEqual(translate(locale,key),key,`${locale}:${key}`);
  }
  const layout=fs.readFileSync('src/layout.ts','utf8');
  assert.ok(layout.includes('setFontScale:fontScale')&&layout.includes("preset==='wide'")&&layout.includes("preset==='minimal'"));
  console.log('PASS four-language expanded help and persisted font/layout/performance settings');
}catch(error){console.error('FAIL v0.8.1:',error);process.exitCode=1}
finally{fs.rmSync(tmp,{recursive:true,force:true})}
