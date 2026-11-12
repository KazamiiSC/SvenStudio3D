import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read=p=>readFileSync(p,'utf8');
const load=p=>{
  const js=ts.transpileModule(read(p),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const mod={exports:{}};new Function('module','exports',js)(mod,mod.exports);return mod.exports;
};
const ctrl=load('src/engine/controls.ts');
const make=(code,mods={})=>({code,ctrlKey:false,altKey:false,shiftKey:false,metaKey:false,...mods});
for(const code of ['KeyW','KeyR','KeyT','KeyN','KeyP','KeyL','KeyF']){
  assert.equal(ctrl.isBrowserReservedShortcut(make(code,{ctrlKey:true})),true,`Ctrl+${code} browser reserved`);
  assert.equal(ctrl.shouldGuardNavigationKey(make(code,{ctrlKey:true})),true,`Ctrl+${code} guarded in Walk`);
}
assert.equal(ctrl.isBrowserReservedShortcut(make('KeyW',{metaKey:true})),true);
assert.equal(ctrl.isBrowserReservedShortcut(make('F4',{altKey:true})),true);
assert.equal(ctrl.isBrowserReservedShortcut(make('ArrowLeft',{altKey:true})),true);
for(const code of ['KeyW','KeyC','KeyF','KeyN'])assert.equal(ctrl.isBrowserReservedShortcut(make(code)),false);
assert.equal(ctrl.isBrowserReservedBinding('Ctrl+KeyW'),true);
assert.equal(ctrl.isBrowserReservedBinding('Ctrl+Shift+KeyW'),true);
assert.equal(ctrl.isBrowserReservedBinding('Shift+KeyW'),false);
assert.equal(ctrl.isBrowserReservedBinding('Ctrl+Numpad1'),false);
assert.equal(ctrl.isBrowserReservedBinding(''),false);
assert.equal(ctrl.isWalkCrouchHeld(new Set(['KeyC','KeyW'])),true);
assert.equal(ctrl.isWalkCrouchHeld(new Set(['ControlLeft','KeyW'])),true);
assert.equal(ctrl.isWalkCrouchHeld(new Set(['ControlRight','KeyW'])),true);
assert.equal(ctrl.isWalkCrouchHeld(new Set(['KeyW'])),false);
assert.equal(ctrl.normalizeBinding('Shift+Ctrl+KeyW'),'Ctrl+Shift+KeyW');
const preview=load('src/engine/previewEnhancements.ts');
assert.equal(preview.normalizeWalkPreview(null).safeFullscreen,false,'existing sessions stay in windowed mode');
assert.equal(preview.normalizeWalkPreview({safeFullscreen:true}).safeFullscreen,true);
const app=read('src/App.tsx'),viewport=read('src/components/Viewport.tsx'),i18n=read('src/i18n.ts');
assert.match(app,/addEventListener\('beforeunload',confirmExit\)/,'Walk tab-close confirmation');
assert.match(app,/addEventListener\('keydown',guard,true\)/,'capture keyboard prevention');
assert.match(app,/requestSafeWalkFullscreen\(safety\.safeFullscreen/,'F5 entry supports protected fullscreen');
assert.match(viewport,/requestSafeWalkFullscreen\(walkSettings\.safeFullscreen/,'Walk button supports protected fullscreen');
assert.match(viewport,/const crouch=isWalkCrouchHeld\(active\)/);
assert.match(viewport,/checked=\{walkSettings\.safeFullscreen\}/);
for(const lang of ['es','ru','ko'])assert.ok(i18n.includes('Safe fullscreen keyboard mode')&&i18n.includes('Use C to crouch while moving'));
// Browser simulation verifies fullscreen + lock activation, unlock on exit, and safe fallback.
const lock=load('src/engine/walkKeyboardLock.ts');
let enterCount=0,exitCount=0,lockCount=0,unlockCount=0;
const root={requestFullscreen:async opts=>{enterCount++;assert.equal(opts.keyboardLock,'browser');document.fullscreenElement=root;}};
globalThis.document={documentElement:root,fullscreenElement:null,exitFullscreen:async()=>{exitCount++;document.fullscreenElement=null;}};
Object.defineProperty(globalThis,'navigator',{value:{keyboard:{lock:async()=>{lockCount++;},unlock:()=>{unlockCount++;}}},configurable:true});
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
lock.requestSafeWalkFullscreen(false);await flush();assert.equal(enterCount,0);
lock.requestSafeWalkFullscreen(true);await flush();
assert.equal(enterCount,1);assert.equal(lockCount,1);
lock.releaseSafeWalkFullscreen();await flush();assert.equal(unlockCount,1);assert.equal(exitCount,1);
// If user was already fullscreen, leave that fullscreen untouched.
document.fullscreenElement=root;
lock.requestSafeWalkFullscreen(true);await flush();assert.equal(enterCount,1);assert.equal(lockCount,2);
lock.releaseSafeWalkFullscreen();await flush();assert.equal(unlockCount,2);assert.equal(exitCount,1);
console.log('PASS keyboard safety: C crouch, browser guard, reserved bindings, beforeunload, fullscreen Keyboard Lock lifecycle, legacy Ctrl');
