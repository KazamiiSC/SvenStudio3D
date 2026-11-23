import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {useStudioLayout,mergeSavedLayout,DEFAULT_HIDDEN_TOOLBAR_GROUPS,TOOLBAR_GROUP_LABELS,TOOLBAR_GROUPS} from '../src/layout.ts';
const read=p=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Grid and Studios ribbon groups start hidden and can be shown again; pinning still works',()=>{
  assert.deepEqual(DEFAULT_HIDDEN_TOOLBAR_GROUPS,['grid','studios']);
  const merged=mergeSavedLayout({toolbarGroups:[...TOOLBAR_GROUPS]},useStudioLayout.getState());
  assert.deepEqual(merged.hiddenToolbarGroups,['grid','studios'],'layouts saved before HF8 get the tidy default');
  const kept=mergeSavedLayout({hiddenToolbarGroups:[]},useStudioLayout.getState());
  assert.deepEqual(kept.hiddenToolbarGroups,[],'an explicit choice is respected');
  const s=useStudioLayout.getState();
  const before=s.hiddenToolbarGroups.includes('grid');
  s.toggleToolbarGroupHidden('grid');
  assert.equal(useStudioLayout.getState().hiddenToolbarGroups.includes('grid'),!before);
  useStudioLayout.getState().toggleToolbarGroupHidden('grid');
  useStudioLayout.getState().togglePinnedToolbarGroup('edit');
  assert.ok(useStudioLayout.getState().pinnedToolbarGroups.includes('edit'));
  useStudioLayout.getState().togglePinnedToolbarGroup('edit');
  assert.ok(!useStudioLayout.getState().pinnedToolbarGroups.includes('edit'));
  for(const id of TOOLBAR_GROUPS)assert.ok(TOOLBAR_GROUP_LABELS[id],id);
  const app=read('src/App.tsx');
  assert.match(app,/\.\.\.\(hiddenToolbarGroups\.includes\(id\)\?\{display:'none'\}:\{\}\)/);
  assert.match(app,/role="menuitemcheckbox" aria-checked=\{!hiddenToolbarGroups\.includes\(id\)\}/);
});

test('menus are grouped: Studios by task, More only shows what the header had to hide',()=>{
  const app=read('src/App.tsx');
  const studios=app.slice(app.indexOf('id="sven-studios-menu"'),app.indexOf('</TopDropdown>',app.indexOf('id="sven-studios-menu"')));
  const order=['Construction','Gameplay','Lighting & sound','Check'].map(k=>studios.indexOf(`{t('${k}')}`));
  assert.ok(order.every(i=>i>0)&&order.every((v,i)=>!i||v>order[i-1]),'sections in order');
  const more=app.slice(app.indexOf('id="sven-extra-menu"'),app.indexOf('</TopDropdown>',app.indexOf('id="sven-extra-menu"')));
  assert.match(more,/\{headerMode==='minimal'&&<>[\s\S]*?\{t\('Studios'\)\}/,'studios are listed in More only when the header hides the Studios menu');
  assert.match(more,/\{\(headerMode==='tight'\|\|headerMode==='minimal'\)&&<>[\s\S]*?\{t\('Workspace'\)\}/);
});

test('header density self-heals after a transient overflow instead of staying collapsed',()=>{
  const hook=read('src/components/useFittingHeaderDensity.ts');
  assert.match(hook,/failed\.current\.set\(fit,\{width,at:Date\.now\(\),delay\}\)/);
  assert.match(hook,/Math\.min\(30000,previous\.delay\*2\)/,'retries back off instead of looping');
  assert.match(hook,/timer=window\.setTimeout\(\(\)=>setFit\(fuller\),wait\)/);
  assert.match(hook,/document\.fonts\?\.ready/);
});

test('HUD editor button is icon-only and the bar leaves room for it at any scale',()=>{
  const css=read('src/style.css');
  assert.match(css,/\.viewport-frame \.hud-editor-toggle:not\(\.active\)>span\{display:none\}/);
  assert.match(css,/\.viewport-frame \.hud-widget\.hud-view \.viewport-controls-row\{max-width:calc\(var\(--hud-container-width,100vw\) - 64px\)\}/);
  assert.match(css,/@container sven-viewport \(max-width:760px\)\{\s*\.viewport-frame \.hud-widget\.hud-help\{display:none\}/);
});
