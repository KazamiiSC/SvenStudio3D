import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBrush} from '../src/engine/geometry.ts';
import {fitBrushToBounds,brushBounds,resizableBrush} from '../src/engine/orthoProjection.ts';
import {CONTROL_ACTIONS,DEFAULT_CONTROLS,shortcutAction,displayBinding,isBrowserReservedBinding} from '../src/engine/controls.ts';
import {EDITOR_SHORTCUT_GROUPS,actionTitlesEs,actionTitlesEn} from '../src/engine/editorManual.ts';
import {helpWhatsNew} from '../src/engine/helpWhatsNew.ts';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('new tool shortcuts are configurable, unique and not browser-reserved',()=>{
  const ids=['quadView','skybox','entityReport','textureReplace','compileRegion'];
  for(const id of ids){
    assert.ok(CONTROL_ACTIONS.some(a=>a.id===id),id);
    const binding=DEFAULT_CONTROLS.shortcuts[id];
    assert.ok(binding&&!isBrowserReservedBinding(binding),`${id}: ${binding}`);
    assert.equal(shortcutAction(DEFAULT_CONTROLS,binding),id,'no other action uses the same key');
    assert.ok(actionTitlesEs[id]&&actionTitlesEn[id],id);
  }
  const all=Object.values(DEFAULT_CONTROLS.shortcuts);
  assert.equal(new Set(all).size,all.length,'every default binding is unique');
  assert.deepEqual([...EDITOR_SHORTCUT_GROUPS.tools],ids);
  assert.equal(displayBinding('Numpad9'),'Num 9');
  // Keys the editor already uses directly must not be taken.
  for(const taken of ['KeyH','KeyG','KeyR','KeyC','KeyF','Ctrl+KeyZ','Ctrl+KeyY','Delete','NumpadDivide'])assert.ok(!ids.some(id=>DEFAULT_CONTROLS.shortcuts[id]===taken),taken);
  const app=read('src/App.tsx');
  for(const id of ids)assert.match(app,new RegExp(`action==='${id}'`));
});

test('2D resize keeps the opposite side fixed and refuses rotated or too-thin brushes',()=>{
  const wall={...createBrush('box',[-272,0,136],[32,544,288],'Wall'),id:'w'};
  const b=brushBounds(wall);
  const min=[...b.min],max=[...b.max];min[0]=-403;
  const next=fitBrushToBounds(wall,min,max);
  const nb=brushBounds(next);
  assert.equal(Math.round(nb.min[0]),-403);assert.equal(Math.round(nb.max[0]),Math.round(b.max[0]),'right side stays');
  assert.equal(Math.round(nb.max[1]-nb.min[1]),544);
  assert.throws(()=>fitBrushToBounds(wall,[0,0,0],[0.5,10,10]));
  assert.ok(!resizableBrush({...wall,rotation:[0,0,45]}));
  assert.ok(!resizableBrush({...wall,locked:true}));
});

test('2D views: marquee, handles, draw block and visible-grid wiring',()=>{
  const ortho=read('src/components/OrthoViews.tsx');
  assert.match(ortho,/mode:'marquee'/);
  assert.match(ortho,/it\.min\[0\]>=r\.x0&&it\.max\[0\]<=r\.x1/,'objects fully inside the box are selected');
  assert.match(ortho,/state\.resizeBrushToBounds\(d\.hit!,min,max\)/);
  assert.match(ortho,/state\.addDrawnBox\(\[r\.x0,-r\.y1,0\],\[r\.x1,-r\.y0,0\]\)/);
  assert.match(ortho,/const gridStep=useEditor\(s=>s\.gridDisplayStep\)/);
  assert.match(ortho,/aria-label=\{t\('Draw block'\)\}/);
});

test('Help opens with "What is new and where everything is" in six languages, with a place for every card',()=>{
  for(const locale of ['es','en','pt','ru','ko','zh']){
    const h=helpWhatsNew(locale);
    assert.equal(h.cards.length,25,locale); // v2.5: + 8 cards for this version
    assert.ok(h.cards.every(c=>c.title&&c.where&&c.description),locale);
  }
  const dialogs=read('src/app/AppDialogs.tsx');
  assert.match(dialogs,/\['new',whatsNew\.title\],\['start'/,'first entry of the guide index');
  assert.match(dialogs,/id="manual-new"/);
  assert.match(dialogs,/svenstudio:start-tour/);
  assert.match(dialogs,/\{id:'tools',title:translate\(locale,'Editor tools'\),actions:EDITOR_SHORTCUT_GROUPS\.tools\}/);
});

test('first-run tour: five real targets, waits for dialogs, skippable and replayable',()=>{
  const tour=read('src/components/FirstRunTour.tsx');
  for(const target of ["'.ribbon'","'.viewport-frame .hud-view'","'.top-compile'","'.titlebar-more'"])assert.ok(tour.includes(target),target);
  assert.match(tour,/document\.querySelector\('\.modal-backdrop,\[role="dialog"\]'\)/);
  assert.match(tour,/localStorage\.setItem\(STORAGE_KEY,'done'\)/);
  assert.match(tour,/svenstudio:start-tour/);
  assert.match(read('src/App.tsx'),/<FirstRunTour blocked=\{welcomeOpen\|\|bspMode\|\|walkMode\}\/>/);
});
