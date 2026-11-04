// Create an editable sound/trigger example and real Valve 220 MAP.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {strict as assert} from 'node:assert';
const root=process.cwd(),temp=fs.mkdtempSync(path.join(root,'.example-sound-'));
try{
 const files=['types','entityAppearance','controls','geometry','exportMap','importMap','fgd','modeling','gameplay','npc','sound'];
 for(const f of [...files.map(f=>'src/engine/'+f+'.ts'),'src/i18n.ts','src/engine/environment.ts','src/store.ts']){
  const dest=path.join(temp,f.replace('.ts','.js'));fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,ts.transpileModule(fs.readFileSync(path.join(root,f),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
 }
 fs.writeFileSync(path.join(temp,'package.json'),'{"type":"commonjs"}');
 fs.symlinkSync(path.join(root,'node_modules'),path.join(temp,'node_modules'));
 const require=createRequire(path.join(temp,'script.cjs'));
 const {demoProject}=require('./src/store.js');const {createBrush}=require('./src/engine/geometry.js');
 const {makeAudioEntity,validateAudio}=require('./src/engine/sound.js');
 const {makeBrushEntity,connectGameplay,analyzeGameplay}=require('./src/engine/gameplay.js');
 const {exportMap,validateProject}=require('./src/engine/exportMap.js');
 const project=demoProject();project.name='Sound & Atmosphere Demo';
 const hum=makeAudioEntity('ambient_generic',[70,0,110],'svstudio/studio_hum.wav',{loop:true,volume:3,radius:'medium'});
 const chime=makeAudioEntity('ambient_generic',[-180,-180,80],'svstudio/studio_chime.wav',{loop:false,startSilent:true,volume:7,radius:'large'});
 const zone=makeAudioEntity('env_sound',[0,0,48],'',{roomType:3,reverbRadius:384});
 const button=createBrush('box',[-180,-225,80],[36,12,30],'Demo Audio Button');button.layer='Gameplay';
 let objects=[...project.objects,hum,chime,zone,button];
 const b=makeBrushEntity(objects,button.id,'func_button');objects=b.objects;
 objects=connectGameplay(objects,b.id,chime.id);
 project.objects=objects;
 assert.deepEqual(validateProject(project),[]);
 assert.deepEqual(validateAudio(project.objects),[]);
 assert.deepEqual(analyzeGameplay(project.objects).filter(x=>x.severity==='error'),[]);
 fs.writeFileSync(path.join(root,'examples','sound_atmosphere_demo.svenstudio.json'),JSON.stringify(project,null,2));
 fs.writeFileSync(path.join(root,'examples','sound_atmosphere_demo.map'),exportMap(project));
 console.log('PASS: generated sound demo (room hum, triggered chime, reverb zone) as native Svengine .MAP and project.');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
