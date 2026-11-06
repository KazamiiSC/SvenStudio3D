/* Gameplay Test simulation / project integrity regression. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
require.extensions['.ts']=function(mod,file){
  const source=fs.readFileSync(file,'utf8');
  const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  mod._compile(code,file);
};
const {GameplaySession,gameplayTargets}=require('../src/engine/gameplayTest.ts');
const {createBrush}=require('../src/engine/geometry.ts');
let checks=0;const ok=(name,fn)=>{fn();checks++;console.log('PASS',name)};
const ent=(id,classname,props={})=>({kind:'entity',id,name:classname,classname,position:[0,0,32],props});
const brush=(id,entityId,position=[0,0,32],size=[24,24,24])=>({...createBrush('box',position,size),id,entityId});
const d=ent('door','func_door',{targetname:'door_open',speed:'100',wait:'1'});
const b=ent('button','func_button',{target:'door_open',targetname:'button_a',spawnflags:'1'});
const wall=brush('wall',undefined,[200,0,32]);
const door=brush('door_brush','door',[64,0,32],[64,24,64]);
const button=brush('button_brush','button');
const objects=[d,b,wall,door,button];
const snapshot=JSON.stringify(objects);
ok('Button and matching door are recognized by their real entity brush IDs',()=>{
 const s=new GameplaySession(objects);
 assert.deepEqual(s.getAction('button_brush'),{entityId:'button',classname:'func_button'});
 assert.equal(s.getAction('wall'),null);
 assert.equal(s.doors.size,1);
});
ok('E activation follows target -> targetname without rewriting map entities',()=>{
 const s=new GameplaySession(objects);const feedback=s.activate('button');
 assert.equal(feedback.kind,'success');assert.equal(s.doors.get('door').goal,1);
 for(let i=0;i<7;i++)s.step(.1);
 assert.equal(s.doors.get('door').fraction,1);
 assert.equal(s.isDoorOpen('door'),true);
 assert.ok(Math.hypot(...s.doorOffset('door'))>0);
 assert.equal(JSON.stringify(objects),snapshot);
});
ok('Door hold time and closing are transient',()=>{
 const s=new GameplaySession(objects);s.activate('button');
 for(let i=0;i<130;i++)s.step(.1);
 assert.equal(s.doors.get('door').fraction,0);
 assert.equal(JSON.stringify(objects),snapshot);
});
ok('Trigger once fires inside its volume only once',()=>{
 const trigger=ent('once','trigger_once',{target:'door_open'});
 const tbrush=brush('once_brush','once',[300,0,30],[96,96,96]);
 const s=new GameplaySession([...objects,trigger,tbrush]);
 s.enterVolumes([0,0,0]);assert.equal(s.events.has('once'),false);
 s.enterVolumes([300,0,30]);assert.equal(s.events.has('once'),true);
 const activated=s.actions.length;s.step(5);s.enterVolumes([300,0,30]);
 assert.equal(s.actions.length,activated);
});
ok('Wildcard targets resolve across supported named entities',()=>{
 const matches=gameplayTargets('door_*',[d,ent('other','func_door',{targetname:'door_backup'})]);
 assert.equal(matches.length,2);
});
ok('Relay cycles are bounded and never recurse forever',()=>{
 const a=ent('a','trigger_relay',{targetname:'a',target:'b'}),b=ent('b','trigger_relay',{targetname:'b',target:'a'});
 const s=new GameplaySession([a,b]);s.activate('a');assert.ok(s.actions.length<=2);
});
ok('Unsupported custom entities report limitations rather than pretending to execute',()=>{
 const s=new GameplaySession([ent('custom','custom_monster',{target:'door_open'}),...objects]);
 assert.equal(s.activate('custom').kind,'warning');assert.equal(JSON.stringify(objects),snapshot);
});
ok('The existing player preview settings remain backward compatible',()=>{
 const {normalizeWalkPreview}=require('../src/engine/previewEnhancements.ts');
 const prev=normalizeWalkPreview({spawn:'camera',flashlight:true});
 assert.equal(prev.spawn,'camera');assert.equal(prev.flashlight,true);
 assert.equal(prev.rendered,true);assert.equal(prev.showModels,true);assert.equal(prev.interactions,true);
});
ok('Existing SvenStudio gameplay example: button -> relay -> door still works',()=>{
 const project=JSON.parse(fs.readFileSync(path.join(root,'examples/gameplay_button_relay_door.svenstudio.json'),'utf8'));
 const before=JSON.stringify(project);
 const s=new GameplaySession(project.objects);
 const button=s.entities.find(e=>e.classname==='func_button');
 const door=s.entities.find(e=>e.classname==='func_door');
 const part=s.brushes.find(b=>b.entityId===button?.id);
 assert.ok(button&&door&&part);
 assert.equal(s.getAction(part.id)?.entityId,button.id);
 s.activate(button.id);
 assert.equal(s.doors.get(door.id)?.goal,1);
 assert.equal(JSON.stringify(project),before);
 const reset=new GameplaySession(project.objects);
 assert.equal(reset.doors.get(door.id)?.fraction,0);
});
ok('Gameplay preview does not alter the GoldSrc export path or editor state',()=>{
 const file=fs.readFileSync(path.join(root,'src/components/Viewport.tsx'),'utf8');
 assert.ok(file.includes('new GameplaySession(mapObjects)'));
 assert.ok(file.includes("e.code==='KeyE'"));
 assert.ok(!fs.readFileSync(path.join(root,'src/engine/gameplayTest.ts'),'utf8').includes('useEditor'));
});
console.log(`Gameplay Test ${checks}/${checks} checks passed`);
