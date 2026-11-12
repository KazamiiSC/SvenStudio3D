// Sound Studio smoke checks: inventory security, native entities, .map round trip.
import ts from 'typescript';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {strict as assert} from 'node:assert';
import {listSounds,soundFile,validSoundPath} from '../server/soundAssets.js';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-sound-'));
const game=path.join(temp,'svencoop');
try{
  const d=path.join(game,'sound','ambience');fs.mkdirSync(d,{recursive:true});
  const addon=path.join(temp,'svencoop_addon','sound','svstudio');fs.mkdirSync(addon,{recursive:true});
  fs.writeFileSync(path.join(d,'test.wav'),Buffer.from('RIFFxxxxxxxxWAVE'));
  fs.writeFileSync(path.join(addon,'hum.ogg'),Buffer.from('OggSxxxx'));
  fs.writeFileSync(path.join(d,'skip.txt'),'not audio');
  const initial=await listSounds(game,'',500),again=await listSounds(game,'ambience',500);
  assert.equal(initial.total,2);assert.equal(again.total,1);
  assert.equal((await listSounds(game,'HUM',500)).total,1);
  assert.equal((await listSounds(game,'',500,{refresh:true})).total,2);
  assert.equal((await soundFile(game,'svencoop','ambience/test.wav')).size,16);
  for(const bad of ['../secret.wav','/absolute.wav','a\\b.wav','.hidden.wav','hello.js','a//b.wav'])assert.equal(validSoundPath(bad),false,bad);
  await assert.rejects(()=>soundFile(game,'svencoop','../secret.wav'));
  await assert.rejects(()=>soundFile(game,'invalid','ambience/test.wav'));
  const outside=path.join(temp,'outside.wav');fs.writeFileSync(outside,'x');
  try{fs.symlinkSync(outside,path.join(d,'bad.wav'));await assert.rejects(()=>soundFile(game,'svencoop','ambience/bad.wav'));}catch(e){if(e.code!=='EPERM'&&e.code!=='EACCES')throw e}
  const runtime=path.join(temp,'transpiled');fs.mkdirSync(runtime,{recursive:true});
  const files=['engine/types.ts','engine/geometry.ts','engine/exportMap.ts','engine/importMap.ts','engine/sound.ts','engine/entityAppearance.ts','engine/controls.ts','engine/fgd.ts','engine/modeling.ts','engine/advancedModeling.ts','engine/prefabs.ts','engine/gameplay.ts','engine/npc.ts','i18n.ts','engine/environment.ts','engine/skyEnclosure.ts','engine/architecture.ts','engine/smartMerge.ts','engine/cinematic.ts','engine/customNpc.ts','engine/terrain.ts','store.ts'];
  for(const file of files){const input=path.join(process.cwd(),'src',file),target=path.join(runtime,file.replace('.ts','.js'));fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,ts.transpileModule(fs.readFileSync(input,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);}
  fs.writeFileSync(path.join(runtime,'package.json'),'{"type":"commonjs"}');
  fs.symlinkSync(path.join(process.cwd(),'node_modules'),path.join(runtime,'node_modules'));
  const require=createRequire(path.join(runtime,'check.cjs'));
  const {makeAudioEntity,soundInfluence,validateAudio,validSoundReference}=require('./engine/sound.js');
  const {createBrush}=require('./engine/geometry.js');
  const {exportMap,validateProject}=require('./engine/exportMap.js');
  const {importMap}=require('./engine/importMap.js');
  const {useEditor,demoProject}=require('./store.js');
  const audio=makeAudioEntity('ambient_generic',[128,0,64],'svstudio/hum.wav',{loop:true,startSilent:true,radius:'small',volume:7});
  assert.equal(audio.props.health,'7');assert.equal(audio.props.playmode,'2');assert.equal(Number(audio.props.spawnflags)&18,18);
  assert.equal(soundInfluence(audio),384);
  const music=makeAudioEntity('ambient_music',[64,64,64],'svstudio/music.ogg',{loop:true,startSilent:true});
  assert.equal(music.props.volume,'10');assert.equal(music.props.spawnflags,'3');assert.equal(soundInfluence(music),null);
  const reverb=makeAudioEntity('env_sound',[0,0,40],'',{roomType:8,reverbRadius:384});
  assert.equal(reverb.props.radius,'384');assert.equal(reverb.props.roomtype,'8');assert.equal(soundInfluence(reverb),384);
  assert.equal(validSoundReference('svstudio/hum.wav'),true);assert.equal(validSoundReference('../../bad.wav'),false);
  assert.equal(validateAudio([audio,music,reverb]).length,0);
  const invalid={...audio,props:{...audio.props,message:'../bad.wav'}};
  assert(validateAudio([invalid]).some(x=>x.severity==='error'));
  const project={version:1,target:'svengine',name:'soundtest',world:{classname:'worldspawn',mapversion:'220',skyname:'desert'},wadNames:['svstudio.wad'],objects:[createBrush('box',[0,0,0],[128,128,16],'Floor'),{id:'spawn',kind:'entity',name:'info_player_start',classname:'info_player_start',position:[0,0,32],props:{}},audio,music,reverb]};
  assert.deepEqual(validateProject(project),[]);
  const result=importMap(exportMap(project));
  for(const name of ['ambient_generic','ambient_music','env_sound']){
    const before=project.objects.find(o=>o.classname===name),after=result.objects.find(o=>o.classname===name);
    assert(after,`Roundtrip missing ${name}`);assert.deepEqual(after.props,before.props);
  }
  assert.equal(validateAudio(result.objects).length,0);
  // Store-level placement must wait for a viewport click and commit only once.
  useEditor.setState({project:demoProject(),selected:null,selectedIds:[],history:[],future:[],audioPlacement:null});
  const count=useEditor.getState().project.objects.length;
  useEditor.getState().startAudioPlacement('ambient_generic','svstudio/studio_hum.wav',{loop:true});
  assert.equal(useEditor.getState().project.objects.length,count);
  useEditor.getState().placePendingAudio([64,96,128]);
  assert.equal(useEditor.getState().project.objects.length,count+1);
  assert.equal(useEditor.getState().audioPlacement,null);
  const placed=useEditor.getState().project.objects.at(-1);
  assert.equal(placed.classname,'ambient_generic');assert.deepEqual(placed.position,[64,96,128]);
  useEditor.getState().undo();assert.equal(useEditor.getState().project.objects.length,count);
  useEditor.getState().redo();assert.equal(useEditor.getState().project.objects.length,count+1);
  useEditor.getState().startAudioPlacement('env_sound','',{roomType:3,reverbRadius:250});
  useEditor.getState().setPlacementShape('box');assert.equal(useEditor.getState().audioPlacement,null);

  console.log('PASS v0.6.2: sound inventory/search/cache/security, three native audio entity kinds, radius, invalid references, Valve 220 roundtrip.');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
