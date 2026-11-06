// Generate an editable NPC-route demo and Valve 220 map without Vite.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const root=process.cwd(),temp=fs.mkdtempSync(path.join(root,'.npc-example-'));
try{
 for(const file of ['src/engine/types.ts','src/engine/entityAppearance.ts','src/engine/controls.ts','src/engine/geometry.ts','src/engine/exportMap.ts','src/engine/importMap.ts','src/engine/fgd.ts','src/engine/modeling.ts','src/engine/advancedModeling.ts','src/engine/prefabs.ts','src/engine/gameplay.ts','src/engine/npc.ts','src/i18n.ts','src/engine/environment.ts','src/engine/skyEnclosure.ts','src/engine/architecture.ts','src/engine/smartMerge.ts','src/engine/cinematic.ts','src/engine/customNpc.ts','src/engine/terrain.ts','src/store.ts']){
  const dest=path.join(temp,file.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
 }
 fs.writeFileSync(path.join(temp,'package.json'),'{"type":"commonjs"}');
 const require=createRequire(path.join(temp,'test.cjs'));
 const store=require('./src/store.js'),npctools=require('./src/engine/npc.js');
 const exporter=require('./src/engine/exportMap.js'),importer=require('./src/engine/importMap.js');
 const fgd=store.useEditor.getState().fgdClasses.find(c=>c.name==='monster_zombie');
 if(!fgd)throw Error('Starter monster_zombie is missing.');
 store.useEditor.getState().addEntity(fgd,[-160,-112,16]);
 const npc=store.useEditor.getState().project.objects.find(o=>o.kind==='entity'&&o.classname==='monster_zombie');
 for(const point of [[-160,64,16],[-16,160,16],[144,48,16]])store.useEditor.getState().placeWaypoint(npc.id,point);
 store.useEditor.getState().spawnFromNpc(npc.id,{monstercount:4,delay:7,maxLive:1,startOn:false});
 const project={...store.useEditor.getState().project,name:'NPC AI Studio - Waypoint & Squadmaker Demo'};
 const errors=[...exporter.validateProject(project),...npctools.validateNpcLogic(project.objects).filter(i=>i.severity==='error').map(i=>i.message)];
 if(errors.length)throw Error(errors.join('\n'));
 const map=exporter.exportMap(project);
 if(importer.importMap(map).objects.filter(o=>o.kind==='entity'&&o.classname==='path_waypoint').length!==3)throw Error('Round-trip lost a waypoint.');
 fs.mkdirSync(path.join(root,'examples'),{recursive:true});
 fs.writeFileSync(path.join(root,'examples','npc_waypoint_squadmaker.svenstudio.json'),JSON.stringify(project,null,2));
 fs.writeFileSync(path.join(root,'examples','npc_waypoint_squadmaker.map'),map);
 console.log('PASS: NPC waypoint & squadmaker example generated.');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
