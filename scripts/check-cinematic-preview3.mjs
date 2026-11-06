/** Preview 3 regression: native camera properties, simulation-only data and path safety. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import ts from 'typescript';
import {createRequire} from 'node:module';
const root=process.cwd(),temp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-cine-p3-'));
let passed=0;
const test=(name,fn)=>{fn();passed++;console.log(`PASS ${name}`)};
try{
 const files=['src/engine/types.ts','src/engine/geometry.ts','src/engine/exportMap.ts','src/engine/importMap.ts','src/engine/gameplay.ts',
  'src/engine/cinematic.ts','src/engine/cinematicPreview.ts','src/engine/projectValidation.ts','src/engine/fgd.ts','src/engine/modeling.ts',
  'src/engine/advancedModeling.ts','src/engine/prefabs.ts','src/engine/npc.ts','src/engine/sound.ts','src/engine/environment.ts',
  'src/engine/architecture.ts','src/engine/skyEnclosure.ts','src/engine/smartMerge.ts','src/engine/controls.ts',
  'src/engine/entityAppearance.ts','src/i18n.ts','src/engine/customNpc.ts','src/engine/terrain.ts','src/store.ts'];
 for(const file of files){const dest=path.join(temp,file.replace(/\.ts$/,'.js'));fs.mkdirSync(path.dirname(dest),{recursive:true});
   fs.writeFileSync(dest,ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);}
 fs.writeFileSync(path.join(temp,'package.json'),JSON.stringify({type:'commonjs'}));
 fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'),'dir');
 const req=createRequire(path.join(temp,'entry.cjs'));
 const cine=req('./src/engine/cinematic.js');
 const {diagnoseCinematicPath}=req('./src/engine/cinematicPreview.js');
 const {validateProjectFile}=req('./src/engine/projectValidation.js');
 const {createBrush}=req('./src/engine/geometry.js');
 const {exportMap}=req('./src/engine/exportMap.js');
 const {useEditor}=req('./src/store.js');
 const floor=createBrush('box',[0,0,-16],[512,512,32],'Floor');
 const spawn={id:'spawn',kind:'entity',classname:'info_player_start',name:'spawn',position:[0,0,32],props:{}};
 const base=[floor,spawn];
 const {objects:sceneObjects,cameraId}=cine.createCinematicScene(base,{...cine.defaultCinematicOptions([0,0,80]),moving:true});
 const first=cine.appendCinematicWaypoint(sceneObjects,cameraId,[0,0,160]);
 const second=cine.appendCinematicWaypoint(first.objects,cameraId,[200,0,160]);
 const scene=cine.readCinematicScene(second.objects,cameraId);
 const last=scene.route.at(-1);
 const project={version:1,target:'svengine',name:'Preview 3',world:{classname:'worldspawn'},wadNames:[],objects:second.objects};
 test('Native acceleration, rotation and HUD keys are saved; all unrelated objects unchanged',()=>{
   const input=second.objects.map(o=>o.id===cameraId?{...o,props:{...o.props,spawnflags:String(260|128|512),custom_key:'preserve'}}:o);
   const settings={duration:13,speed:220,freezePlayer:false,allPlayers:true,invulnerable:true,acceleration:340,deceleration:200,turnspeed:80,
      startAtPlayer:true,followPlayer:false,forceView:true,noInstantTurn:true,instantMove:true,hideHealth:true,hideFlashlight:true,hideWeapons:false};
   const updated=cine.updateCinematicCamera(input,cameraId,settings),cam=updated.find(o=>o.id===cameraId);
   assert.equal(cam.props.acceleration,'340');assert.equal(cam.props.deceleration,'200');assert.equal(cam.props.turnspeed,'80');
   assert.equal(cam.props.hud_health,'1');assert.equal(cam.props.hud_flashlight,'1');assert.equal(cam.props.hud_weapons,'0');
   assert.equal(cam.props.spawnflags,String(128|512|1|8|16|32|64|256));assert.equal(cam.props.custom_key,'preserve');
   assert.deepEqual(updated.filter(o=>o.id!==cameraId),input.filter(o=>o.id!==cameraId));
   assert.throws(()=>cine.updateCinematicCamera(input,cameraId,{...settings,acceleration:10000}),/acceleration/);
 });
 test('Preview segment speeds alter only simulation, never native path_corner.speed',()=>{
   const normal=cine.previewCinematicPosition(scene,1),override=cine.previewCinematicSegmentPosition(scene,1,{[scene.route[1].id]:20});
   assert.notDeepEqual(normal,override);
   assert.deepEqual(second.objects,project.objects);
   assert.equal(last.props.speed,undefined);
   const map=exportMap({...project,cinematicPreviewSpeeds:{[last.id]:20}});
   assert.doesNotMatch(map,/cinematicPreviewSpeeds|preview_speed|"speed" "20"/);
   assert.match(map,/"classname" "trigger_camera"/);
 });
 test('Preview-only speeds survive project-file validation and reject corrupt data',()=>{
   const p=validateProjectFile({...project,cinematicPreviewSpeeds:{[last.id]:150}});
   assert.equal(p.cinematicPreviewSpeeds[last.id],150);
   assert.throws(()=>validateProjectFile({...project,cinematicPreviewSpeeds:{[last.id]:NaN}}),/cinematic preview speeds/);
   assert.throws(()=>validateProjectFile({...project,cinematicPreviewSpeeds:{[last.id]:-1}}),/cinematic preview speeds/);
 });
 test('Remove-last rewires the previous corner, with no mutation of original or unrelated entities',()=>{
   const old=JSON.stringify(second.objects);
   const updated=cine.removeLastCinematicWaypoint(second.objects,cameraId),reread=cine.readCinematicScene(updated,cameraId);
   assert.equal(reread.route.length,2);assert.equal(reread.route.at(-1).props.target,undefined);
   assert.equal(updated.filter(o=>o.kind==='brush').length,1);
   assert.equal(JSON.stringify(second.objects),old);
   const external={id:'external',kind:'entity',name:'external',classname:'trigger_relay',position:[0,0,0],props:{target:last.props.targetname}};
   assert.throws(()=>cine.removeLastCinematicWaypoint([...second.objects,external],cameraId),/Another entity references/);
 });
 test('Path Doctor flags possible solid intersections and travel time but never edits brushes',()=>{
   const leg=cine.cinematicRouteLegs(scene)[1],mid=leg.from.position.map((v,i)=>(v+leg.to.position[i])/2);
   const blocker=createBrush('box',mid,[80,80,80],'Diagnostic obstruction');
   const original=JSON.stringify(blocker);
   const findings=diagnoseCinematicPath(scene,[floor,blocker]);
   assert.ok(findings.some(w=>w.includes('cross solid brush')),JSON.stringify(findings));
   assert.equal(JSON.stringify(blocker),original);
 });
 test('Preview speed and safe delete are undoable; neither changes native exports',()=>{
   useEditor.getState().loadProject(project);
   const before=exportMap(useEditor.getState().project);
   useEditor.getState().setCinematicPreviewSpeed(last.id,70);
   assert.equal(useEditor.getState().project.cinematicPreviewSpeeds[last.id],70);
   assert.equal(exportMap(useEditor.getState().project),before);
   useEditor.getState().undo();assert.equal(useEditor.getState().project.cinematicPreviewSpeeds,undefined);
   useEditor.getState().redo();assert.equal(useEditor.getState().project.cinematicPreviewSpeeds[last.id],70);
   useEditor.getState().removeLastCinematicPoint(cameraId);
   assert.equal(useEditor.getState().project.cinematicPreviewSpeeds[last.id],undefined);
   useEditor.getState().undo();assert.equal(useEditor.getState().project.cinematicPreviewSpeeds[last.id],70);
   useEditor.getState().loadProject({...project,objects:base});
 });
 test('Cinematic preview has 4 shading modes and native lights; translated controls are present',()=>{
   const ui=fs.readFileSync('src/components/CinematicCameraStudio.tsx','utf8');
   const css=fs.readFileSync('src/style.css','utf8');
   const i18n=fs.readFileSync('src/i18n.ts','utf8');
   for(const fragment of ["'wireframe'|'solid'|'material'|'rendered'",'NativePreviewLight','previewLocalLight','previewSunLight','cine-preview-fullscreen','cine-shading-toolbar','setPlayRate'])
     assert.ok(ui.includes(fragment)||css.includes(fragment),`Missing cinematic UI feature: ${fragment}`);
   for(const fragment of ['Object.assign(es,','Object.assign(ru,','Object.assign(ko,',"'Segment speeds — simulation only'", "'Advanced native camera options'"])
     assert.ok(i18n.includes(fragment),`Missing translation ${fragment}`);
 });
 console.log(`PASS Cinematic Preview 3: ${passed} additional test groups`);
}finally{fs.rmSync(temp,{recursive:true,force:true})}
