/** BSP Viewer 2.1 regression checks: WAD3 palette decoding, sandboxed overlay
 * selection, no unnecessary scans, label collision/priority and UI wiring. */
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import {findBspWadTextures,wadBasename} from '../server/bspWadAssets.js';

function wadEntry(name,paletteColors){
  const w=16,h=16,mips=[256,64,16,4];
  const buffer=Buffer.alloc(40+mips.reduce((a,b)=>a+b,0)+2+paletteColors.length*3);
  buffer.write(name,0,'latin1');buffer.writeUInt32LE(w,16);buffer.writeUInt32LE(h,20);
  let offset=40;
  for(let i=0;i<4;i++){buffer.writeUInt32LE(offset,24+i*4);buffer.fill(1,offset,offset+mips[i]);offset+=mips[i]}
  buffer.writeUInt16LE(paletteColors.length,offset);offset+=2;
  for(const color of paletteColors){buffer.set(color,offset);offset+=3}
  return buffer;
}
function wadBuffer(textures){
  const entries=textures.map(([name,colors])=>({name,data:wadEntry(name,colors)}));
  const dataEnd=12+entries.reduce((a,e)=>a+e.data.length,0);
  const buffer=Buffer.alloc(dataEnd+entries.length*32);
  buffer.write('WAD3',0,'ascii');buffer.writeInt32LE(entries.length,4);buffer.writeInt32LE(dataEnd,8);
  let offset=12;
  for(let i=0;i<entries.length;i++){
    const e=entries[i],at=dataEnd+i*32;
    e.data.copy(buffer,offset);
    buffer.writeInt32LE(offset,at);buffer.writeInt32LE(e.data.length,at+4);buffer.writeInt32LE(e.data.length,at+8);
    buffer[at+12]=0x43;buffer.write(e.name,at+16,'latin1');offset+=e.data.length;
  }
  return buffer;
}
const fixture=await mkdtemp(path.join(tmpdir(),'svenstudio-bsp-wad-'));
try{
  const base=path.join(fixture,'svencoop'),addon=path.join(fixture,'svencoop_addon'),dl=path.join(fixture,'svencoop_downloads');
  await Promise.all([mkdir(base),mkdir(addon),mkdir(dl)]);
  await writeFile(path.join(base,'base.wad'),wadBuffer([['WALL01',[[0,0,0],[240,30,30]]],['BASE02',[[0,0,0],[60,60,255]]]]));
  await writeFile(path.join(addon,'custom.wad'),wadBuffer([['WALL01',[[0,0,0],[30,240,30]]],['ADDON01',[[0,0,0],[250,250,0]]]]));
  await writeFile(path.join(dl,'download.wad'),wadBuffer([['DL01',[[0,0,0],[30,120,200]]]]));
  assert.equal(wadBasename('C:\\Games\\Sven Co-op\\svencoop\\base.wad'),'base.wad');
  assert.equal(wadBasename('/some/place/../base.wad'),'base.wad');
  assert.equal(wadBasename('malicious.exe'),null);
  const result=await findBspWadTextures({gameDir:base,wadNames:['C:\\HL\\base.wad','custom.wad'],textureNames:['WALL01','BASE02','ADDON01','DL01','missing']});
  assert.equal(result.textures.length,4);
  assert.deepEqual(result.missing,['missing']);
  assert.equal(result.textures.find(t=>t.name==='WALL01').wad,'base.wad','BSP WAD references take priority');
  assert.equal(result.textures.find(t=>t.name==='ADDON01').source,'svencoop_addon');
  assert.equal(result.textures.find(t=>t.name==='DL01').source,'svencoop_downloads');
  assert.equal(Buffer.from(result.textures[0].indices,'base64').length,256);
  assert.equal(Buffer.from(result.textures[0].palette,'base64').length,6);
  assert.deepEqual((await findBspWadTextures({gameDir:base,textureNames:[]})).textures,[]);
  assert(!result.textures.some(t=>t.name==='MISSING'));
  await assert.rejects(()=>findBspWadTextures({gameDir:path.join(fixture,'not-installed'),textureNames:['WALL01']}));
}finally{await rm(fixture,{recursive:true,force:true})}

const source=await readFile(new URL('../src/engine/bspLabelLayout.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {layoutBspLabels,bspLabelPriority}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const opts={width:1280,height:720,limit:3,smart:true,padding:5};
const labels=[{index:1,x:300,y:150,width:120,height:25,distance:150,priority:0},
 {index:2,x:310,y:145,width:110,height:25,distance:160,priority:0},
 {index:3,x:310,y:145,width:130,height:25,distance:1000,priority:1000,selected:true},
 {index:4,x:880,y:400,width:100,height:25,distance:100,priority:0}];
assert.deepEqual(layoutBspLabels(labels,opts),[3,4]);
assert.deepEqual(layoutBspLabels(labels,{...opts,smart:false}),[3,4,1]);
assert.equal(layoutBspLabels(labels,{...opts,limit:1})[0],3);
assert.equal(bspLabelPriority('info_player_start',undefined,false),130);
assert.equal(bspLabelPriority('light','target',false),60);
assert.equal(bspLabelPriority('light',undefined,true),1000);
assert.deepEqual(layoutBspLabels([{index:5,x:4000,y:4000,width:100,height:20,distance:1,priority:999}],opts),[]);
const ui=await readFile(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
const wadClient=await readFile(new URL('../src/engine/bspAutoWad.ts',import.meta.url),'utf8');
const server=await readFile(new URL('../server/index.js',import.meta.url),'utf8');
const css=await readFile(new URL('../src/style.css',import.meta.url),'utf8');
const locale=await readFile(new URL('../src/i18n.ts',import.meta.url),'utf8');
assert(ui.includes('fetchBspAutoWads')&&wadClient.includes('/api/bsp/wad-textures'),'BSP viewer must call the bounded WAD request helper');
for(const str of ['autoWadTexturesToAssets','layoutBspLabels','bspLabelPriority','setAutoWadRefresh',"t('Avoid overlapping labels')", "t('Maximum labels')", "t('Label distance')",'parseWad'])assert(ui.includes(str),str);
for(const str of ['findBspWadTextures','/api/bsp/wad-textures'])assert(server.includes(str));
for(const str of ['.bsp-auto-wad-status','.bsp-label-settings'])assert(css.includes(str));
for(const lang of ['es','ru','ko'])assert(locale.includes(`Object.assign(${lang},{\n  'Automatic WAD textures':`));
console.log('PASS v0.8.9.3 BSP Viewer: WAD palette extraction, overlay order, missing fallback, confined file search, smart label priority/collision, UI + ES/RU/KO.');
