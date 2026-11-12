import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const source=fs.readFileSync('src/engine/lightingPreview.ts','utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const exports={};vm.runInNewContext(js,{exports});
const {previewLocalLight,previewSunLight,previewDirection,previewCone}=exports;
const close=(a,b,tolerance=1e-7)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const point=previewLocalLight(350);
const dim=previewLocalLight(100);
assert.ok(point.intensity>100000,'visible point light in 128–512u GoldSrc room');
assert.ok(point.intensity>dim.intensity,'_light brightness must affect illumination');
assert.ok(point.distance>800 && point.distance<=2650);
assert.equal(point.decay,2);
const luxAt = (lamp,dist)=>lamp.intensity/(dist*dist);
assert.ok(luxAt(point,320)>.8, 'brightness 350 should light a surface 320 units away');
assert.ok(luxAt(point,320)<3, 'do not overexpose room at 320 units');
assert.ok(luxAt(point,640)<luxAt(point,320), 'distance must reduce illumination');
assert.ok(previewLocalLight(350,'spot').intensity>point.intensity,'spotlight concentrates intensity');
const max=previewLocalLight(1e100),nan=previewLocalLight(NaN),negative=previewLocalLight(-250);
assert.ok(Number.isFinite(max.intensity)&&max.intensity<=1_800_000);
assert.ok(Number.isFinite(nan.intensity)&&nan.intensity>0);
assert.ok(negative.intensity>0);
const down=previewDirection('-90','0');
close(down[0],0);close(down[1],-1);close(down[2],0);
const alongX=previewDirection('0','0');
close(alongX[0],1);close(alongX[1],0);close(alongX[2],0);
const alongMinusZ=previewDirection('0','90');
close(alongMinusZ[2],-1);
const sun=previewSunLight(420,80);
assert.ok(sun.intensity>1 && sun.intensity<4.5);
assert.ok(sun.diffuseIntensity>0 && sun.diffuseIntensity<.6);
const cone=previewCone('25','60');
close(cone.angle,Math.PI/6);
assert.ok(cone.penumbra>.3 && cone.penumbra<.7);
assert.ok(previewCone('150','10').angle<=Math.PI/2);
const view=fs.readFileSync('src/components/Viewport.tsx','utf8');
for(const pattern of [
  "import {previewLocalLight,previewSunLight,previewDirection,previewCone} from '../engine/lightingPreview'",
  'intensity={localLight.intensity}', 'distance={localLight.distance}', 'brightness={parsedLight.brightness}',
  'function SpotLightPreview(', 'function SunLightPreview(', '<SunLightPreview entity={object}',
  'const isLightSource=obj.classname', 'environmentPreview&&isLightSource', 'showMarker={showMarker}',
  'environmentPreview&&<pointLight', 'showMarker&&(showNames', 'shadow-camera-left={-1600}'
]) assert.ok(view.includes(pattern), `View should include ${pattern}`);
assert.ok(!view.includes('parsedLight.brightness/110'),'old physically-invisible light strength removed');
assert.ok(!view.includes('Math.min(2.8,lightIntensity*.34)'),'old sun strength removed');
const walk=fs.readFileSync('src/components/Viewport.tsx','utf8');
assert.ok(walk.includes('<WalkFlashlight/>'),'Walk flashlight preserved');
assert.ok(walk.includes('const isLightSource='),'point/spot/environment lights mounted when visual markers are hidden');
const app=fs.readFileSync('src/App.tsx','utf8');assert.ok(app.includes('v0.9.5')||app.includes('v1.0.0 RC1')||app.includes('v1.0.0')||app.includes('v1.0.1 Preview')||app.includes('v1.2.0 Preview')); 
assert.ok(['0.9.5','1.0.0-rc.1','1.0.0','1.0.1-preview.1','1.0.1-preview.2','1.0.1-preview.3','1.0.1-preview.4','1.0.1-preview.5','1.0.1-preview.5.1','1.1.0-preview.1','1.2.0-preview.1','1.2.0-preview.2','1.2.0-preview.3'].includes(JSON.parse(fs.readFileSync('package.json','utf8')).version));
console.log('PASS v0.9.5: light energy at GoldSrc distances, spot/sun direction and cone, hidden markers and Walk compatibility');
