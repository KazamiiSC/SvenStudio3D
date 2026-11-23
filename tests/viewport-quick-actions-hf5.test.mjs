import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {HUD_IDS,DEFAULT_HUD,migrateHudItems} from '../src/hudLayout.ts';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

// v2.3 HF8: the HF5 "Quick actions" widget was merged into the single viewport bar.
test('quick actions live inside the one viewport bar (no second floating row)',()=>{
  assert.ok(!HUD_IDS.includes('actions'),'no separate quick-actions widget any more');
  const viewport=read('src/components/Viewport.tsx');
  assert.doesNotMatch(viewport,/<HudWidget id="actions">/);
  assert.match(viewport,/<HudWidget id="view"[\s\S]*?<ViewportQuickActions\/>[\s\S]*?<ViewportMoreMenu/);
  assert.equal(DEFAULT_HUD.view.y,1);
  assert.equal(DEFAULT_HUD.status.visible,false,'the old breadcrumb repeated projection/selection mode');
});

test('one home per action: the bar no longer repeats undo/redo, snap, ghosts or entity names',()=>{
  const ui=read('src/components/ViewportQuickActions.tsx');
  for(const action of ['toggleRevealHidden()','hideSelection()','toggleTemporaryIsolation()',"issueCameraCommand('frame')","issueCameraCommand('frameAll')"])assert.ok(ui.includes(action),action);
  for(const moved of ['undo()','redo()','toggleSnap()','toggleGhostHidden()'])assert.ok(!ui.includes(moved),`${moved} lives in the Tools ribbon`);
  const viewport=read('src/components/Viewport.tsx');
  const bar=viewport.slice(viewport.indexOf('<HudWidget id="view"'),viewport.indexOf('</HudWidget>',viewport.indexOf('<HudWidget id="view"')));
  assert.doesNotMatch(bar,/onClick=\{undo\}|onClick=\{redo\}|setFlag\('showEntityNames'|setFlag\('showGrid'/);
  assert.match(ui,/if\(!useEditor\.getState\(\)\.modalTransform\)action/);
  assert.match(ui,/disabled:busy\|\|\(!hiddenCount&&!revealing\)/); // the show-hidden toggle stays usable to hide them again
});

test('narrow viewports move low-priority buttons into the More menu instead of overlapping',()=>{
  const css=read('src/style.css');
  assert.match(css,/\.viewport-frame\{container:sven-viewport\/inline-size\}/);
  assert.match(css,/@container sven-viewport \(max-width:820px\)\{[\s\S]*?\.vbar-p3\{display:none!important\}/);
  assert.match(css,/@container sven-viewport \(max-width:600px\)\{[\s\S]*?\.vbar-p2\{display:none!important\}/);
  assert.match(css,/\.viewport-frame \.hud-widget\.hud-view \.viewport-controls-row\{flex-wrap:nowrap/);
});

test('saved HUD layouts: untouched old defaults move, customised positions are kept',()=>{
  const migrated=migrateHudItems({view:{x:1,y:6,scale:1,opacity:1,visible:true},status:{x:1,y:1,scale:1,opacity:1,visible:true},stats:{x:40,y:50,scale:1,opacity:1,visible:true}},'custom');
  assert.equal(migrated.view.y,1);
  assert.equal(migrated.status.visible,false);
  assert.equal(migrated.stats.x,40,'a position the user chose is not touched');
  assert.equal(migrateHudItems(undefined,'default').view.y,1);
});
