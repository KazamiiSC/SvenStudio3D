import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lightingCompilerKey,lightingCompilerLabel} from '../src/engine/trueLightingCompiler.ts';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('SC identity remains stable when SDHLT-only settings change',()=>{
 const a={compilerEngine:'sc',compilerDir:'C:/SC',sdhltDir:'C:/SD',sdhltAO:false,sdhltPCF:'off'};
 assert.equal(lightingCompilerLabel('sc'),'SC-RAD');
 assert.equal(lightingCompilerLabel('sdhlt'),'SDHLT');
 assert.equal(lightingCompilerKey(a),lightingCompilerKey({...a,sdhltAO:true,sdhltPCF:'4'}));
 assert.notEqual(lightingCompilerKey(a),lightingCompilerKey({...a,compilerDir:'D:/SC'}));
});
test('SDHLT identity changes with its folder, AO, PCF and engine',()=>{
 const a={compilerEngine:'sdhlt',compilerDir:'C:/SC',sdhltDir:'C:/SD',sdhltAO:false,sdhltPCF:'off'};
 for(const changes of [{sdhltDir:'D:/SD'},{sdhltAO:true},{sdhltPCF:'2'},{compilerEngine:'sc'}])
   assert.notEqual(lightingCompilerKey(a),lightingCompilerKey({...a,...changes}));
 assert.equal(lightingCompilerKey(a),lightingCompilerKey({...a,compilerDir:'D:/SC'}));
});
test('true lighting embeds controls and labels only compiled lightmaps, no fake AO',()=>{
 const app=read('src/App.tsx'),ui=read('src/components/TrueLightingPreview.tsx');
 assert.match(app,/truePreviewCompilerKey!==lightingCompilerKey\(settings\)/);
 assert.match(app,/setTruePreviewCompilerKey\(compilerKey\)/);
 assert.match(app,/setTruePreviewCompilerLabel\(engineLabel\)/);
 assert.match(ui,/settings\.compilerEngine==='sdhlt'/);
 assert.match(ui,/sdhltAO/);
 assert.match(ui,/sdhltPCF/);
 assert.match(ui,/AO and PCF only appear if enabled during SDHLRAD compilation/);
 assert.match(ui,/compilerLabel} RGB/);
 assert.match(read('server/index.js'),/if\(previewOnly\)\{/);
});
