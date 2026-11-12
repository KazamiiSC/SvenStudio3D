import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {headerDensity,clampHudPosition} from '../src/engine/adaptiveUiGeometry.ts';
import {measureAdaptiveDocks} from '../src/engine/adaptiveWorkspace.ts';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/App.tsx'),hud=read('src/components/HudWidget.tsx'),css=read('src/style.css'),custom=read('src/components/HudCustomizer.tsx');

test('layout density based on effective CSS width, not display DPI',()=>{
  for(const [physical,scale,expected] of [[1920,1,'wide'],[1920,1.25,'compact'],[1920,1.5,'tight'],[2560,1.25,'wide'],[1366,1,'tight'],[1920,2,'minimal']]){
    assert.equal(headerDensity(physical/scale),expected);
  }
  assert.equal(headerDensity(NaN),'wide');
});
test('actual measured HUD box stays inside available viewport at all DPI-equivalent CSS sizes',()=>{
  for(const [physicalW,physicalH,scale] of [[1920,1080,1],[1920,1080,1.25],[1920,1080,1.5],[2560,1440,1.25],[1366,768,1],[1920,1080,2]]){
    const w=(physicalW/scale)-600,h=(physicalH/scale)-170;
    for(const [widgetW,widgetH] of [[340,60],[355,80],[70,400],[250,130],[80,38]]){
      const box=clampHudPosition(93,94,w,h,widgetW,widgetH);
      assert.ok(box.x>=0&&box.y>=0);
      assert.ok(box.x+Math.min(widgetW,Math.max(0,w-4))<=Math.max(0,w)+.01);
      assert.ok(box.y+Math.min(widgetH,Math.max(0,h-4))<=Math.max(0,h)+.01);
    }
  }
});
test('viewport resize clamps presentation but does not overwrite stored HUD percentages',()=>{
  const before={x:90,y:85};
  const large=clampHudPosition(before.x,before.y,1000,600,220,60);
  const small=clampHudPosition(before.x,before.y,400,260,220,60);
  assert.ok(small.x<large.x&&small.y<large.y);
  assert.deepEqual(before,{x:90,y:85});
  assert.deepEqual(clampHudPosition(95,97,0,0,220,80),{x:0,y:0});
});
test('top bar has 3 zones and a routed overflow menu for secondary actions',()=>{
  for(const marker of ['titlebar-leading','project-title','titlebar-right','titlebar-more-parent','sven-extra-menu'])assert.ok(app.includes(marker),marker);
  assert.match(app,/ref=\{headerRef\}/);
  assert.match(css,/\.app-shell \.titlebar\{display:grid;grid-template-columns:/);
  assert.match(css,/\[data-header-mode=minimal\]/);
  assert.match(app,/t\('Build configuration'\)/);
});
test('toolbar scrollbar has separate bottom gutter, compact tools preserve tooltips',()=>{
  assert.match(css,/\.studio-body\.toolbar-top \.ribbon[^\n]*padding:4px 10px 13px/);
  assert.match(css,/adaptive-compact\.toolbar-top \.tool-button small[^\n]*display:none/);
  assert.match(app,/function ToolButton\(\{active=false,title/);
  assert.match(app,/<button title=\{title\} className=/);
});
test('HUD selection and transient guides clear on close or outside click',()=>{
  const layout=read('src/hudLayout.ts'),vp=read('src/components/Viewport.tsx');
  assert.match(layout,/setEditing:editing=>set\(\{editing,selected:null\}\)/);
  assert.match(layout,/select:\(id:HudId\|null\)=>void/);
  assert.match(vp,/onPointerDown=\{e=>\{e.stopPropagation\(\);useHudLayout\.getState\(\)\.select\(null\)\}\}/);
  assert.match(hud,/editing&&selected===id\?'hud-selected'/);
  assert.match(custom,/selected\?\?'tools'/);
  assert.match(css,/\.hud-shapes\.hud-editing \.shape-palette\{width:max-content!important/);
});
test('HUD positioning uses actual element resize observers and is independent of fixed reserves',()=>{
  assert.match(hud,/ResizeObserver\(measure\)/);
  assert.match(hud,/clampHudPosition\(/);
  assert.doesNotMatch(hud,/reserveWidth:Record/);
  assert.match(hud,/hud-near-right/);
  assert.match(read('src/engine/useCssElementSize.ts'),/clientWidth/);
});
test('layout size preservation remains enabled',()=>{
  const sizes=measureAdaptiveDocks({width:1280,height:720,left:325,right:350,top:0,bottom:0,enabled:true});
  assert.ok(sizes.left>0&&sizes.right>0);
  assert.ok(sizes.left+sizes.right+Math.min(640,Math.max(300,1280*.48))+24<=1280+1);
});
