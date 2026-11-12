import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readDoorOrientation,withDoorDirection,doorMotionOffsetYaw} from '../src/engine/doorDirection.ts';
import {guideForClass,entityGuideWarnings} from '../src/engine/entityGuide.ts';
const file=(name)=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const door=(props)=>({id:'door',kind:'entity',classname:'func_door',name:'door',position:[0,0,0],props});

test('up and down are native GoldSrc angles and preserve other keyvalues',()=>{
 const old={targetname:'door_01',speed:'100',wait:'4',lip:'8',noise1:'doors/motor.wav',angle:'0',angles:'0 0 0'};
 const before=structuredClone(old);
 for(const [direction,yaw] of [['up',-1],['down',-2],['horizontal',0]]){
  const result=withDoorDirection(old,direction);
  assert.equal(result.angles,`0 ${yaw} 0`);
  assert.equal(result.angle,undefined);
  assert.equal(readDoorOrientation(result).direction,direction);
  assert.equal(doorMotionOffsetYaw(result),yaw);
  assert.equal(result.targetname,old.targetname);
  assert.equal(result.noise1,old.noise1);
 }
 assert.deepEqual(old,before);
});
test('existing project: legacy angle conflict is detected without silent data loss',()=>{
 const legacy={targetname:'door_01',angles:'0 0 0',angle:'-1'};
 const read=readDoorOrientation(legacy);
 assert.equal(read.direction,'up');assert.equal(read.conflict,true);assert.equal(doorMotionOffsetYaw(legacy),-1);
 const entity=door(legacy);
 assert.ok(entityGuideWarnings(entity,[entity]).some(x=>x.includes('contradictorios')));
 const fixed=withDoorDirection(legacy,'up');
 assert.deepEqual(fixed,{targetname:'door_01',angles:'0 -1 0'});
 assert.equal(readDoorOrientation(fixed).conflict,false);
});
test('horizontal 90-degree options preserved as angles in a single step',()=>{
 for(const yaw of [0,90,180,270,45]){
  const props=withDoorDirection({angle:'-2',wait:'-1'},'horizontal',yaw);
  assert.equal(props.angles,`0 ${yaw} 0`);
  assert.equal(readDoorOrientation(props).yaw,yaw);
 }
});
test('guide and gameplay preview use the same canonical key',()=>{
 assert.match(guideForClass('func_door').example,/angles = 0 -1 0/);
 assert.match(file('src/engine/gameplayTest.ts'),/doorMotionOffsetYaw\(entity\.props\)/);
 assert.match(file('src/engine/gameplay.ts'),/angles:'0 0 0'/);
});
test('both Gameplay Studio and Properties use a reusable functional direction editor',()=>{
 const panels=file('src/components/Panels.tsx'),guide=file('src/components/EntityAssistant.tsx');
 assert.match(panels,/<DoorMotionControls entity=\{point\}/);
 assert.match(guide,/<DoorMotionControls entity=\{entity\}/);
 assert.match(file('src/components/DoorMotionControls.tsx'),/withDoorDirection\(entity\.props/);
 assert.match(panels,/entityMode==='advanced'/);
 assert.match(panels,/modeText\.basic/);
 assert.match(panels,/modeText\.advanced/);
});
test('large Gameplay help dialog is present and scrolling does not nest inside mini guide',()=>{
 const s=file('src/components/GameplayStudio.tsx'),css=file('src/style.css');
 assert.match(s,/gs-guide-overlay/);
 assert.match(s,/gs-guide-dialog/);
 assert.match(s,/createPortal\(/);
 assert.match(css,/\.gs-guide-body \.ea-content\{max-height:none;overflow:visible/);
});

test('Properties also has a large editor guide with beginner and expert access',()=>{
 const panels=file('src/components/Panels.tsx');
 assert.match(panels,/propertyGuideOpen&&point&&createPortal/);
 assert.match(panels,/EntityAssistant key=\{`properties-guide-/);
 assert.match(panels,/showDoorControls=\{point\.classname!=='func_door'\}/);
 assert.match(panels,/entity-mode-switch/);
});
