import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readNativeBsp,setNativeValue,writeNativeBsp,removeNativeEntity,nativeProperty} from '../src/engine/bspNativeEdit.ts';
import {parseBsp} from '../src/engine/bsp.ts';
import {compactBspCopy} from '../src/engine/bspCompactExport.ts';
import {bspLumpUsage,pruneUnusedBspModels,addBspBoxModels,bspHullContents} from '../src/engine/bspStructure.ts';
import {bspBrushModelPlacements,bspApplyModelPlacements} from '../src/engine/bspBrushEntityEdit.ts';

const load=()=>{const b=fs.readFileSync('tests/fixtures/maptest1_lighting_v159.bsp');return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength);};

test('backslashes are literal like GoldSrc (no doubling on edit)',()=>{
  let doc=readNativeBsp(load());const wad=doc.entities[0].pairs.findIndex(p=>p.key==='wad');
  doc=setNativeValue(doc,0,wad,'\\sierra\\valve\\halflife.wad');
  const out=readNativeBsp(writeNativeBsp(doc));
  assert.equal(nativeProperty(out.entities[0],'wad'),'\\sierra\\valve\\halflife.wad');
  assert.match(out.entities[0].raw,/"wad" "\\sierra\\valve\\halflife\.wad"/);
});

test('lump usage reports counts against compiler limits',()=>{
  const usage=bspLumpUsage(load());
  const models=usage.find(u=>u.key==='models');assert.ok(models.count>=1&&models.max===512);
  assert.ok(usage.every(u=>u.count>=0&&u.percent>=0));
});

test('new box trigger gets a working model, hulls and entity',()=>{
  const src=load();const before=parseBsp(src,'a.bsp');
  const out=compactBspCopy(addBspBoxModels(src,[{classname:'trigger_once',mins:[-64,-64,0],maxs:[64,64,128],props:{target:'door_01'}}])).bytes;
  const doc=readNativeBsp(out);const ent=doc.entities[doc.entities.length-1];
  assert.equal(nativeProperty(ent,'classname'),'trigger_once');assert.equal(nativeProperty(ent,'target'),'door_01');
  const n=Number(nativeProperty(ent,'model').slice(1));assert.equal(n,before.stats.models);
  const after=parseBsp(out,'b.bsp');assert.equal(after.stats.models,before.stats.models+1);assert.equal(after.faces.length,before.faces.length);
  assert.equal(bspHullContents(out,n,1,[0,0,64]),-2,'player standing inside → solid');
  assert.equal(bspHullContents(out,n,1,[0,0,200]),-1,'player above → empty');
  assert.equal(bspHullContents(out,n,1,[0,79,64]),-2,'hull 1 is expanded by the player size');
  assert.equal(bspHullContents(out,n,1,[0,81,64]),-1);
  assert.equal(bspHullContents(out,n,3,[0,0,140]),-2,'crouch hull reaches 18 units above');
});

test('pruning unused models renumbers model keys',()=>{
  const src=compactBspCopy(addBspBoxModels(load(),[
    {classname:'trigger_once',mins:[0,0,0],maxs:[32,32,32],props:{}},{classname:'trigger_multiple',mins:[100,0,0],maxs:[132,32,32],props:{}}])).bytes;
  let doc=readNativeBsp(src);const firstBox=doc.entities.findIndex(e=>nativeProperty(e,'classname')==='trigger_once');
  doc=removeNativeEntity(doc,firstBox);
  const {bytes,removed}=pruneUnusedBspModels(writeNativeBsp(doc));
  assert.equal(removed.length,1);
  const out=readNativeBsp(compactBspCopy(bytes).bytes);
  const multi=out.entities.find(e=>nativeProperty(e,'classname')==='trigger_multiple');
  assert.equal(nativeProperty(multi,'model'),`*${removed[0]}`,'the later model takes the freed index');
});

test('model placements: moved, deleted and shared bmodels',()=>{
  const map={stats:{models:4},faces:[{model:0,points:[[0,0,0]]},{model:1,points:[[0,0,0],[10,0,0]]},{model:2,points:[[5,5,5]]},{model:3,points:[[1,1,1]]}]};
  const p=bspBrushModelPlacements(map,[{properties:{model:'*1',origin:'100 0 0'}},{properties:{model:'*2'}},{properties:{model:'*2',origin:'0 50 0'}}]);
  assert.deepEqual(p.offsets.get(1),[100,0,0]);assert.ok(p.hidden.has(3));assert.deepEqual(p.instances,[{model:2,delta:[0,50,0]}]);
  const placed=bspApplyModelPlacements(map,p);assert.equal(placed.faces.length,3);assert.deepEqual(placed.faces[1].points[1],[110,0,0]);
});

