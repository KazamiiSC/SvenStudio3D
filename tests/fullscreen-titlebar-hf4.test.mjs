import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const viewport=readFileSync(new URL('../src/components/Viewport.tsx',import.meta.url),'utf8');
const locales=readFileSync(new URL('../src/i18n.ts',import.meta.url),'utf8');
test('Fullscreen with visible label sits directly beside Help in title bar',()=>{
  assert.match(app,/<button className="top-nav" onClick=\{\(\)=>setDialog\('about'\)\}>\{t\('Help'\)\}<\/button>\s*<FullscreenMenuButton\/>/);
  assert.match(app,/fullscreen\?'Exit fullscreen':'Fullscreen'/);
  assert.match(app,/fullscreen\?<Minimize2 size=\{15\}\/>:<Maximize2 size=\{15\}\/>/);
});
test('Fullscreen controls only have one app-level entry point',()=>{
  assert.doesNotMatch(viewport,/toggleImmersive|onClick=\{toggleImmersive\}|\[immersive,setImmersive\]/);
  assert.match(app,/document\.addEventListener\('fullscreenchange',sync\)/);
  assert.match(app,/document\.exitFullscreen\(\)/);
  assert.match(app,/keyboard\?\.lock\?/);
});
test('Fullscreen action has all five translations and English fallback',()=>{
  for(const language of ['es','ru','ko','zh','pt'])assert.match(locales,new RegExp(`Object\\.assign\\(${language},\\{'Fullscreen':`));
  assert.match(locales,/'Exit fullscreen':'Salir de pantalla completa'/);
});
