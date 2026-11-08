import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('HF3 replaces stretched cyan screenshot with solid responsive DOM cover',()=>{
 const screen=read('src/components/WelcomeScreen.tsx'),css=read('src/style.css');
 assert.match(screen,/sven-welcome-solid/);
 assert.match(screen,/ss-home-tools/);
 assert.match(screen,/ss-home-capabilities/);
 assert.doesNotMatch(screen,/<img|svenstudio-welcome-cyan-full/);
 assert.doesNotMatch(css,/object-fit:fill|sven-welcome-full-art/);
 assert.match(css,/grid-template-columns:repeat\(9,minmax\(0,1fr\)\)/);
});
test('Start is a genuine button, editor stays mounted and versions hidden while home open',()=>{
 const app=read('src/App.tsx'),screen=read('src/components/WelcomeScreen.tsx'),css=read('src/style.css');
 assert.match(screen,/className="ss-home-start" onClick=\{onStart\}/);
 assert.match(app,/welcomeOpen&&<WelcomeScreen onStart=\{\(\)=>setWelcomeOpen\(false\)\}\/>/);
 assert.match(app,/inert=\{welcomeOpen\}/);
 assert.match(css,/\.app-shell\.welcome-home-active \.statusbar \.welcome-hide-version\{display:none\}/);
});
