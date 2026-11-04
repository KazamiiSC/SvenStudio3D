import ts from 'typescript';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {inspectSoundReference} from '../server/soundDiagnostics.js';

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'sven-audio-632-'));
try {
  const root=path.join(temp,'project'); fs.mkdirSync(root,{recursive:true});
  const js=ts.transpileModule(fs.readFileSync('src/engine/audioConversion.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  fs.writeFileSync(path.join(root,'package.json'),'{"type":"commonjs"}');fs.writeFileSync(path.join(root,'encode.js'),js);
  const r=createRequire(path.join(root,'run.cjs'));
  const {encodePcmWav,WAV_PRESETS}=r('./encode.js');
  // An odd-length 8-bit WAV must pad the data chunk so a subsequent cue chunk is readable.
  const odd=Buffer.from(encodePcmWav([new Float32Array([0,.5,-.5])],WAV_PRESETS.voice,true));
  assert.equal(odd.toString('ascii',0,4),'RIFF');
  assert.equal(odd.readUInt32LE(4),odd.length-8);
  assert.equal(odd.readUInt32LE(40),3);
  assert.equal(odd[47],0); // pad byte
  assert.equal(odd.toString('ascii',48,52),'cue ');
  const gameDir=path.join(temp,'Sven Co-op');fs.mkdirSync(gameDir,{recursive:true});
  const addon=path.join(gameDir,'svencoop_addon','sound','svenstudio_imports');
  const downloaded=path.join(gameDir,'svencoop_downloads','sound','svenstudio_imports');
  const base=path.join(gameDir,'svencoop','sound');
  fs.mkdirSync(addon,{recursive:true});fs.mkdirSync(downloaded,{recursive:true});fs.mkdirSync(base,{recursive:true});
  const audio=Buffer.from(encodePcmWav([new Float32Array(100)],WAV_PRESETS.effects));
  fs.writeFileSync(path.join(addon,'space.wav'),audio);
  fs.writeFileSync(path.join(downloaded,'space.wav'),audio);
  const info=await inspectSoundReference(gameDir,'svenstudio_imports/space.wav');
  assert.deepEqual(info.matches.map(x=>x.source),['svencoop_addon','svencoop_downloads']);
  assert.equal(info.matches[0].wav.rate,22050);
  assert.equal(info.matches[0].wav.bits,16);
  const missing=await inspectSoundReference(gameDir,'svenstudio_imports/missing.wav');
  assert.equal(missing.matches.length,0);
  await assert.rejects(inspectSoundReference(gameDir,'../escape.wav'));
  const studio=fs.readFileSync('src/components/SoundStudio.tsx','utf8');
  const converter=fs.readFileSync('src/components/AudioConverter.tsx','utf8');
  assert.match(studio,/setAsset\(imported\)/);
  assert.match(studio,/setKind\(preset==='music'\?'ambient_music'/);
  assert.match(converter,/onInstalled\(data\.path,preset\)/);
  assert.match(converter,/previewUrl/);
  console.log('PASS v0.6.3.2: new WAV auto-selected, music maps to ambient_music, RIFF padding, file diagnostics, duplicates, path safety.');
}finally{await fsp.rm(temp,{recursive:true,force:true})}
