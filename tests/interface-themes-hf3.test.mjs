import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import postcss from 'postcss';
const src=n=>readFileSync(new URL('../src/'+n,import.meta.url),'utf8');
test('component colors are owned by source styles, without an override bridge',()=>{
 assert.doesNotMatch(src('App.tsx'),/import ['"].*interfaceTheme(?:Fixes|Components|ClassicHF5)\.css/);
 for(const f of ['style.css','smartBuild.css','components/blueprintToMapStudio.css','components/missionEventsStudio.css','components/gameplayDesigner.css','components/encounterDesigner.css','components/coopPuzzleStudio.css']){
  const css=postcss.parse(src(f));let declarations=0;
  css.walkDecls(d=>{if(/var\(--(?:theme-|ui-ink|ui-muted)/.test(d.value))declarations++});
  assert.ok(declarations>20,`${f}: semantic colors missing`);
 }
});
test('floating texture controls retain wrapping and viewport limits independently of theme',()=>{
 const css=src('style.css');
 assert.match(css,/\.texture-studio-toolbar\s*\{flex-wrap:wrap/);
 assert.match(css,/\.texture-studio-panel\.texture-studio-floating\s*\{width:min\(320px,calc\(100vw - 12px\)\)/);
 assert.match(src('components/TopDropdown.tsx'),/'--menu-top':`\$\{position.top\}px`/);
 assert.match(src('interfaceThemes.css'),/100dvh - var\(--menu-top,60px\) - 8px/);
});
test('theme palette never paints canvas, scene textures or entity label selectors',()=>{
 const css=postcss.parse(src('interfaceThemes.css'));
 css.walkRules(r=>assert.doesNotMatch(r.selector,/(?:canvas|entity-world-label|entity-label-text|pf3d-stage|npc-model-canvas|material-preview-box)/));
 assert.match(src('style.css'),/\.entity-label-indicator\{[^}]*background:#a488ff/);
});
