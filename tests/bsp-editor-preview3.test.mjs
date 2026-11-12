import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {bspAllowStudioModel,bspMdlPath,bspModelPlacements,bspResolvedModelPath,bspIdleSequence,bspFloorZ,bspEntityWithinDistance} from '../src/engine/bspViewerAssets.ts';
import {bspLocalModelAliases,bspLocalModelKey} from '../src/engine/bspLocalModelPaths.ts';
import {listModels,openModel,modelRoots} from '../server/modelAssets.js';

const entity=(classname,origin=[0,0,36],properties={})=>({classname,origin,properties});
test('player start alone may show a preview MDL; deathmatch/coop spawn markers never become characters',()=>{
  assert.equal(bspAllowStudioModel('info_player_start'),true);
  assert.equal(bspAllowStudioModel('info_player_deathmatch'),false);
  assert.equal(bspResolvedModelPath(entity('info_player_deathmatch',[0,0,40],{model:'models/player/gordon/gordon.mdl'})),null);
  assert.equal(bspResolvedModelPath(entity('info_player_coop',[0,0,40],{model:'models/barney.mdl'})),null);
  assert.equal(bspResolvedModelPath(entity('info_player_start')), 'models/player/gordon/gordon.mdl');
  const list=bspModelPlacements([entity('info_player_deathmatch'),entity('info_player_start'),entity('monster_zombie')]);
  assert.deepEqual(list.map(x=>x.classname).sort(),['info_player_start','monster_zombie']);
});
test('normalize custom models from nested folders and custom new_model key; reject traversal',()=>{
  assert.equal(bspMdlPath('/sandstone/massnse.mdl'),'models/sandstone/massnse.mdl');
  assert.equal(bspMdlPath('models/sandstone/custom monster.mdl'),'models/sandstone/custom monster.mdl');
  assert.equal(bspResolvedModelPath(entity('squadmaker',[0,0,0],{new_model:'/sandstone/massnse.mdl'})),'models/sandstone/massnse.mdl');
  for(const bad of ['../outside.mdl','models/../../bad.mdl','C:/Windows/secret.mdl','https://remote/file.mdl'])assert.equal(bspMdlPath(bad),null);
});
test('distance excludes remote entity and keeps selected visible regardless of slider',()=>{
  assert.equal(bspEntityWithinDistance([500,0,0],[0,0,0],200),false);
  assert.equal(bspEntityWithinDistance([500,0,0],[0,0,0],200,true),true);
  assert.equal(bspEntityWithinDistance([500,0,0],[0,0,0],500),true);
});
test('only genuine available idle sequences animate',()=>{
  const sequences=[{name:'run',available:true,frames:25,fps:20,loop:true},{name:'idle1',available:false,frames:26,fps:14,loop:true},{name:'idle2',available:true,frames:30,fps:12,loop:true}];
  assert.equal(bspIdleSequence(sequences),2);
  assert.equal(bspIdleSequence([sequences[0]]),-1);
});
test('worldspawn floor preview alignment uses nearest supporting polygon below, not a brush model',()=>{
  const floor=(z,model=0)=>({model,normal:[0,0,1],points:[[-100,-100,z],[100,-100,z],[100,100,z],[-100,100,z]]});
  assert.equal(bspFloorZ([floor(0),floor(-64),floor(12,1)],[0,0,64]),0);
  assert.equal(bspFloorZ([floor(0)],[1000,1000,64]),null);
  assert.equal(bspFloorZ([floor(-1000)],[0,0,64]),null);
});
test('local MDL paths preserve folder context and allow pack-root aliases',()=>{
  assert.equal(bspLocalModelKey('sandstone/massnse.mdl'),'models/sandstone/massnse.mdl');
  assert.deepEqual(bspLocalModelAliases('sandstone/massnse.mdl'),['models/sandstone/massnse.mdl','models/massnse.mdl']);
  assert.equal(bspLocalModelKey('Addon/models/foo/bar.mdl'),'models/foo/bar.mdl');
  assert.equal(bspLocalModelKey('Addon/../secrets.mdl'),null);
});
test('installed models can be found under custom overlay and an optional valve folder',async()=>{
  const base=await fs.mkdtemp(path.join(os.tmpdir(),'sv-bsp-v3-'));
  try{
    const game=path.join(base,'svencoop');
    await fs.mkdir(path.join(base,'svencoop_addon','models','sandstone'),{recursive:true});
    await fs.mkdir(path.join(base,'valve','models'),{recursive:true});
    await fs.mkdir(game,{recursive:true});
    await fs.writeFile(path.join(base,'svencoop_addon','models','sandstone','test.mdl'),'test model');
    await fs.writeFile(path.join(base,'valve','models','generic.mdl'),'source model');
    const roots=await modelRoots(game);
    assert.ok(roots.some(r=>r.folder==='valve'));
    const list=await listModels(game,'',100,{refresh:true});
    assert.ok(list.items.some(r=>r.path==='models/sandstone/test.mdl'&&r.source==='svencoop_addon'));
    assert.equal((await openModel(game,'valve','models/generic.mdl')).toString(),'source model');
  }finally{await fs.rm(base,{recursive:true,force:true})}
});
test('editor exposes an independent distance control rather than changing label distance only',async()=>{
  const viewer=await fs.readFile(new URL('../src/components/BspViewer.tsx',import.meta.url),'utf8');
  const assets=await fs.readFile(new URL('../src/components/BspViewerAssets.tsx',import.meta.url),'utf8');
  assert.match(viewer,/setEntityDistance/);
  assert.match(viewer,/entityDistance=\{entityDistance\}/);
  assert.match(assets,/bspIdleSequence/);
  assert.match(assets,/bspFloorZ/);
  assert.match(viewer,/extraModels=\{localModels\}/);
});