test('prefab capture: grow to object, world solids, entity and points kept',async()=>{
  const {extractBspObjectPrefab,validateBspObjectPrefab}=await import('../src/engine/bspObjectExtractor.ts');
  const {bspSelectFacesInBox,bspGrowConnectedFaces,bspCaptureContext,prefabThumbnail}=await import('../src/engine/bspPrefabCapture.ts');
  const {bspOriginalFaceIndex}=await import('../src/engine/bspFaceSelection.ts');
  const src=load();const map=parseBsp(src,'t.bsp');const wad=new Uint8Array(fs.readFileSync('examples/advanced-coop-v1812/svstudio.wad'));
  const id=i=>bspOriginalFaceIndex(map.faces[i],i);
  const grown=bspGrowConnectedFaces(map.faces,[id(10)],256);
  assert.deepEqual(bspSelectFacesInBox(map.faces,grown,4).sort((a,b)=>a-b),grown.slice().sort((a,b)=>a-b),'box of the object keeps the same faces');
  assert.deepEqual(grown.sort((a,b)=>a-b),[8,10,11,12,13].map(id).sort((a,b)=>a-b),'the whole pillar, not the floor');
  const world=extractBspObjectPrefab(map,src,grown,'pillar',[wad],{mode:'world-solid',worldMargin:8,category:'decoration'});
  const solids=world.objects.filter(o=>o.kind==='brush');assert.equal(solids.length,1);
  const xs=solids[0].vertices.map(v=>v[0]+solids[0].position[0]);assert.equal(Math.round(Math.min(...xs)),-20);assert.equal(Math.round(Math.max(...xs)),20);
  assert.equal(world.category,'decoration');validateBspObjectPrefab(JSON.parse(JSON.stringify(world)));
  const ctx=bspCaptureContext(map.faces,grown,[...map.entities,{classname:'light',origin:[0,140,64],properties:{classname:'light',_light:'255 0 0 100'}}]);
  assert.equal(ctx.entity,null);assert.ok(ctx.points.some(p=>p.classname==='light'&&p.origin[1]===140));
  const withEnt=extractBspObjectPrefab(map,src,grown,'door',[wad],{mode:'world-solid',entity:{classname:'func_door_rotating',props:{classname:'func_door_rotating',origin:'0 0 0',speed:'90',model:'*3'}},points:ctx.points});
  const door=withEnt.objects.find(o=>o.kind==='entity'&&o.classname==='func_door_rotating');
  assert.ok(door&&door.props.speed==='90'&&!door.props.model,'entity kept without model/origin keys');
  assert.ok(withEnt.objects.filter(o=>o.kind==='brush').every(b=>b.entityId===door.id));
  assert.ok(withEnt.objects.some(o=>o.kind==='entity'&&o.classname==='light'));
  validateBspObjectPrefab(JSON.parse(JSON.stringify(withEnt)));
  assert.equal(prefabThumbnail(world.objects),'','no DOM in node: thumbnail is skipped safely');
});

test('smart save falls back from exact solids to world solids instead of failing',async()=>{
  const {extractBspObjectPrefab}=await import('../src/engine/bspObjectExtractor.ts');
  const {bspOriginalFaceIndex}=await import('../src/engine/bspFaceSelection.ts');
  const src=load();const map=parseBsp(src,'t.bsp');const wad=new Uint8Array(fs.readFileSync('examples/advanced-coop-v1812/svstudio.wad'));
  const ids=[8,10,11,12].map(i=>bspOriginalFaceIndex(map.faces[i],i)); // one side missing → exact cannot close it
  const p=extractBspObjectPrefab(map,src,ids,'pillar',[wad],{mode:'auto'});
  assert.equal(p.recovery?.mode,'world-solid');assert.equal(p.objects.filter(o=>o.kind==='brush').length,1);
});

test('complete door plan groups nearby leaves with the same name and their buttons',async()=>{
  const {bspDoorPlan}=await import('../src/engine/bspDoorCapture.ts');
  const box=(model,x)=>[[x,0,0],[x+32,0,0],[x+32,8,0],[x+32,8,96],[x,8,96]].map(p=>p).length&&{model,points:[[x,0,0],[x+32,0,0],[x+32,0,96],[x,0,96]],bspFaceIndex:model*10};
  const faces=[box(1,0),box(2,32),box(3,5000),box(4,80)];
  const ents=[{classname:'func_door',properties:{model:'*1',targetname:'gate'}},{classname:'func_door',properties:{model:'*2',targetname:'gate'}},
    {classname:'func_door',properties:{model:'*3',targetname:'gate'}},{classname:'func_button',properties:{model:'*4',target:'gate'}}];
  const plan=bspDoorPlan(faces,[10],ents);
  assert.deepEqual(plan.parts.map(p=>`${p.role}:${p.model}`),['leaf:1','leaf:2','button:4'],'far door with the same name is not taken');
  assert.equal(plan.box.lo[2],0,'cut frame never takes the floor');
  assert.equal(bspDoorPlan(faces,[40],ents),null,'a button alone is not a door');
});
