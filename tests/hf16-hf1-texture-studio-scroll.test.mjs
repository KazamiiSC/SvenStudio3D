import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const ui=readFileSync(new URL('../src/components/TextureStudio.tsx',import.meta.url),'utf8');
const bsp=readFileSync(new URL('../src/components/BspTextureStudio.tsx',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');

test('HF16 HF1: MAP floating studio has viewport-dependent definite height and independent body scroller',()=>{
 assert.match(ui,/texture-studio-panel texture-studio-floating" data-texture-map="true/);
 assert.match(ui,/height:`min\(880px, calc\(100dvh - \$\{pos\.y\+10\}px\)\)`/);
 assert.match(ui,/maxHeight:`calc\(100dvh - \$\{pos\.y\+10\}px\)`/);
 assert.match(css,/\.texture-studio-panel\[data-texture-map\] > \.texture-studio-body\s*\{[^}]*flex:\s*1 1 0%/);
 assert.match(css,/\.texture-studio-panel\[data-texture-map\] > \.texture-studio-body\s*\{[^}]*overflow-y:\s*auto/);
 assert.match(css,/\.texture-studio-panel\[data-texture-map\] > \.texture-studio-body > \*\s*\{[^}]*flex-shrink:\s*0/);
 assert.match(css,/\.texture-studio-panel\[data-texture-map\] > \.texture-studio-head\s*\{[^}]*flex:\s*0 0 auto/);
});

test('HF16 HF1: old saved position, dragging and UV continuity remain intact',()=>{
 assert.match(ui,/svenstudio:texture-panel-screen-pos-v2/);
 assert.match(ui,/const next=clampTexturePanelPosition/);
 assert.match(ui,/const moveDrag=/);
 assert.match(ui,/<SeamlessUvPanel objects=\{objects\} targets=\{targets\} locale=\{locale\}/);
});

test('HF16 HF1: BSP Texture Studio remains separate and does not opt in to MAP-only sizing',()=>{
 assert.match(bsp,/texture-studio-panel texture-studio-floating bsp-texture-studio-panel/);
 assert.doesNotMatch(bsp,/texture-studio-map-panel/);
});
