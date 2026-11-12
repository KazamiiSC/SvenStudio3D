import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const require=createRequire(import.meta.url);
const ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript');
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=(file)=>readFileSync(path.join(base,file),'utf8');
const transpiled=ts.transpileModule(source('src/engine/spawnPresentation.ts'),{
 fileName:'spawnPresentation.ts',compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const spawn={};
new Function('require','exports',transpiled)((id)=>{
 if(id==='./geometry')return {transformedVertices:b=>b.vertices};
 throw Error('Unexpected runtime import: '+id);
},spawn);
const mesh=(bindY,localZ)=>({positions:new Float32Array([0,bindY,0]),localPositions:new Float32Array([0,0,localZ]),boneIndices:new Uint8Array([0])});
const matrix=(vertical)=>({elements:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,vertical,1]});
const studio=(models,sequences=[],samplePose=()=>[matrix(0)])=>({
 bodyparts:[{base:1,models:models.map(m=>({meshes:[m]}))}],sequences,samplePose
});
test('HF9: measures the real idle animation pose, not bind-pose bounds',()=>{
 const model=studio([mesh(0,-38)],[{name:'idle',available:true,frames:8,loop:true}],()=>[matrix(-20)]);
 assert.equal(spawn.spawnModelFootHeight(model),-58);
});
test('HF9: model foot height respects the selected bodygroup',()=>{
 const model=studio([mesh(-75,0),mesh(-12,0)]);
 assert.equal(spawn.spawnModelFootHeight(model,1),-12);
 assert.equal(spawn.spawnModelFootHeight(model,0),-75);
});
test('HF9: feet remain above the floor throughout an idle loop',()=>{
 const frames=[];
 const model=studio([mesh(0,-40)],[{name:'idle',available:true,frames:5,loop:true}],(_,frame)=>{
   frames.push(frame);return [matrix(-frame*2)];
 });
 assert.equal(spawn.spawnModelFootHeight(model),-48);
 assert.deepEqual(frames,[0,1,2,3,4]);
});
test('HF9: uses the same looping sequence fallback as StudioModel',()=>{
 const model=studio([mesh(-4,-11)],[{name:'run',available:true,frames:8,loop:true}],()=>[matrix(-7)]);
 assert.equal(spawn.spawnModelFootHeight(model),-18);
});
test('HF9: safely falls back to bind pose on invalid animation',()=>{
 const model=studio([mesh(-31,0)],[{name:'idle',available:true,frames:8,loop:true}],()=>{throw Error('broken')});
 assert.equal(spawn.spawnModelFootHeight(model),-31);
});
test('HF9: falls back to zero for a missing bodygroup',()=>{
 assert.equal(spawn.spawnModelFootHeight({...studio([]),bodyparts:[]}),0);
});
test('HF9: existing floor detection and spawn yaw are unchanged',()=>{
 const floor={kind:'brush',vertices:[[-50,-50,0],[50,-50,0],[50,50,0],[-50,50,0]],faces:[{indices:[0,1,2,3]}]};
 assert.equal(spawn.spawnFloorZ([0,0,48],[floor]),0);
 assert.equal(spawn.withSpawnYaw({angles:'0 90 0'},180),'0 180 0');
});
test('HF9: spawn UI uses animation-aware foot alignment only for preview',()=>{
 const view=source('src/components/Viewport.tsx');
 assert.match(view,/spawnModelFootHeight\(data,body\)/);
 assert.match(view,/spawnFloorOffset===undefined\?0:spawnFloorOffset-bottom/);
 assert.match(view,/animate=\{isSpawn\|\|walking/);
});
test('HF9: Spanish studies menu uses correct, latest translation',()=>{
 const i18n=source('src/i18n.ts');
 assert.doesNotMatch(i18n,/'Studios':'Herramientas'/);
 assert.match(i18n,/'Studios':'Estudios'/);
});
test('HF9: buttons in Map Doctor and entity association have dark styles',()=>{
 const css=source('src/style.css');
 assert.match(css,/\.map-doctor header button\s*\{/);
 assert.match(css,/\.modeling-properties>button:disabled/);
 assert.match(css,/button\{cursor:pointer;background:#24374c/);
});
test('HF9: source exports unaffected and still use Valve 220',()=>{
 const file=source('src/engine/exportMap.ts');
 assert.match(file,/export /);
 assert.match(file,/texture|valve|Valve|uShift/i);
});
