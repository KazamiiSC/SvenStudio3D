import ts from 'typescript';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {strict as assert} from 'node:assert';
const root=process.cwd(),dir=fs.mkdtempSync(path.join(os.tmpdir(),'sven-route-tree-'));
for(const file of ['types','gameplay','npc','sceneOrganization']){
 const src=path.join(root,'src/engine',file+'.ts'),dst=path.join(dir,'engine',file+'.js');fs.mkdirSync(path.dirname(dst),{recursive:true});
 fs.writeFileSync(dst,ts.transpileModule(fs.readFileSync(src,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
}
fs.writeFileSync(path.join(dir,'package.json'),'{"type":"commonjs"}');
try{
 const require=createRequire(path.join(dir,'index.cjs'));const {organizeScene,routeColor}=require('./engine/sceneOrganization.js');
 const make=(id,classname,props={})=>({id,kind:'entity',name:classname,classname,position:[0,0,0],props});
 const objects=[make('npc1','monster_zombie',{path_name:'first'}),make('npc2','monster_scientist',{path_name:'first'}),make('npc3','monster_human_grunt',{path_name:'second'}),
 make('w1','path_waypoint',{targetname:'first',target:'step2'}),make('w2','path_waypoint',{targetname:'step2'}),make('w3','path_waypoint',{targetname:'second'}),make('wo','path_waypoint',{targetname:'orphan'}),make('sound','ambient_generic',{message:'test.wav'}),
 {id:'floor',kind:'brush',name:'Floor',primitive:'box',position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],vertices:[],faces:[]}];
 const r=organizeScene(objects);
 assert.equal(r.routes.length,2);assert.equal(r.orphanWaypoints.length,1);assert.equal(r.orphanWaypoints[0].id,'wo');
 const shared=r.routes.find(v=>v.key==='first');assert.equal(shared.shared,true);assert.equal(shared.owners.length,2);assert.deepEqual(shared.nodes.map(n=>n.id),['w1','w2']);
 assert.deepEqual(r.memberships.get('w2'),['first']);assert.equal(r.groups.find(g=>g.id==='audio').items.length,1);assert.equal(r.groups.find(g=>g.id==='geometry').items.length,1);
 assert.equal(routeColor('first'),routeColor('first'));assert.notEqual(routeColor('first'),routeColor('second'));
 const broken=structuredClone(objects);broken.find(o=>o.id==='w1').props.target='missing';const br=organizeScene(broken);assert(br.routes.find(v=>v.key==='first').broken);
 // Derived groups must never mutate map source.
 assert.equal(objects.find(o=>o.id==='npc1').props.path_name,'first');
 console.log('PASS v0.6.3: separate/shared NPC routes, owner refs, orphan waypoints, deterministic tint, broken routes, unchanged keyvalues.');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
