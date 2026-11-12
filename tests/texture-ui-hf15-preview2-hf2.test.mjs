import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {pinUvAnchor} from '../src/engine/uvOverlay.ts';
const read=path=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('UV click anchors relative to R3F canvas even with CSS zoom',()=>{
  const canvas={left:100,top:50,width:800,height:600};
  assert.deepEqual(pinUvAnchor({x:450,y:350},canvas,1600,1200),{x:700,y:600});
  assert.deepEqual(pinUvAnchor({x:105,y:55},canvas,800,600),{x:86,y:86});
  assert.deepEqual(pinUvAnchor({x:895,y:645},canvas,800,600),{x:714,y:514});
  assert.deepEqual(pinUvAnchor({x:450,y:350},canvas,140,120),{x:70,y:60});
  assert.equal(pinUvAnchor({x:NaN,y:350},canvas,800,600),null);
  assert.equal(pinUvAnchor({x:450,y:350},{...canvas,width:0},800,600),null);
});
test('UV widget stays fixed after selecting different faces and supports manual repositioning',()=>{
  const viewport=read('src/components/Viewport.tsx');
  const ui=read('src/components/TextureStudio.tsx');
  assert.match(viewport,/CustomEvent\('svenstudio:uv-pin',\{detail:\{id:object.id,face:faceIndex,x:e.clientX,y:e.clientY\}\}\)/);
  assert.match(ui,/if\(!detail\|\|!Number.isFinite\(detail.x\)\|\|!Number.isFinite\(detail.y\)\|\|pinned.current\)return/);
  assert.match(ui,/pinned\.current=p;setPosition\(p\)/);
  assert.match(ui,/positionDrag\.current=\{pointerId:e.pointerId/);
  assert.match(ui,/localStorage.setItem\(UV_WIDGET_POS_KEY,JSON.stringify\(pinned.current\)\)/);
  assert.match(ui,/clampUvWidgetPosition\(anchor,root.clientWidth,root.clientHeight\)/);
  assert.doesNotMatch(ui,/svenstudio:texture-open/);
});
test('Texture Studio floats beyond the viewport and preserves last dragged position',()=>{
  const ui=read('src/components/TextureStudio.tsx');
  const styles=read('src/style.css');
  assert.match(ui,/createPortal\(<div className="texture-studio-panel texture-studio-floating"/);
  assert.match(ui,/portalTarget\):null/);
  assert.match(ui,/document.fullscreenElement/);
  assert.match(ui,/localStorage.setItem\(PANEL_POS_KEY,JSON.stringify\(currentPos.current\)\)/);
  assert.match(ui,/const next=clampTexturePanelPosition/);
  assert.match(styles,/\.texture-studio-panel\.texture-studio-floating\{[\s\S]*?position:fixed!important/);
  assert.doesNotMatch(ui,/setPos\(\{x:Math.min\(Math.max\(8,detail.x/);
});
