import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {INTERFACE_THEMES,DEFAULT_INTERFACE_THEME,INTERFACE_THEME_SWATCHES,interfaceThemeCopy,normalizeInterfaceTheme} from '../src/engine/interfaceThemes.ts';
import {useStudioLayout,mergeSavedLayout} from '../src/layout.ts';
const source=(path)=>readFileSync(new URL('../src/'+path,import.meta.url),'utf8');

test('six distinct skins, safe fallback and six localized descriptions',()=>{
 assert.deepEqual(INTERFACE_THEMES,['modern','win98','cyber','goldsrc','xp','midnight']);
 assert.equal(DEFAULT_INTERFACE_THEME,'modern');
 assert.equal(new Set(INTERFACE_THEMES.map(id=>INTERFACE_THEME_SWATCHES[id].bg)).size,6);
 for(const id of INTERFACE_THEMES){
  assert.equal(normalizeInterfaceTheme(id),id);
  for(const locale of ['es','en','ru','ko','zh','pt']){
   const labels=interfaceThemeCopy(locale);
   assert.ok(labels.heading.length>3);
   assert.ok(labels[id].length>3);
  }
 }
 for(const invalid of ['light','javascript:alert(1)',null,{},'WIN98',3])assert.equal(normalizeInterfaceTheme(invalid),'modern');
});

test('switching themes preserves dock layout, model, shortcuts and accent',()=>{
 const original=useStudioLayout.getState();
 original.setAccent('gold');original.setSideSize('left',355);original.togglePinnedToolbarGroup('geometry');
 const originalPosition=useStudioLayout.getState().widths.left;
 for(const theme of INTERFACE_THEMES){
  useStudioLayout.getState().setInterfaceTheme(theme);
  const s=useStudioLayout.getState();
  assert.equal(s.interfaceTheme,theme);
  assert.equal(s.accent,'gold');
  assert.equal(s.widths.left,originalPosition);
  assert.ok(s.pinnedToolbarGroups.includes('geometry'));
  assert.equal(s.appearance,'dark');
 }
 useStudioLayout.getState().usePreset('entities');
 assert.equal(useStudioLayout.getState().interfaceTheme,'midnight');
 useStudioLayout.getState().resetLayout();
 assert.equal(useStudioLayout.getState().interfaceTheme,'midnight');
 useStudioLayout.getState().togglePinnedToolbarGroup('geometry');
 useStudioLayout.getState().setInterfaceTheme('modern');
});

test('old or malformed persisted preferences cannot break the theme switcher',()=>{
 const current=useStudioLayout.getState();
 for(const id of INTERFACE_THEMES)assert.equal(mergeSavedLayout({interfaceTheme:id},current).interfaceTheme,id);
 assert.equal(mergeSavedLayout({appearance:'light'},current).interfaceTheme,'modern');
 assert.equal(mergeSavedLayout({interfaceTheme:'untrusted'},current).interfaceTheme,'modern');
 assert.equal(mergeSavedLayout({interfaceTheme:null},current).interfaceTheme,'modern');
});

test('theme propagation reaches portaled dropdowns and floating editors',()=>{
 const app=source('App.tsx');const css=source('interfaceThemes.css')+source('style.css')+source('uiPreview2.css')+source('components/missionEventsStudio.css')+source('components/gameplayDesigner.css');
 assert.match(app,/document\.documentElement\.dataset\.svenTheme=interfaceTheme/);
 assert.match(app,/document\.documentElement\.dataset\.svenAccent=accent/);
 assert.match(app,/studio-theme-\$\{interfaceTheme\}/);
 assert.match(css,/:root\[data-sven-theme\]/);
 for(const selector of ['.topbar-floating-menu','.file-menu','.modal-card','.dock-pane','.studio-viewport-host','.layout-modal','.bsp-recovery','.texture-studio-panel','.sb-shell','.bp-shell','.gs-shell','.npc-shell','.enc-shell','.mp-shell','.pfstudio-dialog','.ui3-inspector-nav','.me-studio','.gds-root','.sound-studio','.lighting-studio','.bsp-viewer','.model-browser'])assert.ok(css.includes(selector),`Missing ${selector}`);
 assert.doesNotMatch(source('interfaceThemes.css'),/\b(?:canvas|\.viewport-canvas|\.bsp-canvas)\s*\{\s*(?:background|filter)/);
});

test('only one theme selector, accessible choices, no separate light-mode switch',()=>{
 const dock=source('components/DockWorkspace.tsx');const app=source('App.tsx');
 assert.match(dock,/INTERFACE_THEMES\.map\(/);
 assert.match(dock,/aria-pressed=\{layout\.interfaceTheme===id\}/);
 assert.match(dock,/layout\.setInterfaceTheme\(id\)/);
 assert.doesNotMatch(dock,/setAppearance\('light'\)/);
 assert.match(app,/dialog==='layout'&&<LayoutModal/);
 assert.match(app,/onClick=\{\(\)=>setDialog\('layout'\)\}/);
});


