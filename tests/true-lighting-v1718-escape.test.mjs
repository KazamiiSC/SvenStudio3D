import {legacyI18nSource} from './support/legacyI18n.cjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const panel=readFileSync(new URL('src/components/TrueLightingPreview.tsx',root),'utf8');
const app=readFileSync(new URL('src/App.tsx',root),'utf8');
const hold=readFileSync(new URL('src/engine/fullscreenEscapeHold.ts',root),'utf8');
const i18n=legacyI18nSource();
test('short Escape or F8 explicitly exits True Lighting pointer lock',()=>{
 assert.match(panel,/event\.code!=='Escape'&&event\.code!=='F8'/);
 assert.match(panel,/document\.pointerLockElement!==flyRef\.current/);
 assert.match(panel,/document\.exitPointerLock\?\.\(\);\s*setFly\(false\)/);
});
test('capturing keydown and keyup are cleaned up',()=>{
 for(const k of ['keydown','keyup']){
  assert.match(panel,new RegExp(`window\\.addEventListener\\('${k}',release,true\\)`));
  assert.match(panel,new RegExp(`window\\.removeEventListener\\('${k}',release,true\\)`));
 }
});
test('MAP editor remains blocked during expanded True Lighting',()=>{
 assert.match(app,/if\(document\.querySelector\('\.true-light-workbench\.true-light-full'\)\)return;/);
});
test('Escape hold remains 1500ms for fullscreen exit',()=>assert.match(hold,/FULLSCREEN_ESCAPE_HOLD_MS=1500/));
test('localized release action exists in five non-English translations',()=>{
 // v2.3 HF4: one JSON dictionary per language.
 for(const lang of ['es','ru','ko','zh','pt'])assert.ok(JSON.parse(readFileSync(new URL(`../src/locales/${lang}.json`,import.meta.url),'utf8'))['Stop WASD free camera (Esc / F8)'],lang);
});
