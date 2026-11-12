import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('every editor load starts at home; Start returns to the mounted 3D editor',()=>{
 const app=read('src/App.tsx');
 assert.match(app,/const \[welcomeOpen,setWelcomeOpen\]=useState\(true\)/);
 assert.match(app,/welcomeOpen&&<WelcomeScreen onStart=\{\(\)=>setWelcomeOpen\(false\)\}\/>/);
 assert.match(app,/inert=\{welcomeOpen\}/);
});
test('first run guide waits until after Welcome instead of covering the landing page',()=>{
 const app=read('src/App.tsx');
 assert.match(app,/if\(welcomeOpen\)return;/);
 assert.match(app,/localStorage\.getItem\('svenstudio:welcome-guide-v1'\)/);
 assert.match(app,/setDialog\(current=>current\?\?'about'\)/);
});
test('desktop home has bounded grid, overflow clipping, and compact heights',()=>{
 const css=read('src/style.css');
 assert.match(css,/\.sven-welcome\.sven-welcome-solid\.ss-home-parallax\{[\s\S]*?overflow-x:hidden;overflow-y:hidden/);
 assert.match(css,/\.ss-home-parallax \.ss-home-content\{[\s\S]*?height:100%;min-height:0/);
 assert.match(css,/grid-template-rows:auto auto auto auto minmax\(0,1fr\)/);
 assert.match(css,/@media \(min-width:1101px\) and \(max-height:870px\)/);
 assert.match(css,/@media \(max-width:1100px\), \(max-height:630px\)/);
});
test('global pointer motion is reduced but local glow and accessible fallback remain',()=>{
 const screen=read('src/components/WelcomeScreen.tsx'),css=read('src/style.css');
 assert.match(screen,/target=\{x:point\.x\*\.5,y:point\.y\*\.5\}/);
 assert.match(css,/ss-home-tool\.ss-home-tilt-active\{[\s\S]*?rotateX\(calc\(var\(--ss-local-y\)\*-6deg\)\)/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(screen,/--ss-spot-x/);
});
