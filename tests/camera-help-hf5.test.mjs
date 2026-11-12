import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canCaptureMapCamera,canMoveInCameraCapture} from '../src/engine/cameraCapture.ts';
const src=(file)=>readFileSync(new URL(file,import.meta.url),'utf8');
const base={walkMode:false,flyMode:false,drawMode:false,modalTransform:null,textureDragSnapshot:null,hudEditing:false,dialogOpen:false};
test('MAP camera capture permitted in regular selection',()=>assert.equal(canCaptureMapCamera(base),true));
for(const key of Object.keys(base)){
  test('camera capture blocked by '+key,()=>assert.equal(canCaptureMapCamera({...base,[key]:key==='modalTransform'||key==='textureDragSnapshot'?{}:true}),false));
}
test('Ctrl shortcut for camera is removed',()=>{
 const v=src('../src/components/Viewport.tsx');assert.doesNotMatch(v,/isCameraCaptureShortcut|svenstudio:capture-map-camera/);
});
test('WASD available after Ctrl released, blocked while modifier held',()=>{
  assert.equal(canMoveInCameraCapture(new Set(['KeyW','KeyA'])),true);
  for(const code of ['ControlLeft','ControlRight','MetaLeft','MetaRight'])assert.equal(canMoveInCameraCapture(new Set(['KeyW',code])),false);
});
test('RMB look is held only during right-button drag, with Pointer Lock fallback',()=>{
 const view=src('../src/components/Viewport.tsx');
 assert.match(view,/event.button!==2/);
 assert.match(view,/rightMouseLook\.current=true/);
 assert.match(view,/rightMouseLook\.current=false/);
 assert.match(view,/canvas\.requestPointerLock/);
 assert.match(view,/document\.exitPointerLock/);
 assert.match(view,/canMoveInCameraCapture\(active\)/);
});
test('Help lists only updated feature groups and six locales',()=>{
  const guide=src('../src/engine/studioGuide.ts');const app=src('../src/App.tsx');
  for(const id of ['geometry','architecture','textures','entities','world','models','gameplay','bsp','build'])assert.match(guide,new RegExp(`id:'${id}'`));
  for(const code of ['es','en','ru','ko','zh','pt'])assert.match(guide,new RegExp(`(?:^|\\s)${code}:\\{`));
  assert.match(app,/manual\.studios\.map\(/);
  assert.doesNotMatch(app,/v1\.2\.0 Preview 5/);
  assert.match(app,/manual\.camera\)/);
});
