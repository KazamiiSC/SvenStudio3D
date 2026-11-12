import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
test('explicit confirmation and compiler profile before every True Lighting rebuild',()=>{
  const ui=read('src/components/TrueLightingPreview.tsx');
  const app=read('src/App.tsx');
  assert.match(ui,/const requestBuild=.*setConfirmBuild\(true\)/);
  assert.ok(ui.includes('role="dialog" aria-modal="true" aria-label={t("Confirm True Lighting compilation")}'));
  assert.match(ui,/may run more slowly until the process finishes/);
  assert.match(ui,/select autoFocus value=\{pendingEngine\}/);
  assert.match(ui,/onBuild\(pendingEngine\)/);
  assert.match(ui,/onClick=\{requestBuild\}/);
  assert.match(app,/onBuild=\{engine=>void compile\('preview',engine\)\}/);
  assert.match(app,/const compile=async\(mode:'game'\|'preview'='game',selectedCompiler\?:'sc'\|'sdhlt'\)/);
  assert.match(app,/compilerEngine:compileSettings.compilerEngine/);
});
test('WASD/QE fly uses existing BSP navigation with browser pointer lock lifecycle',()=>{
  const ui=read('src/components/TrueLightingPreview.tsx');
  const bsp=read('src/components/BspViewer.tsx');
  assert.match(ui,/requestPointerLock/);
  assert.match(ui,/pointerlockchange/);
  assert.match(ui,/BspNavigation map=\{map\} fly=\{fly\}/);
  assert.match(ui,/WASD move · Q\/E vertical/);
  assert.match(bsp,/bspFlyAxes\(keys.current\)/);
  assert.match(read('src/App.tsx'),/document.pointerLockElement\?\.closest\('\.true-light-body'\)/);
});
