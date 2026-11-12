import ts from 'typescript';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';

const dir=await fs.mkdtemp(path.resolve('.sky-enclosure-check-'));
try {
  const names=['types','geometry','skyEnclosure','exportMap','importMap'];
  for(const name of names){
    const source=await fs.readFile(path.resolve('src/engine',name+'.ts'),'utf8');
    const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
      .replace(/from ['"]\.\/(\w+)['"]/g,(all,dep)=>names.includes(dep)?`from './${dep}.mjs'`:all);
    await fs.writeFile(path.join(dir,name+'.mjs'),code);
  }
  const {createBrush,transformedVertices}=await import(pathToFileURL(path.join(dir,'geometry.mjs')).href);
  const {createSkyEnclosure,SKY_ENCLOSURE_GROUP,isAutoSkyEnclosure}=await import(pathToFileURL(path.join(dir,'skyEnclosure.mjs')).href);
  const {validateProject,exportMap}=await import(pathToFileURL(path.join(dir,'exportMap.mjs')).href);
  const {importMap}=await import(pathToFileURL(path.join(dir,'importMap.mjs')).href);
  const floor=createBrush('box',[0,0,-16],[512,512,32],'Floor');
  const west=createBrush('box',[-256,0,128],[32,512,256],'West Wall');
  const spawn={id:'spawn',kind:'entity',classname:'info_player_start',name:'Spawn',position:[0,0,48],props:{}};
  const light={id:'light',kind:'entity',classname:'light',name:'Light',position:[0,0,200],props:{_light:'255 255 255 350'}};
  const original=[floor,west,spawn,light];
  const opts={margin:128,thickness:32,grid:16,hideInEditor:true};
  const result=createSkyEnclosure(original,opts);
  assert.equal(result.brushes.length,6);
  assert.equal(result.objects.length,10);
  assert.equal(result.replaced,0);
  assert.equal(result.inner.min[0],-400);
  assert.equal(result.inner.max[0],384);
  assert.ok(result.brushes.every(b=>b.faces.length===6&&b.faces.every(f=>f.texture==='SKY')));
  assert.ok(result.brushes.every(b=>b.group===SKY_ENCLOSURE_GROUP&&b.hidden&&!b.entityId));
  assert.ok(result.brushes.every(isAutoSkyEnclosure));
  assert.deepEqual(result.objects.slice(0,original.length),original);
  // Every cavity point must be outside the six generated solid slabs.
  const center=[0,0,48];
  for(const b of result.brushes){
    const v=transformedVertices(b);
    assert.ok([0,1,2].some(i=>center[i]<Math.min(...v.map(p=>p[i]))||center[i]>Math.max(...v.map(p=>p[i]))));
  }
  const project={version:1,target:'svengine',name:'sky_test',objects:result.objects,world:{classname:'worldspawn',skyname:'desert'},wadNames:[]};
  assert.deepEqual(validateProject(project),[]);
  const exported=exportMap(project);
  assert.equal((exported.match(/ SKY \[/g)||[]).length,36);
  assert.deepEqual(validateProject(importMap(exported,'sky_test.map')),[]);
  const regenerated=createSkyEnclosure(result.objects,{...opts,margin:256,hideInEditor:false});
  assert.equal(regenerated.replaced,6);
  assert.equal(regenerated.objects.length,10);
  assert.ok(regenerated.brushes.every(b=>!b.hidden));
  assert.equal(regenerated.inner.min[0],-528);
  // Rotated world brush must use transformed world bounds, not nominal box size.
  const rotated={...west,rotation:[0,0,45]};
  const rp=createSkyEnclosure([floor,rotated,spawn],opts);
  const rx=transformedVertices(rotated).map(p=>p[0]);
  assert.ok(rp.inner.min[0]<=Math.min(...rx)-opts.margin);
  assert.ok(rp.inner.max[0]>=Math.max(...rx)+opts.margin);
  const filled=createBrush('box',[0,0,128],[1600,1600,600],'Giant Solid SKY');
  filled.faces=filled.faces.map(f=>({...f,texture:'SKY'}));
  assert.throws(()=>createSkyEnclosure([...original,filled],opts),/Remove the large solid SKY cube/);
  assert.throws(()=>createSkyEnclosure([spawn],opts),/world brush/);
  assert.throws(()=>createSkyEnclosure(original,{...opts,margin:0}),/Sky margin/);
  assert.throws(()=>createSkyEnclosure([...original,{...spawn,position:[100000,0,0]}],opts),/safe GoldSrc/);
  console.log('PASS v0.8.9.12: six sealed SKY slabs, empty interior, transformed bounds, export/import, regeneration, warnings, safeguards');
}finally{await fs.rm(dir,{recursive:true,force:true});}
