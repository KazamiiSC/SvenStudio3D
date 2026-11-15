import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBrush} from '../src/engine/geometry.ts';
import {createEntityMotionPlan,motionPoseAt,motionCollisionHints,isMotionPreviewSource} from '../src/engine/entityMotionPreview.ts';
import {useMotionPreview} from '../src/entityMotionPreviewState.ts';
import {motionLabels} from '../src/engine/entityMotionPreviewLabels.ts';
const file=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const point=(id,classname,props={},position=[0,0,64])=>({id,kind:'entity',name:id,classname,props,position});
const tied=(entity,dim=[64,64,96])=>{const brush=createBrush('box',[0,0,48],dim,'door');return {...brush,id:`b_${entity.id}`,entityId:entity.id}};

test('HF18 sliding door: native yaw, speed, lip and no project writes',()=>{
 const door=point('door','func_door',{targetname:'door01',angles:'0 0 0',lip:'8',speed:'56'});
 const objects=[door,tied(door)];const before=JSON.stringify(objects);
 const plan=createEntityMotionPlan(objects,door.id);
 assert.equal(plan.tracks.length,1);assert.equal(plan.tracks[0].duration,1);
 assert.deepEqual(motionPoseAt(plan.tracks[0],.5).offset,[28,0,0]);
 assert.deepEqual(motionPoseAt(plan.tracks[0],2).offset,[56,0,0]);
 assert.equal(JSON.stringify(objects),before);
});
test('HF18 door uses canonical up/down vertical directions',()=>{
 for(const [angles,z] of [['0 -1 0',88],['0 -2 0',-88]]){
  const door=point('d','func_door',{angles,lip:'8',speed:'88'});
  const t=createEntityMotionPlan([door,tied(door)],door.id).tracks[0];
  assert.equal(t.path[1][2],z);assert.equal(t.duration,1);
 }
});
test('HF18 rotating door honors origin, distance, axis, reverse flag',()=>{
 const door=point('r','func_door_rotating',{origin:'16 8 32',distance:'90',speed:'45',spawnflags:String(64|2)});
 const track=createEntityMotionPlan([door,tied(door)],door.id).tracks[0];
 assert.equal(track.kind,'rotate');assert.deepEqual(track.axis,[1,0,0]);assert.deepEqual(track.pivot,[16,8,32]);
 assert.equal(motionPoseAt(track,.5).degrees,-45);assert.equal(track.duration,2);
});
test('HF18 rotating door with no native origin displays uncertainty',()=>{
 const door=point('r','func_door_rotating',{distance:'180',spawnflags:'128'});
 const t=createEntityMotionPlan([door,tied(door)],door.id).tracks[0];
 assert.deepEqual(t.axis,[0,1,0]);assert.ok(t.notes.some(n=>n.includes('approximate')));
});
test('HF18 plat height is signed, limited and preview-only',()=>{
 const plat=point('p','func_plat',{height:'-48',speed:'24'});
 const t=createEntityMotionPlan([plat,tied(plat)],plat.id).tracks[0];
 assert.deepEqual(t.path[1],[0,0,48]);assert.equal(t.duration,2);
});
test('HF18 train uses path_corner route without moving original geometry',()=>{
 const train=point('t','func_train',{target:'first',speed:'80'});
 const a=point('a','path_corner',{targetname:'first',target:'second'},[120,0,16]);
 const b=point('b','path_corner',{targetname:'second',target:'third'},[200,0,16]);
 const c=point('c','path_corner',{targetname:'third'},[200,80,16]);
 const objects=[train,tied(train),a,b,c];const snapshot=JSON.stringify(objects);
 const t=createEntityMotionPlan(objects,train.id).tracks[0];
 assert.deepEqual(t.path,[[0,0,0],[80,0,0],[80,80,0]]);
 assert.deepEqual(motionPoseAt(t,.25).offset,[40,0,0]);
 assert.deepEqual(motionPoseAt(t,.75).offset,[80,40,0]);
 assert.equal(JSON.stringify(objects),snapshot);
});
test('HF18 broken train route reports warning, never throws',()=>{
 const train=point('t','func_train',{target:'missing'});
 const p=createEntityMotionPlan([train,tied(train)],train.id);
 assert.equal(p.tracks.length,0);assert.ok(p.warnings.length);
});
test('HF18 button → relay → wildcard doors follows only supported activation names',()=>{
 const button=point('btn','func_button',{target:'relay'});
 const relay=point('relay','trigger_relay',{targetname:'relay',target:'door_*'});
 const d1=point('d1','func_door',{targetname:'door_one'});
 const d2=point('d2','func_door',{targetname:'door_two'});
 const alien=point('alien','monster_alien_slave',{targetname:'door_npc'});
 const p=createEntityMotionPlan([button,relay,d1,tied(d1),d2,tied(d2),alien],button.id);
 assert.deepEqual(p.tracks.map(t=>t.entityId),['d1','d2']);
 assert.ok(p.activatedIds.includes('relay'));assert.ok(!p.activatedIds.includes('alien'));
});
test('HF18 cyclic relays cannot overflow or mutate the project',()=>{
 const a=point('a','trigger_relay',{targetname:'A',target:'B'}),b=point('b','trigger_relay',{targetname:'B',target:'A'});
 const objects=[a,b],before=JSON.stringify(objects);
 const p=createEntityMotionPlan(objects,a.id);assert.deepEqual(p.activatedIds,['a','b']);assert.equal(p.tracks.length,0);assert.equal(JSON.stringify(objects),before);
});
test('HF18 special targets !activator are not guessed to be entity names',()=>{
 const a=point('a','trigger_relay',{target:'!activator'});
 assert.equal(createEntityMotionPlan([a],a.id).tracks.length,0);
});
test('HF18 limit excludes hidden brush and unsupported classes',()=>{
 const door=point('d','func_door'),brush={...tied(door),hidden:true};
 assert.equal(createEntityMotionPlan([door,brush],door.id).tracks.length,0);
 assert.equal(isMotionPreviewSource('worldspawn'),false);
});
test('HF18 approximate collisions are advisory only, not destructive',()=>{
 const door=point('d','func_door',{angles:'0 0 0'}),brush=tied(door),wall=createBrush('box',[60,0,48],[32,64,96]);
 const objects=[door,brush,wall];const snapshot=JSON.stringify(objects);
 const warnings=motionCollisionHints(createEntityMotionPlan(objects,door.id),objects);
 assert.ok(warnings.length>0);assert.equal(JSON.stringify(objects),snapshot);
});
test('HF18 controls live in volatile state, support seek/reset/rate without writing project',()=>{
 const s=useMotionPreview.getState();s.open('door');
 useMotionPreview.getState().setProgress(.7);useMotionPreview.getState().setSpeed(2);
 assert.equal(useMotionPreview.getState().sourceId,'door');assert.equal(useMotionPreview.getState().progress,.7);assert.equal(useMotionPreview.getState().speed,2);
 useMotionPreview.getState().close();assert.equal(useMotionPreview.getState().sourceId,null);assert.equal(useMotionPreview.getState().playing,false);
});
test('HF18 translations available in all six installed locales',()=>{
 for(const lang of ['es','en','ru','ko','zh','pt']){
  const labels=motionLabels(lang);
  for(const key of ['open','title','close','play','pause','note'])assert.ok(labels[key]);
 }
});
test('HF18 UI wiring keeps preview separate from save, MAP compile and BSP',()=>{
 const viewport=file('src/components/Viewport.tsx');
 assert.match(viewport,/<EntityMotionPreview3D\/>/);assert.match(viewport,/<EntityMotionPreviewPanel\/>/);
 assert.match(file('src/components/Panels.tsx'),/isMotionPreviewSource\(point\.classname\)/);
 assert.match(file('src/components/GameplayStudio.tsx'),/useMotionPreview\.getState\(\)\.open\(current\.id\)/);
 const ghost=file('src/components/EntityMotionPreview3D.tsx');assert.match(ghost,/raycast=\{\(\)=>\{\}\}/);
 assert.doesNotMatch(ghost,/(updateObject|setObjectProp|saveProject|exportMap|compileMap)\(/);
});
