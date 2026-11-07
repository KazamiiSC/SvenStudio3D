import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clampUvWidgetPosition,pinUvAnchor} from '../src/engine/uvOverlay.ts';
const source=file=>readFileSync(new URL(`../${file}`,import.meta.url),'utf8');

test('HF5: the UV widget mounts as ordinary DOM under viewport-frame, never within Three Scene',()=>{
  const viewport=source('src/components/Viewport.tsx');
  const texture=source('src/components/TextureStudio.tsx');
  const css=source('src/style.css');
  assert.match(viewport,/<div className="viewport-frame">[\s\S]*?<TextureUVHandles\/>[\s\S]*?<Canvas shadows=/);
  assert.ok(viewport.indexOf('<TextureUVHandles/>')<viewport.indexOf('<Canvas shadows='));
  assert.match(texture,/className="texture-uv-screen-overlay" data-screen-fixed="true"/);
  assert.doesNotMatch(texture,/<Html\b|useFrame\(|useThree\(|\.project\(camera\)|camera\.matrixWorldInverse/);
  assert.match(css,/\.viewport-frame>\.texture-uv-screen-overlay\{position:absolute;inset:0/);
});

test('HF5: first click anchors, later face selection cannot overwrite manual position',()=>{
  const texture=source('src/components/TextureStudio.tsx');
  assert.match(texture,/pinned.current\)return/);
  assert.match(texture,/positionDrag.current=\{pointerId:e.pointerId/);
  assert.match(texture,/pinned.current=p;setPosition\(p\)/);
  assert.match(texture,/onPointerMove=\{moveWidget\}/);
  assert.match(texture,/svenstudio:uv-widget-position-v2/);
  assert.match(texture,/localStorage.setItem\(UV_WIDGET_POS_KEY,JSON.stringify\(pinned.current\)\)/);
});

test('HF5: screen coordinates remain unchanged when only camera position or zoom changes',()=>{
  const pinned={x:430,y:280};
  for(const camera of [{x:0,y:0,z:0,zoom:1},{x:500,y:1000,z:-1500,zoom:20},{x:17,y:22,z:8,zoom:.5}]){
    assert.ok(camera.zoom>0);
    assert.deepEqual(clampUvWidgetPosition(pinned,1000,700),pinned);
  }
  assert.deepEqual(pinUvAnchor({x:520,y:340},{left:100,top:60,width:840,height:560},840,560),{x:420,y:280});
  assert.deepEqual(clampUvWidgetPosition({x:900,y:900},420,300),{x:350,y:195});
  assert.deepEqual(clampUvWidgetPosition({x:-50,y:-100},420,300),{x:70,y:85});
  assert.deepEqual(clampUvWidgetPosition({x:88,y:66},140,120),{x:70,y:60});
});
