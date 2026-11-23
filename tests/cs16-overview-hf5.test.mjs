import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {importMap} from '../src/engine/importMap.ts';
import {buildCsOverview,worldToOverviewPixel,overviewTxt} from '../src/engine/csOverview.ts';
import {writeIsolatedBuild} from '../server/isolatedBuild.js';

const map=importMap(readFileSync(new URL('../examples/cs16_hf33_de_arena.map',import.meta.url),'utf8'),'de_arena');

test('ROTATED 1 mapping matches the Half-Life SDK: 8/ZOOM units per pixel, X right, Y up, ORIGIN centred',()=>{
  const p={zoom:2,origin:[100,-50,0],height:0,ceiling:Infinity,bounds:{min:[0,0,0],max:[0,0,0]}};
  assert.deepEqual(worldToOverviewPixel(100,-50,p),[512,384]);            // origin = image centre
  assert.deepEqual(worldToOverviewPixel(100-4096/2,-50+3072/2,p),[0,0]); // top-left corner
  const [x1]=worldToOverviewPixel(116,-50,p);assert.equal(x1,516);       // zoom 2: 4 units per pixel, +16 units -> +4 px
  const [,y1]=worldToOverviewPixel(100,-34,p);assert.equal(y1,380);      // +Y goes up
});

test('generated overview fits the arena and is an 8-bit 1024x768 BMP with a matching TXT',()=>{
  const result=buildCsOverview('de_arena',map.objects);
  assert.ok(result);
  const {bmp,params,txt}=result;
  const view=new DataView(bmp.buffer,bmp.byteOffset,bmp.byteLength);
  assert.equal(String.fromCharCode(bmp[0],bmp[1]),'BM');
  assert.equal(view.getInt32(18,true),1024);assert.equal(view.getInt32(22,true),768);assert.equal(view.getUint16(28,true),8);
  for(const [x,y] of [[params.bounds.min[0],params.bounds.max[1]],[params.bounds.max[0],params.bounds.min[1]]]){
    const [px,py]=worldToOverviewPixel(x,y,params);
    assert.ok(px>=0&&px<=1024&&py>=0&&py<=768,`map corner ${x},${y} inside the image`);
  }
  assert.match(txt,/ROTATED\t1/);assert.match(txt,/IMAGE\t"overviews\/de_arena\.bmp"/);
  assert.equal(overviewTxt('x',params).includes(`ZOOM\t${params.zoom.toFixed(2)}`),true);
});

test('an empty map produces no overview instead of a blank image',()=>{
  assert.equal(buildCsOverview('empty',[]),null);
});

test('isolated builds accept overviews/<map>.bmp|txt and still reject other paths',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'sv-ov-'));
  try{
    const game=path.join(root,'Half-Life','cstrike'),out=path.join(root,'out');
    await fs.mkdir(game,{recursive:true});await fs.mkdir(out);
    const bsp=path.join(root,'de_arena.bsp'),src=path.join(root,'de_arena.map');
    await fs.writeFile(bsp,Buffer.alloc(200));await fs.writeFile(src,'{}');
    const files=[{path:'overviews/de_arena.bmp',bytes:Buffer.from('BM')},{path:'overviews/de_arena.txt',bytes:Buffer.from('txt')}];
    const saved=await writeIsolatedBuild({gameDir:game,mapName:'de_arena',compiledBspPath:bsp,sourceMapPath:src,destinationDir:out,format:'build',inlineBinaryFiles:files,gameProfile:'cs16'});
    assert.ok((await fs.stat(path.join(saved.destination,'Distribucion','overviews','de_arena.bmp'))).isFile());
    await assert.rejects(writeIsolatedBuild({gameDir:game,mapName:'de_arena',compiledBspPath:bsp,sourceMapPath:src,destinationDir:out,format:'build',inlineBinaryFiles:[{path:'overviews/../evil.txt',bytes:Buffer.from('x')}],gameProfile:'cs16'}),/Unsafe/);
  }finally{await fs.rm(root,{recursive:true,force:true});}
});
