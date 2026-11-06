/** Cinematic Studio native-Svengine entity and regression checks (no game SDK required). */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import {createRequire} from 'node:module';
const root=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-cinematic-'));
let passed=0;
const test=(label,run)=>{run();passed++;console.log('PASS',label);};
try{
  const files=['src/engine/types.ts','src/engine/geometry.ts','src/engine/exportMap.ts','src/engine/importMap.ts','src/engine/gameplay.ts','src/engine/cinematic.ts',
    'src/engine/fgd.ts','src/engine/modeling.ts','src/engine/advancedModeling.ts','src/engine/prefabs.ts','src/engine/npc.ts','src/engine/sound.ts','src/engine/environment.ts',
    'src/engine/architecture.ts','src/engine/skyEnclosure.ts','src/engine/smartMerge.ts','src/engine/controls.ts','src/engine/entityAppearance.ts','src/i18n.ts','src/engine/customNpc.ts','src/engine/terrain.ts','src/store.ts'];
  for(const file of files){const out=path.join(temp,file.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(out),{recursive:true});
    fs.writeFileSync(out,ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);}
  fs.writeFileSync(path.join(temp,'package.json'),JSON.stringify({type:'commonjs'}));
  fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
  const req=createRequire(path.join(temp,'entry.cjs'));
  const {createCinematicScene,readCinematicScene,appendCinematicWaypoint,updateCinematicCamera,previewCinematicPosition,defaultCinematicOptions}=req('./src/engine/cinematic.js');
  const {exportMap,validateExportIntegrity}=req('./src/engine/exportMap.js');
  const {importMap}=req('./src/engine/importMap.js');
  const {createBrush}=req('./src/engine/geometry.js');
  const {useEditor}=req('./src/store.js');
  const spawn={id:'spawn',kind:'entity',classname:'info_player_start',name:'spawn',position:[0,0,48],props:{angles:'0 0 0'}};
  const trigger={id:'trigger',kind:'entity',classname:'trigger_auto',name:'intro',position:[0,0,64],props:{spawnflags:'1'}};
  const floor=createBrush('box',[0,0,-16],[256,256,32],'Floor');
  const base=[spawn,trigger,floor];
  const original=JSON.stringify(base);
  const opts={...defaultCinematicOptions([0,0,64]),name:'Intro',moving:true,activatorId:'trigger'};
  let result,route1,route2;
  test('Scene creates only native trigger_camera, info_target, path_corner; no brush changes',()=>{
    result=createCinematicScene(base,opts);
    assert.equal(result.objects.length,base.length+3);
    assert.equal(JSON.stringify(base),original,'Input map is never mutated');
    assert.deepEqual(result.objects.filter(o=>o.kind==='brush'),[floor]);
    assert.deepEqual(result.objects.slice(-3).map(o=>o.classname),['trigger_camera','info_target','path_corner']);
    assert.equal(result.objects.find(o=>o.id==='trigger').props.target,result.objects.find(o=>o.id===result.cameraId).props.targetname);
    assert.equal(validateExportIntegrity({version:1,name:'cinematic',objects:result.objects,world:{classname:'worldspawn'},wadNames:[]}).length,0);
  });
  test('Moving cameras use first path_corner as moveto and preserve target look-at',()=>{
    const scene=readCinematicScene(result.objects,result.cameraId);
    assert.ok(scene.generated);assert.equal(scene.route.length,1);
    assert.equal(scene.camera.props.moveto,scene.route[0].props.targetname);
    assert.equal(scene.camera.props.target,scene.lookTarget.props.targetname);
    assert.equal(scene.camera.props.wait,'10');
    assert.equal(Number(scene.camera.props.spawnflags)&(4|8|256),260);
  });
  test('Two mouse-placed corners append in order without cycles and preview remains finite',()=>{
    route1=appendCinematicWaypoint(result.objects,result.cameraId,[-50,-75,180]);
    route2=appendCinematicWaypoint(route1.objects,result.cameraId,[100,-20,175]);
    const scene=readCinematicScene(route2.objects,result.cameraId);
    assert.equal(scene.route.length,3);assert.equal(scene.route[0].props.target,scene.route[1].props.targetname);
    assert.equal(scene.route[1].props.target,scene.route[2].props.targetname);
    assert.ok(scene.route[2].props.target===undefined);
    assert.equal(scene.brokenTarget,null);assert.equal(scene.warnings.length,0);
    assert.ok(previewCinematicPosition(scene,5).every(n=>Number.isFinite(n)));
    assert.deepEqual(previewCinematicPosition(scene,10),scene.route.at(-1).position);
  });
  test('Saving camera flags preserves unsupported engine flags and changes only camera',()=>{
    const withFlag=route2.objects.map(o=>o.id===result.cameraId?{...o,props:{...o.props,spawnflags:String(260|16)}}:o);
    const after=updateCinematicCamera(withFlag,result.cameraId,{duration:12,speed:240,freezePlayer:false,allPlayers:true,invulnerable:false});
    assert.equal(after.find(o=>o.id===result.cameraId).props.spawnflags,String(16|8));
    assert.equal(after.find(o=>o.id===result.cameraId).props.wait,'12');
    assert.equal(after.filter(o=>o.id!==result.cameraId).map(JSON.stringify).join('\n'),withFlag.filter(o=>o.id!==result.cameraId).map(JSON.stringify).join('\n'));
  });
  test('Missing and occupied activators fail without modifying the original map',()=>{
    assert.throws(()=>createCinematicScene(base,{...opts,activatorId:'missing'}),/supported trigger/i);
    const busy=base.map(o=>o.id==='trigger'?{...o,props:{...o.props,target:'existing_logic'}}:o);
    assert.throws(()=>createCinematicScene(busy,opts),/already has a target/i);
    assert.equal(JSON.stringify(base),original);
  });
  test('Valve 220 export/import preserves native camera connections and regular brushes',()=>{
    const p={version:1,target:'svengine',name:'cinematic',objects:route2.objects,world:{classname:'worldspawn',skyname:'desert'},wadNames:[]};
    const map=exportMap(p);
    assert.match(map,/"classname" "trigger_camera"/);assert.match(map,/"classname" "path_corner"/);
    assert.match(map,/"moveto" "cs_path_/);assert.match(map,/"target" "cs_look_/);
    const imported=importMap(map,'cinematic.map');
    const camera=imported.objects.find(o=>o.kind==='entity'&&o.classname==='trigger_camera');
    const scene=readCinematicScene(imported.objects,camera.id);
    assert.equal(scene.route.length,3);assert.ok(scene.lookTarget);
    assert.equal(imported.objects.filter(o=>o.kind==='brush').length,1);
    assert.equal(imported.objects.filter(o=>o.kind==='entity').length,route2.objects.filter(o=>o.kind==='entity').length);
    // A MAP reimport does not retain editor group metadata; targetname marker still identifies generated camera.
    assert.ok(scene.generated);
  });
  test('Undo/redo for whole scene and added point is one atomic history step each',()=>{
    const project={version:1,target:'svengine',name:'cinematic',objects:base,world:{classname:'worldspawn'},wadNames:[]};
    useEditor.getState().loadProject(project);
    const id=useEditor.getState().createCinematic({...opts,activatorId:undefined,moving:false});
    assert.equal(useEditor.getState().project.objects.length,base.length+2);
    assert.equal(useEditor.getState().history.length,1);
    useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.length,base.length);
    useEditor.getState().redo();assert.equal(useEditor.getState().project.objects.length,base.length+2);
    useEditor.getState().startCinematicPlacement(id);
    useEditor.getState().placeCinematicPoint([130,-130,160]);
    assert.equal(readCinematicScene(useEditor.getState().project.objects,id).route.length,2);
    useEditor.getState().undo();assert.equal(readCinematicScene(useEditor.getState().project.objects,id).route.length,0);
    useEditor.getState().startCinematicPlacement(null);
    useEditor.getState().loadProject(project);
  });
  console.log(`PASS Cinematic Camera Studio: ${passed} test groups`);
}finally{fs.rmSync(temp,{recursive:true,force:true});}
