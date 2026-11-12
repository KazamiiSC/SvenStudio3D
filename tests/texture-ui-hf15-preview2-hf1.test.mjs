import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compactUvAnchor} from '../src/engine/uvOverlay.ts';
const read=(path)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
test('UV manipulator is positioned near visible face while remaining on-screen',()=>{
  assert.deepEqual(compactUvAnchor([{x:-200,y:-200},{x:300,y:300}],800,600),{x:150,y:150});
  assert.deepEqual(compactUvAnchor([{x:700,y:500},{x:1300,y:900}],800,600),{x:714,y:514});
  assert.equal(compactUvAnchor([{x:-500,y:120},{x:-50,y:300}],800,600),null);
  assert.equal(compactUvAnchor([{x:NaN,y:100}],800,600),null);
  assert.deepEqual(compactUvAnchor([{x:25,y:15},{x:90,y:95}],140,120),{x:70,y:60});
});
test('UV overlay is camera zoom independent and no longer projects a face-wide border',()=>{
  const texture=read('src/components/TextureStudio.tsx');
  const css=read('src/style.css');
  assert.match(texture,/pinUvAnchor\(\{x:detail.x,y:detail.y\},rect,root.clientWidth,root.clientHeight\)/);
  assert.doesNotMatch(texture,/<Html fullscreen/);
  assert.doesNotMatch(texture,/<svg aria-hidden="true" className="texture-uv-polygon"/);
  assert.match(css,/\.texture-uv-handles\{\s*width:120px!important;height:120px!important/);
  assert.match(css,/\.texture-uv-polygon\{display:none\}/);
  assert.match(texture,/onPointerDown=\{e=>down\(e,h\)\}/);
  assert.match(texture,/onPointerCancel=\{e=>\{/);
});
test('precision panel is anchored to settings button and has higher stacking priority',()=>{
  const viewport=read('src/components/Viewport.tsx');
  const css=read('src/style.css');
  assert.match(viewport,/className=\{precisionOpen\|\|visualMenuOpen\?'hud-popup-open':''\}/);
  assert.match(viewport,/setPrecisionLeft\(Math.max\(68,Math.min\(trigger.left-toolbar.left,available\)\)\)/);
  assert.match(viewport,/style=\{\{left:precisionLeft\}\}/);
  assert.match(css,/\.hud-widget\.hud-view\.hud-popup-open\{z-index:66\}/);
});
