import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {measureAdaptiveDocks} from '../src/engine/adaptiveWorkspace.ts';
import {useStudioLayout,mergeSavedLayout} from '../src/layout.ts';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const docks=read('src/components/DockWorkspace.tsx'),css=read('src/style.css');

test('Windows 100, 125 and 150 percent: panels fit the logical CSS viewport, not the physical pixels',()=>{
  for(const [scale,width,height] of [[1,1920,1080],[1.25,1536,864],[1.5,1280,720],[2,960,540]]){
    const result=measureAdaptiveDocks({width,height,left:310,right:320,top:0,bottom:0,enabled:true});
    assert.ok(result.left+result.right+24+Math.min(640,Math.max(300,width*.48))<=width+1,`overflow at ${scale}`);
    assert.ok(result.left<=310&&result.right<=320);
    assert.ok(result.left>0&&result.right>0);
    assert.equal(result.compact,width<1650);
  }
});
test('small viewports preserve a usable canvas and avoid invalid dimensions',()=>{
  for(const width of [720,800,900,1024,1280]){
    const d=measureAdaptiveDocks({width,height:650,left:600,right:650,top:300,bottom:220});
    assert.ok(d.left+d.right<width-250);
    assert.ok(d.top+d.bottom<450);
    assert.ok(Number.isFinite(d.left)&&Number.isFinite(d.top));
  }
  const d=measureAdaptiveDocks({width:1280,height:800,left:NaN,right:-1,top:Infinity,bottom:-100});
  assert.equal(d.left,0);assert.equal(d.right,0);assert.equal(d.top,0);assert.equal(d.bottom,0);
});
test('layout adaptation never modifies stored dimensions or a user-selected UI scale',()=>{
  const state=useStudioLayout.getState();
  const requested={left:410,right:370,top:240,bottom:220};
  const output=measureAdaptiveDocks({width:960,height:650,...requested});
  assert.notEqual(output.left,requested.left);
  assert.deepEqual(requested,{left:410,right:370,top:240,bottom:220});
  const merged=mergeSavedLayout({uiScale:1.2,widths:{left:410,right:370}},state);
  assert.equal(merged.autoLayout,true);assert.equal(merged.uiScale,1.2);
  assert.equal(merged.widths.left,410);
  assert.equal(mergeSavedLayout({autoLayout:false},state).autoLayout,false);
});
test('docks use ResizeObserver and workspace client dimensions, not DPI scaling or 100% shell changes',()=>{
  assert.match(docks,/ResizeObserver/);assert.match(docks,/element\.clientWidth/);
  assert.match(docks,/measureAdaptiveDocks\(/);
  assert.doesNotMatch(docks,/devicePixelRatio/);
  assert.match(docks,/adaptive-compact/);assert.match(docks,/adaptive-tight/);
  assert.match(css,/\.studio-body\.adaptive-compact/);
  assert.match(css,/@media\(max-width:1490px\)/);
  assert.match(read('src/App.tsx'),/adaptive-ui-enabled/);
  assert.match(css,/\.adaptive-layout-setting/);
});
test('adaptive toggle and preserved shell scale appear in layout settings',()=>{
  assert.match(docks,/checked=\{layout\.autoLayout\}/);
  assert.match(docks,/layout\.setAutoLayout/);
  const shell=read('src/engine/shellScale.ts');
  assert.match(shell,/if\(welcomeOpen\|\|bspMode\)return 1/);
});

test('HUD items are clamped visually, without changing their stored positions',()=>{
  const hud=read('src/components/HudWidget.tsx');
  assert.match(hud,/clampHudPosition\(/);
  assert.match(hud,/measured\?/);
  assert.match(hud,/ResizeObserver\(measure\)/);
  assert.doesNotMatch(hud,/update\(id,\{x:config\.x/);
});
