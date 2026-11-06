import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {texelAt,normalizedUvAt,translateTexelShift,rebaseTexelShift} from '../src/engine/valve220UV.ts';
import {safeTextureAlignment,textureBasisQuality} from '../src/engine/textureAxisSafety.ts';
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`expected ${a} ≈ ${b}`);
const dot=(a,b)=>a.reduce((t,v,i)=>t+v*b[i],0);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');

test('Valve 220: BUTTON3 fractional U scale adds shift after projection division',()=>{
  const p=[-250.08,69.96,60],u=[0,1,0],shift=-65.0249,scale=.375;
  const compiler=dot(p,u)/scale+shift;
  near(texelAt(p,u,scale,shift),compiler);
  near(normalizedUvAt(p,u,scale,shift,32)*32,compiler);
  assert.notEqual(compiler,(dot(p,u)+shift)/scale,'old preview formula would incorrectly scale texel shift');
});

test('Valve 220: negative mirrored V scale preserves correct phase',()=>{
  const p=[-250.08,69.96,60],v=[0,0,-1],shift=60,scale=-.375;
  near(normalizedUvAt(p,v,scale,shift,32)*32,dot(p,v)/scale+shift);
});

test('Valve 220: door U shifts on a 128px texture stay in texels',()=>{
  const p=[-128,0,64],u=[1,0,0],scale=.5,shift=44;
  near(normalizedUvAt(p,u,scale,shift,128)*128,(-128/.5)+44);
});

test('Valve 220: translation lock follows map-space movement with fractional scale',()=>{
  const p=[-250.08,69.96,60],delta=[12,-9,3],u=[0,1,0],s=.375,shift=-65.0249;
  const q=p.map((x,i)=>x+delta[i]);
  near(texelAt(q,u,s,translateTexelShift(shift,delta,u,s)),texelAt(p,u,s,shift));
});

test('Valve 220: translation lock holds negative V scale',()=>{
  const p=[-254.08,70.04,72],delta=[4,3,-7],v=[0,0,-1],s=-.375,shift=60;
  const q=p.map((x,i)=>x+delta[i]);
  near(texelAt(q,v,s,translateTexelShift(shift,delta,v,s)),texelAt(p,v,s,shift));
});

test('Valve 220: custom imported axes retain texture phase on move',()=>{
  const p=[11,23,-5],d=[-7,2,13],u=[Math.SQRT1_2,0,Math.SQRT1_2],v=[0,1,0];
  for(const [axis,s,shift] of [[u,.22,131.74],[v,-.75,-17.4]]){
    near(texelAt(p.map((x,i)=>x+d[i]),axis,s,translateTexelShift(shift,d,axis,s)),texelAt(p,axis,s,shift));
  }
});

test('Valve 220: replacement axis rebase does not jump at the selected anchor',()=>{
  const p=[-250.08,69.96,60],u=[0,1,0],corrected=[0,0,-1],s=.375,shift=-65.0249;
  const next=rebaseTexelShift(shift,p,u,corrected,s);
  near(texelAt(p,corrected,s,next),texelAt(p,u,s,shift));
});

test('UV safety: unusable perpendicular normal is repaired on button face',()=>{
  const n=[0,1,0],p=[-250.08,69.96,60],u=[0,1,0],v=[0,0,1];
  assert.equal(textureBasisQuality(n,u,v),0);
  const result=safeTextureAlignment(n,p,u,v,-65.0249,60,.375,-.375);
  assert.equal(result.repaired,true);
  assert.ok(textureBasisQuality(n,result.u,result.v)>.5);
  near(texelAt(p,result.u,.375,result.uShift),texelAt(p,u,.375,-65.0249));
  near(texelAt(p,result.v,-.375,result.vShift),texelAt(p,v,-.375,60));
});

test('UV safety: valid face axes are untouched',()=>{
  const u=[1,0,0],v=[0,0,-1];
  const out=safeTextureAlignment([0,1,0],[-250,70,60],u,v,20,-30,.5,-.75);
  assert.equal(out.repaired,false);
  assert.deepEqual([out.u,out.v,out.uShift,out.vShift],[u,v,20,-30]);
});

test('UV export: Preview geometry and Valve 220 writer both use safeFaceTextureAxes',()=>{
  const src=readFileSync(resolve(root,'src/engine/geometry.ts'),'utf8');
  const exported=readFileSync(resolve(root,'src/engine/exportMap.ts'),'utf8');
  assert.match(src,/normalizedUvAt\(world,u,uScale,uShift,imageWidth\)/);
  assert.match(src,/normalizedUvAt\(world,v,vScale,vShift,imageHeight\)/);
  assert.match(exported,/safeFaceTextureAxes\(vertices,face\)/);
  assert.match(exported,/\[ \$\{u\.map\(fmt\)/);
});

test('Camera: RMB pointer press owns navigation; no Ctrl-based camera trigger',()=>{
  const src=readFileSync(resolve(root,'src/components/Viewport.tsx'),'utf8');
  assert.match(src,/event\.button!==2/);
  assert.match(src,/rightMouseLook\.current=true/);
  assert.match(src,/canvas\.requestPointerLock/);
  assert.match(src,/rightMouseLook\.current=false/);
  assert.match(src,/document\.exitPointerLock/);
  assert.doesNotMatch(src,/isCameraCaptureShortcut|captureHint/);
});

test('Camera: Q/E vertical, WASD horizontal, and right-click menu remain available',()=>{
  const src=readFileSync(resolve(root,'src/components/Viewport.tsx'),'utf8');
  const context=readFileSync(resolve(root,'src/components/ViewportExtras.tsx'),'utf8');
  assert.match(src,/keyboardVerticalDirection\(active,faceExtrudeActive\)/);
  for(const key of ['w','a','s','d'])assert.ok(src.includes(`active.has('${key}')`),`${key} must move camera`);
  assert.match(context,/if\(!wasDragged\)show\(previous\.x,previous\.y\)/);
});

test('Package version is consistently v1.4.0',()=>{
  const pkg=JSON.parse(readFileSync(resolve(root,'package.json'),'utf8'));
  const lock=JSON.parse(readFileSync(resolve(root,'package-lock.json'),'utf8'));
  assert.equal(pkg.version,'1.4.0');assert.equal(lock.version,'1.4.0');assert.equal(lock.packages[''].version,'1.4.0');
});
