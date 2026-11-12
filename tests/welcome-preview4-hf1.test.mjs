import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const src=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('logo opens and Start closes a non-destructive welcome overlay',()=>{
 const app=src('src/App.tsx'); const component=src('src/components/WelcomeScreen.tsx');
 assert.match(app,/onClick=\{openWelcome\}/);
 assert.match(app,/setWelcomeOpen\(true\)/);
 assert.match(app,/welcomeOpen&&<WelcomeScreen onStart=\{\(\)=>setWelcomeOpen\(false\)\}\/>/);
 assert.match(app,/inert=\{welcomeOpen\}/);
 assert.match(component,/className="ss-home-start" onClick=\{onStart\}/);
});
test('welcome artwork, editor state and shortcut gating',()=>{
 const app=src('src/App.tsx');const component=src('src/components/WelcomeScreen.tsx');
 assert.match(app,/if\(bspMode\|\|welcomeOpen\)return/);
 assert.match(app,/className=\{`sven-editor-workspace/);
 assert.match(component,/project\.name/);
 assert.doesNotMatch(component,/<img|svenstudio-welcome-cyan-full/);
});
