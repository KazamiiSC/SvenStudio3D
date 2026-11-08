import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('welcome defaults to English and never depends on editor locale',()=>{
 const s=read('src/components/WelcomeScreen.tsx');
 for(const phrase of ['WELCOME TO SVENSTUDIO 3D','ADVANCED MAPPING STUDIO FOR SVEN CO-OP','Create, edit, compile and share','Integrated Compilation','BSP Viewer','Start','OPEN 3D EDITOR'])assert.ok(s.includes(phrase),phrase);
 assert.doesNotMatch(s,/locale===|const es=|\{es\?|Iniciar|svenstudio-welcome-cyan-full|<img/);
});
test('solid non-gameplay backdrop and responsive reflow, no image stretching',()=>{
 const s=read('src/style.css');
 assert.match(s,/\.sven-welcome\.sven-welcome-solid\{position:absolute;inset:0/);
 assert.match(s,/background:#071827/);
 assert.match(s,/@media\(max-width:1100px\)/);
 assert.match(s,/@media\(max-width:760px\)/);
 assert.doesNotMatch(s,/object-fit:fill|sven-welcome-full-art/);
});
test('project state preserved; start is an independent native button',()=>{
 const s=read('src/components/WelcomeScreen.tsx'),app=read('src/App.tsx');
 assert.match(s,/project\.objects\.filter/);
 assert.match(s,/className="ss-home-start" onClick=\{onStart\}/);
 assert.match(app,/className=\{`sven-editor-workspace/);
 assert.match(app,/inert=\{welcomeOpen\}/);
 assert.match(app,/if\(bspMode\|\|welcomeOpen\)return/);
});
