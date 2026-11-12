import ts from 'typescript';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {createRequire} from 'node:module';import {strict as assert} from 'node:assert';
import {installConvertedSound} from '../server/audioConvertInstall.js';
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-audio-convert-'));
const out=path.join(temp,'engine');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(temp,'package.json'),'{"type":"commonjs"}');
fs.writeFileSync(path.join(out,'audioConversion.js'),ts.transpileModule(fs.readFileSync('src/engine/audioConversion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText);
try{
 const require=createRequire(path.join(temp,'check.cjs'));const {encodePcmWav,WAV_PRESETS,safeWavName}=require('./engine/audioConversion.js');
 const effect=encodePcmWav([new Float32Array([0,1,-1,.5])],WAV_PRESETS.effects);const wav=Buffer.from(effect);
 assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');assert.equal(wav.readUInt16LE(22),1);assert.equal(wav.readUInt32LE(24),22050);assert.equal(wav.readUInt16LE(34),16);
 assert.equal(wav.readInt16LE(46),32767);assert.equal(wav.readInt16LE(48),-32768);
 const withCue=Buffer.from(encodePcmWav([new Float32Array([0,1,-1,.5])],WAV_PRESETS.effects,true));assert.equal(withCue.toString('ascii',52,56),'cue ');assert.equal(withCue.readUInt32LE(60),1);
 const voice=Buffer.from(encodePcmWav([new Float32Array([0,1,-1])],WAV_PRESETS.voice));assert.equal(voice.readUInt16LE(34),8);assert.equal(voice[44],128);assert.equal(voice[45],255);assert.equal(voice[46],0);
 const music=Buffer.from(encodePcmWav([new Float32Array([0,.4]),new Float32Array([0,-.4])],WAV_PRESETS.music));assert.equal(music.readUInt16LE(22),2);
 assert.equal(safeWavName('../Hello World.mp3'),'Hello_World.wav');assert.throws(()=>encodePcmWav([],WAV_PRESETS.effects));
 const game=path.join(temp,'svencoop');const addon=path.join(temp,'svencoop_addon','sound');fs.mkdirSync(addon,{recursive:true});fs.mkdirSync(path.join(game,'sound'),{recursive:true});
 const request=(name,body)=>({query:{gameDir:game,name},body});
 async function call(name,body){let code=200,payload;const res={status(n){code=n;return this},json(value){payload=value;return this}};await installConvertedSound(request(name,body),res);return {code,payload};}
 const one=await call('test.wav',wav),two=await call('test.wav',wav);assert.equal(one.code,200);assert.equal(two.code,200);assert.equal(one.payload.path,'svenstudio_imports/test.wav');assert.equal(two.payload.path,'svenstudio_imports/test_1.wav');
 assert(fs.existsSync(path.join(addon,one.payload.path)));
 const evil=await call('../outside.wav',wav);assert.equal(evil.code,400);
 const bogus=await call('bad.wav',Buffer.from('not-wave'));assert.equal(bogus.code,400);
 console.log('PASS v0.6.3: WAV RIFF headers/PCM 8/16-bit, stereo, secure addon install, collision-safe names, invalid path/data rejected.');
}finally{fs.rmSync(temp,{recursive:true,force:true})}
