// Direct node smoke test (no Vite or browser required).
import ts from 'typescript';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {strict as assert} from 'node:assert';
const root=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-npc-'));
const files=['src/engine/types.ts','src/engine/entityAppearance.ts','src/engine/controls.ts','src/engine/geometry.ts','src/engine/exportMap.ts','src/engine/importMap.ts','src/engine/fgd.ts','src/engine/modeling.ts','src/engine/advancedModeling.ts','src/engine/prefabs.ts','src/engine/gameplay.ts','src/engine/npc.ts','src/engine/sound.ts','src/i18n.ts','src/engine/environment.ts','src/store.ts'];
for(const file of files){const target=path.join(temp,file.replace(/\.tsx?$/,'.js'));fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);}
fs.writeFileSync(path.join(temp,'package.json'),'{"type":"commonjs"}');
const require=createRequire(path.join(temp,'check.cjs'));
// Resolve dependencies from the project modules, for the temporary compiled modules.
fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'));
try{
  const npc=require('./src/engine/npc.js'),gameplay=require('./src/engine/gameplay.js');
  const {useEditor,demoProject}=require('./src/store.js');
  const {exportMap,validateProject}=require('./src/engine/exportMap.js');
  const {importMap}=require('./src/engine/importMap.js');
  const {parseFgd}=require('./src/engine/fgd.js');
  const fgd=parseFgd(`@PointClass studio("models/zombie.mdl") = monster_zombie : "Zombie" [\nhealth(integer): "Health": 100\n]\n@PointClass = squadmaker : "Squad maker" [monstertype(string): "Monster Type"]\n@PointClass = path_waypoint : "NPC Waypoint" []`);
  assert.equal(npc.npcClasses(fgd).length,1);
  assert.equal(npc.npcClasses(fgd)[0].studio,'models/zombie.mdl');
  const state=useEditor;
  state.setState({project:demoProject(),selected:null,selectedIds:[],history:[],future:[],fgdClasses:fgd});
  const base=state.getState().project.objects.length;
  state.getState().startNpcPlacement('monster_zombie');
  assert.equal(state.getState().project.objects.length,base); // no implicit spawn in center
  state.getState().placePendingNpc([0,0,40]);
  const monster=state.getState().project.objects.find(o=>o.kind==='entity'&&o.classname==='monster_zombie');
  assert(monster);assert.deepEqual(monster.position,[0,0,40]);assert.equal(state.getState().pendingNpcClass,null);
  state.getState().startWaypointPlacement(monster.id);
  state.getState().placeWaypoint(monster.id,[96,0,40]);
  state.getState().placeWaypoint(monster.id,[96,96,40]);
  state.getState().placeWaypoint(monster.id,[0,96,40]);
  let objects=state.getState().project.objects;
  let route=npc.traceNpcRoute(objects,monster.id);
  assert.equal(route.nodes.length,3);assert.equal(route.brokenTarget,undefined);
  assert.deepEqual(route.nodes.map(e=>e.position),[[96,0,40],[96,96,40],[0,96,40]]);
  const owner=objects.find(o=>o.id===monster.id);assert.equal(owner.props.path_name,route.nodes[0].props.targetname);
  assert.equal(route.nodes[0].props.target,route.nodes[1].props.targetname);
  assert.equal(route.nodes[1].props.target,route.nodes[2].props.targetname);
  assert.equal(route.nodes[2].props.target,'');
  state.getState().spawnFromNpc(monster.id,{monstercount:5,delay:3,maxLive:2,startOn:true});
  objects=state.getState().project.objects;
  const squad=objects.find(o=>o.kind==='entity'&&o.classname==='squadmaker');
  assert(squad);assert.equal(squad.props.monstertype,'monster_zombie');assert.equal(squad.props.path_name,owner.props.path_name);
  assert.equal(Number(squad.props.spawnflags)&33,33);
  assert.equal(npc.validateNpcLogic(objects).length,0);
  assert.deepEqual(validateProject(state.getState().project),[]);
  const map=exportMap(state.getState().project);
  assert(map.includes('"classname" "squadmaker"'));assert(map.includes('"classname" "path_waypoint"'));
  const roundTrip=importMap(map);
  assert.equal(roundTrip.objects.filter(o=>o.kind==='entity'&&o.classname==='path_waypoint').length,3);
  assert.equal(npc.validateNpcLogic(roundTrip.objects).length,0);
  assert.deepEqual(validateProject(roundTrip),[]);
  state.getState().undo();assert(!state.getState().project.objects.some(o=>o.kind==='entity'&&o.classname==='squadmaker'));
  state.getState().redo();assert(state.getState().project.objects.some(o=>o.kind==='entity'&&o.classname==='squadmaker'));
  assert.throws(()=>npc.makeNpcSpawner(objects,monster.id,{monstercount:-2,delay:5,maxLive:2,startOn:false}));
  assert.throws(()=>npc.createWaypoint(objects,'not-a-real-id',[0,0,0]));
  const broken=structuredClone(objects);broken.find(o=>o.kind==='entity'&&o.classname==='squadmaker').props.monstertype='';
  assert(npc.validateNpcLogic(broken).some(e=>e.severity==='error'&&e.message.includes('monstertype')));
  const miss=structuredClone(objects);miss.find(o=>o.kind==='entity'&&o.classname==='monster_zombie').props.path_name='unknown_waypoint';
  assert(npc.validateNpcLogic(miss).some(e=>e.message.includes('unknown_waypoint')));
  const linked=gameplay.getConnections(objects);
  assert.equal(linked.length,2); // consecutive path_waypoint target -> targetname
  console.log('PASS v0.6.1: NPC placement, native path_waypoint routes, squadmaker options, undo/redo, FGD, validator, Valve 220 round-trip.');
}finally{fs.rmSync(temp,{recursive:true,force:true});}
