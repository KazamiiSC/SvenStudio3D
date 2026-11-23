import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const root=new URL('../',import.meta.url);
const src=(p)=>readFileSync(new URL(p,root),'utf8');
const app=src('src/App.tsx');
const css=src('src/style.css');
const rail=src('src/components/QuickToolRail.tsx');
const hud=src('src/hudLayout.ts');

test('Appearance is directly accessible from More at any responsive header density',()=>{
  const start=app.indexOf('id="sven-extra-menu"');
  const end=app.indexOf('</TopDropdown>',start);
  const menu=app.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(menu,/setDialog\('layout'\);setExtraMenu\(false\)/);
  assert.match(menu,/t\('Editor preferences'\)/,'v2.4: Appearance is part of Editor preferences');
  assert.ok(menu.indexOf('setDialog(\'layout\')')<menu.indexOf('setDialog(\'settings\')'));
});
test('Theme shortcut remains visible in tight and minimal responsive modes',()=>{
  const hf9=css.slice(css.indexOf('/* HF9 — Zoom/DPI-safe header'));
  assert.match(hf9,/data-header-mode="tight"/);
  assert.match(hf9,/data-header-mode="minimal"/);
  assert.match(hf9,/display: grid !important/);
  assert.match(hf9,/top-appearance-button/);
  assert.match(app,/className="top-appearance-button"/);
});
test('Quick tools use two-column grid with no scrolling and a short-height three-column fallback',()=>{
  const hf9=css.slice(css.indexOf('/* HF9 — Zoom/DPI-safe header'));
  assert.match(hf9,/grid-template-columns: repeat\(2, minmax\(0, 52px\)\)/);
  assert.match(hf9,/overflow: visible/);
  assert.match(hf9,/max-height: none/);
  assert.match(hf9,/grid-template-columns: repeat\(3, minmax\(0, 48px\)\)/);
  assert.match(hf9,/\.quick-divider\s*\{\s*grid-column: 1 \/ -1/);
  assert.match(rail,/className="quick-rail"/);
  assert.equal((rail.match(/\{tool\(/g)||[]).length,15,'All existing quick-tool actions must remain in the toolbar');
});
test('New installations use a legible quick rail scale without resetting persisted HUD settings',()=>{
  assert.match(hud,/tools:item\(1,20,\.95\)/);
  assert.match(hud,/normalizeHudItem\(old\?\.items\?\.\[id\],DEFAULT_HUD\[id\]\)/);
  assert.match(hud,/name:'svenstudio:viewport-hud-0898'/);
});
