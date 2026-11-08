import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('version 1.5.23 release number is consistent in product metadata, app, launcher',()=>{
 const pkg=JSON.parse(read('package.json')),lock=JSON.parse(read('package-lock.json'));
 assert.equal(pkg.version,'1.5.23');assert.equal(lock.version,'1.5.23');assert.equal(lock.packages[''].version,'1.5.23');
 assert.match(read('src/App.tsx'),/SvenStudio 3D v1\.5\.23/);
 assert.match(read('SvenStudio3D.bat'),/SvenStudio 3D v1\.5\.23/);
});
test('desktop home clips phantom scroll, mobile can scroll vertically when needed',()=>{
 const css=read('src/style.css');
 assert.match(css,/\.app-shell\.welcome-home-active\{overflow-x:clip/);
 assert.match(css,/\.sven-welcome\.sven-welcome-solid\.ss-home-parallax\{[^}]*overflow-x:hidden;overflow-y:hidden/);
 assert.match(css,/\.ss-home-parallax\{[^}]*contain:paint/);
});
test('new parallax has moving geometry, interactive local tilts, and accessible fallback',()=>{
 const screen=read('src/components/WelcomeScreen.tsx'),css=read('src/style.css');
 for(const part of ['ss-home-depth-field','ss-home-cursor-aura','ss-home-particles','ss-home-symbol-orbit','--ss-local-x','--ss-local-y','--ss-cursor-x','--ss-cursor-y']){
  assert.ok(screen.includes(part),part);assert.ok(css.includes(part),part);
 }
 assert.match(screen,/Array\.from\(\{length:24\}/);
 assert.match(css,/rotateX\(calc\(var\(--ss-local-y\)\*-3deg\)\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/ss-home-symbol-orbit\{animation:none!important\}/);
});
test('Start remains an accessible real button, editor stays mounted, home remains in English',()=>{
 const screen=read('src/components/WelcomeScreen.tsx'),app=read('src/App.tsx');
 assert.match(screen,/onClick=\{onStart\}/);
 assert.match(screen,/aria-label="Start: return to the 3D editor"/);
 assert.match(screen,/ADVANCED MAPPING STUDIO FOR SVEN CO-OP/);
 assert.match(app,/inert=\{welcomeOpen\}/);
});
