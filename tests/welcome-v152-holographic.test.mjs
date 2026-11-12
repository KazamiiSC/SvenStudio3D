import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const get=filename=>readFileSync(new URL('../'+filename,import.meta.url),'utf8');
const css=get('src/style.css'),ui=get('src/components/WelcomeScreen.tsx'),app=get('src/App.tsx');
test('welcome is real interactive editor content and keeps user state when returning',()=>{
 assert.match(app,/useState\(true\)/);
 assert.match(app,/welcomeOpen&&<WelcomeScreen onStart=\{\(\)=>setWelcomeOpen\(false\)\}/);
 assert.match(app,/inert=\{welcomeOpen\}/);
 assert.match(ui,/onClick=\{onStart\}/);
});
test('holographic layers are decorative and never intercept clicks',()=>{
 for(const className of ['ss-home-depth-field','ss-home-hologrid','ss-home-backscatter','ss-home-ambient-rings','ss-home-particles','ss-home-cursor-aura','ss-home-symbol-glass']){
  assert.ok(ui.includes(className),className);
 }
 assert.match(ui,/ss-home-hologrid" aria-hidden="true"/);
 assert.match(css,/\.ss-home-parallax \.ss-home-hologrid[^}]*pointer-events:none/);
 assert.match(css,/\.ss-home-symbol-glass\{[\s\S]*?animation:/);
});
test('desktop home is container-height based and bounded without scrollbars',()=>{
 assert.match(css,/\.sven-welcome\.sven-welcome-solid\.ss-home-parallax\{[\s\S]*?container-type:size/);
 assert.match(css,/\.ss-home-parallax \.ss-home-content\{[\s\S]*?justify-content:space-evenly/);
 assert.match(css,/@container \(max-height: 820px\)/);
 assert.match(css,/@container \(max-height: 760px\)/);
 assert.match(css,/\.ss-home-parallax \.ss-home-topline\{align-self:stretch;width:100%/);
});
test('mouse motion is local and rich but reduced-motion users are protected',()=>{
 assert.match(ui,/target=\{x:point\.x\*\.5,y:point\.y\*\.5\}/);
 assert.match(css,/ss-home-tool\.ss-home-tilt-active\{[\s\S]*?rotateY\(calc\(var\(--ss-local-x\)\*7deg\)\)/);
 assert.match(css,/ss-home-tool\.ss-home-tilt-active svg\{[\s\S]*?translate3d\([^;]*,18px\) scale\(1\.08\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(ui,/window\.requestAnimationFrame\(tick\)/);
});
test('v1.6.0 is the published version in app and package',()=>{
 const pkg=JSON.parse(get('package.json'));
 assert.equal(pkg.version,'1.6.0');
 assert.match(app,/SvenStudio 3D v1\.6\.0/);
 assert.match(get('SvenStudio3D.bat'),/v1\.6\.0/);
});
